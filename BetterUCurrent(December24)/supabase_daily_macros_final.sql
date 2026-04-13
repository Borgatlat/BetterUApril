-- Daily Macronutrients Table (Final Version)
-- This table tracks daily macronutrients (excluding calories since they're tracked elsewhere)

-- Drop existing constraints if they exist (to avoid conflicts)
DO $$ 
BEGIN
    -- Drop constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_protein_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_protein_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_carbs_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_carbs_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_fat_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_fat_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_fiber_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_fiber_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sugar_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_sugar_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sodium_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients DROP CONSTRAINT check_sodium_positive;
    END IF;
END $$;

-- Create daily_macronutrients table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_macronutrients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    protein DECIMAL(8,2) DEFAULT 0,
    carbs DECIMAL(8,2) DEFAULT 0,
    fat DECIMAL(8,2) DEFAULT 0,
    fiber DECIMAL(8,2) DEFAULT 0,
    sugar DECIMAL(8,2) DEFAULT 0,
    sodium DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user per day
    UNIQUE(user_id, date)
);

-- Add constraints for data integrity (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_protein_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_protein_positive CHECK (protein >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_carbs_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_carbs_positive CHECK (carbs >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_fat_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_fat_positive CHECK (fat >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_fiber_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_fiber_positive CHECK (fiber >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sugar_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_sugar_positive CHECK (sugar >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_sodium_positive' AND table_name = 'daily_macronutrients') THEN
        ALTER TABLE daily_macronutrients ADD CONSTRAINT check_sodium_positive CHECK (sodium >= 0);
    END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_daily_macros_user_id ON daily_macronutrients(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_macros_date ON daily_macronutrients(date);
CREATE INDEX IF NOT EXISTS idx_daily_macros_user_date ON daily_macronutrients(user_id, date);

-- Enable Row Level Security
ALTER TABLE daily_macronutrients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own daily macros" ON daily_macronutrients;
DROP POLICY IF EXISTS "Users can insert own daily macros" ON daily_macronutrients;
DROP POLICY IF EXISTS "Users can update own daily macros" ON daily_macronutrients;
DROP POLICY IF EXISTS "Users can delete own daily macros" ON daily_macronutrients;

-- RLS Policies for daily_macronutrients table
CREATE POLICY "Users can view own daily macros" ON daily_macronutrients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily macros" ON daily_macronutrients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily macros" ON daily_macronutrients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily macros" ON daily_macronutrients
    FOR DELETE USING (auth.uid() = user_id); 