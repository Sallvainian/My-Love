-- ============================================
-- Migration: Push Notifications & Daily Messages Schema
-- Created: 2025-12-07
-- Story: 3.0 - Push Notification & Daily Messages Schema Setup
-- Purpose: Create tables for push subscriptions, daily love messages, and in-app notifications
-- ============================================

BEGIN;

-- ============================================
-- 1. Create push_subscriptions table (AC: #1, #2)
-- ============================================
-- Stores Web Push API subscription data for each user's devices
-- Used by Edge Functions to send push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,           -- Push service endpoint URL
  p256dh TEXT NOT NULL,             -- Public key for push encryption (ECDH P-256)
  auth TEXT NOT NULL,               -- Auth secret for push encryption
  device_info JSONB DEFAULT '{}',   -- Optional device metadata (browser, OS, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,         -- Track when subscription was last used to send

  -- One subscription per device per user (AC: #2)
  CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE(user_id, endpoint)
);

-- Indexes for push_subscriptions (Task 2.3)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions(endpoint);

-- Enable RLS on push_subscriptions (Task 2.7)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own subscriptions (Task 2.8, AC: #6)
CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can read all subscriptions for sending notifications (Task 2.9, AC: #7)
-- Note: Service role bypasses RLS by default, but explicit policy for clarity
CREATE POLICY "Service role can read all subscriptions"
  ON push_subscriptions FOR SELECT
  TO service_role
  USING (true);

-- ============================================
-- 2. Create daily_love_messages table (AC: #3)
-- ============================================
-- Stores both default system messages and custom user messages
-- Used for daily push notifications and in-app display

CREATE TABLE IF NOT EXISTS daily_love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',  -- morning, general, affection, affirmation, longing, romantic, appreciation
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for system/default messages
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Custom messages must have a creator (Task 2.4)
  CONSTRAINT chk_custom_has_creator CHECK (is_default = true OR created_by IS NOT NULL)
);

-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_daily_love_messages_category
  ON daily_love_messages(category);
CREATE INDEX IF NOT EXISTS idx_daily_love_messages_is_default
  ON daily_love_messages(is_default);

-- Enable RLS on daily_love_messages (Task 2.7)
ALTER TABLE daily_love_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read default messages (Task 2.10, AC: #6)
CREATE POLICY "Anyone can read default messages"
  ON daily_love_messages FOR SELECT
  USING (is_default = true);

-- RLS Policy: Users can read their own custom messages
CREATE POLICY "Users can read own custom messages"
  ON daily_love_messages FOR SELECT
  USING (auth.uid() = created_by);

-- RLS Policy: Users can manage their custom messages (Task 2.11, AC: #6)
CREATE POLICY "Users can insert own custom messages"
  ON daily_love_messages FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_default = false);

CREATE POLICY "Users can update own custom messages"
  ON daily_love_messages FOR UPDATE
  USING (auth.uid() = created_by AND is_default = false);

CREATE POLICY "Users can delete own custom messages"
  ON daily_love_messages FOR DELETE
  USING (auth.uid() = created_by AND is_default = false);

-- ============================================
-- 3. Create notifications table (AC: #5)
-- ============================================
-- Stores in-app notification history
-- Auto-expires after 30 days for cleanup

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- 'love_note', 'daily_message', 'partner_mood', 'interaction', etc.
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',          -- Additional payload (message_id, mood_id, etc.)
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')  -- Auto-cleanup target
);

-- Indexes for notifications (Task 2.6)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Enable RLS on notifications (Task 2.7)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their notifications (Task 2.12, AC: #6)
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Note: INSERT is typically done by service role (Edge Functions)
-- Service role bypasses RLS, so no explicit insert policy needed for users
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================
-- 4. Seed default daily love messages (AC: #4, Task 3)
-- ============================================
-- At least 8 messages across categories: morning, general, affection,
-- affirmation, longing, romantic, appreciation

INSERT INTO daily_love_messages (content, category, is_default) VALUES
  -- Morning messages
  ('Good morning, sunshine! Waking up knowing you exist makes every day better.', 'morning', true),
  ('Rise and shine! Just wanted to remind you that you''re the best part of my day.', 'morning', true),

  -- General messages
  ('Just thinking about you and smiling.', 'general', true),
  ('You make ordinary moments feel extraordinary.', 'general', true),

  -- Affection messages
  ('Sending you a virtual hug and all my love!', 'affection', true),
  ('If I could wrap my love in a message, this would be it.', 'affection', true),

  -- Affirmation messages
  ('You are worthy of all the love in the world, and I''m grateful to give you mine.', 'affirmation', true),
  ('Never forget how amazing you are. I believe in you always.', 'affirmation', true),

  -- Longing messages
  ('Counting down the moments until I see you again.', 'longing', true),
  ('Distance means nothing when someone means everything.', 'longing', true),

  -- Romantic messages
  ('Every love story is beautiful, but ours is my favorite.', 'romantic', true),
  ('You''re the reason I believe in love.', 'romantic', true),

  -- Appreciation messages
  ('Thank you for being you. I appreciate everything about you.', 'appreciation', true),
  ('I don''t say it enough, but I''m so grateful to have you in my life.', 'appreciation', true);

-- ============================================
-- 5. Helper function to get random daily message
-- ============================================
-- Useful for Edge Functions to select random messages by category

CREATE OR REPLACE FUNCTION get_random_daily_message(p_category TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, content TEXT, category TEXT)
AS $$
BEGIN
  IF p_category IS NULL THEN
    RETURN QUERY
    SELECT dlm.id, dlm.content, dlm.category
    FROM daily_love_messages dlm
    WHERE dlm.is_default = true
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT dlm.id, dlm.content, dlm.category
    FROM daily_love_messages dlm
    WHERE dlm.is_default = true AND dlm.category = p_category
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_random_daily_message TO authenticated;

COMMIT;
