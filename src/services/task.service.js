import { dataClient, unwrap } from './supabaseData.js';
import { createError } from '../utils/httpError.js';

const assertVersion = async (client, id, expectedVersion) => {
  const current = unwrap(
    await client.from('tasks').select('version, updated_at').eq('id', id).maybeSingle(),
    'Task not found',
  );
  if (!current) throw createError(404, 'Task not found');
  if (Number(expectedVersion) !== current.version) {
    throw createError(409, 'This task changed elsewhere. Review the latest version before saving.', {
      currentVersion: current.version,
      updatedAt: current.updated_at,
    });
  }
};

export const listTasks = async (token, filters = {}) => {
  let query = dataClient(token).from('tasks').select('*').order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.due === 'upcoming') query = query.gte('due_at', new Date().toISOString()).eq('status', 'pending');
  if (filters.due === 'overdue') query = query.lt('due_at', new Date().toISOString()).eq('status', 'pending');

  return unwrap(await query, 'Could not load tasks');
};

export const getTask = async (token, id) => {
  const result = await dataClient(token).from('tasks').select('*').eq('id', id).single();
  return unwrap(result, 'Task not found');
};

export const createTask = async (token, values) => {
  const result = await dataClient(token).from('tasks').insert(values).select().single();
  return unwrap(result, 'Could not create task');
};

export const updateTask = async (token, id, values, expectedVersion) => {
  const client = dataClient(token);
  if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== '') {
    await assertVersion(client, id, expectedVersion);
  }
  const result = await client.from('tasks').update(values).eq('id', id).select().single();
  return unwrap(result, 'Could not update task');
};

export const deleteTask = async (token, id) => {
  const result = await dataClient(token).from('tasks').delete().eq('id', id);
  return unwrap(result, 'Could not delete task');
};

export const setTaskStatus = async (token, id, status, expectedVersion) => {
  const values = {
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  };
  return updateTask(token, id, values, expectedVersion);
};
