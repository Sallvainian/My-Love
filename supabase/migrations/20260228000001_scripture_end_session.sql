-- ============================================
-- Migration: Scripture End Session RPC
-- Created: 2026-02-28
-- Purpose: Add 'ended_early' status and RPC for clean session termination during together-mode.
--          Called when a user taps "End Session" after partner disconnects.
-- Story: 4-3 — Reconnection & Graceful Degradation
-- ============================================

-- Add 'ended_early' to scripture_session_status enum
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block
ALTER TYPE public.scripture_session_status ADD VALUE IF NOT EXISTS 'ended_early';

-- ============================================
-- 1. RPC: scripture_end_session
--
-- Called when a user ends a together-mode session early (e.g., partner disconnected).
-- Validates caller is user1 or user2.
-- Validates session is in_progress.
-- Sets status = 'ended_early', completed_at = now(), bumps version, updates snapshot_json.
-- Broadcasts 'state_updated' with { currentPhase: 'complete', triggeredBy: 'end_session' }.
-- Returns updated session snapshot.
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

  -- Build broadcast payload
  v_snapshot := jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', 'complete',
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version,
    'triggered_by', 'end_session'
  );

  -- Broadcast state_updated to notify partner
  PERFORM realtime.send(
    'scripture-session:' || p_session_id::text,
    'state_updated',
    v_snapshot,
    true
  );

  -- Return session snapshot
  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'currentPhase', 'complete',
    'currentStepIndex', v_session.current_step_index,
    'version', v_session.version,
    'triggeredBy', 'end_session'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scripture_end_session(UUID) TO authenticated;
COMMENT ON FUNCTION public.scripture_end_session IS
  'Story 4.3: Ends a together-mode session early. Sets status to ended_early, broadcasts state_updated with complete phase.';
