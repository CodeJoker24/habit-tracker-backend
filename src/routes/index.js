import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import analyticsRoutes from './analytics.routes.js';
import badgeRoutes from './badge.routes.js';
import { createAuthRoutes } from './auth.routes.js';
import gamificationRoutes from './gamification.routes.js';
import habitRoutes from './habits.routes.js';
import healthRoutes from './health.routes.js';
import profileRoutes from './profile.routes.js';
import taskRoutes from './tasks.routes.js';
import timerRoutes from './timer.routes.js';

export const createRoutes = (useRedis = false) => {
  const router = Router();

  router.use('/', healthRoutes);
  router.use('/auth', createAuthRoutes(useRedis));
  router.use('/admin', adminRoutes);
  router.use('/badges', badgeRoutes);
  router.use('/tasks', taskRoutes);
  router.use('/habits', habitRoutes);
  router.use('/timer', timerRoutes);
  router.use('/analytics', analyticsRoutes);
  router.use('/gamification', gamificationRoutes);
  router.use('/profile', profileRoutes);

  return router;
};
