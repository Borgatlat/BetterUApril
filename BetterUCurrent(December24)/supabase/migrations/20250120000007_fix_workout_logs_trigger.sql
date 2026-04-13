-- BetterU League - Fix workout logs trigger
-- The error suggests the trigger is trying to access updated_at incorrectly
-- This ensures the trigger only fires on UPDATE, not INSERT

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON user_workout_logs;

-- Ensure the function exists and works correctly
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger - ONLY on UPDATE, not INSERT
-- This should not fire when inserting a new workout
CREATE TRIGGER update_workout_logs_updated_at
    BEFORE UPDATE ON user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

