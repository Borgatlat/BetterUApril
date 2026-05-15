-- Fix get_streak_status to check actual activity tables instead of just last_activity_date
-- This ensures the function correctly detects activities even if triggers didn't fire
-- or if there are timezone issues

CREATE OR REPLACE FUNCTION public.get_streak_status(p_user_id UUID, p_timezone TEXT DEFAULT 'UTC')
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  last_activity_date DATE,
  has_activity_today BOOLEAN,
  is_at_risk BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_last_activity_date DATE;
  v_has_activity_today BOOLEAN;
  v_is_at_risk BOOLEAN;
  -- Use user's local timezone for date calculations
  -- Convert timestamps to user's timezone, then extract the date
  v_today DATE;
  v_yesterday DATE;
  v_actual_last_activity_date DATE;
  v_user_timezone TEXT;
BEGIN
  -- Validate and set timezone (default to UTC if invalid)
  -- PostgreSQL timezone names like 'America/New_York', 'Europe/London', etc.
  BEGIN
    -- Test if timezone is valid by trying to use it
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    -- If timezone is invalid, default to UTC
    v_user_timezone := 'UTC';
  END;

  -- Calculate today's date in user's timezone
  v_today := (NOW() AT TIME ZONE v_user_timezone)::DATE;
  v_yesterday := v_today - INTERVAL '1 day';

  -- Get streak data from user_streaks table
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, NULL)
  INTO v_current_streak, v_longest_streak, v_last_activity_date
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  -- Check actual activity tables to find the most recent activity date
  -- Convert timestamps to user's timezone, then extract the date
  -- This is more reliable than just checking last_activity_date in user_streaks
  -- because it directly queries the source of truth
  WITH all_activities AS (
    SELECT (uwl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.user_workout_logs uwl
    WHERE uwl.user_id = p_user_id AND uwl.completed_at IS NOT NULL
    UNION
    SELECT (msl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.mental_session_logs msl
    WHERE msl.profile_id = p_user_id AND msl.completed_at IS NOT NULL
    UNION
    SELECT (r.end_time AT TIME ZONE v_user_timezone)::DATE as activity_date
    FROM public.runs r
    WHERE r.user_id = p_user_id AND r.status = 'completed' AND r.end_time IS NOT NULL
  )
  SELECT MAX(activity_date)
  INTO v_actual_last_activity_date
  FROM all_activities;

  -- If we found an actual activity date, use it (it's more reliable)
  -- Otherwise, fall back to last_activity_date from user_streaks
  IF v_actual_last_activity_date > '1970-01-01'::DATE THEN
    v_last_activity_date := v_actual_last_activity_date;
  END IF;

  -- Check if user has activity today by checking actual activity tables
  -- Convert timestamps to user's timezone, then extract the date
  -- This directly queries the source tables instead of relying on last_activity_date
  -- Check all activity types and combine with OR
  SELECT 
    EXISTS(
      SELECT 1
      FROM public.user_workout_logs uwl
      WHERE uwl.user_id = p_user_id 
        AND uwl.completed_at IS NOT NULL
        AND (uwl.completed_at AT TIME ZONE v_user_timezone)::DATE = v_today
    ) OR
    EXISTS(
      SELECT 1
      FROM public.mental_session_logs msl
      WHERE msl.profile_id = p_user_id 
        AND msl.completed_at IS NOT NULL
        AND (msl.completed_at AT TIME ZONE v_user_timezone)::DATE = v_today
    ) OR
    EXISTS(
      SELECT 1
      FROM public.runs r
      WHERE r.user_id = p_user_id 
        AND r.status = 'completed' 
        AND r.end_time IS NOT NULL
        AND (r.end_time AT TIME ZONE v_user_timezone)::DATE = v_today
    )
  INTO v_has_activity_today;

  -- Check if streak is at risk (last activity was yesterday and no activity today)
  v_is_at_risk := (v_last_activity_date = v_yesterday) AND NOT v_has_activity_today;

  RETURN QUERY SELECT 
    v_current_streak,
    v_longest_streak,
    v_last_activity_date,
    v_has_activity_today,
    v_is_at_risk;
END;
$$;

