import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/join/:channelId', requireAuth, async (req, res) => {
  return res.json({ joined: true, channelId: req.params.channelId, userId: req.user!.userId });
});

router.post('/leave/:channelId', requireAuth, async (req, res) => {
  return res.json({ left: true, channelId: req.params.channelId, userId: req.user!.userId });
});

export default router;
