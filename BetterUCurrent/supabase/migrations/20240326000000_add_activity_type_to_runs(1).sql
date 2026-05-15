-- Add activity_type column to runs table
ALTER TABLE runs ADD COLUMN activity_type TEXT DEFAULT 'run' CHECK (activity_type IN ('run', 'walk', 'bike'));

-- Create index for activity_type queries
CREATE INDEX runs_activity_type_idx ON runs(activity_type);

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