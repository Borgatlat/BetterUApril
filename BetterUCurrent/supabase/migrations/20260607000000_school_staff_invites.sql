-- Staff invite links for web portal (counselor/admin onboarding without SQL).

CREATE TABLE IF NOT EXISTS public.school_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'counselor' CHECK (role IN ('counselor', 'admin')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_staff_invites_email_lower CHECK (email = lower(trim(email)))
);

CREATE INDEX IF NOT EXISTS idx_school_staff_invites_org
  ON public.school_staff_invites (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_school_staff_invites_token
  ON public.school_staff_invites (token)
  WHERE accepted_at IS NULL;

ALTER TABLE public.school_staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_staff_invites_select_staff ON public.school_staff_invites;
CREATE POLICY school_staff_invites_select_staff ON public.school_staff_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('counselor', 'admin')
        AND p.org_id = school_staff_invites.org_id
    )
  );

-- Inserts/updates only via SECURITY DEFINER RPCs below.

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

CREATE OR REPLACE FUNCTION public.create_school_staff_invite(
  p_org_id text,
  p_email text,
  p_role text DEFAULT 'counselor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_role text := coalesce(nullif(trim(p_role), ''), 'counselor');
  v_token text;
  v_id uuid;
BEGIN
  IF NOT public.is_school_staff(p_org_id) THEN
    RAISE EXCEPTION 'not authorized for this org' USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL OR v_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  IF v_role NOT IN ('counselor', 'admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  INSERT INTO public.school_staff_invites (org_id, email, role, created_by)
  VALUES (p_org_id, v_email, v_role, auth.uid())
  RETURNING id, token INTO v_id, v_token;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'token', v_token,
    'email', v_email,
    'role', v_role,
    'org_id', p_org_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_school_staff_invite(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school_staff_invite(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_school_staff_invites(p_org_id text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  token text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz
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
  SELECT
    i.id,
    i.email,
    i.role,
    i.token,
    i.expires_at,
    i.accepted_at,
    i.created_at
  FROM public.school_staff_invites i
  WHERE i.org_id = p_org_id
  ORDER BY i.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_school_staff_invites(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_school_staff_invites(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_school_staff_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_invite public.school_staff_invites%ROWTYPE;
  v_email text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite
  FROM public.school_staff_invites
  WHERE token = trim(p_token)
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite invalid or expired';
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM public.profiles WHERE id = v_me;

  IF v_email IS NULL OR v_email <> v_invite.email THEN
    RAISE EXCEPTION 'sign in with the invited email address first';
  END IF;

  UPDATE public.profiles
  SET
    account_type = v_invite.role,
    org_id = v_invite.org_id,
    updated_at = now()
  WHERE id = v_me;

  UPDATE public.school_staff_invites
  SET accepted_at = now(), accepted_by = v_me
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_invite.org_id,
    'role', v_invite.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_school_staff_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_school_staff_invite(text) TO authenticated;
