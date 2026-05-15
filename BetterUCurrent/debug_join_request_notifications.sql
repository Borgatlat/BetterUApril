-- Debug Join Request Notifications
-- Run this to check why join request notifications aren't working

-- ============================================================================
-- STEP 1: Check if the trigger exists
-- ============================================================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'team_join_requests'::regclass
AND tgname = 'trigger_notify_team_on_join_request';

-- ============================================================================
-- STEP 2: Check if the function exists
-- ============================================================================
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'notify_team_on_join_request';

-- ============================================================================
-- STEP 3: Check recent join requests
-- ============================================================================
SELECT 
    tjr.id,
    tjr.user_id,
    tjr.team_id,
    tjr.status,
    tjr.created_at,
    t.name as team_name,
    p.username as requester_username,
    -- Check if team has owners/admins
    (SELECT COUNT(*) 
     FROM team_members tm 
     WHERE tm.team_id = tjr.team_id 
     AND tm.role IN ('owner', 'admin')) as owner_admin_count
FROM team_join_requests tjr
LEFT JOIN teams t ON tjr.team_id = t.id
LEFT JOIN profiles p ON tjr.user_id = p.id
ORDER BY tjr.created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 4: Check if notifications were created for recent join requests
-- ============================================================================
SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.user_id as notified_user_id,
    n.created_at,
    p.username as notified_username,
    tjr.id as join_request_id
FROM notifications n
LEFT JOIN profiles p ON n.user_id = p.id
LEFT JOIN team_join_requests tjr ON 
    (n.data->>'request_id')::UUID = tjr.id
WHERE n.type = 'team_join_request'
ORDER BY n.created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 5: Test the trigger manually
-- ============================================================================
-- First, get a team ID and user ID to test with
SELECT 
    t.id as team_id,
    t.name as team_name,
    tm.user_id as owner_admin_id,
    p.username as owner_admin_username
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
JOIN profiles p ON tm.user_id = p.id
WHERE tm.role IN ('owner', 'admin')
LIMIT 5;

-- Then manually test by creating a join request (replace IDs below)
-- This will trigger the notification if everything is set up correctly
/*
INSERT INTO team_join_requests (team_id, user_id, status)
VALUES (
    'TEAM_ID_HERE'::UUID,  -- Replace with actual team ID
    'USER_ID_HERE'::UUID,  -- Replace with actual user ID (different from owner)
    'pending'
);
*/

-- ============================================================================
-- STEP 6: Check for errors in PostgreSQL logs
-- ============================================================================
-- Note: You'll need to check Supabase logs in the dashboard for actual errors
-- This query shows recent notification attempts
SELECT 
    n.id,
    n.type,
    n.created_at,
    p.push_token IS NOT NULL as has_push_token,
    COALESCE(p.push_notifications_enabled, true) as notifications_enabled
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type LIKE 'team_%'
ORDER BY n.created_at DESC
LIMIT 10;

