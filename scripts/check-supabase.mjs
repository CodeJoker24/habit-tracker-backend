import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in backend/.env');
  process.exit(1);
}

const baseHeaders = { apikey: key, Authorization: `Bearer ${key}` };

const check = async (label, path, expected, init = {}) => {
  try {
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...baseHeaders, ...init.headers },
    });
    const body = await response.text();
    const passed = expected.includes(response.status);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: ${response.status} ${body.slice(0, 180)}`);
    return passed;
  } catch (error) {
    console.log(`FAIL ${label}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
    return false;
  }
};

const results = await Promise.all([
  check('Auth service', '/auth/v1/health', [200]),
  check('Profiles table', '/rest/v1/profiles?select=id&limit=1', [200]),
  check('Profile fields (0005)', '/rest/v1/profiles?select=username&limit=1', [200]),
  check('Badge fields (0005)', '/rest/v1/badges?select=rarity&limit=1', [200]),
  check('Record versions (0005)', '/rest/v1/tasks?select=version&limit=1', [200]),
  check(
    'Public profile RPC blocks anon',
    '/rest/v1/rpc/get_public_profile',
    [401, 403],
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"p_username":"test"}' },
  ),
  check(
    'Admin RPC blocks anon',
    '/rest/v1/rpc/admin_summary',
    [401, 403],
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  ),
  check(
    'Badge award RPC blocks anon (0006)',
    '/rest/v1/rpc/admin_award_badge',
    [401, 403],
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"p_user_id":"00000000-0000-0000-0000-000000000000","p_badge_id":"00000000-0000-0000-0000-000000000000"}' },
  ),
  check(
    'User search RPC blocks anon (0006)',
    '/rest/v1/rpc/admin_search_users',
    [401, 403],
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"p_search":"test"}' },
  ),
  check(
    'Deletion RPC blocks anon (0006)',
    '/rest/v1/rpc/admin_delete_user',
    [401, 403],
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"p_user_id":"00000000-0000-0000-0000-000000000000"}' },
  ),
]);

process.exitCode = results.every(Boolean) ? 0 : 1;
