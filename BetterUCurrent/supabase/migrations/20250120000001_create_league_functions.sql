-- BetterU League System - Database Functions
-- Functions for calculating progress, awarding trophies, and managing challenges

-- ============================================================================
-- FUNCTION: Calculate team workout minutes for a challenge
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_team_workout_minutes(
    p_team_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_total_minutes INTEGER;
BEGIN
    -- duration is stored in SECONDS, so divide by 60 to get minutes
    -- Also check for 10 minute minimum (600 seconds)
    SELECT COALESCE(SUM(uwl.duration / 60), 0)::INTEGER
    INTO v_total_minutes
    FROM user_workout_logs uwl
    JOIN team_members tm ON uwl.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
    AND uwl.duration >= 600  -- 10 minute minimum (600 seconds)
    AND DATE(uwl.completed_at) BETWEEN p_start_date AND p_end_date;
    
    RETURN v_total_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Calculate team total workouts for a challenge
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_team_total_workouts(
    p_team_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_total_workouts INTEGER;
BEGIN
    -- duration is stored in SECONDS, so 10 minutes = 600 seconds
    SELECT COUNT(*)::INTEGER
    INTO v_total_workouts
    FROM user_workout_logs uwl
    JOIN team_members tm ON uwl.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
    AND uwl.duration >= 600  -- 10 minute minimum (600 seconds)
    AND DATE(uwl.completed_at) BETWEEN p_start_date AND p_end_date;
    
    RETURN v_total_workouts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Update team challenge progress
-- ============================================================================
CREATE OR REPLACE FUNCTION update_team_challenge_progress(
    p_challenge_id UUID,
    p_team_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_challenge_type VARCHAR(50);
    v_start_date DATE;
    v_end_date DATE;
    v_current_value INTEGER;
BEGIN
    -- Get challenge details
    SELECT challenge_type, start_date, end_date
    INTO v_challenge_type, v_start_date, v_end_date
    FROM league_challenges
    WHERE id = p_challenge_id;
    
    -- Calculate progress based on challenge type
    CASE v_challenge_type
        WHEN 'workout_minutes' THEN
            SELECT calculate_team_workout_minutes(p_team_id, v_start_date, v_end_date)
            INTO v_current_value;
            
        WHEN 'total_workouts' THEN
            SELECT calculate_team_total_workouts(p_team_id, v_start_date, v_end_date)
            INTO v_current_value;
            
        WHEN 'mental_sessions' THEN
            SELECT COUNT(*)::INTEGER
            INTO v_current_value
            FROM mental_session_logs msl
            JOIN team_members tm ON msl.profile_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND DATE(msl.created_at) BETWEEN v_start_date AND v_end_date;
            
        WHEN 'runs' THEN
            SELECT COUNT(*)::INTEGER
            INTO v_current_value
            FROM runs r
            JOIN team_members tm ON r.user_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND DATE(r.created_at) BETWEEN v_start_date AND v_end_date;
            
        WHEN 'streak' THEN
            SELECT COALESCE(MAX(bs.current_streak), 0)::INTEGER
            INTO v_current_value
            FROM betteru_streaks bs
            JOIN team_members tm ON bs.profile_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND bs.last_activity_date BETWEEN v_start_date AND v_end_date;
            
        WHEN 'prs' THEN
            SELECT COUNT(*)::INTEGER
            INTO v_current_value
            FROM pr_history pr
            JOIN team_members tm ON pr.user_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND DATE(pr.achieved_at) BETWEEN v_start_date AND v_end_date;
            
        WHEN 'calories' THEN
            SELECT COALESCE(SUM(ct.consumed), 0)::INTEGER
            INTO v_current_value
            FROM calorie_tracking ct
            JOIN team_members tm ON ct.profile_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND ct.date BETWEEN v_start_date AND v_end_date;
            
        WHEN 'distance' THEN
            SELECT COALESCE(SUM(r.distance), 0)::INTEGER
            INTO v_current_value
            FROM runs r
            JOIN team_members tm ON r.user_id = tm.user_id
            WHERE tm.team_id = p_team_id
            AND DATE(r.created_at) BETWEEN v_start_date AND v_end_date;
            
        ELSE
            v_current_value := 0;
    END CASE;
    
    -- Update or insert participant record
    INSERT INTO team_challenge_participants (challenge_id, team_id, current_value, last_updated)
    VALUES (p_challenge_id, p_team_id, v_current_value, NOW())
    ON CONFLICT (challenge_id, team_id)
    DO UPDATE SET
        current_value = v_current_value,
        last_updated = NOW();
        
    -- Update rank
    -- Use RANK() instead of ROW_NUMBER() to handle ties correctly
    -- Teams with the same current_value will have the same rank
    -- This matches the client-side calculation in the leaderboard
    UPDATE team_challenge_participants tcp
    SET rank = subq.rank
    FROM (
        SELECT 
            team_id,
            RANK() OVER (ORDER BY current_value DESC, last_updated ASC) as rank
        FROM team_challenge_participants
        WHERE challenge_id = p_challenge_id
    ) subq
    WHERE tcp.team_id = subq.team_id 
    AND tcp.challenge_id = p_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Award challenge trophies
-- ============================================================================
CREATE OR REPLACE FUNCTION award_challenge_trophies(p_challenge_id UUID)
RETURNS VOID AS $$
DECLARE
    v_team_record RECORD;
    v_base_trophies INTEGER;
    v_multiplier DECIMAL(3,2);
    v_final_trophies INTEGER;
BEGIN
    -- Update final rankings
    UPDATE team_challenge_participants tcp
    SET final_rank = subq.rank,
        final_value = subq.current_value
    FROM (
        SELECT 
            team_id,
            current_value,
            ROW_NUMBER() OVER (ORDER BY current_value DESC, last_updated ASC) as rank
        FROM team_challenge_participants
        WHERE challenge_id = p_challenge_id
    ) subq
    WHERE tcp.team_id = subq.team_id 
    AND tcp.challenge_id = p_challenge_id;
    
    -- Award trophies
    FOR v_team_record IN 
        SELECT 
            tcp.team_id,
            tcp.final_rank,
            t.current_league,
            t.total_trophies
        FROM team_challenge_participants tcp
        JOIN teams t ON tcp.team_id = t.id
        WHERE tcp.challenge_id = p_challenge_id
        ORDER BY tcp.final_rank
    LOOP
        -- Calculate base trophies
        v_base_trophies := CASE
            WHEN v_team_record.final_rank = 1 THEN 100
            WHEN v_team_record.final_rank = 2 THEN 25
            WHEN v_team_record.final_rank = 3 THEN 10
            WHEN v_team_record.final_rank BETWEEN 4 AND 10 THEN 5
            WHEN v_team_record.final_rank BETWEEN 11 AND 25 THEN 1
            ELSE 0
        END;
        
        -- Get league multiplier
        v_multiplier := CASE v_team_record.current_league
            WHEN 'Master' THEN 1.5
            WHEN 'Diamond' THEN 1.4
            WHEN 'Platinum' THEN 1.3
            WHEN 'Gold' THEN 1.2
            WHEN 'Silver' THEN 1.1
            ELSE 1.0
        END;
        
        -- Calculate final trophies
        v_final_trophies := ROUND(v_base_trophies * v_multiplier)::INTEGER;
        
        -- Update participant record
        UPDATE team_challenge_participants
        SET base_trophies = v_base_trophies,
            trophies_earned = v_final_trophies
        WHERE challenge_id = p_challenge_id
        AND team_id = v_team_record.team_id;
        
        -- Add to trophy history
        INSERT INTO team_trophy_history (
            team_id,
            challenge_id,
            base_trophies,
            multiplier,
            trophies_earned,
            rank_achieved
        ) VALUES (
            v_team_record.team_id,
            p_challenge_id,
            v_base_trophies,
            v_multiplier,
            v_final_trophies,
            v_team_record.final_rank
        );
        
        -- Update team total trophies
        UPDATE teams
        SET total_trophies = (
            SELECT COALESCE(SUM(trophies_earned), 0)
            FROM team_trophy_history
            WHERE team_id = teams.id
        )
        WHERE id = v_team_record.team_id;
        
        -- Update league tier
        UPDATE teams
        SET current_league = CASE
            WHEN total_trophies >= 10000 THEN 'Master'
            WHEN total_trophies >= 5000 THEN 'Diamond'
            WHEN total_trophies >= 1500 THEN 'Platinum'
            WHEN total_trophies >= 500 THEN 'Gold'
            WHEN total_trophies >= 100 THEN 'Silver'
            ELSE 'Bronze'
        END,
        best_league = CASE
            WHEN current_league = 'Master' AND best_league != 'Master' THEN 'Master'
            WHEN current_league = 'Diamond' AND best_league NOT IN ('Master', 'Diamond') THEN 'Diamond'
            WHEN current_league = 'Platinum' AND best_league NOT IN ('Master', 'Diamond', 'Platinum') THEN 'Platinum'
            WHEN current_league = 'Gold' AND best_league NOT IN ('Master', 'Diamond', 'Platinum', 'Gold') THEN 'Gold'
            WHEN current_league = 'Silver' AND best_league = 'Bronze' THEN 'Silver'
            ELSE best_league
        END
        WHERE id = v_team_record.team_id;
    END LOOP;
    
    -- Mark challenge as completed
    UPDATE league_challenges
    SET status = 'completed'
    WHERE id = p_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Create monthly challenge
-- ============================================================================
CREATE OR REPLACE FUNCTION create_monthly_challenge()
RETURNS UUID AS $$
DECLARE
    v_challenge_type VARCHAR(50);
    v_month_name VARCHAR(20);
    v_start_date DATE;
    v_end_date DATE;
    v_challenge_id UUID;
BEGIN
    -- Get current month info
    v_start_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    v_month_name := TO_CHAR(CURRENT_DATE, 'Month YYYY');
    
    -- Rotate challenge types (modulo 7 for 7 different types)
    v_challenge_type := CASE 
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 1 THEN 'workout_minutes'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 2 THEN 'total_workouts'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 3 THEN 'streak'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 4 THEN 'mental_sessions'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 5 THEN 'runs'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 6 THEN 'prs'
        ELSE 'workout_minutes'
    END;
    
    -- Create challenge
    INSERT INTO league_challenges (
        challenge_type,
        name,
        description,
        start_date,
        end_date,
        status,
        prize_description
    ) VALUES (
        v_challenge_type,
        TRIM(v_month_name) || ' ' || INITCAP(REPLACE(v_challenge_type, '_', ' ')) || ' Challenge',
        'Compete with teams worldwide in this month''s challenge!',
        v_start_date,
        v_end_date,
        'active',
        'Top 3 teams get 1 month Premium free per member!'
    )
    RETURNING id INTO v_challenge_id;
    
    -- Auto-enroll all existing teams
    INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
    SELECT v_challenge_id, id, 0
    FROM teams
    ON CONFLICT (challenge_id, team_id) DO NOTHING;
    
    RETURN v_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

