import { Router } from 'express';
import { authenticate, requireActive } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validate.js';
import { safeRecompute } from '../services/gamification.service.js';
import { emitActivity } from '../sockets/index.js';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  setTaskStatus,
  updateTask,
} from '../services/task.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createTaskSchema, taskStatusSchema, updateTaskSchema } from '../utils/validation.js';

const router = Router();

router.use(authenticate, requireActive, idempotency);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listTasks(req.auth.token, req.query) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getTask(req.auth.token, req.params.id) });
  }),
);

router.post(
  '/',
  validateBody(createTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await createTask(req.auth.token, req.body);
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'task', 'created', task?.id);
    res.status(201).json({ success: true, data: task });
  }),
);

router.put(
  '/:id',
  validateBody(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await updateTask(req.auth.token, req.params.id, req.body, req.get('X-Base-Version'));
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'task', 'updated', req.params.id);
    res.json({ success: true, data: task });
  }),
);

router.patch(
  '/:id/status',
  validateBody(taskStatusSchema),
  asyncHandler(async (req, res) => {
    const task = await setTaskStatus(
      req.auth.token,
      req.params.id,
      req.body.status,
      req.get('X-Base-Version'),
    );
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'task', `status:${req.body.status}`, req.params.id);
    res.json({ success: true, data: task });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteTask(req.auth.token, req.params.id);
    await safeRecompute(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'task', 'deleted', req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  }),
);

export default router;
