import { checkDatabase } from '../config/database.js';
import { redisReady } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getHealth = asyncHandler(async (req, res) => {
  const database = await checkDatabase();

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      instance: process.env.INSTANCE_ID || String(process.pid),
      services: {
        database: database ? 'connected' : 'unavailable',
        redis: redisReady ? 'connected' : 'unavailable',
        supabase: supabase ? 'configured' : 'unavailable',
      },
    },
  });
});
