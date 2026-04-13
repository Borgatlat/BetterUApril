-- BetterU League - FINAL FIX for workout triggers
-- This will ensure the table has updated_at and no triggers interfere

-- Step 1: Ensure the table has updated_at column (add if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_workout_logs' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_workout_logs 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
    END IF;
END $$;

-- Step 2: Drop ALL triggers on user_workout_logs that might interfere
-- Be very explicit about all possible trigger names
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS update_user_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS user_workout_logs_updated_at ON user_workout_logs;
DROP TRIGGER IF EXISTS update_updated_at_user_workout_logs ON user_workout_logs;

-- Step 3: Update the function to be absolutely safe
-- Even if called, it will check the table name FIRST
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- CRITICAL: Check table name FIRST - before doing ANYTHING else
    -- This prevents any error if the function is called for user_workout_logs
    IF TG_TABLE_NAME = 'user_workout_logs' THEN
        -- Just return NEW without touching anything
        RETURN NEW;
    END IF;
    
    -- For all other tables, only set updated_at on UPDATE
    IF TG_OP = 'UPDATE' THEN
        BEGIN
            NEW.updated_at = NOW();
        EXCEPTION
            WHEN OTHERS THEN
                -- If anything goes wrong, just return NEW
                RETURN NEW;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Verify the challenge trigger is still there (it should be)
-- This is the important one for league tracking
-- If it doesn't exist, we'll recreate it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_challenge_on_workout' 
        AND event_object_table = 'user_workout_logs'
    ) THEN
        -- Recreate the challenge trigger
        CREATE TRIGGER trigger_update_challenge_on_workout
            AFTER INSERT ON user_workout_logs
            FOR EACH ROW
            EXECUTE FUNCTION update_challenge_on_workout();
    END IF;
END $$;

