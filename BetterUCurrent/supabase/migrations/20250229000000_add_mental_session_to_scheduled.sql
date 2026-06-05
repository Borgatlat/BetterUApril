-- Add mental_session activity type to scheduled_workouts
-- Allows users to schedule mental wellness sessions in the calendar

-- Drop existing check constraint
ALTER TABLE scheduled_workouts DROP CONSTRAINT IF EXISTS scheduled_workouts_check;

-- Add new constraint including mental_session (similar to run/walk/bike - requires title)
ALTER TABLE scheduled_workouts ADD CONSTRAINT scheduled_workouts_check CHECK (
  (activity_type = 'rest_day' AND workout_name IS NULL AND workout_exercises = '[]'::jsonb) OR
  (activity_type = 'workout' AND workout_name IS NOT NULL) OR
  (activity_type IN ('run', 'walk', 'bike', 'mental_session') AND title IS NOT NULL AND workout_name IS NULL AND workout_exercises = '[]'::jsonb)
);

COMMENT ON COLUMN scheduled_workouts.activity_type IS 'Type of activity: workout, run, walk, bike, mental_session, or rest_day';
