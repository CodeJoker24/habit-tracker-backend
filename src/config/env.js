import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const required = (name, value) => {
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? '';
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  supabase: {
    url: required('SUPABASE_URL', process.env.SUPABASE_URL),
    anonKey: required('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
  database: {
    url: required('DATABASE_URL', process.env.DATABASE_URL),
    directUrl: process.env.DIRECT_DATABASE_URL || '',
  },
  redisUrl: process.env.REDIS_URL || '',
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export const allowedOrigins = config.clientUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
