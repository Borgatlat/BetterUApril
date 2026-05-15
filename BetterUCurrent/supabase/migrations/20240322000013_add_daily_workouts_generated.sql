-- Add daily_workouts_generated column to user_stats table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_stats' 
        AND column_name = 'daily_workouts_generated'
    ) THEN
        ALTER TABLE user_stats 
        ADD COLUMN daily_workouts_generated INTEGER DEFAULT 0;
    END IF;
END $$; 