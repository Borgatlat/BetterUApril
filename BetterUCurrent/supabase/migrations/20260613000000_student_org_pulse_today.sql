-- Anonymized today-only org pulse for students (k-anonymity: min 5 opt-in logs).

CREATE OR REPLACE FUNCTION public.get_org_pulse_today_for_students(p_org_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  mood_avg double precision;
  stress_avg double precision;
  sleep_avg double precision;
  n bigint;
  min_sample constant int := 5;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = p_org_id
      AND p.account_type = 'student'
  )
  INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT
    avg(mood::float),
    avg(stress_level::float),
    avg(sleep_quality::float),
    count(*)
  INTO mood_avg, stress_avg, sleep_avg, n
  FROM daily_pulse_logs
  WHERE org_id = p_org_id
    AND logged_date = CURRENT_DATE
    AND anonymize_aggregate = true;

  IF n IS NULL OR n < min_sample THEN
    RETURN jsonb_build_object(
      'ok', false,
      'sample_size', coalesce(n, 0),
      'min_sample', min_sample,
      'logged_date', CURRENT_DATE
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mood_avg', round(mood_avg::numeric, 1),
    'stress_avg', round(stress_avg::numeric, 1),
    'sleep_avg', round(sleep_avg::numeric, 1),
    'sample_size', n,
    'logged_date', CURRENT_DATE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_pulse_today_for_students(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_pulse_today_for_students(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_pulse_today_for_students(text) TO service_role;
