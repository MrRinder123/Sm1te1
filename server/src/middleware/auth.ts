import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyAccessToken } from '../utils/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: string; email: string };
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing token' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid token' });
  }
};
