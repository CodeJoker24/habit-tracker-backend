import pg from 'pg';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = config.database.url
  ? new Pool({
      connectionString: config.database.url,
      ssl: { rejectUnauthorized: false },
      prepare: false,
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : null;

if (!pool) {
  logger.warn('DATABASE_URL is not set; database-backed routes will be unavailable');
}

pool?.on('error', (error) => logger.error('Unexpected database pool error', error));

export async function checkDatabase() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}
