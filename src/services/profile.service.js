import { createUserClient } from '../config/supabase.js';
import { createError } from '../utils/httpError.js';
import { getGamificationOverview } from './gamification.service.js';
import { unwrap } from './supabaseData.js';

const fields = [
  'id',
  'email',
  'full_name',
  'avatar_url',
  'username',
  'bio',
  'location',
  'date_of_birth',
  'visibility',
  'notification_preferences',
  'favourite_badge_ids',
  'account_deletion_requested_at',
  'role',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

export const getProfile = async (token, userId) =>
  unwrap(
    await createUserClient(token).from('profiles').select(fields).eq('id', userId).single(),
    'Profile not found',
  );

export const updateProfile = async (token, userId, values) => {
  const result = await createUserClient(token)
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select(fields)
    .single();

  if (result.error?.code === '23505') throw createError(409, 'That username is already taken');
  return unwrap(result, 'Could not update profile');
};

export const getProfileOverview = async (token, userId) => {
  const [profile, gamification] = await Promise.all([
    getProfile(token, userId),
    getGamificationOverview(token, userId),
  ]);

  const visibleBadges = gamification.badges.filter((badge) => !badge.is_hidden);
  const rarityCounts = visibleBadges.reduce(
    (counts, badge) => {
      if (badge.earned) counts[badge.rarity] = (counts[badge.rarity] || 0) + 1;
      return counts;
    },
    { rare: 0, very_rare: 0, epic: 0, legendary: 0 },
  );

  const favourites = gamification.badges.filter((badge) =>
    (profile.favourite_badge_ids || []).includes(badge.id),
  );

  return {
    profile,
    stats: gamification.stats,
    badges: visibleBadges,
    rarityCounts,
    earnedCount: visibleBadges.filter((badge) => badge.earned).length,
    favourites: favourites.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      icon: badge.icon,
      rarity: badge.rarity,
      earned: badge.earned,
    })),
    rank: gamification.rank,
  };
};

export const getPublicProfile = async (token, username) => {
  const { data, error } = await createUserClient(token).rpc('get_public_profile', {
    p_username: username,
  });
  if (error) throw createError(400, error.message || 'Could not load public profile');
  if (!data) throw createError(404, 'Public profile not found');
  return data;
};

export const requestAccountDeletion = async (token, userId) =>
  unwrap(
    await createUserClient(token)
      .from('profiles')
      .update({ account_deletion_requested_at: new Date().toISOString() })
      .eq('id', userId)
      .select(fields)
      .single(),
    'Could not record your request',
  );
