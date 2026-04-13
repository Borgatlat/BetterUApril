-- Add push notification fields to profiles table
-- This allows us to store device tokens and notification preferences for each user

-- Add push notification related columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- Create index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_push_enabled ON profiles(push_notifications_enabled);

-- Add notification preferences structure
-- This allows users to customize which types of notifications they want
UPDATE profiles 
SET notification_preferences = '{
  "friend_requests": true,
  "likes": true,
  "comments": true,
  "workout_shares": true,
  "mental_session_shares": true,
  "achievements": true,
  "reminders": true,
  "group_activity": true
}'::jsonb
WHERE notification_preferences = '{}'::jsonb OR notification_preferences IS NULL;

-- Create function to send push notification via Edge Function
-- This will be called by our database trigger
CREATE OR REPLACE FUNCTION send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    user_push_token TEXT;
    user_notifications_enabled BOOLEAN;
    notification_type_enabled BOOLEAN;
    notification_data JSONB;
BEGIN
    -- Get user's push token and notification preferences
    SELECT p.push_token, p.push_notifications_enabled, 
           COALESCE(p.notification_preferences->>NEW.type, 'true')::BOOLEAN as type_enabled
    INTO user_push_token, user_notifications_enabled, notification_type_enabled
    FROM profiles p
    WHERE p.id = NEW.user_id;

    -- Only send push notification if:
    -- 1. User has a push token
    -- 2. Push notifications are enabled
    -- 3. This specific notification type is enabled
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
            'data', NEW.data,
            'type', NEW.type,
            'priority', NEW.priority,
            'notification_id', NEW.id,
            'user_id', NEW.user_id
        );

        -- Call Edge Function to send push notification
        -- Note: Replace 'your-project-url' with your actual Supabase URL
        PERFORM net.http_post(
            url := 'https://kmpufblmilcvortrfilp.supabase.co/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
            ),
            body := notification_data
        );
        
        RAISE LOG 'Push notification sent for notification_id: %', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically send push notifications
-- This trigger fires whenever a new notification is inserted
CREATE OR REPLACE TRIGGER trigger_send_push_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION send_push_notification();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Create function to update notification preferences
CREATE OR REPLACE FUNCTION update_notification_preferences(
    user_id UUID,
    preferences JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE profiles 
    SET notification_preferences = preferences,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to enable/disable push notifications
CREATE OR REPLACE FUNCTION toggle_push_notifications(
    user_id UUID,
    enabled BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE profiles 
    SET push_notifications_enabled = enabled,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create notification (with validation)
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_is_actionable BOOLEAN DEFAULT true,
    p_action_type VARCHAR(50) DEFAULT NULL,
    p_action_data JSONB DEFAULT '{}'::jsonb,
    p_priority INTEGER DEFAULT 1,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User does not exist';
    END IF;
    
    -- Insert notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        is_actionable,
        action_type,
        action_data,
        priority,
        expires_at
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_is_actionable,
        p_action_type,
        p_action_data,
        p_priority,
        p_expires_at
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark specific notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    notification_ids UUID[]
)
RETURNS void AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, updated_at = NOW()
    WHERE id = ANY(notification_ids)
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark all user notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, updated_at = NOW()
    WHERE user_id = auth.uid()
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM notifications
    WHERE user_id = auth.uid()
    AND is_read = false;
    
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION update_notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_push_notifications TO authenticated;
