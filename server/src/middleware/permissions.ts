import { Role } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';

const roleRank: Record<Role, number> = {
  MEMBER: 1,
  MODERATOR: 2,
  ADMIN: 3
};

export const requireServerRole = (minimumRole: Role) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const serverId = req.params.serverId ?? req.body.serverId;
    if (!serverId || !req.user?.userId) return res.status(400).json({ message: 'serverId is required' });

    const membership = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: req.user.userId, serverId } }
    });

    if (!membership || roleRank[membership.role] < roleRank[minimumRole]) {
      return res.status(403).json({ message: 'Insufficient server permissions' });
    }

    return next();
  };

export const requireServerMembership = requireServerRole('MEMBER');
