-- ============================================
-- Migration 001: Create Base Schema
-- Created: 2025-12-03
-- Purpose: Create users, moods, love_notes, interactions, partner_requests tables
-- Note: This migration captures the existing remote schema for local development
-- ============================================

BEGIN;

-- ============================================
-- 1. Create users table (must be first - others reference it)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_name TEXT,
  device_id UUID,
  email TEXT,
  display_name TEXT,
  partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own record
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own record
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own record
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Partners can view each other (using auth.uid() comparison to avoid recursion)
-- Note: Partner lookup requires a security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION get_partner_id(user_id UUID)
RETURNS UUID AS $$
  SELECT partner_id FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Partners can view each other"
  ON users FOR SELECT
  USING (
    id = get_partner_id(auth.uid())
  );

-- ============================================
-- 2. Create moods table
-- ============================================
CREATE TYPE mood_type AS ENUM (
  'loved', 'happy', 'content', 'excited', 'thoughtful', 'grateful',
  'sad', 'anxious', 'frustrated', 'angry', 'lonely', 'tired'
);

CREATE TABLE IF NOT EXISTS moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood_type mood_type NOT NULL,
  mood_types mood_type[] DEFAULT NULL,
  note TEXT CHECK (char_length(note) <= 200),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user mood queries
CREATE INDEX IF NOT EXISTS idx_moods_user_created
  ON moods (user_id, created_at DESC);

-- Enable RLS on moods
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

-- Users can view their own moods
CREATE POLICY "Users can view own moods"
  ON moods FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own moods
CREATE POLICY "Users can insert own moods"
  ON moods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own moods
CREATE POLICY "Users can update own moods"
  ON moods FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own moods
CREATE POLICY "Users can delete own moods"
  ON moods FOR DELETE
  USING (auth.uid() = user_id);

-- Partners can view each other's moods
CREATE POLICY "Partners can view partner moods"
  ON moods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.partner_id = moods.user_id
    )
  );

-- ============================================
-- 3. Create love_notes table
-- ============================================
CREATE TABLE IF NOT EXISTS love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for note queries
CREATE INDEX IF NOT EXISTS idx_love_notes_users_created
  ON love_notes (from_user_id, to_user_id, created_at DESC);

-- Enable RLS on love_notes
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes they sent or received
CREATE POLICY "Users can view own notes"
  ON love_notes FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert notes from themselves
CREATE POLICY "Users can insert own notes"
  ON love_notes FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Users can delete notes they sent
CREATE POLICY "Users can delete own notes"
  ON love_notes FOR DELETE
  USING (auth.uid() = from_user_id);

-- ============================================
-- 4. Create interactions table
-- ============================================
CREATE TYPE interaction_type AS ENUM ('poke', 'kiss');

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type interaction_type NOT NULL,
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  viewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for interaction queries
CREATE INDEX IF NOT EXISTS idx_interactions_users
  ON interactions (from_user_id, to_user_id, created_at DESC);

-- Enable RLS on interactions
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Users can view interactions they sent or received
CREATE POLICY "Users can view own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert interactions from themselves
CREATE POLICY "Users can insert own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Users can update interactions they received (mark as viewed)
CREATE POLICY "Users can update received interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = to_user_id);

-- ============================================
-- 5. Create partner_requests table
-- ============================================
CREATE TYPE partner_request_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE IF NOT EXISTS partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status partner_request_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for request queries
CREATE INDEX IF NOT EXISTS idx_partner_requests_users
  ON partner_requests (from_user_id, to_user_id);

-- Enable RLS on partner_requests
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests they sent or received
CREATE POLICY "Users can view own requests"
  ON partner_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert requests from themselves
CREATE POLICY "Users can insert own requests"
  ON partner_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Users can update requests they received
CREATE POLICY "Users can update received requests"
  ON partner_requests FOR UPDATE
  USING (auth.uid() = to_user_id);

-- ============================================
-- 6. Create accept_partner_request function
-- ============================================
CREATE OR REPLACE FUNCTION accept_partner_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_from_user_id UUID;
  v_to_user_id UUID;
BEGIN
  -- Get the request details
  SELECT from_user_id, to_user_id INTO v_from_user_id, v_to_user_id
  FROM partner_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Verify the current user is the recipient
  IF auth.uid() != v_to_user_id THEN
    RAISE EXCEPTION 'Only the recipient can accept the request';
  END IF;

  -- Update both users to be partners
  UPDATE users SET partner_id = v_from_user_id WHERE id = v_to_user_id;
  UPDATE users SET partner_id = v_to_user_id WHERE id = v_from_user_id;

  -- Mark request as accepted
  UPDATE partner_requests SET status = 'accepted', updated_at = now()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
