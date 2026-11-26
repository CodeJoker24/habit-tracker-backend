insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar owners can upload" on storage.objects;
create policy "Avatar owners can upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owners can update" on storage.objects;
create policy "Avatar owners can update"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owners can delete" on storage.objects;
create policy "Avatar owners can delete"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Authenticated users can view avatars" on storage.objects;
create policy "Authenticated users can view avatars"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

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
    'avatarUrl', profile_row.avatar_url,
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
