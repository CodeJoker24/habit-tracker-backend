import { dataClient, unwrap } from './supabaseData.js';

export const listSessions = async (token) =>
  unwrap(
    await dataClient(token)
      .from('timer_sessions')
      .select('*')
      .order('ended_at', { ascending: false })
      .limit(50),
    'Could not load timer sessions',
  );

export const createSession = async (token, values) => {
  const result = await dataClient(token).from('timer_sessions').insert(values).select().single();
  return unwrap(result, 'Could not save timer session');
};
