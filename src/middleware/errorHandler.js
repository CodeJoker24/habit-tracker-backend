import { logger } from '../utils/logger.js';

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

export const errorHandler = (error, req, res, next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) logger.error(error.message, error);
  else logger.warn(error.message);

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : error.message,
    ...(error.details ? { details: error.details } : {}),
  });
};
