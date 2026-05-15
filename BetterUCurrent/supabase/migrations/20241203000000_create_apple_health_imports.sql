-- Track workouts imported FROM Apple Health (so we don't re-export them)
-- This prevents circular imports/exports between BetterU and Apple Health

CREATE TABLE IF NOT EXISTS apple_health_imports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- The ID of the workout/run in our tables
    target_table TEXT NOT NULL, -- 'runs' or 'user_workout_logs'
    target_id UUID NOT NULL,
    
    -- Original Apple Health identifier (to prevent duplicate imports)
    apple_health_uuid TEXT,
    
    -- Metadata
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workout_type TEXT, -- 'run', 'walk', 'bike', 'strength', etc.
    original_start_date TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_target UNIQUE (target_table, target_id),
    CONSTRAINT unique_apple_uuid UNIQUE (user_id, apple_health_uuid)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS apple_health_imports_user_id_idx ON apple_health_imports(user_id);
CREATE INDEX IF NOT EXISTS apple_health_imports_target_idx ON apple_health_imports(target_table, target_id);
CREATE INDEX IF NOT EXISTS apple_health_imports_apple_uuid_idx ON apple_health_imports(apple_health_uuid);

-- RLS Policies
ALTER TABLE apple_health_imports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own imports
CREATE POLICY "Users can view their own imports"
    ON apple_health_imports FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own imports
CREATE POLICY "Users can insert their own imports"
    ON apple_health_imports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own imports
CREATE POLICY "Users can delete their own imports"
    ON apple_health_imports FOR DELETE
    USING (auth.uid() = user_id);

