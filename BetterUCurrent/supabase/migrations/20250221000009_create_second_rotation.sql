-- Create Second Weekly Rotation
-- Creates a new rotation for next week using existing themes from theme_bank

-- ============================================================================
-- 1. DEACTIVATE CURRENT ROTATION
-- ============================================================================
-- Mark the current active rotation as inactive
UPDATE public.theme_rotations 
SET is_active = false
WHERE is_active = true;

-- ============================================================================
-- 2. CREATE NEW ROTATION (Current Week: Monday to Sunday)
-- ============================================================================
-- Create rotation for the current week (starting this Monday)
-- This ensures the rotation is immediately available in the store
INSERT INTO public.theme_rotations (
  week_start_date, 
  week_end_date, 
  rotation_number, 
  is_active
)
VALUES (
  DATE_TRUNC('week', CURRENT_DATE)::DATE,  -- This Monday (start of current week)
  DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '6 days',  -- This Sunday (end of current week)
  (SELECT COALESCE(MAX(rotation_number), 0) + 1 FROM public.theme_rotations),  -- Next rotation number
  true  -- Set as active
)
RETURNING id, rotation_number, week_start_date, week_end_date;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- This rotation will use all themes from theme_bank where:
--   - is_active = true
--   - is_rotating = true
--
-- When users open the store, they will automatically get assigned 5 random themes
-- from the theme_bank via the assign_user_theme_slots() function.
--
-- Each user will get different themes with randomized rarities per slot.
--
-- To create future rotations, run this migration pattern weekly, or create a
-- scheduled function to automatically create new rotations.
