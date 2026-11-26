import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';
import { createError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

const createClientSafely = (url, key, label) => {
  if (!url || !key) {
    logger.warn(`${label} is not configured`);
    return null;
  }
  return createClient(url, key, clientOptions);
};

export const supabase = createClientSafely(
  config.supabase.url,
  config.supabase.anonKey,
  'Supabase anon client',
);

export const supabaseAdmin = createClientSafely(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  'Supabase service-role client',
);

export const createUserClient = (token) => {
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw createError(503, 'Authentication service is not configured');
  }
  return createClient(config.supabase.url, config.supabase.anonKey, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};
