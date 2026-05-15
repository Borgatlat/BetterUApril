-- BetterU League - Fix Join Request Notification Trigger with Debugging
-- This adds error handling and logging to help debug why notifications aren't firing

-- ============================================================================
-- STEP 1: Update notify_team_on_join_request with better error handling
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_team_on_join_request()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_requester_name TEXT;
    v_owner_admin_id UUID;
    v_owner_admin_count INTEGER;
    v_notification_id UUID;
    v_error_message TEXT;
BEGIN
    -- Only notify on new join requests (INSERT)
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        RAISE LOG 'Join request notification trigger fired: request_id=%, team_id=%, user_id=%', 
            NEW.id, NEW.team_id, NEW.user_id;
        
        -- Get team name
        SELECT name INTO v_team_name
        FROM teams
        WHERE id = NEW.team_id;
        
        IF v_team_name IS NULL THEN
            RAISE WARNING 'Team not found for team_id: %', NEW.team_id;
        END IF;
        
        -- Get requester's name
        SELECT COALESCE(full_name, username, 'Someone') INTO v_requester_name
        FROM profiles
        WHERE id = NEW.user_id;
        
        -- Count owners/admins
        SELECT COUNT(*) INTO v_owner_admin_count
        FROM team_members
        WHERE team_id = NEW.team_id
        AND role IN ('owner', 'admin');
        
        RAISE LOG 'Found % owners/admins for team_id: %', v_owner_admin_count, NEW.team_id;
        
        -- Notify all team owners and admins
        IF v_owner_admin_count > 0 THEN
            FOR v_owner_admin_id IN
                SELECT user_id
                FROM team_members
                WHERE team_id = NEW.team_id
                AND role IN ('owner', 'admin')
            LOOP
                BEGIN
                    -- Try to send notification
                    SELECT send_league_notification(
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
                    ) INTO v_notification_id;
                    
                    RAISE LOG 'Notification sent successfully: notification_id=%, to_user_id=%', 
                        v_notification_id, v_owner_admin_id;
                EXCEPTION WHEN OTHERS THEN
                    -- Log the error but don't fail the transaction
                    v_error_message := SQLERRM;
                    RAISE WARNING 'Failed to send notification to user_id %: %', v_owner_admin_id, v_error_message;
                END;
            END LOOP;
        ELSE
            RAISE WARNING 'No owners/admins found for team_id: %, skipping notifications', NEW.team_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Ensure the trigger exists
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_team_on_join_request ON team_join_requests;
CREATE TRIGGER trigger_notify_team_on_join_request
    AFTER INSERT ON team_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_team_on_join_request();

-- ============================================================================
-- STEP 3: Create a test function to manually trigger notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION test_join_request_notification(
    p_team_id UUID,
    p_requester_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
    v_request_id UUID;
BEGIN
    -- Create a test join request
    INSERT INTO team_join_requests (team_id, user_id, status)
    VALUES (p_team_id, p_requester_user_id, 'pending')
    RETURNING id INTO v_request_id;
    
    v_result := 'Test join request created with id: ' || v_request_id::text || 
                '. Check notifications table and logs for results.';
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_join_request_notification(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Verify trigger is set up
-- ============================================================================
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'trigger_notify_team_on_join_request'
        AND tgrelid = 'team_join_requests'::regclass
    ) INTO trigger_exists;
    
    IF trigger_exists THEN
        RAISE NOTICE '✅ Join request notification trigger is active';
    ELSE
        RAISE WARNING '❌ Join request notification trigger NOT FOUND!';
    END IF;
END $$;

