-- Create scheduled_workouts table
-- This table stores user's weekly workout schedule
CREATE TABLE IF NOT EXISTS scheduled_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    workout_name TEXT,
    workout_exercises JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    is_rest_day BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one entry per user per day (either workout or rest day)
    UNIQUE(user_id, scheduled_date),
    
    -- Ensure rest days don't have workout data
    CHECK (
        (is_rest_day = TRUE AND workout_name IS NULL AND workout_exercises = '[]'::jsonb) OR
        (is_rest_day = FALSE AND workout_name IS NOT NULL)
    )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user_date 
ON scheduled_workouts(user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user_id 
ON scheduled_workouts(user_id);

-- Enable Row Level Security
ALTER TABLE scheduled_workouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Users can view their own scheduled workouts" ON scheduled_workouts;
DROP POLICY IF EXISTS "Users can insert their own scheduled workouts" ON scheduled_workouts;
DROP POLICY IF EXISTS "Users can update their own scheduled workouts" ON scheduled_workouts;
DROP POLICY IF EXISTS "Users can delete their own scheduled workouts" ON scheduled_workouts;

-- RLS Policies: Users can only access their own scheduled workouts

-- SELECT: Users can only view their own scheduled workouts
CREATE POLICY "Users can view their own scheduled workouts"
ON scheduled_workouts
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users can only create scheduled workouts for themselves
CREATE POLICY "Users can insert their own scheduled workouts"
ON scheduled_workouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own scheduled workouts
CREATE POLICY "Users can update their own scheduled workouts"
ON scheduled_workouts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own scheduled workouts
CREATE POLICY "Users can delete their own scheduled workouts"
ON scheduled_workouts
FOR DELETE
USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_workouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on UPDATE
DROP TRIGGER IF EXISTS trigger_update_scheduled_workouts_updated_at ON scheduled_workouts;
CREATE TRIGGER trigger_update_scheduled_workouts_updated_at
    BEFORE UPDATE ON scheduled_workouts
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_workouts_updated_at();

-- Grant permissions (adjust based on your setup)
GRANT ALL ON scheduled_workouts TO authenticated;

