-- Complete SQL to create notifications table
-- Run this entire file in your Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
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
        'community_challenge'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    is_actionable BOOLEAN DEFAULT true,
    action_type VARCHAR(50),
    action_data JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 1 CHECK (priority IN (1, 2, 3)),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Create policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- FIXED: Allow users to create notifications for any user (needed for kudos, friend requests, etc.)
CREATE POLICY "Users can insert notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true); -- Allow any authenticated user to create notifications

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- Grant permissions
GRANT ALL ON notifications TO authenticated;

-- Create function to mark notifications as read
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
$$ language 'plpgsql';

-- Create function to mark all user notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE notifications
    SET is_read = true, updated_at = NOW()
    WHERE user_id = auth.uid()
    AND is_read = false;
END;
$$ language 'plpgsql';

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
$$ language 'plpgsql';

-- Create function to create notification (without user validation)
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
    -- Insert notification (RLS will handle user validation)
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
$$ language 'plpgsql';

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION mark_notifications_read(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, VARCHAR, VARCHAR, TEXT, JSONB, BOOLEAN, VARCHAR, JSONB, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Drop existing view if it exists
DROP VIEW IF EXISTS notifications_with_user_info;

-- Create view for easier querying of notifications with user info
CREATE VIEW notifications_with_user_info AS
SELECT
    n.*,
    u.email,
    u.raw_user_meta_data
FROM notifications n
JOIN auth.users u ON n.user_id = u.id;

-- Grant select on view
GRANT SELECT ON notifications_with_user_info TO authenticated; 