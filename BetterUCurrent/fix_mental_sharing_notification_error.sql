-- Fix Mental Session Sharing Notification Error
-- This script fixes the notification type constraint error

-- Step 1: Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: Add the updated constraint with both workout_share and mental_session_share
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
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
    'mental_session_share'
));

-- Step 3: Test the constraint by trying to insert a test notification
-- (This will be rolled back, it's just to verify the constraint works)
DO $$
BEGIN
    -- Try to insert a test notification with the new type
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'mental_session_share',
        'Test Mental Session Share',
        'This is a test notification',
        '{}'::jsonb,
        true
    );
    
    -- If we get here, the constraint allows the type
    RAISE NOTICE 'SUCCESS: mental_session_share notification type is now allowed';
    
    -- Clean up the test notification
    DELETE FROM notifications 
    WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid 
    AND type = 'mental_session_share';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: %', SQLERRM;
        RAISE;
END $$;

-- Step 4: Verify the constraint is working
SELECT 
    'Notification constraint updated successfully!' as status,
    'Added types: workout_share, mental_session_share' as added_types,
    'Mental session sharing should now work properly' as result;
