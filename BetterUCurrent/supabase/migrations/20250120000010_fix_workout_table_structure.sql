-- BetterU League - Fix workout table structure
-- Remove ALL triggers on user_workout_logs that touch updated_at
-- Workouts are immutable once created, so no triggers needed

-- Drop ALL possible triggers that might interfere with INSERT
-- This includes any trigger that calls update_updated_at_column
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS update_user_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS user_workout_logs_updated_at ON user_workout_logs;

-- IMPORTANT: Also drop any BEFORE INSERT triggers that might exist
-- These would fire before the INSERT and could cause the error
-- Note: The challenge trigger (trigger_update_challenge_on_workout) is AFTER INSERT, so it's fine

-- Update the shared function to completely skip user_workout_logs
-- This ensures even if there's a trigger we missed, the function won't try to set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- CRITICAL: Skip user_workout_logs entirely - workouts are immutable, never updated
    -- Check table name FIRST before accessing any fields or doing anything else
    IF TG_TABLE_NAME = 'user_workout_logs' THEN
        -- Return immediately without touching any fields
        -- This prevents the error even if a trigger somehow calls this function
        RETURN NEW;
    END IF;
    
    -- Only set updated_at on UPDATE operations for other tables
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Query to check all triggers on user_workout_logs (run this in Supabase to debug)
-- Uncomment and run if you need to see what triggers exist:
/*
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_workout_logs';
*/

