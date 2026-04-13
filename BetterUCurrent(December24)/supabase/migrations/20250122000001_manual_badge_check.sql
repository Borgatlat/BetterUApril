-- Manual Badge Check and Award Script
-- Run this to manually check and award badges for all users
-- This is useful if badges weren't awarded during the initial migration

-- ============================================================================
-- MANUALLY CHECK ALL BADGES FOR ALL USERS
-- ============================================================================
-- This will check and award all badges that users qualify for

DO $$
DECLARE
  v_user RECORD;
  v_result RECORD;
BEGIN
  -- Loop through all users
  FOR v_user IN
    SELECT id FROM public.profiles
  LOOP
    -- Check all badges for this user
    PERFORM public.check_all_badges_for_user(v_user.id);
  END LOOP;
  
  RAISE NOTICE 'Badge check completed for all users';
END $$;

-- ============================================================================
-- CHECK YOUR SPECIFIC BADGES (Replace 'YOUR_USER_ID' with your actual user ID)
-- ============================================================================
-- Uncomment and replace YOUR_USER_ID to check badges for a specific user:
-- SELECT * FROM public.check_all_badges_for_user('YOUR_USER_ID'::UUID);

-- ============================================================================
-- VERIFY BADGES WERE AWARDED
-- ============================================================================
-- Check how many badges each user has:
-- SELECT 
--   p.id,
--   p.username,
--   COUNT(ub.id) as badge_count
-- FROM public.profiles p
-- LEFT JOIN public.user_badges ub ON ub.user_id = p.id
-- GROUP BY p.id, p.username
-- ORDER BY badge_count DESC;

-- ============================================================================
-- CHECK FOUNDING MEMBER BADGES
-- ============================================================================
-- See which users should have the founding member badge:
-- SELECT 
--   p.id,
--   p.username,
--   p.created_at,
--   CASE 
--     WHEN p.created_at <= '2025-02-23'::DATE THEN 'Should have badge'
--     ELSE 'Not eligible'
--   END as eligibility
-- FROM public.profiles p
-- WHERE p.created_at <= '2025-02-23'::DATE
-- ORDER BY p.created_at;

-- ============================================================================
-- CHECK WORKOUT BADGES
-- ============================================================================
-- See user workout counts:
-- SELECT 
--   p.id,
--   p.username,
--   COALESCE(us.total_workouts, 0) as total_workouts,
--   COUNT(ub.id) FILTER (WHERE bd.badge_type = 'workout_count') as workout_badges
-- FROM public.profiles p
-- LEFT JOIN public.user_stats us ON us.id = p.id
-- LEFT JOIN public.user_badges ub ON ub.user_id = p.id
-- LEFT JOIN public.badge_definitions bd ON ub.badge_id = bd.id AND bd.badge_type = 'workout_count'
-- GROUP BY p.id, p.username, us.total_workouts
-- ORDER BY total_workouts DESC;

