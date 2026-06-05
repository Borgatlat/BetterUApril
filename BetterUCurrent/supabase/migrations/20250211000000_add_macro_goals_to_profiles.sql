-- Add carb_goal and fat_goal to profiles for nutrition macro targets
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carb_goal INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fat_goal INTEGER;

COMMENT ON COLUMN profiles.carb_goal IS 'Daily carb target in grams';
COMMENT ON COLUMN profiles.fat_goal IS 'Daily fat target in grams';
