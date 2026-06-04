# TestFlight release checklist (BetterU iOS)

Use this before every App Store Connect / TestFlight upload.

## 1. Supabase (production project)

Apply pending SQL migrations on the **production** Supabase project (Dashboard → SQL or `supabase db push`):

| Migration | Purpose |
|-----------|---------|
| `20260601000000_grade_level_and_focus_points.sql` | `profiles.grade_level`, `profiles.focus_points` |
| `20260601000100_anonymized_weekly_trends.sql` | FERPA board report materialized views + RPCs |
| `20260601000200_counselor_triage_queue.sql` | MTSS triage queue + Realtime |
| `20260601000300_focus_sessions.sql` | Focus Lock sessions + points RPC |

After deploy, optionally run once as an admin user:

```sql
SELECT public.refresh_wellness_analytics_cache();
```

Confirm Realtime is enabled for `counselor_triage_queue` (Database → Replication).

## 2. EAS environment secrets

Set secrets for the **production** environment (Expo dashboard or CLI). Copy names from [`.env.example`](../.env.example).

Minimum for a full TestFlight build:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (required for run maps on device)
- `EXPO_PUBLIC_OPENAI_API_KEY` / `EXPO_PUBLIC_ANTHROPIC_API_KEY` (if AI features ship)
- `EXPO_PUBLIC_LIVEKIT_URL`
- AdMob IDs if monetization is on

**Never** put `LIVEKIT_API_SECRET` or service-role keys in `EXPO_PUBLIC_*` — those belong only on Supabase Edge Function secrets.

## 3. Version numbers

In [`app.config.js`](../app.config.js):

- `version` and `runtimeVersion` must match (e.g. `1.1.7`).
- `ios.buildNumber` must increment each TestFlight upload (or rely on EAS `autoIncrement` + remote `appVersionSource`).

Sync native plist locally (optional before commit):

```bash
node scripts/eas-sync-ios-plist.cjs
```

EAS production builds also run this automatically via `eas-build-pre-install`.

## 4. Pre-flight script

From `BetterUCurrent/`:

```bash
npm run verify:eas-production
```

All checks must pass.

## 5. Build & submit

```bash
npm run build:ios:production
npm run submit:ios
```

Or:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

Use profile **`production`** only (not `development` — that includes `expo-dev-client`).

## 6. TestFlight smoke test (school B2B)

| Role | Route | Verify |
|------|-------|--------|
| Student | School wellness tab | Daily pulse, Focus Lock (`/focus-lock`), counselor request |
| Student | Focus Lock | Backgrounding app forfeits session; full timer awards points |
| Counselor/Admin | `/(school)/dashboard` | Triage queue + Board report nav cards |
| Counselor | `/(school)/triage` | Realtime tier-3 alert, assign / resolve |
| Admin | `/(school)/board-report` | Refresh cache, export JSON/CSV (no student names in export) |

## 7. App Store Connect metadata

- **Encryption**: `ITSAppUsesNonExemptEncryption` is `false` in Info.plist (standard HTTPS only).
- **Privacy nutrition labels**: update if new data types (aggregated wellness, triage tickets, focus sessions).
- **Review notes**: mention school institutional features and optional counselor workflows.

## 8. Security hygiene

- `.env` is gitignored — do not commit it.
- Rotate any API key that was ever committed or shared in chat.
- Release builds do **not** apply `devSchoolTestOverride` email mapping (`__DEV__` only).
