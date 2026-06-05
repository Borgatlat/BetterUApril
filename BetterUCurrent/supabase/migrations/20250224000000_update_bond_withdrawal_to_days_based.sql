-- Migration: Update Bond Withdrawal to Days-Based (7, 14, 21, 28 days)
-- This changes withdrawal eligibility from "same day of week" to "days active" (7, 14, 21, or 28 days)

-- ============================================================================
-- 1. UPDATE FUNCTION: Get Bond Withdrawal Eligibility
-- ============================================================================
-- Change from weekday-based to days-active-based withdrawal
DROP FUNCTION IF EXISTS public.get_bond_withdrawal_eligibility(UUID);
CREATE OR REPLACE FUNCTION public.get_bond_withdrawal_eligibility(
  p_bond_id UUID
)
RETURNS TABLE(
  can_withdraw BOOLEAN,
  current_week INTEGER,
  days_until_withdrawal INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_days_since_purchase INTEGER;
  v_weeks_since_purchase DECIMAL;
  v_days_active INTEGER;
BEGIN
  -- Get bond details
  SELECT 
    ub.*
  INTO v_bond
  FROM public.user_bonds ub
  WHERE ub.id = p_bond_id;
  
  -- Check if bond exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'Bond not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if bond is active
  IF v_bond.status != 'active' THEN
    RETURN QUERY SELECT false, v_bond.current_week, 0, 'Bond is not active'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate days since purchase
  v_days_since_purchase := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_bond.purchased_at)) / (24 * 60 * 60);
  v_days_active := FLOOR(v_days_since_purchase)::INTEGER;
  
  -- Calculate weeks since purchase for current_week calculation
  v_weeks_since_purchase := v_days_since_purchase / 7.0;
  
  -- Update current_week based on time elapsed
  -- Week 0: 0-7 days (can't withdraw), Week 1: 7-14 days, Week 2: 14-21 days, Week 3: 21-28 days, Week 4: 28+ days
  v_bond.current_week := LEAST(4, GREATEST(0, FLOOR(v_weeks_since_purchase)::INTEGER));
  
  -- Check if bond can be withdrawn based on days active (7, 14, 21, or 28+ days)
  -- Bonds can be withdrawn if they've been active for exactly 7, 14, 21 days, or 28+ days
  IF v_days_active >= 28 THEN
    -- 28+ days - can withdraw anytime
    RETURN QUERY SELECT true, v_bond.current_week, 0, 'Eligible to withdraw (28+ days active)'::TEXT;
  ELSIF v_days_active >= 7 AND (v_days_active = 7 OR v_days_active = 14 OR v_days_active = 21) THEN
    -- Can withdraw at these milestone days (7, 14, 21)
    RETURN QUERY SELECT true, v_bond.current_week, 0, 'Eligible to withdraw'::TEXT;
  ELSIF v_days_active < 7 THEN
    -- Less than 7 days - calculate days until first withdrawal
    RETURN QUERY SELECT false, v_bond.current_week, 7 - v_days_active, 
      format('Must wait %s more day%s until first withdrawal (7 days)', 
        7 - v_days_active,
        CASE WHEN (7 - v_days_active) = 1 THEN '' ELSE 's' END)::TEXT;
  ELSIF v_days_active < 14 THEN
    -- Between 7 and 14 days - calculate days until next milestone
    RETURN QUERY SELECT false, v_bond.current_week, 14 - v_days_active, 
      format('Can withdraw at 14 days (%s day%s remaining)', 
        14 - v_days_active,
        CASE WHEN (14 - v_days_active) = 1 THEN '' ELSE 's' END)::TEXT;
  ELSIF v_days_active < 21 THEN
    -- Between 14 and 21 days
    RETURN QUERY SELECT false, v_bond.current_week, 21 - v_days_active, 
      format('Can withdraw at 21 days (%s day%s remaining)', 
        21 - v_days_active,
        CASE WHEN (21 - v_days_active) = 1 THEN '' ELSE 's' END)::TEXT;
  ELSIF v_days_active < 28 THEN
    -- Between 21 and 28 days
    RETURN QUERY SELECT false, v_bond.current_week, 28 - v_days_active, 
      format('Can withdraw at 28 days (%s day%s remaining)', 
        28 - v_days_active,
        CASE WHEN (28 - v_days_active) = 1 THEN '' ELSE 's' END)::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- 2. REMOVE purchase_day_of_week COLUMN (No longer needed)
-- ============================================================================
-- Note: We keep the column for now to avoid breaking existing bonds
-- But it's no longer used in the logic
-- If you want to remove it completely, uncomment the following:
-- ALTER TABLE public.user_bonds DROP COLUMN IF EXISTS purchase_day_of_week;

-- ============================================================================
-- 3. UPDATE COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.get_bond_withdrawal_eligibility(UUID) IS 
'Checks if a bond can be withdrawn based on days active (7, 14, 21, or 28+ days). Bonds can be withdrawn on milestone days (7, 14, 21) or anytime after 28 days.';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- Withdrawal Rules (Updated):
-- - Bonds can be withdrawn when they've been active for exactly 7, 14, or 21 days
-- - Bonds can be withdrawn anytime after 28 days (no expiration)
-- - Must maintain daily activity streak or bond is forfeited
-- - Week calculation is based on 7-day periods (Week 0: 0-7 days, Week 1: 7-14 days, etc.)
