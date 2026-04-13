-- Fix the personal_record_history constraint to be more flexible
-- Drop the old constraint
ALTER TABLE personal_record_history DROP CONSTRAINT IF EXISTS valid_history_entry;

-- Create a new, more flexible constraint
ALTER TABLE personal_record_history ADD CONSTRAINT valid_history_entry CHECK (
    (weight_kg IS NOT NULL AND time_minutes IS NULL AND distance_meters IS NULL) OR
    (weight_kg IS NULL AND time_minutes IS NOT NULL AND distance_meters IS NULL) OR
    (weight_kg IS NULL AND time_minutes IS NULL AND distance_meters IS NOT NULL) OR
    (weight_kg IS NULL AND time_minutes IS NULL AND distance_meters IS NULL AND notes IS NOT NULL)
);

-- Update the trigger function to handle the constraint properly
CREATE OR REPLACE FUNCTION add_pr_history_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert history if the current value actually changed
    IF (OLD.current_weight_kg IS DISTINCT FROM NEW.current_weight_kg) OR 
       (OLD.current_time_minutes IS DISTINCT FROM NEW.current_time_minutes) THEN
        
        -- Insert history entry based on exercise type
        IF NEW.exercise_type = 'weight' THEN
            INSERT INTO personal_record_history (pr_id, user_id, weight_kg, updated_at, notes)
            VALUES (NEW.id, NEW.user_id, NEW.current_weight_kg, NOW(), NEW.notes);
        ELSIF NEW.exercise_type IN ('running', 'biking') THEN
            INSERT INTO personal_record_history (pr_id, user_id, time_minutes, updated_at, notes)
            VALUES (NEW.id, NEW.user_id, NEW.current_time_minutes, NOW(), NEW.notes);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';
