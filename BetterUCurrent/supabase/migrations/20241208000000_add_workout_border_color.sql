-- Add border_color field to user_workout_logs table
-- This allows users to customize their workout post borders with Sparks (1 spark per color change)

ALTER TABLE user_workout_logs 
ADD COLUMN IF NOT EXISTS border_color TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN user_workout_logs.border_color IS 'Custom border color for workout posts in the feed. Set via edit screen for 1 Spark.';

-- Create index for faster queries (optional, but helpful if filtering by color)
CREATE INDEX IF NOT EXISTS idx_workout_logs_border_color ON user_workout_logs(border_color) WHERE border_color IS NOT NULL;

