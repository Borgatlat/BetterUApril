-- Migration: Add support for scheduling runs, walks, bikes with custom titles
-- Allows multiple activities per day

-- Step 1: Drop the unique constraint to allow multiple activities per day
ALTER TABLE scheduled_workouts 
DROP CONSTRAINT IF EXISTS scheduled_workouts_user_id_scheduled_date_key;

-- Step 2: Add new columns for activity type and title
ALTER TABLE scheduled_workouts 
ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'workout';

ALTER TABLE scheduled_workouts 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Step 3: Update existing records to have activity_type
UPDATE scheduled_workouts 
SET activity_type = CASE 
  WHEN is_rest_day = TRUE THEN 'rest_day'
  ELSE 'workout'
END
WHERE activity_type IS NULL OR activity_type = 'workout';

-- Step 4: Set title for existing workouts (use workout_name as title)
UPDATE scheduled_workouts 
SET title = workout_name 
WHERE title IS NULL AND workout_name IS NOT NULL;

-- Step 5: Drop the old CHECK constraint
ALTER TABLE scheduled_workouts 
DROP CONSTRAINT IF EXISTS scheduled_workouts_check;

-- Step 6: Add new CHECK constraint that handles all activity types
ALTER TABLE scheduled_workouts 
ADD CONSTRAINT scheduled_workouts_check CHECK (
  -- Rest days: no workout data, can have notes
  (activity_type = 'rest_day' AND workout_name IS NULL AND workout_exercises = '[]'::jsonb) OR
  -- Workouts: must have workout_name and exercises
  (activity_type = 'workout' AND workout_name IS NOT NULL) OR
  -- Runs, walks, bikes: must have title, no workout data
  (activity_type IN ('run', 'walk', 'bike') AND title IS NOT NULL AND workout_name IS NULL AND workout_exercises = '[]'::jsonb)
);

-- Step 7: Create new unique index for (user_id, scheduled_date, activity_type) 
-- This allows multiple activities per day but prevents duplicates of same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_workouts_user_date_type 
ON scheduled_workouts(user_id, scheduled_date, activity_type) 
WHERE activity_type != 'workout'; -- Workouts can have multiple per day (different workout names)

-- Step 8: Update indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_activity_type 
ON scheduled_workouts(activity_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_title 
ON scheduled_workouts(title);

-- Step 9: Add comment to table
COMMENT ON COLUMN scheduled_workouts.activity_type IS 'Type of activity: workout, run, walk, bike, or rest_day';
COMMENT ON COLUMN scheduled_workouts.title IS 'Custom title for the scheduled activity (required for runs/walks/bikes)';

