-- Fix badge checking to count workouts directly from user_workout_logs
-- instead of relying on user_stats.total_workouts which may not be updated

CREATE OR REPLACE FUNCTION public.check_and_award_badge(
  p_user_id UUID,
  p_badge_key VARCHAR
)
RETURNS TABLE(
  awarded BOOLEAN,
  badge_id UUID,
  badge_name VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER -- Allows function to bypass RLS when needed
AS $$
DECLARE
  v_badge_def RECORD;
  v_user_badge_id UUID;
  v_qualifies BOOLEAN := false;
  v_user_streak INTEGER;
  v_user_workouts INTEGER;
  v_user_mental INTEGER;
  v_user_created_at TIMESTAMP WITH TIME ZONE;
  v_team_league VARCHAR;
  v_app_release_date DATE := '2025-11-23'::DATE; -- App release date
  v_founding_cutoff DATE := v_app_release_date + INTERVAL '3 months'; -- 3 months after release (February 2026)
BEGIN
  -- Get badge definition
  -- Use table alias to avoid column name ambiguity
  SELECT * INTO v_badge_def
  FROM public.badge_definitions bd
  WHERE bd.badge_key = p_badge_key
    AND bd.is_active = true;
  
  -- If badge doesn't exist, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR;
    RETURN;
  END IF;
  
  -- Check if user already has this badge
  -- Use table alias to avoid column name ambiguity
  SELECT ub.id INTO v_user_badge_id
  FROM public.user_badges ub
  WHERE ub.user_id = p_user_id
    AND ub.badge_id = v_badge_def.id;
  
  -- If already has badge, return existing
  IF v_user_badge_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_badge_def.id, v_badge_def.name;
    RETURN;
  END IF;
  
  -- Check if user qualifies based on badge type
  CASE v_badge_def.badge_type
    WHEN 'streak' THEN
      -- Get user's current streak
      -- Use table alias to avoid column name ambiguity
      SELECT COALESCE(us.current_streak, 0) INTO v_user_streak
      FROM public.user_streaks us
      WHERE us.user_id = p_user_id;
      
      -- Qualifies if streak meets or exceeds criteria
      v_qualifies := (v_user_streak >= v_badge_def.criteria_value);
      
    WHEN 'workout_count' THEN
      -- Count workouts directly from user_workout_logs table
      -- Only use user_id column (not profile_id, and not user_stats table)
      SELECT COUNT(*)::INTEGER INTO v_user_workouts
      FROM public.user_workout_logs uwl
      WHERE uwl.user_id = p_user_id
        AND uwl.completed_at IS NOT NULL;
      
      -- Qualifies if workouts meet or exceed criteria
      v_qualifies := (v_user_workouts >= v_badge_def.criteria_value);
      
    WHEN 'mental_count' THEN
      -- Get user's total mental sessions completed
      -- Count from mental_session_logs table since user_stats may not have this column
      -- Use table alias to avoid column name ambiguity
      SELECT COUNT(*)::INTEGER INTO v_user_mental
      FROM public.mental_session_logs msl
      WHERE msl.profile_id = p_user_id
        AND msl.completed_at IS NOT NULL;
      
      -- Qualifies if mental sessions meet or exceed criteria
      v_qualifies := (v_user_mental >= v_badge_def.criteria_value);
      
    WHEN 'founding_member' THEN
      -- Get user's account creation date from profiles table
      -- Use table alias to avoid column name ambiguity
      SELECT p.created_at INTO v_user_created_at
      FROM public.profiles p
      WHERE p.id = p_user_id;
      
      -- Qualifies if user created account before the cutoff date (3 months after app release)
      -- Any user who signed up before February 23, 2026 gets this badge
      IF v_user_created_at IS NOT NULL THEN
        v_qualifies := (DATE(v_user_created_at) < v_founding_cutoff);
      END IF;
      
    WHEN 'league' THEN
      -- Get user's team's current league
      -- Use table aliases to avoid column name ambiguity
      SELECT t.current_league INTO v_team_league
      FROM public.team_members tm
      JOIN public.teams t ON tm.team_id = t.id
      WHERE tm.user_id = p_user_id;
      
      -- Qualifies if team's league matches badge criteria
      -- Badge key format: 'league_diamond', 'league_bronze', etc.
      IF v_team_league IS NOT NULL THEN
        v_qualifies := (LOWER(v_team_league) = LOWER(REPLACE(v_badge_def.badge_key, 'league_', '')));
      END IF;
      
    ELSE
      -- Unknown badge type
      v_qualifies := false;
  END CASE;
  
  -- If user qualifies, award the badge
  IF v_qualifies THEN
    -- Insert badge award
    -- Use explicit constraint name to avoid ambiguity
    INSERT INTO public.user_badges (user_id, badge_id, earned_at, is_displayed)
    VALUES (p_user_id, v_badge_def.id, NOW(), false)
    ON CONFLICT ON CONSTRAINT user_badges_user_id_badge_id_unique DO NOTHING
    RETURNING id INTO v_user_badge_id;
    
    -- Return success
    IF v_user_badge_id IS NOT NULL THEN
      RETURN QUERY SELECT true, v_badge_def.id, v_badge_def.name;
    ELSE
      -- Badge was already awarded (race condition)
      RETURN QUERY SELECT true, v_badge_def.id, v_badge_def.name;
    END IF;
  ELSE
    -- User doesn't qualify
    RETURN QUERY SELECT false, v_badge_def.id, v_badge_def.name;
  END IF;
END;
$$;

-- Create a diagnostic function to check user's badge eligibility
CREATE OR REPLACE FUNCTION public.diagnose_badge_eligibility(p_user_id UUID)
RETURNS TABLE(
  badge_key VARCHAR,
  badge_name VARCHAR,
  criteria_value INTEGER,
  user_value INTEGER,
  qualifies BOOLEAN,
  already_earned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge RECORD;
  v_user_streak INTEGER;
  v_user_workouts INTEGER;
  v_user_mental INTEGER;
  v_user_created_at TIMESTAMP WITH TIME ZONE;
  v_team_league VARCHAR;
  v_app_release_date DATE := '2025-11-23'::DATE;
  v_founding_cutoff DATE := v_app_release_date + INTERVAL '3 months'; -- February 2026
  v_qualifies BOOLEAN;
  v_has_badge BOOLEAN;
BEGIN
  -- Get user's current values
  SELECT COALESCE(us.current_streak, 0) INTO v_user_streak
  FROM public.user_streaks us
  WHERE us.user_id = p_user_id;
  
  SELECT COUNT(*)::INTEGER INTO v_user_workouts
  FROM public.user_workout_logs uwl
  WHERE uwl.user_id = p_user_id
    AND uwl.completed_at IS NOT NULL;
  
  SELECT COUNT(*)::INTEGER INTO v_user_mental
  FROM public.mental_session_logs msl
  WHERE msl.profile_id = p_user_id
    AND msl.completed_at IS NOT NULL;
  
  SELECT p.created_at INTO v_user_created_at
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  -- Loop through all active badges
  FOR v_badge IN 
    SELECT * FROM public.badge_definitions WHERE is_active = true
  LOOP
    v_qualifies := false;
    v_has_badge := EXISTS(
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = p_user_id AND ub.badge_id = v_badge.id
    );
    
    CASE v_badge.badge_type
      WHEN 'streak' THEN
        v_qualifies := (v_user_streak >= v_badge.criteria_value);
        RETURN QUERY SELECT 
          v_badge.badge_key,
          v_badge.name,
          v_badge.criteria_value,
          v_user_streak,
          v_qualifies,
          v_has_badge;
          
      WHEN 'workout_count' THEN
        v_qualifies := (v_user_workouts >= v_badge.criteria_value);
        RETURN QUERY SELECT 
          v_badge.badge_key,
          v_badge.name,
          v_badge.criteria_value,
          v_user_workouts,
          v_qualifies,
          v_has_badge;
          
      WHEN 'mental_count' THEN
        v_qualifies := (v_user_mental >= v_badge.criteria_value);
        RETURN QUERY SELECT 
          v_badge.badge_key,
          v_badge.name,
          v_badge.criteria_value,
          v_user_mental,
          v_qualifies,
          v_has_badge;
          
      WHEN 'founding_member' THEN
        -- Any user who created account before the cutoff date (3 months after app release) gets this badge
        IF v_user_created_at IS NOT NULL THEN
          v_qualifies := (DATE(v_user_created_at) < v_founding_cutoff);
        END IF;
        RETURN QUERY SELECT 
          v_badge.badge_key,
          v_badge.name,
          NULL::INTEGER,
          CASE WHEN v_user_created_at IS NOT NULL THEN 1 ELSE 0 END,
          v_qualifies,
          v_has_badge;
          
      WHEN 'league' THEN
        SELECT t.current_league INTO v_team_league
        FROM public.team_members tm
        JOIN public.teams t ON tm.team_id = t.id
        WHERE tm.user_id = p_user_id
        LIMIT 1;
        
        IF v_team_league IS NOT NULL THEN
          v_qualifies := (LOWER(v_team_league) = LOWER(REPLACE(v_badge.badge_key, 'league_', '')));
        END IF;
        RETURN QUERY SELECT 
          v_badge.badge_key,
          v_badge.name,
          NULL::INTEGER,
          CASE WHEN v_team_league IS NOT NULL THEN 1 ELSE 0 END,
          v_qualifies,
          v_has_badge;
    END CASE;
  END LOOP;
END;
$$;

