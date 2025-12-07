-- Fix P0 Security: Prevent privilege escalation via partner_id manipulation
--
-- VULNERABILITY: The users_update_self policy allows users to update their own partner_id,
-- which combined with the "Users can view self and partner profiles" SELECT policy
-- allows an attacker to read ANY user's profile by:
--   1. Setting their own partner_id to the target user's ID
--   2. The SELECT policy then grants them access to that user's row
--
-- FIX: Replace the permissive update policy with one that only allows updating safe columns
-- The partner_id should ONLY be modified by the accept_partner_request() function (SECURITY DEFINER)

BEGIN;

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "users_update_self" ON public.users;

-- Create a restrictive update policy that prevents partner_id manipulation
-- Users can update their own row, but partner_id must remain unchanged
CREATE POLICY "users_update_self_safe"
  ON public.users
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only update own row
    (SELECT auth.uid()) = id
  )
  WITH CHECK (
    -- Can only update own row
    (SELECT auth.uid()) = id
    -- partner_id must not change (NULL stays NULL, or value stays same)
    AND (
      (partner_id IS NOT DISTINCT FROM (SELECT partner_id FROM public.users WHERE id = auth.uid()))
    )
  );

-- Add a comment explaining the security rationale
COMMENT ON POLICY "users_update_self_safe" ON public.users IS
  'Users can update their own profile (display_name, email, etc.) but cannot directly modify partner_id. ' ||
  'Partner relationships must be established through accept_partner_request() function to prevent privilege escalation.';

COMMIT;
