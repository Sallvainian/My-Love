-- ============================================
-- My-Love Backend - Initial Database Schema
-- ============================================
-- Migration: 001_initial_schema
-- Created: 2025-11-15
-- Description: Create users, moods, and interactions tables with Row Level Security
-- Execute in: Supabase Dashboard → SQL Editor

-- ============================================
-- Table: users
-- ============================================
-- Minimal user table leveraging Supabase Auth
-- Each user has a partner_name and device_id for offline sync

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_name TEXT,
  device_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE users IS 'User profiles for the My-Love app (2-user MVP)';
COMMENT ON COLUMN users.id IS 'Foreign key to Supabase Auth users table';
COMMENT ON COLUMN users.partner_name IS 'Display name for partner (not authenticated user name)';
COMMENT ON COLUMN users.device_id IS 'Unique device identifier for offline sync';

-- ============================================
-- Table: moods
-- ============================================
-- Mood tracking with offline-first support

CREATE TABLE IF NOT EXISTS moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood_type TEXT NOT NULL CHECK (mood_type IN ('loved', 'happy', 'content', 'thoughtful', 'grateful')),
  note TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE moods IS 'Mood entries logged by users';
COMMENT ON COLUMN moods.mood_type IS 'Enum: loved, happy, content, thoughtful, grateful';
COMMENT ON COLUMN moods.note IS 'Optional note (max 500 characters)';

-- Index for efficient query by user and date
CREATE INDEX IF NOT EXISTS idx_moods_user_created ON moods(user_id, created_at DESC);

-- ============================================
-- Table: interactions
-- ============================================
-- Poke and kiss interactions between partners

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('poke', 'kiss')),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE interactions IS 'Poke/kiss interactions between partners';
COMMENT ON COLUMN interactions.type IS 'Enum: poke, kiss';
COMMENT ON COLUMN interactions.viewed IS 'Whether recipient has viewed the interaction';

-- Index for efficient query of unviewed interactions
CREATE INDEX IF NOT EXISTS idx_interactions_to_user_viewed ON interactions(to_user_id, viewed);

-- ============================================
-- Row Level Security (RLS) - moods table
-- ============================================
-- Enable RLS to enforce access control at database level

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own moods only
CREATE POLICY "Users can insert own moods" ON moods
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view own and partner moods (simplified for 2-user MVP)
-- In production, would filter by partner relationship
CREATE POLICY "Users can view own and partner moods" ON moods
  FOR SELECT
  USING (true);

-- Policy: Users can update their own moods only
CREATE POLICY "Users can update own moods" ON moods
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own moods only
CREATE POLICY "Users can delete own moods" ON moods
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Row Level Security (RLS) - interactions table
-- ============================================

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert interactions they send
CREATE POLICY "Users can insert interactions" ON interactions
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Policy: Users can view interactions to/from them
CREATE POLICY "Users can view interactions to/from them" ON interactions
  FOR SELECT
  USING (auth.uid() IN (from_user_id, to_user_id));

-- Policy: Users can update interactions sent to them (mark as viewed)
CREATE POLICY "Users can update received interactions" ON interactions
  FOR UPDATE
  USING (auth.uid() = to_user_id);

-- ============================================
-- Row Level Security (RLS) - users table
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all user records (for 2-user MVP)
CREATE POLICY "Users can read all users" ON users
  FOR SELECT
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- Realtime Configuration
-- ============================================
-- Enable Realtime for moods and interactions tables
-- This allows WebSocket subscriptions for live updates
-- NOTE: Must also enable Realtime in Supabase Dashboard → Database → Replication

-- Realtime is enabled via Supabase Dashboard, not SQL
-- After running this migration, go to:
-- 1. Dashboard → Database → Replication
-- 2. Enable Realtime for: moods, interactions
-- 3. Verify supabase_realtime publication includes both tables

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the migration succeeded:

-- Check tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'moods', 'interactions');

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'moods', 'interactions');

-- Check policies exist
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('moods', 'interactions');
