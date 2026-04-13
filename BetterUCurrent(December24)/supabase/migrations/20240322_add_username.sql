-- Add username column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add username column to onboarding_data table
ALTER TABLE onboarding_data
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add unique constraint to username in profiles table
ALTER TABLE profiles
ADD CONSTRAINT unique_username UNIQUE (username);

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username); 