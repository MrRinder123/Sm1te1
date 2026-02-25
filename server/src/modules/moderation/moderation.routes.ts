import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireServerRole } from '../../middleware/permissions';
import { validateBody } from '../../middleware/validate';

const router = Router();

const timeoutSchema = z.object({ userId: z.string(), minutes: z.number().int().min(1).max(10080) });
const banSchema = z.object({ userId: z.string(), reason: z.string().max(240).optional() });

router.post('/:serverId/timeout', requireAuth, requireServerRole('MODERATOR'), validateBody(timeoutSchema), async (req, res) => {
  const timeoutUntil = new Date(Date.now() + req.body.minutes * 60_000);

  const member = await prisma.serverMember.updateMany({
    where: { serverId: req.params.serverId, userId: req.body.userId },
    data: { timeoutUntil }
  });

  return res.json({ updated: member.count, timeoutUntil });
});

router.post('/:serverId/untimeout', requireAuth, requireServerRole('MODERATOR'), validateBody(z.object({ userId: z.string() })), async (req, res) => {
  const member = await prisma.serverMember.updateMany({
    where: { serverId: req.params.serverId, userId: req.body.userId },
    data: { timeoutUntil: null }
  });

  return res.json({ updated: member.count });
});

router.post('/:serverId/ban', requireAuth, requireServerRole('MODERATOR'), validateBody(banSchema), async (req, res) => {
  const ban = await prisma.serverBan.upsert({
    where: { serverId_userId: { serverId: req.params.serverId, userId: req.body.userId } },
    update: { reason: req.body.reason ?? null },
    create: { serverId: req.params.serverId, userId: req.body.userId, reason: req.body.reason }
  });

  await prisma.serverMember.deleteMany({ where: { serverId: req.params.serverId, userId: req.body.userId } });

  return res.status(201).json(ban);
});

router.post('/:serverId/unban', requireAuth, requireServerRole('MODERATOR'), validateBody(z.object({ userId: z.string() })), async (req, res) => {
  await prisma.serverBan.deleteMany({ where: { serverId: req.params.serverId, userId: req.body.userId } });
  return res.status(204).send();
});

router.get('/:serverId/bans', requireAuth, requireServerRole('MODERATOR'), async (req, res) => {
  const bans = await prisma.serverBan.findMany({
    where: { serverId: req.params.serverId },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return res.json(bans);
});

export default router;
