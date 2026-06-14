const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { getRate } = require('../services/currency');

const router = express.Router();
const prisma = new PrismaClient();

// Multer: store CSV in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Only CSV files allowed'));
    }
    cb(null, true);
  },
});

// ─── Anomaly type constants ───────────────────────────────────────────────────
const ANOMALY = {
  DUPLICATE_ROW:             'DUPLICATE_ROW',
  DUPLICATE_AMOUNT_MISMATCH: 'DUPLICATE_AMOUNT_MISMATCH',
  NEGATIVE_AMOUNT:           'NEGATIVE_AMOUNT',
  ZERO_AMOUNT:               'ZERO_AMOUNT',
  MISSING_REQUIRED_FIELD:    'MISSING_REQUIRED_FIELD',
  INVALID_DATE:              'INVALID_DATE',
  FUTURE_DATE:               'FUTURE_DATE',
  UNKNOWN_MEMBER:            'UNKNOWN_MEMBER',
  MEMBER_NOT_ACTIVE:         'MEMBER_NOT_ACTIVE',
  CURRENCY_MISMATCH:         'CURRENCY_MISMATCH',
  SETTLEMENT_AS_EXPENSE:     'SETTLEMENT_AS_EXPENSE',
  SPLIT_SUM_MISMATCH:        'SPLIT_SUM_MISMATCH',
  INVALID_SPLIT_TYPE:        'INVALID_SPLIT_TYPE',
};

// ─── Settlement keyword detector ─────────────────────────────────────────────
const SETTLEMENT_KEYWORDS = /\b(settled|transfer|paid back|paying back|reimburse|reimbursement|repay|repaid|payback)\b/i;
const VALID_SPLIT_TYPES   = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];

// ─── Parse amount (handles $ prefix, commas) ──────────────────────────────────
function parseAmount(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null, hasCurrencyPrefix: false };
  const str = String(raw).trim();
  const hasCurrencyPrefix = /^\$/.test(str) || /^USD/i.test(str) || /^\s*USD/i.test(str);
  const cleaned = str.replace(/[\$,\s]/g, '').replace(/^USD/i, '');
  const value = parseFloat(cleaned);
  return { value: isNaN(value) ? null : value, hasCurrencyPrefix };
}

// ─── Detect anomalies for all rows ───────────────────────────────────────────
async function detectAnomalies(rows, memberships, groupCurrency) {
  const anomalies = []; // { rowIndex, rowData, anomalyType, description }
  const seenExact  = new Map(); // "date|desc|amount|paidBy" → rowIndex
  const seenDesc   = new Map(); // "date|desc" → { amount, rowIndex }[]

  const now = new Date();
  const futureThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Build membership lookup: email/name → [{ joinedAt, leftAt }]
  const memberLookup = {}; // key: email or name (lowercased)
  for (const m of memberships) {
    const key = (m.user.email || '').toLowerCase();
    const nameKey = (m.user.name || '').toLowerCase();
    const entry = { userId: m.user.id, joinedAt: m.joinedAt, leftAt: m.leftAt };
    memberLookup[key] = memberLookup[key] || [];
    memberLookup[key].push(entry);
    memberLookup[nameKey] = memberLookup[nameKey] || [];
    memberLookup[nameKey].push(entry);
  }

  function lookupMember(nameOrEmail) {
    return memberLookup[(nameOrEmail || '').toLowerCase()] || null;
  }

  function isMemberActive(memberEntries, expenseDate) {
    if (!memberEntries) return false;
    return memberEntries.some(e => {
      const after  = expenseDate >= e.joinedAt;
      const before = !e.leftAt || expenseDate <= e.leftAt;
      return after && before;
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowAnomaly = (type, desc) => anomalies.push({ rowIndex: i, rowData: row, anomalyType: type, description: desc });

    // 1. MISSING_REQUIRED_FIELD
    const requiredFields = ['date', 'description', 'amount', 'paidBy'];
    const missing = requiredFields.filter(f => !row[f] || String(row[f]).trim() === '');
    if (missing.length > 0) {
      rowAnomaly(ANOMALY.MISSING_REQUIRED_FIELD, `Missing required fields: ${missing.join(', ')}`);
      continue; // Can't do more checks without required fields
    }

    // 2. INVALID_DATE
    const dateStr = String(row.date).trim();
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      rowAnomaly(ANOMALY.INVALID_DATE, `Cannot parse date: "${dateStr}"`);
      continue;
    }

    // 3. FUTURE_DATE
    if (parsedDate > futureThreshold) {
      rowAnomaly(ANOMALY.FUTURE_DATE, `Expense date ${dateStr} is more than 7 days in the future`);
    }

    // 4. Parse amount + CURRENCY_MISMATCH
    const { value: rawAmount, hasCurrencyPrefix } = parseAmount(row.amount);
    if (rawAmount === null) {
      rowAnomaly(ANOMALY.MISSING_REQUIRED_FIELD, `Amount "${row.amount}" is not a valid number`);
      continue;
    }

    if (hasCurrencyPrefix) {
      rowAnomaly(ANOMALY.CURRENCY_MISMATCH, `Amount "${row.amount}" appears to be in USD ($). Must convert to ${groupCurrency}, not treat as ${groupCurrency}.`);
    }

    // 5. NEGATIVE_AMOUNT
    if (rawAmount < 0) {
      rowAnomaly(ANOMALY.NEGATIVE_AMOUNT, `Amount is negative (${rawAmount}). Could be a refund or data error.`);
    }

    // 6. ZERO_AMOUNT
    if (rawAmount === 0) {
      rowAnomaly(ANOMALY.ZERO_AMOUNT, `Amount is zero for row: "${row.description}"`);
    }

    // 7. SETTLEMENT_AS_EXPENSE
    if (SETTLEMENT_KEYWORDS.test(String(row.description))) {
      rowAnomaly(ANOMALY.SETTLEMENT_AS_EXPENSE, `Description "${row.description}" looks like a settlement/transfer, not an expense`);
    }

    // 8. INVALID_SPLIT_TYPE
    if (row.splitType && !VALID_SPLIT_TYPES.includes(String(row.splitType).toUpperCase())) {
      rowAnomaly(ANOMALY.INVALID_SPLIT_TYPE, `Unknown split type: "${row.splitType}". Valid: ${VALID_SPLIT_TYPES.join(', ')}`);
    }

    // 9. UNKNOWN_MEMBER + MEMBER_NOT_ACTIVE (paidBy)
    const paidByEntries = lookupMember(String(row.paidBy).trim());
    if (!paidByEntries) {
      rowAnomaly(ANOMALY.UNKNOWN_MEMBER, `paidBy "${row.paidBy}" is not a member of this group`);
    } else if (!isMemberActive(paidByEntries, parsedDate)) {
      rowAnomaly(ANOMALY.MEMBER_NOT_ACTIVE, `"${row.paidBy}" was not an active member of the group on ${dateStr}`);
    }

    // 10. SPLIT_SUM_MISMATCH (if explicit splits provided)
    if (row.splitType && String(row.splitType).toUpperCase() === 'EXACT' && row.splits) {
      try {
        const splitsData = typeof row.splits === 'string' ? JSON.parse(row.splits) : row.splits;
        const splitSum = splitsData.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
        if (Math.abs(splitSum - Math.abs(rawAmount)) > 0.01) {
          rowAnomaly(ANOMALY.SPLIT_SUM_MISMATCH, `Splits sum (${splitSum.toFixed(2)}) does not equal expense amount (${Math.abs(rawAmount).toFixed(2)})`);
        }
      } catch {
        // splits field not parseable — ignore split check
      }
    }

    // 11. DUPLICATE_ROW (exact: same date + desc + amount + paidBy)
    const exactKey = `${dateStr}|${String(row.description).trim().toLowerCase()}|${rawAmount}|${String(row.paidBy).trim().toLowerCase()}`;
    if (seenExact.has(exactKey)) {
      rowAnomaly(ANOMALY.DUPLICATE_ROW, `Exact duplicate of row ${seenExact.get(exactKey) + 1}: same date, description, amount, and payer`);
    } else {
      seenExact.set(exactKey, i);
    }

    // 12. DUPLICATE_AMOUNT_MISMATCH (same date + desc, different amount)
    const descKey = `${dateStr}|${String(row.description).trim().toLowerCase()}`;
    if (seenDesc.has(descKey)) {
      const prev = seenDesc.get(descKey);
      if (Math.abs(prev.amount - rawAmount) > 0.01) {
        rowAnomaly(ANOMALY.DUPLICATE_AMOUNT_MISMATCH, `Same date and description as row ${prev.rowIndex + 1} but different amount (${prev.amount} vs ${rawAmount})`);
      }
    } else {
      seenDesc.set(descKey, { amount: rawAmount, rowIndex: i });
    }
  }

  return anomalies;
}

// ─── POST /api/import/upload ──────────────────────────────────────────────────
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, data: null, error: 'No CSV file uploaded' });
  }

  const { groupId } = req.body;
  if (!groupId) {
    return res.status(400).json({ success: false, data: null, error: 'groupId is required' });
  }

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ success: false, data: null, error: 'Group not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    // Parse CSV
    const csvText = req.file.buffer.toString('utf-8');
    const { data: rows, errors } = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `CSV parse error: ${errors[0].message}`,
      });
    }

    // Normalise header variants (date_of_expense → date, paid_by → paidBy, etc.)
    const normalised = rows.map(row => {
      const r = {};
      for (const [k, v] of Object.entries(row)) {
        const nk = k
          .replace(/date_of_expense|expense_date/, 'date')
          .replace(/paid_by|payer/, 'paidby')
          .replace(/split_type/, 'splittype')
          .replace(/description|desc/, 'description')
          .replace(/amount/, 'amount');
        r[nk] = v;
      }
      // Re-camelCase
      return {
        date:        r['date'] || r['date_of_expense'] || r['expense_date'] || '',
        description: r['description'] || r['desc'] || '',
        amount:      r['amount'] || '',
        paidBy:      r['paidby'] || r['paid_by'] || r['payer'] || '',
        splitType:   r['splittype'] || r['split_type'] || 'EQUAL',
        splits:      r['splits'] || null,
        currency:    r['currency'] || null,
        note:        r['note'] || r['notes'] || '',
        ...r, // keep original fields too
      };
    });

    // Fetch memberships for anomaly detection
    const memberships = await prisma.membership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Detect anomalies
    const anomalies = await detectAnomalies(normalised, memberships, group.currency);

    // Create ImportSession + anomaly rows in transaction
    const session = await prisma.$transaction(async (tx) => {
      const s = await tx.importSession.create({
        data: {
          groupId,
          uploadedBy: req.userId,
          filename: req.file.originalname,
          status: 'REVIEWING',
        },
      });

      if (anomalies.length > 0) {
        await tx.importAnomaly.createMany({
          data: anomalies.map(a => ({
            importSessionId: s.id,
            rowIndex:        a.rowIndex,
            rowData:         a.rowData,
            anomalyType:     a.anomalyType,
            description:     a.description,
          })),
        });
      }

      return s;
    });

    // Store parsed rows temporarily (we'll use rowIndex to re-parse on execute)
    // Return session + summary
    const anomalyCountByType = {};
    for (const a of anomalies) {
      anomalyCountByType[a.anomalyType] = (anomalyCountByType[a.anomalyType] || 0) + 1;
    }

    // Identify "clean" rows (no anomalies)
    const anomalousRows = new Set(anomalies.map(a => a.rowIndex));
    const cleanRows = normalised.filter((_, i) => !anomalousRows.has(i));

    return res.status(201).json({
      success: true,
      data: {
        sessionId:    session.id,
        filename:     req.file.originalname,
        totalRows:    normalised.length,
        cleanRows:    cleanRows.length,
        anomalyCount: anomalies.length,
        anomalyCountByType,
        // Return raw rows so UI can attach them to anomalies
        rows: normalised,
      },
      error: null,
    });
  } catch (err) {
    console.error('[import/upload]', err);
    return res.status(500).json({ success: false, data: null, error: 'Import upload failed' });
  }
});

// ─── GET /api/import/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await prisma.importSession.findUnique({
      where: { id: req.params.id },
      include: {
        anomalies: { orderBy: { rowIndex: 'asc' } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!session) return res.status(404).json({ success: false, data: null, error: 'Session not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId: session.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    return res.json({ success: true, data: session, error: null });
  } catch (err) {
    console.error('[import/get]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch session' });
  }
});

// ─── PUT /api/import/:id/anomalies/:anomalyId ─────────────────────────────────
router.put('/:id/anomalies/:anomalyId', authenticate, async (req, res) => {
  const { userAction } = req.body; // APPROVE | REJECT | SKIP
  if (!['APPROVE', 'REJECT', 'SKIP'].includes(userAction)) {
    return res.status(400).json({ success: false, data: null, error: 'userAction must be APPROVE, REJECT, or SKIP' });
  }

  try {
    const anomaly = await prisma.importAnomaly.findUnique({
      where: { id: req.params.anomalyId },
      include: { session: true },
    });
    if (!anomaly) return res.status(404).json({ success: false, data: null, error: 'Anomaly not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId: anomaly.session.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    const updated = await prisma.importAnomaly.update({
      where: { id: req.params.anomalyId },
      data: { userAction, resolvedAt: new Date() },
    });

    return res.json({ success: true, data: updated, error: null });
  } catch (err) {
    console.error('[import/updateAnomaly]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to update anomaly' });
  }
});

// ─── POST /api/import/:id/execute ────────────────────────────────────────────
router.post('/:id/execute', authenticate, async (req, res) => {
  try {
    const session = await prisma.importSession.findUnique({
      where: { id: req.params.id },
      include: {
        anomalies: true,
        group: true,
      },
    });
    if (!session) return res.status(404).json({ success: false, data: null, error: 'Session not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId: session.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    if (session.status === 'COMPLETE') {
      return res.status(409).json({ success: false, data: null, error: 'Session already executed' });
    }

    // Check all anomalies have been actioned
    const unresolved = session.anomalies.filter(a => !a.userAction);
    if (unresolved.length > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `${unresolved.length} anomalies still need review before executing`,
      });
    }

    // rows payload: client must send rows[] in body (the same rows returned from upload)
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, data: null, error: 'rows[] is required in request body' });
    }

    // Approved anomaly row indexes
    const approvedAnomalyRows = new Set(
      session.anomalies
        .filter(a => a.userAction === 'APPROVE')
        .map(a => a.rowIndex)
    );
    const rejectedRows = new Set(
      session.anomalies
        .filter(a => a.userAction === 'REJECT')
        .map(a => a.rowIndex)
    );
    const anomalousRows = new Set(session.anomalies.map(a => a.rowIndex));

    // Rows to import: clean rows + approved anomaly rows
    const rowsToImport = rows.filter((_, i) => {
      if (rejectedRows.has(i)) return false;
      if (anomalousRows.has(i) && !approvedAnomalyRows.has(i)) return false;
      return true;
    });

    // Fetch memberships for name → userId lookup
    const memberships = await prisma.membership.findMany({
      where: { groupId: session.groupId },
      include: { user: true },
    });
    const memberLookup = {};
    for (const m of memberships) {
      memberLookup[(m.user.email || '').toLowerCase()] = m.user.id;
      memberLookup[(m.user.name || '').toLowerCase()]  = m.user.id;
    }

    const groupCurrency = session.group.currency;
    const created = [];
    const failed  = [];

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i];
      try {
        const { value: rawAmount, hasCurrencyPrefix } = parseAmount(row.amount);
        if (rawAmount === null || rawAmount <= 0) continue;

        const paidByKey = String(row.paidBy || '').trim().toLowerCase();
        const paidById  = memberLookup[paidByKey];
        if (!paidById) continue;

        const currency = hasCurrencyPrefix ? 'USD' : (row.currency || groupCurrency);
        const exchangeRate = await getRate(currency, groupCurrency);
        const amount = Math.abs(rawAmount); // handle negatives treated as refunds
        const amountInGroupCurrency = Math.round(amount * exchangeRate * 100) / 100;

        let splitType = String(row.splitType || 'EQUAL').toUpperCase();
        if (splitType === 'UNEQUAL') splitType = 'EXACT';
        if (splitType === 'SHARE') splitType = 'SHARES';
        if (!VALID_SPLIT_TYPES.includes(splitType)) {
          splitType = 'EQUAL';
        }

        const expenseDate = new Date(row.date);
        const splits = resolveSplits(row, memberships, amountInGroupCurrency, splitType);
        const splitRows = buildSplitsLocal(splitType, splits, amountInGroupCurrency);

        const expense = await prisma.expense.create({
          data: {
            groupId:              session.groupId,
            description:          String(row.description).trim(),
            amount,
            currency,
            amountInGroupCurrency,
            exchangeRate,
            date:                 expenseDate,
            paidById,
            splitType,
            originalRowIndex:     rows.indexOf(row),
            splits: { create: splitRows },
          },
        });
        created.push(expense.id);
      } catch (rowErr) {
        console.error(`[import/execute] Row ${i} failed:`, rowErr.message);
        failed.push(i);
      }
    }

    await prisma.importSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETE' },
    });

    return res.json({
      success: true,
      data: {
        expensesCreated: created.length,
        rowsFailed: failed.length,
        failedIndexes: failed,
      },
      error: null,
    });
  } catch (err) {
    console.error('[import/execute]', err);
    return res.status(500).json({ success: false, data: null, error: 'Execute failed' });
  }
});

// ─── GET /api/import/:id/report ──────────────────────────────────────────────
router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const session = await prisma.importSession.findUnique({
      where: { id: req.params.id },
      include: {
        anomalies: { orderBy: { rowIndex: 'asc' } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!session) return res.status(404).json({ success: false, data: null, error: 'Session not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId: session.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    // Aggregate counts
    const byType   = {};
    const byAction = { APPROVE: 0, REJECT: 0, SKIP: 0, PENDING: 0 };

    for (const a of session.anomalies) {
      byType[a.anomalyType] = (byType[a.anomalyType] || 0) + 1;
      const actionKey = a.userAction || 'PENDING';
      byAction[actionKey] = (byAction[actionKey] || 0) + 1;
    }

    return res.json({
      success: true,
      data: {
        session: {
          id:          session.id,
          filename:    session.filename,
          status:      session.status,
          createdAt:   session.createdAt,
          group:       session.group,
        },
        summary: {
          totalAnomalies: session.anomalies.length,
          byType,
          byAction,
        },
        anomalies: session.anomalies.map(a => ({
          id:          a.id,
          rowIndex:    a.rowIndex,
          rowData:     a.rowData,
          anomalyType: a.anomalyType,
          description: a.description,
          userAction:  a.userAction,
          resolvedAt:  a.resolvedAt,
        })),
      },
      error: null,
    });
  } catch (err) {
    console.error('[import/report]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to generate report' });
  }
});

// ─── Resolve splits from CSV row columns ─────────────────────────────────────
function resolveSplits(row, memberships, amountInGroupCurrency, splitType) {
  // Normalize row keys
  const r = {};
  for (const [k, v] of Object.entries(row)) {
    r[k.toLowerCase().replace(/_/g, '')] = v;
  }

  const splitWithStr = r['splitwith'] || r['participants'] || '';
  const splitDetailStr = r['splitdetail'] || r['splits'] || '';

  // Get active members lookup: email/name -> userId
  const memberLookup = {};
  for (const m of memberships) {
    memberLookup[m.user.name.toLowerCase().trim()] = m.user.id;
    if (m.user.email) {
      memberLookup[m.user.email.toLowerCase().trim()] = m.user.id;
    }
  }

  // Determine participants (userIds)
  let participantIds = [];
  if (splitWithStr && String(splitWithStr).trim() !== '') {
    const names = splitWithStr.split(';').map(n => n.trim().toLowerCase()).filter(Boolean);
    for (const name of names) {
      const userId = memberLookup[name];
      if (userId) {
        participantIds.push(userId);
      }
    }
  }

  // Fallback to all active members on the expense date if no split_with specified
  if (participantIds.length === 0) {
    const expenseDate = new Date(row.date);
    const activeMembers = memberships.filter(m => {
      const after  = expenseDate >= m.joinedAt;
      const before = !m.leftAt || expenseDate <= m.leftAt;
      return after && before;
    });
    participantIds = activeMembers.map(m => m.user.id);
  }

  // If still no participants, fallback to all group members
  if (participantIds.length === 0) {
    participantIds = memberships.map(m => m.user.id);
  }

  // Try parsing split details
  let detailMap = {};
  if (splitDetailStr) {
    const trimmedDetail = String(splitDetailStr).trim();
    if (trimmedDetail.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmedDetail);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const key = String(item.userId || item.name || item.email || '').toLowerCase().trim();
            const val = parseFloat(item.amount || item.percentage || item.shares || 0);
            if (key) detailMap[key] = val;
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON split detail:', e);
      }
    } else {
      // Semicolon-separated details: Name value; Name value
      const parts = trimmedDetail.split(';');
      for (const part of parts) {
        const pTrim = part.trim();
        if (!pTrim) continue;
        const match = pTrim.match(/^(.+?)\s+([\d\.\-]+)%?$/);
        if (match) {
          const name = match[1].trim().toLowerCase();
          const val = parseFloat(match[2]);
          if (!isNaN(val)) detailMap[name] = val;
        }
      }
    }
  }

  // Map participants to split parameters
  const splits = participantIds.map(userId => {
    const member = memberships.find(m => m.user.id === userId);
    const nameKey = member ? member.user.name.toLowerCase().trim() : '';
    const emailKey = member && member.user.email ? member.user.email.toLowerCase().trim() : '';

    const detailVal = detailMap[nameKey] !== undefined ? detailMap[nameKey]
                    : detailMap[emailKey] !== undefined ? detailMap[emailKey]
                    : undefined;

    return {
      userId,
      amount:     splitType === 'EXACT' ? (detailVal || 0) : undefined,
      percentage: splitType === 'PERCENTAGE' ? (detailVal || 0) : undefined,
      shares:     splitType === 'SHARES' ? (detailVal || 0) : undefined,
    };
  });

  return splits;
}

// ─── Local split builder (mirrors expenses.js logic) ─────────────────────────
function buildSplitsLocal(splitType, splits, amountInGroupCurrency) {
  const round2 = n => Math.round(n * 100) / 100;
  switch (splitType) {
    case 'EQUAL': {
      const share = round2(amountInGroupCurrency / splits.length);
      let total = 0;
      return splits.map((s, i) => {
        const amt = i === splits.length - 1
          ? round2(amountInGroupCurrency - total)
          : share;
        total += share;
        return { userId: s.userId, amount: amt };
      });
    }
    case 'EXACT':
      return splits.map(s => ({ userId: s.userId, amount: round2(s.amount || 0) }));
    case 'PERCENTAGE':
      return splits.map(s => ({
        userId:     s.userId,
        amount:     round2(amountInGroupCurrency * (s.percentage || 0) / 100),
        percentage: s.percentage,
      }));
    case 'SHARES': {
      const total = splits.reduce((a, s) => a + (s.shares || 0), 0);
      return splits.map(s => ({
        userId: s.userId,
        amount: total > 0 ? round2(amountInGroupCurrency * (s.shares || 0) / total) : 0,
        shares: s.shares,
      }));
    }
    default:
      return splits.map(s => ({ userId: s.userId, amount: round2(amountInGroupCurrency / splits.length) }));
  }
}

module.exports = router;
