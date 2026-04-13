-- Create a temporary table to store existing onboarding status
CREATE TEMP TABLE temp_onboarding_status AS
SELECT id, onboarding_completed
FROM profiles
WHERE onboarding_completed IS NOT NULL;

-- Update the initialize_profile_data function to preserve onboarding status
CREATE OR REPLACE FUNCTION public.initialize_profile_data(user_id UUID)
RETURNS void AS $$
DECLARE
    user_email TEXT;
    existing_onboarding BOOLEAN;
BEGIN
    -- Get user email from auth.users
    SELECT email INTO user_email FROM auth.users WHERE id = user_id;
    
    -- Get existing onboarding status if any
    SELECT onboarding_completed INTO existing_onboarding
    FROM temp_onboarding_status
    WHERE id = user_id;
    
    -- Update profile with email and preserve onboarding status
    UPDATE profiles
    SET 
        email = user_email,
        onboarding_completed = COALESCE(existing_onboarding, false),
        training_level = 'intermediate'
    WHERE id = user_id;
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

-- Drop the temporary table
DROP TABLE temp_onboarding_status; 