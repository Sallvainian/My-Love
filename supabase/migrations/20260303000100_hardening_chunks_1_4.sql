-- Epic 4 Hardening: Chunks 1 & 4 — Auth + SQL fixes
-- Tasks: A1 (end_session INVOKER + current_phase fix), A2 (step boundary constant),
--        A3 (UUID guard on RLS), A4 (clear role columns in convertToSolo)

BEGIN;

-- ============================================
-- A1: Revert scripture_end_session to SECURITY INVOKER
--     Merge current_phase = 'complete' fix from 20260302000100
--     Base: 20260301000200 (INVOKER, v_user_id pattern)
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

  -- Update session: ended_early status, complete phase, set completed_at, bump version
  UPDATE public.scripture_sessions
    SET status = 'ended_early',
        current_phase = 'complete',
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
  'Story 4.3: Ends a together-mode session early. Sets status to ended_early and current_phase to complete. SECURITY INVOKER. Client broadcasts state_updated with complete phase.';

-- ============================================
-- A2: Step boundary constant in scripture_lock_in
--     Base: 20260301000200 (INVOKER, no realtime.send)
--     Adds v_max_step_index CONSTANT INT := 16
--     Re-adds comment from 20260302000200 (dropped by CREATE OR REPLACE)
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
  -- Step boundary: 0-indexed MAX_STEPS - 1. MAX_STEPS = 17 in frontend
  -- (src/components/scripture-reading/constants.ts). Update if step count changes.
  v_max_step_index CONSTANT INT := 16;
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

    IF p_step_index < v_max_step_index THEN
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
      -- Last step: transition to reflection
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
  'Story 4.2: Both-locked step advance. Uses v_max_step_index (16 = MAX_STEPS - 1, 0-indexed) for step boundary. If p_step_index < v_max_step_index, advances to next step. At the last step, transitions to reflection phase. NOTE: v_max_step_index is coupled to MAX_STEPS = 17 in the frontend constants.';

-- ============================================
-- A3: UUID guard on RLS policies for realtime.messages
--     Drop and recreate all 4 policies with regex validation
--     before the ::uuid cast. PostgreSQL gen_random_uuid() always
--     returns lowercase hex, so the regex is lowercase-only.
-- ============================================

-- Session channel policies (from 20260220000001)
DROP POLICY IF EXISTS "scripture_session_members_can_receive_broadcasts" ON realtime.messages;

CREATE POLICY "scripture_session_members_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    topic LIKE 'scripture-session:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scripture_session_members_can_send_broadcasts" ON realtime.messages;

CREATE POLICY "scripture_session_members_can_send_broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    topic LIKE 'scripture-session:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

-- Presence channel policies (from 20260222000001)
DROP POLICY IF EXISTS "scripture_presence_members_can_receive_broadcasts" ON realtime.messages;

CREATE POLICY "scripture_presence_members_can_receive_broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    topic LIKE 'scripture-presence:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scripture_presence_members_can_send_broadcasts" ON realtime.messages;

CREATE POLICY "scripture_presence_members_can_send_broadcasts"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    topic LIKE 'scripture-presence:%'
    AND split_part(topic, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(topic, ':', 2)::uuid IN (
      SELECT id
      FROM public.scripture_sessions
      WHERE user1_id = (SELECT auth.uid())
         OR user2_id = (SELECT auth.uid())
    )
  );

-- ============================================
-- A4: Clear role columns in scripture_convert_to_solo
--     Base: 20260301000200 (INVOKER, no realtime.send)
--     Adds user1_role = NULL, user2_role = NULL to UPDATE SET
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
        user1_role = null,
        user2_role = null,
        user1_ready = false,
        user2_ready = false,
        countdown_started_at = null,
        current_step_index = 0,
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
  'Story 4.1: Converts a together-mode lobby session to solo mode. Clears user2_id, both roles, and lobby fields. Requires lobby phase. Client broadcasts session_converted.';

COMMIT;
