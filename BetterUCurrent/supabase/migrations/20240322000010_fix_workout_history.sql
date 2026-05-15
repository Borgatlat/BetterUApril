-- Create workout_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS workout_history (
    workout_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_type TEXT NOT NULL,
    exercises JSONB NOT NULL,
    total_weight DECIMAL NOT NULL,
    duration INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE workout_history ENABLE ROW LEVEL SECURITY;

-- Workout history policies
CREATE POLICY "Users can view own workout history" ON workout_history
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own workout history" ON workout_history
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own workout history" ON workout_history
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own workout history" ON workout_history
    FOR DELETE USING (auth.uid() = id); 