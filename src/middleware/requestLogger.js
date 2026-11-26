import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - started) / 1e6;
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(1)}ms`);
  });

  next();
};
