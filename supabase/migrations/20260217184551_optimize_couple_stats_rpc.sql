-- ============================================
-- Migration: Optimize scripture_get_couple_stats RPC
-- Created: 2026-02-17
-- Purpose: Combine 4 separate sequential queries into CTE-based approach
-- Story: 3.1 Review Round 2 — M1 (RPC performance)
-- ============================================

begin;

create or replace function public.scripture_get_couple_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_partner_id uuid;
  v_result jsonb;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select u.partner_id into v_partner_id
  from public.users u
  where u.id = v_user_id;

  -- Single CTE-based query: filter completed couple sessions once,
  -- then aggregate all 5 metrics in parallel sub-selects
  with couple_sessions as (
    select s.id, s.current_step_index, s.completed_at
    from public.scripture_sessions s
    where s.status = 'complete'
      and (
        s.user1_id in (v_user_id, v_partner_id)
        or s.user2_id in (v_user_id, v_partner_id)
      )
  )
  select jsonb_build_object(
    'totalSessions', (select count(*) from couple_sessions),
    'totalSteps', (select coalesce(sum(current_step_index + 1), 0) from couple_sessions),
    'lastCompleted', (select max(completed_at) from couple_sessions),
    'avgRating', (
      select coalesce(round(avg(r.rating), 2), 0)
      from public.scripture_reflections r
      where r.session_id in (select id from couple_sessions)
        and r.rating is not null
    ),
    'bookmarkCount', (
      select count(*)
      from public.scripture_bookmarks b
      where b.session_id in (select id from couple_sessions)
    )
  ) into v_result;

  return v_result;
end;
$$;

commit;
