-- Fix: scripture_end_session should set current_phase = 'complete'
-- The previous version sets status = 'ended_early' and builds snapshot_json
-- with currentPhase: 'complete', but did not update the current_phase column,
-- leaving it with the previous value (e.g., 'reading').

CREATE OR REPLACE FUNCTION public.scripture_end_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.scripture_sessions%ROWTYPE;
  v_snapshot JSONB;
BEGIN
  -- Lock the row to prevent concurrent modifications
  SELECT * INTO v_session
    FROM public.scripture_sessions
    WHERE id = p_session_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
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
  'Story 4.3: Ends a together-mode session early. Sets status to ended_early and current_phase to complete. Client broadcasts state_updated with complete phase.';
