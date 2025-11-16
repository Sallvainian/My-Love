-- Migration 003: Add user search with RLS
-- Purpose: Enable users to search for other users using Row Level Security
--
-- Approach: Add email and display_name to users table, sync from auth.users,
-- and use RLS policies instead of SECURITY DEFINER functions

-- Step 1: Add columns to users table for searchable user data
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Step 2: Create index for search performance
CREATE INDEX IF NOT EXISTS idx_users_email_search ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_display_name_search ON users (LOWER(display_name));

-- Step 3: Create function to sync user data from auth.users
-- This runs when a user signs up or updates their profile
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update users table with auth data
  INSERT INTO public.users (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, 'Unknown'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Step 4: Create trigger to auto-sync on user creation/update
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profile();

-- Step 5: Backfill existing users (sync current auth.users to users table)
-- This is safe to run multiple times (ON CONFLICT DO UPDATE)
INSERT INTO users (id, email, display_name, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown'),
  created_at,
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

-- Step 6: Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policy - authenticated users can search other users
-- Users can read basic info (id, email, display_name) for all users
DROP POLICY IF EXISTS "Users can search other users" ON users;
CREATE POLICY "Users can search other users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);  -- Allow reading all users (but only columns granted by RLS)

-- Step 8: Create RLS policy - users can update their own record
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 9: Grant SELECT on necessary columns for authenticated users
-- RLS policies control row access, but we also need column-level permissions
GRANT SELECT (id, email, display_name, partner_id, created_at) ON users TO authenticated;

-- Add helpful comment
COMMENT ON COLUMN users.email IS 'User email, synced from auth.users for search';
COMMENT ON COLUMN users.display_name IS 'User display name, synced from auth.users for search';
