-- Drop existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_training_level' 
        AND table_name = 'onboarding_data'
    ) THEN
        ALTER TABLE onboarding_data DROP CONSTRAINT valid_training_level;
    END IF;
END $$;

-- Add necessary columns to onboarding_data table
ALTER TABLE onboarding_data
ADD COLUMN IF NOT EXISTS training_level TEXT DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fitness_goals TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS weight DECIMAL,
ADD COLUMN IF NOT EXISTS height DECIMAL;

-- Add check constraint for training_level
ALTER TABLE onboarding_data
ADD CONSTRAINT valid_training_level
CHECK (training_level IN ('beginner', 'intermediate', 'advanced'));

-- Update existing rows to have default values
UPDATE onboarding_data
SET 
    training_level = 'beginner',
    onboarding_completed = false
WHERE training_level IS NULL; 