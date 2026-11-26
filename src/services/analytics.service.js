import { dataClient, unwrap } from './supabaseData.js';

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

const shiftDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const countByDay = (items, field) => {
  const counts = new Map();
  items.forEach((item) => {
    if (!item[field]) return;
    const key = dayKey(item[field]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

const dailySeries = (tasks) => {
  const today = new Date();
  const counts = countByDay(tasks, 'completed_at');
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDays(today, index - 6);
    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      completed: counts.get(dayKey(date)) || 0,
    };
  });
};

const weeklySeries = (tasks) => {
  const today = new Date();
  return Array.from({ length: 4 }, (_, index) => {
    const end = shiftDays(today, (index - 3) * 7);
    const start = shiftDays(end, -6);
    const completed = tasks.filter((task) => {
      if (!task.completed_at) return false;
      const value = new Date(task.completed_at);
      return value >= start && value <= shiftDays(end, 1);
    }).length;
    return {
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      completed,
    };
  });
};

const monthlySeries = (tasks) => {
  const today = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - index), 1));
    const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const completed = tasks.filter((task) => {
      if (!task.completed_at) return false;
      const value = new Date(task.completed_at);
      return value >= month && value < nextMonth;
    }).length;
    return {
      label: month.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      completed,
    };
  });
};

const habitSeries = (completions) => {
  const counts = new Map();
  completions.forEach((item) => {
    counts.set(item.completed_on, (counts.get(item.completed_on) || 0) + 1);
  });
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDays(today, index - 6);
    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      completed: counts.get(dayKey(date)) || 0,
    };
  });
};

const currentStreak = (completions) => {
  const dates = new Set(completions.map((item) => item.completed_on));
  const cursor = new Date();
  if (!dates.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (dates.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

export const getAnalytics = async (token) => {
  const client = dataClient(token);
  const [tasks, habits, completions, sessions] = await Promise.all([
    client.from('tasks').select('status, completed_at'),
    client.from('habits').select('id, frequency'),
    client.from('habit_completions').select('completed_on'),
    client.from('timer_sessions').select('duration_minutes'),
  ]);

  const taskRows = unwrap(tasks, 'Could not load task analytics');
  const habitRows = unwrap(habits, 'Could not load habit analytics');
  const completionRows = unwrap(completions, 'Could not load completion analytics');
  const sessionRows = unwrap(sessions, 'Could not load timer analytics');

  const sevenDaysAgo = dayKey(shiftDays(new Date(), -6));
  const recentCompletions = completionRows.filter((item) => item.completed_on >= sevenDaysAgo);
  const dailyHabits = habitRows.filter((habit) => habit.frequency === 'daily').length;
  const expected = dailyHabits * 7;

  return {
    completedTasks: taskRows.filter((task) => task.status === 'completed').length,
    pendingTasks: taskRows.filter((task) => task.status === 'pending').length,
    habitCompletionRate: expected ? Math.min(100, Math.round((recentCompletions.length / expected) * 100)) : 0,
    currentStreak: currentStreak(completionRows),
    focusMinutes: sessionRows.reduce((total, session) => total + session.duration_minutes, 0),
    sessions: sessionRows.length,
    daily: dailySeries(taskRows),
    weekly: weeklySeries(taskRows),
    monthly: monthlySeries(taskRows),
    habits: habitSeries(completionRows),
  };
};
