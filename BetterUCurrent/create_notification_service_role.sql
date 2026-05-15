-- Create a service role function to bypass RLS for creating notifications
-- This function will run with elevated privileges to create notifications for any user

-- Create function to create notification with service role privileges
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_notification_service_role(UUID, VARCHAR, VARCHAR, TEXT, JSONB, BOOLEAN, VARCHAR, JSONB, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated; 