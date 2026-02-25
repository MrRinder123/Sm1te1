import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { registerSocketHandlers } from './socket';
import { Server as SocketIOServer } from 'socket.io';

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: env.CORS_ORIGIN, credentials: true }
});

registerSocketHandlers(io);

server.listen(Number(env.PORT), () => {
  console.log(`FoxCord server running on port ${env.PORT}`);
});
