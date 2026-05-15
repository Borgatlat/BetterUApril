-- Create settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    use_imperial BOOLEAN DEFAULT false,
    calorie_goal INTEGER DEFAULT 2000,
    water_goal_ml INTEGER DEFAULT 2000, -- 2L in ml
    daily_reminders BOOLEAN DEFAULT true,
    rest_time_seconds INTEGER DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id)
);

-- Drop rest_time_minutes column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_settings' 
        AND column_name = 'rest_time_minutes'
    ) THEN
        ALTER TABLE user_settings DROP COLUMN rest_time_minutes;
    END IF;
END $$;

-- Add rest_time_seconds column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_settings' 
        AND column_name = 'rest_time_seconds'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN rest_time_seconds INTEGER DEFAULT 90;
    END IF;
END $$;

-- Create index on profile_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_profile_id ON user_settings(profile_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

-- Create policies
CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

-- Create function to create default settings for new users
CREATE OR REPLACE FUNCTION create_default_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (profile_id, use_imperial, calorie_goal, water_goal_ml, daily_reminders, rest_time_seconds)
    VALUES (NEW.id, false, 2000, 2000, true, 90);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create settings for new users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_settings();

-- Create settings for existing users
INSERT INTO user_settings (profile_id, use_imperial, calorie_goal, water_goal_ml, daily_reminders, rest_time_seconds)
SELECT id, false, 2000, 2000, true, 90
FROM auth.users
WHERE id NOT IN (SELECT profile_id FROM user_settings)
ON CONFLICT (profile_id) DO NOTHING;

-- Drop existing update trigger if it exists
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 