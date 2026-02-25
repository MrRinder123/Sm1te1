import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { requireServerRole } from '../../middleware/permissions';

const router = Router();
const createServerSchema = z.object({ name: z.string().min(2).max(60) });
const updateRoleSchema = z.object({ memberId: z.string(), role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']) });

router.get('/', requireAuth, async (req, res) => {
  const memberships = await prisma.serverMember.findMany({
    where: { userId: req.user!.userId },
    include: { server: true }
  });
  return res.json(memberships.map((m) => ({ ...m.server, role: m.role })));
});

router.post('/', requireAuth, validateBody(createServerSchema), async (req, res) => {
  const inviteCode = randomBytes(6).toString('hex');
  const server = await prisma.server.create({
    data: {
      name: req.body.name,
      ownerId: req.user!.userId,
      inviteCode,
      members: { create: { userId: req.user!.userId, role: 'ADMIN' } }
    }
  });

  return res.status(201).json(server);
});

router.get('/:serverId/members', requireAuth, async (req, res) => {
  const members = await prisma.serverMember.findMany({
    where: { serverId: req.params.serverId },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    orderBy: { role: 'desc' }
  });

  return res.json(members);
});

router.patch('/:serverId/members/role', requireAuth, requireServerRole('ADMIN'), validateBody(updateRoleSchema), async (req, res) => {
  const member = await prisma.serverMember.update({
    where: { id: req.body.memberId },
    data: { role: req.body.role }
  });
  return res.json(member);
});

router.delete('/:serverId', requireAuth, requireServerRole('ADMIN'), async (req, res) => {
  await prisma.server.delete({ where: { id: req.params.serverId } });
  return res.status(204).send();
});

router.post('/join/:inviteCode', requireAuth, async (req, res) => {
  const server = await prisma.server.findUnique({ where: { inviteCode: req.params.inviteCode } });
  if (!server) return res.status(404).json({ message: 'Invite not found' });

  await prisma.serverMember.upsert({
    where: { userId_serverId: { userId: req.user!.userId, serverId: server.id } },
    update: {},
    create: { userId: req.user!.userId, serverId: server.id }
  });

  return res.json({ joined: true, serverId: server.id });
});

export default router;
