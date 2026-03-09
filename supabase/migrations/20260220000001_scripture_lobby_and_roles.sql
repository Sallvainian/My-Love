-- ============================================
-- Migration: Scripture Lobby, Role Selection & Countdown
-- Created: 2026-02-20
-- Purpose: Add role selection, ready state, and countdown columns to scripture_sessions
--          Add RLS policies for Supabase Realtime private broadcast channel
--          Add RPCs for lobby flow: scripture_select_role, scripture_toggle_ready,
--          scripture_convert_to_solo
-- Story: 4-1 — Lobby, Role Selection & Countdown
-- ============================================

BEGIN;

-- ============================================
-- 1. Create ENUM type for session roles
-- ============================================

-- Reader reads the primary scripture verse; Responder reads the response/psalm
create type public.scripture_session_role as enum ('reader', 'responder');

comment on type public.scripture_session_role is
  'Role a participant takes in a together-mode scripture session';

-- ============================================
-- 2. Add role, ready-state, and countdown columns to scripture_sessions
-- ============================================

-- user1_role and user2_role are set when each user selects their role in the lobby.
-- They are nullable: null until the user selects a role.
alter table public.scripture_sessions
  add column user1_role public.scripture_session_role,
  add column user2_role public.scripture_session_role,
  -- user1_ready and user2_ready track whether each user has toggled "Ready" in the lobby.
  -- DEFAULT false so existing rows are unaffected.
  add column user1_ready boolean not null default false,
  add column user2_ready boolean not null default false,
  -- countdown_started_at is set (server-authoritative) the moment both users are ready.
  -- Both clients drive their local countdown from this timestamp, ensuring sync.
  add column countdown_started_at timestamptz;

comment on column public.scripture_sessions.user1_role is
  'Role selected by user1 (reader or responder); null until selected';
comment on column public.scripture_sessions.user2_role is
  'Role selected by user2 (reader or responder); null until selected';
comment on column public.scripture_sessions.user1_ready is
  'Whether user1 has toggled Ready in the lobby';
comment on column public.scripture_sessions.user2_ready is
  'Whether user2 has toggled Ready in the lobby';
comment on column public.scripture_sessions.countdown_started_at is
  'Server UTC timestamp set when both users are ready; drives synchronized countdown on all clients';

-- ============================================
-- 3. Add index to improve broadcast channel RLS queries
--    (RLS policy below queries scripture_sessions by user2_id)
-- ============================================

create index idx_scripture_sessions_user2_status
  on public.scripture_sessions (user2_id, status)
  where user2_id is not null;

-- ============================================
-- 4. RLS policies for realtime.messages
--    (private broadcast channel: scripture-session:{session_id})
--
-- Note: realtime.messages RLS controls who can send/receive on private channels.
-- Both SELECT (receive) and INSERT (send) policies are required.
-- The topic is 'scripture-session:{uuid}' — we extract the UUID via SPLIT_PART.
-- ============================================

-- SELECT: authenticated users can receive broadcasts on sessions they are a member of
create policy "scripture_session_members_can_receive_broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    topic like 'scripture-session:%'
    and split_part(topic, ':', 2)::uuid in (
      select id
      from public.scripture_sessions
      where user1_id = (select auth.uid())
         or user2_id = (select auth.uid())
    )
  );

-- INSERT: authenticated users can send broadcasts on sessions they are a member of
create policy "scripture_session_members_can_send_broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check (
    topic like 'scripture-session:%'
    and split_part(topic, ':', 2)::uuid in (
      select id
      from public.scripture_sessions
      where user1_id = (select auth.uid())
         or user2_id = (select auth.uid())
    )
  );

-- ============================================
-- 5. RPC: scripture_select_role
--
-- Stores the calling user's role on the session.
-- Determines user1 vs user2 by matching auth.uid() to user1_id.
-- Bumps version for optimistic concurrency.
-- Broadcasts 'state_updated' so the partner's client receives the updated snapshot.
-- Returns the updated session snapshot.
-- ============================================

create or replace function public.scripture_select_role(
  p_session_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_snapshot jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate role value
  if p_role not in ('reader', 'responder') then
    raise exception 'Invalid role: %. Must be reader or responder', p_role;
  end if;

  -- Load and lock the session row
  select * into v_session
    from public.scripture_sessions
    where id = p_session_id
      and (user1_id = v_user_id or user2_id = v_user_id)
    for update;

  if not found then
    raise exception 'Session not found or access denied: %', p_session_id;
  end if;

  -- Update the correct user's role and bump version
  if v_session.user1_id = v_user_id then
    update public.scripture_sessions
      set user1_role = p_role::public.scripture_session_role,
          current_phase = 'lobby',
          version = version + 1
      where id = p_session_id
      returning * into v_session;
  else
    update public.scripture_sessions
      set user2_role = p_role::public.scripture_session_role,
          current_phase = 'lobby',
          version = version + 1
      where id = p_session_id
      returning * into v_session;
  end if;

  -- Build snapshot for broadcast
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', v_session.current_phase,
    'version', v_session.version,
    'user1Role', v_session.user1_role,
    'user2Role', v_session.user2_role,
    'user1Ready', v_session.user1_ready,
    'user2Ready', v_session.user2_ready,
    'countdownStartedAt', extract(epoch from v_session.countdown_started_at) * 1000
  );

  -- Broadcast state update to the session channel
  perform realtime.send(
    'scripture-session:' || p_session_id::text,
    'state_updated',
    v_snapshot,
    true
  );

  return v_snapshot;
end;
$$;

grant execute on function public.scripture_select_role(uuid, text) to authenticated;
comment on function public.scripture_select_role is
  'Story 4.1: Sets the calling user role (reader/responder) on a scripture session and broadcasts state_updated';

-- ============================================
-- 6. RPC: scripture_toggle_ready
--
-- Idempotently sets the calling user's ready flag.
-- If both users are ready after this update:
--   - Sets countdown_started_at = now() (server-authoritative timestamp)
--   - Sets current_phase = 'countdown'
-- Bumps version and broadcasts 'state_updated'.
-- Returns the updated session snapshot.
-- ============================================

create or replace function public.scripture_toggle_ready(
  p_session_id uuid,
  p_is_ready boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_both_ready boolean;
  v_snapshot jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load and lock the session row
  select * into v_session
    from public.scripture_sessions
    where id = p_session_id
      and (user1_id = v_user_id or user2_id = v_user_id)
    for update;

  if not found then
    raise exception 'Session not found or access denied: %', p_session_id;
  end if;

  -- Update the correct user's ready flag
  if v_session.user1_id = v_user_id then
    update public.scripture_sessions
      set user1_ready = p_is_ready,
          version = version + 1
      where id = p_session_id
      returning * into v_session;
  else
    update public.scripture_sessions
      set user2_ready = p_is_ready,
          version = version + 1
      where id = p_session_id
      returning * into v_session;
  end if;

  -- Check if both users are now ready (requires user2_id to be set — solo sessions can't countdown)
  v_both_ready := v_session.user1_ready
    and v_session.user2_ready
    and v_session.user2_id is not null;

  -- If both ready and countdown not yet started, start countdown
  if v_both_ready and v_session.countdown_started_at is null then
    update public.scripture_sessions
      set countdown_started_at = now(),
          current_phase = 'countdown',
          version = version + 1
      where id = p_session_id
      returning * into v_session;
  end if;

  -- Build snapshot for broadcast
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', v_session.current_phase,
    'version', v_session.version,
    'user1Role', v_session.user1_role,
    'user2Role', v_session.user2_role,
    'user1Ready', v_session.user1_ready,
    'user2Ready', v_session.user2_ready,
    'countdownStartedAt', extract(epoch from v_session.countdown_started_at) * 1000
  );

  -- Broadcast state update to the session channel
  perform realtime.send(
    'scripture-session:' || p_session_id::text,
    'state_updated',
    v_snapshot,
    true
  );

  return v_snapshot;
end;
$$;

grant execute on function public.scripture_toggle_ready(uuid, boolean) to authenticated;
comment on function public.scripture_toggle_ready is
  'Story 4.1: Toggles ready state for calling user; starts countdown when both ready';

-- ============================================
-- 7. RPC: scripture_convert_to_solo
--
-- Converts a together-mode session to solo mode.
-- Called when one partner taps "Continue solo" in the lobby.
-- Resets all lobby/partner state, moves to reading phase.
-- Broadcasts 'session_converted' so the partner's client can also update.
-- ============================================

create or replace function public.scripture_convert_to_solo(
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_snapshot jsonb;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load and lock the session row (only user1 or user2 can convert)
  select * into v_session
    from public.scripture_sessions
    where id = p_session_id
      and (user1_id = v_user_id or user2_id = v_user_id)
    for update;

  if not found then
    raise exception 'Session not found or access denied: %', p_session_id;
  end if;

  -- Convert to solo: clear partner state, reset lobby fields, move to reading
  update public.scripture_sessions
    set mode = 'solo',
        user2_id = null,
        user1_ready = false,
        user2_ready = false,
        countdown_started_at = null,
        current_phase = 'reading',
        status = 'in_progress',
        version = version + 1
    where id = p_session_id
    returning * into v_session;

  -- Build snapshot for broadcast to partner
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'mode', v_session.mode,
    'currentPhase', v_session.current_phase,
    'version', v_session.version
  );

  -- Broadcast session conversion to channel before it closes
  perform realtime.send(
    'scripture-session:' || p_session_id::text,
    'session_converted',
    jsonb_build_object(
      'mode', 'solo',
      'sessionId', p_session_id
    ),
    true
  );

  return v_snapshot;
end;
$$;

grant execute on function public.scripture_convert_to_solo(uuid) to authenticated;
comment on function public.scripture_convert_to_solo is
  'Story 4.1: Converts a together-mode lobby session to solo mode and broadcasts session_converted';

COMMIT;
