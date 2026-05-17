-- Strake Jesuit tenant + one test profile as **student** (student tab UX).

INSERT INTO public.organizations (id, name, domain_lock, emergency_contacts)
VALUES (
  'strake-jesuit',
  'Strake Jesuit College Preparatory',
  'mail.strakejesuit.org',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET
  account_type = 'student',
  org_id = 'strake-jesuit'
WHERE lower(trim(email)) = lower(trim('lborgarello27@mail.strakejesuit.org'));
