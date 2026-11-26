import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  category: z.string().trim().max(60).nullish(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'completed']).default('pending'),
  due_at: z.string().datetime().nullish(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskStatusSchema = z.object({
  status: z.enum(['pending', 'completed']),
});

export const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullish(),
  frequency: z.enum(['daily', 'weekly']).default('daily'),
  target: z.number().int().min(1).max(7).default(1),
});

export const updateHabitSchema = createHabitSchema.partial();

export const completionSchema = z.object({
  habit_id: z.string().uuid(),
  completed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const timerSessionSchema = z.object({
  duration_minutes: z.number().int().min(1).max(240),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
});

const optionalText = (max) => z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(max).nullable().optional(),
);

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(80).optional(),
  username: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/).nullable().optional(),
  ),
  bio: optionalText(500),
  location: optionalText(120),
  date_of_birth: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ),
  visibility: z.enum(['public', 'private']).optional(),
  notification_preferences: z.object({
    badges: z.boolean().optional(),
    levels: z.boolean().optional(),
    reminders: z.boolean().optional(),
  }).optional(),
  favourite_badge_ids: z.array(z.string().uuid()).max(6).optional(),
});

const badgeFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  icon: z.string().trim().min(1).max(60),
  rarity: z.enum(['rare', 'very_rare', 'epic', 'legendary']),
  category: z.enum(['productivity', 'task', 'habit', 'streak', 'time_management', 'early_riser', 'night_owl', 'weekly', 'monthly', 'xp', 'improvement', 'special', 'secret', 'long_term']),
  requirement_type: z.enum(['stat_threshold', 'session_time', 'period', 'manual']),
  requirement_config: z.record(z.string(), z.unknown()),
  xp_reward: z.number().int().min(0).max(10000),
  is_hidden: z.boolean().default(false),
};

export const createBadgeSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]+$/).min(2).max(80),
  ...badgeFields,
});

export const updateBadgeSchema = z.object({
  ...badgeFields,
  is_active: z.boolean(),
});

export const awardBadgeSchema = z.object({
  user_id: z.string().uuid(),
});
