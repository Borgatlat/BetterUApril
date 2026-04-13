-- Add referral_code_used notification type
-- This notification is sent when someone uses a referral code during signup

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
    'daily_reminder',
    'team_join_request',
    'team_join_request_accepted',
    'team_invitation',
    'team_invitation_accepted',
    'team_trophy_awarded',
    'team_challenge_started',
    'team_rank_changed',
    'team_member_joined',
    'team_member_left',
    'referral_code_used'
));

COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Includes referral_code_used for when users apply referral codes during onboarding';

