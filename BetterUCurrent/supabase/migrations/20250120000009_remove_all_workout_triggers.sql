-- BetterU League - Remove ALL triggers on user_workout_logs that touch updated_at
-- This will remove any trigger that might be causing the error

-- Drop ALL possible triggers on user_workout_logs that might set updated_at
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS update_user_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS user_workout_logs_updated_at ON user_workout_logs;

-- Also update the shared function to skip user_workout_logs completely
-- This function is used by multiple tables, but user_workout_logs doesn't need updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip user_workout_logs - workouts are immutable once created, no updated_at needed
    IF TG_TABLE_NAME = 'user_workout_logs' THEN
        RETURN NEW;
    END IF;
    
    -- Only set updated_at on UPDATE operations for other tables
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The challenge trigger (trigger_update_challenge_on_workout) is fine - it's AFTER INSERT and doesn't touch updated_at
-- Keep that one, just remove any updated_at triggers

