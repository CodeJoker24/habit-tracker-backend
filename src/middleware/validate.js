import { createError } from '../utils/httpError.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return next(createError(400, 'Invalid request', result.error.flatten()));
  }

  req.body = result.data;
  next();
};
