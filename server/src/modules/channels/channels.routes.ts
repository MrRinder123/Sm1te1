import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { requireServerMembership, requireServerRole } from '../../middleware/permissions';

const router = Router();
const channelSchema = z.object({
  serverId: z.string(),
  name: z.string().min(2).max(40),
  type: z.enum(['TEXT', 'VOICE']),
  category: z.string().optional()
});

router.get('/server/:serverId', requireAuth, async (req, res) => {
  const membership = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: req.user!.userId, serverId: req.params.serverId } }
  });
  if (!membership) return res.status(403).json({ message: 'Not a member of this server' });

  const channels = await prisma.channel.findMany({ where: { serverId: req.params.serverId }, orderBy: { createdAt: 'asc' } });
  return res.json(channels);
});

router.post('/', requireAuth, requireServerRole('MODERATOR'), validateBody(channelSchema), async (req, res) => {
  const channel = await prisma.channel.create({ data: req.body });
  return res.status(201).json(channel);
});

router.delete('/:channelId', requireAuth, async (req, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
  if (!channel) return res.status(404).json({ message: 'Channel not found' });

  req.body.serverId = channel.serverId;
  return requireServerRole('MODERATOR')(req, res, async () => {
    await prisma.channel.delete({ where: { id: req.params.channelId } });
    return res.status(204).send();
  });
});

router.get('/server/:serverId/unread', requireAuth, requireServerMembership, async (req, res) => {
  const channelIds = (await prisma.channel.findMany({ where: { serverId: req.params.serverId }, select: { id: true } })).map((c) => c.id);
  const userId = req.user!.userId;

  const unread = await Promise.all(channelIds.map(async (channelId) => {
    const count = await prisma.message.count({
      where: {
        channelId,
        authorId: { not: userId },
        receipts: { none: { userId } }
      }
    });

    return { channelId, count };
  }));

  return res.json(unread);
});

export default router;
