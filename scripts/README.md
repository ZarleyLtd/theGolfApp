# Scripts

Utility scripts for the project.

## Supabase migration

- `migrate-google-to-supabase.mjs`
  - Migrates Google Sheets data (via legacy API) into Supabase schema `thegolfapp`.
  - Supports `--dry-run`.
- `reconcile-google-vs-supabase.mjs`
  - Compares aggregate entity counts between legacy backend and Supabase.
