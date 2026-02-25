import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();
const channelSchema = z.object({
  serverId: z.string(),
  name: z.string().min(2).max(40),
  type: z.enum(['TEXT', 'VOICE']),
  category: z.string().optional()
});

router.get('/server/:serverId', requireAuth, async (req, res) => {
  const channels = await prisma.channel.findMany({ where: { serverId: req.params.serverId }, orderBy: { createdAt: 'asc' } });
  return res.json(channels);
});

router.post('/', requireAuth, validateBody(channelSchema), async (req, res) => {
  const channel = await prisma.channel.create({ data: req.body });
  return res.status(201).json(channel);
});

router.delete('/:channelId', requireAuth, async (req, res) => {
  await prisma.channel.delete({ where: { id: req.params.channelId } });
  return res.status(204).send();
});

export default router;
