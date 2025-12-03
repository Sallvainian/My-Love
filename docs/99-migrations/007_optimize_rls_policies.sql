-- ============================================
-- Migration 007: Optimize RLS Policies for Performance
-- Created: 2025-12-03
-- Purpose: Fix auth_rls_initplan warnings by wrapping auth.uid() in SELECT
--          and consolidate duplicate permissive SELECT policies on users table
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================

BEGIN;

-- ============================================
-- 1. INTERACTIONS TABLE - Optimize 3 policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can view interactions to/from them" ON public.interactions;
DROP POLICY IF EXISTS "Users can update received interactions" ON public.interactions;

-- Recreate with (SELECT auth.uid()) wrapper for initplan optimization
CREATE POLICY "Users can insert interactions" ON public.interactions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = from_user_id);

CREATE POLICY "Users can view interactions to/from them" ON public.interactions
  FOR SELECT
  USING ((SELECT auth.uid()) IN (from_user_id, to_user_id));

CREATE POLICY "Users can update received interactions" ON public.interactions
  FOR UPDATE
  USING ((SELECT auth.uid()) = to_user_id);

-- ============================================
-- 2. LOVE_NOTES TABLE - Optimize 2 policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own messages" ON public.love_notes;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.love_notes;

-- Recreate with (SELECT auth.uid()) wrapper
CREATE POLICY "Users can view their own messages" ON public.love_notes
  FOR SELECT
  USING ((SELECT auth.uid()) IN (from_user_id, to_user_id));

CREATE POLICY "Users can insert their own messages" ON public.love_notes
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = from_user_id);

-- ============================================
-- 3. MOODS TABLE - Optimize 4 policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own moods" ON public.moods;
DROP POLICY IF EXISTS "Users can view own and partner moods" ON public.moods;
DROP POLICY IF EXISTS "Users can update own moods" ON public.moods;
DROP POLICY IF EXISTS "Users can delete own moods" ON public.moods;

-- Recreate with (SELECT auth.uid()) wrapper
CREATE POLICY "Users can insert own moods" ON public.moods
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own and partner moods" ON public.moods
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR
    (SELECT auth.uid()) IN (
      SELECT users.partner_id
      FROM public.users
      WHERE users.id = moods.user_id AND users.partner_id IS NOT NULL
      UNION
      SELECT users.id
      FROM public.users
      WHERE users.partner_id = moods.user_id AND users.partner_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update own moods" ON public.moods
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own moods" ON public.moods
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================
-- 4. PARTNER_REQUESTS TABLE - Optimize 3 policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create partner requests" ON public.partner_requests;
DROP POLICY IF EXISTS "Users can view their requests" ON public.partner_requests;
DROP POLICY IF EXISTS "Users can update received requests" ON public.partner_requests;

-- Recreate with (SELECT auth.uid()) wrapper
CREATE POLICY "Users can create partner requests" ON public.partner_requests
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = from_user_id);

CREATE POLICY "Users can view their requests" ON public.partner_requests
  FOR SELECT
  USING ((SELECT auth.uid()) IN (from_user_id, to_user_id));

CREATE POLICY "Users can update received requests" ON public.partner_requests
  FOR UPDATE
  USING ((SELECT auth.uid()) = to_user_id);

-- ============================================
-- 5. USERS TABLE - Optimize INSERT policy & consolidate SELECT policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can search other users" ON public.users;

-- Recreate INSERT with (SELECT auth.uid()) wrapper
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

-- Consolidated SELECT policy for authenticated users
-- (Replaces both "Users can read all users" and "Users can search other users")
-- Authenticated users can read all user profiles (needed for partner search/display)
CREATE POLICY "Authenticated users can read all users" ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these after migration to verify success:

-- 1. Verify all policies are updated (check for SELECT wrapper pattern)
-- SELECT policyname, tablename, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('users', 'moods', 'interactions', 'partner_requests', 'love_notes')
-- ORDER BY tablename, policyname;

-- 2. Count policies per table (should match expected counts)
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('users', 'moods', 'interactions', 'partner_requests', 'love_notes')
-- GROUP BY tablename;

-- Expected counts:
-- interactions: 3
-- love_notes: 2
-- moods: 4
-- partner_requests: 3
-- users: 3 (INSERT, SELECT, UPDATE - note UPDATE was already optimized)

-- 3. Re-run Supabase linter to confirm warnings resolved
-- Dashboard > Database > Linter
