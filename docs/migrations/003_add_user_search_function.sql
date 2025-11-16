-- Migration 003: Add user search function
-- Purpose: Enable users to search for other users without requiring admin API access
--
-- This function runs with SECURITY DEFINER to access auth.users data,
-- but only exposes limited, safe information (id, email, display_name)

-- Create a function to search users by email or display name
CREATE OR REPLACE FUNCTION search_users(search_query TEXT, result_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Search auth.users table (requires SECURITY DEFINER to access)
  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'display_name', au.email::TEXT, 'Unknown')::TEXT as display_name
  FROM auth.users au
  WHERE
    -- Exclude current user
    au.id != current_user_id
    AND
    -- Match email or display name (case-insensitive)
    (
      LOWER(au.email) LIKE '%' || LOWER(search_query) || '%'
      OR
      LOWER(COALESCE(au.raw_user_meta_data->>'display_name', '')) LIKE '%' || LOWER(search_query) || '%'
    )
  LIMIT result_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_users(TEXT, INTEGER) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION search_users(TEXT, INTEGER) IS
'Searches for users by email or display name. Only returns basic public information. Requires authentication.';
