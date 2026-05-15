-- Fix RLS policy for notifications table to allow any user to insert notifications for any user
-- This is needed for likes, kudos, friend requests, and other social interactions

-- Drop BOTH existing insert policies (the restrictive one and the permissive one if it exists)
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for any user" ON notifications;

-- Create the correct policy that allows any authenticated user to create notifications for any user
CREATE POLICY "Users can insert notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Also add the missing notification types to the CHECK constraint
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

