import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import serversRoutes from './modules/servers/servers.routes';
import channelsRoutes from './modules/channels/channels.routes';
import messagingRoutes from './modules/messaging/messaging.routes';
import friendsRoutes from './modules/friends/friends.routes';
import voiceRoutes from './modules/voice/voice.routes';
import dmRoutes from './modules/dm/dm.routes';
import foxtroRoutes from './modules/foxtro/foxtro.routes';
import moderationRoutes from './modules/moderation/moderation.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 400 }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/messages', messagingRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/foxtro', foxtroRoutes);
app.use('/api/moderation', moderationRoutes);
