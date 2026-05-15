-- Test notification creation
-- Run this in your Supabase SQL Editor to test if notifications work

-- First, let's check the current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'notifications';

-- Test creating a notification directly (this should work if RLS is fixed)
INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    is_actionable,
    action_type,
    action_data,
    priority
) VALUES (
    auth.uid(), -- Use current user's ID
    'test',
    'Test Notification',
    'This is a test notification',
    '{}'::jsonb,
    true,
    null,
    '{}'::jsonb,
    1
);

-- Check if the notification was created
SELECT * FROM notifications WHERE type = 'test' ORDER BY created_at DESC LIMIT 1;

-- Clean up test notification
DELETE FROM notifications WHERE type = 'test'; 