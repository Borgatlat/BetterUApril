# BetterU Family Portal (website only — optional)

**Not part of the Expo app.** The primary parent experience is **`app/(parent)/dashboard`** in the mobile app.

Deploy this folder if you want a browser-only family view on your school website.

## Setup

1. Run Tier 3 migration `20260608000000_tier3_scale.sql`.
2. Staff links parent email → student in **web staff portal → Parent links**.
3. Parent creates account in the app with that email (or SSO).
4. Copy `config.example.js` → `config.js` with Supabase URL + anon key.
5. Host `index.html`, `portal.css`, `portal.js`, `config.js`.

## Local preview

```bash
cd web-parent-portal
npx serve .
```

## FERPA

Shows service hours and participation flags only — never mood/stress scores or journal text.
