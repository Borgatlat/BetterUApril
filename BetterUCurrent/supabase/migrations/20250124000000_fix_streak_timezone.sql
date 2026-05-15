-- Fix Streak Timezone Issue
-- The problem: Triggers were using DATE(completed_at) which converts to UTC date
-- But users in different timezones were seeing their activities grouped into wrong days
-- 
-- Example: User in PST (UTC-8) completes activity at 10pm local = 6am UTC next day
-- Day 1 at 10pm PST → stored as Day 2 UTC
-- Day 2 at 8am PST → stored as Day 2 UTC  
-- Both appear as "same day" so streak doesn't increment!
--
-- Fix: Pass the actual timestamp to the function and let it convert to local time

-- ============================================================================
-- 1. UPDATE THE STREAK UPDATE FUNCTION TO BE TIMEZONE-AWARE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id UUID,
  p_activity_timestamp TIMESTAMPTZ DEFAULT NOW(), -- Changed from DATE to TIMESTAMPTZ
  p_timezone TEXT DEFAULT 'UTC' -- User's timezone (e.g., 'America/Los_Angeles')
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
BEGIN
  -- Validate timezone (default to UTC if invalid)
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_user_timezone := 'UTC';
  END;

  -- Convert the activity timestamp to the user's local date
  -- This ensures activities are grouped by the USER'S day, not UTC
  v_activity_date := (p_activity_timestamp AT TIME ZONE v_user_timezone)::DATE;

  -- Get current streak data (or initialize if doesn't exist)
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, '1970-01-01'::DATE)
  INTO v_current_streak, v_longest_streak, v_last_activity_date
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

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
    -- Gap detected OR first activity ever - set streak to 1
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
    v_activity_date,  -- Store the LOCAL date, not UTC
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
-- 2. UPDATE TRIGGER FUNCTIONS TO PASS TIMESTAMP + TIMEZONE
-- ============================================================================

-- Helper function to get user's timezone from their profile
-- Falls back to UTC if not set
CREATE OR REPLACE FUNCTION public.get_user_timezone(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  -- Try to get timezone from profiles table
  SELECT timezone INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Return timezone or default to UTC
  RETURN COALESCE(v_timezone, 'UTC');
EXCEPTION WHEN OTHERS THEN
  RETURN 'UTC';
END;
$$;

-- Updated trigger for workouts - now passes timestamp and gets user timezone
CREATE OR REPLACE FUNCTION public.update_streak_on_workout()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    -- Get the user's timezone preference
    v_timezone := public.get_user_timezone(NEW.user_id);
    -- Pass the actual timestamp and timezone for accurate local date calculation
    PERFORM public.update_user_streak(NEW.user_id, NEW.completed_at, v_timezone);
  END IF;
  RETURN NEW;
END;
$$;

-- Updated trigger for mental sessions
CREATE OR REPLACE FUNCTION public.update_streak_on_mental_session()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    v_timezone := public.get_user_timezone(NEW.profile_id);
    PERFORM public.update_user_streak(NEW.profile_id, NEW.completed_at, v_timezone);
  END IF;
  RETURN NEW;
END;
$$;

-- Updated trigger for runs/walks/bikes
CREATE OR REPLACE FUNCTION public.update_streak_on_run()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  IF NEW.status = 'completed' AND NEW.end_time IS NOT NULL THEN
    v_timezone := public.get_user_timezone(NEW.user_id);
    PERFORM public.update_user_streak(NEW.user_id, NEW.end_time, v_timezone);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. ADD TIMEZONE COLUMN TO PROFILES IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE FUNCTION TO RECALCULATE STREAK FROM SCRATCH
-- ============================================================================
-- This is useful for fixing existing users whose streaks are wrong
CREATE OR REPLACE FUNCTION public.recalculate_user_streak(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  new_current_streak INTEGER,
  new_longest_streak INTEGER,
  activities_found INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_last_date DATE := NULL;
  v_today DATE;
  v_activity_count INTEGER := 0;
  v_user_timezone TEXT;
  r RECORD;
BEGIN
  -- Validate timezone
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
    v_user_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_user_timezone := 'UTC';
  END;

  v_today := (NOW() AT TIME ZONE v_user_timezone)::DATE;

  -- Get all unique activity dates in LOCAL time, sorted
  -- Note: Using 'activity_row' as loop variable to avoid conflict with table aliases
  FOR r IN (
    WITH all_activities AS (
      SELECT DISTINCT (uwl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
      FROM public.user_workout_logs uwl
      WHERE uwl.user_id = p_user_id AND uwl.completed_at IS NOT NULL
      UNION
      SELECT DISTINCT (msl.completed_at AT TIME ZONE v_user_timezone)::DATE as activity_date
      FROM public.mental_session_logs msl
      WHERE msl.profile_id = p_user_id AND msl.completed_at IS NOT NULL
      UNION
      SELECT DISTINCT (rn.end_time AT TIME ZONE v_user_timezone)::DATE as activity_date
      FROM public.runs rn
      WHERE rn.user_id = p_user_id AND rn.status = 'completed' AND rn.end_time IS NOT NULL
    )
    SELECT activity_date FROM all_activities ORDER BY activity_date
  ) LOOP
    v_activity_count := v_activity_count + 1;
    
    IF v_last_date IS NULL THEN
      -- First activity ever
      v_current_streak := 1;
    ELSIF r.activity_date - v_last_date = 1 THEN
      -- Consecutive day - increment
      v_current_streak := v_current_streak + 1;
    ELSIF r.activity_date - v_last_date > 1 THEN
      -- Gap - reset to 1
      v_current_streak := 1;
    END IF;
    -- Same day (= 0) doesn't change anything
    
    -- Track longest
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    
    v_last_date := r.activity_date;
  END LOOP;

  -- Check if streak should be broken (no activity today or yesterday)
  IF v_last_date IS NOT NULL THEN
    IF v_today - v_last_date > 1 THEN
      -- Streak is broken - more than 1 day since last activity
      v_current_streak := 0;
    END IF;
  END IF;

  -- Update the user_streaks table
  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
  VALUES (p_user_id, v_current_streak, v_longest_streak, v_last_date, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_longest_streak),
    last_activity_date = v_last_date,
    updated_at = NOW();

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_activity_count;
END;
$$;

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this migration:
-- 1. Users should set their timezone in the app (stored in profiles.timezone)
-- 2. The app should pass the user's timezone when calling streak functions
-- 3. To fix a user's streak, call: SELECT * FROM recalculate_user_streak('user-uuid', 'America/New_York');

