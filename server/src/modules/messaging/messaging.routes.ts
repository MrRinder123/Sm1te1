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
