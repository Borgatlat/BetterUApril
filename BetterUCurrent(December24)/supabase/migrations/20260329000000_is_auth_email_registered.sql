-- Lets the signup screen check if an email is already in auth.users before the user taps Sign Up.
-- SECURITY: This allows email enumeration (anyone can probe which addresses have accounts). Many apps accept
-- that tradeoff for better UX; remove or protect (e.g. rate-limit in an Edge Function) if you need stricter privacy.

CREATE OR REPLACE FUNCTION public.is_auth_email_registered(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(COALESCE(p_email, '')))
  );
$$;

COMMENT ON FUNCTION public.is_auth_email_registered(text) IS
  'True if email exists in auth.users. Exposed to anon for pre-signup UX.';

REVOKE ALL ON FUNCTION public.is_auth_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_auth_email_registered(text) TO anon, authenticated;
