import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();

router.get('/rooms', requireAuth, async (req, res) => {
  const rooms = await prisma.directMessageRoom.findMany({
    where: { OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }] },
    include: {
      userA: { select: { id: true, username: true, avatarUrl: true } },
      userB: { select: { id: true, username: true, avatarUrl: true } }
    }
  });

  return res.json(rooms.map((room) => ({
    id: room.id,
    peer: room.userAId === req.user!.userId ? room.userB : room.userA
  })));
});

router.get('/rooms/:roomId/messages', requireAuth, async (req, res) => {
  const room = await prisma.directMessageRoom.findUnique({ where: { id: req.params.roomId } });
  if (!room || (room.userAId !== req.user!.userId && room.userBId !== req.user!.userId)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const messages = await prisma.directMessage.findMany({
    where: { roomId: req.params.roomId },
    include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' }
  });

  return res.json(messages);
});

router.post('/rooms/:roomId/messages', requireAuth, validateBody(z.object({ content: z.string().min(1).max(2000) })), async (req, res) => {
  const room = await prisma.directMessageRoom.findUnique({ where: { id: req.params.roomId } });
  if (!room || (room.userAId !== req.user!.userId && room.userBId !== req.user!.userId)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const message = await prisma.directMessage.create({
    data: { roomId: room.id, senderId: req.user!.userId, content: req.body.content }
  });

  return res.status(201).json(message);
});

export default router;
