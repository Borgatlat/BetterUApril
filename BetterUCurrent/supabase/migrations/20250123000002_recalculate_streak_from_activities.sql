-- Function to recalculate streak from actual activities
-- This can be used to restore a streak that was incorrectly reset
-- It calculates the streak based on consecutive days of activities in the user's timezone

CREATE OR REPLACE FUNCTION public.recalculate_streak_from_activities(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  last_activity_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_timezone TEXT;
  v_all_activity_dates DATE[];
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_last_activity_date DATE;
  v_previous_date DATE;
  v_streak_count INTEGER := 0;
  v_date DATE;
BEGIN
  -- Validate timezone
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_user_timezone := 'UTC';
  END;

  -- Get all unique activity dates in user's timezone, sorted descending
  WITH all_activities AS (
    SELECT DISTINCT (uwl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.user_workout_logs uwl
    WHERE uwl.user_id = p_user_id AND uwl.completed_at IS NOT NULL
    UNION
    SELECT DISTINCT (msl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.mental_session_logs msl
    WHERE msl.profile_id = p_user_id AND msl.completed_at IS NOT NULL
    UNION
    SELECT DISTINCT (r.end_time AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.runs r
    WHERE r.user_id = p_user_id AND r.status = 'completed' AND r.end_time IS NOT NULL
  )
  SELECT ARRAY_AGG(activity_date ORDER BY activity_date DESC)
  INTO v_all_activity_dates
  FROM all_activities;

  -- If no activities, return zeros
  IF v_all_activity_dates IS NULL OR array_length(v_all_activity_dates, 1) IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, NULL::DATE;
    RETURN;
  END IF;

  -- Get the most recent activity date
  v_last_activity_date := v_all_activity_dates[1];

  -- Calculate streak by counting consecutive days from most recent backwards
  -- Start from today and work backwards
  v_previous_date := (NOW() AT TIME ZONE v_user_timezone)::DATE;
  v_streak_count := 0;
  v_longest_streak := 0;
  v_current_streak := 0;

  -- Check if most recent activity is today or yesterday (active streak)
  IF v_last_activity_date >= (NOW() AT TIME ZONE v_user_timezone)::DATE - INTERVAL '1 day' THEN
    -- Count consecutive days from most recent activity backwards
    v_previous_date := v_last_activity_date;
    v_streak_count := 1;
    
    -- Loop through activity dates to find consecutive days
    FOREACH v_date IN ARRAY v_all_activity_dates
    LOOP
      IF v_date = v_previous_date - INTERVAL '1 day' THEN
        -- Consecutive day found
        v_streak_count := v_streak_count + 1;
        v_previous_date := v_date;
      ELSIF v_date < v_previous_date - INTERVAL '1 day' THEN
        -- Gap found, streak is broken
        EXIT;
      END IF;
      
      -- Track longest streak
      IF v_streak_count > v_longest_streak THEN
        v_longest_streak := v_streak_count;
      END IF;
    END LOOP;
    
    v_current_streak := v_streak_count;
  END IF;

  -- Update longest streak to be at least the current streak
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Update the user_streaks table
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
    v_longest_streak,
    v_last_activity_date,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_longest_streak),
    last_activity_date = v_last_activity_date,
    updated_at = NOW();

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_last_activity_date;
END;
$$;

-- Helper function to recalculate streak for current user with their timezone
-- This can be called from the app to restore a lost streak
CREATE OR REPLACE FUNCTION public.recalculate_my_streak(p_timezone TEXT DEFAULT 'UTC')
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  last_activity_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.recalculate_streak_from_activities(auth.uid(), p_timezone);
END;
$$;

