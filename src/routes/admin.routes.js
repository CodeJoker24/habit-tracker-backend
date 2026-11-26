import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { authenticate, requireActive, requireRole } from '../middleware/auth.js';
import { emitActivity } from '../sockets/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createError } from '../utils/httpError.js';

const router = Router();

router.use(authenticate, requireActive, requireRole('admin'));

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { data, error } = await createUserClient(req.auth.token).rpc('admin_summary');

    if (error) throw createError(503, 'Administrator data is unavailable');
    res.json({ success: true, data: data ?? {} });
  }),
);

router.get(
  '/deletion-requests',
  asyncHandler(async (req, res) => {
    const { data, error } = await createUserClient(req.auth.token)
      .from('profiles')
      .select('id, email, full_name, account_deletion_requested_at')
      .not('account_deletion_requested_at', 'is', null)
      .order('account_deletion_requested_at', { ascending: true });

    if (error) throw createError(503, 'Could not load deletion requests');
    res.json({ success: true, data: data ?? [] });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await createUserClient(req.auth.token).rpc('admin_delete_user', {
      p_user_id: req.params.id,
    });

    if (error) throw createError(400, error.message || 'Could not delete account');
    if (!data) throw createError(404, 'Account not found');
    emitActivity(req.auth.user.id, 'account', 'deleted', req.params.id);
    res.json({ success: true, data: { deleted: true } });
  }),
);

export default router;
