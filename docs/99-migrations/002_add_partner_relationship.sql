-- ============================================
-- Migration 002: Add Partner Relationship System
-- Created: 2025-11-15
-- Purpose: Add partner_id foreign key and partner_requests table
-- ============================================

BEGIN;

-- ============================================
-- 1. Add partner_id column to users table
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_partner ON users(partner_id);

-- Add comment to deprecate partner_name (keep for backward compatibility)
COMMENT ON COLUMN users.partner_name IS 'DEPRECATED: Use partner_id foreign key instead. Maintained for backward compatibility.';

-- ============================================
-- 2. Create partner_requests table
-- ============================================
CREATE TABLE IF NOT EXISTS partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent sending request to yourself
  CONSTRAINT no_self_requests CHECK (from_user_id != to_user_id)
);

-- Prevent duplicate pending requests between same users
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_requests_unique
ON partner_requests(from_user_id, to_user_id)
WHERE status = 'pending';

-- Index for querying pending requests
CREATE INDEX IF NOT EXISTS idx_partner_requests_to_user_pending
ON partner_requests(to_user_id, status);

-- ============================================
-- 3. Update RLS policy for moods table
-- ============================================
-- Drop the simplified policy that allowed viewing all moods
DROP POLICY IF EXISTS "Users can view own and partner moods" ON moods;

-- Create partner-aware policy
CREATE POLICY "Users can view own and partner moods" ON moods
FOR SELECT USING (
  -- Can see own moods
  auth.uid() = user_id
  OR
  -- Can see partner's moods (bidirectional check)
  auth.uid() IN (
    SELECT partner_id FROM users WHERE id = user_id AND partner_id IS NOT NULL
    UNION
    SELECT id FROM users WHERE partner_id = user_id AND partner_id IS NOT NULL
  )
);

-- ============================================
-- 4. Enable RLS on partner_requests table
-- ============================================
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

-- Users can create partner requests (must be from themselves)
CREATE POLICY "Users can create partner requests" ON partner_requests
FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Users can view requests they sent or received
CREATE POLICY "Users can view their requests" ON partner_requests
FOR SELECT USING (auth.uid() IN (from_user_id, to_user_id));

-- Users can update requests sent to them (to accept/decline)
CREATE POLICY "Users can update received requests" ON partner_requests
FOR UPDATE USING (auth.uid() = to_user_id);

-- ============================================
-- 5. Create database function to accept partner request
-- ============================================
CREATE OR REPLACE FUNCTION accept_partner_request(
  p_request_id UUID
) RETURNS void AS $$
DECLARE
  v_from_user_id UUID;
  v_to_user_id UUID;
  v_request_status TEXT;
BEGIN
  -- Get request details
  SELECT from_user_id, to_user_id, status
  INTO v_from_user_id, v_to_user_id, v_request_status
  FROM partner_requests
  WHERE id = p_request_id;

  -- Validate request exists and is pending
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner request not found';
  END IF;

  IF v_request_status != 'pending' THEN
    RAISE EXCEPTION 'Partner request is not pending';
  END IF;

  -- Ensure caller is the recipient
  IF auth.uid() != v_to_user_id THEN
    RAISE EXCEPTION 'Only the recipient can accept a partner request';
  END IF;

  -- Check if either user already has a partner
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id IN (v_from_user_id, v_to_user_id)
    AND partner_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'One or both users already have a partner';
  END IF;

  -- Update both users' partner_id (atomic)
  UPDATE users SET partner_id = v_to_user_id, updated_at = now()
  WHERE id = v_from_user_id;

  UPDATE users SET partner_id = v_from_user_id, updated_at = now()
  WHERE id = v_to_user_id;

  -- Mark request as accepted
  UPDATE partner_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = p_request_id;

  -- Decline all other pending requests to/from these users
  UPDATE partner_requests
  SET status = 'declined', updated_at = now()
  WHERE id != p_request_id
    AND status = 'pending'
    AND (from_user_id IN (v_from_user_id, v_to_user_id)
         OR to_user_id IN (v_from_user_id, v_to_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Create database function to decline partner request
-- ============================================
CREATE OR REPLACE FUNCTION decline_partner_request(
  p_request_id UUID
) RETURNS void AS $$
DECLARE
  v_to_user_id UUID;
BEGIN
  -- Get request recipient
  SELECT to_user_id
  INTO v_to_user_id
  FROM partner_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner request not found or already processed';
  END IF;

  -- Ensure caller is the recipient
  IF auth.uid() != v_to_user_id THEN
    RAISE EXCEPTION 'Only the recipient can decline a partner request';
  END IF;

  -- Mark request as declined
  UPDATE partner_requests
  SET status = 'declined', updated_at = now()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify migration success:

-- 1. Verify partner_id column added
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'partner_id';

-- 2. Verify partner_requests table created
-- SELECT COUNT(*) FROM partner_requests;

-- 3. Verify RLS policies
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE tablename IN ('moods', 'partner_requests');

-- 4. Verify database functions
-- SELECT proname FROM pg_proc WHERE proname LIKE '%partner%';
