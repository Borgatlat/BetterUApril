-- Migration: Forfeit active bonds when activity streak is 0 (on login)
-- When a user has lost their streak (current_streak = 0) but still has active bonds,
-- those bonds must be forfeited so that only users with an active streak can hold bonds.
-- This is called from the app on login to enforce the rule immediately.

-- ============================================================================
-- FUNCTION: forfeit_active_bonds_when_streak_zero
-- ============================================================================
-- Forfeits all active bonds for the user when their current_streak = 0
-- (or when they have no streak record). Does nothing when current_streak > 0.
-- Returns the number of bonds forfeited.
DROP FUNCTION IF EXISTS public.forfeit_active_bonds_when_streak_zero(UUID);
CREATE OR REPLACE FUNCTION public.forfeit_active_bonds_when_streak_zero(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_forfeited_count INTEGER := 0;
BEGIN
  -- Get current streak (0 if no record)
  SELECT COALESCE(us.current_streak, 0)
  INTO v_current_streak
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  -- If no row found, treat as streak 0 (user has never completed activity or record missing)
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
  END IF;

  -- Only forfeit when streak is 0 (user has lost their streak or never had one)
  IF v_current_streak = 0 THEN
    v_forfeited_count := public.forfeit_user_bonds_on_streak_break(p_user_id);
  END IF;

  RETURN v_forfeited_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.forfeit_active_bonds_when_streak_zero(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_active_bonds_when_streak_zero(UUID) TO service_role;

COMMENT ON FUNCTION public.forfeit_active_bonds_when_streak_zero(UUID) IS
'Forfeits all active bonds for the user when current_streak = 0. Call on login to ensure bonds are forfeited as soon as the user has no streak.';
