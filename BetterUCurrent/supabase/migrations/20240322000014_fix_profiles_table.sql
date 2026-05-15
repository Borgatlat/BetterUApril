-- Add missing columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS weight DECIMAL,
ADD COLUMN IF NOT EXISTS height DECIMAL,
ADD COLUMN IF NOT EXISTS goal TEXT,
ADD COLUMN IF NOT EXISTS training_level TEXT DEFAULT 'intermediate',
ADD COLUMN IF NOT EXISTS fitness_goal TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Update existing profiles to have default values
UPDATE profiles
SET 
    onboarding_completed = false,
    training_level = 'intermediate'
WHERE onboarding_completed IS NULL;

-- Create function to initialize profile data
CREATE OR REPLACE FUNCTION public.initialize_profile_data(user_id UUID)
RETURNS void AS $$
BEGIN
    -- Get user email from auth.users
    DECLARE
        user_email TEXT;
    BEGIN
        SELECT email INTO user_email FROM auth.users WHERE id = user_id;
        
        -- Update profile with email and default values
        UPDATE profiles
        SET 
            email = user_email,
            onboarding_completed = false,
            training_level = 'intermediate'
        WHERE id = user_id;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize data for all existing profiles
DO $$
DECLARE
    profile_record RECORD;
BEGIN
    FOR profile_record IN SELECT id FROM profiles LOOP
        PERFORM public.initialize_profile_data(profile_record.id);
    END LOOP;
END $$; 