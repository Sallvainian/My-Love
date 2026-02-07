-- Fix infinite recursion in users table RLS policies
--
-- Both the SELECT and UPDATE policies reference public.users in their
-- USING/WITH CHECK clauses, causing PostgreSQL error 42P17 when any
-- query hits the users table.
--
-- Fix: Create a SECURITY DEFINER helper function that bypasses RLS
-- to read the current user's partner_id, breaking the recursion cycle.

BEGIN;

-- 1. Create a helper function that reads partner_id without RLS
CREATE OR REPLACE FUNCTION public.get_my_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_partner_id TO authenticated;

-- 2. Replace the recursive SELECT policy
DROP POLICY IF EXISTS "Users can view self and partner profiles" ON public.users;

CREATE POLICY "Users can view self and partner profiles"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR id = public.get_my_partner_id()
    OR partner_id = auth.uid()
  );

-- 3. Replace the recursive UPDATE policy
DROP POLICY IF EXISTS "users_update_self_safe" ON public.users;

CREATE POLICY "users_update_self_safe"
  ON public.users
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND (
      partner_id IS NOT DISTINCT FROM public.get_my_partner_id()
    )
  );

COMMIT;
