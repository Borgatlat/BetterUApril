-- Migration: Add Bond Forfeiture on Streak Break
-- This ensures bonds are forfeited immediately when a user's streak is broken
-- instead of waiting for a daily cron job or withdrawal attempt

-- ============================================================================
-- 1. FUNCTION: Forfeit User's Active Bonds
-- ============================================================================
-- This function forfeits all active bonds for a user when their streak breaks
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
  -- Loop through all active bonds for this user
  FOR v_bond IN 
    SELECT id, bond_amount
    FROM public.user_bonds
    WHERE user_id = p_user_id AND status = 'active'
  LOOP
    -- Forfeit bond
    UPDATE public.user_bonds
    SET 
      status = 'forfeited',
      forfeited_at = CURRENT_TIMESTAMP,
      final_payout = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = v_bond.id;
    
    -- Record transaction
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

-- ============================================================================
-- 2. UPDATE STREAK FUNCTION TO FORFEIT BONDS ON BREAK
-- ============================================================================
-- Modify the update_user_streak function to forfeit bonds when streak breaks
CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id UUID,
  p_activity_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  streak_updated BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_last_activity_date DATE;
  v_days_since_last INTEGER;
  v_streak_updated BOOLEAN := false;
  v_activity_date DATE;
  v_user_timezone TEXT;
  v_previous_streak INTEGER := 0;
BEGIN
  -- Validate timezone (default to UTC if invalid)
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_user_timezone := 'UTC';
  END;

  -- Convert the activity timestamp to the user's local date
  v_activity_date := (p_activity_timestamp AT TIME ZONE v_user_timezone)::DATE;

  -- Get current streak data (or initialize if doesn't exist)
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, '1970-01-01'::DATE)
  INTO v_current_streak, v_longest_streak, v_last_activity_date
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  -- Store previous streak to detect breaks
  v_previous_streak := v_current_streak;

  -- Calculate days since last activity
  v_days_since_last := v_activity_date - v_last_activity_date;

  -- Streak logic:
  -- 0 days (same day): No change to streak count
  -- 1 day (consecutive): Increment streak
  -- > 1 day (gap): Reset streak to 1
  IF v_days_since_last = 0 THEN
    v_streak_updated := false;
  ELSIF v_days_since_last = 1 THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    v_streak_updated := true;
  ELSE
    -- Gap detected (more than 1 day since last activity)
    -- This means the streak is broken - forfeit all active bonds
    -- Check if user had any active bonds before forfeiting
    IF EXISTS (SELECT 1 FROM public.user_bonds WHERE user_id = p_user_id AND status = 'active') THEN
      PERFORM public.forfeit_user_bonds_on_streak_break(p_user_id);
    END IF;
    
    -- Reset streak to 1 (this is a new activity after the gap)
    v_current_streak := 1;
    v_streak_updated := true;
  END IF;

  -- Insert or update the streak record
  INSERT INTO public.user_streaks (
    user_id, 
    current_streak, 
    longest_streak, 
    last_activity_date, 
    updated_at
  )
  VALUES (
    p_user_id, 
    v_current_streak, 
    GREATEST(v_longest_streak, v_current_streak),
    v_activity_date,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_current_streak),
    last_activity_date = v_activity_date,
    updated_at = NOW();

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_streak_updated;
END;
$$;

-- ============================================================================
-- 3. FUNCTION: Check and Forfeit Bonds for Current User
-- ============================================================================
-- This function checks if the current user's streak is broken and forfeits bonds
-- Can be called when user opens app or views bonds to ensure immediate forfeiture
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
  -- Get user's streak status
  SELECT 
    COALESCE(last_activity_date, '1970-01-01'::DATE) as last_activity_date
  INTO v_streak_record
  FROM public.user_streaks
  WHERE user_id = p_user_id;
  
  -- If no streak record exists, forfeit all bonds (user has never completed activity)
  IF NOT FOUND THEN
    RETURN public.forfeit_user_bonds_on_streak_break(p_user_id);
  END IF;
  
  -- Calculate days since last activity
  v_days_since_activity := CURRENT_DATE - v_streak_record.last_activity_date;
  
  -- If streak is broken (more than 1 day since last activity), forfeit bonds
  IF v_days_since_activity > 1 THEN
    v_forfeited_count := public.forfeit_user_bonds_on_streak_break(p_user_id);
  END IF;
  
  RETURN v_forfeited_count;
END;
$$;

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.forfeit_user_bonds_on_streak_break(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_forfeit_user_bonds(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.forfeit_user_bonds_on_streak_break(UUID) IS 
'Forfeits all active bonds for a user when their streak is broken. Called automatically when update_user_streak detects a gap > 1 day.';

COMMENT ON FUNCTION public.update_user_streak(UUID, TIMESTAMPTZ, TEXT) IS 
'Updates user streak and automatically forfeits active bonds if streak is broken (gap > 1 day detected).';
