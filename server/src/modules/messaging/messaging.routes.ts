import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();
const messageSchema = z.object({ channelId: z.string(), content: z.string().min(1).max(2000) });

router.get('/channel/:channelId', requireAuth, async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { channelId: req.params.channelId },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      reactions: true,
      receipts: { select: { userId: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  return res.json(messages.map((m) => ({ ...m, readBy: m.receipts.map((r) => r.userId) })));
});

router.post('/', requireAuth, validateBody(messageSchema), async (req, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.body.channelId }, select: { serverId: true } });
  if (!channel) return res.status(404).json({ message: 'Channel not found' });

  const banned = await prisma.serverBan.findUnique({
    where: { serverId_userId: { serverId: channel.serverId, userId: req.user!.userId } }
  });
  if (banned) return res.status(403).json({ message: 'You are banned from this server' });

  const membership = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId: req.user!.userId, serverId: channel.serverId } }
  });
  if (!membership) return res.status(403).json({ message: 'Not a server member' });
  if (membership.timeoutUntil && membership.timeoutUntil > new Date()) {
    return res.status(403).json({ message: `Timed out until ${membership.timeoutUntil.toISOString()}` });
  }

  const message = await prisma.message.create({
    data: { ...req.body, authorId: req.user!.userId },
    include: { receipts: true }
  });

  await prisma.messageReadReceipt.upsert({
    where: { messageId_userId: { messageId: message.id, userId: req.user!.userId } },
    update: { readAt: new Date() },
    create: { messageId: message.id, userId: req.user!.userId }
  });

  return res.status(201).json(message);
});

router.patch('/:messageId', requireAuth, validateBody(z.object({ content: z.string().min(1).max(2000) })), async (req, res) => {
  const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!existing || existing.authorId !== req.user!.userId) return res.status(403).json({ message: 'Cannot edit this message' });

  const message = await prisma.message.update({ where: { id: req.params.messageId }, data: { content: req.body.content, editedAt: new Date() } });
  return res.json(message);
});

router.delete('/:messageId', requireAuth, async (req, res) => {
  const existing = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!existing || existing.authorId !== req.user!.userId) return res.status(403).json({ message: 'Cannot delete this message' });

  await prisma.message.delete({ where: { id: req.params.messageId } });
  return res.status(204).send();
});



router.get('/channel/:channelId/search', requireAuth, async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) return res.json([]);

  const matches = await prisma.message.findMany({
    where: {
      channelId: req.params.channelId,
      content: { contains: query, mode: 'insensitive' }
    },
    include: { author: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return res.json(matches);
});

router.post('/:messageId/pin', requireAuth, async (req, res) => {
  const message = await prisma.message.update({ where: { id: req.params.messageId }, data: { pinned: true } });
  return res.json(message);
});

router.post('/:messageId/unpin', requireAuth, async (req, res) => {
  const message = await prisma.message.update({ where: { id: req.params.messageId }, data: { pinned: false } });
  return res.json(message);
});

router.get('/channel/:channelId/pins', requireAuth, async (req, res) => {
  const pins = await prisma.message.findMany({ where: { channelId: req.params.channelId, pinned: true }, orderBy: { createdAt: 'desc' } });
  return res.json(pins);
});

router.post('/channel/:channelId/threads', requireAuth, validateBody(z.object({ title: z.string().min(1).max(100), parentId: z.string().optional() })), async (req, res) => {
  const thread = await prisma.thread.create({
    data: { channelId: req.params.channelId, title: req.body.title, parentId: req.body.parentId }
  });

  return res.status(201).json(thread);
});

router.get('/channel/:channelId/threads', requireAuth, async (req, res) => {
  const threads = await prisma.thread.findMany({ where: { channelId: req.params.channelId }, orderBy: { createdAt: 'desc' } });
  return res.json(threads);
});

router.post('/:messageId/reactions', requireAuth, validateBody(z.object({ emoji: z.string().min(1).max(16) })), async (req, res) => {
  const reaction = await prisma.reaction.upsert({
    where: { emoji_messageId_userId: { emoji: req.body.emoji, messageId: req.params.messageId, userId: req.user!.userId } },
    update: {},
    create: { emoji: req.body.emoji, messageId: req.params.messageId, userId: req.user!.userId }
  });
  return res.json(reaction);
});

router.post('/channel/:channelId/read', requireAuth, async (req, res) => {
  const messages = await prisma.message.findMany({ where: { channelId: req.params.channelId }, select: { id: true } });
  await prisma.$transaction(messages.map((m) => prisma.messageReadReceipt.upsert({
    where: { messageId_userId: { messageId: m.id, userId: req.user!.userId } },
    update: { readAt: new Date() },
    create: { messageId: m.id, userId: req.user!.userId }
  })));

  return res.json({ markedRead: messages.length });
});

export default router;
