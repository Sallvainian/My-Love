-- ============================================
-- Migration: Remove server-side realtime.send() broadcasts
-- Created: 2026-03-01
-- Purpose: Remove PERFORM realtime.send() calls from all scripture RPCs.
--          Server-side realtime.send() inserts into realtime.messages, but
--          the local Supabase Docker Realtime service has no replication slot
--          to deliver those messages to WebSocket clients.
--          Client-side broadcasts via channel.send() go directly through
--          WebSocket and work reliably. After this migration, the Zustand
--          slice actions broadcast state updates via channel.send() after
--          each RPC succeeds.
-- Affected RPCs:
--   scripture_select_role       (was in 20260221211137)
--   scripture_toggle_ready      (was in 20260221211137)
--   scripture_convert_to_solo   (was in 20260221211137)
--   scripture_lock_in           (was in 20260222000001)
--   scripture_undo_lock_in      (was in 20260222000001)
--   scripture_end_session       (was in 20260228000001)
-- ============================================

BEGIN;

-- ============================================
-- 1. scripture_select_role — remove realtime.send()
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_select_role(
  p_session_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_snapshot jsonb;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate role value
  IF p_role NOT IN ('reader', 'responder') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be reader or responder', p_role;
  END IF;

  -- Load and lock the session row
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Guard: only allow role selection in lobby phase.
  IF v_session.current_phase != 'lobby' THEN
    RAISE EXCEPTION
      'Cannot select role: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
  END IF;

  -- Update the correct user's role and bump version
  IF v_session.user1_id = v_user_id THEN
    UPDATE public.scripture_sessions
      SET user1_role = p_role::public.scripture_session_role,
          current_phase = 'lobby',
          version = version + 1
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  ELSE
    UPDATE public.scripture_sessions
      SET user2_role = p_role::public.scripture_session_role,
          current_phase = 'lobby',
          version = version + 1
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  END IF;

  -- Build snapshot for return (client will broadcast this)
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

  RETURN v_snapshot;
END;
$$;

COMMENT ON FUNCTION public.scripture_select_role IS
  'Story 4.1: Sets the calling user role (reader/responder) on a scripture session. Requires lobby phase. Client broadcasts state_updated.';

-- ============================================
-- 2. scripture_toggle_ready — remove realtime.send()
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_toggle_ready(
  p_session_id uuid,
  p_is_ready boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_both_ready boolean;
  v_snapshot jsonb;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load and lock the session row
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Guard: only allow ready toggling in lobby phase.
  IF v_session.current_phase != 'lobby' THEN
    RAISE EXCEPTION
      'Cannot toggle ready state: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
  END IF;

  -- Update the correct user's ready flag
  IF v_session.user1_id = v_user_id THEN
    UPDATE public.scripture_sessions
      SET user1_ready = p_is_ready,
          version = version + 1
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  ELSE
    UPDATE public.scripture_sessions
      SET user2_ready = p_is_ready,
          version = version + 1
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  END IF;

  -- Check if both users are now ready
  v_both_ready := v_session.user1_ready
    AND v_session.user2_ready
    AND v_session.user2_id IS NOT NULL;

  -- If both ready and countdown not yet started, start countdown
  IF v_both_ready AND v_session.countdown_started_at IS NULL THEN
    UPDATE public.scripture_sessions
      SET countdown_started_at = now(),
          current_phase = 'countdown',
          version = version + 1
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  END IF;

  -- Build snapshot for return (client will broadcast this)
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

  RETURN v_snapshot;
END;
$$;

COMMENT ON FUNCTION public.scripture_toggle_ready IS
  'Story 4.1: Toggles ready state for calling user. Requires lobby phase. Starts countdown when both ready. Client broadcasts state_updated.';

-- ============================================
-- 3. scripture_convert_to_solo — remove realtime.send()
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_convert_to_solo(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_session public.scripture_sessions;
  v_snapshot jsonb;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load and lock the session row (only user1 or user2 can convert)
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Guard: only allow conversion in lobby phase.
  IF v_session.current_phase != 'lobby' THEN
    RAISE EXCEPTION
      'Cannot convert to solo: session is not in lobby phase (current phase: %)',
      v_session.current_phase;
  END IF;

  -- Convert to solo: clear partner state, reset lobby fields, move to reading
  UPDATE public.scripture_sessions
    SET mode = 'solo',
        user2_id = null,
        user1_ready = false,
        user2_ready = false,
        countdown_started_at = null,
        current_phase = 'reading',
        status = 'in_progress',
        version = version + 1
    WHERE id = p_session_id
    RETURNING * INTO v_session;

  -- Build snapshot for return (client will broadcast session_converted)
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'mode', v_session.mode,
    'currentPhase', v_session.current_phase,
    'version', v_session.version
  );

  RETURN v_snapshot;
END;
$$;

COMMENT ON FUNCTION public.scripture_convert_to_solo IS
  'Story 4.1: Converts a together-mode lobby session to solo mode. Requires lobby phase. Client broadcasts session_converted.';

-- ============================================
-- 4. scripture_lock_in — remove realtime.send() calls
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_lock_in(
  p_session_id UUID,
  p_step_index INT,
  p_expected_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_session public.scripture_sessions;
  v_step_state public.scripture_step_states;
  v_is_user1 BOOLEAN;
  v_both_locked BOOLEAN;
  v_snapshot JSONB;
  v_lock_payload JSONB;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load and lock the session row
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Phase guard: only allow lock-in during reading phase
  -- Also accept 'countdown' because the DB stays in countdown until the first
  -- lock-in arrives (the countdown->reading transition is client-side only).
  IF v_session.current_phase NOT IN ('reading', 'countdown') THEN
    RAISE EXCEPTION 'Cannot lock in: session is not in reading phase (current phase: %)', v_session.current_phase;
  END IF;

  -- If session is still in countdown phase, transition it to reading now.
  -- No version bump — this is a housekeeping transition, not a user action.
  IF v_session.current_phase = 'countdown' THEN
    UPDATE public.scripture_sessions
      SET current_phase = 'reading'
      WHERE id = p_session_id
      RETURNING * INTO v_session;
  END IF;

  -- Step guard: ensure caller is locking the current step
  IF v_session.current_step_index != p_step_index THEN
    RAISE EXCEPTION 'Cannot lock in: step mismatch (current: %, requested: %)', v_session.current_step_index, p_step_index;
  END IF;

  -- Version check: optimistic concurrency
  IF v_session.version != p_expected_version THEN
    RAISE EXCEPTION '409: version mismatch';
  END IF;

  -- Determine if caller is user1
  v_is_user1 := (v_session.user1_id = v_user_id);

  -- Idempotent UPSERT: set caller's lock timestamp
  IF v_is_user1 THEN
    INSERT INTO public.scripture_step_states (session_id, step_index, user1_locked_at)
      VALUES (p_session_id, p_step_index, now())
      ON CONFLICT (session_id, step_index)
      DO UPDATE SET user1_locked_at = now();
  ELSE
    INSERT INTO public.scripture_step_states (session_id, step_index, user2_locked_at)
      VALUES (p_session_id, p_step_index, now())
      ON CONFLICT (session_id, step_index)
      DO UPDATE SET user2_locked_at = now();
  END IF;

  -- Re-read the step state to check both locks
  SELECT * INTO v_step_state
    FROM public.scripture_step_states
    WHERE session_id = p_session_id
      AND step_index = p_step_index;

  v_both_locked := (v_step_state.user1_locked_at IS NOT NULL AND v_step_state.user2_locked_at IS NOT NULL);

  IF v_both_locked THEN
    -- Mark step as advanced
    UPDATE public.scripture_step_states
      SET advanced_at = now()
      WHERE session_id = p_session_id
        AND step_index = p_step_index;

    IF p_step_index < 16 THEN
      -- Normal advance: increment step
      UPDATE public.scripture_sessions
        SET current_step_index = p_step_index + 1,
            version = version + 1,
            snapshot_json = jsonb_build_object(
              'currentStepIndex', p_step_index + 1,
              'currentPhase', 'reading',
              'version', version + 1
            )
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    ELSE
      -- Last step (step 16): transition to reflection
      UPDATE public.scripture_sessions
        SET current_phase = 'reflection',
            status = 'complete',
            version = version + 1,
            snapshot_json = jsonb_build_object(
              'currentStepIndex', p_step_index,
              'currentPhase', 'reflection',
              'version', version + 1
            )
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    END IF;

    -- Build state_updated payload (client will broadcast this)
    v_snapshot := jsonb_build_object(
      'sessionId', v_session.id,
      'currentPhase', v_session.current_phase,
      'currentStepIndex', v_session.current_step_index,
      'version', v_session.version,
      'triggered_by', 'lock_in',
      'both_locked', true
    );
  ELSE
    -- Partial lock: build lock_in_status_changed payload (client will broadcast this)
    v_lock_payload := jsonb_build_object(
      'step_index', p_step_index,
      'user1_locked', (v_step_state.user1_locked_at IS NOT NULL),
      'user2_locked', (v_step_state.user2_locked_at IS NOT NULL)
    );

    -- Re-read session for return value (no changes to session itself)
    SELECT * INTO v_session
      FROM public.scripture_sessions
      WHERE id = p_session_id;

    -- Build return payload with lock info embedded
    v_snapshot := jsonb_build_object(
      'sessionId', v_session.id,
      'currentPhase', v_session.current_phase,
      'currentStepIndex', v_session.current_step_index,
      'version', v_session.version,
      'both_locked', false,
      'lock_status', v_lock_payload
    );
  END IF;

  -- Return session snapshot with broadcast hints for the client
  RETURN v_snapshot;
END;
$$;

COMMENT ON FUNCTION public.scripture_lock_in IS
  'Story 4.2: Locks in a user for the current step. Advances when both locked. Client broadcasts state_updated or lock_in_status_changed.';

-- ============================================
-- 5. scripture_undo_lock_in — remove realtime.send()
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_undo_lock_in(
  p_session_id UUID,
  p_step_index INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_session public.scripture_sessions;
  v_step_state public.scripture_step_states;
  v_is_user1 BOOLEAN;
  v_lock_payload JSONB;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load and lock the session row
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Phase guard: only allow undo during reading phase (or countdown)
  IF v_session.current_phase NOT IN ('reading', 'countdown') THEN
    RAISE EXCEPTION 'Cannot undo lock-in: session is not in reading phase (current phase: %)', v_session.current_phase;
  END IF;

  v_is_user1 := (v_session.user1_id = v_user_id);

  -- Clear caller's lock timestamp
  IF v_is_user1 THEN
    UPDATE public.scripture_step_states
      SET user1_locked_at = NULL
      WHERE session_id = p_session_id
        AND step_index = p_step_index;
  ELSE
    UPDATE public.scripture_step_states
      SET user2_locked_at = NULL
      WHERE session_id = p_session_id
        AND step_index = p_step_index;
  END IF;

  -- Re-read step state for return payload
  SELECT * INTO v_step_state
    FROM public.scripture_step_states
    WHERE session_id = p_session_id
      AND step_index = p_step_index;

  -- Build lock_in_status_changed payload (client will broadcast this)
  v_lock_payload := jsonb_build_object(
    'step_index', p_step_index,
    'user1_locked', (v_step_state.user1_locked_at IS NOT NULL),
    'user2_locked', (v_step_state.user2_locked_at IS NOT NULL)
  );

  -- Return session snapshot with lock status for client-side broadcast
  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', v_session.current_phase,
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version,
    'lock_status', v_lock_payload
  );
END;
$$;

COMMENT ON FUNCTION public.scripture_undo_lock_in IS
  'Story 4.2: Clears a user lock-in for the given step. Client broadcasts lock_in_status_changed.';

-- ============================================
-- 6. scripture_end_session — remove realtime.send()
-- ============================================

CREATE OR REPLACE FUNCTION public.scripture_end_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_session public.scripture_sessions;
  v_snapshot JSONB;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load and lock the session row
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or access denied: %', p_session_id;
  END IF;

  -- Status guard: only allow ending in_progress sessions
  IF v_session.status != 'in_progress' THEN
    RAISE EXCEPTION 'Cannot end session: status is not in_progress (current: %)', v_session.status;
  END IF;

  -- Update session: ended_early status, set completed_at, bump version
  UPDATE public.scripture_sessions
    SET status = 'ended_early',
        completed_at = now(),
        version = version + 1,
        snapshot_json = jsonb_build_object(
          'currentStepIndex', current_step_index,
          'currentPhase', 'complete',
          'version', version + 1,
          'triggeredBy', 'end_session'
        )
    WHERE id = p_session_id
    RETURNING * INTO v_session;

  -- Build return payload (client will broadcast state_updated)
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', 'complete',
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version,
    'triggered_by', 'end_session'
  );

  RETURN v_snapshot;
END;
$$;

COMMENT ON FUNCTION public.scripture_end_session IS
  'Story 4.3: Ends a together-mode session early. Sets status to ended_early. Client broadcasts state_updated with complete phase.';

COMMIT;
