-- Add 'app_message' notification type for admin messages
-- This allows admins to send app-wide messages that appear in the notification modal

-- First, we need to drop and recreate the check constraint to add the new type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new 'app_message' type to the allowed notification types
-- This includes ALL existing notification types plus the new 'app_message' type
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    -- Original notification types
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
    'app_message',  -- NEW: Admin messages to all users
    'premium_feature',
    'local_event',
    'virtual_meetup',
    'community_challenge',
    -- Sharing notification types
    'workout_share',
    'mental_session_share',
    -- Nudge notification types
    'nudge_workout',
    'nudge_run',
    'nudge_mental',
    'daily_reminder',
    -- League/Team notification types
    'team_join_request',
    'team_join_request_accepted',
    'team_invitation',
    'team_invitation_accepted',
    'team_trophy_awarded',
    'team_challenge_started',
    'team_rank_changed',
    'team_member_joined',
    'team_member_left',
    -- Referral notification type
    'referral'
));
