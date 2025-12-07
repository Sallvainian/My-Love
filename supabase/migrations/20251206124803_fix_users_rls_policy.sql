-- Fix overly permissive RLS policy on users table
-- The previous policy "Authenticated users can read all users" with qual=true
-- allowed ANY authenticated user to read ALL user profiles (security issue)

BEGIN;

-- Drop the permissive policy
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;

-- Create properly scoped policy: users can only read their own profile and their partner's
CREATE POLICY "Users can view self and partner profiles"
  ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    -- Can read own profile
    id = auth.uid()
    -- Can read partner's profile (if partnered)
    OR id = (SELECT partner_id FROM public.users WHERE id = auth.uid())
    -- Partner can read your profile
    OR partner_id = auth.uid()
  );

COMMIT;
