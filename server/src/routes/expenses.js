const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getRate } = require('../services/currency');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Schemas ──────────────────────────────────────────────────────────────────
const splitSchema = z.object({
  userId:     z.string().uuid(),
  amount:     z.number().optional(),
  percentage: z.number().optional(),
  shares:     z.number().optional(),
});

const createExpenseSchema = z.object({
  description: z.string().min(1).max(500),
  amount:      z.number().positive(),
  currency:    z.string().length(3).default('INR'),
  date:        z.string().datetime(),
  paidById:    z.string().uuid(),
  splitType:   z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']),
  splits:      z.array(splitSchema).min(1),
});

const updateExpenseSchema = createExpenseSchema.partial();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Build ExpenseSplit rows based on splitType.
 * All amounts stored in group currency (INR).
 */
function buildSplits(splitType, splits, amountInGroupCurrency) {
  const memberCount = splits.length;

  switch (splitType) {
    case 'EQUAL': {
      const share = round2(amountInGroupCurrency / memberCount);
      // Adjust last to avoid rounding drift
      let total = 0;
      return splits.map((s, i) => {
        const amt = i === splits.length - 1
          ? round2(amountInGroupCurrency - total)
          : share;
        total += share;
        return { userId: s.userId, amount: amt };
      });
    }
    case 'EXACT': {
      return splits.map(s => ({ userId: s.userId, amount: round2(s.amount || 0) }));
    }
    case 'PERCENTAGE': {
      return splits.map(s => ({
        userId:     s.userId,
        amount:     round2(amountInGroupCurrency * (s.percentage || 0) / 100),
        percentage: s.percentage,
      }));
    }
    case 'SHARES': {
      const totalShares = splits.reduce((acc, s) => acc + (s.shares || 0), 0);
      return splits.map(s => ({
        userId: s.userId,
        amount: totalShares > 0 ? round2(amountInGroupCurrency * (s.shares || 0) / totalShares) : 0,
        shares: s.shares,
      }));
    }
    default:
      return [];
  }
}

// ─── GET /api/groups/:id/expenses ────────────────────────────────────────────
router.get('/groups/:id/expenses', authenticate, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const membership = await prisma.membership.findFirst({
      where: { groupId: req.params.id, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: req.params.id, isDeleted: false },
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.expense.count({
        where: { groupId: req.params.id, isDeleted: false },
      }),
    ]);

    return res.json({
      success: true,
      data: { expenses, total, page: Number(page), limit: Number(limit) },
      error: null,
    });
  } catch (err) {
    console.error('[expenses/list]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch expenses' });
  }
});

// ─── POST /api/groups/:id/expenses ───────────────────────────────────────────
router.post('/groups/:id/expenses', authenticate, validate(createExpenseSchema), async (req, res) => {
  const groupId = req.params.id;
  const { description, amount, currency, date, paidById, splitType, splits } = req.body;

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ success: false, data: null, error: 'Group not found' });

    const membership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    // Currency conversion
    const groupCurrency = group.currency;
    const exchangeRate = await getRate(currency, groupCurrency);
    const amountInGroupCurrency = round2(amount * exchangeRate);

    // Build splits
    const splitRows = buildSplits(splitType, splits, amountInGroupCurrency);

    const expense = await prisma.expense.create({
      data: {
        groupId,
        description,
        amount,
        currency,
        amountInGroupCurrency,
        exchangeRate,
        date: new Date(date),
        paidById,
        splitType,
        splits: { create: splitRows },
      },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return res.status(201).json({ success: true, data: expense, error: null });
  } catch (err) {
    console.error('[expenses/create]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to create expense' });
  }
});

// ─── GET /api/expenses/:id ───────────────────────────────────────────────────
router.get('/expenses/:id', authenticate, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        group: { select: { id: true, name: true, currency: true } },
      },
    });

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ success: false, data: null, error: 'Expense not found' });
    }

    // Auth: must be a group member
    const membership = await prisma.membership.findFirst({
      where: { groupId: expense.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    return res.json({ success: true, data: expense, error: null });
  } catch (err) {
    console.error('[expenses/get]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch expense' });
  }
});

// ─── PUT /api/expenses/:id ───────────────────────────────────────────────────
router.put('/expenses/:id', authenticate, validate(updateExpenseSchema), async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { group: true },
    });
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ success: false, data: null, error: 'Expense not found' });
    }

    const membership = await prisma.membership.findFirst({
      where: { groupId: existing.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    const { description, amount, currency, date, paidById, splitType, splits } = req.body;
    const groupCurrency = existing.group.currency;

    const newCurrency = currency || existing.currency;
    const newAmount   = amount   || existing.amount;
    const exchangeRate = await getRate(newCurrency, groupCurrency);
    const amountInGroupCurrency = round2(newAmount * exchangeRate);

    const updateData = {
      ...(description && { description }),
      ...(amount      && { amount: newAmount }),
      ...(currency    && { currency: newCurrency }),
      ...(date        && { date: new Date(date) }),
      ...(paidById    && { paidById }),
      ...(splitType   && { splitType }),
      amountInGroupCurrency,
      exchangeRate,
    };

    const expense = await prisma.$transaction(async (tx) => {
      if (splits && splits.length > 0) {
        await tx.expenseSplit.deleteMany({ where: { expenseId: req.params.id } });
        const splitRows = buildSplits(splitType || existing.splitType, splits, amountInGroupCurrency);
        updateData.splits = { create: splitRows };
      }
      return tx.expense.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
        },
      });
    });

    return res.json({ success: true, data: expense, error: null });
  } catch (err) {
    console.error('[expenses/update]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to update expense' });
  }
});

// ─── DELETE /api/expenses/:id ────────────────────────────────────────────────
router.delete('/expenses/:id', authenticate, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ success: false, data: null, error: 'Expense not found' });
    }

    const membership = await prisma.membership.findFirst({
      where: { groupId: expense.groupId, userId: req.userId },
    });
    if (!membership) return res.status(403).json({ success: false, data: null, error: 'Not a member' });

    // Soft delete only
    await prisma.expense.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    return res.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('[expenses/delete]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to delete expense' });
  }
});

module.exports = router;
