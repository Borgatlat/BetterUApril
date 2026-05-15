-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workout_name TEXT NOT NULL,
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on profile_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workouts_profile_id ON workouts(profile_id);

-- Enable Row Level Security
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can insert their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can delete their own workouts" ON workouts;

-- Create policies
CREATE POLICY "Users can view their own workouts"
    ON workouts FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own workouts"
    ON workouts FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own workouts"
    ON workouts FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own workouts"
    ON workouts FOR DELETE
    USING (auth.uid() = profile_id);

-- Drop existing update trigger if it exists
DROP TRIGGER IF EXISTS update_workouts_updated_at ON workouts;

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_workouts_updated_at
    BEFORE UPDATE ON workouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 