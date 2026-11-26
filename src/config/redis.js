import { createClient } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const redis = config.redisUrl ? createClient({ url: config.redisUrl }) : null;
export const redisSubscriber = redis ? redis.duplicate() : null;

export let redisReady = false;

if (redis) {
  redis.on('error', (error) => logger.error('Redis client error', error));
  redisSubscriber.on('error', (error) => logger.error('Redis subscriber error', error));
}

export async function connectRedis() {
  if (!redis) {
    logger.warn('REDIS_URL is not set; using in-memory rate limiting and Socket.IO adapter');
    return false;
  }

  try {
    if (!redis.isOpen) await redis.connect();
    if (!redisSubscriber.isOpen) await redisSubscriber.connect();
    redisReady = true;
    logger.info('Redis connected');
    return true;
  } catch (error) {
    logger.error('Could not connect to Redis', error);
    return false;
  }
}

export async function disconnectRedis() {
  if (redis?.isOpen) await redis.quit();
  if (redisSubscriber?.isOpen) await redisSubscriber.quit();
  redisReady = false;
}
