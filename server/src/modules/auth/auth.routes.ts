import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { validateBody } from '../../middleware/validate';
import { loginSchema, registerSchema } from './auth.schema';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { email, username, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, username, passwordHash }
  });

  return res.status(201).json({ id: user.id, email: user.email, username: user.username });
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });
  return res.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const token = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });
  if (!token || token.revokedAt) return res.status(401).json({ message: 'Invalid refresh token' });

  const accessToken = signAccessToken({ userId: token.user.id, email: token.user.email });
  return res.json({ accessToken });
});

router.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revokedAt: new Date() } });
  }
  return res.status(204).send();
});

export default router;
