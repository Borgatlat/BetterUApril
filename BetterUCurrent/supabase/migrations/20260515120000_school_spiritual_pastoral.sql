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
