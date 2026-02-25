import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const signAccessToken = (payload: { userId: string; email: string }) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });

export const signRefreshToken = (payload: { userId: string; email: string }) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; email: string };
