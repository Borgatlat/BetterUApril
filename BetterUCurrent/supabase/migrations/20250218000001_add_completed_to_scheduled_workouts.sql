-- Migration: Add completed field to scheduled_workouts table
-- This allows tracking which scheduled activities have been completed

-- Add completed column
ALTER TABLE scheduled_workouts 
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;

-- Add completed_at timestamp
ALTER TABLE scheduled_workouts 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on completed status
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_completed 
ON scheduled_workouts(completed);

-- Add comment
COMMENT ON COLUMN scheduled_workouts.completed IS 'Whether this scheduled activity has been completed';
COMMENT ON COLUMN scheduled_workouts.completed_at IS 'Timestamp when the activity was completed';

