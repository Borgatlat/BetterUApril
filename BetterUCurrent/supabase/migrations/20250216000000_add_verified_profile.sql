-- Add isverified column to profiles table
-- This column indicates if a user has been verified by an admin
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS isverified BOOLEAN DEFAULT false;

-- Add index for faster queries on verified users
CREATE INDEX IF NOT EXISTS idx_profiles_isverified ON profiles(isverified);

-- Add comment to document the column
COMMENT ON COLUMN profiles.isverified IS 'Indicates if the user profile has been verified by an admin. Verified users display a checkmark badge next to their name.';

