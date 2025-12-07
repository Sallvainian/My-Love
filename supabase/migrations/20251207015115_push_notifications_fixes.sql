-- ============================================
-- Migration: Push Notifications Schema Fixes
-- Created: 2025-12-07
-- Story: 3.0 Code Review Follow-ups
-- Purpose: Fix issues identified in adversarial code review
-- ============================================

BEGIN;

-- ============================================
-- 1. Enable moddatetime extension for auto-updating timestamps
-- ============================================
-- This is the standard Supabase pattern for updated_at columns
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================
-- 2. Add trigger for push_subscriptions.updated_at
-- ============================================
-- The updated_at column was created but never auto-updated
-- This trigger fires on UPDATE and sets updated_at to NOW()

CREATE TRIGGER handle_updated_at_push_subscriptions
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================
-- 3. Add missing index on daily_love_messages.created_by
-- ============================================
-- RLS policies query this column for custom messages
-- Index improves performance for user-scoped queries

CREATE INDEX IF NOT EXISTS idx_daily_love_messages_created_by
  ON daily_love_messages(created_by);

-- ============================================
-- 4. Fix FK constraint: ON DELETE SET NULL -> ON DELETE CASCADE
-- ============================================
-- Issue: When user deleted, created_by becomes NULL
-- RLS policy (auth.uid() = created_by) never matches NULL
-- Result: Orphaned custom messages become inaccessible "ghost data"
--
-- Solution: CASCADE delete custom messages when user is deleted
-- Rationale: This is a couples app - personal content should be removed
-- when the user leaves, not preserved as orphaned data

-- Drop the old constraint
ALTER TABLE daily_love_messages
  DROP CONSTRAINT IF EXISTS daily_love_messages_created_by_fkey;

-- Add new constraint with CASCADE
ALTER TABLE daily_love_messages
  ADD CONSTRAINT daily_love_messages_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- 5. Document intentional design: notifications INSERT policy
-- ============================================
-- Add comment explaining why users cannot INSERT notifications directly
-- This is intentional: notifications are server-generated via Edge Functions

COMMENT ON POLICY "Service role can insert notifications" ON notifications IS
  'Intentional: Only Edge Functions (service_role) create notifications. Users receive notifications but cannot create arbitrary ones. This prevents notification spam and ensures notifications are system-generated.';

COMMIT;
