-- Migration: Add 10 Neuros to activity owner when someone likes their activity
-- Every like (kudos) on workout, mental session, or run credits the post owner with 10 Neuros.
-- Self-likes do not award Neuros.

-- ============================================================================
-- 1. FUNCTION: Award 10 Neuros to activity owner on kudos (workout)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.award_neuros_on_workout_kudos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Get workout owner (don't reward self-likes)
  SELECT user_id INTO v_owner_id
  FROM public.user_workout_logs
  WHERE id = NEW.workout_id;

  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    UPDATE public.profiles
    SET neuros_balance = COALESCE(neuros_balance, 0) + 10
    WHERE id = v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. FUNCTION: Award 10 Neuros to activity owner on kudos (mental session)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.award_neuros_on_mental_kudos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Get mental session owner (profile_id); don't reward self-likes
  SELECT profile_id INTO v_owner_id
  FROM public.mental_session_logs
  WHERE id = NEW.session_id;

  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    UPDATE public.profiles
    SET neuros_balance = COALESCE(neuros_balance, 0) + 10
    WHERE id = v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. FUNCTION: Award 10 Neuros to activity owner on kudos (run)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.award_neuros_on_run_kudos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Get run owner; don't reward self-likes
  SELECT user_id INTO v_owner_id
  FROM public.runs
  WHERE id = NEW.run_id;

  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    UPDATE public.profiles
    SET neuros_balance = COALESCE(neuros_balance, 0) + 10
    WHERE id = v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. DROP EXISTING TRIGGERS (idempotency)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_award_neuros_on_workout_kudos ON public.workout_kudos;
DROP TRIGGER IF EXISTS trg_award_neuros_on_mental_kudos ON public.mental_session_kudos;
DROP TRIGGER IF EXISTS trg_award_neuros_on_run_kudos ON public.run_kudos;

-- ============================================================================
-- 5. CREATE TRIGGERS
-- ============================================================================
CREATE TRIGGER trg_award_neuros_on_workout_kudos
  AFTER INSERT ON public.workout_kudos
  FOR EACH ROW
  EXECUTE FUNCTION public.award_neuros_on_workout_kudos();

CREATE TRIGGER trg_award_neuros_on_mental_kudos
  AFTER INSERT ON public.mental_session_kudos
  FOR EACH ROW
  EXECUTE FUNCTION public.award_neuros_on_mental_kudos();

CREATE TRIGGER trg_award_neuros_on_run_kudos
  AFTER INSERT ON public.run_kudos
  FOR EACH ROW
  EXECUTE FUNCTION public.award_neuros_on_run_kudos();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.award_neuros_on_workout_kudos() IS
'Awards 10 Neuros to the workout owner when someone (other than themselves) likes their workout.';

COMMENT ON FUNCTION public.award_neuros_on_mental_kudos() IS
'Awards 10 Neuros to the mental session owner when someone (other than themselves) likes their session.';

COMMENT ON FUNCTION public.award_neuros_on_run_kudos() IS
'Awards 10 Neuros to the run owner when someone (other than themselves) likes their run.';
