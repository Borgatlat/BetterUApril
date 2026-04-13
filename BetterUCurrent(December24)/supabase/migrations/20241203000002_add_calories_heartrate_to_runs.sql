-- Add calories and heart rate columns to runs table
-- For Apple Health imports and manual tracking

ALTER TABLE runs ADD COLUMN IF NOT EXISTS calories_burned INTEGER DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS average_heart_rate INTEGER DEFAULT NULL;

-- Add indexes for potential queries
CREATE INDEX IF NOT EXISTS runs_calories_idx ON runs(calories_burned);
CREATE INDEX IF NOT EXISTS runs_heart_rate_idx ON runs(average_heart_rate);

-- Comments for documentation
COMMENT ON COLUMN runs.calories_burned IS 'Calories burned during the run (from Apple Health or estimated)';
COMMENT ON COLUMN runs.average_heart_rate IS 'Average heart rate in BPM during the run (from Apple Health)';

