-- Mental Session Sharing Tables
-- This creates the necessary tables for sharing mental sessions between friends

-- Create mental_session_shares table (similar to workout_shares)
CREATE TABLE IF NOT EXISTS mental_session_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mental_session_id UUID REFERENCES mental_session_logs(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    
    -- Store mental session data for easy access
    session_name TEXT NOT NULL,
    session_type VARCHAR(50) NOT NULL,
    session_description TEXT,
    duration INTEGER NOT NULL,
    calmness_level INTEGER,
    notes TEXT,
    photo_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Prevent duplicate shares
    UNIQUE(mental_session_id, sender_id, recipient_id)
);

-- Create shared_mental_sessions table (similar to shared_workouts)
CREATE TABLE IF NOT EXISTS shared_mental_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_session_id UUID REFERENCES mental_session_logs(id) ON DELETE CASCADE NOT NULL,
    original_sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Store mental session data
    session_name TEXT NOT NULL,
    session_type VARCHAR(50) NOT NULL,
    session_description TEXT,
    duration INTEGER NOT NULL,
    calmness_level INTEGER,
    notes TEXT,
    photo_url TEXT,
    
    -- Track usage
    is_active BOOLEAN DEFAULT true,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mental_session_shares_sender ON mental_session_shares(sender_id);
CREATE INDEX IF NOT EXISTS idx_mental_session_shares_recipient ON mental_session_shares(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mental_session_shares_status ON mental_session_shares(status);
CREATE INDEX IF NOT EXISTS idx_mental_session_shares_created_at ON mental_session_shares(created_at);

CREATE INDEX IF NOT EXISTS idx_shared_mental_sessions_recipient ON shared_mental_sessions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_shared_mental_sessions_original_sender ON shared_mental_sessions(original_sender_id);
CREATE INDEX IF NOT EXISTS idx_shared_mental_sessions_active ON shared_mental_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_shared_mental_sessions_created_at ON shared_mental_sessions(created_at);

-- Enable Row Level Security
ALTER TABLE mental_session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_mental_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view mental session shares they sent or received" ON mental_session_shares;
DROP POLICY IF EXISTS "Users can insert mental session shares" ON mental_session_shares;
DROP POLICY IF EXISTS "Users can update mental session shares they received" ON mental_session_shares;
DROP POLICY IF EXISTS "Users can delete mental session shares they sent" ON mental_session_shares;

DROP POLICY IF EXISTS "Users can view shared mental sessions they received" ON shared_mental_sessions;
DROP POLICY IF EXISTS "Users can insert shared mental sessions" ON shared_mental_sessions;
DROP POLICY IF EXISTS "Users can update shared mental sessions they received" ON shared_mental_sessions;
DROP POLICY IF EXISTS "Users can delete shared mental sessions they received" ON shared_mental_sessions;

-- Create RLS policies for mental_session_shares
CREATE POLICY "Users can view mental session shares they sent or received"
    ON mental_session_shares FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert mental session shares"
    ON mental_session_shares FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update mental session shares they received"
    ON mental_session_shares FOR UPDATE
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete mental session shares they sent"
    ON mental_session_shares FOR DELETE
    USING (auth.uid() = sender_id);

-- Create RLS policies for shared_mental_sessions
CREATE POLICY "Users can view shared mental sessions they received"
    ON shared_mental_sessions FOR SELECT
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can insert shared mental sessions"
    ON shared_mental_sessions FOR INSERT
    WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Users can update shared mental sessions they received"
    ON shared_mental_sessions FOR UPDATE
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete shared mental sessions they received"
    ON shared_mental_sessions FOR DELETE
    USING (auth.uid() = recipient_id);

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_mental_session_sharing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_mental_session_shares_updated_at
    BEFORE UPDATE ON mental_session_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_mental_session_sharing_updated_at();

CREATE TRIGGER update_shared_mental_sessions_updated_at
    BEFORE UPDATE ON shared_mental_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_mental_session_sharing_updated_at();

-- Create a view for easy querying of mental session shares with user info
CREATE OR REPLACE VIEW mental_session_shares_with_users AS
SELECT 
    mss.*,
    sender.username as sender_username,
    sender.full_name as sender_full_name,
    sender.avatar_url as sender_avatar_url,
    recipient.username as recipient_username,
    recipient.full_name as recipient_full_name,
    recipient.avatar_url as recipient_avatar_url
FROM mental_session_shares mss
LEFT JOIN profiles sender ON mss.sender_id = sender.id
LEFT JOIN profiles recipient ON mss.recipient_id = recipient.id;

-- Create a view for easy querying of shared mental sessions with user info
CREATE OR REPLACE VIEW shared_mental_sessions_with_users AS
SELECT 
    sms.*,
    sender.username as original_sender_username,
    sender.full_name as original_sender_full_name,
    sender.avatar_url as original_sender_avatar_url
FROM shared_mental_sessions sms
LEFT JOIN profiles sender ON sms.original_sender_id = sender.id;

-- Grant permissions
GRANT SELECT ON mental_session_shares_with_users TO authenticated;
GRANT SELECT ON shared_mental_sessions_with_users TO authenticated;

-- Note: The mental_session_share notification type needs to be added to the 
-- notifications table CHECK constraint. Run fix_mental_session_notification_type.sql
-- to add this notification type to the allowed types list.

-- Create helper function to get mental session share statistics
CREATE OR REPLACE FUNCTION get_mental_session_share_stats(user_id UUID)
RETURNS TABLE (
    total_sent INTEGER,
    total_received INTEGER,
    pending_received INTEGER,
    accepted_received INTEGER,
    declined_received INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(sent.total, 0)::INTEGER as total_sent,
        COALESCE(received.total, 0)::INTEGER as total_received,
        COALESCE(pending.total, 0)::INTEGER as pending_received,
        COALESCE(accepted.total, 0)::INTEGER as accepted_received,
        COALESCE(declined.total, 0)::INTEGER as declined_received
    FROM 
        (SELECT COUNT(*) as total FROM mental_session_shares WHERE sender_id = user_id) sent,
        (SELECT COUNT(*) as total FROM mental_session_shares WHERE recipient_id = user_id) received,
        (SELECT COUNT(*) as total FROM mental_session_shares WHERE recipient_id = user_id AND status = 'pending') pending,
        (SELECT COUNT(*) as total FROM mental_session_shares WHERE recipient_id = user_id AND status = 'accepted') accepted,
        (SELECT COUNT(*) as total FROM mental_session_shares WHERE recipient_id = user_id AND status = 'declined') declined;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_mental_session_share_stats(UUID) TO authenticated;

-- Verify tables were created successfully
SELECT 'Mental session sharing tables created successfully!' as status;
SELECT 'Tables:' as info, tablename FROM pg_tables WHERE tablename IN ('mental_session_shares', 'shared_mental_sessions');
SELECT 'Views:' as info, viewname FROM pg_views WHERE viewname IN ('mental_session_shares_with_users', 'shared_mental_sessions_with_users');
SELECT 'Functions:' as info, routine_name FROM information_schema.routines WHERE routine_name = 'get_mental_session_share_stats';
