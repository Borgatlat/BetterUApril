-- FIX NOTIFICATION RLS POLICY
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This fixes the RLS error: "new row violates row-level security policy for table 'notifications'"
--
-- IMPORTANT: If you see errors when running this, try running fix_rls_policies.sql instead
-- which completely resets all RLS policies on the notifications table.

-- Step 1: Drop BOTH existing insert policies (the restrictive one and the permissive one if it exists)
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for any user" ON notifications;

-- Step 2: Create the correct policy that allows any authenticated user to create notifications for any user
-- This is needed for social features like likes, kudos, friend requests, etc.
CREATE POLICY "Users can insert notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Step 3: Recreate the create_notification function with SECURITY DEFINER to bypass RLS
-- This ensures the function can create notifications for any user regardless of RLS policies
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

-- Step 4: Add missing notification types to the CHECK constraint
-- This ensures workout_share and mental_session_share are allowed
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
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
    'daily_reminder'
));

-- Verify the policy was created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'notifications';

