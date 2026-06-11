-- Premium Streak Shield: forgive one missed day per month for premium users.

ALTER TABLE public.user_streaks
  ADD COLUMN IF NOT EXISTS streak_shield_used_month TEXT;

COMMENT ON COLUMN public.user_streaks.streak_shield_used_month IS
  'YYYY-MM when premium user consumed their monthly streak shield';

-- Extend update_user_streak: gap of exactly 2 days = one missed day → shield can apply
CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id UUID,
  p_activity_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  streak_updated BOOLEAN,
  shield_used BOOLEAN
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
  v_is_premium BOOLEAN := false;
  v_shield_month TEXT;
  v_current_month TEXT;
  v_shield_used BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_user_timezone := 'UTC';
  END;

  v_activity_date := (p_activity_timestamp AT TIME ZONE v_user_timezone)::DATE;
  v_current_month := to_char(v_activity_date, 'YYYY-MM');

  SELECT COALESCE(p.is_premium, false)
  INTO v_is_premium
  FROM public.profiles p
  WHERE p.id = p_user_id;

  SELECT
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, '1970-01-01'::DATE),
    us.streak_shield_used_month
  INTO v_current_streak, v_longest_streak, v_last_activity_date, v_shield_month
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  v_days_since_last := v_activity_date - v_last_activity_date;

  IF v_days_since_last = 0 THEN
    v_streak_updated := false;
  ELSIF v_days_since_last = 1 THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    v_streak_updated := true;
  ELSIF v_days_since_last = 2
    AND v_is_premium
    AND (v_shield_month IS NULL OR v_shield_month <> v_current_month) THEN
    -- One missed day forgiven — continue streak
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    v_shield_month := v_current_month;
    v_shield_used := true;
    v_streak_updated := true;
  ELSE
    v_current_streak := 1;
    v_streak_updated := true;
  END IF;

  INSERT INTO public.user_streaks (
    user_id,
    current_streak,
    longest_streak,
    last_activity_date,
    streak_shield_used_month,
    updated_at
  )
  VALUES (
    p_user_id,
    v_current_streak,
    v_longest_streak,
    v_activity_date,
    v_shield_month,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_current_streak),
    last_activity_date = v_activity_date,
    streak_shield_used_month = COALESCE(v_shield_month, user_streaks.streak_shield_used_month),
    updated_at = NOW();

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_streak_updated, v_shield_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_streak_shield_status(p_user_id UUID)
RETURNS TABLE(
  shield_available BOOLEAN,
  shield_used_this_month BOOLEAN,
  month_key TEXT,
  is_premium BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month TEXT;
  v_is_premium BOOLEAN := false;
  v_used_month TEXT;
BEGIN
  v_month := to_char((NOW() AT TIME ZONE 'UTC')::DATE, 'YYYY-MM');

  SELECT COALESCE(p.is_premium, false)
  INTO v_is_premium
  FROM public.profiles p
  WHERE p.id = p_user_id;

  SELECT us.streak_shield_used_month
  INTO v_used_month
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  RETURN QUERY SELECT
    v_is_premium AND (v_used_month IS NULL OR v_used_month <> v_month),
    v_is_premium AND v_used_month = v_month,
    v_month,
    v_is_premium;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_streak_shield_status(UUID) TO authenticated;
