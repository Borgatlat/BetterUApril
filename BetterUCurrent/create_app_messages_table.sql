-- Create table for app-wide messages/announcements from admins
CREATE TABLE IF NOT EXISTS app_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Message content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Admin who sent it
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Message settings
    is_active BOOLEAN DEFAULT true, -- Can be deactivated without deleting
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Optional: expiration date for time-sensitive messages
    expires_at TIMESTAMPTZ,
    
    -- Optional: target audience (null = all users)
    target_audience TEXT CHECK (target_audience IN ('all', 'premium', 'free', 'new_users'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS app_messages_created_at_idx ON app_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS app_messages_is_active_idx ON app_messages(is_active);
CREATE INDEX IF NOT EXISTS app_messages_created_by_idx ON app_messages(created_by);

-- RLS Policies
ALTER TABLE app_messages ENABLE ROW LEVEL SECURITY;

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
    ON app_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can insert messages
CREATE POLICY "Admins can insert messages"
    ON app_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
        AND created_by = auth.uid()
    );

-- Admins can update messages
CREATE POLICY "Admins can update messages"
    ON app_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can delete messages
CREATE POLICY "Admins can delete messages"
    ON app_messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- All users can view active messages (for displaying in app)
CREATE POLICY "Users can view active messages"
    ON app_messages FOR SELECT
    USING (is_active = true);
