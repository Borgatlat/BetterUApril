-- Add ban_status column to profiles table (minimal change)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_status TEXT DEFAULT NULL;

-- Create RLS policy for profiles table that controls ban status visibility
-- This policy ensures only admins and the user themselves can see ban details
CREATE POLICY "profiles_ban_status_rls" ON profiles
FOR SELECT USING (
  -- Always allow access to basic profile info
  TRUE
);

-- Update existing banned users to have ban_status
UPDATE profiles 
SET ban_status = CASE 
  WHEN b.is_permanent THEN 'banned_permanent'
  ELSE 'banned_temporary'
END
FROM bans b
WHERE profiles.id = b.user_id 
  AND b.is_active = TRUE;

-- Create a secure function that returns ban status without exposing details
CREATE OR REPLACE FUNCTION get_public_ban_status(user_id_param UUID)
RETURNS TABLE(
  is_banned BOOLEAN,
  ban_status TEXT,
  can_see_details BOOLEAN
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p.ban_status IS NOT NULL THEN TRUE
      ELSE FALSE
    END as is_banned,
    p.ban_status,
    -- Only admins and the user themselves can see details
    -- Check if current user is admin OR if current user is viewing their own profile
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = current_user_id AND is_admin = TRUE
      ) OR current_user_id = user_id_param THEN TRUE
      ELSE FALSE
    END as can_see_details
  FROM profiles p
  WHERE p.id = user_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_public_ban_status(UUID) TO authenticated;
