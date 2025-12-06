-- ============================================
-- Migration: Fix RLS Security Issues
-- Created: 2025-12-06
-- Purpose: Fix P0 security vulnerabilities in remote_schema migration
-- ============================================

BEGIN;

-- ============================================
-- P0 FIX #1: Restrict user profile visibility
-- ============================================
-- ISSUE: "Authenticated users can read all users" policy uses using(true)
--        which exposes ALL user data to ANY authenticated user
-- FIX: Replace with proper partner-based access control

DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can view their partner's profile
CREATE POLICY "Users can view partner profile"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    -- Check if the current user's partner_id matches the record being accessed
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.id = auth.uid()
      AND u.partner_id = users.id
      AND u.partner_id IS NOT NULL
    )
  );

-- ============================================
-- P0 FIX #2: Prevent arbitrary partner_id updates
-- ============================================
-- ISSUE: users_update_self allows users to update ALL columns including partner_id
--        A malicious user can set their partner_id to any value and gain unauthorized access
-- FIX: Add check constraint to prevent direct partner_id updates

DROP POLICY IF EXISTS "users_update_self" ON public.users;

CREATE POLICY "users_update_self"
  ON public.users
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Allow partner_id to remain unchanged OR be set to NULL (for unlinking)
      -- Partner linking should ONLY happen via accept_partner_request function
      partner_id IS NULL
      OR partner_id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
    )
  );

COMMIT;
