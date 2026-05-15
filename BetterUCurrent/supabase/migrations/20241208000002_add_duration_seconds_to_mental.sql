-- Add duration_seconds column to mental_session_logs table
-- This allows precise tracking of session duration in seconds for short sessions (< 1 minute)
ALTER TABLE mental_session_logs
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

COMMENT ON COLUMN mental_session_logs.duration_seconds IS 'Actual duration of the mental session in seconds. Used for precise display of short sessions (< 1 minute).';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_mental_session_logs_duration_seconds ON mental_session_logs(duration_seconds) WHERE duration_seconds IS NOT NULL;
