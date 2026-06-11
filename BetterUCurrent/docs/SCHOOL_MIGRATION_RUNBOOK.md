# School pilot — Supabase migration runbook

Run these in **Supabase → SQL Editor** in order. Safe to re-run idempotent migrations.

## 1. Core school B2B (required)

| File | What it enables |
|------|-----------------|
| `20260515000000_school_wellness_b2b2c.sql` | Organizations, daily pulse, counselor alerts, domain enrollment |
| `20260515120000_school_spiritual_pastoral.sql` | Prayer wall, service hours, spiritual calendar |

## 2. Your school org row (required)

Add your school to `organizations` and map email domains. Example:

```sql
INSERT INTO public.organizations (id, name, email_domains)
VALUES ('your-school-slug', 'Your School Name', ARRAY['yourschool.edu'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

Or use an existing seed migration (e.g. `20260516093000_strake_jesuit_org_and_admin_test_user.sql`).

## 3. Staff tools & analytics

| File | What it enables |
|------|-----------------|
| `20260601000000_grade_level_and_focus_points.sql` | Grade level on profiles, focus points |
| `20260601000100_anonymized_weekly_trends.sql` | Board report cohort trends |
| `20260601000200_counselor_triage_queue.sql` | MTSS triage queue + staff RPC |
| `20260601000300_focus_sessions.sql` | Focus Lock sessions |
| `20260604000001_jsn_accreditation_metrics.sql` | JSN accreditation KPIs |
| `20260604000002_administrative_assignments.sql` | Reflective disciplinary assignments |
| `20260607000000_school_staff_invites.sql` | Staff invite links (web portal) |
| `20260608000000_tier3_scale.sql` | Branding, roster, parents, SSO flags |

## 4. Student features (run as students use them)

| File | What it enables |
|------|-----------------|
| `20260602000000_accountability_partners_repair.sql` | Accountability partners + RPC |
| `20260603000000_accountability_enhancements.sql` | Weekly rhythm / meetup |
| `20260605000000_emmaus_companion_network.sql` | Emmaus Companion |
| `20260605000001_emmaus_triggers_safe.sql` | Safe Emmaus triggers |
| `20260308000000_create_futureu_chat_history.sql` | Future U chat history |

## 5. First staff admin (manual)

Staff are **not** auto-created by student domain rules. Promote one user:

```sql
UPDATE public.profiles
SET account_type = 'admin', org_id = 'your-school-slug'
WHERE email = 'counselor@yourschool.edu';
```

Then use the **web staff portal** to invite other counselors.

## 6. Verify in the app

- Student signs in with `@yourschool.edu` → lands on **Spiritual** (Today formation hero)
- **School Wellness** hub reachable from Mental chip or in-app links (hidden tab — less clutter)
- No yellow “Campus setup incomplete” banner
- Counselor signs in → **Staff dashboard** in app (mobile) or **web staff portal** (browser)

### Tier 2 UX (campus light theme)

- Light off-white UI on Spiritual, School Wellness, and student Mental tab
- Unified **Support** section on School Wellness (Focus Lock · Partners · Emmaus)
- Case study template: `docs/SCHOOL_PILOT_CASE_STUDY_TEMPLATE.md`

## 7. Web staff portal (browser, not in the app)

Copy `BetterUCurrent/web-staff-portal/` to your website host. See `web-staff-portal/README.md`.

## 8. Tier 3 (scale)

See **`docs/TIER3_SETUP.md`** — SSO, roster CSV, parent links, per-school branding.

---

**Quick health check:** Open School Wellness as a student. If tables are missing, a yellow banner lists which features need migrations.
