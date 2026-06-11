# Tier 3 — Scale (SSO, roster, parents, branding)

Run migration **`20260608000000_tier3_scale.sql`** after Tier 1 staff invites migration.

## 1. Per-school branding

```sql
UPDATE public.organizations
SET
  logo_url = 'https://yourschool.edu/logo.png',
  primary_color = '#1e3a5f',
  secondary_color = '#059669',
  packaging_mode = 'jesuit',  -- or 'secular' | 'district'
  sso_google_enabled = true,
  sso_azure_enabled = true
WHERE id = 'your-school-slug';
```

| packaging_mode | What changes in the app |
|----------------|-------------------------|
| `jesuit` | Spiritual tab, Examen, Live the Fourth (default) |
| `secular` | "Values & service" copy, neutral reflection language |
| `district` | "Wellness & service" district-neutral copy |

Students/staff/parents load branding via `get_org_branding` → accent color + logo on School Wellness header.

## 2. SSO (Google / Microsoft)

**Supabase dashboard:** Authentication → Providers → enable Google and/or Azure.

**App:** School login (`/(auth)/login?mode=school`) shows **Continue with Google** and **Continue with Microsoft**.

**Google Workspace tip:** Type school email first — SSO passes `hd=yourschool.edu` to restrict account picker.

**Clever / ClassLink:** Not built-in yet. Use roster CSV import (below) + Google SSO as interim. Full SIS sync is a custom integration.

See also `GOOGLE_LOGIN_SETUP.md` for redirect URLs.

## 3. Bulk roster (no Clever required)

**Web staff portal → Roster tab** — paste CSV:

```
student@school.edu,Jane Doe,11
other@school.edu,John Smith,10
```

Or RPC:

```sql
SELECT import_school_roster_batch(
  'your-school-slug',
  '[{"email":"s@school.edu","full_name":"Jane","grade_level":"11"}]'::jsonb
);
```

When the student signs in (email or SSO), `apply_roster_on_profile` sets grade + name.

## 4. Parent portal

1. Staff: **Web portal → Parent links** — parent email + student UUID.
2. Parent: create account in app with that email (password or SSO).
3. Parent lands on **`/(parent)/dashboard`** — service hours + check-in flags only (FERPA-safe).

Optional browser copy: `web-parent-portal/` (same data, for your website).

## 5. Verify

| Role | Expected |
|------|----------|
| Student | Spiritual tab uses school colors + packaging labels |
| Parent | Family portal, linked students visible |
| Admin | Roster import + parent link in web portal |
| Staff SSO | Google/Microsoft on school login screen |

## 6. Files added (Tier 3)

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260608000000_tier3_scale.sql` | Schema + RPCs |
| `lib/schoolSso.js` | Google/Azure OAuth helper |
| `lib/orgBranding.js` | Fetch + merge school colors |
| `lib/orgPackagingLabels.js` | Jesuit vs secular copy |
| `lib/parentPortalClient.js` | Parent RPC wrappers |
| `context/OrgBrandingContext.js` | App-wide branding provider |
| `app/(parent)/dashboard.js` | Mobile family portal |
| `web-parent-portal/` | Optional website copy |
| `web-staff-portal/` | + Roster + Parent links tabs |
