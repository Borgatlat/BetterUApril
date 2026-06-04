-- BetterU Phase: institutional safety & compliance — additive prerequisites.
-- This migration adds two NEW columns to the existing public.profiles table.
-- Both are NULLABLE / DEFAULTED so existing rows continue to satisfy CHECK constraints.
--
-- 1) profiles.grade_level
--      Used by the anonymized_weekly_wellness_trends materialized view to bucket
--      students into board-report cohorts (e.g. "grade 11 stress avg this week").
--      Stored as text so K-8 districts and 9-12 high schools can use the same shape.
--
-- 2) profiles.focus_points
--      Dedicated wallet for Phone-Free Focus Mode rewards. We intentionally keep
--      this separate from neuros_balance / sparks_balance so analytics can attribute
--      "minutes of phone-free engagement" rewards to focus sessions only.

-- ---------------------------------------------------------------------------
-- profiles.grade_level
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade_level text;

-- Idempotent constraint: drop-if-exists then re-add. Lets us tighten the allowed
-- set later without a separate migration. CHECK allows NULL so we don't break
-- non-school users (account_type = 'public') who don't have a grade.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_grade_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_grade_level_check CHECK (
    grade_level IS NULL OR grade_level IN (
      'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'other'
    )
  );

COMMENT ON COLUMN public.profiles.grade_level IS
  'School grade for institutional cohort analytics (K, 1..12, other). NULL for non-students.';

-- Index supports cohort grouping in the materialized view refresh path.
CREATE INDEX IF NOT EXISTS idx_profiles_org_grade
  ON public.profiles (org_id, grade_level)
  WHERE org_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- profiles.focus_points
-- ---------------------------------------------------------------------------
-- NOT NULL DEFAULT 0 is safe because Postgres backfills the default at column-add
-- time (PG 11+ stores the default in metadata, so this is O(1) even on huge tables).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS focus_points integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.focus_points IS
  'Reward wallet for Phone-Free Focus Mode. Written ONLY by increment_student_rewards_points RPC.';

CREATE INDEX IF NOT EXISTS idx_profiles_focus_points
  ON public.profiles (focus_points DESC)
  WHERE focus_points > 0;
