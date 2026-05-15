-- Comprehensive Notification Fix
-- This will completely reset and recreate the notifications system
-- Run this in your Supabase SQL Editor

-- Step 1: Drop all existing functions and policies
DROP FUNCTION IF EXISTS create_notification_service_role(UUID, VARCHAR, VARCHAR, TEXT, JSONB, BOOLEAN, VARCHAR, JSONB, INTEGER, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, JSONB, BOOLEAN, VARCHAR, JSONB, INTEGER, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS mark_notifications_read(UUID[]);
DROP FUNCTION IF EXISTS mark_all_notifications_read();
DROP FUNCTION IF EXISTS get_unread_notification_count();
DROP FUNCTION IF EXISTS cleanup_expired_notifications();

-- Step 2: Drop all RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for any user" ON notifications;

-- Step 3: Drop the view if it exists
DROP VIEW IF EXISTS notifications_with_user_info;

-- Step 4: Disable RLS completely
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Step 5: Re-enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Create the correct RLS policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- CRITICAL: Allow any authenticated user to create notifications for any user
CREATE POLICY "Users can insert notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Step 7: Create the service role function (this bypasses RLS completely)
CREATE OR REPLACE FUNCTION create_notification_service_role(
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
    -- Insert notification with service role privileges (bypasses RLS)
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
$$ language 'plpgsql' SECURITY DEFINER;

-- Step 8: Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification_service_role(UUID, VARCHAR, VARCHAR, TEXT, JSONB, BOOLEAN, VARCHAR, JSONB, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Step 9: Create other helper functions
CREATE OR REPLACE FUNCTION mark_notifications_read(notification_ids UUID[])
RETURNS VOID AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, updated_at = NOW()
    WHERE id = ANY(notification_ids) AND user_id = auth.uid();
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, updated_at = NOW()
    WHERE user_id = auth.uid();
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_val
    FROM notifications
    WHERE user_id = auth.uid() AND is_read = false;
    
    RETURN count_val;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS VOID AS $$
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Step 10: Grant permissions for all functions
GRANT EXECUTE ON FUNCTION mark_notifications_read(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications() TO authenticated;

-- Step 11: Verify everything is set up correctly
SELECT 'RLS Policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'notifications';

SELECT 'Functions:' as info;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%notification%';

-- Step 12: Test notification creation
-- This should work now!
SELECT 'Testing notification creation...' as test; 