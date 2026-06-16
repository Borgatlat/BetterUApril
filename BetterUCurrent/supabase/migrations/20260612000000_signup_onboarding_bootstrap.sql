-- Bootstrap onboarding_data + school profile when auth.users row is created.
-- Fixes RLS 42501 on client signUp when email confirmation is ON (no JWT yet).

ALTER TABLE public.onboarding_data
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.handle_auth_user_signup_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_full_name text;
BEGIN
  meta_full_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  INSERT INTO public.onboarding_data (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(meta_full_name, NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), '')),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, onboarding_data.full_name),
    email = COALESCE(EXCLUDED.email, onboarding_data.email),
    updated_at = timezone('utc', now());

  BEGIN
    PERFORM public.apply_school_domain_on_profile(NEW.id, NEW.email);
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'apply_school_domain_on_profile failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_signup_bootstrap ON auth.users;

CREATE TRIGGER on_auth_user_signup_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_signup_bootstrap();
