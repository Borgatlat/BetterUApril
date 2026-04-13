-- Diagnostic query to check why streak status isn't updating
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users table
-- You can find your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Step 1: Check if the function was updated correctly
SELECT 
  routine_name,
  LEFT(routine_definition, 200) as function_start
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_streak_status';

-- Step 2: Check your actual activity data from TODAY
-- This shows all activities from today across all activity types
SELECT 
  'workout' as activity_type,
  completed_at,
  DATE(completed_at) as activity_date,
  NOW() as current_time,
  CURRENT_DATE as today_date
FROM public.user_workout_logs
WHERE user_id = 'YOUR_USER_ID'::UUID
  AND completed_at IS NOT NULL
  AND DATE(completed_at) = CURRENT_DATE
UNION ALL
SELECT 
  'mental' as activity_type,
  completed_at,
  DATE(completed_at) as activity_date,
  NOW() as current_time,
  CURRENT_DATE as today_date
FROM public.mental_session_logs
WHERE profile_id = 'YOUR_USER_ID'::UUID
  AND completed_at IS NOT NULL
  AND DATE(completed_at) = CURRENT_DATE
UNION ALL
SELECT 
  'run' as activity_type,
  end_time as completed_at,
  DATE(end_time) as activity_date,
  NOW() as current_time,
  CURRENT_DATE as today_date
FROM public.runs
WHERE user_id = 'YOUR_USER_ID'::UUID
  AND status = 'completed'
  AND end_time IS NOT NULL
  AND DATE(end_time) = CURRENT_DATE
ORDER BY completed_at DESC;

-- Step 3: Check what the streak table says
SELECT 
  current_streak,
  longest_streak,
  last_activity_date,
  updated_at,
  CASE 
    WHEN last_activity_date = CURRENT_DATE THEN 'Today'
    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN 'Yesterday'
    ELSE 'Older'
  END as last_activity_status
FROM public.user_streaks
WHERE user_id = 'YOUR_USER_ID'::UUID;

-- Step 4: Test the get_streak_status function directly
-- This should show has_activity_today = true if you did an activity today
SELECT 
  current_streak,
  longest_streak,
  last_activity_date,
  has_activity_today,
  is_at_risk,
  CASE 
    WHEN has_activity_today THEN '✅ Has activity today'
    WHEN is_at_risk THEN '⚠️ At risk - needs activity today'
    ELSE 'ℹ️ No activity today'
  END as status_message
FROM public.get_streak_status('YOUR_USER_ID'::UUID);

-- Step 5: Check recent activities (last 7 days) to see what dates have activities
SELECT 
  DATE(completed_at) as activity_date,
  COUNT(*) as activity_count,
  'workout' as source
FROM public.user_workout_logs
WHERE user_id = 'YOUR_USER_ID'::UUID
  AND completed_at IS NOT NULL
  AND DATE(completed_at) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(completed_at)
UNION ALL
SELECT 
  DATE(completed_at) as activity_date,
  COUNT(*) as activity_count,
  'mental' as source
FROM public.mental_session_logs
WHERE profile_id = 'YOUR_USER_ID'::UUID
  AND completed_at IS NOT NULL
  AND DATE(completed_at) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(completed_at)
UNION ALL
SELECT 
  DATE(end_time) as activity_date,
  COUNT(*) as activity_count,
  'run' as source
FROM public.runs
WHERE user_id = 'YOUR_USER_ID'::UUID
  AND status = 'completed'
  AND end_time IS NOT NULL
  AND DATE(end_time) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(end_time)
ORDER BY activity_date DESC;

