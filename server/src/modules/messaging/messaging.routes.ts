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
    include: { author: { select: { id: true, username: true, avatarUrl: true } }, reactions: true },
    orderBy: { createdAt: 'asc' }
  });
  return res.json(messages);
});

router.post('/', requireAuth, validateBody(messageSchema), async (req, res) => {
  const message = await prisma.message.create({ data: { ...req.body, authorId: req.user!.userId } });
  return res.status(201).json(message);
});

router.patch('/:messageId', requireAuth, validateBody(z.object({ content: z.string().min(1).max(2000) })), async (req, res) => {
  const message = await prisma.message.update({ where: { id: req.params.messageId }, data: { content: req.body.content, editedAt: new Date() } });
  return res.json(message);
});

router.delete('/:messageId', requireAuth, async (req, res) => {
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

export default router;
