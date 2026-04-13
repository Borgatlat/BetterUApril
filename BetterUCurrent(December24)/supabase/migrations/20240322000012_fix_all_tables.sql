-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS workout_history;
DROP TABLE IF EXISTS profiles;

-- Create profiles table with all original columns
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    age INTEGER,
    weight DECIMAL,
    fitness_goal TEXT,
    gender TEXT,
    height DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create user_settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    use_imperial BOOLEAN DEFAULT false,
    calorie_goal INTEGER DEFAULT 2000,
    water_goal_ml INTEGER DEFAULT 2000,
    daily_reminders BOOLEAN DEFAULT true,
    rest_time_seconds INTEGER DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create user_stats table
CREATE TABLE user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_workouts INTEGER DEFAULT 0,
    total_weight_lifted DECIMAL DEFAULT 0,
    total_workout_time INTEGER DEFAULT 0,
    total_calories_burned INTEGER DEFAULT 0,
    today_workout_completed BOOLEAN DEFAULT false,
    daily_workouts_generated INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create workout_history table
CREATE TABLE workout_history (
    workout_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_type TEXT NOT NULL,
    exercises JSONB NOT NULL,
    total_weight DECIMAL NOT NULL,
    duration INTEGER NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles (DROP IF EXISTS avoids "already exists" on re-run)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for user_stats
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
CREATE POLICY "Users can view own stats" ON user_stats
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;
CREATE POLICY "Users can update own stats" ON user_stats
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
CREATE POLICY "Users can insert own stats" ON user_stats
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for workout_history
DROP POLICY IF EXISTS "Users can view own workout history" ON workout_history;
CREATE POLICY "Users can view own workout history" ON workout_history
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own workout history" ON workout_history;
CREATE POLICY "Users can insert own workout history" ON workout_history
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own workout history" ON workout_history;
CREATE POLICY "Users can update own workout history" ON workout_history
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own workout history" ON workout_history;
CREATE POLICY "Users can delete own workout history" ON workout_history
    FOR DELETE USING (auth.uid() = id);

-- Grant necessary permissions to the postgres role
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Create policy to allow postgres role to bypass RLS
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON profiles;
CREATE POLICY "Postgres role can bypass RLS" ON profiles FOR ALL USING (true);
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON user_settings;
CREATE POLICY "Postgres role can bypass RLS" ON user_settings FOR ALL USING (true);
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON user_stats;
CREATE POLICY "Postgres role can bypass RLS" ON user_stats FOR ALL USING (true);
DROP POLICY IF EXISTS "Postgres role can bypass RLS" ON workout_history;
CREATE POLICY "Postgres role can bypass RLS" ON workout_history FOR ALL USING (true); 