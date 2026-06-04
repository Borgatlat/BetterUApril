-- JSN accreditation metrics: org-level aggregates for institutional reporting.
-- No student identifiers exposed. Materialized view + SECURITY DEFINER RPC.

-- ============================================================================
-- 1) Academic year helper (Aug 1 – Jul 31 default)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_academic_year_start(p_as_of date DEFAULT CURRENT_DATE)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT make_date(
    EXTRACT(year FROM p_as_of)::int
      - CASE
          WHEN p_as_of < make_date(EXTRACT(year FROM p_as_of)::int, 8, 1) THEN 1
          ELSE 0
        END,
    8,
    1
  );
$$;

COMMENT ON FUNCTION public.resolve_academic_year_start(date) IS
  'Returns Aug 1 of the current US high-school academic year for the given date.';

-- ============================================================================
-- 2) Materialized view
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS public.jsn_accreditation_metrics;

CREATE MATERIALIZED VIEW public.jsn_accreditation_metrics AS
SELECT
  orgs.org_id,
  ay.academic_year_start,
  (ay.academic_year_start + interval '1 year' - interval '1 day')::date AS academic_year_end,
  COALESCE(sh.total_service_hours, 0)::numeric AS total_communal_service_hours,
  ROUND(
    100.0 * COALESCE(examen.active_examen_students, 0)
      / NULLIF(enrolled.enrolled_students, 0),
    1
  ) AS daily_examen_adoption_pct,
  COALESCE(prayer.prayer_wall_engagements, 0)::bigint AS prayer_wall_engagements,
  COALESCE(enrolled.enrolled_students, 0)::bigint AS enrolled_students,
  'aggregated_deidentified'::text AS data_classification
FROM (
  SELECT DISTINCT org_id FROM public.profiles WHERE org_id IS NOT NULL
) orgs
CROSS JOIN LATERAL (
  SELECT public.resolve_academic_year_start(CURRENT_DATE) AS academic_year_start
) ay
LEFT JOIN LATERAL (
  SELECT SUM(l.hours) AS total_service_hours
  FROM public.service_hour_logs l
  WHERE l.org_id = orgs.org_id
    AND l.status = 'approved'
    AND l.reviewed_at >= ay.academic_year_start
    AND l.reviewed_at < ay.academic_year_start + interval '1 year'
) sh ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS prayer_wall_engagements
  FROM public.prayer_intentions pi
  WHERE pi.org_id = orgs.org_id
    AND pi.feed_approved
    AND pi.visible_on_wall
    AND pi.created_at >= ay.academic_year_start
    AND pi.created_at < ay.academic_year_start + interval '1 year'
) prayer ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS enrolled_students
  FROM public.profiles st
  WHERE st.org_id = orgs.org_id
    AND st.account_type = 'student'
) enrolled ON true
LEFT JOIN LATERAL (
  SELECT COUNT(DISTINCT m.profile_id)::bigint AS active_examen_students
  FROM public.mental_session_logs m
  INNER JOIN public.profiles st ON st.id = m.profile_id
  WHERE st.org_id = orgs.org_id
    AND st.account_type = 'student'
    AND m.session_type = 'examen'
    AND m.completed_at >= ay.academic_year_start
    AND m.completed_at < ay.academic_year_start + interval '1 year'
) examen ON true;

COMMENT ON MATERIALIZED VIEW public.jsn_accreditation_metrics IS
  'JSN accreditation aggregates per org and academic year. No student_id or profile_id.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_jsn_accreditation_org_year
  ON public.jsn_accreditation_metrics (org_id, academic_year_start);

-- ============================================================================
-- 3) Refresh RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_jsn_accreditation_cache()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'counselor')
      AND org_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.jsn_accreditation_metrics;

  RETURN jsonb_build_object(
    'ok', true,
    'refreshed_at', clock_timestamp(),
    'duration_ms', EXTRACT(milliseconds FROM clock_timestamp() - v_started_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_jsn_accreditation_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_jsn_accreditation_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_jsn_accreditation_cache() TO service_role;

-- ============================================================================
-- 4) Staff read RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_jsn_accreditation_metrics(
  p_org_id text,
  p_academic_year_start date DEFAULT NULL
)
RETURNS TABLE (
  org_id text,
  academic_year_start date,
  academic_year_end date,
  total_communal_service_hours numeric,
  daily_examen_adoption_pct numeric,
  prayer_wall_engagements bigint,
  enrolled_students bigint,
  data_classification text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_start date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'counselor')
      AND profiles.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized for this org' USING ERRCODE = '42501';
  END IF;

  v_year_start := COALESCE(p_academic_year_start, public.resolve_academic_year_start(CURRENT_DATE));

  RETURN QUERY
  SELECT
    m.org_id,
    m.academic_year_start,
    m.academic_year_end,
    m.total_communal_service_hours,
    m.daily_examen_adoption_pct,
    m.prayer_wall_engagements,
    m.enrolled_students,
    m.data_classification
  FROM jsn_accreditation_metrics m
  WHERE m.org_id = p_org_id
    AND m.academic_year_start = v_year_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_jsn_accreditation_metrics(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_jsn_accreditation_metrics(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_jsn_accreditation_metrics(text, date) TO service_role;

-- ============================================================================
-- 5) Lock down direct SELECT on materialized view
-- ============================================================================
REVOKE ALL ON public.jsn_accreditation_metrics FROM PUBLIC;
REVOKE ALL ON public.jsn_accreditation_metrics FROM authenticated;
GRANT SELECT ON public.jsn_accreditation_metrics TO service_role;

-- Initial populate
REFRESH MATERIALIZED VIEW public.jsn_accreditation_metrics;
