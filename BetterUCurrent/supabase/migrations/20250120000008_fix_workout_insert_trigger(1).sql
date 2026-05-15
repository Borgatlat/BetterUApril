-- BetterU League - Fix workout insert trigger issue
-- Workout logs don't need updated_at - once logged, they shouldn't be updated
-- Remove the trigger entirely

-- Drop the trigger that's causing the error
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON user_workout_logs;

-- That's it! Workout logs are immutable once created, so no updated_at trigger needed

