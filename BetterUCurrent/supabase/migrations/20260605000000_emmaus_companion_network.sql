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
