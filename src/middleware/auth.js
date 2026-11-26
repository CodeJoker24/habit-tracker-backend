import { fetchProfile, verifyToken } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createError } from '../utils/httpError.js';

const extractToken = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw createError(401, 'Authentication required');

  const user = await verifyToken(token);
  const profile = await fetchProfile(token, user.id);

  req.auth = {
    token,
    user: { id: user.id, email: user.email },
    profile: profile ?? {
      id: user.id,
      email: user.email,
      role: 'user',
      is_active: true,
    },
  };

  next();
});

export const requireActive = (req, res, next) => {
  if (!req.auth?.profile?.is_active) {
    return next(createError(403, 'Account is suspended'));
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth?.profile?.role)) {
    return next(createError(403, 'Insufficient permissions'));
  }
  next();
};
