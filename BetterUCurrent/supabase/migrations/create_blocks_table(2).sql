-- Migration: Create blocks table for user blocking system
-- This table stores blocking relationships between users
-- When user A blocks user B, both users cannot see each other

-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ensure a user can only block another user once
    -- This unique constraint prevents duplicate blocks
    UNIQUE(blocker_id, blocked_id),
    
    -- Prevent users from blocking themselves
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Create indexes for efficient queries
-- These indexes speed up lookups when checking if users are blocked
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_both_ids ON blocks(blocker_id, blocked_id);

-- Enable Row Level Security
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view blocks they created (where they are the blocker)
-- This allows users to see their own blocked list
CREATE POLICY "Users can view blocks they created" ON blocks
    FOR SELECT
    USING (auth.uid() = blocker_id);

-- RLS Policy: Users can view blocks where they are blocked (for mutual blocking)
-- This allows users to see who has blocked them, so they can filter those users' content
CREATE POLICY "Users can view blocks where they are blocked" ON blocks
    FOR SELECT
    USING (auth.uid() = blocked_id);

-- RLS Policy: Users can create blocks (block other users)
-- Users can only create blocks where they are the blocker
CREATE POLICY "Users can create blocks" ON blocks
    FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

-- RLS Policy: Users can delete blocks they created (unblock)
-- Users can only delete blocks where they are the blocker
CREATE POLICY "Users can delete blocks they created" ON blocks
    FOR DELETE
    USING (auth.uid() = blocker_id);

-- RLS Policy: Users cannot update blocks (blocks are immutable once created)
-- This prevents users from modifying existing blocks
-- No UPDATE policy means updates are forbidden

-- Create a function to check if two users have a blocking relationship
-- This function returns true if either user has blocked the other (mutual blocking)
-- It's useful for filtering queries to exclude blocked users
CREATE OR REPLACE FUNCTION is_blocked(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user1 blocked user2 OR user2 blocked user1
    -- This implements mutual blocking: if A blocks B, neither can see the other
    RETURN EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocker_id = user1_id AND blocked_id = user2_id)
           OR (blocker_id = user2_id AND blocked_id = user1_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get all users blocked by a specific user
-- This returns an array of user IDs that the given user has blocked
CREATE OR REPLACE FUNCTION get_blocked_user_ids(blocker_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT blocked_id
        FROM blocks
        WHERE blocker_id = blocker_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get all users who have blocked a specific user
-- This returns an array of user IDs who have blocked the given user
CREATE OR REPLACE FUNCTION get_blocker_user_ids(blocked_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT blocker_id
        FROM blocks
        WHERE blocked_id = blocked_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the table
COMMENT ON TABLE blocks IS 'Stores blocking relationships between users. When user A blocks user B, both users cannot see each other (mutual blocking).';

