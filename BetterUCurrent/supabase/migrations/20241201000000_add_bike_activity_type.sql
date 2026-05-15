-- Add 'bike' as a valid activity type to the runs table
-- First, drop the existing constraint
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_activity_type_check;

-- Add the new constraint that includes 'bike'
ALTER TABLE runs ADD CONSTRAINT runs_activity_type_check CHECK (activity_type IN ('run', 'walk', 'bike'));

-- Update the run_statistics view to include activity_type
DROP VIEW IF EXISTS run_statistics;
CREATE VIEW run_statistics AS
SELECT 
    user_id,
    activity_type,
    COUNT(*) as total_activities,
    SUM(distance_meters) as total_distance_meters,
    SUM(duration_seconds) as total_duration_seconds,
    AVG(average_pace_minutes_per_km) as average_pace,
    MAX(distance_meters) as longest_activity_meters,
    MIN(average_pace_minutes_per_km) as best_pace,
    MAX(average_speed_kmh) as max_speed
FROM runs
WHERE status = 'completed'
GROUP BY user_id, activity_type;
