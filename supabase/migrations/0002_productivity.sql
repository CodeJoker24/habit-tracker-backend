create extension if not exists pgcrypto;

do $$
declare
  tbl text;
  row_count bigint;
begin
  foreach tbl in array array['habit_completions', 'timer_sessions', 'tasks', 'habits'] loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
        and table_type = 'BASE TABLE'
    ) then
      execute format('select count(*) from public.%I', tbl) into row_count;
      if row_count = 0 then
        execute format('drop table public.%I cascade', tbl);
      else
        raise exception 'Refusing to replace public.% because it contains % rows', tbl, row_count;
      end if;
    end if;
  end loop;
end $$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  target integer not null default 1 check (target between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

create table public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 1 and 240),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_at);
create index if not exists tasks_user_completed_idx on public.tasks (user_id, completed_at desc);
create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists habit_completions_user_date_idx on public.habit_completions (user_id, completed_on desc);
create index if not exists timer_sessions_user_idx on public.timer_sessions (user_id, ended_at desc);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at before update on public.habits
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.timer_sessions enable row level security;

drop policy if exists "Tasks owner access" on public.tasks;
create policy "Tasks owner access" on public.tasks for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Habits owner access" on public.habits;
create policy "Habits owner access" on public.habits for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Habit completions owner access" on public.habit_completions;
create policy "Habit completions owner access" on public.habit_completions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Timer sessions owner access" on public.timer_sessions;
create policy "Timer sessions owner access" on public.timer_sessions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on public.tasks, public.habits, public.habit_completions, public.timer_sessions to authenticated;
