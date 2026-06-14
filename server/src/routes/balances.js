const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { calculateBalances, simplifyDebts } = require('../services/balance');

const router = express.Router();
const prisma = new PrismaClient();

// ─── GET /api/groups/:id/balances ─────────────────────────────────────────────
router.get('/:id/balances', authenticate, async (req, res) => {
  const groupId = req.params.id;

  try {
    const membership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    // Fetch all non-deleted expenses with splits
    const expenses = await prisma.expense.findMany({
      where: { groupId, isDeleted: false },
      include: { splits: true },
    });

    // Fetch all settlements
    const settlements = await prisma.settlement.findMany({ where: { groupId } });

    // Fetch all members for display
    const memberships = await prisma.membership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const memberMap = {};
    for (const m of memberships) {
      memberMap[m.user.id] = m.user;
    }

    // Calculate balances using exact spec algorithm
    const rawBalances = calculateBalances(expenses, settlements);
    const simplifiedTxns = simplifyDebts({ ...rawBalances });

    // Format per-member balance summary
    const perMember = Object.entries(rawBalances).map(([userId, balance]) => ({
      user: memberMap[userId] || { id: userId, name: 'Unknown' },
      balance: Math.round(balance * 100) / 100,
    }));

    // Enrich transactions with user info
    const transactions = simplifiedTxns.map(t => ({
      from: memberMap[t.from] || { id: t.from, name: 'Unknown' },
      to:   memberMap[t.to]   || { id: t.to,   name: 'Unknown' },
      amount: t.amount,
    }));

    return res.json({
      success: true,
      data: {
        perMember,
        transactions, // minimum transactions to settle
        currency: (await prisma.group.findUnique({ where: { id: groupId }, select: { currency: true } }))?.currency || 'INR',
      },
      error: null,
    });
  } catch (err) {
    console.error('[balances/get]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to calculate balances' });
  }
});

module.exports = router;
