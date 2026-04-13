-- BetterU League System - Database Triggers
-- Triggers for real-time progress updates when users complete activities

-- ============================================================================
-- TRIGGER: Update challenge progress when workout is completed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_challenge_on_workout()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_challenge_record RECORD;
BEGIN
    -- Only process if workout is 10+ minutes (duration is in SECONDS, so 600 seconds = 10 minutes)
    IF NEW.duration < 600 THEN
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
        AND DATE(NEW.completed_at) BETWEEN start_date AND end_date
    LOOP
        -- Only update if challenge type matches
        IF v_challenge_record.challenge_type IN ('workout_minutes', 'total_workouts') THEN
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

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_challenge_on_workout ON user_workout_logs;
CREATE TRIGGER trigger_update_challenge_on_workout
    AFTER INSERT ON user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_on_workout();

-- ============================================================================
-- TRIGGER: Update challenge progress when mental session is completed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_challenge_on_mental_session()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_challenge_record RECORD;
BEGIN
    -- Get user's team
    SELECT team_id INTO v_team_id
    FROM team_members
    WHERE user_id = NEW.profile_id
    LIMIT 1;
    
    IF v_team_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Update all active challenges for this team
    FOR v_challenge_record IN
        SELECT id, challenge_type, start_date, end_date
        FROM league_challenges
        WHERE status = 'active'
        AND challenge_type = 'mental_sessions'
        AND DATE(NEW.created_at) BETWEEN start_date AND end_date
    LOOP
        PERFORM update_team_challenge_progress(
            v_challenge_record.id,
            v_team_id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_challenge_on_mental_session ON mental_session_logs;
CREATE TRIGGER trigger_update_challenge_on_mental_session
    AFTER INSERT ON mental_session_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_on_mental_session();

-- ============================================================================
-- TRIGGER: Update challenge progress when run is completed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_challenge_on_run()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_challenge_record RECORD;
BEGIN
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
        AND challenge_type IN ('runs', 'distance')
        AND DATE(NEW.created_at) BETWEEN start_date AND end_date
    LOOP
        PERFORM update_team_challenge_progress(
            v_challenge_record.id,
            v_team_id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_challenge_on_run ON runs;
CREATE TRIGGER trigger_update_challenge_on_run
    AFTER INSERT ON runs
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_on_run();

-- ============================================================================
-- TRIGGER: Auto-enroll new teams in active challenges
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_enroll_team_in_challenges()
RETURNS TRIGGER AS $$
BEGIN
    -- Enroll new team in all active challenges
    INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
    SELECT id, NEW.id, 0
    FROM league_challenges
    WHERE status = 'active'
    ON CONFLICT (challenge_id, team_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_enroll_team_in_challenges ON teams;
CREATE TRIGGER trigger_auto_enroll_team_in_challenges
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_team_in_challenges();

