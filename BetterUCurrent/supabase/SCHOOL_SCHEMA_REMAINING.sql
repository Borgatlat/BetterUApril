-- =============================================================================
-- BetterU School / B2B Schema — EVERYTHING EXCEPT organizations bootstrap
-- =============================================================================
--
-- PREREQUISITES (you already ran these):
--   • public.organizations table + seed rows
--   • profiles.account_type, profiles.org_id
--   • public.apply_school_domain_on_profile()
--   • organizations RLS policy
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this entire file → Run
--
-- Safe to re-run: uses IF NOT EXISTS, DROP IF EXISTS, CREATE OR REPLACE.
-- If a section fails, note the error line — earlier sections may have applied.
--
-- ORDER MATTERS. Do not reorder sections.
--
-- WHAT THIS CREATES (high level):
--   • daily_pulse_logs, counselor_alerts
--   • Spiritual: spiritual_pulses, prayer_intentions, service_hour_logs,
--     live_the_fourth_prompts, retreat_tracks, spiritual_calendar_events, etc.
--   • profiles: grade_level, focus_points, total_approved_service_hours, is_peer_mentor
--   • counselor_triage_queue, focus_sessions, grad_at_grad_logs
--   • Board report materialized views + JSN accreditation metrics
--   • administrative_assignments, Emmaus companion_requests/messages
--   • Many SECURITY DEFINER RPCs + RLS policies + Realtime publications
--
-- NOTE: Part "jsn_accreditation_metrics" references public.mental_session_logs
--       (session_type = 'examen'). That table must already exist from your main app schema.
-- =============================================================================


-- =============================================================================
-- PART 1: School wellness core (daily pulse, counselor alerts, sentinel)
-- Source: 20260515000000_school_wellness_b2b2c.sql (partial)
-- =============================================================================

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
-- Notifications: extend allowed types (includes league, referral, accountability, school)
-- If this fails, run: SELECT DISTINCT type FROM notifications ORDER BY 1;
-- and add any missing values to the list below.
-- -----------------------------------------------------------------------------
UPDATE public.notifications
SET type = 'referral_code_used'
WHERE type = 'referral';

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
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
    'app_message',
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
    'team_join_request',
    'team_join_request_accepted',
    'team_invitation',
    'team_invitation_accepted',
    'team_trophy_awarded',
    'team_challenge_started',
    'team_rank_changed',
    'team_member_joined',
    'team_member_left',
    'referral_code_used',
    'referral',
    'accountability_partner_request',
    'accountability_check_in_reminder',
    'accountability_check_in_received',
    'counselor_support_alert'
));
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

-- =============================================================================
-- PART: 20260515120000_school_spiritual_pastoral.sql
-- =============================================================================

-- BetterU: School spiritual / pastoral ministry (Supabase parity with Firestore-style doc model)

-- -----------------------------------------------------------------------------
-- profiles: approved service hour aggregate (mirrors Cloud doc field parity)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_approved_service_hours numeric NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- spiritual_pulses — user subcollection parity: consolation | desolation + intensity 1–5
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spiritual_pulses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('consolation', 'desolation')),
  intensity smallint NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spiritual_pulses_org_created ON public.spiritual_pulses (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spiritual_pulses_profile ON public.spiritual_pulses (profile_id);

-- -----------------------------------------------------------------------------
-- prayer_intentions — private + optional moderated community share
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prayer_intentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  body text NOT NULL,
  share_anonymous boolean NOT NULL DEFAULT false,
  feed_approved boolean NOT NULL DEFAULT false,
  visible_on_wall boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prayer_intentions_org ON public.prayer_intentions (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prayer_intentions_wall ON public.prayer_intentions (org_id)
  WHERE share_anonymous AND feed_approved AND visible_on_wall;

-- -----------------------------------------------------------------------------
-- service_hour_logs — student submits; staff approves via RPC
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_hour_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  hours numeric NOT NULL CHECK (hours > 0 AND hours <= 500),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_service_hours_org_status ON public.service_hour_logs (org_id, status, created_at DESC);

-- -----------------------------------------------------------------------------
-- live_the_fourth_prompts — global (org_id null) + org overlays
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_the_fourth_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_l4_prompts_org ON public.live_the_fourth_prompts (org_id, sort_order);

-- -----------------------------------------------------------------------------
-- retreat_tracks — org + optional seeded globals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retreat_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text REFERENCES public.organizations (id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_retreat_tracks_org ON public.retreat_tracks (org_id);

CREATE TABLE IF NOT EXISTS public.retreat_track_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.retreat_tracks (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('challenge', 'journal', 'reminder')),
  body text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_retreat_track_prompts_track ON public.retreat_track_prompts (track_id, sort_order);

-- -----------------------------------------------------------------------------
-- spiritual_calendar_events — minister-managed recurring instances (concrete timestamps v1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spiritual_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('confession', 'rosary', 'mass', 'other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spiritual_cal_org_starts ON public.spiritual_calendar_events (org_id, starts_at);

-- -----------------------------------------------------------------------------
-- spiritual_bulletin_posts — intentions requests + notices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spiritual_bulletin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('intention_request', 'event_notice')),
  body text NOT NULL,
  starts_at timestamptz,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spiritual_bulletin_org ON public.spiritual_bulletin_posts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spiritual_bulletin_mod ON public.spiritual_bulletin_posts (org_id, moderation_status);

-- -----------------------------------------------------------------------------
-- RPC: approve / reject service hours (idemponent approve)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_service_hour_log(
  p_log_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_org text;
  v_student uuid;
  v_hours numeric;
  v_status text;
BEGIN
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('admin', 'counselor')
      AND p.org_id IS NOT NULL
  )
  INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT l.org_id, l.student_id, l.hours, l.status
  INTO v_org, v_student, v_hours, v_status
  FROM service_hour_logs l
  WHERE l.id = p_log_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'log not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'wrong org';
  END IF;

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'status', v_status);
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE service_hour_logs
    SET status = 'rejected',
      reviewer_id = auth.uid(),
      reviewed_at = now()
    WHERE id = p_log_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  UPDATE service_hour_logs
  SET status = 'approved',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  WHERE id = p_log_id;

  UPDATE profiles
  SET total_approved_service_hours = COALESCE(total_approved_service_hours, 0) + v_hours
  WHERE id = v_student;

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION public.review_service_hour_log(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_service_hour_log(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_service_hour_log(uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- Seed: Live the Fourth defaults (global rows)
-- -----------------------------------------------------------------------------
INSERT INTO public.live_the_fourth_prompts (org_id, title, body, sort_order)
VALUES
  (NULL, 'One concrete act',
   'Pick one loving action you committed to on retreat—and do it again today.', 10),
  (NULL, 'Gratitude trio',
   'Write three gratitude bullets from this week before bed.', 20),
  (NULL, 'Check-in buddy',
   'Text your accountability partner a one-line faith check.', 30),
  (NULL, 'Silence starter',
   'Five minutes phone-off: sit with God''s gaze on you.', 40);

-- -----------------------------------------------------------------------------
-- Seed: default retreat tracks (global org_id NULL) + prompts — schools see via RLS SELECT
-- -----------------------------------------------------------------------------
INSERT INTO public.retreat_tracks (org_id, slug, display_name)
VALUES
  (NULL, 'generic', 'Post-retreat journey'),
  (NULL, 'kairos', 'Kairos'),
  (NULL, 'confirmation', 'Confirmation retreat');

-- Attach prompts via subselect (Portable: use INSERT ... SELECT FROM retreat_tracks)
INSERT INTO public.retreat_track_prompts (track_id, kind, body, sort_order)
SELECT t.id, v.kind, v.body, v.sort_order FROM public.retreat_tracks t,
  (VALUES
    ('challenge', 'Reconnect with silence for 10 minutes today.', 1),
    ('journal', 'Where did you notice God closing a door—or opening one?', 2),
    ('reminder', 'You are beloved first; deeds follow from that.', 3),
    ('challenge', 'Write a letter you do not send: thank someone who carried you.', 4)
  ) AS v(kind, body, sort_order)
WHERE t.slug = 'generic';

INSERT INTO public.retreat_track_prompts (track_id, kind, body, sort_order)
SELECT t.id, v.kind, v.body, v.sort_order FROM public.retreat_tracks t,
  (VALUES
    ('journal', 'What moment felt most like home on retreat?', 1),
    ('challenge', 'Reach out—bridge, don''t boast—tell one peer you''re rooting for them.', 2),
    ('reminder', 'Live the Fourth: courage is showing up faithfully in small acts.', 3)
  ) AS v(kind, body, sort_order)
WHERE t.slug = 'kairos';

INSERT INTO public.retreat_track_prompts (track_id, kind, body, sort_order)
SELECT t.id, v.kind, v.body, v.sort_order FROM public.retreat_tracks t,
  (VALUES
    ('reminder', 'The Spirit confirms in peace; fear shrinks honesty.', 1),
    ('journal', 'What gift from the sacrament still echoes for you?', 2)
  ) AS v(kind, body, sort_order)
WHERE t.slug = 'confirmation';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.spiritual_pulses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spiritual_pulses_insert_student ON public.spiritual_pulses;
CREATE POLICY spiritual_pulses_insert_student ON public.spiritual_pulses
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = spiritual_pulses.org_id
    )
  );

DROP POLICY IF EXISTS spiritual_pulses_select_own ON public.spiritual_pulses;
CREATE POLICY spiritual_pulses_select_own ON public.spiritual_pulses
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

ALTER TABLE public.prayer_intentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prayer_intentions_insert_student ON public.prayer_intentions;
CREATE POLICY prayer_intentions_insert_student ON public.prayer_intentions
  FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = prayer_intentions.org_id
    )
  );

DROP POLICY IF EXISTS prayer_intentions_select_own ON public.prayer_intentions;
CREATE POLICY prayer_intentions_select_own ON public.prayer_intentions
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

DROP POLICY IF EXISTS prayer_intentions_select_staff ON public.prayer_intentions;
CREATE POLICY prayer_intentions_select_staff ON public.prayer_intentions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = prayer_intentions.org_id
    )
  );

DROP POLICY IF EXISTS prayer_intentions_update_own ON public.prayer_intentions;
CREATE POLICY prayer_intentions_update_own ON public.prayer_intentions
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS prayer_intentions_update_staff ON public.prayer_intentions;
CREATE POLICY prayer_intentions_update_staff ON public.prayer_intentions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = prayer_intentions.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = prayer_intentions.org_id
    )
  );

ALTER TABLE public.service_hour_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_hours_insert_student ON public.service_hour_logs;
CREATE POLICY service_hours_insert_student ON public.service_hour_logs
  FOR INSERT TO authenticated WITH CHECK (
    student_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = service_hour_logs.org_id
    )
  );

DROP POLICY IF EXISTS service_hours_select_student ON public.service_hour_logs;
CREATE POLICY service_hours_select_student ON public.service_hour_logs
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS service_hours_select_staff ON public.service_hour_logs;
CREATE POLICY service_hours_select_staff ON public.service_hour_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = service_hour_logs.org_id
    )
  );

ALTER TABLE public.live_the_fourth_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l4_select_student ON public.live_the_fourth_prompts;
CREATE POLICY l4_select_student ON public.live_the_fourth_prompts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type = 'student'
        AND p.org_id IS NOT NULL
        AND (live_the_fourth_prompts.org_id IS NULL OR p.org_id = live_the_fourth_prompts.org_id)
    )
  );

DROP POLICY IF EXISTS l4_select_staff ON public.live_the_fourth_prompts;
CREATE POLICY l4_select_staff ON public.live_the_fourth_prompts
  FOR SELECT TO authenticated USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = live_the_fourth_prompts.org_id
    )
  );

DROP POLICY IF EXISTS l4_manage_staff_own_org ON public.live_the_fourth_prompts;
CREATE POLICY l4_manage_staff_own_org ON public.live_the_fourth_prompts
  FOR ALL TO authenticated
  USING (
    org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = live_the_fourth_prompts.org_id
    )
  )
  WITH CHECK (
    org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = live_the_fourth_prompts.org_id
    )
  );

ALTER TABLE public.retreat_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retreat_tracks_select_members ON public.retreat_tracks;
CREATE POLICY retreat_tracks_select_members ON public.retreat_tracks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('student', 'counselor', 'admin')
        AND (
          (retreat_tracks.org_id IS NULL AND p.org_id IS NOT NULL)
          OR p.org_id = retreat_tracks.org_id
        )
    )
  );

DROP POLICY IF EXISTS retreat_tracks_staff_mutate_own ON public.retreat_tracks;
CREATE POLICY retreat_tracks_staff_mutate_own ON public.retreat_tracks
  FOR ALL TO authenticated
  USING (
    org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = retreat_tracks.org_id
    )
  )
  WITH CHECK (
    org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = retreat_tracks.org_id
    )
  );

ALTER TABLE public.retreat_track_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retreat_track_prompts_select ON public.retreat_track_prompts;
CREATE POLICY retreat_track_prompts_select ON public.retreat_track_prompts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM retreat_tracks t
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = retreat_track_prompts.track_id
        AND p.account_type IN ('student', 'counselor', 'admin')
        AND p.org_id IS NOT NULL
        AND (t.org_id IS NULL OR p.org_id = t.org_id)
    )
  );

DROP POLICY IF EXISTS retreat_track_prompts_staff_mutate ON public.retreat_track_prompts;
CREATE POLICY retreat_track_prompts_staff_mutate ON public.retreat_track_prompts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM retreat_tracks t
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = retreat_track_prompts.track_id
        AND t.org_id IS NOT NULL
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = t.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM retreat_tracks t
      INNER JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = retreat_track_prompts.track_id
        AND t.org_id IS NOT NULL
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = t.org_id
    )
  );

ALTER TABLE public.spiritual_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spiritual_cal_select ON public.spiritual_calendar_events;
CREATE POLICY spiritual_cal_select ON public.spiritual_calendar_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = spiritual_calendar_events.org_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_calendar_events.org_id
    )
  );

DROP POLICY IF EXISTS spiritual_cal_staff_write ON public.spiritual_calendar_events;
CREATE POLICY spiritual_cal_staff_write ON public.spiritual_calendar_events
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_calendar_events.org_id
    )
  );

DROP POLICY IF EXISTS spiritual_cal_staff_update ON public.spiritual_calendar_events;
CREATE POLICY spiritual_cal_staff_update ON public.spiritual_calendar_events
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_calendar_events.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_calendar_events.org_id
    )
  );

DROP POLICY IF EXISTS spiritual_cal_staff_delete ON public.spiritual_calendar_events;
CREATE POLICY spiritual_cal_staff_delete ON public.spiritual_calendar_events
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_calendar_events.org_id
    )
  );

ALTER TABLE public.spiritual_bulletin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spiritual_bulletin_insert_student ON public.spiritual_bulletin_posts;
CREATE POLICY spiritual_bulletin_insert_student ON public.spiritual_bulletin_posts
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND moderation_status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = spiritual_bulletin_posts.org_id
    )
  );

DROP POLICY IF EXISTS spiritual_bulletin_select ON public.spiritual_bulletin_posts;
CREATE POLICY spiritual_bulletin_select ON public.spiritual_bulletin_posts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_bulletin_posts.org_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'student' AND p.org_id = spiritual_bulletin_posts.org_id
      AND (
        spiritual_bulletin_posts.moderation_status = 'approved'
        OR spiritual_bulletin_posts.author_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS spiritual_bulletin_staff_update ON public.spiritual_bulletin_posts;
CREATE POLICY spiritual_bulletin_staff_update ON public.spiritual_bulletin_posts
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_bulletin_posts.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = spiritual_bulletin_posts.org_id
    )
  );

-- Allow students to delete only own pending (optional safety valve)
DROP POLICY IF EXISTS spiritual_bulletin_author_delete ON public.spiritual_bulletin_posts;
CREATE POLICY spiritual_bulletin_author_delete ON public.spiritual_bulletin_posts
  FOR DELETE TO authenticated USING (
    author_id = auth.uid() AND moderation_status = 'pending'
  );

-- -----------------------------------------------------------------------------
-- Staff-only: resolved names for pending logs (profiles RLS otherwise blocks joins)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_list_pending_service_hour_logs(p_org_id text)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  student_full_name text,
  student_email text,
  hours numeric,
  description text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('admin', 'counselor')
      AND p.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.student_id,
    COALESCE(pr.full_name, pr.email::text, 'Student'::text)::text AS student_full_name,
    COALESCE(pr.email::text, ''::text)::text AS student_email,
    l.hours,
    l.description,
    l.status,
    l.created_at
  FROM service_hour_logs l
  INNER JOIN profiles pr ON pr.id = l.student_id
  WHERE l.org_id = p_org_id AND l.status = 'pending'
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_pending_service_hour_logs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_pending_service_hour_logs(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_pending_service_hour_logs(text) TO service_role;

-- =============================================================================
-- PART: 20260601000000_grade_level_and_focus_points.sql
-- =============================================================================

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

-- =============================================================================
-- PART: 20260601000100_anonymized_weekly_trends.sql
-- =============================================================================

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

-- =============================================================================
-- PART: 20260601000200_counselor_triage_queue.sql
-- =============================================================================

-- BetterU Feature 3: Counselor Triage Queue (MTSS dispatch).
--
-- Coexists with the existing public.counselor_alerts table. The legacy alerts
-- table stays untouched so SentinelStaffDashboard keeps working; the new triage
-- queue powers the tier-aware grid built in CounselorTriageGrid.js.
--
-- Three enums power the triage grid:
--   risk_tier_enum    — MTSS tiers (Multi-Tier System of Support):
--                       tier_1 = universal everyday stressor / venting
--                       tier_2 = elevated, repeated, or specific need
--                       tier_3 = crisis / safety / immediate help requested
--   triage_status_enum — pending → assigned → resolved (no skipping back)
--
-- CREATE TYPE ... IF NOT EXISTS does not exist in PG, so we wrap each in a
-- DO block that catches duplicate_object errors (the idiomatic idempotency pattern).

-- ============================================================================
-- 1) Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.risk_tier_enum AS ENUM ('tier_1', 'tier_2', 'tier_3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.triage_status_enum AS ENUM ('pending', 'assigned', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.counselor_triage_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- text FK because organizations.id is a slug. Matches existing schema convention.
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  risk_tier public.risk_tier_enum NOT NULL DEFAULT 'tier_1',
  status public.triage_status_enum NOT NULL DEFAULT 'pending',
  assigned_counselor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  trigger_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- A counselor cannot resolve a ticket that nobody owns. Database-level guard
  -- complements the client-side button flow.
  CONSTRAINT triage_resolved_has_assignee CHECK (
    status <> 'resolved' OR assigned_counselor_id IS NOT NULL
  ),
  CONSTRAINT triage_trigger_reason_length CHECK (char_length(trigger_reason) <= 1000)
);

COMMENT ON TABLE public.counselor_triage_queue IS
  'Tier-aware counselor dispatch queue. tier_3 = crisis; powered by Supabase Realtime.';

-- Compound index for the canonical grid query:
--   WHERE org_id = $1 AND status <> 'resolved'
--   ORDER BY risk_tier DESC, created_at DESC
-- DESC on risk_tier sorts tier_3 first because of enum ordinal order.
CREATE INDEX IF NOT EXISTS idx_triage_org_active
  ON public.counselor_triage_queue (org_id, risk_tier DESC, created_at DESC)
  WHERE status <> 'resolved';

CREATE INDEX IF NOT EXISTS idx_triage_assignee
  ON public.counselor_triage_queue (assigned_counselor_id)
  WHERE assigned_counselor_id IS NOT NULL;

-- ============================================================================
-- 3) updated_at + auto-assignment trigger
-- ============================================================================
-- Single trigger handles two concerns:
--   (a) bump updated_at on every change
--   (b) when status flips to 'assigned' and assigned_counselor_id is NULL,
--       record the acting counselor (auth.uid()) automatically. This guarantees
--       audit trail even if the client forgets to pass the id.
CREATE OR REPLACE FUNCTION public.touch_counselor_triage_queue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'assigned'
     AND (OLD.status IS DISTINCT FROM 'assigned')
     AND NEW.assigned_counselor_id IS NULL THEN
    NEW.assigned_counselor_id := auth.uid();
  END IF;

  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_counselor_triage_queue ON public.counselor_triage_queue;
CREATE TRIGGER trg_touch_counselor_triage_queue
  BEFORE UPDATE ON public.counselor_triage_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_counselor_triage_queue();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.counselor_triage_queue ENABLE ROW LEVEL SECURITY;

-- SELECT: own row OR (counselor/admin in same org)
DROP POLICY IF EXISTS triage_select ON public.counselor_triage_queue;
CREATE POLICY triage_select ON public.counselor_triage_queue
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- INSERT: a student can file their own ticket. Staff can file on a student's
-- behalf (e.g. teacher referral routed through counselor account).
DROP POLICY IF EXISTS triage_insert ON public.counselor_triage_queue;
CREATE POLICY triage_insert ON public.counselor_triage_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Student filing own ticket: must be 'student' in the same org as the ticket.
    (
      student_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type = 'student'
          AND p.org_id = counselor_triage_queue.org_id
      )
    )
    OR
    -- Staff filing on behalf: counselor/admin in the same org.
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- UPDATE: counselors/admins in same org can change status/tier/assignment.
-- Students CANNOT update their own ticket (prevents tier inflation/deflation).
DROP POLICY IF EXISTS triage_update_staff ON public.counselor_triage_queue;
CREATE POLICY triage_update_staff ON public.counselor_triage_queue
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = counselor_triage_queue.org_id
    )
  );

-- No DELETE policy = nobody can delete tickets. Audit trail preserved.

-- ============================================================================
-- 5) Realtime publication
-- ============================================================================
-- Supabase Realtime listens to logical replication. Adding the table to the
-- supabase_realtime publication is what makes INSERT/UPDATE/DELETE events
-- stream to subscribed clients. Wrapped in DO block because adding a table
-- that's already in the publication raises an error.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.counselor_triage_queue;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication does not exist; skipping (likely local-only env).';
END $$;

-- For UPDATE payloads to include the OLD row (needed so the client knows the
-- previous status), set REPLICA IDENTITY FULL. Default is DEFAULT (primary key
-- only) which would leave the `old_record` field empty.
ALTER TABLE public.counselor_triage_queue REPLICA IDENTITY FULL;

-- ============================================================================
-- 6) Staff helper: enriched view with student name + email for the grid
-- ============================================================================
-- The triage grid wants student name + email for context. profiles RLS would
-- normally block a counselor from SELECTing other users' rows, so wrap the JOIN
-- in a SECURITY DEFINER function that double-checks the caller is staff in org.
CREATE OR REPLACE FUNCTION public.staff_list_triage_queue(p_org_id text)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  student_grade_level text,
  risk_tier public.risk_tier_enum,
  status public.triage_status_enum,
  assigned_counselor_id uuid,
  assigned_counselor_name text,
  trigger_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('counselor', 'admin')
      AND p.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.org_id,
    q.student_id,
    COALESCE(sp.full_name, sp.email, 'Student'::text)::text AS student_full_name,
    COALESCE(sp.email, '')::text AS student_email,
    sp.grade_level,
    q.risk_tier,
    q.status,
    q.assigned_counselor_id,
    cp.full_name AS assigned_counselor_name,
    q.trigger_reason,
    q.created_at,
    q.updated_at,
    q.resolved_at
  FROM counselor_triage_queue q
  LEFT JOIN profiles sp ON sp.id = q.student_id
  LEFT JOIN profiles cp ON cp.id = q.assigned_counselor_id
  WHERE q.org_id = p_org_id
    AND q.status <> 'resolved'
  -- Two-key ORDER BY: tier_3 first (DESC on enum), then oldest unresolved first
  -- within the same tier so the queue feels FIFO inside each priority band.
  ORDER BY q.risk_tier DESC, q.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_triage_queue(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_triage_queue(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_triage_queue(text) TO service_role;

-- =============================================================================
-- PART: 20260601000300_focus_sessions.sql
-- =============================================================================

-- BetterU Feature 4: Phone-Free Focus Mode integrity tracker.
--
-- The student starts a session, the timer counts down inside FocusLockScreen.js,
-- and ONLY if the app stays in the foreground for the entire duration do points
-- get awarded. Server-side gating prevents tampering — the client can flip
-- completed_successfully directly via PATCH, but the RPC re-validates before
-- crediting the wallet.

-- ============================================================================
-- 1) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- org_id nullable: non-school users can still use Focus Mode personally.
  org_id text REFERENCES public.organizations (id) ON DELETE SET NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 240),
  points_earned integer NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  completed_successfully boolean NOT NULL DEFAULT false,
  forfeit_reason text,  -- e.g. 'app_backgrounded', 'user_ended_early'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT focus_forfeit_reason_check CHECK (
    forfeit_reason IS NULL OR forfeit_reason IN (
      'app_backgrounded', 'app_inactive', 'user_ended_early', 'system_crash'
    )
  ),
  -- A session cannot be both successful AND have a forfeit reason.
  CONSTRAINT focus_consistency CHECK (
    NOT (completed_successfully = true AND forfeit_reason IS NOT NULL)
  )
);

COMMENT ON TABLE public.focus_sessions IS
  'Phone-free focus session log. Points awarded server-side via increment_student_rewards_points only.';

CREATE INDEX IF NOT EXISTS idx_focus_student_recent
  ON public.focus_sessions (student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_org_completed
  ON public.focus_sessions (org_id, completed_successfully, started_at DESC)
  WHERE org_id IS NOT NULL;

-- ============================================================================
-- 2) Row-Level Security
-- ============================================================================
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Students see their own focus sessions only.
DROP POLICY IF EXISTS focus_select_own ON public.focus_sessions;
CREATE POLICY focus_select_own ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS focus_insert_own ON public.focus_sessions;
CREATE POLICY focus_insert_own ON public.focus_sessions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- UPDATE allowed but the WITH CHECK keeps points_earned at 0 during client
-- writes. Only the SECURITY DEFINER RPC may bump points_earned > 0.
DROP POLICY IF EXISTS focus_update_own ON public.focus_sessions;
CREATE POLICY focus_update_own ON public.focus_sessions
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND points_earned = 0
  );

-- Counselors/admins in the same org can SELECT (aggregate engagement reports).
-- They CANNOT edit a student's session record.
DROP POLICY IF EXISTS focus_select_staff ON public.focus_sessions;
CREATE POLICY focus_select_staff ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = focus_sessions.org_id
    )
  );

-- ============================================================================
-- 3) increment_student_rewards_points RPC
-- ============================================================================
-- The whole integrity story rests on this function. Called only after the
-- client confirms a clean countdown finish. Steps:
--   1. SELECT ... FOR UPDATE locks the row so concurrent calls cannot double-award.
--   2. Verifies the session belongs to the caller.
--   3. Verifies completed_successfully = true (set by a separate PATCH before
--      this RPC fires; that PATCH is RLS-gated to the student).
--   4. Idempotency: if points_earned > 0 already, return ok+already_awarded.
--   5. Cap minutes to 120 to prevent a single absurd 240-min session inflating
--      the leaderboard.
--   6. Atomic UPDATE of both focus_sessions.points_earned and profiles.focus_points.
CREATE OR REPLACE FUNCTION public.increment_student_rewards_points(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session focus_sessions%ROWTYPE;
  v_points integer;
BEGIN
  -- FOR UPDATE acquires a row-level lock until the transaction commits/rolls
  -- back. Prevents a race where two parallel RPC calls both see points_earned=0
  -- and both award points.
  SELECT * INTO v_session
  FROM focus_sessions
  WHERE id = p_session_id
    AND student_id = auth.uid()
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'focus session not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  IF v_session.completed_successfully = false THEN
    RAISE EXCEPTION 'session was not completed successfully — points denied'
      USING ERRCODE = '22023';
  END IF;

  -- Idempotency guard. Double-tap on the "claim points" button must not
  -- credit the wallet twice.
  IF v_session.points_earned > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_awarded', true,
      'points', v_session.points_earned
    );
  END IF;

  -- Reward formula: 1 point per minute, capped at 120 so a single 4-hour
  -- session does not blow out the leaderboard.
  v_points := LEAST(v_session.duration_minutes, 120);

  UPDATE focus_sessions
  SET points_earned = v_points,
      ended_at = COALESCE(ended_at, now())
  WHERE id = p_session_id;

  UPDATE profiles
  SET focus_points = COALESCE(focus_points, 0) + v_points,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'ok', true,
    'already_awarded', false,
    'points', v_points,
    'total_focus_points', (SELECT focus_points FROM profiles WHERE id = auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_student_rewards_points(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_student_rewards_points(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_student_rewards_points(uuid) TO service_role;

-- ============================================================================
-- 4) Optional aggregate helper for staff dashboards
-- ============================================================================
-- Returns weekly focus engagement for an org. Used later by the BoardReport
-- export. Not strictly required for Feature 4 but nice to ship alongside.
CREATE OR REPLACE FUNCTION public.get_org_focus_engagement(
  p_org_id text,
  p_weeks_back integer DEFAULT 4
)
RETURNS TABLE (
  week_start date,
  total_sessions bigint,
  successful_sessions bigint,
  total_minutes_focused bigint,
  unique_students bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_type IN ('counselor', 'admin')
      AND profiles.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('week', f.started_at)::date AS week_start,
    COUNT(*)::bigint AS total_sessions,
    COUNT(*) FILTER (WHERE f.completed_successfully = true)::bigint AS successful_sessions,
    COALESCE(SUM(f.duration_minutes) FILTER (WHERE f.completed_successfully = true), 0)::bigint
      AS total_minutes_focused,
    COUNT(DISTINCT f.student_id)::bigint AS unique_students
  FROM focus_sessions f
  WHERE f.org_id = p_org_id
    AND f.started_at >= (CURRENT_DATE - (GREATEST(LEAST(p_weeks_back, 26), 1) * 7))
  GROUP BY date_trunc('week', f.started_at)
  ORDER BY week_start DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_focus_engagement(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_focus_engagement(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_focus_engagement(text, integer) TO service_role;

-- =============================================================================
-- PART: 20260604000000_grad_at_grad_logs.sql
-- =============================================================================

-- Grad at Grad pillar metrics: auto-logged from approved service hours and spiritual pulses.
-- Profile of the Graduate at Graduation (JSN) — five Ignatian pillars tracked per student.

-- ============================================================================
-- 1) Enum
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.grad_at_grad_pillar AS ENUM (
    'open_to_growth',
    'intellectually_competent',
    'religious',
    'loving',
    'committed_to_justice'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grad_at_grad_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  pillar public.grad_at_grad_pillar NOT NULL,
  source_activity text NOT NULL,
  source_record_id uuid,
  points_allocated integer NOT NULL CHECK (points_allocated > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grad_at_grad_source_unique UNIQUE (source_activity, source_record_id)
);

COMMENT ON TABLE public.grad_at_grad_logs IS
  'Grad at Grad pillar points. Rows created by triggers only (service approval, spiritual pulse).';

CREATE INDEX IF NOT EXISTS idx_grad_at_grad_student
  ON public.grad_at_grad_logs (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grad_at_grad_org_pillar
  ON public.grad_at_grad_logs (org_id, pillar, created_at DESC);

-- ============================================================================
-- 3) Auto-log trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_log_grad_at_grad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'service_hour_logs' THEN
    IF NEW.status = 'approved'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
      INSERT INTO public.grad_at_grad_logs (
        student_id, org_id, pillar, source_activity, source_record_id, points_allocated
      )
      VALUES (
        NEW.student_id,
        NEW.org_id,
        'committed_to_justice',
        'service_hours',
        NEW.id,
        GREATEST(1, CEIL(NEW.hours)::integer)
      )
      ON CONFLICT (source_activity, source_record_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'spiritual_pulses' THEN
    INSERT INTO public.grad_at_grad_logs (
      student_id, org_id, pillar, source_activity, source_record_id, points_allocated
    )
    VALUES (
      NEW.profile_id,
      NEW.org_id,
      'religious',
      'spiritual_pulse',
      NEW.id,
      5
    )
    ON CONFLICT (source_activity, source_record_id) DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grad_at_grad_service_hours ON public.service_hour_logs;
CREATE TRIGGER trg_grad_at_grad_service_hours
  AFTER INSERT OR UPDATE OF status ON public.service_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_grad_at_grad();

DROP TRIGGER IF EXISTS trg_grad_at_grad_spiritual_pulses ON public.spiritual_pulses;
CREATE TRIGGER trg_grad_at_grad_spiritual_pulses
  AFTER INSERT ON public.spiritual_pulses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_grad_at_grad();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.grad_at_grad_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grad_at_grad_select_own ON public.grad_at_grad_logs;
CREATE POLICY grad_at_grad_select_own ON public.grad_at_grad_logs
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS grad_at_grad_select_staff ON public.grad_at_grad_logs;
CREATE POLICY grad_at_grad_select_staff ON public.grad_at_grad_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = grad_at_grad_logs.org_id
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated — triggers only.

-- ============================================================================
-- 5) Student pillar summary RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_grad_at_grad_summary(
  p_student_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  pillar text,
  total_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_type text;
  v_caller_org text;
  v_target_org text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT account_type, org_id INTO v_caller_type, v_caller_org
  FROM profiles WHERE id = v_caller;

  SELECT org_id INTO v_target_org FROM profiles WHERE id = p_student_id;

  IF p_student_id = v_caller THEN
    NULL;
  ELSIF v_caller_type IN ('admin', 'counselor')
        AND v_caller_org IS NOT NULL
        AND v_caller_org = v_target_org THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT g.pillar::text, SUM(g.points_allocated)::bigint
  FROM grad_at_grad_logs g
  WHERE g.student_id = p_student_id
  GROUP BY g.pillar
  ORDER BY g.pillar;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_grad_at_grad_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_grad_at_grad_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_grad_at_grad_summary(uuid) TO service_role;

-- =============================================================================
-- PART: 20260604000001_jsn_accreditation_metrics.sql
-- =============================================================================

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

-- =============================================================================
-- PART: 20260604000002_administrative_assignments.sql
-- =============================================================================

-- Reflective disciplinary portal: restorative assignments with Supabase Realtime.

-- ============================================================================
-- 1) Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.admin_assignment_type AS ENUM ('reflective_journal', 'restorative_plan');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_assignment_status AS ENUM ('assigned', 'submitted', 'approved_by_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.administrative_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assignment_type public.admin_assignment_type NOT NULL,
  prompt_text text NOT NULL,
  student_response text,
  status public.admin_assignment_status NOT NULL DEFAULT 'assigned',
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  CONSTRAINT admin_assignment_prompt_length CHECK (char_length(prompt_text) <= 10000),
  CONSTRAINT admin_assignment_response_length CHECK (
    student_response IS NULL OR char_length(student_response) <= 20000
  )
);

COMMENT ON TABLE public.administrative_assignments IS
  'Reflective disciplinary assignments. Realtime-enabled for Dean/counselor dashboards.';

CREATE INDEX IF NOT EXISTS idx_admin_assignments_student_active
  ON public.administrative_assignments (student_id, status)
  WHERE status = 'assigned';

CREATE INDEX IF NOT EXISTS idx_admin_assignments_org_queue
  ON public.administrative_assignments (org_id, status, due_at ASC)
  WHERE status <> 'approved_by_admin';

-- ============================================================================
-- 3) Status timestamp trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_administrative_assignments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    NEW.submitted_at := now();
  END IF;

  IF NEW.status = 'approved_by_admin' AND OLD.status IS DISTINCT FROM 'approved_by_admin' THEN
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_administrative_assignments ON public.administrative_assignments;
CREATE TRIGGER trg_touch_administrative_assignments
  BEFORE UPDATE ON public.administrative_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_administrative_assignments();

-- ============================================================================
-- 4) Row-Level Security
-- ============================================================================
ALTER TABLE public.administrative_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_assignments_select_own ON public.administrative_assignments;
CREATE POLICY admin_assignments_select_own ON public.administrative_assignments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS admin_assignments_select_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_select_staff ON public.administrative_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  );

DROP POLICY IF EXISTS admin_assignments_insert_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_insert_staff ON public.administrative_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles st
      WHERE st.id = administrative_assignments.student_id
        AND st.account_type = 'student'
        AND st.org_id = administrative_assignments.org_id
    )
  );

DROP POLICY IF EXISTS admin_assignments_update_student ON public.administrative_assignments;
CREATE POLICY admin_assignments_update_student ON public.administrative_assignments
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'assigned')
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'submitted'
    AND student_response IS NOT NULL
    AND char_length(trim(student_response)) > 0
  );

DROP POLICY IF EXISTS admin_assignments_update_staff ON public.administrative_assignments;
CREATE POLICY admin_assignments_update_staff ON public.administrative_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'counselor')
        AND p.org_id = administrative_assignments.org_id
    )
  );

-- No DELETE policy — audit trail preserved.

-- ============================================================================
-- 5) Realtime publication
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.administrative_assignments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication does not exist; skipping (likely local-only env).';
END $$;

ALTER TABLE public.administrative_assignments REPLICA IDENTITY FULL;

-- ============================================================================
-- 6) Staff list RPC (enriched with student + assigner names)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.staff_list_administrative_assignments(p_org_id text)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  assigned_by uuid,
  assigned_by_name text,
  assignment_type public.admin_assignment_type,
  prompt_text text,
  student_response text,
  status public.admin_assignment_status,
  due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('counselor', 'admin')
      AND p.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.org_id,
    a.student_id,
    COALESCE(sp.full_name, sp.email, 'Student'::text)::text AS student_full_name,
    COALESCE(sp.email, '')::text AS student_email,
    a.assigned_by,
    ap.full_name AS assigned_by_name,
    a.assignment_type,
    a.prompt_text,
    a.student_response,
    a.status,
    a.due_at,
    a.created_at,
    a.updated_at,
    a.submitted_at,
    a.approved_at
  FROM administrative_assignments a
  LEFT JOIN profiles sp ON sp.id = a.student_id
  LEFT JOIN profiles ap ON ap.id = a.assigned_by
  WHERE a.org_id = p_org_id
    AND a.status <> 'approved_by_admin'
  ORDER BY
    CASE a.status WHEN 'submitted' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END,
    a.due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_administrative_assignments(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_administrative_assignments(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_administrative_assignments(text) TO service_role;

-- =============================================================================
-- PART: 20260605000000_emmaus_companion_network.sql
-- =============================================================================

-- Emmaus Companion Network: peer pastoral connection requests + in-app messages.
-- org_id is text (organization slug). student_id/mentor_id reference profiles.id.

-- ============================================================================
-- 1) Profile flag
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_peer_mentor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_peer_mentor IS
  'Student leaders who may accept Emmaus companion requests for their org.';

CREATE INDEX IF NOT EXISTS idx_profiles_peer_mentor_org
  ON public.profiles (org_id)
  WHERE is_peer_mentor = true;

-- ============================================================================
-- 2) Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.support_type_enum AS ENUM (
    'listen_only',
    'prayer_request',
    'seeking_advice',
    'silent_prayer_only',
    'casual_hangout'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.struggle_category_enum AS ENUM (
    'academic_stress',
    'social_isolation',
    'grief_loss',
    'general_wellbeing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interaction_format_enum AS ENUM (
    'text_chat',
    'in_person_casual',
    'sacramental_chapel'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.urgency_tier_enum AS ENUM (
    'routine_check_in',
    'urgent_today'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.companion_status_enum AS ENUM (
    'unassigned',
    'active_chat',
    'converted_to_in_person',
    'resolved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3) Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.companion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  support_type public.support_type_enum NOT NULL,
  category public.struggle_category_enum NOT NULL,
  format_preference public.interaction_format_enum NOT NULL DEFAULT 'text_chat',
  urgency_tier public.urgency_tier_enum NOT NULL DEFAULT 'routine_check_in',
  student_notes text,
  status public.companion_status_enum NOT NULL DEFAULT 'unassigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT companion_resolved_has_context CHECK (
    status <> 'resolved' OR resolved_at IS NOT NULL
  ),
  CONSTRAINT companion_student_notes_len CHECK (
    student_notes IS NULL OR char_length(student_notes) <= 2000
  )
);

COMMENT ON TABLE public.companion_requests IS
  'Emmaus Companion Network: student raise-hand requests for peer mentors or counselors.';

CREATE INDEX IF NOT EXISTS idx_companion_org_unassigned
  ON public.companion_requests (org_id, urgency_tier DESC, created_at DESC)
  WHERE status = 'unassigned';

CREATE INDEX IF NOT EXISTS idx_companion_mentor
  ON public.companion_requests (mentor_id)
  WHERE mentor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companion_student
  ON public.companion_requests (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.companion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.companion_requests (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companion_message_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_companion_messages_request
  ON public.companion_messages (request_id, created_at ASC);

-- ============================================================================
-- 4) Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_companion_requests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'active_chat'
     AND (OLD.status IS DISTINCT FROM 'active_chat')
     AND NEW.mentor_id IS NULL THEN
    NEW.mentor_id := auth.uid();
  END IF;

  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_companion_requests ON public.companion_requests;
CREATE TRIGGER trg_touch_companion_requests
  BEFORE UPDATE ON public.companion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_companion_requests();

-- Silent prayer: route to prayer_intentions and auto-resolve (no chat).
CREATE OR REPLACE FUNCTION public.companion_after_insert_silent_prayer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
  v_cat text;
BEGIN
  IF NEW.support_type <> 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  v_cat := replace(NEW.category::text, '_', ' ');
  v_body := coalesce(nullif(trim(NEW.student_notes), ''), '(Silent prayer — no additional notes)');
  v_body := '[Emmaus · ' || v_cat || '] ' || v_body;

  INSERT INTO public.prayer_intentions (
    profile_id,
    org_id,
    body,
    share_anonymous,
    feed_approved,
    visible_on_wall
  ) VALUES (
    NEW.student_id,
    NEW.org_id,
    v_body,
    true,
    false,
    false
  );

  UPDATE public.companion_requests
  SET
    status = 'resolved',
    resolved_at = now(),
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companion_silent_prayer ON public.companion_requests;
CREATE TRIGGER trg_companion_silent_prayer
  AFTER INSERT ON public.companion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.companion_after_insert_silent_prayer();

-- Urgent today: counselor_alerts for staff visibility.
CREATE OR REPLACE FUNCTION public.companion_after_insert_urgent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NEW.urgency_tier <> 'urgent_today' THEN
    RETURN NEW;
  END IF;
  IF NEW.support_type = 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(p.full_name, 'Student'), coalesce(p.email, '')
  INTO v_name, v_email
  FROM public.profiles p
  WHERE p.id = NEW.student_id;

  INSERT INTO public.counselor_alerts (
    org_id,
    student_id,
    student_name,
    student_email,
    status
  ) VALUES (
    NEW.org_id,
    NEW.student_id,
    v_name,
    v_email,
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companion_urgent ON public.companion_requests;
CREATE TRIGGER trg_companion_urgent
  AFTER INSERT ON public.companion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.companion_after_insert_urgent();

-- ============================================================================
-- 5) Helper: companion staff (peer mentor or counselor/admin in org)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_companion_staff(p_org_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = p_org_id
      AND (
        p.is_peer_mentor = true
        OR p.account_type IN ('counselor', 'admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_companion_staff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_companion_staff(text) TO authenticated;

-- ============================================================================
-- 6) Row-Level Security — companion_requests
-- ============================================================================
ALTER TABLE public.companion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_requests_insert_student ON public.companion_requests;
CREATE POLICY companion_requests_insert_student ON public.companion_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type = 'student'
        AND p.org_id = companion_requests.org_id
    )
  );

DROP POLICY IF EXISTS companion_requests_select_student ON public.companion_requests;
CREATE POLICY companion_requests_select_student ON public.companion_requests
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Assigned mentor or counselor/admin in org (not unassigned rows for mentors via direct SELECT)
DROP POLICY IF EXISTS companion_requests_select_staff ON public.companion_requests;
CREATE POLICY companion_requests_select_staff ON public.companion_requests
  FOR SELECT TO authenticated
  USING (
    status <> 'unassigned'
    AND (
      mentor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.org_id = companion_requests.org_id
          AND p.account_type IN ('counselor', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS companion_requests_update_staff ON public.companion_requests;
CREATE POLICY companion_requests_update_staff ON public.companion_requests
  FOR UPDATE TO authenticated
  USING (public.is_companion_staff(org_id))
  WITH CHECK (public.is_companion_staff(org_id));

-- ============================================================================
-- 7) Row-Level Security — companion_messages
-- ============================================================================
ALTER TABLE public.companion_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_messages_select ON public.companion_messages;
CREATE POLICY companion_messages_select ON public.companion_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companion_requests r
      WHERE r.id = companion_messages.request_id
        AND r.status IN ('active_chat', 'converted_to_in_person')
        AND (
          r.student_id = auth.uid()
          OR r.mentor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.org_id = r.org_id
              AND p.account_type IN ('counselor', 'admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS companion_messages_insert ON public.companion_messages;
CREATE POLICY companion_messages_insert ON public.companion_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.companion_requests r
      WHERE r.id = companion_messages.request_id
        AND r.status IN ('active_chat', 'converted_to_in_person')
        AND (
          r.student_id = auth.uid()
          OR r.mentor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.org_id = r.org_id
              AND p.account_type IN ('counselor', 'admin')
          )
        )
    )
  );

-- ============================================================================
-- 8) SECURITY DEFINER RPCs (anonymity + enriched lists)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.staff_list_companion_queue_anon(p_org_id text)
RETURNS TABLE (
  id uuid,
  category public.struggle_category_enum,
  support_type public.support_type_enum,
  format_preference public.interaction_format_enum,
  urgency_tier public.urgency_tier_enum,
  student_notes_preview text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_companion_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.category,
    r.support_type,
    r.format_preference,
    r.urgency_tier,
    CASE
      WHEN r.student_notes IS NULL THEN NULL::text
      ELSE left(r.student_notes, 120)
    END AS student_notes_preview,
    r.created_at
  FROM public.companion_requests r
  WHERE r.org_id = p_org_id
    AND r.status = 'unassigned'
  ORDER BY
    CASE WHEN r.urgency_tier = 'urgent_today' THEN 0 ELSE 1 END,
    r.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_list_companion_active(p_org_id text)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  mentor_id uuid,
  mentor_full_name text,
  support_type public.support_type_enum,
  category public.struggle_category_enum,
  format_preference public.interaction_format_enum,
  urgency_tier public.urgency_tier_enum,
  student_notes text,
  status public.companion_status_enum,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_companion_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.org_id,
    r.student_id,
    coalesce(sp.full_name, sp.email, 'Student')::text AS student_full_name,
    coalesce(sp.email, '')::text AS student_email,
    r.mentor_id,
    mp.full_name AS mentor_full_name,
    r.support_type,
    r.category,
    r.format_preference,
    r.urgency_tier,
    r.student_notes,
    r.status,
    r.created_at,
    r.updated_at
  FROM public.companion_requests r
  LEFT JOIN public.profiles sp ON sp.id = r.student_id
  LEFT JOIN public.profiles mp ON mp.id = r.mentor_id
  WHERE r.org_id = p_org_id
    AND r.status IN ('active_chat', 'converted_to_in_person')
    AND (
      r.mentor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type IN ('counselor', 'admin')
          AND p.org_id = p_org_id
      )
    )
  ORDER BY r.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_accept_companion_request(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  org_id text,
  student_id uuid,
  student_full_name text,
  student_email text,
  mentor_id uuid,
  support_type public.support_type_enum,
  category public.struggle_category_enum,
  format_preference public.interaction_format_enum,
  urgency_tier public.urgency_tier_enum,
  status public.companion_status_enum,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org text;
BEGIN
  SELECT r.org_id INTO v_org
  FROM public.companion_requests r
  WHERE r.id = p_request_id
    AND r.status = 'unassigned';

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'request not found or not unassigned' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_companion_staff(v_org) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.companion_requests r
  SET
    status = 'active_chat',
    mentor_id = auth.uid(),
    updated_at = now()
  WHERE r.id = p_request_id
    AND r.status = 'unassigned';

  RETURN QUERY
  SELECT
    r.id,
    r.org_id,
    r.student_id,
    coalesce(sp.full_name, sp.email, 'Student')::text,
    coalesce(sp.email, '')::text,
    r.mentor_id,
    r.support_type,
    r.category,
    r.format_preference,
    r.urgency_tier,
    r.status,
    r.created_at
  FROM public.companion_requests r
  LEFT JOIN public.profiles sp ON sp.id = r.student_id
  WHERE r.id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_companion_queue_anon(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_list_companion_active(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_accept_companion_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_companion_queue_anon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_companion_active(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_accept_companion_request(uuid) TO authenticated;

-- ============================================================================
-- 9) Metrics (aggregated, no PHI)
-- ============================================================================
CREATE OR REPLACE VIEW public.companion_request_metrics_daily AS
SELECT
  org_id,
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
  status,
  urgency_tier,
  category,
  count(*)::bigint AS request_count
FROM public.companion_requests
GROUP BY 1, 2, 3, 4, 5;

CREATE OR REPLACE FUNCTION public.staff_companion_metrics(p_org_id text, p_days int DEFAULT 30)
RETURNS SETOF public.companion_request_metrics_daily
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_companion_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.companion_request_metrics_daily m
  WHERE m.org_id = p_org_id
    AND m.day >= (current_date - p_days);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_companion_metrics(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_companion_metrics(text, int) TO authenticated;

-- ============================================================================
-- 10) Realtime
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication missing; skip companion_requests';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication missing; skip companion_messages';
END $$;

ALTER TABLE public.companion_requests REPLICA IDENTITY FULL;
ALTER TABLE public.companion_messages REPLICA IDENTITY FULL;

-- =============================================================================
-- PART: 20260605000001_emmaus_triggers_safe.sql
-- =============================================================================

-- Emmaus: do not roll back companion_requests insert if prayer wall or counselor_alerts fail.

CREATE OR REPLACE FUNCTION public.companion_after_insert_silent_prayer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
  v_cat text;
BEGIN
  IF NEW.support_type <> 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_cat := replace(NEW.category::text, '_', ' ');
    v_body := coalesce(nullif(trim(NEW.student_notes), ''), '(Silent prayer — no additional notes)');
    v_body := '[Emmaus · ' || v_cat || '] ' || v_body;

    INSERT INTO public.prayer_intentions (
      profile_id,
      org_id,
      body,
      share_anonymous,
      feed_approved,
      visible_on_wall
    ) VALUES (
      NEW.student_id,
      NEW.org_id,
      v_body,
      true,
      false,
      false
    );

    UPDATE public.companion_requests
    SET
      status = 'resolved',
      resolved_at = now(),
      updated_at = now()
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'companion_after_insert_silent_prayer failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.companion_after_insert_urgent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NEW.urgency_tier <> 'urgent_today' THEN
    RETURN NEW;
  END IF;
  IF NEW.support_type = 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT coalesce(p.full_name, 'Student'), coalesce(p.email, '')
    INTO v_name, v_email
    FROM public.profiles p
    WHERE p.id = NEW.student_id;

    INSERT INTO public.counselor_alerts (
      org_id,
      student_id,
      student_name,
      student_email,
      status
    ) VALUES (
      NEW.org_id,
      NEW.student_id,
      v_name,
      v_email,
      'pending'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'companion_after_insert_urgent failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES (optional — run separately)
-- =============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%pulse%' OR tablename LIKE '%spiritual%' OR tablename LIKE '%companion%' OR tablename LIKE '%triage%' ORDER BY 1;
-- SELECT id, name, domain_lock FROM public.organizations;
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%school%' OR routine_name LIKE '%org_%' OR routine_name LIKE '%companion%' ORDER BY 1;
