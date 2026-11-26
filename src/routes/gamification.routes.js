import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import {
  getGamificationOverview,
  markAllNotificationsRead,
  markNotificationRead,
  recomputeGamification,
} from '../services/gamification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, requireActive);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getGamificationOverview(req.auth.token, req.auth.user.id) });
  }),
);

router.post(
  '/recompute',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await recomputeGamification(req.auth.token, req.auth.user.id) });
  }),
);

router.patch(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await markNotificationRead(req.auth.token, req.params.id) });
  }),
);

router.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await markAllNotificationsRead(req.auth.token) });
  }),
);

export default router;
