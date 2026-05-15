-- Add bio column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'bio'
    ) THEN
        ALTER TABLE profiles ADD COLUMN bio TEXT;
    END IF;
END $$;

-- Add bio column to onboarding_data table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_data' 
        AND column_name = 'bio'
    ) THEN
        ALTER TABLE onboarding_data ADD COLUMN bio TEXT;
    END IF;
END $$;

-- Add check constraint to ensure bio length doesn't exceed 100 characters
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' 
        AND constraint_name = 'profiles_bio_length_check'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_bio_length_check 
        CHECK (length(bio) <= 100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'onboarding_data' 
        AND constraint_name = 'onboarding_data_bio_length_check'
    ) THEN
        ALTER TABLE onboarding_data ADD CONSTRAINT onboarding_data_bio_length_check 
        CHECK (length(bio) <= 100);
    END IF;
END $$; 