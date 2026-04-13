-- Add profile theme column to profiles table
-- Stores the user's selected background theme color

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_theme TEXT DEFAULT 'default';

-- Add comment for clarity
COMMENT ON COLUMN profiles.profile_theme IS 'User selected profile background theme (default, light_blue, pink, green)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON profiles(profile_theme);

-- Add profile privacy setting
-- When false (private), age, weight, height, BMI, and activities are hidden from other users
-- Default is false (private) for user privacy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.is_profile_public IS 'When false, hides personal stats and activities from other users';

CREATE INDEX IF NOT EXISTS idx_profiles_public ON profiles(is_profile_public);

