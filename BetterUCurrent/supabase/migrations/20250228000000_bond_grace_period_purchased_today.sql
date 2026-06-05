-- Migration: Bond grace period – don't forfeit bonds purchased today
-- Fix: User had streak 1, didn't do a workout today, bought a bond, and it was forfeited immediately.
-- Cause: Forfeit check can run right after purchase (e.g. when opening Bonds tab) and treat
-- "last activity yesterday" as eligible for forfeit due to timezone or same-day logic.
-- Fix: Never forfeit a bond on the same calendar day it was purchased. The user has until
-- end of day to complete today's activity.

DROP FUNCTION IF EXISTS public.forfeit_user_bonds_on_streak_break(UUID);
CREATE OR REPLACE FUNCTION public.forfeit_user_bonds_on_streak_break(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_forfeited_count INTEGER := 0;
BEGIN
  -- Only consider bonds that were purchased on a previous day (not today).
  -- This gives the user the rest of the day to complete today's activity after buying a bond.
  FOR v_bond IN 
    SELECT id, bond_amount
    FROM public.user_bonds
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (purchased_at::DATE < CURRENT_DATE)
  LOOP
    UPDATE public.user_bonds
    SET 
      status = 'forfeited',
      forfeited_at = CURRENT_TIMESTAMP,
      final_payout = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = v_bond.id;

    INSERT INTO public.bond_transactions (
      user_id,
      bond_id,
      transaction_type,
      amount
    ) VALUES (
      p_user_id,
      v_bond.id,
      'forfeiture',
      0
    );

    v_forfeited_count := v_forfeited_count + 1;
  END LOOP;

  RETURN v_forfeited_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.forfeit_user_bonds_on_streak_break(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_user_bonds_on_streak_break(UUID) TO service_role;

COMMENT ON FUNCTION public.forfeit_user_bonds_on_streak_break(UUID) IS
'Forfeits active bonds for the user when their streak is broken. Skips bonds purchased today so the user has until end of day to complete activity.';

-- ============================================================================
-- Also update cron: do not forfeit bonds purchased today
-- ============================================================================
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

    -- Grace period: do not forfeit a bond purchased today (user has until end of day to complete activity)
    IF (v_bond.purchased_at::DATE >= CURRENT_DATE) THEN
      UPDATE public.user_bonds
      SET last_streak_check_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      CONTINUE;
    END IF;

    SELECT 
      COALESCE(us.current_streak, 0) AS current_streak,
      COALESCE(us.last_activity_date, '1970-01-01'::DATE) AS last_activity_date
    INTO v_streak_record
    FROM public.user_streaks us
    WHERE us.user_id = v_bond.user_id;

    IF NOT FOUND THEN
      UPDATE public.user_bonds
      SET last_streak_check_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = v_bond.id;
      CONTINUE;
    END IF;

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
'Daily cron: forfeit bonds only when user broke their streak (gap > 1 day). Skips bonds purchased today (grace period). Does NOT forfeit when no streak record or current_streak = 0.';
