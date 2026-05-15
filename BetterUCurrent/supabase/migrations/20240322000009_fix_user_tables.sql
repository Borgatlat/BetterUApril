-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    use_imperial BOOLEAN DEFAULT false,
    calorie_goal INTEGER DEFAULT 2000,
    water_goal_ml INTEGER DEFAULT 2000,
    daily_reminders BOOLEAN DEFAULT true,
    rest_time_seconds INTEGER DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create user_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_workouts INTEGER DEFAULT 0,
    total_weight_lifted DECIMAL DEFAULT 0,
    total_calories_burned INTEGER DEFAULT 0,
    total_workout_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create water_tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS water_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_ml INTEGER NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Create calorie_tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS calorie_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    calories INTEGER NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Add RLS policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE calorie_tracking ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User stats policies
CREATE POLICY "Users can view own stats" ON user_stats
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own stats" ON user_stats
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own stats" ON user_stats
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Water tracking policies
CREATE POLICY "Users can view own water tracking" ON water_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own water tracking" ON water_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water tracking" ON water_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Calorie tracking policies
CREATE POLICY "Users can view own calorie tracking" ON calorie_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own calorie tracking" ON calorie_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calorie tracking" ON calorie_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to initialize user data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Create user settings
    INSERT INTO public.user_settings (id)
    VALUES (NEW.id);

    -- Create user stats
    INSERT INTO public.user_stats (id)
    VALUES (NEW.id);

    -- Create initial water tracking
    INSERT INTO public.water_tracking (user_id, amount_ml)
    VALUES (NEW.id, 0);

    -- Create initial calorie tracking
    INSERT INTO public.calorie_tracking (user_id, calories)
    VALUES (NEW.id, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 