import { Router } from 'express';
import multer from 'multer';
import { createUserClient } from '../config/supabase.js';
import { authenticate, requireActive } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  getProfile,
  getProfileOverview,
  getPublicProfile,
  requestAccountDeletion,
  updateProfile,
} from '../services/profile.service.js';
import { emitActivity } from '../sockets/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createError } from '../utils/httpError.js';
import { profileUpdateSchema } from '../utils/validation.js';

const router = Router();
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) return callback(new Error('Only image files are allowed'));
    return callback(null, true);
  },
});

router.use(authenticate, requireActive);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getProfile(req.auth.token, req.auth.user.id) });
  }),
);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getProfileOverview(req.auth.token, req.auth.user.id) });
  }),
);

router.get(
  '/public/:username',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getPublicProfile(req.auth.token, req.params.username) });
  }),
);

router.put(
  '/',
  validateBody(profileUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await updateProfile(req.auth.token, req.auth.user.id, req.body),
    });
  }),
);

router.post(
  '/avatar',
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw createError(400, 'An image file is required');
    const client = createUserClient(req.auth.token);
    const extension =
      { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[
        req.file.mimetype
      ] || 'img';
    const path = `${req.auth.user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw createError(400, uploadError.message || 'Could not upload avatar');

    const { data: publicUrl } = client.storage.from('avatars').getPublicUrl(path);
    const profile = await updateProfile(
      req.auth.token,
      req.auth.user.id,
      { avatar_url: publicUrl.publicUrl },
    );
    emitActivity(req.auth.user.id, 'profile', 'avatar_updated', req.auth.user.id);
    res.json({ success: true, data: { avatar_url: publicUrl.publicUrl, profile } });
  }),
);

router.post(
  '/deletion-request',
  asyncHandler(async (req, res) => {
    const result = await requestAccountDeletion(req.auth.token, req.auth.user.id);
    emitActivity(req.auth.user.id, 'account', 'deletion_requested', req.auth.user.id);
    res.json({ success: true, data: result });
  }),
);

export default router;
