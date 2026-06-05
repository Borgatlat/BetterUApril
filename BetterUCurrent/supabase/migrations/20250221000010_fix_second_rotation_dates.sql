-- Fix Second Rotation Dates
-- Updates the second rotation to be for the current week instead of next week
-- This ensures the rotation is immediately available in the store

-- ============================================================================
-- UPDATE ACTIVE ROTATION TO CURRENT WEEK
-- ============================================================================
-- Find the active rotation and update it to the current week
UPDATE public.theme_rotations
SET 
  week_start_date = DATE_TRUNC('week', CURRENT_DATE)::DATE,  -- This Monday
  week_end_date = DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '6 days',  -- This Sunday
  updated_at = timezone('utc'::text, now())
WHERE is_active = true
  AND rotation_number = (SELECT MAX(rotation_number) FROM public.theme_rotations);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- This query will show the updated rotation dates
-- You can run this manually to verify:
-- SELECT id, rotation_number, week_start_date, week_end_date, is_active 
-- FROM public.theme_rotations 
-- WHERE is_active = true;
