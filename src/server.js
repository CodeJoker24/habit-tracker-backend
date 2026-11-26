import http from 'node:http';
import { config } from './config/env.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { pool } from './config/database.js';
import { createApp } from './app.js';
import { initializeSockets } from './sockets/index.js';
import { logger } from './utils/logger.js';

const start = async () => {
  await connectRedis();

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = initializeSockets(httpServer);
  app.set('io', io);

  httpServer.listen(config.port, () => {
    logger.info(`Backend listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    io.close();
    httpServer.close(async () => {
      await disconnectRedis();
      await pool?.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((error) => {
  logger.error('Failed to start backend', error);
  process.exit(1);
});
