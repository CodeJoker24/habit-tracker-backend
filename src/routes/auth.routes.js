import { Router } from 'express';
import { config } from '../config/env.js';
import { authenticate, requireActive } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { loginUser, logoutUser, registerUser, requestPasswordReset, updatePassword } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../utils/validation.js';

export const createAuthRoutes = (useRedis = false) => {
  const router = Router();

  const limiter = createRateLimiter(useRedis, {
    windowMs: 15 * 60 * 1000,
    limit: 50,
    keyPrefix: 'auth',
    skipAuthenticated: false,
    message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  });

  router.post(
    '/register',
    limiter,
    validateBody(registerSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({ success: true, data: await registerUser(req.body) });
    }),
  );

  router.post(
    '/login',
    limiter,
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await loginUser(req.body) });
    }),
  );

  router.post(
    '/forgot-password',
    limiter,
    validateBody(forgotPasswordSchema),
    asyncHandler(async (req, res) => {
      const origin = config.clientUrl.split(',')[0].trim();
      await requestPasswordReset(req.body.email, `${origin}/reset-password`);
      res.json({ success: true, message: 'If the account exists, a reset link has been sent.' });
    }),
  );

  router.post(
    '/logout',
    authenticate,
    asyncHandler(async (req, res) => {
      await logoutUser(req.auth.token);
      res.json({ success: true, message: 'Signed out' });
    }),
  );

  router.get(
    '/me',
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({
        success: true,
        data: { user: req.auth.user, profile: req.auth.profile },
      });
    }),
  );

  router.post(
    '/reset-password',
    authenticate,
    requireActive,
    validateBody(resetPasswordSchema),
    asyncHandler(async (req, res) => {
      await updatePassword(req.auth.token, req.body.password);
      res.json({ success: true, message: 'Password updated' });
    }),
  );

  return router;
};
