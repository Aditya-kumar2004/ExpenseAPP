const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Schemas ──────────────────────────────────────────────────────────────────
const createSettlementSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId:   z.string().uuid(),
  amount:     z.number().positive(),
  date:       z.string().datetime(),
  note:       z.string().max(500).optional(),
});

// ─── GET /api/groups/:id/settlements ─────────────────────────────────────────
router.get('/:id/settlements', authenticate, async (req, res) => {
  const groupId = req.params.id;

  try {
    const membership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to:   { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'desc' },
    });

    return res.json({ success: true, data: settlements, error: null });
  } catch (err) {
    console.error('[settlements/list]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch settlements' });
  }
});

// ─── POST /api/groups/:id/settlements ────────────────────────────────────────
router.post('/:id/settlements', authenticate, validate(createSettlementSchema), async (req, res) => {
  const groupId = req.params.id;
  const { fromUserId, toUserId, amount, date, note } = req.body;

  try {
    const membership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ success: false, data: null, error: 'Cannot settle with yourself' });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId,
        amount: Math.round(amount * 100) / 100,
        date: new Date(date),
        note: note || null,
      },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to:   { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(201).json({ success: true, data: settlement, error: null });
  } catch (err) {
    console.error('[settlements/create]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to record settlement' });
  }
});

module.exports = router;
