-- Add training_level column to onboarding_data table
ALTER TABLE onboarding_data
ADD COLUMN training_level TEXT DEFAULT 'beginner';

-- Update existing rows to have a default value
UPDATE onboarding_data
SET training_level = 'beginner'
WHERE training_level IS NULL;

-- Add a check constraint to ensure valid values
ALTER TABLE onboarding_data
ADD CONSTRAINT valid_training_level
CHECK (training_level IN ('beginner', 'intermediate', 'advanced')); 