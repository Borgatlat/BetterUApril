-- Fix notifications_type_check before re-running SCHOOL_SCHEMA_REMAINING.sql
-- Run this alone if you hit: check constraint "notifications_type_check" is violated

-- 1) See what's in your DB (optional diagnostic)
-- SELECT type, COUNT(*) FROM public.notifications GROUP BY type ORDER BY type;

-- 2) Normalize legacy referral type name
UPDATE public.notifications
SET type = 'referral_code_used'
WHERE type = 'referral';

-- 3) Re-apply full allowed-type list (union of app + league + school types)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
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
    'app_message',
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
    'referral_code_used',
    'referral',
    'accountability_partner_request',
    'accountability_check_in_reminder',
    'accountability_check_in_received',
    'counselor_support_alert'
));

-- If step 3 still fails, find the orphan type(s):
-- SELECT DISTINCT n.type
-- FROM public.notifications n
-- WHERE n.type NOT IN (
--   'friend_request','friend_request_accepted','comment','like','mention',
--   'group_invitation','group_join_request','group_activity','goal_completion',
--   'streak_milestone','achievement','personal_record','workout_reminder',
--   'mental_reminder','hydration_reminder','weekly_progress','monthly_stats',
--   'ai_recommendation','motivational_quote','community_highlight',
--   'challenge_invitation','leaderboard_update','points_earned','level_up',
--   'reward_unlocked','sync_status','app_update','app_message','premium_feature',
--   'local_event','virtual_meetup','community_challenge','workout_share',
--   'mental_session_share','nudge_workout','nudge_run','nudge_mental',
--   'daily_reminder','team_join_request','team_join_request_accepted',
--   'team_invitation','team_invitation_accepted','team_trophy_awarded',
--   'team_challenge_started','team_rank_changed','team_member_joined',
--   'team_member_left','referral_code_used','referral',
--   'accountability_partner_request','accountability_check_in_reminder',
--   'accountability_check_in_received','counselor_support_alert'
-- );
