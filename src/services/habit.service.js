import { dataClient, unwrap } from './supabaseData.js';
import { createError } from '../utils/httpError.js';

export const listHabits = async (token) =>
  unwrap(
    await dataClient(token).from('habits').select('*').order('created_at', { ascending: false }),
    'Could not load habits',
  );

export const getHabit = async (token, id) => {
  const result = await dataClient(token).from('habits').select('*').eq('id', id).single();
  return unwrap(result, 'Habit not found');
};

export const createHabit = async (token, values) => {
  const result = await dataClient(token).from('habits').insert(values).select().single();
  return unwrap(result, 'Could not create habit');
};

export const updateHabit = async (token, id, values, expectedVersion) => {
  const client = dataClient(token);
  if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== '') {
    const current = unwrap(
      await client.from('habits').select('version, updated_at').eq('id', id).maybeSingle(),
      'Habit not found',
    );
    if (!current) throw createError(404, 'Habit not found');
    if (Number(expectedVersion) !== current.version) {
      throw createError(409, 'This habit changed elsewhere. Review the latest version before saving.', {
        currentVersion: current.version,
        updatedAt: current.updated_at,
      });
    }
  }
  const result = await client.from('habits').update(values).eq('id', id).select().single();
  return unwrap(result, 'Could not update habit');
};

export const deleteHabit = async (token, id) => {
  const result = await dataClient(token).from('habits').delete().eq('id', id);
  return unwrap(result, 'Could not delete habit');
};

export const listCompletions = async (token, from, to) => {
  let query = dataClient(token)
    .from('habit_completions')
    .select('id, habit_id, completed_on')
    .order('completed_on', { ascending: false });

  if (from) query = query.gte('completed_on', from);
  if (to) query = query.lte('completed_on', to);

  return unwrap(await query, 'Could not load habit history');
};

export const addCompletion = async (token, habitId, completedOn) => {
  const result = await dataClient(token)
    .from('habit_completions')
    .upsert({ habit_id: habitId, completed_on: completedOn }, { onConflict: 'habit_id,completed_on' })
    .select()
    .single();
  return unwrap(result, 'Could not record habit completion');
};

export const removeCompletion = async (token, habitId, completedOn) => {
  const result = await dataClient(token)
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('completed_on', completedOn);
  return unwrap(result, 'Could not remove habit completion');
};
