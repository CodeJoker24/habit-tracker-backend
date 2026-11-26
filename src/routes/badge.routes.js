import { Router } from 'express';
import { authenticate, requireActive, requireRole } from '../middleware/auth.js';
import { awardBadge, createBadge, findUsers, listBadges, updateBadge } from '../services/badge.service.js';
import { emitActivity, emitToUser } from '../sockets/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { awardBadgeSchema, createBadgeSchema, updateBadgeSchema } from '../utils/validation.js';

const router = Router();

router.use(authenticate, requireActive, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listBadges(req.auth.token) });
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await findUsers(req.auth.token, String(req.query.search || '').slice(0, 120)),
    });
  }),
);

router.post(
  '/',
  validateBody(createBadgeSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await createBadge(req.auth.token, req.body) });
  }),
);

router.put(
  '/:id',
  validateBody(updateBadgeSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await updateBadge(req.auth.token, req.params.id, req.body) });
  }),
);

router.post(
  '/:id/award',
  validateBody(awardBadgeSchema),
  asyncHandler(async (req, res) => {
    const result = await awardBadge(req.auth.token, req.body.user_id, req.params.id);
    emitToUser(req.body.user_id, 'notification:new', { count: 1, at: new Date().toISOString() });
    emitToUser(req.body.user_id, 'gamification:updated', { at: new Date().toISOString() });
    emitActivity(req.auth.user.id, 'badge', 'awarded', req.params.id);
    res.json({ success: true, data: result });
  }),
);

export default router;
