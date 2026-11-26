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

  select b.xp_reward into reward
  from public.badges b
  where b.id = p_badge_id and b.is_active;

  if reward is null then
    raise exception 'Badge is not available';
  end if;

  if exists (
    select 1 from public.user_badges
    where user_id = p_user_id and badge_id = p_badge_id
  ) then
    return true;
  end if;

  insert into public.user_badges (user_id, badge_id)
  values (p_user_id, p_badge_id);

  insert into public.achievement_transactions (user_id, badge_id, operation_id, xp_delta)
  values (
    p_user_id,
    p_badge_id,
    p_user_id::text || ':' || p_badge_id::text || ':manual',
    reward
  )
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
     or p.full_name ilike '%' || coalesce(p_search, '') || '%'
  order by p.email
  limit 10;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'An administrator cannot delete their own account from the admin panel';
  end if;

  delete from auth.users where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.admin_award_badge(uuid, uuid) from public, anon;
revoke all on function public.admin_search_users(text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_award_badge(uuid, uuid) to authenticated;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

select 'deletion and award functions ready' as status;
