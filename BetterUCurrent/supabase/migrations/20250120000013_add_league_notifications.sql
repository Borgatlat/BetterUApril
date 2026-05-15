-- BetterU League - Add Push Notifications for League Events
-- This migration adds league notification types and triggers to send notifications
-- for join requests, trophy awards, and other league events

-- ============================================================================
-- STEP 1: Add league notification types to notifications table
-- ============================================================================
-- We need to alter the CHECK constraint to include new league notification types
-- Since we can't directly modify a CHECK constraint, we'll drop and recreate it

-- First, check for any invalid notification types and handle them
-- This prevents the constraint violation error
DO $$
DECLARE
    invalid_types TEXT[];
BEGIN
    -- Find any notification types that aren't in our allowed list
    SELECT ARRAY_AGG(DISTINCT type)
    INTO invalid_types
    FROM notifications
    WHERE type NOT IN (
        'friend_request',
        'friend_request_accepted',
        'comment',
        'like',
        'mention',
        'group_invitation',
        'group_join_request',
        'group_activity',
        'goal_completion',
        'streak_milestone',
        'achievement',
        'personal_record',
        'workout_reminder',
        'mental_reminder',
        'hydration_reminder',
        'weekly_progress',
        'monthly_stats',
        'ai_recommendation',
        'motivational_quote',
        'community_highlight',
        'challenge_invitation',
        'leaderboard_update',
        'points_earned',
        'level_up',
        'reward_unlocked',
        'sync_status',
        'app_update',
        'premium_feature',
        'local_event',
        'virtual_meetup',
        'community_challenge',
        'workout_share',
        'mental_session_share',
        'nudge_workout',
        'nudge_run',
        'nudge_mental',
        'daily_reminder',
        'team_join_request',
        'team_join_request_accepted',
        'team_invitation',
        'team_invitation_accepted',
        'team_trophy_awarded',
        'team_challenge_started',
        'team_rank_changed',
        'team_member_joined',
        'team_member_left'
    );
    
    -- If there are invalid types, update them to a safe default or delete
    IF invalid_types IS NOT NULL AND array_length(invalid_types, 1) > 0 THEN
        RAISE NOTICE 'Found invalid notification types: %', invalid_types;
        -- Update invalid types to 'achievement' as a safe fallback
        UPDATE notifications
        SET type = 'achievement'
        WHERE type = ANY(invalid_types);
        RAISE NOTICE 'Updated invalid notification types to "achievement"';
    END IF;
END $$;

-- Now drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate with ALL notification types including existing ones and new league ones
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    -- Original notification types
    'friend_request',
    'friend_request_accepted',
    'comment',
    'like',
    'mention',
    'group_invitation',
    'group_join_request',
    'group_activity',
    'goal_completion',
    'streak_milestone',
    'achievement',
    'personal_record',
    'workout_reminder',
    'mental_reminder',
    'hydration_reminder',
    'weekly_progress',
    'monthly_stats',
    'ai_recommendation',
    'motivational_quote',
    'community_highlight',
    'challenge_invitation',
    'leaderboard_update',
    'points_earned',
    'level_up',
    'reward_unlocked',
    'sync_status',
    'app_update',
    'premium_feature',
    'local_event',
    'virtual_meetup',
    'community_challenge',
    -- Added in nudge migration (20250211000002)
    'workout_share',
    'mental_session_share',
    'nudge_workout',
    'nudge_run',
    'nudge_mental',
    'daily_reminder',
    -- League notification types (new)
    'team_join_request',
    'team_join_request_accepted',
    'team_invitation',
    'team_invitation_accepted',
    'team_trophy_awarded',
    'team_challenge_started',
    'team_rank_changed',
    'team_member_joined',
    'team_member_left'
));

-- ============================================================================
-- STEP 2: Create helper function to send league notifications
-- ============================================================================
-- This function will be called from triggers to send notifications
-- It uses the existing create_notification function and then triggers push via Edge Function
CREATE OR REPLACE FUNCTION send_league_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_action_type VARCHAR(50) DEFAULT NULL,
    p_action_data JSONB DEFAULT '{}'::jsonb,
    p_priority INTEGER DEFAULT 2
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Create the notification using the existing function
    SELECT create_notification(
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        true, -- is_actionable
        p_action_type,
        p_action_data,
        p_priority,
        NULL -- expires_at
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_league_notification(UUID, VARCHAR, VARCHAR, TEXT, JSONB, VARCHAR, JSONB, INTEGER) TO authenticated;

-- ============================================================================
-- STEP 3: Update handle_accepted_join_request to send notification
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_accepted_join_request()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_team_id UUID;
    v_accepter_name TEXT;
BEGIN
    -- When a join request is accepted, add user to team
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Check if team is full
        IF (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id) >= 20 THEN
            RAISE EXCEPTION 'Team is full (20/20 members)';
        END IF;
        
        -- Check if user already has a team
        IF EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'User is already in a team';
        END IF;
        
        -- Get team name for notification
        SELECT name INTO v_team_name
        FROM teams
        WHERE id = NEW.team_id;
        
        -- Get accepter's name (the person who accepted the request)
        -- This would be the team owner/admin who updated the request
        -- We'll use the current user from auth context
        SELECT COALESCE(full_name, username, 'Team Admin') INTO v_accepter_name
        FROM profiles
        WHERE id = auth.uid();
        
        -- Add user to team
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (NEW.team_id, NEW.user_id, 'member')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Auto-enroll team in active challenges
        INSERT INTO team_challenge_participants (challenge_id, team_id, current_value)
        SELECT id, NEW.team_id, 0
        FROM league_challenges
        WHERE status = 'active'
        ON CONFLICT (challenge_id, team_id) DO NOTHING;
        
        -- Send notification to the user whose request was accepted
        PERFORM send_league_notification(
            NEW.user_id, -- Notify the person who requested to join
            'team_join_request_accepted',
            'Join Request Accepted! 🎉',
            COALESCE(v_team_name, 'A team') || ' has accepted your join request!',
            jsonb_build_object(
                'team_id', NEW.team_id,
                'team_name', v_team_name,
                'accepted_by', auth.uid()
            ),
            'navigate',
            jsonb_build_object(
                'screen', '/league/team/' || NEW.team_id::text
            ),
            2 -- Medium priority
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Create trigger for new join requests (notify team owners/admins)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_team_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_requester_name TEXT;
    v_owner_admin_id UUID;
BEGIN
    -- Only notify on new join requests (INSERT)
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        -- Get team name
        SELECT name INTO v_team_name
        FROM teams
        WHERE id = NEW.team_id;
        
        -- Get requester's name
        SELECT COALESCE(full_name, username, 'Someone') INTO v_requester_name
        FROM profiles
        WHERE id = NEW.user_id;
        
        -- Notify all team owners and admins
        FOR v_owner_admin_id IN
            SELECT user_id
            FROM team_members
            WHERE team_id = NEW.team_id
            AND role IN ('owner', 'admin')
        LOOP
            PERFORM send_league_notification(
                v_owner_admin_id,
                'team_join_request',
                'New Join Request',
                v_requester_name || ' wants to join ' || COALESCE(v_team_name, 'your team'),
                jsonb_build_object(
                    'team_id', NEW.team_id,
                    'team_name', v_team_name,
                    'requester_id', NEW.user_id,
                    'requester_name', v_requester_name,
                    'request_id', NEW.id
                ),
                'navigate',
                jsonb_build_object(
                    'screen', '/league/manage-team/' || NEW.team_id::text,
                    'params', jsonb_build_object('tab', 'requests')
                ),
                2 -- Medium priority
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_team_on_join_request ON team_join_requests;
CREATE TRIGGER trigger_notify_team_on_join_request
    AFTER INSERT ON team_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_team_on_join_request();

-- ============================================================================
-- STEP 5: Update award_challenge_trophies to send notifications
-- ============================================================================
-- We'll modify the existing function to send notifications when trophies are awarded
-- This requires reading the current function and adding notification logic
CREATE OR REPLACE FUNCTION award_challenge_trophies(p_challenge_id UUID)
RETURNS VOID AS $$
DECLARE
    v_team_record RECORD;
    v_base_trophies INTEGER;
    v_multiplier DECIMAL(3,2);
    v_final_trophies INTEGER;
    v_challenge_name TEXT;
    v_team_name TEXT;
    v_member_id UUID;
    v_rank_text TEXT;
BEGIN
    -- Get challenge name
    SELECT name INTO v_challenge_name
    FROM league_challenges
    WHERE id = p_challenge_id;
    
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
    
    -- Award trophies and send notifications
    FOR v_team_record IN 
        SELECT 
            tcp.team_id,
            tcp.final_rank,
            t.current_league,
            t.total_trophies,
            t.name as team_name
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
        
        -- Update league tier (existing logic)
        UPDATE teams
        SET current_league = CASE
            WHEN total_trophies >= 10000 THEN 'Master'
            WHEN total_trophies >= 5000 THEN 'Diamond'
            WHEN total_trophies >= 2500 THEN 'Platinum'
            WHEN total_trophies >= 1000 THEN 'Gold'
            WHEN total_trophies >= 500 THEN 'Silver'
            WHEN total_trophies >= 100 THEN 'Bronze'
            ELSE 'Bronze'
        END
        WHERE id = v_team_record.team_id;
        
        -- Send notification to all team members if trophies were earned
        IF v_final_trophies > 0 THEN
            -- Format rank text
            v_rank_text := CASE
                WHEN v_team_record.final_rank = 1 THEN '1st place'
                WHEN v_team_record.final_rank = 2 THEN '2nd place'
                WHEN v_team_record.final_rank = 3 THEN '3rd place'
                ELSE v_team_record.final_rank::text || 'th place'
            END;
            
            -- Notify all team members
            FOR v_member_id IN
                SELECT user_id
                FROM team_members
                WHERE team_id = v_team_record.team_id
            LOOP
                PERFORM send_league_notification(
                    v_member_id,
                    'team_trophy_awarded',
                    CASE
                        WHEN v_team_record.final_rank = 1 THEN '🏆 Your Team Won!'
                        WHEN v_team_record.final_rank <= 3 THEN '🎉 Your Team Placed!'
                        ELSE '🏅 Challenge Complete!'
                    END,
                    COALESCE(v_team_record.team_name, 'Your team') || ' finished ' || v_rank_text || 
                    ' in ' || COALESCE(v_challenge_name, 'the challenge') || 
                    ' and earned ' || v_final_trophies::text || ' trophies!',
                    jsonb_build_object(
                        'team_id', v_team_record.team_id,
                        'team_name', v_team_record.team_name,
                        'challenge_id', p_challenge_id,
                        'challenge_name', v_challenge_name,
                        'rank', v_team_record.final_rank,
                        'trophies_earned', v_final_trophies
                    ),
                    'navigate',
                    jsonb_build_object(
                        'screen', '/league/team/' || v_team_record.team_id::text
                    ),
                    3 -- High priority for trophy awards
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Create trigger for when new challenges start
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_teams_on_challenge_start()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_member_id UUID;
BEGIN
    -- When a challenge status is 'active' (on INSERT or UPDATE to active)
    IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'active') THEN
        -- Notify all teams that are enrolled or should be enrolled
        FOR v_team_id IN
            SELECT DISTINCT t.id
            FROM teams t
            WHERE EXISTS (
                SELECT 1 FROM team_members tm WHERE tm.team_id = t.id
            )
        LOOP
            -- Notify all members of each team
            FOR v_member_id IN
                SELECT user_id
                FROM team_members
                WHERE team_id = v_team_id
            LOOP
                PERFORM send_league_notification(
                    v_member_id,
                    'team_challenge_started',
                    'New Challenge Started! 🎯',
                    COALESCE(NEW.name, 'A new challenge') || ' has begun! Start working out to earn trophies for your team.',
                    jsonb_build_object(
                        'challenge_id', NEW.id,
                        'challenge_name', NEW.name,
                        'challenge_type', NEW.challenge_type,
                        'start_date', NEW.start_date,
                        'end_date', NEW.end_date,
                        'prize_description', NEW.prize_description
                    ),
                    'navigate',
                    jsonb_build_object(
                        'screen', '/(tabs)/league'
                    ),
                    2 -- Medium priority
                );
            END LOOP;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers (both INSERT and UPDATE)
DROP TRIGGER IF EXISTS trigger_notify_teams_on_challenge_start_insert ON league_challenges;
DROP TRIGGER IF EXISTS trigger_notify_teams_on_challenge_start_update ON league_challenges;
CREATE TRIGGER trigger_notify_teams_on_challenge_start_insert
    AFTER INSERT ON league_challenges
    FOR EACH ROW
    EXECUTE FUNCTION notify_teams_on_challenge_start();
CREATE TRIGGER trigger_notify_teams_on_challenge_start_update
    AFTER UPDATE ON league_challenges
    FOR EACH ROW
    EXECUTE FUNCTION notify_teams_on_challenge_start();

-- ============================================================================
-- STEP 7: Update notification preferences to include league types
-- ============================================================================
-- Update existing profiles to have league notification preferences enabled by default
UPDATE profiles 
SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || '{
    "team_join_request": true,
    "team_join_request_accepted": true,
    "team_invitation": true,
    "team_invitation_accepted": true,
    "team_trophy_awarded": true,
    "team_challenge_started": true,
    "team_rank_changed": true,
    "team_member_joined": true,
    "team_member_left": true
}'::jsonb
WHERE notification_preferences IS NULL 
   OR notification_preferences = '{}'::jsonb
   OR NOT (notification_preferences ? 'team_join_request');

