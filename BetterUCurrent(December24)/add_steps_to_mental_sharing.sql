-- Add steps column to mental session sharing tables
-- This allows sharing the actual steps from custom mental sessions

-- Add steps column to mental_session_shares table
ALTER TABLE mental_session_shares 
ADD COLUMN IF NOT EXISTS steps JSONB;

-- Add steps column to shared_mental_sessions table  
ALTER TABLE shared_mental_sessions 
ADD COLUMN IF NOT EXISTS steps JSONB;

-- Add comment to document the purpose
COMMENT ON COLUMN mental_session_shares.steps IS 'Stores the actual steps from custom mental sessions as JSONB array';
COMMENT ON COLUMN shared_mental_sessions.steps IS 'Stores the actual steps from custom mental sessions as JSONB array';
