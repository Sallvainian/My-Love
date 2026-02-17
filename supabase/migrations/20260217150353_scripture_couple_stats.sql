-- ============================================
-- Migration: Scripture Couple Stats RPC
-- Created: 2026-02-17
-- Purpose: Add RPC function for couple-aggregate scripture reading stats
-- Story: 3.1 — Couple-Aggregate Stats Dashboard (AC #1, #4)
-- ============================================

begin;

-- ============================================
-- 1. Add index on scripture_sessions(status) for efficient filtered counts
-- ============================================
create index if not exists idx_scripture_sessions_status
  on public.scripture_sessions (status);

-- ============================================
-- 2. Create scripture_get_couple_stats RPC
--
-- Returns couple-aggregate stats for the authenticated user's couple:
--   totalSessions  — count of sessions with status='complete'
--   totalSteps     — sum of completed step states across all complete sessions
--   lastCompleted  — most recent completed_at timestamp
--   avgRating      — mean reflection rating across both partners
--   bookmarkCount  — total bookmarks across both partners
--
-- SECURITY DEFINER: Required because reflections/bookmarks RLS restricts
-- visibility to own + shared partner data, but stats need ALL couple data
-- regardless of sharing flags. Auth validated via auth.uid() checks internally.
-- ============================================
create or replace function public.scripture_get_couple_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_partner_id uuid;
  v_total_sessions bigint;
  v_total_steps bigint;
  v_last_completed timestamptz;
  v_avg_rating numeric;
  v_bookmark_count bigint;
begin
  v_user_id := (select auth.uid());

  -- Validate authenticated user
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get partner ID from users table
  select u.partner_id into v_partner_id
  from public.users u
  where u.id = v_user_id;

  -- Count completed sessions for the couple
  -- Matches sessions where either partner is user1 or user2
  select
    count(*),
    max(s.completed_at)
  into v_total_sessions, v_last_completed
  from public.scripture_sessions s
  where s.status = 'complete'
    and (
      s.user1_id in (v_user_id, v_partner_id)
      or s.user2_id in (v_user_id, v_partner_id)
    );

  -- Sum total completed steps across all completed couple sessions
  -- current_step_index is 0-based, so steps completed = index + 1
  select coalesce(sum(s.current_step_index + 1), 0)
  into v_total_steps
  from public.scripture_sessions s
  where s.status = 'complete'
    and (
      s.user1_id in (v_user_id, v_partner_id)
      or s.user2_id in (v_user_id, v_partner_id)
    );

  -- Average reflection rating across both partners in completed sessions
  select avg(r.rating)
  into v_avg_rating
  from public.scripture_reflections r
  join public.scripture_sessions s on r.session_id = s.id
  where s.status = 'complete'
    and (
      s.user1_id in (v_user_id, v_partner_id)
      or s.user2_id in (v_user_id, v_partner_id)
    )
    and r.rating is not null;

  -- Total bookmark count across both partners in completed sessions
  select count(*)
  into v_bookmark_count
  from public.scripture_bookmarks b
  join public.scripture_sessions s on b.session_id = s.id
  where s.status = 'complete'
    and (
      s.user1_id in (v_user_id, v_partner_id)
      or s.user2_id in (v_user_id, v_partner_id)
    );

  return jsonb_build_object(
    'totalSessions', coalesce(v_total_sessions, 0),
    'totalSteps', coalesce(v_total_steps, 0),
    'lastCompleted', v_last_completed,
    'avgRating', coalesce(round(v_avg_rating, 2), 0),
    'bookmarkCount', coalesce(v_bookmark_count, 0)
  );
end;
$$;

comment on function public.scripture_get_couple_stats() is
  'Returns couple-aggregate scripture reading stats (sessions, steps, last completed, avg rating, bookmarks) for the authenticated user and their partner.';

-- Grant execute permission to authenticated role
grant execute on function public.scripture_get_couple_stats() to authenticated;

commit;
