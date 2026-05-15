-- Drop existing table and recreate with correct column name
DROP TABLE IF EXISTS user_workout_logs CASCADE;

CREATE TABLE user_workout_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workout_name TEXT NOT NULL,
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_sets INTEGER NOT NULL DEFAULT 0,
    exercise_count INTEGER NOT NULL DEFAULT 0,
    exercise_names TEXT[] NOT NULL DEFAULT '{}',
    total_weight INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX idx_workout_logs_user_id ON user_workout_logs(user_id);
CREATE INDEX idx_workout_logs_completed_at ON user_workout_logs(completed_at);

-- Enable Row Level Security
ALTER TABLE user_workout_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own workout logs"
    ON user_workout_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout logs"
    ON user_workout_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout logs"
    ON user_workout_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout logs"
    ON user_workout_logs FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_workout_logs_updated_at
    BEFORE UPDATE ON user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 