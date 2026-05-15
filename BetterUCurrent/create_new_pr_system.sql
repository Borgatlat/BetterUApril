-- Drop the old personal_records table if it exists
DROP TABLE IF EXISTS personal_records CASCADE;

-- Create new comprehensive PR table
CREATE TABLE personal_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    exercise_type TEXT NOT NULL CHECK (exercise_type IN ('weight', 'running', 'biking')),
    
    -- Weight-based PRs (stored in kg)
    current_weight_kg DECIMAL(10,2),
    target_weight_kg DECIMAL(10,2),
    
    -- Running/biking PRs (stored in minutes)
    current_time_minutes DECIMAL(10,2),
    target_time_minutes DECIMAL(10,2),
    
    -- Distance for running/biking (stored in meters)
    distance_meters DECIMAL(10,2),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_weight_pr CHECK (
        exercise_type = 'weight' AND current_weight_kg IS NOT NULL AND target_weight_kg IS NOT NULL
        OR exercise_type IN ('running', 'biking') AND current_time_minutes IS NOT NULL AND target_time_minutes IS NOT NULL
    ),
    CONSTRAINT valid_distance CHECK (distance_meters IS NULL OR distance_meters > 0)
);

-- Create PR history table for tracking updates over time
CREATE TABLE personal_record_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pr_id UUID NOT NULL REFERENCES personal_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Weight-based PRs (stored in kg)
    weight_kg DECIMAL(10,2),
    
    -- Running/biking PRs (stored in minutes)
    time_minutes DECIMAL(10,2),
    
    -- Distance for running/biking (stored in meters)
    distance_meters DECIMAL(10,2),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    notes TEXT,
    
    -- Constraints
    CONSTRAINT valid_history_entry CHECK (
        (weight_kg IS NOT NULL AND time_minutes IS NULL AND distance_meters IS NULL) OR
        (weight_kg IS NULL AND time_minutes IS NOT NULL AND distance_meters IS NULL) OR
        (weight_kg IS NULL AND time_minutes IS NULL AND distance_meters IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX personal_records_user_id_idx ON personal_records(user_id);
CREATE INDEX personal_records_exercise_type_idx ON personal_records(exercise_type);
CREATE INDEX personal_record_history_pr_id_idx ON personal_record_history(pr_id);
CREATE INDEX personal_record_history_user_id_idx ON personal_record_history(user_id);
CREATE INDEX personal_record_history_updated_at_idx ON personal_record_history(updated_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_personal_records_updated_at
    BEFORE UPDATE ON personal_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_record_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for personal_records
CREATE POLICY "Users can view their own PRs" ON personal_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PRs" ON personal_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PRs" ON personal_records
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PRs" ON personal_records
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for personal_record_history
CREATE POLICY "Users can view their own PR history" ON personal_record_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PR history" ON personal_record_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PR history" ON personal_record_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PR history" ON personal_record_history
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically add history entry when PR is updated
CREATE OR REPLACE FUNCTION add_pr_history_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert history entry based on exercise type
    IF NEW.exercise_type = 'weight' THEN
        INSERT INTO personal_record_history (pr_id, user_id, weight_kg, updated_at, notes)
        VALUES (NEW.id, NEW.user_id, NEW.current_weight_kg, NOW(), NEW.notes);
    ELSIF NEW.exercise_type IN ('running', 'biking') THEN
        INSERT INTO personal_record_history (pr_id, user_id, time_minutes, updated_at, notes)
        VALUES (NEW.id, NEW.user_id, NEW.current_time_minutes, NOW(), NEW.notes);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically add history entries
CREATE TRIGGER add_pr_history_trigger
    AFTER UPDATE ON personal_records
    FOR EACH ROW
    WHEN (OLD.current_weight_kg IS DISTINCT FROM NEW.current_weight_kg OR 
          OLD.current_time_minutes IS DISTINCT FROM NEW.current_time_minutes)
    EXECUTE FUNCTION add_pr_history_entry();
