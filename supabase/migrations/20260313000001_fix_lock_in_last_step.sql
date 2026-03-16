-- Fix: scripture_lock_in should NOT set status='complete' on last step.
-- Session stays 'in_progress' through reflection/report phases.
-- Only markSessionComplete (client-side) sets status='complete' after the report phase.

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
      -- Last step (step 16): transition to reflection phase.
      -- Status stays 'in_progress' — completion happens after the report phase
      -- via markSessionComplete on the client.
      UPDATE public.scripture_sessions
        SET current_phase = 'reflection',
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
  'Locks in a user for the current step. Advances when both locked. Last step transitions to reflection but keeps status=in_progress. Client broadcasts state_updated or lock_in_status_changed.';
