import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validate.js';
import { safeRecompute } from '../services/gamification.service.js';
import { emitActivity } from '../sockets/index.js';
import {
  addCompletion,
  createHabit,
  deleteHabit,
  getHabit,
  listCompletions,
  listHabits,
  removeCompletion,
  updateHabit,
} from '../services/habit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { completionSchema, createHabitSchema, updateHabitSchema } from '../utils/validation.js';

const router = Router();

router.use(authenticate, requireActive, idempotency);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listHabits(req.auth.token) });
  }),
);

router.get(
  '/completions',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await listCompletions(req.auth.token, req.query.from, req.query.to),
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getHabit(req.auth.token, req.params.id) });
  }),
);

router.post(
  '/',
  validateBody(createHabitSchema),
  asyncHandler(async (req, res) => {
    const habit = await createHabit(req.auth.token, req.body);
    emitActivity(req.auth.user.id, 'habit', 'created', habit?.id);
    res.status(201).json({ success: true, data: habit });
  }),
);

router.put(
  '/:id',
  validateBody(updateHabitSchema),
  asyncHandler(async (req, res) => {
    const habit = await updateHabit(req.auth.token, req.params.id, req.body, req.get('X-Base-Version'));
    emitActivity(req.auth.user.id, 'habit', 'updated', req.params.id);
    res.json({ success: true, data: habit });
  }),
);

router.post(
  '/completions',
  validateBody(completionSchema),
  asyncHandler(async (req, res) => {
    const result = await addCompletion(
      req.auth.token,
      req.body.habit_id,
      req.body.completed_on,
    );
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'habit', 'completed', req.body.habit_id);
    res.status(201).json({ success: true, data: result });
  }),
);

router.delete(
  '/completions',
  validateBody(completionSchema),
  asyncHandler(async (req, res) => {
    await removeCompletion(req.auth.token, req.body.habit_id, req.body.completed_on);
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'habit', 'completion_removed', req.body.habit_id);
    res.json({ success: true, message: 'Completion removed' });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteHabit(req.auth.token, req.params.id);
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'habit', 'deleted', req.params.id);
    res.json({ success: true, message: 'Habit deleted' });
  }),
);

export default router;
