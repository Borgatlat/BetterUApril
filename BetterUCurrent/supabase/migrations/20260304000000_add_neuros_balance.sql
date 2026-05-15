-- Add Neuros currency balance to profiles
-- Neuros are earned by completing daily tasks (e.g. 5 per task)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neuros_balance INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.neuros_balance IS 'In-app currency earned by completing daily tasks';

CREATE INDEX IF NOT EXISTS idx_profiles_neuros ON profiles(neuros_balance);
