-- BetterU: School wellness B2B2C schema (Supabase / Postgres)
-- CRITICAL: Existing users get account_type 'public' and org_id NULL via backfill + defaults.

-- ---------------------------------------------------------------------------
-- organizations: document id = slug (e.g. jesuit-houston)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain_lock text NOT NULL,
  emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_domain_lower CHECK (domain_lock = lower(trim(domain_lock)))
);

COMMENT ON TABLE public.organizations IS 'Institutional tenants; id is stable slug for orgId references.';

-- ---------------------------------------------------------------------------
-- profiles: institutional fields (maps to users / Firestore users doc)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'public';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id text REFERENCES public.organizations (id) ON DELETE SET NULL;

-- Backfill migration safety: any null/unknown becomes public
UPDATE public.profiles
SET account_type = 'public'
WHERE account_type IS NULL OR trim(account_type) = '';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (
    account_type IN ('public', 'student', 'counselor', 'admin')
  );

-- -----------------------------------------------------------------------------
-- daily_pulse_logs: "daily pulse history" as rows (subcollection parity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_pulse_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text REFERENCES public.organizations (id) ON DELETE SET NULL,
  logged_date date NOT NULL,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  stress_level smallint NOT NULL CHECK (stress_level BETWEEN 1 AND 5),
  sleep_quality smallint NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  anonymize_aggregate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, logged_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_pulse_org_date ON public.daily_pulse_logs (org_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_pulse_profile ON public.daily_pulse_logs (profile_id);

-- -----------------------------------------------------------------------------
-- counselor_alerts: identity exposed only when student requests support (FERPA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counselor_alerts_org ON public.counselor_alerts (org_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Notifications: urgent in-app ping for counselors
-- -----------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'comment',
    'like',
    'mention',
    'group_invitation',
    'group_join_request',
    'group_activity',
    'goal_completion',
    'streak_milestone',
    'achievement',
    'personal_record',
    'workout_reminder',
    'mental_reminder',
    'hydration_reminder',
    'weekly_progress',
    'monthly_stats',
    'ai_recommendation',
    'motivational_quote',
    'community_highlight',
    'challenge_invitation',
    'leaderboard_update',
    'points_earned',
    'level_up',
    'reward_unlocked',
    'sync_status',
    'app_update',
    'premium_feature',
    'local_event',
    'virtual_meetup',
    'community_challenge',
    'workout_share',
    'mental_session_share',
    'nudge_workout',
    'nudge_run',
    'nudge_mental',
    'daily_reminder',
    'app_message',
    'accountability_partner_request',
    'accountability_check_in_reminder',
    'accountability_check_in_received',
    'counselor_support_alert'
));

-- -----------------------------------------------------------------------------
-- Sign-up domain routing (SECURITY DEFINER — does not expose org listing to anon)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_school_domain_on_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_org text;
  local_part text;
BEGIN
  IF p_email IS NULL OR position('@' IN p_email) < 2 THEN
    RETURN;
  END IF;

  SELECT o.id INTO matched_org
  FROM organizations o
  WHERE lower(split_part(trim(p_email), '@', 2)) = lower(trim(o.domain_lock))
  LIMIT 1;

  local_part := split_part(trim(p_email), '@', 1);

  INSERT INTO profiles (id, full_name, email, account_type, org_id)
  VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(local_part), ''), 'User'),
    trim(p_email),
    CASE WHEN matched_org IS NOT NULL THEN 'student' ELSE 'public' END,
    matched_org
  )
  ON CONFLICT (id) DO UPDATE SET
    account_type = CASE
      WHEN profiles.account_type IN ('admin', 'counselor') THEN profiles.account_type
      WHEN matched_org IS NOT NULL THEN 'student'
      ELSE 'public'
    END,
    org_id = CASE
      WHEN profiles.account_type IN ('admin', 'counselor') THEN profiles.org_id
      ELSE matched_org
    END,
    email = COALESCE(profiles.email, EXCLUDED.email),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.apply_school_domain_on_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_school_domain_on_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_school_domain_on_profile(uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Sentinel aggregates (no per-student identity) — staff same org only
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_pulse_sentinel(p_org_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  mood_7 double precision;
  stress_7 double precision;
  sleep_7 double precision;
  n_7 bigint;
  stress_48_recent double precision;
  stress_48_prior double precision;
  spike boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = p_org_id
      AND p.account_type IN ('admin', 'counselor')
  )
  INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Only rows that opted into aggregate pooling (clinical-lite FERPA posture)
  SELECT
    avg(mood::float),
    avg(stress_level::float),
    avg(sleep_quality::float),
    count(*)
  INTO mood_7, stress_7, sleep_7, n_7
  FROM daily_pulse_logs
  WHERE org_id = p_org_id
    AND anonymize_aggregate = true
    AND logged_date > (CURRENT_DATE - 7);

  SELECT avg(stress_level::float) INTO stress_48_recent
  FROM daily_pulse_logs
  WHERE org_id = p_org_id
    AND anonymize_aggregate = true
    AND logged_date >= (CURRENT_DATE - 2);

  SELECT avg(stress_level::float) INTO stress_48_prior
  FROM daily_pulse_logs
  WHERE org_id = p_org_id
    AND anonymize_aggregate = true
    AND logged_date >= (CURRENT_DATE - 4)
    AND logged_date < (CURRENT_DATE - 2);

  spike := stress_48_recent IS NOT NULL
    AND stress_48_prior IS NOT NULL
    AND stress_48_prior > 0
    AND stress_48_recent > stress_48_prior * 1.25;

  RETURN jsonb_build_object(
    'mood_avg_7d', mood_7,
    'stress_avg_7d', stress_7,
    'sleep_avg_7d', sleep_7,
    'sample_size_7d', n_7,
    'stress_avg_last_48h', stress_48_recent,
    'stress_avg_prev_48h_block', stress_48_prior,
    'stress_spike_warning', spike
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_pulse_sentinel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_pulse_sentinel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_pulse_sentinel(text) TO service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_members ON public.organizations;
CREATE POLICY organizations_select_members ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.org_id = organizations.id
    )
  );

ALTER TABLE public.daily_pulse_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_pulse_select_own ON public.daily_pulse_logs;
CREATE POLICY daily_pulse_select_own ON public.daily_pulse_logs
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS daily_pulse_insert_own ON public.daily_pulse_logs;
CREATE POLICY daily_pulse_insert_own ON public.daily_pulse_logs
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS daily_pulse_update_own ON public.daily_pulse_logs;
CREATE POLICY daily_pulse_update_own ON public.daily_pulse_logs
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE public.counselor_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counselor_alerts_insert_student ON public.counselor_alerts;
CREATE POLICY counselor_alerts_insert_student ON public.counselor_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.org_id IS NOT NULL
        AND p.account_type = 'student'
        AND p.org_id = counselor_alerts.org_id
    )
  );

DROP POLICY IF EXISTS counselor_alerts_select_staff ON public.counselor_alerts;
CREATE POLICY counselor_alerts_select_staff ON public.counselor_alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.org_id = counselor_alerts.org_id
        AND p.account_type IN ('admin', 'counselor')
    )
  );

DROP POLICY IF EXISTS counselor_alerts_select_self ON public.counselor_alerts;
CREATE POLICY counselor_alerts_select_self ON public.counselor_alerts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());
