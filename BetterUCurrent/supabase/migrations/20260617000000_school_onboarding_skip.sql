-- Partner-school accounts skip consumer onboarding; backfill existing rows.

UPDATE public.profiles
SET onboarding_completed = true,
    updated_at = now()
WHERE org_id IS NOT NULL
  AND account_type IN ('student', 'counselor', 'admin', 'parent')
  AND COALESCE(onboarding_completed, false) = false;

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

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    account_type,
    org_id,
    onboarding_completed
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(local_part), ''), 'User'),
    trim(p_email),
    CASE WHEN matched_org IS NOT NULL THEN 'student' ELSE 'public' END,
    matched_org,
    matched_org IS NOT NULL
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
    onboarding_completed = CASE
      WHEN matched_org IS NOT NULL THEN true
      WHEN profiles.onboarding_completed = true THEN true
      ELSE profiles.onboarding_completed
    END,
    updated_at = now();

  PERFORM public.apply_roster_on_profile(p_user_id, p_email);
  PERFORM public.apply_parent_links_on_profile(p_user_id, p_email);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_school_domain_on_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_school_domain_on_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_school_domain_on_profile(uuid, text) TO service_role;
