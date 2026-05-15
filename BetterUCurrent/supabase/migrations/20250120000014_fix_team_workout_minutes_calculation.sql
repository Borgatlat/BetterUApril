-- Fix team workout minutes calculation to match client-side calculation
-- The previous version divided each duration by 60, then summed, which could cause rounding differences
-- This version sums all durations first, then divides, matching the client calculation exactly

CREATE OR REPLACE FUNCTION calculate_team_workout_minutes(
    p_team_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_total_minutes INTEGER;
BEGIN
    -- Calculate total minutes from:
    -- 1. Gym workouts (user_workout_logs) - duration in seconds
    -- 2. Runs/Walks/Bikes (runs table) - duration_seconds field
    -- 
    -- Sum all durations first, then divide by 60, then floor
    -- This matches the client-side calculation exactly
    -- Also check for 10 minute minimum (600 seconds)
    
    SELECT COALESCE(FLOOR(SUM(total_duration) / 60.0), 0)::INTEGER
    INTO v_total_minutes
    FROM (
        -- Gym workouts from user_workout_logs
        SELECT uwl.duration as total_duration
        FROM user_workout_logs uwl
        JOIN team_members tm ON uwl.user_id = tm.user_id
        WHERE tm.team_id = p_team_id
        AND uwl.duration >= 600  -- 10 minute minimum (600 seconds)
        AND DATE(uwl.completed_at) BETWEEN p_start_date AND p_end_date
        
        UNION ALL
        
        -- Runs, walks, and bikes from runs table
        SELECT r.duration_seconds as total_duration
        FROM runs r
        JOIN team_members tm ON r.user_id = tm.user_id
        WHERE tm.team_id = p_team_id
        AND r.duration_seconds >= 600  -- 10 minute minimum (600 seconds)
        AND r.status = 'completed'  -- Only count completed activities
        AND DATE(r.created_at) BETWEEN p_start_date AND p_end_date
    ) all_activities;
    
    RETURN v_total_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the run trigger to also update workout_minutes challenges
-- Since runs/walks/bikes are now included in workout minutes
CREATE OR REPLACE FUNCTION update_challenge_on_run()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_challenge_record RECORD;
BEGIN
    -- Only process if run is 10+ minutes and completed
    IF NEW.status != 'completed' OR NEW.duration_seconds < 600 THEN
        RETURN NEW;
    END IF;
    
    -- Get user's team
    SELECT team_id INTO v_team_id
    FROM team_members
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    IF v_team_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Update all active challenges for this team
    FOR v_challenge_record IN
        SELECT id, challenge_type, start_date, end_date
        FROM league_challenges
        WHERE status = 'active'
        AND DATE(NEW.created_at) BETWEEN start_date AND end_date
    LOOP
        -- Update if challenge type matches (now includes workout_minutes)
        IF v_challenge_record.challenge_type IN ('runs', 'distance', 'workout_minutes', 'total_workouts') THEN
            -- Recalculate progress
            PERFORM update_team_challenge_progress(
                v_challenge_record.id,
                v_team_id
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- After updating the function, we should recalculate all active challenge progress
-- This ensures all teams have the correct totals (including runs/walks/bikes)
DO $$
DECLARE
    v_challenge_record RECORD;
BEGIN
    -- Recalculate progress for all teams in all active workout_minutes challenges
    FOR v_challenge_record IN
        SELECT id
        FROM league_challenges
        WHERE status = 'active'
        AND challenge_type = 'workout_minutes'
    LOOP
        -- Update progress for all teams in this challenge
        PERFORM update_team_challenge_progress(
            v_challenge_record.id,
            t.id
        )
        FROM teams t;
    END LOOP;
END $$;

