-- ============================================
-- Migration 004: Create Love Notes Table
-- Created: 2025-11-25
-- Purpose: Create love_notes table for real-time messaging feature
-- Epic: 2 - Love Notes Real-Time Messaging
-- Story: 2.0 - Love Notes Database Schema Setup
-- ============================================

BEGIN;

-- ============================================
-- 1. Create love_notes table (AC-2.0.1)
-- ============================================
-- Table for storing instant messages between partners
CREATE TABLE love_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000 AND char_length(content) >= 1),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- Prevent sending messages to yourself
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Add table comment
COMMENT ON TABLE love_notes IS 'Love Notes instant messages between partners. Max 1000 characters per message.';

-- ============================================
-- 2. Create Performance Indexes (AC-2.0.1)
-- ============================================
-- Index for fetching messages TO a user (most common query pattern)
CREATE INDEX idx_love_notes_to_user_created
  ON love_notes (to_user_id, created_at DESC);

-- Index for fetching messages FROM a user
CREATE INDEX idx_love_notes_from_user_created
  ON love_notes (from_user_id, created_at DESC);

-- ============================================
-- 3. Enable Row Level Security (AC-2.0.2, AC-2.0.3)
-- ============================================
-- Enable RLS on the table
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can only view messages they sent or received
CREATE POLICY "Users can view their own messages"
  ON love_notes FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- INSERT policy: Users can only send messages as themselves
CREATE POLICY "Users can insert their own messages"
  ON love_notes FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- ============================================
-- 4. Enable Supabase Realtime (AC-2.0.4)
-- ============================================
-- Set REPLICA IDENTITY FULL for Realtime broadcasting
-- This allows Realtime to send full row data including all columns
ALTER TABLE love_notes REPLICA IDENTITY FULL;

-- Add table to Supabase Realtime publication
-- Note: This enables real-time subscriptions for INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE love_notes;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these queries after migration to verify success:

-- 1. Verify table exists with correct columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'love_notes'
-- ORDER BY ordinal_position;

-- Expected output:
-- id          | uuid                        | NO
-- from_user_id| uuid                        | NO
-- to_user_id  | uuid                        | NO
-- content     | text                        | NO
-- created_at  | timestamp with time zone    | NO

-- 2. Verify indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'love_notes';

-- Expected: idx_love_notes_to_user_created, idx_love_notes_from_user_created

-- 3. Verify RLS is enabled
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'love_notes';

-- Expected: true

-- 4. Verify RLS policies exist
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'love_notes';

-- Expected:
-- Users can view their own messages | SELECT
-- Users can insert their own messages | INSERT

-- 5. Verify Realtime is enabled (REPLICA IDENTITY FULL)
-- SELECT relreplident FROM pg_class WHERE relname = 'love_notes';

-- Expected: 'f' (f = FULL)

-- 6. Verify table is in Realtime publication
-- SELECT * FROM pg_publication_tables WHERE tablename = 'love_notes';

-- Expected: Row showing love_notes in supabase_realtime publication

-- ============================================
-- Testing RLS Policies (Run as authenticated user)
-- ============================================

-- Test 1: INSERT as self (should succeed)
-- INSERT INTO love_notes (from_user_id, to_user_id, content)
-- VALUES (auth.uid(), '<partner_uuid>', 'Test message');

-- Test 2: INSERT as someone else (should fail with RLS violation)
-- INSERT INTO love_notes (from_user_id, to_user_id, content)
-- VALUES ('<other_user_uuid>', '<partner_uuid>', 'Test message');

-- Test 3: SELECT own messages (should return matching rows)
-- SELECT * FROM love_notes
-- WHERE from_user_id = auth.uid() OR to_user_id = auth.uid();

-- Test 4: SELECT all messages (should only return user's messages due to RLS)
-- SELECT * FROM love_notes;
