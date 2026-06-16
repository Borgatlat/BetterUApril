-- Per-school module toggles: spiritual tab, nutrition tab (B2B partnerships)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL DEFAULT '{"spiritual": true, "nutrition": true}'::jsonb;

COMMENT ON COLUMN public.organizations.enabled_modules IS
  'Feature toggles per partner school, e.g. {"spiritual": true, "nutrition": true}.';

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
    'sso_azure_enabled', COALESCE(v_row.sso_azure_enabled, false),
    'enabled_modules', COALESCE(
      v_row.enabled_modules,
      '{"spiritual": true, "nutrition": true}'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_branding(text) TO authenticated;
