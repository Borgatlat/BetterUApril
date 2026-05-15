-- Daily Macronutrients Table
-- This table tracks daily macronutrients (excluding calories since they're tracked elsewhere)

-- Create daily_macronutrients table
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

-- Add constraints for data integrity
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_protein_positive CHECK (protein >= 0);
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_carbs_positive CHECK (carbs >= 0);
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_fat_positive CHECK (fat >= 0);
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_fiber_positive CHECK (fiber >= 0);
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_sugar_positive CHECK (sugar >= 0);
ALTER TABLE daily_macronutrients ADD CONSTRAINT check_sodium_positive CHECK (sodium >= 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_macros_user_id ON daily_macronutrients(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_macros_date ON daily_macronutrients(date);
CREATE INDEX IF NOT EXISTS idx_daily_macros_user_date ON daily_macronutrients(user_id, date);

-- Enable Row Level Security
ALTER TABLE daily_macronutrients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_macronutrients table
CREATE POLICY "Users can view own daily macros" ON daily_macronutrients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily macros" ON daily_macronutrients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily macros" ON daily_macronutrients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily macros" ON daily_macronutrients
    FOR DELETE USING (auth.uid() = user_id);

-- Function to get or create daily macros for a user
CREATE OR REPLACE FUNCTION get_or_create_daily_macros(user_uuid UUID, target_date DATE)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    date DATE,
    protein DECIMAL,
    carbs DECIMAL,
    fat DECIMAL,
    fiber DECIMAL,
    sugar DECIMAL,
    sodium DECIMAL
) AS $$
BEGIN
    -- Try to insert, if conflict then get existing record
    INSERT INTO daily_macronutrients (user_id, date, protein, carbs, fat, fiber, sugar, sodium)
    VALUES (user_uuid, target_date, 0, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id, date) DO NOTHING;
    
    -- Return the record (either newly created or existing)
    RETURN QUERY
    SELECT 
        dm.id,
        dm.user_id,
        dm.date,
        dm.protein,
        dm.carbs,
        dm.fat,
        dm.fiber,
        dm.sugar,
        dm.sodium
    FROM daily_macronutrients dm
    WHERE dm.user_id = user_uuid AND dm.date = target_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update daily macros
CREATE OR REPLACE FUNCTION update_daily_macros(
    user_uuid UUID,
    target_date DATE,
    protein_add DECIMAL DEFAULT 0,
    carbs_add DECIMAL DEFAULT 0,
    fat_add DECIMAL DEFAULT 0,
    fiber_add DECIMAL DEFAULT 0,
    sugar_add DECIMAL DEFAULT 0,
    sodium_add DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_macronutrients (user_id, date, protein, carbs, fat, fiber, sugar, sodium)
    VALUES (user_uuid, target_date, protein_add, carbs_add, fat_add, fiber_add, sugar_add, sodium_add)
    ON CONFLICT (user_id, date) DO UPDATE SET
        protein = daily_macronutrients.protein + protein_add,
        carbs = daily_macronutrients.carbs + carbs_add,
        fat = daily_macronutrients.fat + fat_add,
        fiber = daily_macronutrients.fiber + fiber_add,
        sugar = daily_macronutrients.sugar + sugar_add,
        sodium = daily_macronutrients.sodium + sodium_add,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 