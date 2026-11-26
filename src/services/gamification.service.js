import { emitToUser } from '../sockets/index.js';
import { dataClient, fetchAll, unwrap } from './supabaseData.js';

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

const shiftDays = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const streakStats = (dates) => {
  const unique = [...new Set(dates.map(dayKey))].sort();
  if (unique.length === 0) return { current: 0, longest: 0 };

  const values = new Set(unique);
  let cursor = dayKey(new Date());
  if (!values.has(cursor)) cursor = shiftDays(cursor, -1);

  let current = 0;
  while (values.has(cursor)) {
    current += 1;
    cursor = shiftDays(cursor, -1);
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    run = shiftDays(unique[index - 1], 1) === unique[index] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return { current, longest };
};

const computeMetrics = async (client) => {
  const [tasks, completions, sessions, statsResult] = await Promise.all([
    fetchAll(client, 'tasks', 'Could not calculate task metrics'),
    fetchAll(client, 'habit_completions', 'Could not calculate habit metrics'),
    fetchAll(client, 'timer_sessions', 'Could not calculate focus metrics'),
    client.from('user_stats').select('*').maybeSingle(),
  ]);

  const stats = unwrap(statsResult, 'Could not load your stats');

  const today = dayKey(new Date());
  const weekStart = shiftDays(today, -6);
  const monthStart = shiftDays(today, -29);
  const inRange = (value, start) => {
    if (!value) return false;
    const key = dayKey(value);
    return key >= start && key <= today;
  };

  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const streaks = streakStats(completions.map((item) => item.completed_on));
  const activeDays = new Set([
    ...completedTasks.filter((task) => inRange(task.completed_at, monthStart)).map((task) => dayKey(task.completed_at)),
    ...completions.filter((item) => inRange(item.completed_on, monthStart)).map((item) => dayKey(item.completed_on)),
  ]);

  const metrics = {
    total_tasks_completed: completedTasks.length,
    total_habit_completions: completions.length,
    total_focus_minutes: sessions.reduce((total, session) => total + session.duration_minutes, 0),
    current_streak: streaks.current,
    longest_streak: streaks.longest,
    weekly_tasks: completedTasks.filter((task) => inRange(task.completed_at, weekStart)).length,
    monthly_tasks: completedTasks.filter((task) => inRange(task.completed_at, monthStart)).length,
    weekly_habits: completions.filter((item) => inRange(item.completed_on, weekStart)).length,
    monthly_habits: completions.filter((item) => inRange(item.completed_on, monthStart)).length,
    early_sessions: sessions.filter((session) => {
      const hour = new Date(session.started_at).getUTCHours();
      return hour >= 5 && hour < 9;
    }).length,
    late_sessions: sessions.filter((session) => {
      const hour = new Date(session.started_at).getUTCHours();
      return hour >= 21 || hour < 2;
    }).length,
    active_days: activeDays.size,
  };

  return { metrics, stats };
};

const requirementValue = (badge, metrics) => {
  const config = badge.requirement_config || {};
  if (badge.requirement_type === 'stat_threshold') return metrics[config.stat] ?? 0;
  if (badge.requirement_type === 'session_time' || badge.requirement_type === 'period') {
    return metrics[config.metric] ?? 0;
  }
  return null;
};

const requirementTarget = (badge) => {
  const config = badge.requirement_config || {};
  return Number(config.gte ?? 0);
};

const qualifies = (badge, metrics) => {
  if (badge.requirement_type === 'manual' || !badge.is_active) return false;
  const value = requirementValue(badge, metrics);
  return value !== null && value >= requirementTarget(badge);
};

const baseXp = (metrics) =>
  metrics.total_tasks_completed * 10 +
  metrics.total_habit_completions * 15 +
  metrics.total_focus_minutes;

const withBadgeProgress = (badge, metrics) => {
  const current = requirementValue(badge, metrics);
  const target = requirementTarget(badge);
  return {
    ...badge,
    progress: current === null || target === 0 ? null : Math.min(100, Math.round((current / target) * 100)),
    progressCurrent: current,
    progressTarget: target,
  };
};

export const getGamificationOverview = async (token, userId) => {
  const client = dataClient(token);
  const [{ metrics }, badges, userBadgesResult, notificationsResult, leaderboardResult] = await Promise.all([
    computeMetrics(client),
    fetchAll(client, 'badges', 'Could not load badges', { column: 'sort_order' }),
    client.from('user_badges').select('badge_id, earned_at').order('earned_at', { ascending: false }),
    client.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
    client.rpc('leaderboard', { p_limit: 20 }),
  ]);

  const earnedRows = unwrap(userBadgesResult, 'Could not load earned badges');
  const notifications = unwrap(notificationsResult, 'Could not load notifications');
  const leaderboard = unwrap(leaderboardResult, 'Could not load the leaderboard') || [];

  const earnedIds = new Set(earnedRows.map((row) => row.badge_id));
  const rank = leaderboard.find((entry) => entry.userId === userId)?.rank ?? null;
  const stats = unwrap(await client.from('user_stats').select('*').maybeSingle(), 'Could not load your stats');

  return {
    stats: stats || {
      user_id: userId,
      xp: 0,
      level: 1,
      total_tasks_completed: 0,
      total_habit_completions: 0,
      total_focus_minutes: 0,
      current_streak: 0,
      longest_streak: 0,
    },
    badges: badges.map((badge) => ({
      ...withBadgeProgress(badge, metrics),
      earned: earnedIds.has(badge.id),
    })),
    notifications,
    leaderboard,
    rank,
  };
};

export const recomputeGamification = async (token, userId, withOverview = true) => {
  const client = dataClient(token);
  const [{ metrics, stats }, badges, userBadgesResult, profileResult] = await Promise.all([
    computeMetrics(client),
    fetchAll(client, 'badges', 'Could not load badges'),
    client.from('user_badges').select('badge_id'),
    client.from('profiles').select('notification_preferences').eq('id', userId).maybeSingle(),
  ]);

  const earnedRows = unwrap(userBadgesResult, 'Could not load earned badges');
  const profile = unwrap(profileResult, 'Could not load your profile');
  const preferences = profile?.notification_preferences || {};

  const earnedIds = new Set(earnedRows.map((row) => row.badge_id));
  let qualified = badges.filter((badge) => qualifies(badge, metrics));
  const totalXp = (qualifiedIds) =>
    baseXp(metrics) + badges.reduce(
      (total, badge) => total + (earnedIds.has(badge.id) || qualifiedIds.has(badge.id) ? badge.xp_reward : 0),
      0,
    );
  let xp = totalXp(new Set());
  let level = Math.floor(xp / 100) + 1;

  for (let pass = 0; pass < 6; pass += 1) {
    const nextMetrics = { ...metrics, xp, level };
    const nextQualified = badges.filter((badge) => qualifies(badge, nextMetrics));
    const nextXp = totalXp(new Set(nextQualified.map((badge) => badge.id)));
    const nextLevel = Math.floor(nextXp / 100) + 1;
    if (nextQualified.length === qualified.length && nextXp === xp) break;
    qualified = nextQualified;
    xp = nextXp;
    level = nextLevel;
  }

  const newBadges = qualified.filter((badge) => !earnedIds.has(badge.id));

  if (newBadges.length) {
    unwrap(
      await client.from('user_badges').insert(newBadges.map((badge) => ({ badge_id: badge.id }))),
      'Could not award badges',
    );

    const transactions = newBadges.map((badge) => ({
      badge_id: badge.id,
      operation_id: `${userId}:${badge.id}:auto`,
      xp_delta: badge.xp_reward,
    }));
    unwrap(await client.from('achievement_transactions').insert(transactions), 'Could not record achievements');
  }

  const values = {
    xp,
    level,
    total_tasks_completed: metrics.total_tasks_completed,
    total_habit_completions: metrics.total_habit_completions,
    total_focus_minutes: metrics.total_focus_minutes,
    current_streak: metrics.current_streak,
    longest_streak: metrics.longest_streak,
    last_level: level,
  };

  if (stats) {
    unwrap(await client.from('user_stats').update(values).eq('user_id', stats.user_id), 'Could not update stats');
  } else {
    unwrap(await client.from('user_stats').insert({ user_id: userId, ...values }), 'Could not create stats');
  }

  const notifications = [];
  if (preferences.badges !== false) {
    newBadges.forEach((badge) => {
      notifications.push({
        type: 'badge',
        title: `Badge unlocked: ${badge.name}`,
        body: badge.description,
      });
    });
  }

  const previousLevel = stats?.last_level || stats?.level || 1;
  if (level > previousLevel && preferences.levels !== false) {
    notifications.push({
      type: 'level',
      title: `Level ${level} reached`,
      body: `You now have ${xp} XP in total. Keep the momentum going.`,
    });
  }

  if (notifications.length) {
    unwrap(await client.from('notifications').insert(notifications), 'Could not create notifications');
    emitToUser(userId, 'notification:new', { count: notifications.length, at: new Date().toISOString() });
  }

  emitToUser(userId, 'gamification:updated', { at: new Date().toISOString() });

  if (withOverview) return getGamificationOverview(token, userId);
  return null;
};

export const safeRecompute = async (token, userId) => {
  try {
    await recomputeGamification(token, userId, false);
  } catch {
    return null;
  }
};

export const markNotificationRead = async (token, id) =>
  unwrap(
    await dataClient(token).from('notifications').update({ read: true }).eq('id', id).select().single(),
    'Could not update notification',
  );

export const markAllNotificationsRead = async (token) =>
  unwrap(
    await dataClient(token).from('notifications').update({ read: true }).eq('read', false).select(),
    'Could not update notifications',
  );
