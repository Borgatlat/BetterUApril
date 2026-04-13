-- Add calories_burned column to user_workout_logs table
-- This tracks calories burned during workouts for Apple Health export

ALTER TABLE user_workout_logs 
ADD COLUMN IF NOT EXISTS calories_burned INTEGER DEFAULT 0;

-- Add index for potential queries on calories
CREATE INDEX IF NOT EXISTS idx_workout_logs_calories ON user_workout_logs(calories_burned);

-- Comment for documentation
COMMENT ON COLUMN user_workout_logs.calories_burned IS 'Estimated calories burned during the workout (calculated as ~5 cal/min)';

