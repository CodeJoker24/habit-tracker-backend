import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config/env.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const createRateLimiter = (useRedis = false, overrides = {}) => {
  const { skipAuthenticated = true, keyPrefix = 'global', ...rateLimitOverrides } = overrides;
  const options = {
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
    ...rateLimitOverrides,
  };

  const existingSkip = options.skip;
  options.skip = (req) =>
    (skipAuthenticated && Boolean(req.headers.authorization)) || (existingSkip ? existingSkip(req) : false);

  if (useRedis && redis) {
    options.store = new RedisStore({
      sendCommand: (...args) => redis.sendCommand(args),
      prefix: `habit-tracker:rate-limit:${keyPrefix}:`,
    });
    logger.info(`Rate limiting backed by Redis (${keyPrefix})`);
  } else {
    logger.warn(`Rate limiting using in-memory store (${keyPrefix})`);
  }

  return rateLimit(options);
};
