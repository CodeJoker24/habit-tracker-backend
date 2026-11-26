import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import { getAnalytics } from '../services/analytics.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, requireActive);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getAnalytics(req.auth.token) });
  }),
);

export default router;
