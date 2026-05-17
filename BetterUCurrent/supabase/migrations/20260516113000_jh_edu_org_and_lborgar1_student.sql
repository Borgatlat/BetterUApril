-- JH edu tenant + qa student lborgar1@jh.edu (matches apply_school_domain_on_profile domain_lock rules).

INSERT INTO public.organizations (id, name, domain_lock, emergency_contacts)
VALUES (
  'jh-edu',
  'JH Institution (Development)',
  'jh.edu',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET account_type = 'student', org_id = 'jh-edu'
WHERE lower(trim(email)) = lower(trim('lborgar1@jh.edu'));
