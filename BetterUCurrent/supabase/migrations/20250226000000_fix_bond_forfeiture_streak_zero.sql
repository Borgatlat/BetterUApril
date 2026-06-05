-- Migration: Fix bond forfeiture when streak is 0
-- Bonds must NOT be auto-forfeited when user has no streak or streak is 0.
-- Forfeit only when the user *broke* a streak (had activity, then missed a day).

-- ============================================================================
-- 1. UPDATE check_and_forfeit_user_bonds
-- ============================================================================
-- Do NOT forfeit when:
--   - No streak record exists (user never completed activity / streak 0)
--   - current_streak = 0 (you cannot "break" a streak you don't have)
-- Forfeit only when: user had a streak and broke it (gap > 1 day since last activity).
DROP FUNCTION IF EXISTS public.check_and_forfeit_user_bonds(UUID);
CREATE OR REPLACE FUNCTION public.check_and_forfeit_user_bonds(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak_record RECORD;
  v_days_since_activity INTEGER;
  v_forfeited_count INTEGER := 0;
BEGIN
  -- Get user's streak status (including current_streak)
  SELECT 
    COALESCE(us.current_streak, 0) AS current_streak,
    COALESCE(us.last_activity_date, '1970-01-01'::DATE) AS last_activity_date
  INTO v_streak_record
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;
  
  -- If no streak record exists: do NOT forfeit. User has never completed activity;
  -- they haven't "broken" anything. Buying a bond with streak 0 is valid.
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- If current_streak is 0: do NOT forfeit. You cannot break a streak you don't have.
  -- User bought with streak 0 or lost it earlier; we don't auto-forfeit on that.
  IF v_streak_record.current_streak = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate days since last activity
  v_days_since_activity := CURRENT_DATE - v_streak_record.last_activity_date;
  
  -- Forfeit only when streak is *broken*: had activity, then gap > 1 day
  IF v_days_since_activity > 1 THEN
    v_forfeited_count := public.forfeit_user_bonds_on_streak_break(p_user_id);
  END IF;
  
  RETURN v_forfeited_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_forfeit_user_bonds(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_and_forfeit_user_bonds(UUID) IS 
'Checks if user broke their streak (gap > 1 day since last activity) and forfeits active bonds. Does NOT forfeit when no streak record or current_streak = 0.';

-- ============================================================================
-- 2. UPDATE check_bond_streak_requirements (cron)
-- ============================================================================
-- Same logic: do NOT forfeit when no streak record or current_streak = 0.
DROP FUNCTION IF EXISTS public.check_bond_streak_requirements();
CREATE OR REPLACE FUNCTION public.check_bond_streak_requirements()
RETURNS TABLE(
  bonds_checked INTEGER,
  bonds_forfeited INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_streak_record RECORD;
  v_days_since_activity INTEGER;
  v_checked INTEGER := 0;
  v_forfeited INTEGER := 0;
BEGIN
  FOR v_bond IN 
    SELECT ub.*
    FROM public.user_bonds ub
    WHERE ub.status = 'active'
  LOOP
    v_checked := v_checked + 1;
    
    SELECT 
      COALESCE(us.current_streak, 0) AS current_streak,
      COALESCE(us.last_activity_date, '1970-01-01'::DATE) AS last_activity_date
    INTO v_streak_record
    FROM public.user_streaks us
    WHERE us.user_id = v_bond.user_id;
    
    -- No streak record: do NOT forfeit (user never completed activity / streak 0)
    IF NOT FOUND THEN
      UPDATE public.user_bonds
      SET last_streak_check_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      CONTINUE;
    END IF;
    
    -- current_streak = 0: do NOT forfeit (cannot break a streak you don't have)
    IF v_streak_record.current_streak = 0 THEN
      UPDATE public.user_bonds
      SET last_streak_check_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      CONTINUE;
    END IF;
    
    v_days_since_activity := CURRENT_DATE - v_streak_record.last_activity_date;
    
    IF v_days_since_activity > 1 THEN
      UPDATE public.user_bonds
      SET status = 'forfeited', forfeited_at = CURRENT_TIMESTAMP, final_payout = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      INSERT INTO public.bond_transactions (user_id, bond_id, transaction_type, amount)
      VALUES (v_bond.user_id, v_bond.id, 'forfeiture', 0);
      v_forfeited := v_forfeited + 1;
    ELSE
      UPDATE public.user_bonds
      SET last_streak_check_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_checked, v_forfeited;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_bond_streak_requirements() TO authenticated;

COMMENT ON FUNCTION public.check_bond_streak_requirements() IS 
'Daily cron: forfeit bonds only when user broke their streak (gap > 1 day). Does NOT forfeit when no streak record or current_streak = 0.';
