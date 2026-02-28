-- ============================================
-- Migration: Scripture Lock-In RPCs + Presence Channel RLS
-- Created: 2026-02-22
-- Purpose: Add RPCs for lock-in/undo-lock-in during together-mode reading phase.
--          Add RLS policies for presence broadcast channel (scripture-presence:{session_id}).
-- Story: 4-2 — Synchronized Reading with Lock-In
-- ============================================

BEGIN;

-- ============================================
-- 1. RPC: scripture_lock_in
--
-- Called when a user taps "Ready for next verse".
-- Idempotent UPSERT into scripture_step_states — sets caller's lock timestamp.
-- If both users are now locked:
--   - Sets advanced_at on the step state
--   - Advances current_step_index (or transitions to reflection if last step)
--   - Bumps version + updates snapshot_json
--   - Broadcasts 'state_updated' with new step/phase
-- If only one user locked (partial):
--   - Broadcasts 'lock_in_status_changed' with lock booleans
-- Returns the current session row as JSONB.
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
  IF v_session.current_phase != 'reading' THEN
    RAISE EXCEPTION 'Cannot lock in: session is not in reading phase (current phase: %)', v_session.current_phase;
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

    -- Build state_updated payload for reading-phase lock-in advance.
    -- Keep payload focused to phase/step/version state (lobby fields are intentionally omitted).
    v_snapshot := jsonb_build_object(
      'sessionId', v_session.id,
      'currentPhase', v_session.current_phase,
      'currentStepIndex', v_session.current_step_index,
      'version', v_session.version,
      'triggered_by', 'lock_in'
    );

    -- Broadcast state_updated (both locked → advance)
    PERFORM realtime.send(
      'scripture-session:' || p_session_id::text,
      'state_updated',
      v_snapshot,
      true
    );
  ELSE
    -- Partial lock: broadcast lock_in_status_changed
    v_lock_payload := jsonb_build_object(
      'step_index', p_step_index,
      'user1_locked', (v_step_state.user1_locked_at IS NOT NULL),
      'user2_locked', (v_step_state.user2_locked_at IS NOT NULL)
    );

    PERFORM realtime.send(
      'scripture-session:' || p_session_id::text,
      'lock_in_status_changed',
      v_lock_payload,
      true
    );

    -- Re-read session for return value (no changes to session itself)
    SELECT * INTO v_session
      FROM public.scripture_sessions
      WHERE id = p_session_id;
  END IF;

  -- Return session snapshot
  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', v_session.current_phase,
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scripture_lock_in(UUID, INT, INT) TO authenticated;
COMMENT ON FUNCTION public.scripture_lock_in IS
  'Story 4.2: Locks in a user for the current step. Advances when both locked. Broadcasts state_updated or lock_in_status_changed.';

-- ============================================
-- 2. RPC: scripture_undo_lock_in
--
-- Called when a user taps "Tap to undo".
-- Clears the caller's lock timestamp.
-- Broadcasts 'lock_in_status_changed' with updated lock booleans.
-- Returns the current session row.
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

  -- Phase guard: only allow undo during reading phase
  IF v_session.current_phase != 'reading' THEN
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

  -- Re-read step state for broadcast payload
  SELECT * INTO v_step_state
    FROM public.scripture_step_states
    WHERE session_id = p_session_id
      AND step_index = p_step_index;

  -- Broadcast lock_in_status_changed
  v_lock_payload := jsonb_build_object(
    'step_index', p_step_index,
    'user1_locked', (v_step_state.user1_locked_at IS NOT NULL),
    'user2_locked', (v_step_state.user2_locked_at IS NOT NULL)
  );

  PERFORM realtime.send(
    'scripture-session:' || p_session_id::text,
    'lock_in_status_changed',
    v_lock_payload,
    true
  );

  -- Return session snapshot
  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', v_session.current_phase,
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scripture_undo_lock_in(UUID, INT) TO authenticated;
COMMENT ON FUNCTION public.scripture_undo_lock_in IS
  'Story 4.2: Clears a user lock-in for the given step. Broadcasts lock_in_status_changed.';

-- ============================================
-- 3. RLS policies for presence channel
--    (private broadcast channel: scripture-presence:{session_id})
--
-- Follows same pattern as scripture-session:% policies from Story 4.1.
-- ============================================

-- SELECT: authenticated users can receive presence broadcasts on sessions they are a member of
CREATE POLICY "scripture_presence_members_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    topic LIKE 'scripture-presence:%'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

-- INSERT: authenticated users can send presence broadcasts on sessions they are a member of
CREATE POLICY "scripture_presence_members_can_send_broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    topic LIKE 'scripture-presence:%'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

COMMIT;
