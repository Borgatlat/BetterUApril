-- Diagnostic query to check founding member badge eligibility
-- Run this to see if you qualify for the founding member badge

-- Replace 'YOUR_USER_ID' with your actual user ID
-- You can find your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Check your account creation date and founding member eligibility
SELECT 
  p.id as user_id,
  p.created_at as account_created_at,
  DATE(p.created_at) as account_created_date,
  '2025-11-23'::DATE as app_release_date,
  ('2025-11-23'::DATE + INTERVAL '3 months')::DATE as founding_cutoff_date,
  CASE 
    WHEN DATE(p.created_at) < ('2025-11-23'::DATE + INTERVAL '3 months')::DATE 
    THEN 'QUALIFIES' 
    ELSE 'DOES NOT QUALIFY' 
  END as eligibility_status,
  EXISTS(
    SELECT 1 FROM public.user_badges ub
    JOIN public.badge_definitions bd ON ub.badge_id = bd.id
    WHERE ub.user_id = p.id AND bd.badge_key = 'founding_member'
  ) as already_has_badge
FROM public.profiles p
WHERE p.id = 'YOUR_USER_ID'::UUID;

-- Check if the founding member badge definition exists
SELECT * FROM public.badge_definitions WHERE badge_key = 'founding_member';

-- Manually award founding member badge for all qualifying users
-- This will check all users and award the badge if they qualify
DO $$
DECLARE
  v_user RECORD;
  v_founding_cutoff DATE := ('2025-11-23'::DATE + INTERVAL '3 months')::DATE; -- February 2026
  v_badge_id UUID;
BEGIN
  -- Get the founding member badge ID
  SELECT id INTO v_badge_id
  FROM public.badge_definitions
  WHERE badge_key = 'founding_member' AND is_active = true;
  
  IF v_badge_id IS NULL THEN
    RAISE NOTICE 'Founding member badge definition not found!';
    RETURN;
  END IF;
  
  -- Loop through all profiles and award badge if they qualify
  FOR v_user IN 
    SELECT id, created_at 
    FROM public.profiles
    WHERE created_at IS NOT NULL
  LOOP
    -- Check if user qualifies (created account before cutoff date)
    IF DATE(v_user.created_at) < v_founding_cutoff THEN
      -- Check if they already have the badge
      IF NOT EXISTS(
        SELECT 1 FROM public.user_badges 
        WHERE user_id = v_user.id AND badge_id = v_badge_id
      ) THEN
        -- Award the badge
        INSERT INTO public.user_badges (user_id, badge_id, earned_at, is_displayed)
        VALUES (v_user.id, v_badge_id, NOW(), false)
        ON CONFLICT ON CONSTRAINT user_badges_user_id_badge_id_unique DO NOTHING;
        
        RAISE NOTICE 'Awarded founding member badge to user %', v_user.id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Finished checking all users for founding member badge';
END $$;

