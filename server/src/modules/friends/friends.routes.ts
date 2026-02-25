import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const requests = await prisma.friendRequest.findMany({
    where: {
      OR: [{ senderId: req.user!.userId }, { receiverId: req.user!.userId }]
    },
    include: { sender: { select: { id: true, username: true } }, receiver: { select: { id: true, username: true } } }
  });

  return res.json(requests);
});

router.get('/list', requireAuth, async (req, res) => {
  const friends = await prisma.friendship.findMany({
    where: { OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }] },
    include: {
      userA: { select: { id: true, username: true, avatarUrl: true } },
      userB: { select: { id: true, username: true, avatarUrl: true } }
    }
  });

  return res.json(friends.map((f) => f.userAId === req.user!.userId ? f.userB : f.userA));
});

router.post('/request', requireAuth, validateBody(z.object({ receiverId: z.string() })), async (req, res) => {
  const request = await prisma.friendRequest.create({
    data: { senderId: req.user!.userId, receiverId: req.body.receiverId }
  });
  return res.status(201).json(request);
});

router.post('/request/:id/respond', requireAuth, validateBody(z.object({ action: z.enum(['ACCEPTED', 'DECLINED']) })), async (req, res) => {
  const existing = await prisma.friendRequest.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.receiverId !== req.user!.userId) return res.status(404).json({ message: 'Request not found' });

  const request = await prisma.friendRequest.update({
    where: { id: req.params.id },
    data: { status: req.body.action }
  });

  if (req.body.action === 'ACCEPTED') {
    const [userAId, userBId] = [existing.senderId, existing.receiverId].sort();
    await prisma.friendship.upsert({ where: { userAId_userBId: { userAId, userBId } }, update: {}, create: { userAId, userBId } });
    await prisma.directMessageRoom.upsert({ where: { userAId_userBId: { userAId, userBId } }, update: {}, create: { userAId, userBId } });
  }

  return res.json(request);
});

export default router;
