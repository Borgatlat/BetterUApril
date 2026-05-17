-- If Strake tester was previously seeded as admin, switch to student for School / Spiritual UX.
UPDATE public.profiles
SET account_type = 'student', org_id = 'strake-jesuit'
WHERE lower(trim(email)) = lower(trim('lborgarello27@mail.strakejesuit.org'));
