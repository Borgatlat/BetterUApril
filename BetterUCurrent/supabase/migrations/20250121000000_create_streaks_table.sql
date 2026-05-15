-- BetterU Streaks System
-- This migration creates a dedicated streaks table and all necessary functions/triggers

-- ============================================================================
-- 1. CREATE STREAKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Streak tracking fields
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_activity_date DATE, -- Last date user completed an activity
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one streak record per user
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_last_activity_date ON public.user_streaks(last_activity_date);

-- Enable Row Level Security
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can read any streak, but only update their own
-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can view streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can manage their own streak" ON public.user_streaks;

CREATE POLICY "Anyone can view streaks"
  ON public.user_streaks
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own streak"
  ON public.user_streaks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. CREATE STREAK UPDATE FUNCTION
-- ============================================================================
-- This function calculates and updates streaks when activities are completed
CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id UUID,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  streak_updated BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Allows function to bypass RLS when needed
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_last_activity_date DATE;
  v_days_since_last INTEGER;
  v_streak_updated BOOLEAN := false;
BEGIN
  -- Get current streak data (or initialize if doesn't exist)
  -- Use table alias to avoid ambiguity between column names and variables
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, '1970-01-01'::DATE)
  INTO v_current_streak, v_longest_streak, v_last_activity_date
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  -- Calculate days since last activity
  -- This tells us if the streak should continue, increment, or reset
  v_days_since_last := p_activity_date - v_last_activity_date;

  -- Streak logic:
  -- - Same day (0 days): No change to streak
  -- - Next consecutive day (1 day): Increment streak
  -- - More than 1 day gap: Reset streak to 1
  IF v_days_since_last = 0 THEN
    -- Same day - no change needed
    v_streak_updated := false;
  ELSIF v_days_since_last = 1 THEN
    -- Consecutive day - increment streak!
    v_current_streak := v_current_streak + 1;
    -- Update longest streak if current exceeds it
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    v_streak_updated := true;
  ELSE
    -- Gap detected (more than 1 day) - reset streak to 1
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
    GREATEST(v_longest_streak, v_current_streak), -- Ensure longest is always max
    p_activity_date, 
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = v_current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_current_streak),
    last_activity_date = p_activity_date,
    updated_at = NOW();

  -- Return the updated values
  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_streak_updated;
END;
$$;

-- ============================================================================
-- 3. CREATE TRIGGER FUNCTIONS FOR AUTOMATIC STREAK UPDATES
-- ============================================================================

-- Trigger function for workouts
CREATE OR REPLACE FUNCTION public.update_streak_on_workout()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update streak if workout is completed
  IF NEW.completed_at IS NOT NULL THEN
    PERFORM public.update_user_streak(NEW.user_id, DATE(NEW.completed_at));
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for mental sessions
CREATE OR REPLACE FUNCTION public.update_streak_on_mental_session()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update streak if session is completed
  IF NEW.completed_at IS NOT NULL THEN
    PERFORM public.update_user_streak(NEW.profile_id, DATE(NEW.completed_at));
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for runs/walks
CREATE OR REPLACE FUNCTION public.update_streak_on_run()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update streak if run/walk is completed
  IF NEW.status = 'completed' AND NEW.end_time IS NOT NULL THEN
    PERFORM public.update_user_streak(NEW.user_id, DATE(NEW.end_time));
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. ATTACH TRIGGERS TO ACTIVITY TABLES
-- ============================================================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_streak_workout ON public.user_workout_logs;
DROP TRIGGER IF EXISTS trigger_update_streak_mental ON public.mental_session_logs;
DROP TRIGGER IF EXISTS trigger_update_streak_run ON public.runs;

-- Create triggers
CREATE TRIGGER trigger_update_streak_workout
  AFTER INSERT OR UPDATE ON public.user_workout_logs
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION public.update_streak_on_workout();

CREATE TRIGGER trigger_update_streak_mental
  AFTER INSERT OR UPDATE ON public.mental_session_logs
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION public.update_streak_on_mental_session();

CREATE TRIGGER trigger_update_streak_run
  AFTER INSERT OR UPDATE ON public.runs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.end_time IS NOT NULL)
  EXECUTE FUNCTION public.update_streak_on_run();

-- ============================================================================
-- 5. CREATE HELPER FUNCTION TO GET STREAK STATUS
-- ============================================================================
-- This function returns streak info including whether user has activity today
CREATE OR REPLACE FUNCTION public.get_streak_status(p_user_id UUID)
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
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Get streak data
  -- Use table alias to avoid ambiguity between column names and variables
  SELECT 
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.last_activity_date, NULL)
  INTO v_current_streak, v_longest_streak, v_last_activity_date
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;

  -- Check if user has activity today
  v_has_activity_today := (v_last_activity_date = v_today);

  -- Check if streak is at risk (last activity was yesterday)
  v_is_at_risk := (v_last_activity_date = v_yesterday) AND NOT v_has_activity_today;

  RETURN QUERY SELECT 
    v_current_streak,
    v_longest_streak,
    v_last_activity_date,
    v_has_activity_today,
    v_is_at_risk;
END;
$$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- This system automatically updates streaks when:
-- 1. A workout is completed (user_workout_logs.completed_at is set)
-- 2. A mental session is completed (mental_session_logs.completed_at is set)
-- 3. A run/walk is completed (runs.status = 'completed' and end_time is set)
--
-- Streak rules:
-- - Same day: No change
-- - Next day: Increment streak
-- - Gap > 1 day: Reset to 1
--
-- The system is designed to be:
-- - Automatic (triggers handle updates)
-- - Reliable (server-side logic)
-- - Efficient (indexed queries)
-- - Public (anyone can view any user's streak)

