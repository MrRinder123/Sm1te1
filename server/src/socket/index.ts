import crypto from 'crypto';
import { Server } from 'socket.io';

export const registerSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    socket.on('room:join', ({ channelId }) => socket.join(channelId));
    socket.on('dm:join', ({ roomId }) => socket.join(`dm:${roomId}`));

    socket.on('message:new', (payload) => {
      io.to(payload.channelId).emit('message:new', {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      });
    });

    socket.on('message:edit', (payload) => {
      io.to(payload.channelId).emit('message:edit', payload);
    });

    socket.on('message:delete', (payload) => {
      io.to(payload.channelId).emit('message:delete', payload);
    });

    socket.on('message:reaction', (payload) => {
      io.to(payload.channelId).emit('message:reaction', payload);
    });

    socket.on('message:typing', (payload) => {
      socket.to(payload.channelId).emit('message:typing', payload);
    });

    socket.on('dm:new', (payload) => {
      io.to(`dm:${payload.roomId}`).emit('dm:new', {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      });
    });

    // Voice signaling relay for WebRTC offer/answer/ICE.
    socket.on('voice:signal', ({ channelId, signal, targetSocketId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice:signal', { channelId, signal, from: socket.id });
      } else {
        socket.to(channelId).emit('voice:signal', { channelId, signal, from: socket.id });
      }
    });

    socket.on('voice:mute', ({ channelId, muted }) => {
      socket.to(channelId).emit('voice:mute', { userSocketId: socket.id, muted });
    });
  });
};
