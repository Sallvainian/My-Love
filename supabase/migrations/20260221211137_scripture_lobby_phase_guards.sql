-- ============================================
-- Migration: Lobby Phase Guards for Scripture RPCs
-- Created: 2026-02-21
-- Purpose: Add lobby-phase guards to scripture_select_role, scripture_toggle_ready,
--          and scripture_convert_to_solo to prevent out-of-phase mutations.
--          Without guards, calling these RPCs from reading/countdown/etc. can rewind
--          an active session back to lobby state, corrupting the session lifecycle.
-- Story: 4-1 — Review Follow-ups (AI) [HIGH]
-- Affected RPCs: scripture_select_role, scripture_toggle_ready, scripture_convert_to_solo
-- ============================================

BEGIN;

-- ============================================
-- 1. scripture_select_role (replace with phase guard)
--
-- Guard added: raises exception if current_phase != 'lobby'
-- Prevents rewinding active (reading/countdown/reflection) sessions to lobby.
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

  -- Guard: only allow role selection in lobby phase.
  -- Prevents callers from rewinding active sessions (reading/countdown/reflection)
  -- back to lobby phase by setting current_phase = 'lobby'.
  if v_session.current_phase != 'lobby' then
    raise exception
      'Cannot select role: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
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

comment on function public.scripture_select_role is
  'Story 4.1: Sets the calling user role (reader/responder) on a scripture session. Requires lobby phase. Broadcasts state_updated.';

-- ============================================
-- 2. scripture_toggle_ready (replace with phase guard)
--
-- Guard added: raises exception if current_phase != 'lobby'
-- Prevents out-of-phase countdown initiation (e.g., if called during reading phase).
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

  -- Guard: only allow ready toggling in lobby phase.
  -- Prevents triggering countdown or mutating ready flags outside the lobby.
  if v_session.current_phase != 'lobby' then
    raise exception
      'Cannot toggle ready state: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
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

comment on function public.scripture_toggle_ready is
  'Story 4.1: Toggles ready state for calling user. Requires lobby phase. Starts countdown when both ready.';

-- ============================================
-- 3. scripture_convert_to_solo (replace with phase guard)
--
-- Guard added: raises exception if current_phase != 'lobby'
-- "Continue solo" is a lobby action only — prevents conversion after reading starts.
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

  -- Guard: only allow conversion in lobby phase.
  -- "Continue solo" is a lobby-only action; once reading begins, session conversion
  -- should not be possible through this RPC.
  if v_session.current_phase != 'lobby' then
    raise exception
      'Cannot convert to solo: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
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

comment on function public.scripture_convert_to_solo is
  'Story 4.1: Converts a together-mode lobby session to solo mode. Requires lobby phase. Broadcasts session_converted.';

COMMIT;
