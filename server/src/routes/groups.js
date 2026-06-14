const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Schemas ──────────────────────────────────────────────────────────────────
const createGroupSchema = z.object({
  name:     z.string().min(1).max(200),
  currency: z.string().length(3).default('INR'),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200),
});

const addMemberSchema = z.object({
  userId:   z.string().uuid().optional(),
  email:    z.string().email().optional(),
  name:     z.string().min(1).optional(),
  joinedAt: z.string().optional().nullable(),
  leftAt:   z.string().optional().nullable(),
});

// ─── GET /api/groups ─────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId },
      include: {
        group: {
          include: {
            memberships: {
              where: { leftAt: null },
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map(m => ({
      ...m.group,
      myMembership: { joinedAt: m.joinedAt, leftAt: m.leftAt },
    }));

    return res.json({ success: true, data: groups, error: null });
  } catch (err) {
    console.error('[groups/list]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch groups' });
  }
});

// ─── POST /api/groups ────────────────────────────────────────────────────────
router.post('/', authenticate, validate(createGroupSchema), async (req, res) => {
  const { name, currency } = req.body;

  try {
    const group = await prisma.group.create({
      data: {
        name,
        currency,
        memberships: {
          create: {
            userId: req.userId,
            joinedAt: new Date(),
          },
        },
      },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return res.status(201).json({ success: true, data: group, error: null });
  } catch (err) {
    console.error('[groups/create]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to create group' });
  }
});

// ─── GET /api/groups/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Verify requester is a member
    const membership = await prisma.membership.findFirst({
      where: { groupId: req.params.id, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member of this group' });
    }

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, data: null, error: 'Group not found' });
    }

    return res.json({ success: true, data: group, error: null });
  } catch (err) {
    console.error('[groups/get]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch group' });
  }
});

// ─── PUT /api/groups/:id ─────────────────────────────────────────────────────
router.put('/:id', authenticate, validate(updateGroupSchema), async (req, res) => {
  const { name } = req.body;

  try {
    const membership = await prisma.membership.findFirst({
      where: { groupId: req.params.id, userId: req.userId },
    });
    if (!membership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data: { name },
    });

    return res.json({ success: true, data: group, error: null });
  } catch (err) {
    console.error('[groups/update]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to update group' });
  }
});

// ─── POST /api/groups/:id/members ────────────────────────────────────────────
router.post('/:id/members', authenticate, validate(addMemberSchema), async (req, res) => {
  const { userId, email, name, joinedAt, leftAt } = req.body;
  const groupId = req.params.id;

  try {
    // Requester must be a member
    const requesterMembership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!requesterMembership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member of this group' });
    }

    let targetUserId = userId;

    if (!targetUserId) {
      if (!email) {
        return res.status(400).json({ success: false, data: null, error: 'Either userId or email is required' });
      }
      const emailClean = email.toLowerCase().trim();
      let targetUser = await prisma.user.findUnique({ where: { email: emailClean } });
      if (!targetUser) {
        const passwordHash = await bcrypt.hash('password123', 12);
        targetUser = await prisma.user.create({
          data: {
            name: name || emailClean.split('@')[0],
            email: emailClean,
            passwordHash,
          },
        });
      }
      targetUserId = targetUser.id;
    } else {
      // Validate user exists
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return res.status(404).json({ success: false, data: null, error: 'User not found' });
      }
    }

    // Check if already a member
    const existing = await prisma.membership.findFirst({
      where: { groupId, userId: targetUserId },
    });
    if (existing) {
      // If they left, we can reactivate or update, but let's error for simplicity or update the leftAt
      if (existing.leftAt) {
        const reactivated = await prisma.membership.update({
          where: { id: existing.id },
          data: {
            joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
            leftAt: leftAt ? new Date(leftAt) : null,
          },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        return res.status(200).json({ success: true, data: reactivated, error: null });
      }
      return res.status(409).json({ success: false, data: null, error: 'User is already a member' });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: targetUserId,
        groupId,
        joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
        leftAt: leftAt ? new Date(leftAt) : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return res.status(201).json({ success: true, data: membership, error: null });
  } catch (err) {
    console.error('[groups/addMember]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to add member' });
  }
});

// ─── PUT /api/groups/:id/members/:uid ─────────────────────────────────────────
router.put('/:id/members/:uid', authenticate, async (req, res) => {
  const { id: groupId, uid: userId } = req.params;
  const { joinedAt, leftAt } = req.body;

  try {
    // Requester must be a member
    const requesterMembership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!requesterMembership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    const membership = await prisma.membership.findFirst({
      where: { groupId, userId },
    });
    if (!membership) {
      return res.status(404).json({ success: false, data: null, error: 'Membership not found' });
    }

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        joinedAt: joinedAt ? new Date(joinedAt) : membership.joinedAt,
        leftAt:   leftAt !== undefined ? (leftAt ? new Date(leftAt) : null) : membership.leftAt,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return res.json({ success: true, data: updated, error: null });
  } catch (err) {
    console.error('[groups/updateMember]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to update member' });
  }
});

// ─── DELETE /api/groups/:id/members/:uid ─────────────────────────────────────
router.delete('/:id/members/:uid', authenticate, async (req, res) => {
  const { id: groupId, uid: userId } = req.params;

  try {
    const requesterMembership = await prisma.membership.findFirst({
      where: { groupId, userId: req.userId },
    });
    if (!requesterMembership) {
      return res.status(403).json({ success: false, data: null, error: 'Not a member' });
    }

    const membership = await prisma.membership.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      return res.status(404).json({ success: false, data: null, error: 'Active membership not found' });
    }

    // Soft remove — set leftAt, never delete the row
    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    return res.json({ success: true, data: updated, error: null });
  } catch (err) {
    console.error('[groups/removeMember]', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to remove member' });
  }
});

module.exports = router;
