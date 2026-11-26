create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists date_of_birth date,
  add column if not exists visibility text not null default 'private' check (visibility in ('public', 'private')),
  add column if not exists notification_preferences jsonb not null default '{"badges":true,"levels":true,"reminders":true}'::jsonb,
  add column if not exists favourite_badge_ids uuid[] not null default '{}'::uuid[],
  add column if not exists account_deletion_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-zA-Z0-9_]{3,30}$');
  end if;
end $$;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username)) where username is not null;

drop policy if exists "Profiles readable by owner or admin" on public.profiles;
drop policy if exists "Profile visibility" on public.profiles;
create policy "Profile visibility" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or visibility = 'public');

alter table public.badges
  add column if not exists rarity text not null default 'rare' check (rarity in ('rare', 'very_rare', 'epic', 'legendary')),
  add column if not exists category text not null default 'productivity' check (category in ('productivity', 'task', 'habit', 'streak', 'time_management', 'early_riser', 'night_owl', 'weekly', 'monthly', 'xp', 'improvement', 'special', 'secret', 'long_term')),
  add column if not exists requirement_type text not null default 'stat_threshold' check (requirement_type in ('stat_threshold', 'session_time', 'period', 'manual')),
  add column if not exists requirement_config jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists sort_order integer not null default 0;

update public.badges
set requirement_type = config.rarity_type,
    requirement_config = config.rule,
    rarity = config.rarity,
    category = config.category
from (
  values
    ('first_task', 'stat_threshold'::text, '{"stat":"total_tasks_completed","gte":1}'::jsonb, 'rare'::text, 'task'::text),
    ('task_ten', 'stat_threshold', '{"stat":"total_tasks_completed","gte":10}'::jsonb, 'rare', 'task'),
    ('habit_starter', 'stat_threshold', '{"stat":"total_habit_completions","gte":1}'::jsonb, 'rare', 'habit'),
    ('streak_seven', 'stat_threshold', '{"stat":"current_streak","gte":7}'::jsonb, 'very_rare', 'streak'),
    ('focus_sixty', 'stat_threshold', '{"stat":"total_focus_minutes","gte":60}'::jsonb, 'rare', 'time_management'),
    ('focus_three_hundred', 'stat_threshold', '{"stat":"total_focus_minutes","gte":300}'::jsonb, 'very_rare', 'time_management'),
    ('level_five', 'stat_threshold', '{"stat":"level","gte":5}'::jsonb, 'epic', 'xp')
) as config(code, rarity_type, rule, rarity, category)
where public.badges.code = config.code;

create or replace function public.seed_badge_catalog()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'task_' || n,
    'Task Finisher ' || n,
    'Complete ' || n || ' tasks in total.',
    'tasks',
    case when n <= 20 then 'rare' when n <= 75 then 'very_rare' when n <= 130 then 'epic' else 'legendary' end,
    'task',
    'stat_threshold',
    jsonb_build_object('stat', 'total_tasks_completed', 'gte', n),
    case when n <= 20 then 5 when n <= 75 then 10 when n <= 130 then 20 else 35 end,
    false,
    n
  from generate_series(1, 150) n
  on conflict (code) do nothing;
  inserted := inserted + 150;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'habit_' || n,
    'Habit Keeper ' || n,
    'Record ' || n || ' habit completions.',
    'habits',
    case when n <= 20 then 'rare' when n <= 75 then 'very_rare' when n <= 130 then 'epic' else 'legendary' end,
    'habit',
    'stat_threshold',
    jsonb_build_object('stat', 'total_habit_completions', 'gte', n),
    case when n <= 20 then 5 when n <= 75 then 12 when n <= 130 then 22 else 40 end,
    false,
    n
  from generate_series(1, 150) n
  on conflict (code) do nothing;
  inserted := inserted + 150;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'focus_' || n,
    'Focus Builder ' || n,
    'Accumulate ' || (n * 25) || ' minutes of focus time.',
    'timer',
    case when n <= 20 then 'rare' when n <= 60 then 'very_rare' when n <= 85 then 'epic' else 'legendary' end,
    'time_management',
    'stat_threshold',
    jsonb_build_object('stat', 'total_focus_minutes', 'gte', n * 25),
    case when n <= 20 then 5 when n <= 60 then 15 when n <= 85 then 30 else 50 end,
    false,
    n
  from generate_series(1, 96) n
  on conflict (code) do nothing;
  inserted := inserted + 96;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'streak_' || n,
    'Streak ' || n,
    'Reach a ' || n || '-day habit streak.',
    'spark',
    case when n <= 7 then 'rare' when n <= 30 then 'very_rare' when n <= 75 then 'epic' else 'legendary' end,
    'streak',
    'stat_threshold',
    jsonb_build_object('stat', 'longest_streak', 'gte', n),
    case when n <= 7 then 10 when n <= 30 then 20 when n <= 75 then 35 else 60 end,
    false,
    n
  from generate_series(1, 100) n
  on conflict (code) do nothing;
  inserted := inserted + 100;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'level_' || n,
    'Level ' || n,
    'Reach level ' || n || '.',
    'spark',
    case when n <= 5 then 'rare' when n <= 20 then 'very_rare' when n <= 50 then 'epic' else 'legendary' end,
    'xp',
    'stat_threshold',
    jsonb_build_object('stat', 'level', 'gte', n),
    case when n <= 5 then 10 when n <= 20 then 25 when n <= 50 then 45 else 75 end,
    false,
    n
  from generate_series(2, 100) n
  on conflict (code) do nothing;
  inserted := inserted + 99;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'xp_' || (n * 500),
    'Experience ' || (n * 500),
    'Earn ' || (n * 500) || ' XP.',
    'spark',
    case when n <= 4 then 'rare' when n <= 12 then 'very_rare' when n <= 24 then 'epic' else 'legendary' end,
    'xp',
    'stat_threshold',
    jsonb_build_object('stat', 'xp', 'gte', n * 500),
    case when n <= 4 then 20 when n <= 12 then 40 when n <= 24 then 70 else 100 end,
    false,
    n
  from generate_series(1, 40) n
  on conflict (code) do nothing;
  inserted := inserted + 40;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'weekly_task_' || n,
    'Weekly Starter ' || n,
    'Complete ' || n || ' tasks in a single week.',
    'tasks',
    case when n <= 10 then 'rare' when n <= 30 then 'very_rare' else 'epic' end,
    'weekly',
    'period',
    jsonb_build_object('metric', 'weekly_tasks', 'gte', n),
    15,
    false,
    n
  from generate_series(1, 50) n
  on conflict (code) do nothing;
  inserted := inserted + 50;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'monthly_task_' || n,
    'Monthly Achiever ' || n,
    'Complete ' || n || ' tasks in a single month.',
    'tasks',
    case when n <= 20 then 'rare' when n <= 60 then 'very_rare' else 'epic' end,
    'monthly',
    'period',
    jsonb_build_object('metric', 'monthly_tasks', 'gte', n),
    25,
    false,
    n
  from generate_series(1, 50) n
  on conflict (code) do nothing;
  inserted := inserted + 50;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'early_' || n,
    'Early Riser ' || n,
    'Finish ' || n || ' focus sessions before 9 AM.',
    'spark',
    case when n <= 10 then 'rare' when n <= 35 then 'very_rare' else 'epic' end,
    'early_riser',
    'session_time',
    jsonb_build_object('metric', 'early_sessions', 'gte', n),
    20,
    false,
    n
  from generate_series(1, 50) n
  on conflict (code) do nothing;
  inserted := inserted + 50;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'night_' || n,
    'Night Worker ' || n,
    'Finish ' || n || ' focus sessions after 9 PM.',
    'timer',
    case when n <= 10 then 'rare' when n <= 35 then 'very_rare' else 'epic' end,
    'night_owl',
    'session_time',
    jsonb_build_object('metric', 'late_sessions', 'gte', n),
    20,
    false,
    n
  from generate_series(1, 50) n
  on conflict (code) do nothing;
  inserted := inserted + 50;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  select
    'active_days_' || n,
    'Consistent Days ' || n,
    'Be active on ' || n || ' separate days.',
    'habits',
    case when n <= 30 then 'rare' when n <= 120 then 'very_rare' when n <= 250 then 'epic' else 'legendary' end,
    'long_term',
    'stat_threshold',
    jsonb_build_object('stat', 'active_days', 'gte', n),
    case when n <= 30 then 10 when n <= 120 then 25 when n <= 250 then 45 else 80 end,
    false,
    n
  from generate_series(1, 365) n
  on conflict (code) do nothing;
  inserted := inserted + 365;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden, sort_order)
  values
    ('secret_first_hour', 'First Hour', 'Finish a focus session within an hour of signing up.', 'spark', 'epic', 'secret', 'manual', '{}'::jsonb, 100, true, 1),
    ('secret_night_owl', 'Secret Night Owl', 'Found after many late sessions.', 'timer', 'legendary', 'secret', 'manual', '{}'::jsonb, 250, true, 2),
    ('secret_dedication', 'Hidden Dedication', 'Awarded for exceptional consistency.', 'trophy', 'legendary', 'secret', 'manual', '{}'::jsonb, 300, true, 3),
    ('special_welcome', 'Welcome Aboard', 'Complete your first day in the app.', 'spark', 'rare', 'special', 'manual', '{}'::jsonb, 10, false, 1),
    ('special_perfection', 'Flawless Week', 'Awarded by an administrator for a perfect week.', 'trophy', 'legendary', 'special', 'manual', '{}'::jsonb, 200, false, 2),
    ('improvement_start', 'Better Than Yesterday', 'Awarded by an administrator for clear improvement.', 'spark', 'very_rare', 'improvement', 'manual', '{}'::jsonb, 75, false, 1),
    ('productivity_core', 'Productivity Core', 'Awarded by an administrator for outstanding productivity.', 'trophy', 'epic', 'productivity', 'manual', '{}'::jsonb, 150, false, 1)
  on conflict (code) do nothing;
  inserted := inserted + 7;

  return inserted;
end;
$$;

select public.seed_badge_catalog();

create table if not exists public.achievement_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  operation_id text not null unique,
  xp_delta integer not null default 0,
  awarded_at timestamptz not null default now()
);

create table if not exists public.operation_receipts (
  operation_id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists version integer not null default 1;
alter table public.habits add column if not exists version integer not null default 1;

create or replace function public.increment_version()
returns trigger
language plpgsql
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists tasks_increment_version on public.tasks;
create trigger tasks_increment_version before update on public.tasks
for each row execute function public.increment_version();

drop trigger if exists habits_increment_version on public.habits;
create trigger habits_increment_version before update on public.habits
for each row execute function public.increment_version();

drop policy if exists "Badges readable by authenticated" on public.badges;
create policy "Badges readable by authenticated" on public.badges for select to authenticated
using (
  not is_hidden
  or public.is_admin()
  or exists (
    select 1 from public.user_badges ub
    where ub.badge_id = badges.id and ub.user_id = auth.uid()
  )
);

create index if not exists badges_active_idx on public.badges (is_active, is_hidden, sort_order);
create index if not exists achievement_transactions_user_idx on public.achievement_transactions (user_id, awarded_at desc);
create index if not exists operation_receipts_user_idx on public.operation_receipts (user_id, created_at desc);

alter table public.achievement_transactions enable row level security;
alter table public.operation_receipts enable row level security;

drop policy if exists "Users read own achievement transactions" on public.achievement_transactions;
create policy "Users read own achievement transactions" on public.achievement_transactions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users record own achievements" on public.achievement_transactions;
create policy "Users record own achievements" on public.achievement_transactions for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users read own receipts" on public.operation_receipts;
create policy "Users read own receipts" on public.operation_receipts for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users create own receipts" on public.operation_receipts;
create policy "Users create own receipts" on public.operation_receipts for insert to authenticated
with check (user_id = auth.uid());

grant select, insert on public.achievement_transactions, public.operation_receipts to authenticated;
revoke all on function public.seed_badge_catalog() from public, anon;
grant execute on function public.seed_badge_catalog() to authenticated;

create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  stats_row public.user_stats%rowtype;
begin
  select * into profile_row
  from public.profiles
  where lower(username) = lower(p_username) and visibility = 'public' and is_active;

  if not found then
    return null;
  end if;

  select * into stats_row from public.user_stats where user_id = profile_row.id;

  return jsonb_build_object(
    'username', profile_row.username,
    'fullName', coalesce(nullif(profile_row.full_name, ''), profile_row.username),
    'bio', profile_row.bio,
    'location', profile_row.location,
    'joinedAt', profile_row.created_at,
    'stats', jsonb_build_object(
      'xp', coalesce(stats_row.xp, 0),
      'level', coalesce(stats_row.level, 1),
      'currentStreak', coalesce(stats_row.current_streak, 0),
      'longestStreak', coalesce(stats_row.longest_streak, 0),
      'completedTasks', coalesce(stats_row.total_tasks_completed, 0),
      'habitCompletions', coalesce(stats_row.total_habit_completions, 0),
      'focusMinutes', coalesce(stats_row.total_focus_minutes, 0)
    ),
    'badgeCount', (
      select count(*) from public.user_badges ub
      join public.badges b on b.id = ub.badge_id
      where ub.user_id = profile_row.id and not b.is_hidden
    ),
    'showcase', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'icon', b.icon, 'rarity', b.rarity))
      from public.user_badges show
      join public.badges b on b.id = show.badge_id
      where show.user_id = profile_row.id
        and b.id = any(profile_row.favourite_badge_ids)
        and not b.is_hidden
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_profile(text) from public, anon;
grant execute on function public.get_public_profile(text) to authenticated;

create or replace function public.admin_create_badge(
  p_code text, p_name text, p_description text, p_icon text,
  p_rarity text, p_category text, p_requirement_type text,
  p_requirement_config jsonb, p_xp_reward integer, p_is_hidden boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  insert into public.badges (code, name, description, icon, rarity, category, requirement_type, requirement_config, xp_reward, is_hidden)
  values (p_code, p_name, p_description, p_icon, p_rarity, p_category, p_requirement_type, p_requirement_config, p_xp_reward, p_is_hidden)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.admin_update_badge(
  p_id uuid, p_name text, p_description text, p_icon text,
  p_rarity text, p_category text, p_requirement_type text,
  p_requirement_config jsonb, p_xp_reward integer, p_is_active boolean, p_is_hidden boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.badges
  set name = p_name, description = p_description, icon = p_icon, rarity = p_rarity,
      category = p_category, requirement_type = p_requirement_type,
      requirement_config = p_requirement_config, xp_reward = p_xp_reward,
      is_active = p_is_active, is_hidden = p_is_hidden
  where id = p_id;

  return found;
end;
$$;

create or replace function public.admin_award_badge(p_user_id uuid, p_badge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reward integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select xp_reward into reward from public.badges where id = p_badge_id and is_active;
  if reward is null then
    raise exception 'Badge is not available';
  end if;

  insert into public.user_badges (user_id, badge_id) values (p_user_id, p_badge_id)
  on conflict do nothing;

  insert into public.achievement_transactions (user_id, badge_id, operation_id, xp_delta)
  values (p_user_id, p_badge_id, p_user_id::text || ':' || p_badge_id::text || ':manual', reward)
  on conflict do nothing;

  update public.user_stats
  set xp = coalesce(xp, 0) + reward,
      level = floor((coalesce(xp, 0) + reward) / 100)::integer + 1,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.notifications (user_id, type, title, body)
  select p_user_id, 'badge', 'Badge unlocked: ' || b.name, 'Awarded by an administrator.'
  from public.badges b
  where b.id = p_badge_id;

  return true;
end;
$$;

create or replace function public.admin_search_users(p_search text)
returns table (id uuid, email text, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  select p.id, p.email, p.full_name
  from public.profiles p
  where p.email ilike '%' || coalesce(p_search, '') || '%'
  order by p.email
  limit 10;
end;
$$;

revoke all on function public.admin_create_badge(text, text, text, text, text, text, text, jsonb, integer, boolean) from public, anon;
revoke all on function public.admin_update_badge(uuid, text, text, text, text, text, text, jsonb, integer, boolean, boolean) from public, anon;
revoke all on function public.admin_award_badge(uuid, uuid) from public, anon;
revoke all on function public.admin_search_users(text) from public, anon;
grant execute on function public.admin_create_badge(text, text, text, text, text, text, text, jsonb, integer, boolean) to authenticated;
grant execute on function public.admin_update_badge(uuid, text, text, text, text, text, text, jsonb, integer, boolean, boolean) to authenticated;
grant execute on function public.admin_award_badge(uuid, uuid) to authenticated;
grant execute on function public.admin_search_users(text) to authenticated;
