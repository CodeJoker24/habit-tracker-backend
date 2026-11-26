import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validate.js';
import { safeRecompute } from '../services/gamification.service.js';
import { emitActivity } from '../sockets/index.js';
import { createSession, listSessions } from '../services/timer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { timerSessionSchema } from '../utils/validation.js';

const router = Router();

router.use(authenticate, requireActive, idempotency);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listSessions(req.auth.token) });
  }),
);

router.post(
  '/sessions',
  validateBody(timerSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await createSession(req.auth.token, req.body);
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'timer', 'completed', session?.id);
    res.status(201).json({ success: true, data: session });
  }),
);

export default router;
