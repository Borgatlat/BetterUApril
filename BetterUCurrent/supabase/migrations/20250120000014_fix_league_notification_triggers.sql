-- BetterU League - Fix Notification Triggers
-- This ensures the push notification trigger exists and works correctly

-- ============================================================================
-- STEP 1: Ensure push notification trigger exists
-- ============================================================================
-- Check if the trigger function exists, if not create it
CREATE OR REPLACE FUNCTION send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    user_push_token TEXT;
    user_notifications_enabled BOOLEAN;
    notification_type_enabled BOOLEAN;
    notification_data JSONB;
BEGIN
    -- Get user's push token and notification preferences
    SELECT p.push_token, 
           COALESCE(p.push_notifications_enabled, true), 
           -- Check if this specific notification type is enabled
           -- Default to true if the key doesn't exist (opt-in by default)
           COALESCE(
               (p.notification_preferences->>NEW.type)::BOOLEAN,
               true  -- Default to enabled if preference not set
           ) as type_enabled
    INTO user_push_token, user_notifications_enabled, notification_type_enabled
    FROM profiles p
    WHERE p.id = NEW.user_id;

    -- Only send push notification if:
    -- 1. User has a push token
    -- 2. Push notifications are enabled (defaults to true)
    -- 3. This specific notification type is enabled (defaults to true)
    -- 4. This is a new notification (not an update)
    IF user_push_token IS NOT NULL 
       AND user_notifications_enabled = true 
       AND notification_type_enabled = true
       AND TG_OP = 'INSERT' THEN
        
        -- Prepare notification data for the Edge Function
        notification_data := jsonb_build_object(
            'token', user_push_token,
            'title', NEW.title,
            'body', NEW.message,
            'data', COALESCE(NEW.data, '{}'::jsonb),
            'type', NEW.type,
            'priority', COALESCE(NEW.priority, 1),
            'notification_id', NEW.id,
            'user_id', NEW.user_id
        );

        -- Call Edge Function to send push notification
        -- Using pg_net extension if available, otherwise fallback
        BEGIN
            PERFORM net.http_post(
                url := 'https://kmpufblmilcvortrfilp.supabase.co/functions/v1/send-push-notification',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
                ),
                body := notification_data
            );
            
            RAISE LOG 'Push notification sent for notification_id: %, user_id: %, type: %', 
                NEW.id, NEW.user_id, NEW.type;
        EXCEPTION WHEN OTHERS THEN
            -- If net.http_post fails, log the error but don't fail the transaction
            RAISE WARNING 'Failed to send push notification via net.http_post: %', SQLERRM;
            -- The notification row was still created, which is good
        END;
    ELSE
        -- Log why notification wasn't sent (for debugging)
        RAISE LOG 'Push notification skipped for notification_id: %, user_id: %, type: % - token: %, enabled: %, type_enabled: %', 
            NEW.id, NEW.user_id, NEW.type,
            CASE WHEN user_push_token IS NULL THEN 'missing' ELSE 'present' END,
            user_notifications_enabled,
            notification_type_enabled;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;
CREATE TRIGGER trigger_send_push_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION send_push_notification();

-- ============================================================================
-- STEP 2: Add debugging function to test notifications
-- ============================================================================
CREATE OR REPLACE FUNCTION test_league_notification(
    p_user_id UUID DEFAULT NULL,
    p_test_type VARCHAR(50) DEFAULT 'team_join_request'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_has_token BOOLEAN;
    user_enabled BOOLEAN;
    actual_user_id UUID;
BEGIN
    -- Determine which user ID to use
    -- If p_user_id is provided, use it; otherwise try auth.uid(); otherwise error
    actual_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Validate user_id is not null
    IF actual_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required. Please provide a user_id parameter or ensure you are authenticated.';
    END IF;
    
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = actual_user_id) THEN
        RAISE EXCEPTION 'User with ID % does not exist', actual_user_id;
    END IF;
    
    -- Check user's notification setup
    SELECT 
        push_token IS NOT NULL,
        COALESCE(push_notifications_enabled, true)
    INTO user_has_token, user_enabled
    FROM profiles
    WHERE id = actual_user_id;
    
    -- Create a test notification
    SELECT send_league_notification(
        actual_user_id,
        p_test_type,
        'Test Notification',
        'This is a test notification to verify the system is working.',
        jsonb_build_object('test', true),
        'navigate',
        jsonb_build_object('screen', '/(tabs)/league'),
        2
    ) INTO notification_id;
    
    -- Return info about the test
    RAISE NOTICE 'Test notification created: id=%, user_id=%, user_has_token=%, user_enabled=%', 
        notification_id, actual_user_id, user_has_token, user_enabled;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_league_notification(UUID, VARCHAR) TO authenticated;

-- ============================================================================
-- STEP 3: Verify triggers are set up correctly
-- ============================================================================
-- This query will show all triggers on the notifications table
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'notifications'::regclass
    AND tgname = 'trigger_send_push_notification';
    
    IF trigger_count = 0 THEN
        RAISE WARNING 'Push notification trigger not found! Creating it now...';
    ELSE
        RAISE NOTICE 'Push notification trigger found and active';
    END IF;
END $$;

