-- Create enum for run status
CREATE TYPE run_status AS ENUM ('completed', 'cancelled');

-- Create the runs table
CREATE TABLE runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_seconds DECIMAL(10,2) NOT NULL,
    distance_meters DECIMAL(10,2) NOT NULL,
    average_pace_minutes_per_km DECIMAL(10,2) NOT NULL,
    path JSONB NOT NULL,
    status run_status NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Additional metrics
    average_speed_kmh DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN duration_seconds > 0 
            THEN (distance_meters / 1000) / (duration_seconds / 3600)
            ELSE 0 
        END
    ) STORED,
    -- Metadata
    weather JSONB,
    notes TEXT,
    -- Constraints
    CONSTRAINT valid_duration CHECK (duration_seconds >= 0),
    CONSTRAINT valid_distance CHECK (distance_meters >= 0),
    CONSTRAINT valid_pace CHECK (average_pace_minutes_per_km >= 0),
    CONSTRAINT valid_times CHECK (end_time >= start_time)
);

-- Create indexes for common queries
CREATE INDEX runs_user_id_idx ON runs(user_id);
CREATE INDEX runs_start_time_idx ON runs(start_time);
CREATE INDEX runs_distance_idx ON runs(distance_meters);
CREATE INDEX runs_status_idx ON runs(status);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_runs_updated_at
    BEFORE UPDATE ON runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to calculate pace
CREATE OR REPLACE FUNCTION calculate_pace(distance_meters DECIMAL, duration_seconds DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF duration_seconds = 0 THEN
        RETURN 0;
    END IF;
    RETURN (duration_seconds / 60) / (distance_meters / 1000);
END;
$$ LANGUAGE plpgsql;

-- Create a view for run statistics
CREATE VIEW run_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_runs,
    SUM(distance_meters) as total_distance_meters,
    SUM(duration_seconds) as total_duration_seconds,
    AVG(average_pace_minutes_per_km) as average_pace,
    MAX(distance_meters) as longest_run_meters,
    MIN(average_pace_minutes_per_km) as best_pace,
    MAX(average_speed_kmh) as max_speed
FROM runs
WHERE status = 'completed'
GROUP BY user_id;

-- Add RLS (Row Level Security) policies
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own runs
CREATE POLICY "Users can view their own runs"
    ON runs FOR SELECT
    USING (auth.uid() = user_id);

-- Policy to allow users to insert their own runs
CREATE POLICY "Users can insert their own runs"
    ON runs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own runs
CREATE POLICY "Users can update their own runs"
    ON runs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own runs
CREATE POLICY "Users can delete their own runs"
    ON runs FOR DELETE
    USING (auth.uid() = user_id); 