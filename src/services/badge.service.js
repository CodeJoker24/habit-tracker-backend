import { createUserClient } from '../config/supabase.js';
import { fetchAll } from './supabaseData.js';
import { createError } from '../utils/httpError.js';

export const listBadges = async (token) =>
  fetchAll(createUserClient(token), 'badges', 'Could not load badges', { column: 'sort_order' });

export const createBadge = async (token, values) => {
  const { data, error } = await createUserClient(token).rpc('admin_create_badge', {
    p_code: values.code,
    p_name: values.name,
    p_description: values.description,
    p_icon: values.icon,
    p_rarity: values.rarity,
    p_category: values.category,
    p_requirement_type: values.requirement_type,
    p_requirement_config: values.requirement_config,
    p_xp_reward: values.xp_reward,
    p_is_hidden: values.is_hidden,
  });
  if (error) throw createError(400, error.message || 'Could not create badge');
  return data;
};

export const updateBadge = async (token, id, values) => {
  const { data, error } = await createUserClient(token).rpc('admin_update_badge', {
    p_id: id,
    p_name: values.name,
    p_description: values.description,
    p_icon: values.icon,
    p_rarity: values.rarity,
    p_category: values.category,
    p_requirement_type: values.requirement_type,
    p_requirement_config: values.requirement_config,
    p_xp_reward: values.xp_reward,
    p_is_active: values.is_active,
    p_is_hidden: values.is_hidden,
  });
  if (error) throw createError(400, error.message || 'Could not update badge');
  if (!data) throw createError(404, 'Badge not found');
  return data;
};

export const findUsers = async (token, search) => {
  const { data, error } = await createUserClient(token).rpc('admin_search_users', {
    p_search: search || '',
  });
  if (error) throw createError(400, error.message || 'Could not search users');
  return data || [];
};

export const awardBadge = async (token, userId, badgeId) => {
  const { data, error } = await createUserClient(token).rpc('admin_award_badge', {
    p_user_id: userId,
    p_badge_id: badgeId,
  });
  if (error) throw createError(400, error.message || 'Could not award badge');
  return { userId, badgeId, awarded: Boolean(data) };
};
