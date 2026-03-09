-- ============================================
-- Migration: Add 'at_reflection' preset to scripture_seed_test_data
-- Created: 2026-03-09
-- Purpose: Allow E2E tests to seed a solo session at the reflection
--          phase (step 16, current_phase='reflection', status='in_progress')
--          with optional bookmarks, eliminating the 17-step UI traversal.
-- ============================================

BEGIN;

-- Drop the old 4-param signature so we don't end up with ambiguous overloads
DROP FUNCTION IF EXISTS scripture_seed_test_data(INT, BOOLEAN, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION scripture_seed_test_data(
  p_session_count INT DEFAULT 1,
  p_include_reflections BOOLEAN DEFAULT false,
  p_include_messages BOOLEAN DEFAULT false,
  p_preset TEXT DEFAULT NULL,  -- 'mid_session', 'completed', 'with_help_flags', 'unlinked', 'at_reflection'
  p_bookmark_steps INT[] DEFAULT NULL  -- step indices for bookmarks (used with 'at_reflection' preset)
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
    WHEN 'unlinked' THEN
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := NULL;
    WHEN 'at_reflection' THEN
      v_current_step := 16;
      v_current_phase := 'reflection';
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
      CASE WHEN p_preset IN ('unlinked', 'at_reflection') THEN 'solo'::scripture_session_mode
           WHEN v_test_user2_id IS NOT NULL THEN 'together'::scripture_session_mode
           ELSE 'solo'::scripture_session_mode END,
      v_test_user1_id,
      CASE WHEN p_preset IN ('unlinked', 'at_reflection') THEN NULL ELSE v_test_user2_id END,
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
        CASE WHEN p_preset IN ('unlinked', 'at_reflection') THEN NULL
             WHEN v_test_user2_id IS NOT NULL THEN now() - ((v_current_step - j) || ' minutes')::interval
             ELSE NULL END,
        CASE WHEN j = 16 AND p_preset = 'at_reflection' THEN NULL
             ELSE now() - ((v_current_step - j) || ' minutes')::interval END
      );
    END LOOP;

    -- Create bookmarks for at_reflection preset when p_bookmark_steps is provided
    IF p_preset = 'at_reflection' AND p_bookmark_steps IS NOT NULL THEN
      DECLARE
        v_bm_step INT;
      BEGIN
        FOREACH v_bm_step IN ARRAY p_bookmark_steps LOOP
          INSERT INTO scripture_bookmarks (
            session_id,
            step_index,
            user_id,
            share_with_partner
          ) VALUES (
            v_session_id,
            v_bm_step,
            v_test_user1_id,
            false
          );
        END LOOP;
      END;
    END IF;

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

COMMIT;
