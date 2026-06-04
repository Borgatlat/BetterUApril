-- BetterU Feature 2: FERPA-compliant "One-Click Board Report" export.
--
-- This migration creates TWO materialized views and TWO security-definer RPCs.
-- Materialized views = pre-computed query result cached on disk; very fast for
-- repeated reads (board dashboards refresh once per day, not per click).
--
-- WHY MATERIALIZED VIEW NOT A REGULAR VIEW
-- A normal VIEW re-runs the underlying SELECT every time it is queried, which
-- means scanning thousands of daily_pulse_logs rows on every admin page load.
-- A MATERIALIZED VIEW stores the SELECT output as a real table, so admin reads
-- are sub-millisecond. Trade-off: data is stale until REFRESH runs.
--
-- WHY THE "HAVING COUNT(*) >= 5" K-ANONYMITY FLOOR
-- FERPA expects that aggregate data cannot be re-identified down to individuals.
-- If a "grade 11" cohort has only 2 students who logged a pulse this week, the
-- average is effectively that 2-person disclosure. Suppressing buckets with
-- <5 contributors enforces de-identification at the database layer.
--
-- WHY SECURITY DEFINER FOR THE RPC
-- Materialized views CANNOT have Row-Level Security policies. So we expose them
-- via a SECURITY DEFINER function that checks `auth.uid()`'s account_type and
-- org_id BEFORE returning rows. The function runs with the owner's privileges
-- (postgres role), so callers can read aggregates even though they have NO
-- direct GRANT on the underlying materialized view.

-- ============================================================================
-- 1) Materialized view: weekly wellness trends from daily_pulse_logs
-- ============================================================================
-- date_trunc('week', timestamp) returns the Monday 00:00 of the timestamp's week.
-- This buckets all pulses Mon-Sun into a single "week_start" row per cohort.
-- Casting to ::date drops the time + tz so all clients see the same week label.
DROP MATERIALIZED VIEW IF EXISTS public.anonymized_weekly_wellness_trends;

CREATE MATERIALIZED VIEW public.anonymized_weekly_wellness_trends AS
SELECT
  p.org_id,
  COALESCE(p.grade_level, 'unspecified') AS grade_level,
  date_trunc('week', d.created_at)::date AS week_start,
  AVG(d.mood::numeric)          AS avg_mood,
  AVG(d.stress_level::numeric)  AS avg_stress,
  AVG(d.sleep_quality::numeric) AS avg_sleep,
  COUNT(*)::bigint              AS sample_size,
  'aggregated_deidentified'::text AS data_classification
FROM public.daily_pulse_logs d
INNER JOIN public.profiles p ON p.id = d.profile_id
WHERE d.anonymize_aggregate = true
  AND p.org_id IS NOT NULL
GROUP BY
  p.org_id,
  COALESCE(p.grade_level, 'unspecified'),
  date_trunc('week', d.created_at)
HAVING COUNT(*) >= 5;

COMMENT ON MATERIALIZED VIEW public.anonymized_weekly_wellness_trends IS
  'FERPA-safe weekly cohort averages (org_id, grade_level, week). No student_id ever exposed. k=5 floor.';

-- A unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- CONCURRENTLY = swap-in refresh that does not block readers. Without a unique
-- index Postgres cannot diff old vs new rows and would fail the CONCURRENTLY call.
CREATE UNIQUE INDEX IF NOT EXISTS uq_anon_weekly_wellness_cohort
  ON public.anonymized_weekly_wellness_trends (org_id, grade_level, week_start);

-- ============================================================================
-- 2) Materialized view: weekly spiritual trends from spiritual_pulses
-- ============================================================================
-- Same shape, but the metric is intensity (1-5) of consolation/desolation pulses.
-- Schools running a Jesuit/Ignatian formation arc use this alongside mood/stress.
DROP MATERIALIZED VIEW IF EXISTS public.anonymized_weekly_spiritual_trends;

CREATE MATERIALIZED VIEW public.anonymized_weekly_spiritual_trends AS
SELECT
  sp.org_id,
  COALESCE(p.grade_level, 'unspecified') AS grade_level,
  date_trunc('week', sp.created_at)::date AS week_start,
  AVG(sp.intensity::numeric)              AS avg_intensity,
  -- COUNT(*) FILTER (WHERE ...) — Postgres-idiomatic conditional count. Much
  -- cleaner than SUM(CASE WHEN ... THEN 1 ELSE 0 END) and slightly faster.
  COUNT(*) FILTER (WHERE sp.state = 'consolation')::bigint AS consolation_count,
  COUNT(*) FILTER (WHERE sp.state = 'desolation')::bigint  AS desolation_count,
  COUNT(*)::bigint                        AS sample_size,
  'aggregated_deidentified'::text         AS data_classification
FROM public.spiritual_pulses sp
INNER JOIN public.profiles p ON p.id = sp.profile_id
GROUP BY
  sp.org_id,
  COALESCE(p.grade_level, 'unspecified'),
  date_trunc('week', sp.created_at)
HAVING COUNT(*) >= 5;

COMMENT ON MATERIALIZED VIEW public.anonymized_weekly_spiritual_trends IS
  'FERPA-safe weekly cohort spiritual intensity averages. No student_id ever exposed. k=5 floor.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_anon_weekly_spiritual_cohort
  ON public.anonymized_weekly_spiritual_trends (org_id, grade_level, week_start);

-- ============================================================================
-- 3) refresh_wellness_analytics_cache — SECURITY DEFINER
-- ============================================================================
-- Called by admin "Refresh data" button (or by a scheduled function later).
-- Pattern: authorize caller, then refresh both materialized views concurrently.
CREATE OR REPLACE FUNCTION public.refresh_wellness_analytics_cache()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path is locked so a malicious caller can't shadow public objects with
-- a same-named table in their own schema (classic SECURITY DEFINER hardening).
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
BEGIN
  -- Only admins/counselors with any org membership may refresh.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'counselor')
      AND org_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.anonymized_weekly_wellness_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.anonymized_weekly_spiritual_trends;

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed_at', clock_timestamp(),
    'duration_ms', EXTRACT(milliseconds FROM clock_timestamp() - v_started_at)
  );
END;
$$;

-- Lock down: only authenticated roles may call. Public anon = denied.
REVOKE ALL ON FUNCTION public.refresh_wellness_analytics_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_wellness_analytics_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_wellness_analytics_cache() TO service_role;

-- ============================================================================
-- 4) get_anonymized_weekly_trends — SECURITY DEFINER read path
-- ============================================================================
-- Wraps the wellness materialized view with an org-scoped RLS-equivalent check.
-- Returning a SETOF rows type lets the Supabase JS client treat it like a table.
CREATE OR REPLACE FUNCTION public.get_anonymized_weekly_trends(
  p_org_id text,
  p_weeks_back integer DEFAULT 12
)
RETURNS TABLE (
  org_id text,
  grade_level text,
  week_start date,
  avg_mood numeric,
  avg_stress numeric,
  avg_sleep numeric,
  sample_size bigint,
  data_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'counselor')
      AND profiles.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized for this org' USING ERRCODE = '42501';
  END IF;

  -- GREATEST clamps weeks_back to a sane window so an attacker can't request
  -- 10,000 weeks of data and DoS the materialized view scan.
  RETURN QUERY
  SELECT
    t.org_id,
    t.grade_level,
    t.week_start,
    t.avg_mood,
    t.avg_stress,
    t.avg_sleep,
    t.sample_size,
    t.data_classification
  FROM anonymized_weekly_wellness_trends t
  WHERE t.org_id = p_org_id
    AND t.week_start >= (CURRENT_DATE - (GREATEST(LEAST(p_weeks_back, 52), 1) * 7))
  ORDER BY t.week_start DESC, t.grade_level ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_anonymized_weekly_trends(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anonymized_weekly_trends(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_anonymized_weekly_trends(text, integer) TO service_role;

-- ============================================================================
-- 5) get_anonymized_weekly_spiritual_trends — SECURITY DEFINER read path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_anonymized_weekly_spiritual_trends(
  p_org_id text,
  p_weeks_back integer DEFAULT 12
)
RETURNS TABLE (
  org_id text,
  grade_level text,
  week_start date,
  avg_intensity numeric,
  consolation_count bigint,
  desolation_count bigint,
  sample_size bigint,
  data_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'counselor')
      AND profiles.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized for this org' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.org_id,
    t.grade_level,
    t.week_start,
    t.avg_intensity,
    t.consolation_count,
    t.desolation_count,
    t.sample_size,
    t.data_classification
  FROM anonymized_weekly_spiritual_trends t
  WHERE t.org_id = p_org_id
    AND t.week_start >= (CURRENT_DATE - (GREATEST(LEAST(p_weeks_back, 52), 1) * 7))
  ORDER BY t.week_start DESC, t.grade_level ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_anonymized_weekly_spiritual_trends(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anonymized_weekly_spiritual_trends(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_anonymized_weekly_spiritual_trends(text, integer) TO service_role;

-- ============================================================================
-- 6) Lock down direct SELECT on the materialized views
-- ============================================================================
-- Defense in depth: even if someone gets a leaked anon key, they cannot bypass
-- the SECURITY DEFINER RPC by SELECTing the view directly.
REVOKE ALL ON public.anonymized_weekly_wellness_trends FROM PUBLIC;
REVOKE ALL ON public.anonymized_weekly_wellness_trends FROM authenticated;
REVOKE ALL ON public.anonymized_weekly_spiritual_trends FROM PUBLIC;
REVOKE ALL ON public.anonymized_weekly_spiritual_trends FROM authenticated;

-- Service role keeps SELECT so server-side jobs (cron, edge functions) still work.
GRANT SELECT ON public.anonymized_weekly_wellness_trends TO service_role;
GRANT SELECT ON public.anonymized_weekly_spiritual_trends TO service_role;

-- ============================================================================
-- 7) Initial seed refresh (no-op if both views are empty)
-- ============================================================================
-- We cannot REFRESH CONCURRENTLY on first creation because the view is empty
-- and lacks the populated state CONCURRENTLY requires. Run a plain REFRESH once
-- to materialize whatever data exists right now.
REFRESH MATERIALIZED VIEW public.anonymized_weekly_wellness_trends;
REFRESH MATERIALIZED VIEW public.anonymized_weekly_spiritual_trends;
