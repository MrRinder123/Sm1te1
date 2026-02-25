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
  return res.json(request);
});

export default router;
