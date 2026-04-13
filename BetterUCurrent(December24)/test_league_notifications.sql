-- Test League Notifications
-- Run this to debug why notifications aren't working

-- ============================================================================
-- STEP 1: Check if the trigger exists
-- ============================================================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'notifications'::regclass
AND tgname = 'trigger_send_push_notification';

-- ============================================================================
-- STEP 2: Check your user's notification setup
-- ============================================================================
-- Replace 'YOUR_USER_ID' with your actual user ID
SELECT 
    id,
    username,
    push_token IS NOT NULL as has_push_token,
    push_notifications_enabled,
    notification_preferences
FROM profiles
WHERE id = auth.uid();  -- This will use your current logged-in user

-- ============================================================================
-- STEP 3: Get your user ID first
-- ============================================================================
-- Run this to get your user ID (look at the profiles table)
SELECT 
    id as your_user_id,
    username,
    email
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- STEP 4: Test creating a notification manually
-- ============================================================================
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID from step 3
SELECT test_league_notification(
    'YOUR_USER_ID_HERE'::UUID,  -- Replace with your actual user ID from step 3
    'team_join_request'  -- Test notification type
);

-- ============================================================================
-- STEP 4: Check recent notifications
-- ============================================================================
SELECT 
    id,
    type,
    title,
    message,
    created_at,
    is_read
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 5: Check if notifications are being created but push isn't working
-- ============================================================================
-- This will show you the last 5 notifications and whether they should have triggered push
SELECT 
    n.id,
    n.type,
    n.title,
    n.created_at,
    p.push_token IS NOT NULL as has_token,
    COALESCE(p.push_notifications_enabled, true) as notifications_enabled,
    COALESCE(
        (p.notification_preferences->>n.type)::BOOLEAN,
        true
    ) as type_enabled
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.user_id = auth.uid()
ORDER BY n.created_at DESC
LIMIT 5;

