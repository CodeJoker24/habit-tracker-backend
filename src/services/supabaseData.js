import { createUserClient } from '../config/supabase.js';
import { createError } from '../utils/httpError.js';

export const dataClient = (token) => createUserClient(token);

export const unwrap = (result, message = 'Could not load data') => {
  if (!result.error) return result.data;

  const { error } = result;
  if (!error.code) throw createError(503, 'Data service is unavailable');
  if (error.code === 'PGRST116') throw createError(404, message);
  throw createError(400, error.message || message);
};

export const fetchAll = async (client, table, message, order) => {
  const size = 1000;
  const rows = [];
  let from = 0;

  for (;;) {
    let query = client.from(table).select('*');
    if (order) query = query.order(order.column, { ascending: order.ascending !== false });
    const batch = unwrap(await query.range(from, from + size - 1), message);
    rows.push(...batch);
    if (batch.length < size) break;
    from += size;
    if (from >= 20000) break;
  }

  return rows;
};
