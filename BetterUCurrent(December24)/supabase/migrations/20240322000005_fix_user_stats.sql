-- Drop existing user_stats table if it exists
DROP TABLE IF EXISTS user_stats;

-- Create user_stats table
CREATE TABLE user_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workouts_completed INTEGER DEFAULT 0,
    total_workout_minutes INTEGER DEFAULT 0,
    mental_sessions_completed INTEGER DEFAULT 0,
    prs_this_month INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    today_workout_completed BOOLEAN DEFAULT false,
    today_mental_completed BOOLEAN DEFAULT false,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(profile_id)
);

-- Create indexes for better performance
CREATE INDEX idx_user_stats_profile_id ON user_stats(profile_id);
CREATE INDEX idx_user_stats_last_reset_date ON user_stats(last_reset_date);

-- Enable Row Level Security
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own stats"
    ON user_stats FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own stats"
    ON user_stats FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own stats"
    ON user_stats FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default stats for existing profiles
INSERT INTO user_stats (profile_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT profile_id FROM user_stats)
ON CONFLICT (profile_id) DO NOTHING;

-- Create function to reset daily stats
CREATE OR REPLACE FUNCTION reset_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset daily completion flags
    NEW.today_workout_completed = false;
    NEW.today_mental_completed = false;
    NEW.last_reset_date = CURRENT_DATE;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to reset daily stats at midnight
CREATE TRIGGER reset_daily_stats_trigger
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    WHEN (OLD.last_reset_date < CURRENT_DATE)
    EXECUTE FUNCTION reset_daily_stats(); 