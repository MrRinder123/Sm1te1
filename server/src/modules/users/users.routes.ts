import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

const router = Router();
const avatarDir = path.join(env.UPLOAD_DIR, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const upload = multer({ dest: avatarDir });
const profileSchema = z.object({ username: z.string().min(3).max(30) });

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, email: true, username: true, avatarUrl: true } });
  return res.json(user);
});

router.patch('/me', requireAuth, validateBody(profileSchema), async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user!.userId }, data: req.body });
  return res.json({ id: user.id, username: user.username, avatarUrl: user.avatarUrl });
});

router.post('/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'avatar is required' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await prisma.user.update({ where: { id: req.user!.userId }, data: { avatarUrl } });
  return res.json({ avatarUrl });
});

export default router;
