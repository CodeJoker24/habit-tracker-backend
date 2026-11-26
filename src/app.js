import express from 'express';
import helmet from 'helmet';
import { redisReady } from './config/redis.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { createRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestLogger);
  app.use('/api', createRateLimiter(redisReady));
  app.use('/api', createRoutes(redisReady));
  app.use(notFound);
  app.use(errorHandler);

  logger.debug('Express application configured');
  return app;
};
