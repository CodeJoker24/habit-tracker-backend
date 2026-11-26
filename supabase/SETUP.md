# Supabase setup

These steps apply the Phase 2 and Phase 3 schemas and verify the public configuration. Run them on a machine that can reach your Supabase project.

## 1. Apply the migration

In the Supabase dashboard, open **SQL Editor → New query**, paste the entire contents of `migrations/0001_profiles_and_auth.sql`, and run it. The script is idempotent, so it can be run again safely.

It is safe to run with the project's anon key configured; the SQL editor executes as the database owner.

Verify with:

```sql
select tablename, policyname from pg_policies where tablename = 'profiles';
select proname from pg_proc
where proname in ('is_admin', 'admin_summary', 'handle_new_user', 'guard_profile_privileges');
select count(*) from public.profiles;
```

You should see two policies, four functions and a row count.

## 2. Apply the productivity schema

Run `migrations/0002_productivity.sql` in the same SQL editor. It creates `tasks`, `habits`, `habit_completions` and `timer_sessions`, with indexes and owner-only RLS policies. It is also idempotent.

Verify with:

```sql
select tablename from pg_tables
where schemaname = 'public'
and tablename in ('tasks', 'habits', 'habit_completions', 'timer_sessions');
```

You should see four rows.

## 3. Apply the gamification schema

Run `migrations/0004_gamification.sql` in the same SQL editor. It creates `user_stats`, `badges`, `user_badges` and `notifications`, seeds the badge catalog, and exposes the `leaderboard()` RPC to signed-in users only.

Verify with:

```sql
select tablename from pg_tables
where schemaname = 'public'
and tablename in ('user_stats', 'badges', 'user_badges', 'notifications');
```

You should see four rows. Badges are awarded and stats are recalculated automatically when tasks, habits or focus sessions change. You can also force a sync from **Rewards → Sync progress**.

## 4. Promote an administrator

Create the account through the app first, then run:

```sql
update public.profiles
set role = 'admin', is_active = true
where email = 'your@email.com';
```

If `is_active` is false, the dashboard shows "Suspended" and every protected API returns `403`.

The privilege guard allows this because the SQL editor has no browser session. A signed-in ordinary user cannot change their own role.

## 5. Configure Auth URLs

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:5173`
- Redirect URLs:
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`
  - `https://<your-vercel-domain>/**`

Password recovery links point to `${CLIENT_URL}/reset-password`, where `CLIENT_URL` is the first value in the backend `.env`.

In **Authentication → Providers → Email**, decide whether email confirmation is required. If it is enabled, new users must confirm before signing in; otherwise the app signs them in immediately.

## 6. Verify connectivity

From the `backend` directory:

```bash
npm run check:supabase
```

Expected results:

- `Auth service: 200`
- `Profiles table: 200` (an empty array is correct — RLS hides rows from anon)
- `Admin RPC blocks anon: 401` or `403` (a `404` with `PGRST202` means the migration was not applied)

A DNS or TLS error means the environment cannot reach Supabase; the app will report `Authentication service is unavailable` until connectivity is restored.

## 7. Test the app

```bash
npm run dev   # backend
npm run dev   # frontend, in the other terminal
```

Register, sign in, open `/dashboard`, visit `/rewards`, and open `/admin` with the promoted account. On `/timer`, enter any value from 1 to 240 minutes to use a custom session length.

## Later phases

Phase 5+ needs `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API) and `DATABASE_URL` using the transaction pooler on port 6543. Keep both in `backend/.env` only; never put a service-role key in `frontend/`.
