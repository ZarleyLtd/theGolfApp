# Supabase Cutover Runbook

## Prerequisites

- Supabase migrations applied (`supabase db push`).
- Edge Function deployed (`supabase functions deploy golfapp-api --no-verify-jwt`).
- Secrets set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional AI keys.
- `.env` prepared locally for migration scripts.

## Dry run

1. Run data migration in dry-run mode:
   - `node scripts/migrate-google-to-supabase.mjs --dry-run`
2. Review generated report under `scripts/migration-reports`.
3. Fix any data anomalies before live import.

## Live migration

1. Freeze admin writes in legacy system (announce maintenance window).
2. Run migration:
   - `node scripts/migrate-google-to-supabase.mjs`
3. Reconcile:
   - `node scripts/reconcile-google-vs-supabase.mjs`
4. Smoke test:
   - `admin/societies.html`
   - `admin/society-admin.html`
   - `scorecard.html`
   - `leaderboard.html`
   - `all-results.html`

## Frontend switch

1. Set `AppConfig.apiUrl` to Supabase function URL.
2. Deploy frontend.
3. Verify read/write from browser network calls against `golfapp-api`.

## Rollback

- If severe issue appears:
  1. Switch `AppConfig.apiUrl` back to legacy Apps Script URL.
  2. Redeploy frontend immediately.
  3. Keep Supabase data untouched for forensic comparison.

## Legacy decommission

- After one release window with no critical issues:
  - Disable legacy write access.
  - Remove remaining Sheets-specific code paths and docs.
