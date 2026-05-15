-- Add border_color field to runs and mental_session_logs tables
-- This allows users to customize their activity post borders with Sparks (1 spark per color change)

-- Add to runs table (for runs, walks, bikes)
ALTER TABLE runs 
ADD COLUMN IF NOT EXISTS border_color TEXT;

COMMENT ON COLUMN runs.border_color IS 'Custom border color for run/walk/bike posts in the feed. Set via edit screen for 1 Spark.';

-- Add to mental_session_logs table
ALTER TABLE mental_session_logs 
ADD COLUMN IF NOT EXISTS border_color TEXT;

COMMENT ON COLUMN mental_session_logs.border_color IS 'Custom border color for mental session posts in the feed. Set via edit screen for 1 Spark.';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_runs_border_color ON runs(border_color) WHERE border_color IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mental_session_logs_border_color ON mental_session_logs(border_color) WHERE border_color IS NOT NULL;

