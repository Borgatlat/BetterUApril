-- BetterU Badge System
-- This migration creates a complete badge system with automatic awarding, display management, and public visibility
-- App Release Date: November 23, 2025 (Founding Member cutoff: February 23, 2026)

-- ============================================================================
-- 1. BADGE DEFINITIONS TABLE
-- ============================================================================
-- This table stores all available badge types and their criteria
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Badge identification
  badge_type VARCHAR(50) NOT NULL, -- 'streak', 'workout_count', 'mental_count', 'founding_member', 'league'
  badge_key VARCHAR(100) NOT NULL UNIQUE, -- Unique identifier like 'streak_10', 'workout_100', 'league_diamond'
  
  -- Badge display information
  name VARCHAR(100) NOT NULL, -- Display name like "10 Day Streak", "Centurion Workout"
  description TEXT NOT NULL, -- What the badge represents
  how_to_earn TEXT NOT NULL, -- How the user earned/will earn this badge
  
  -- Badge icon and visual
  icon_url TEXT, -- Path to badge icon image
  
  -- Criteria for earning (if applicable)
  criteria_value INTEGER, -- Threshold value (e.g., 10 for streak, 100 for workouts)
  
  -- Metadata
  is_active BOOLEAN DEFAULT true NOT NULL, -- Can disable badges without deleting
  display_order INTEGER DEFAULT 0, -- Order for display in collection
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for efficient badge lookups
CREATE INDEX IF NOT EXISTS idx_badge_definitions_type ON public.badge_definitions(badge_type);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_key ON public.badge_definitions(badge_key);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_active ON public.badge_definitions(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. USER BADGES TABLE
-- ============================================================================
-- This table tracks which badges each user has earned
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and badge relationship
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  
  -- Display management (only one badge can be displayed at a time per user)
  is_displayed BOOLEAN DEFAULT false NOT NULL,
  
  -- When badge was earned
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Optional metadata (e.g., which team/league for league badges)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicate badges per user
  CONSTRAINT user_badges_user_id_badge_id_unique UNIQUE(user_id, badge_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_displayed ON public.user_badges(user_id, is_displayed) WHERE is_displayed = true;
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON public.user_badges(user_id, earned_at DESC);

-- ============================================================================
-- 3. ADD DISPLAYED BADGE COLUMN TO PROFILES
-- ============================================================================
-- Quick reference for the currently displayed badge (denormalized for performance)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS displayed_badge_id UUID REFERENCES public.badge_definitions(id) ON DELETE SET NULL;

-- Index for quick profile badge lookups
CREATE INDEX IF NOT EXISTS idx_profiles_displayed_badge ON public.profiles(displayed_badge_id) WHERE displayed_badge_id IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on badge tables
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badge Definitions: Public read access (everyone can see what badges exist)
DROP POLICY IF EXISTS "Badge definitions are viewable by everyone" ON public.badge_definitions;
CREATE POLICY "Badge definitions are viewable by everyone"
  ON public.badge_definitions
  FOR SELECT
  USING (true);

-- Badge Definitions: Only service role can modify (for admin operations)
DROP POLICY IF EXISTS "Badge definitions can be modified by service" ON public.badge_definitions;
CREATE POLICY "Badge definitions can be modified by service"
  ON public.badge_definitions
  FOR ALL
  USING (false) -- Regular users cannot modify, only service role can bypass RLS
  WITH CHECK (false);

-- User Badges: Public read access (everyone can see anyone's badges)
DROP POLICY IF EXISTS "User badges are viewable by everyone" ON public.user_badges;
CREATE POLICY "User badges are viewable by everyone"
  ON public.user_badges
  FOR SELECT
  USING (true);

-- User Badges: System can insert badges (via triggers/functions)
DROP POLICY IF EXISTS "System can award badges" ON public.user_badges;
CREATE POLICY "System can award badges"
  ON public.user_badges
  FOR INSERT
  WITH CHECK (true); -- Triggers and functions will handle this

-- User Badges: Users can update their own displayed badge
DROP POLICY IF EXISTS "Users can update their displayed badge" ON public.user_badges;
CREATE POLICY "Users can update their displayed badge"
  ON public.user_badges
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. BADGE AWARDING FUNCTIONS
-- ============================================================================

-- Function to check and award a specific badge to a user
-- This is the core function that determines if a user qualifies for a badge
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
      -- Do NOT use user_stats table - it doesn't work and has never been used
      -- Only use user_id column (not profile_id)
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
    -- Use constraint name in ON CONFLICT to avoid ambiguity with RETURNS TABLE badge_id column
    INSERT INTO public.user_badges (user_id, badge_id, earned_at, is_displayed)
    VALUES (p_user_id, v_badge_def.id, NOW(), false)
    ON CONFLICT ON CONSTRAINT user_badges_user_id_badge_id_unique DO NOTHING;
    
    -- Fetch the badge ID separately to avoid ambiguity
    SELECT ub.id INTO v_user_badge_id
    FROM public.user_badges ub
    WHERE ub.user_id = p_user_id
      AND ub.badge_id = v_badge_def.id;
    
    -- Return success
    RETURN QUERY SELECT true, v_badge_def.id, v_badge_def.name;
  ELSE
    -- Return not qualified
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR;
  END IF;
END;
$$;

-- Function to check all badges for a user (useful for backfilling)
CREATE OR REPLACE FUNCTION public.check_all_badges_for_user(p_user_id UUID)
RETURNS TABLE(
  badge_key VARCHAR,
  awarded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge RECORD;
  v_result RECORD;
BEGIN
  -- Loop through all active badges
  -- Use table alias to avoid column name ambiguity
  FOR v_badge IN
    SELECT bd.badge_key, bd.badge_type
    FROM public.badge_definitions bd
    WHERE bd.is_active = true
  LOOP
    -- Check and award badge
    SELECT * INTO v_result
    FROM public.check_and_award_badge(p_user_id, v_badge.badge_key);
    
    -- Return result
    RETURN QUERY SELECT v_badge.badge_key, v_result.awarded;
  END LOOP;
END;
$$;

-- Function to set a user's displayed badge
-- This ensures only one badge is displayed at a time
CREATE OR REPLACE FUNCTION public.set_displayed_badge(
  p_user_id UUID,
  p_badge_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_has_badge BOOLEAN;
BEGIN
  -- Verify user actually has this badge
  -- Use table alias to avoid column name ambiguity
  SELECT EXISTS(
    SELECT 1
    FROM public.user_badges ub
    WHERE ub.user_id = p_user_id
      AND ub.badge_id = p_badge_id
  ) INTO v_user_has_badge;
  
  IF NOT v_user_has_badge THEN
    RETURN false; -- User doesn't have this badge
  END IF;
  
  -- Set all user's badges to not displayed
  -- Use table alias to avoid column name ambiguity
  UPDATE public.user_badges ub
  SET is_displayed = false
  WHERE ub.user_id = p_user_id;
  
  -- Set selected badge to displayed
  -- Use table alias to avoid column name ambiguity
  UPDATE public.user_badges ub
  SET is_displayed = true
  WHERE ub.user_id = p_user_id
    AND ub.badge_id = p_badge_id;
  
  -- Update profiles table for quick lookup
  -- Use table alias to avoid column name ambiguity
  UPDATE public.profiles p
  SET displayed_badge_id = p_badge_id
  WHERE p.id = p_user_id;
  
  RETURN true;
END;
$$;

-- Function to get all badges for a user with full details
CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id UUID)
RETURNS TABLE(
  badge_id UUID,
  badge_key VARCHAR,
  badge_name VARCHAR,
  badge_description TEXT,
  how_to_earn TEXT,
  icon_url TEXT,
  earned_at TIMESTAMP WITH TIME ZONE,
  is_displayed BOOLEAN,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bd.id,
    bd.badge_key,
    bd.name,
    bd.description,
    bd.how_to_earn,
    bd.icon_url,
    ub.earned_at,
    ub.is_displayed,
    ub.metadata
  FROM public.user_badges ub
  JOIN public.badge_definitions bd ON ub.badge_id = bd.id
  WHERE ub.user_id = p_user_id
  ORDER BY ub.earned_at DESC;
END;
$$;

-- ============================================================================
-- 6. TRIGGER FUNCTIONS FOR AUTOMATIC BADGE CHECKING
-- ============================================================================

-- Trigger function: Check streak badges when streak updates
CREATE OR REPLACE FUNCTION public.check_streak_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check all streak badges for this user
  PERFORM public.check_and_award_badge(NEW.user_id, 'streak_10');
  PERFORM public.check_and_award_badge(NEW.user_id, 'streak_25');
  PERFORM public.check_and_award_badge(NEW.user_id, 'streak_50');
  PERFORM public.check_and_award_badge(NEW.user_id, 'streak_100');
  PERFORM public.check_and_award_badge(NEW.user_id, 'streak_365');
  
  RETURN NEW;
END;
$$;

-- Trigger function: Check workout badges when workout is completed
CREATE OR REPLACE FUNCTION public.check_workout_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if workout was just completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
    -- Check all workout count badges
    PERFORM public.check_and_award_badge(NEW.user_id, 'workout_10');
    PERFORM public.check_and_award_badge(NEW.user_id, 'workout_50');
    PERFORM public.check_and_award_badge(NEW.user_id, 'workout_100');
    PERFORM public.check_and_award_badge(NEW.user_id, 'workout_500');
    PERFORM public.check_and_award_badge(NEW.user_id, 'workout_1000');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Check mental session badges when session is completed
CREATE OR REPLACE FUNCTION public.check_mental_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if session was just completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
    -- Check all mental session count badges
    PERFORM public.check_and_award_badge(NEW.profile_id, 'mental_10');
    PERFORM public.check_and_award_badge(NEW.profile_id, 'mental_50');
    PERFORM public.check_and_award_badge(NEW.profile_id, 'mental_100');
    PERFORM public.check_and_award_badge(NEW.profile_id, 'mental_500');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Check league badges when team league changes
CREATE OR REPLACE FUNCTION public.check_league_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_member RECORD;
BEGIN
  -- If league changed, check badges for all team members
  IF NEW.current_league IS DISTINCT FROM OLD.current_league THEN
    -- Get all team members
    -- Use table alias to avoid column name ambiguity
    FOR v_member IN
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.team_id = NEW.id
    LOOP
      -- Check league badge based on new league
      PERFORM public.check_and_award_badge(
        v_member.user_id,
        'league_' || LOWER(NEW.current_league)
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Check founding member badge on user signup
CREATE OR REPLACE FUNCTION public.check_founding_member_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check founding member badge for new user
  PERFORM public.check_and_award_badge(NEW.id, 'founding_member');
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. ATTACH TRIGGERS
-- ============================================================================

-- Trigger: Check streak badges when streak updates
DROP TRIGGER IF EXISTS trigger_check_streak_badges ON public.user_streaks;
CREATE TRIGGER trigger_check_streak_badges
  AFTER INSERT OR UPDATE ON public.user_streaks
  FOR EACH ROW
  WHEN (NEW.current_streak > 0)
  EXECUTE FUNCTION public.check_streak_badges();

-- Trigger: Check workout badges when workout is completed
DROP TRIGGER IF EXISTS trigger_check_workout_badges ON public.user_workout_logs;
CREATE TRIGGER trigger_check_workout_badges
  AFTER INSERT OR UPDATE ON public.user_workout_logs
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION public.check_workout_badges();

-- Trigger: Check mental session badges when session is completed
DROP TRIGGER IF EXISTS trigger_check_mental_badges ON public.mental_session_logs;
CREATE TRIGGER trigger_check_mental_badges
  AFTER INSERT OR UPDATE ON public.mental_session_logs
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION public.check_mental_badges();

-- Trigger: Check league badges when team league changes
DROP TRIGGER IF EXISTS trigger_check_league_badges ON public.teams;
CREATE TRIGGER trigger_check_league_badges
  AFTER UPDATE ON public.teams
  FOR EACH ROW
  WHEN (NEW.current_league IS DISTINCT FROM OLD.current_league)
  EXECUTE FUNCTION public.check_league_badges();

-- Trigger: Check founding member badge on profile creation
DROP TRIGGER IF EXISTS trigger_check_founding_member ON public.profiles;
CREATE TRIGGER trigger_check_founding_member
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_founding_member_badge();

-- ============================================================================
-- 8. SEED BADGE DEFINITIONS
-- ============================================================================

-- Insert all badge definitions
INSERT INTO public.badge_definitions (badge_type, badge_key, name, description, how_to_earn, criteria_value, display_order) VALUES
-- Streak Badges
('streak', 'streak_10', '10 Day Streak', 'Maintained a 10-day activity streak', 'Complete a workout, mental session, or run for 10 consecutive days', 10, 1),
('streak', 'streak_25', '25 Day Streak', 'Maintained a 25-day activity streak', 'Complete a workout, mental session, or run for 25 consecutive days', 25, 2),
('streak', 'streak_50', '50 Day Streak', 'Maintained a 50-day activity streak', 'Complete a workout, mental session, or run for 50 consecutive days', 50, 3),
('streak', 'streak_100', '100 Day Streak', 'Maintained a 100-day activity streak', 'Complete a workout, mental session, or run for 100 consecutive days', 100, 4),
('streak', 'streak_365', 'Year Warrior', 'Maintained a 365-day activity streak', 'Complete a workout, mental session, or run for 365 consecutive days - a full year!', 365, 5),

-- Workout Completion Badges
('workout_count', 'workout_10', 'Getting Started', 'Completed 10 workouts', 'Complete 10 total workouts in your fitness journey', 10, 10),
('workout_count', 'workout_50', 'Building Momentum', 'Completed 50 workouts', 'Complete 50 total workouts - you''re building a strong habit!', 50, 11),
('workout_count', 'workout_100', 'Centurion', 'Completed 100 workouts', 'Complete 100 total workouts - a true fitness centurion!', 100, 12),
('workout_count', 'workout_500', 'Fitness Veteran', 'Completed 500 workouts', 'Complete 500 total workouts - you''re a fitness veteran!', 500, 13),
('workout_count', 'workout_1000', 'Fitness Legend', 'Completed 1000 workouts', 'Complete 1000 total workouts - you''re a true fitness legend!', 1000, 14),

-- Mental Session Badges
('mental_count', 'mental_10', 'Mindful Beginner', 'Completed 10 mental wellness sessions', 'Complete 10 mental wellness sessions to start your mindfulness journey', 10, 20),
('mental_count', 'mental_50', 'Mindful Explorer', 'Completed 50 mental wellness sessions', 'Complete 50 mental wellness sessions - you''re exploring mindfulness deeply', 50, 21),
('mental_count', 'mental_100', 'Mindful Master', 'Completed 100 mental wellness sessions', 'Complete 100 mental wellness sessions - you''re a mindful master!', 100, 22),
('mental_count', 'mental_500', 'Zen Master', 'Completed 500 mental wellness sessions', 'Complete 500 mental wellness sessions - you''ve achieved zen mastery!', 500, 23),

-- Founding Member Badge
('founding_member', 'founding_member', 'Founding Member', 'Joined BetterU within the first 3 months', 'Signed up for BetterU within 3 months of the app''s release on November 23, 2025', NULL, 30),

-- League Badges
('league', 'league_bronze', 'Bronze League', 'Part of a team in Bronze League', 'Your team reached Bronze League in the competitive league system', NULL, 40),
('league', 'league_silver', 'Silver League', 'Part of a team in Silver League', 'Your team reached Silver League in the competitive league system', NULL, 41),
('league', 'league_gold', 'Gold League', 'Part of a team in Gold League', 'Your team reached Gold League in the competitive league system', NULL, 42),
('league', 'league_platinum', 'Platinum League', 'Part of a team in Platinum League', 'Your team reached Platinum League in the competitive league system', NULL, 43),
('league', 'league_diamond', 'Diamond League', 'Part of a team in Diamond League', 'Your team reached Diamond League in the competitive league system', NULL, 44),
('league', 'league_master', 'Master League', 'Part of a team in Master League', 'Your team reached Master League - the highest tier in the competitive league system!', NULL, 45)

ON CONFLICT (badge_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  how_to_earn = EXCLUDED.how_to_earn,
  criteria_value = EXCLUDED.criteria_value,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================================================
-- 9. BACKFILL EXISTING USERS
-- ============================================================================
-- This will check and award badges to all existing users
-- Run this after the migration to award badges to users who already qualify

DO $$
DECLARE
  v_user RECORD;
BEGIN
  -- Loop through all existing users
  FOR v_user IN
    SELECT id FROM public.profiles
  LOOP
    -- Check all badges for this user
    PERFORM public.check_all_badges_for_user(v_user.id);
  END LOOP;
END $$;

-- ============================================================================
-- NOTES AND USAGE
-- ============================================================================
-- 
-- BADGE SYSTEM OVERVIEW:
-- 1. Badges are automatically awarded via triggers when users meet criteria
-- 2. Users can have multiple badges but only display one at a time
-- 3. Everyone can view anyone's badges (public visibility)
-- 4. Badge definitions are stored in badge_definitions table
-- 5. User badges are stored in user_badges table
-- 
-- KEY FUNCTIONS:
-- - check_and_award_badge(user_id, badge_key): Check and award a specific badge
-- - check_all_badges_for_user(user_id): Check all badges for a user
-- - set_displayed_badge(user_id, badge_id): Set which badge a user displays
-- - get_user_badges(user_id): Get all badges for a user with full details
--
-- TRIGGERS:
-- - Automatically check badges when streaks update
-- - Automatically check badges when workouts are completed
-- - Automatically check badges when mental sessions are completed
-- - Automatically check badges when team league changes
-- - Automatically check founding member badge on signup
--
-- TO CHANGE DISPLAYED BADGE (from app):
-- SELECT set_displayed_badge('user-uuid-here', 'badge-uuid-here');
--
-- TO GET USER'S BADGES (from app):
-- SELECT * FROM get_user_badges('user-uuid-here');
--
-- TO GET DISPLAYED BADGE (from app):
-- SELECT bd.*, ub.earned_at, ub.metadata
-- FROM profiles p
-- JOIN badge_definitions bd ON p.displayed_badge_id = bd.id
-- JOIN user_badges ub ON ub.badge_id = bd.id AND ub.user_id = p.id
-- WHERE p.id = 'user-uuid-here';
--
-- FOUNDING MEMBER CUTOFF:
-- App released: November 23, 2025
-- Founding Member cutoff: February 23, 2026 (3 months later)
-- To change, update v_app_release_date in check_and_award_badge function

