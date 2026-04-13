-- Simple fix: Drop and recreate the constraint to be more flexible
ALTER TABLE personal_record_history DROP CONSTRAINT IF EXISTS valid_history_entry;

-- Create a new constraint that allows either weight OR time OR distance to be set
ALTER TABLE personal_record_history ADD CONSTRAINT valid_history_entry CHECK (
    (weight_kg IS NOT NULL) OR 
    (time_minutes IS NOT NULL) OR 
    (distance_meters IS NOT NULL)
);
