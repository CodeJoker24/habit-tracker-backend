create extension if not exists pgcrypto;

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  total_tasks_completed integer not null default 0,
  total_habit_completions integer not null default 0,
  total_focus_minutes integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_level integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null default 'spark',
  xp_reward integer not null default 0 check (xp_reward >= 0)
);

create table if not exists public.user_badges (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.badges (code, name, description, icon, xp_reward)
values
  ('first_task', 'First Steps', 'Complete your first task.', 'tasks', 10),
  ('task_ten', 'Task Finisher', 'Complete ten tasks.', 'tasks', 25),
  ('habit_starter', 'Habit Starter', 'Record your first habit completion.', 'habits', 15),
  ('streak_seven', 'Seven Strong', 'Reach a seven-day habit streak.', 'spark', 40),
  ('focus_sixty', 'Focus Hour', 'Accumulate sixty focus minutes.', 'timer', 30),
  ('focus_three_hundred', 'Deep Worker', 'Accumulate five hours of focus.', 'timer', 75),
  ('level_five', 'Rising Star', 'Reach level five.', 'spark', 50)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  xp_reward = excluded.xp_reward;

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists user_badges_user_idx on public.user_badges (user_id);

drop trigger if exists user_stats_set_updated_at on public.user_stats;
create trigger user_stats_set_updated_at before update on public.user_stats
for each row execute function public.set_updated_at();

create or replace function public.handle_new_gamification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_stats (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_gamification on auth.users;
create trigger on_auth_user_gamification
after insert on auth.users
for each row execute function public.handle_new_gamification();

insert into public.user_stats (user_id)
select id from auth.users
on conflict do nothing;

alter table public.user_stats enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users read own stats" on public.user_stats;
create policy "Users read own stats" on public.user_stats for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users insert own stats" on public.user_stats;
create policy "Users insert own stats" on public.user_stats for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own stats" on public.user_stats;
create policy "Users update own stats" on public.user_stats for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Badges readable by authenticated" on public.badges;
create policy "Badges readable by authenticated" on public.badges for select to authenticated
using (true);

drop policy if exists "Users read own badges" on public.user_badges;
create policy "Users read own badges" on public.user_badges for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users earn own badges" on public.user_badges;
create policy "Users earn own badges" on public.user_badges for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users create own notifications" on public.notifications;
create policy "Users create own notifications" on public.notifications for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.user_stats, public.notifications to authenticated;
grant select on public.badges, public.user_badges to authenticated;
grant insert on public.user_badges to authenticated;

create or replace function public.leaderboard(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rank', ranked.rn,
        'userId', ranked.user_id,
        'name', ranked.name,
        'xp', ranked.xp,
        'level', ranked.level
      )
      order by ranked.rn
    ),
    '[]'::jsonb
  )
  from (
    select
      row_number() over (order by s.xp desc, s.level desc) as rn,
      s.user_id,
      coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Member') as name,
      s.xp,
      s.level
    from public.user_stats s
    join public.profiles p on p.id = s.user_id
    order by s.xp desc, s.level desc
    limit least(greatest(p_limit, 1), 50)
  ) ranked;
$$;

revoke all on function public.leaderboard(integer) from public, anon;
grant execute on function public.leaderboard(integer) to authenticated;
