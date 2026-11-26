import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { allowedOrigins } from '../config/env.js';
import { redis, redisSubscriber, redisReady } from '../config/redis.js';
import { fetchProfile, verifyToken } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

let io = null;

export const emitToUser = (userId, event, payload) => {
  io?.to(`user:${userId}`).emit(event, payload);
};

export const emitToAdmins = (event, payload) => {
  io?.to('admins').emit(event, payload);
};

export const emitActivity = (userId, type, action, targetId = null) => {
  emitToAdmins('admin:activity', {
    userId,
    type,
    action,
    targetId,
    at: new Date().toISOString(),
  });
};

export const initializeSockets = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Missing token');
      const user = await verifyToken(token);
      const profile = await fetchProfile(token, user.id);
      if (!profile?.is_active) throw new Error('Inactive account');
      socket.data.user = { id: user.id, role: profile.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  if (redisReady && redis && redisSubscriber) {
    io.adapter(createAdapter(redis, redisSubscriber));
    logger.info('Socket.IO Redis adapter enabled');
  } else {
    logger.warn('Socket.IO using in-memory adapter; events will not cross instances');
  }

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    if (role === 'admin') socket.join('admins');
    logger.debug(`Socket connected: ${socket.id} (${id})`);
    socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
  });

  return io;
};
