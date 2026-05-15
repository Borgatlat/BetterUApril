-- Create user_workout_logs table
CREATE TABLE IF NOT EXISTS user_workout_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    today_workout_completed BOOLEAN DEFAULT false,
    today_mental_completed BOOLEAN DEFAULT false,
    streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_streak_update TIMESTAMP WITH TIME ZONE,
    total_workouts INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id)
);

-- Create user_tracking table
CREATE TABLE IF NOT EXISTS user_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    calories_goal INTEGER DEFAULT 2000,
    calories_consumed INTEGER DEFAULT 0,
    water_goal_ml INTEGER DEFAULT 2000,
    water_consumed_ml INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workout_logs_profile_id ON user_workout_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_completed_at ON user_workout_logs(completed_at);
CREATE INDEX IF NOT EXISTS idx_user_stats_profile_id ON user_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_tracking_profile_id ON user_tracking(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_tracking_date ON user_tracking(date);

-- Enable Row Level Security
ALTER TABLE user_workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own workout logs" ON user_workout_logs;
DROP POLICY IF EXISTS "Users can insert their own workout logs" ON user_workout_logs;
DROP POLICY IF EXISTS "Users can update their own workout logs" ON user_workout_logs;
DROP POLICY IF EXISTS "Users can delete their own workout logs" ON user_workout_logs;

DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can delete their own stats" ON user_stats;

DROP POLICY IF EXISTS "Users can view their own tracking" ON user_tracking;
DROP POLICY IF EXISTS "Users can insert their own tracking" ON user_tracking;
DROP POLICY IF EXISTS "Users can update their own tracking" ON user_tracking;
DROP POLICY IF EXISTS "Users can delete their own tracking" ON user_tracking;

-- Create policies for workout logs
CREATE POLICY "Users can view their own workout logs"
    ON user_workout_logs FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own workout logs"
    ON user_workout_logs FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own workout logs"
    ON user_workout_logs FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own workout logs"
    ON user_workout_logs FOR DELETE
    USING (auth.uid() = profile_id);

-- Create policies for user stats
CREATE POLICY "Users can view their own stats"
    ON user_stats FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own stats"
    ON user_stats FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own stats"
    ON user_stats FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own stats"
    ON user_stats FOR DELETE
    USING (auth.uid() = profile_id);

-- Create policies for user tracking
CREATE POLICY "Users can view their own tracking"
    ON user_tracking FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own tracking"
    ON user_tracking FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own tracking"
    ON user_tracking FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own tracking"
    ON user_tracking FOR DELETE
    USING (auth.uid() = profile_id);

-- Create triggers for updated_at
CREATE TRIGGER update_workout_logs_updated_at
    BEFORE UPDATE ON user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tracking_updated_at
    BEFORE UPDATE ON user_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to initialize user stats for new users
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_stats (profile_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize user stats for new users
DROP TRIGGER IF EXISTS on_auth_user_created_stats ON auth.users;
CREATE TRIGGER on_auth_user_created_stats
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_stats(); 