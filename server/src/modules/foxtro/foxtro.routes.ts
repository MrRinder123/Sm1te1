import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();

router.get('/plans', requireAuth, (_req, res) => {
  return res.json([
    { key: 'FOXTRO', name: 'Foxtro', perks: ['Animated avatar', 'Higher upload limit', 'Custom app badge'] },
    { key: 'FULLFOXTRO', name: 'FullFoxtro', perks: ['All Foxtro perks', 'Extra server boosts', 'Priority voice quality'] }
  ]);
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, subscriptionTier: true, foxtro: true }
  });

  return res.json(user);
});

router.post('/subscribe', requireAuth, validateBody(z.object({ tier: z.enum(['FOXTRO', 'FULLFOXTRO']) })), async (req, res) => {
  const tier = req.body.tier;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { subscriptionTier: tier }
  });

  await prisma.foxtroSubscription.upsert({
    where: { userId: req.user!.userId },
    update: { tier, active: true, expiresAt: null },
    create: { userId: req.user!.userId, tier }
  });

  return res.json({ id: user.id, subscriptionTier: user.subscriptionTier });
});

router.post('/cancel', requireAuth, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { subscriptionTier: 'NONE' }
  });

  await prisma.foxtroSubscription.updateMany({
    where: { userId: req.user!.userId, active: true },
    data: { active: false, expiresAt: new Date() }
  });

  return res.json({ id: user.id, subscriptionTier: user.subscriptionTier });
});

router.post('/boost/:serverId', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { subscriptionTier: true } });
  if (!user || user.subscriptionTier === 'NONE') return res.status(403).json({ message: 'Foxtro subscription required' });

  const boost = await prisma.serverBoost.upsert({
    where: { serverId_userId: { serverId: req.params.serverId, userId: req.user!.userId } },
    update: {},
    create: { serverId: req.params.serverId, userId: req.user!.userId }
  });

  return res.status(201).json(boost);
});

export default router;
