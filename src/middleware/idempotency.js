import { createUserClient } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const mutations = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const idempotency = asyncHandler(async (req, res, next) => {
  const operationId = req.get('X-Operation-Id');
  if (!mutations.has(req.method) || !operationId || operationId.length > 200) return next();

  const client = createUserClient(req.auth.token);
  const receipt = await client
    .from('operation_receipts')
    .select('result')
    .eq('operation_id', operationId)
    .maybeSingle();

  if (receipt.data) {
    res.set('X-Idempotent-Replay', 'true');
    return res.json(receipt.data.result);
  }

  let body = null;
  const originalJson = res.json.bind(res);
  res.json = (value) => {
    body = value;
    return originalJson(value);
  };

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !body) return;
    client.from('operation_receipts').insert({ operation_id: operationId, result: body }).then(() => null);
  });

  return next();
});
