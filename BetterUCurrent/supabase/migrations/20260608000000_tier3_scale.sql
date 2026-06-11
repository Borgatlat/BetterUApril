-- Tier 3: SSO roster, parent portal, secular packaging, per-school branding

-- Ensure staff helper exists (also in 20260607000000; safe to re-run)
CREATE OR REPLACE FUNCTION public.is_school_staff(p_org_id text)
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
      AND p.account_type IN ('counselor', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_school_staff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_staff(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 1) Organization branding + packaging mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#059669',
  ADD COLUMN IF NOT EXISTS packaging_mode text NOT NULL DEFAULT 'jesuit',
  ADD COLUMN IF NOT EXISTS sso_google_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sso_azure_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_packaging_mode_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_packaging_mode_check CHECK (
    packaging_mode IN ('jesuit', 'secular', 'district')
  );

COMMENT ON COLUMN public.organizations.packaging_mode IS
  'jesuit = Spiritual/Examen labels; secular = Values & Service; district = neutral district copy';

-- ---------------------------------------------------------------------------
-- 2) Parent account type
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check CHECK (
    account_type IN ('public', 'student', 'counselor', 'admin', 'parent')
  );

-- ---------------------------------------------------------------------------
-- 3) Roster staging (bulk import before students sign in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  grade_level text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  enrolled_at timestamptz,
  CONSTRAINT school_roster_email_lower CHECK (email = lower(trim(email))),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_school_roster_org ON public.school_roster (org_id, imported_at DESC);

ALTER TABLE public.school_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_roster_select_staff ON public.school_roster;
CREATE POLICY school_roster_select_staff ON public.school_roster
  FOR SELECT TO authenticated
  USING (public.is_school_staff(org_id));

-- Inserts via SECURITY DEFINER RPC only

-- ---------------------------------------------------------------------------
-- 4) Parent ↔ student links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  parent_user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  parent_email text NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'parent',
  linked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_student_links_parent_email_lower CHECK (parent_email = lower(trim(parent_email))),
  UNIQUE (org_id, parent_email, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent_user
  ON public.parent_student_links (parent_user_id)
  WHERE parent_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parent_links_student
  ON public.parent_student_links (org_id, student_id);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_links_select_parent ON public.parent_student_links;
CREATE POLICY parent_links_select_parent ON public.parent_student_links
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS parent_links_select_staff ON public.parent_student_links;
CREATE POLICY parent_links_select_staff ON public.parent_student_links
  FOR SELECT TO authenticated
  USING (public.is_school_staff(org_id));

-- ---------------------------------------------------------------------------
-- 5) Apply roster row on student sign-in (grade + name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_roster_on_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_row public.school_roster%ROWTYPE;
BEGIN
  IF v_email IS NULL OR position('@' IN v_email) < 2 THEN
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.school_roster r
  WHERE r.email = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.profiles p
  SET
    org_id = COALESCE(p.org_id, v_row.org_id),
    account_type = CASE
      WHEN p.account_type IN ('admin', 'counselor', 'parent') THEN p.account_type
      ELSE 'student'
    END,
    full_name = COALESCE(NULLIF(trim(v_row.full_name), ''), p.full_name),
    grade_level = COALESCE(v_row.grade_level, p.grade_level),
    updated_at = now()
  WHERE p.id = p_user_id;

  UPDATE public.school_roster
  SET enrolled_at = COALESCE(enrolled_at, now())
  WHERE id = v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_roster_on_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_roster_on_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_roster_on_profile(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Promote parent accounts when staff pre-linked their email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_parent_links_on_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_org text;
BEGIN
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.parent_student_links
  SET parent_user_id = p_user_id
  WHERE parent_email = v_email
    AND parent_user_id IS NULL;

  SELECT l.org_id INTO v_org
  FROM public.parent_student_links l
  WHERE l.parent_user_id = p_user_id
  LIMIT 1;

  IF v_org IS NOT NULL THEN
    UPDATE public.profiles
    SET
      account_type = CASE
        WHEN account_type IN ('admin', 'counselor', 'student') THEN account_type
        ELSE 'parent'
      END,
      org_id = COALESCE(org_id, v_org),
      updated_at = now()
    WHERE id = p_user_id
      AND account_type NOT IN ('admin', 'counselor', 'student');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_parent_links_on_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_parent_links_on_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_parent_links_on_profile(uuid, text) TO service_role;

-- Extend domain routing to call roster + parent helpers
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
    PERFORM public.apply_parent_links_on_profile(p_user_id, p_email);
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
      WHEN profiles.account_type IN ('admin', 'counselor', 'parent') THEN profiles.account_type
      WHEN matched_org IS NOT NULL THEN 'student'
      ELSE 'public'
    END,
    org_id = CASE
      WHEN profiles.account_type IN ('admin', 'counselor', 'parent') THEN profiles.org_id
      ELSE matched_org
    END,
    email = COALESCE(profiles.email, EXCLUDED.email),
    updated_at = now();

  PERFORM public.apply_roster_on_profile(p_user_id, p_email);
  PERFORM public.apply_parent_links_on_profile(p_user_id, p_email);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Staff: bulk roster import (CSV → JSON rows in app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_school_roster_batch(
  p_org_id text,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_email text;
  v_name text;
  v_grade text;
  v_inserted int := 0;
  v_updated int := 0;
BEGIN
  IF NOT public.is_school_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_email := lower(trim(v_row->>'email'));
    v_name := nullif(trim(v_row->>'full_name'), '');
    v_grade := nullif(trim(v_row->>'grade_level'), '');

    IF v_email IS NULL OR v_email NOT LIKE '%@%.%' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.school_roster (org_id, email, full_name, grade_level)
    VALUES (p_org_id, v_email, v_name, v_grade)
    ON CONFLICT (org_id, email) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, school_roster.full_name),
      grade_level = COALESCE(EXCLUDED.grade_level, school_roster.grade_level),
      imported_at = now();

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', p_org_id,
    'processed', jsonb_array_length(p_rows),
    'upserted', v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_school_roster_batch(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_school_roster_batch(text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Staff: link parent email to student
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_parent_to_student(
  p_org_id text,
  p_parent_email text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_parent_email));
  v_id uuid;
BEGIN
  IF NOT public.is_school_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'invalid parent email';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles s
    WHERE s.id = p_student_id AND s.org_id = p_org_id AND s.account_type = 'student'
  ) THEN
    RAISE EXCEPTION 'student not found in org';
  END IF;

  INSERT INTO public.parent_student_links (org_id, parent_email, student_id, linked_by)
  VALUES (p_org_id, v_email, p_student_id, auth.uid())
  ON CONFLICT (org_id, parent_email, student_id) DO UPDATE SET
    linked_by = auth.uid()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'parent_email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.link_parent_to_student(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_parent_to_student(text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9) Parent: list linked students
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_linked_students()
RETURNS TABLE (
  student_id uuid,
  student_name text,
  student_email text,
  grade_level text,
  org_id text,
  org_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.account_type = 'parent'
  ) THEN
    RAISE EXCEPTION 'parent account required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS student_id,
    COALESCE(s.full_name, s.email, 'Student')::text AS student_name,
    COALESCE(s.email, '')::text AS student_email,
    s.grade_level,
    l.org_id,
    o.name AS org_name
  FROM public.parent_student_links l
  JOIN public.profiles s ON s.id = l.student_id
  JOIN public.organizations o ON o.id = l.org_id
  WHERE l.parent_user_id = auth.uid()
  ORDER BY s.full_name NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.list_parent_linked_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_parent_linked_students() TO authenticated;

-- ---------------------------------------------------------------------------
-- 10) Parent: FERPA-safe student summary (no mood/stress numbers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_parent_student_summary(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student profiles%ROWTYPE;
  v_hours_approved numeric;
  v_hours_pending numeric;
  v_pulse_days int;
  v_checked_in_week boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.parent_student_links l
    WHERE l.parent_user_id = auth.uid() AND l.student_id = p_student_id
  ) THEN
    RAISE EXCEPTION 'not linked to this student' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student FROM profiles WHERE id = p_student_id;

  SELECT COALESCE(SUM(hours), 0) INTO v_hours_approved
  FROM service_hour_logs
  WHERE student_id = p_student_id AND status = 'approved';

  SELECT COALESCE(SUM(hours), 0) INTO v_hours_pending
  FROM service_hour_logs
  WHERE student_id = p_student_id AND status = 'pending';

  SELECT count(DISTINCT logged_date)::int INTO v_pulse_days
  FROM daily_pulse_logs
  WHERE profile_id = p_student_id
    AND logged_date >= (CURRENT_DATE - 30);

  SELECT EXISTS (
    SELECT 1 FROM daily_pulse_logs
    WHERE profile_id = p_student_id
      AND logged_date >= (CURRENT_DATE - 7)
  ) INTO v_checked_in_week;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'student_name', COALESCE(v_student.full_name, v_student.email),
    'grade_level', v_student.grade_level,
    'service_hours_approved', v_hours_approved,
    'service_hours_pending', v_hours_pending,
    'pulse_checkins_30d', v_pulse_days,
    'checked_in_this_week', v_checked_in_week,
    'data_classification', 'parent_summary_ferpa_safe',
    'note', 'Mood and stress scores are never shown to parents unless your school enables a separate consent flow.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_parent_student_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_parent_student_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11) Branding read (students, staff, parents in org)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_branding(p_org_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row organizations%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = p_org_id
      AND p.account_type IN ('student', 'counselor', 'admin', 'parent')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_row.id,
    'name', v_row.name,
    'logo_url', v_row.logo_url,
    'primary_color', COALESCE(v_row.primary_color, '#2563eb'),
    'secondary_color', COALESCE(v_row.secondary_color, '#059669'),
    'packaging_mode', COALESCE(v_row.packaging_mode, 'jesuit'),
    'sso_google_enabled', COALESCE(v_row.sso_google_enabled, true),
    'sso_azure_enabled', COALESCE(v_row.sso_azure_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_branding(text) TO authenticated;

-- Staff list roster
CREATE OR REPLACE FUNCTION public.list_school_roster(p_org_id text)
RETURNS TABLE (
  email text,
  full_name text,
  grade_level text,
  imported_at timestamptz,
  enrolled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_school_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.email, r.full_name, r.grade_level, r.imported_at, r.enrolled_at
  FROM public.school_roster r
  WHERE r.org_id = p_org_id
  ORDER BY r.imported_at DESC, r.email ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_school_roster(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_school_roster(text) TO authenticated;
