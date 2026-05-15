-- Ensure all existing profiles have sparks_balance initialized to 0
-- This prevents NULL issues when awarding Sparks

UPDATE profiles 
SET sparks_balance = 0 
WHERE sparks_balance IS NULL;

-- Set default for future profiles
ALTER TABLE profiles 
ALTER COLUMN sparks_balance SET DEFAULT 0;

-- Ensure existing profiles with NULL get 0
ALTER TABLE profiles 
ALTER COLUMN sparks_balance SET NOT NULL;

-- If the NOT NULL constraint fails, set all NULLs to 0 first
DO $$
BEGIN
    UPDATE profiles 
    SET sparks_balance = 0 
    WHERE sparks_balance IS NULL;
    
    -- Now try to set NOT NULL
    BEGIN
        ALTER TABLE profiles 
        ALTER COLUMN sparks_balance SET NOT NULL;
    EXCEPTION
        WHEN OTHERS THEN
            -- If it fails, that's okay - we'll just ensure defaults
            RAISE NOTICE 'Could not set NOT NULL constraint, but defaults are set';
    END;
END $$;

COMMENT ON COLUMN profiles.sparks_balance IS 'In-app currency earned through referrals. Defaults to 0 for all users.';

