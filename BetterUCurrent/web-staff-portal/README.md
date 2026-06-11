# BetterU School Staff Portal (website only)

**This folder is NOT part of the Expo mobile app.** Copy it to your school website when ready.

## What it does (Tier 1)

- **Dashboard** — 7-day anonymized pulse metrics
- **Triage** — view / assign / resolve counselor tickets
- **Alerts** — counselor alert list
- **Exports** — JSON + CSV for board meetings
- **Staff invites** — email invite links (requires migration `20260607000000_school_staff_invites.sql`)
- **Roster import** — CSV bulk enroll (Tier 3)
- **Parent links** — link guardian email to student (Tier 3)
- **30-day pilot report** — printable summary for principals

## Setup

1. Run school migrations (see `../docs/SCHOOL_MIGRATION_RUNBOOK.md`).
2. Promote your first admin in Supabase SQL:
   ```sql
   UPDATE profiles SET account_type = 'admin', org_id = 'your-school-slug' WHERE email = 'you@school.edu';
   ```
3. Copy `config.example.js` → `config.js` and fill in Supabase URL + anon key.
4. Host these files on any static host (Vercel, Netlify, S3, school web server):
   - `index.html`
   - `portal.css`
   - `portal.js`
   - `config.js`

## Local preview

```bash
cd web-staff-portal
npx serve .
# open http://localhost:3000
```

## Staff invite flow

1. Admin signs into this portal.
2. **Staff invites** tab → enter counselor email → copy link.
3. Counselor creates a BetterU account (app) with that email, opens invite link, signs into portal.
4. `accept_school_staff_invite` sets their `account_type` and `org_id`.

## Security notes

- Uses Supabase **anon key** + RLS (same as the app). Staff must be `counselor` or `admin`.
- Do not embed service-role keys in this portal.
- Use HTTPS on your school domain.
