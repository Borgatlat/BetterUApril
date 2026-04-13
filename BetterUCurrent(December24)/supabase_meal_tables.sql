-- AI Meal Generation Tables and Policies
-- Copy and paste this entire file into your Supabase SQL editor

-- Create meals table
CREATE TABLE IF NOT EXISTS meals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ingredients JSONB NOT NULL,
    instructions TEXT,
    nutrition JSONB NOT NULL,
    calories INTEGER NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    cuisine_type TEXT,
    prep_time INTEGER DEFAULT 0,
    cook_time INTEGER DEFAULT 0,
    is_ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meal_consumptions table
CREATE TABLE IF NOT EXISTS meal_consumptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    serving_size DECIMAL(5,2) DEFAULT 1.0,
    actual_calories INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints for data integrity
ALTER TABLE meals ADD CONSTRAINT check_calories_positive CHECK (calories >= 0);
ALTER TABLE meals ADD CONSTRAINT check_prep_time_positive CHECK (prep_time >= 0);
ALTER TABLE meals ADD CONSTRAINT check_cook_time_positive CHECK (cook_time >= 0);
ALTER TABLE meal_consumptions ADD CONSTRAINT check_serving_size_positive CHECK (serving_size > 0);
ALTER TABLE meal_consumptions ADD CONSTRAINT check_actual_calories_positive CHECK (actual_calories >= 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_created_at ON meals(created_at);
CREATE INDEX IF NOT EXISTS idx_meals_meal_type ON meals(meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_consumptions_user_id ON meal_consumptions(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_consumptions_consumed_at ON meal_consumptions(consumed_at);
CREATE INDEX IF NOT EXISTS idx_meal_consumptions_meal_id ON meal_consumptions(meal_id);

-- Enable Row Level Security
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_consumptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meals table
CREATE POLICY "Users can view own meals" ON meals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals" ON meals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals" ON meals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals" ON meals
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meal_consumptions table
CREATE POLICY "Users can view own meal consumptions" ON meal_consumptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal consumptions" ON meal_consumptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal consumptions" ON meal_consumptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal consumptions" ON meal_consumptions
    FOR DELETE USING (auth.uid() = user_id);

-- Function to calculate daily nutrition totals
CREATE OR REPLACE FUNCTION get_daily_nutrition(user_uuid UUID, target_date DATE)
RETURNS TABLE (
    total_calories INTEGER,
    total_protein DECIMAL,
    total_carbs DECIMAL,
    total_fat DECIMAL,
    total_fiber DECIMAL,
    total_sugar DECIMAL,
    total_sodium DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(mc.actual_calories), 0)::INTEGER as total_calories,
        COALESCE(SUM((m.nutrition->>'protein')::DECIMAL * mc.serving_size), 0) as total_protein,
        COALESCE(SUM((m.nutrition->>'carbs')::DECIMAL * mc.serving_size), 0) as total_carbs,
        COALESCE(SUM((m.nutrition->>'fat')::DECIMAL * mc.serving_size), 0) as total_fat,
        COALESCE(SUM((m.nutrition->>'fiber')::DECIMAL * mc.serving_size), 0) as total_fiber,
        COALESCE(SUM((m.nutrition->>'sugar')::DECIMAL * mc.serving_size), 0) as total_sugar,
        COALESCE(SUM((m.nutrition->>'sodium')::DECIMAL * mc.serving_size), 0) as total_sodium
    FROM meal_consumptions mc
    JOIN meals m ON mc.meal_id = m.id
    WHERE mc.user_id = user_uuid
    AND DATE(mc.consumed_at) = target_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 