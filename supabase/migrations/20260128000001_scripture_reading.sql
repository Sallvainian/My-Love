-- ============================================
-- Migration: Scripture Reading Tables
-- Created: 2026-01-28
-- Purpose: Create scripture reading feature tables with RLS and seeding RPC
-- Sprint 0: Backend Infrastructure (Part 1 of 3)
-- ============================================

BEGIN;

-- ============================================
-- 1. Create ENUM types for scripture sessions
-- ============================================
CREATE TYPE scripture_session_mode AS ENUM ('solo', 'together');
CREATE TYPE scripture_session_phase AS ENUM ('lobby', 'countdown', 'reading', 'reflection', 'report', 'complete');
CREATE TYPE scripture_session_status AS ENUM ('pending', 'in_progress', 'complete', 'abandoned');

-- ============================================
-- 2. Create scripture_sessions table
-- ============================================
CREATE TABLE IF NOT EXISTS scripture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode scripture_session_mode NOT NULL,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_phase scripture_session_phase NOT NULL DEFAULT 'lobby',
  current_step_index INT NOT NULL DEFAULT 0,
  status scripture_session_status NOT NULL DEFAULT 'pending',
  version INT NOT NULL DEFAULT 1,
  snapshot_json JSONB,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Index for user session lookups
CREATE INDEX IF NOT EXISTS idx_scripture_sessions_user1
  ON scripture_sessions (user1_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scripture_sessions_user2
  ON scripture_sessions (user2_id, started_at DESC);

-- ============================================
-- 3. Create scripture_step_states table
-- ============================================
CREATE TABLE IF NOT EXISTS scripture_step_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scripture_sessions(id) ON DELETE CASCADE NOT NULL,
  step_index INT NOT NULL,
  user1_locked_at TIMESTAMPTZ,
  user2_locked_at TIMESTAMPTZ,
  advanced_at TIMESTAMPTZ,
  UNIQUE (session_id, step_index)
);

-- Index for session step lookups
CREATE INDEX IF NOT EXISTS idx_scripture_step_states_session
  ON scripture_step_states (session_id);

-- ============================================
-- 4. Create scripture_reflections table
-- ============================================
CREATE TABLE IF NOT EXISTS scripture_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scripture_sessions(id) ON DELETE CASCADE NOT NULL,
  step_index INT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (session_id, step_index, user_id)
);

-- Index for session reflection lookups
CREATE INDEX IF NOT EXISTS idx_scripture_reflections_session
  ON scripture_reflections (session_id);

-- ============================================
-- 5. Create scripture_bookmarks table
-- ============================================
CREATE TABLE IF NOT EXISTS scripture_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scripture_sessions(id) ON DELETE CASCADE NOT NULL,
  step_index INT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_with_partner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (session_id, step_index, user_id)
);

-- Index for session bookmark lookups
CREATE INDEX IF NOT EXISTS idx_scripture_bookmarks_session
  ON scripture_bookmarks (session_id);

-- ============================================
-- 6. Create scripture_messages table (Daily Prayer Report)
-- ============================================
CREATE TABLE IF NOT EXISTS scripture_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scripture_sessions(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for session message lookups
CREATE INDEX IF NOT EXISTS idx_scripture_messages_session
  ON scripture_messages (session_id, created_at);

-- ============================================
-- 7. Enable RLS on all tables
-- ============================================
ALTER TABLE scripture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripture_step_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripture_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripture_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripture_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. Helper function for session membership check
-- ============================================
CREATE OR REPLACE FUNCTION is_scripture_session_member(p_session_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM scripture_sessions
    WHERE id = p_session_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 9. RLS Policies for scripture_sessions
-- ============================================

-- Users can view sessions they are part of
CREATE POLICY "scripture_sessions_select" ON scripture_sessions
  FOR SELECT USING (
    user1_id = auth.uid() OR user2_id = auth.uid()
  );

-- Users can create sessions as user1
CREATE POLICY "scripture_sessions_insert" ON scripture_sessions
  FOR INSERT WITH CHECK (
    user1_id = auth.uid()
  );

-- Users can update sessions they are part of
CREATE POLICY "scripture_sessions_update" ON scripture_sessions
  FOR UPDATE USING (
    user1_id = auth.uid() OR user2_id = auth.uid()
  );

-- ============================================
-- 10. RLS Policies for scripture_step_states
-- ============================================

-- Users can view step states for their sessions
CREATE POLICY "scripture_step_states_select" ON scripture_step_states
  FOR SELECT USING (
    is_scripture_session_member(session_id)
  );

-- Users can insert step states for their sessions
CREATE POLICY "scripture_step_states_insert" ON scripture_step_states
  FOR INSERT WITH CHECK (
    is_scripture_session_member(session_id)
  );

-- Users can update step states for their sessions
CREATE POLICY "scripture_step_states_update" ON scripture_step_states
  FOR UPDATE USING (
    is_scripture_session_member(session_id)
  );

-- ============================================
-- 11. RLS Policies for scripture_reflections
-- ============================================

-- Users can view their own reflections and shared partner reflections
CREATE POLICY "scripture_reflections_select" ON scripture_reflections
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      is_shared = true
      AND is_scripture_session_member(session_id)
    )
  );

-- Users can insert their own reflections
CREATE POLICY "scripture_reflections_insert" ON scripture_reflections
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_scripture_session_member(session_id)
  );

-- Users can update their own reflections
CREATE POLICY "scripture_reflections_update" ON scripture_reflections
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- ============================================
-- 12. RLS Policies for scripture_bookmarks
-- ============================================

-- Users can view their own bookmarks and shared partner bookmarks
CREATE POLICY "scripture_bookmarks_select" ON scripture_bookmarks
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      share_with_partner = true
      AND is_scripture_session_member(session_id)
    )
  );

-- Users can insert their own bookmarks
CREATE POLICY "scripture_bookmarks_insert" ON scripture_bookmarks
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_scripture_session_member(session_id)
  );

-- Users can update their own bookmarks
CREATE POLICY "scripture_bookmarks_update" ON scripture_bookmarks
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Users can delete their own bookmarks
CREATE POLICY "scripture_bookmarks_delete" ON scripture_bookmarks
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ============================================
-- 13. RLS Policies for scripture_messages
-- ============================================

-- Users can view messages in their sessions
CREATE POLICY "scripture_messages_select" ON scripture_messages
  FOR SELECT USING (
    is_scripture_session_member(session_id)
  );

-- Users can insert messages in their sessions
CREATE POLICY "scripture_messages_insert" ON scripture_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_scripture_session_member(session_id)
  );

-- ============================================
-- 14. Seeding RPC with environment guard
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

    -- Create reflections if requested
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
        ) RETURNING id INTO v_session_id;
        v_reflection_ids := array_append(v_reflection_ids, v_session_id);
      END LOOP;
    END IF;

    -- Create messages if requested
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
        ) RETURNING id INTO v_session_id;
        v_message_ids := array_append(v_message_ids, v_session_id);
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

-- Grant execute permission to authenticated users (for test environments only)
-- The environment guard inside the function prevents production usage
GRANT EXECUTE ON FUNCTION scripture_seed_test_data TO authenticated;

COMMIT;
