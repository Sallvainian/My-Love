-- ============================================
-- Migration: Scripture RPCs & Seed Fix
-- Created: 2026-01-30
-- Purpose: Fix seed RPC variable reuse bug, add scripture_create_session
--          and scripture_submit_reflection RPCs
-- Story: 1-1 Phase 1B (ATDD RED→GREEN)
-- ============================================

BEGIN;

-- ============================================
-- 1. Fix scripture_seed_test_data variable reuse bug
--
-- Bug: RETURNING id INTO v_session_id in the reflections and messages
-- loops overwrites the session_id variable, causing FK violations on
-- subsequent loop iterations.
--
-- Fix: Use separate v_temp_id variables for reflection/message inserts.
-- ============================================
CREATE OR REPLACE FUNCTION scripture_seed_test_data(
  p_session_count INT DEFAULT 1,
  p_include_reflections BOOLEAN DEFAULT false,
  p_include_messages BOOLEAN DEFAULT false,
  p_preset TEXT DEFAULT NULL  -- 'mid_session', 'completed', 'with_help_flags'
)
RETURNS JSONB AS $$
DECLARE
  v_env TEXT;
  v_result JSONB;
  v_session_ids UUID[] := '{}';
  v_reflection_ids UUID[] := '{}';
  v_message_ids UUID[] := '{}';
  v_test_user1_id UUID;
  v_test_user2_id UUID;
  v_session_id UUID;
  v_temp_id UUID;  -- Separate variable for RETURNING in sub-inserts
  v_step_index INT;
  v_current_step INT;
  v_current_phase scripture_session_phase;
  v_status scripture_session_status;
  v_completed_at TIMESTAMPTZ;
  i INT;
  j INT;
BEGIN
  -- Environment guard: reject calls in production
  v_env := current_setting('app.environment', true);
  IF v_env = 'production' THEN
    RAISE EXCEPTION 'Seeding not allowed in production environment';
  END IF;

  -- Get or create test users from existing auth.users
  -- In local dev, we use the first two users found
  SELECT id INTO v_test_user1_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_test_user2_id FROM auth.users WHERE id != v_test_user1_id ORDER BY created_at LIMIT 1;

  -- If no users exist, we cannot seed (requires authenticated users)
  IF v_test_user1_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users. Create test users first.';
  END IF;

  -- Determine session state based on preset
  CASE p_preset
    WHEN 'mid_session' THEN
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := NULL;
    WHEN 'completed' THEN
      v_current_step := 16;
      v_current_phase := 'complete';
      v_status := 'complete';
      v_completed_at := now();
    WHEN 'with_help_flags' THEN
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := NULL;
    ELSE
      -- Default: fresh session
      v_current_step := 0;
      v_current_phase := 'lobby';
      v_status := 'pending';
      v_completed_at := NULL;
  END CASE;

  -- Create sessions
  FOR i IN 1..p_session_count LOOP
    INSERT INTO scripture_sessions (
      mode,
      user1_id,
      user2_id,
      current_phase,
      current_step_index,
      status,
      version,
      snapshot_json,
      started_at,
      completed_at
    ) VALUES (
      CASE WHEN v_test_user2_id IS NOT NULL THEN 'together'::scripture_session_mode ELSE 'solo'::scripture_session_mode END,
      v_test_user1_id,
      v_test_user2_id,
      v_current_phase,
      v_current_step,
      v_status,
      1,
      jsonb_build_object('seeded', true, 'preset', COALESCE(p_preset, 'default')),
      now() - (i || ' hours')::interval,  -- Stagger start times
      v_completed_at
    ) RETURNING id INTO v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);

    -- Create step states for completed steps
    FOR j IN 0..v_current_step LOOP
      INSERT INTO scripture_step_states (
        session_id,
        step_index,
        user1_locked_at,
        user2_locked_at,
        advanced_at
      ) VALUES (
        v_session_id,
        j,
        now() - ((v_current_step - j) || ' minutes')::interval,
        CASE WHEN v_test_user2_id IS NOT NULL THEN now() - ((v_current_step - j) || ' minutes')::interval ELSE NULL END,
        now() - ((v_current_step - j) || ' minutes')::interval
      );
    END LOOP;

    -- Create reflections if requested (uses v_temp_id to avoid overwriting v_session_id)
    IF p_include_reflections THEN
      FOR j IN 0..LEAST(v_current_step, 16) LOOP
        INSERT INTO scripture_reflections (
          session_id,
          step_index,
          user_id,
          rating,
          notes,
          is_shared,
          created_at
        ) VALUES (
          v_session_id,
          j,
          v_test_user1_id,
          (j % 5) + 1,  -- Rotating rating 1-5
          'Test reflection for step ' || j,
          j % 2 = 0,  -- Share every other one
          now() - ((v_current_step - j) || ' minutes')::interval
        ) RETURNING id INTO v_temp_id;
        v_reflection_ids := array_append(v_reflection_ids, v_temp_id);
      END LOOP;
    END IF;

    -- Create messages if requested (uses v_temp_id to avoid overwriting v_session_id)
    IF p_include_messages THEN
      FOR j IN 1..3 LOOP
        INSERT INTO scripture_messages (
          session_id,
          sender_id,
          message,
          created_at
        ) VALUES (
          v_session_id,
          v_test_user1_id,
          'Test prayer message ' || j,
          now() - (j || ' minutes')::interval
        ) RETURNING id INTO v_temp_id;
        v_message_ids := array_append(v_message_ids, v_temp_id);
      END LOOP;
    END IF;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'session_ids', to_jsonb(v_session_ids),
    'session_count', p_session_count,
    'preset', COALESCE(p_preset, 'default'),
    'test_user1_id', v_test_user1_id,
    'test_user2_id', v_test_user2_id
  );

  IF p_include_reflections THEN
    v_result := v_result || jsonb_build_object('reflection_ids', to_jsonb(v_reflection_ids));
  END IF;

  IF p_include_messages THEN
    v_result := v_result || jsonb_build_object('message_ids', to_jsonb(v_message_ids));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Create scripture_create_session RPC
--
-- Creates a new scripture reading session for the authenticated user.
-- Solo mode: user1 only. Together mode: user1 + partner.
-- Returns the full session object as JSONB.
-- ============================================
CREATE OR REPLACE FUNCTION scripture_create_session(
  p_mode TEXT,
  p_partner_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_session_id UUID;
  v_result JSONB;
BEGIN
  -- Validate mode
  IF p_mode NOT IN ('solo', 'together') THEN
    RAISE EXCEPTION 'Invalid mode: %. Must be solo or together.', p_mode;
  END IF;

  -- Validate partner for together mode
  IF p_mode = 'together' AND p_partner_id IS NULL THEN
    RAISE EXCEPTION 'Partner ID is required for together mode.';
  END IF;

  IF p_mode = 'together' THEN
    -- Verify partner exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_partner_id) THEN
      RAISE EXCEPTION 'Partner user not found.';
    END IF;
  END IF;

  -- Create the session
  INSERT INTO scripture_sessions (
    mode,
    user1_id,
    user2_id,
    current_phase,
    current_step_index,
    status,
    version,
    started_at
  ) VALUES (
    p_mode::scripture_session_mode,
    auth.uid(),
    CASE WHEN p_mode = 'together' THEN p_partner_id ELSE NULL END,
    'reading'::scripture_session_phase,
    0,
    'in_progress'::scripture_session_status,
    1,
    now()
  ) RETURNING id INTO v_session_id;

  -- Return the full session object
  SELECT jsonb_build_object(
    'id', s.id,
    'mode', s.mode,
    'user1_id', s.user1_id,
    'user2_id', s.user2_id,
    'current_phase', s.current_phase,
    'current_step_index', s.current_step_index,
    'status', s.status,
    'version', s.version,
    'started_at', s.started_at,
    'completed_at', s.completed_at
  ) INTO v_result
  FROM scripture_sessions s
  WHERE s.id = v_session_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION scripture_create_session TO authenticated;

-- ============================================
-- 3. Create scripture_submit_reflection RPC
--
-- Upserts a reflection for the given session, step, and user.
-- Uses ON CONFLICT to handle idempotent writes.
-- Enforces session membership and user_id = auth.uid().
-- ============================================
CREATE OR REPLACE FUNCTION scripture_submit_reflection(
  p_session_id UUID,
  p_step_index INT,
  p_rating INT,
  p_notes TEXT,
  p_is_shared BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_reflection_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Validate session membership
  IF NOT is_scripture_session_member(p_session_id) THEN
    RAISE EXCEPTION 'User is not a member of this session.';
  END IF;

  -- Validate rating range
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.';
  END IF;

  -- Upsert reflection (insert or update on conflict)
  INSERT INTO scripture_reflections (
    session_id,
    step_index,
    user_id,
    rating,
    notes,
    is_shared,
    created_at
  ) VALUES (
    p_session_id,
    p_step_index,
    v_user_id,
    p_rating,
    p_notes,
    p_is_shared,
    now()
  )
  ON CONFLICT (session_id, step_index, user_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    notes = EXCLUDED.notes,
    is_shared = EXCLUDED.is_shared
  RETURNING id INTO v_reflection_id;

  -- Return the reflection object
  SELECT jsonb_build_object(
    'id', r.id,
    'session_id', r.session_id,
    'step_index', r.step_index,
    'user_id', r.user_id,
    'rating', r.rating,
    'notes', r.notes,
    'is_shared', r.is_shared,
    'created_at', r.created_at
  ) INTO v_result
  FROM scripture_reflections r
  WHERE r.id = v_reflection_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION scripture_submit_reflection TO authenticated;

COMMIT;
