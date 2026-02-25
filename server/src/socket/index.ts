import crypto from 'crypto';
import { Server } from 'socket.io';

const voiceChannels = new Map<string, Set<string>>();
const socketToVoiceChannel = new Map<string, string>();

const removeFromVoiceChannel = (io: Server, socketId: string) => {
  const channelId = socketToVoiceChannel.get(socketId);
  if (!channelId) return;

  socketToVoiceChannel.delete(socketId);
  const participants = voiceChannels.get(channelId);
  if (!participants) return;

  participants.delete(socketId);
  if (participants.size === 0) {
    voiceChannels.delete(channelId);
  }

  io.to(channelId).emit('voice:user-left', { channelId, socketId });
};

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

    socket.on('voice:join', ({ channelId }) => {
      removeFromVoiceChannel(io, socket.id);

      socket.join(channelId);
      socketToVoiceChannel.set(socket.id, channelId);

      const participants = voiceChannels.get(channelId) ?? new Set<string>();
      const existingParticipants = Array.from(participants);
      participants.add(socket.id);
      voiceChannels.set(channelId, participants);

      socket.emit('voice:participants', { channelId, participants: existingParticipants });
      socket.to(channelId).emit('voice:user-joined', { channelId, socketId: socket.id });
    });

    socket.on('voice:leave', ({ channelId }) => {
      socket.leave(channelId);
      removeFromVoiceChannel(io, socket.id);
    });

    // Voice signaling relay for WebRTC offer/answer/ICE.
    socket.on('voice:signal', ({ channelId, signal, targetSocketId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice:signal', { channelId, signal, from: socket.id });
      }
    });

    socket.on('voice:mute', ({ channelId, muted }) => {
      socket.to(channelId).emit('voice:mute', { userSocketId: socket.id, muted });
    });

    socket.on('disconnect', () => {
      removeFromVoiceChannel(io, socket.id);
    });
  });
};
