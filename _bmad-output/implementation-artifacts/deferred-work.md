# Deferred Work

## From: Mood Tracker State Issues (2026-03-20)

- ~~**Calendar vs Timeline date grouping mismatch (UTC vs local)**~~ — Picked up in A+B patch
- ~~**Stale visit events on Home dashboard**~~ — Superseded by dynamic events feature (Goal C)

## From: A+B Patch (2026-03-20)

- **Dynamic events system** — Replace hardcoded home dashboard event cards with user-managed events. New Supabase table, CRUD UI for adding/editing/deleting events, dynamic timer cards that auto-hide when passed. Full feature build: DB migration → service → store slice → UI components.

## From: Mood Duplicate Entries (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-mood-duplicate-log-entries.md`
  summary: Migrations are never applied to production by CI — `.github/workflows/supabase-migrations.yml` only validates them against a throwaway local Supabase, so any schema change the app depends on must be applied by hand or the deployed frontend breaks against an unmigrated database.
  evidence: The workflow is named "Supabase Migration Validation"; its steps are checkout → Setup Supabase CLI → Start Supabase local → Apply migrations → Validate RLS policies → Check for security advisories → Stop Supabase → Migration Summary. There is no `supabase link` and no `supabase db push`, and it triggers only on `pull_request` (paths `supabase/migrations/**`, `supabase/config.toml`) and `workflow_dispatch` — never on push to main. Confirmed impact: with the frontend's new `on_conflict=user_id,created_at` upsert, a production database lacking `moods_user_id_created_at_key` rejects every insert with `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification` (reproduced against the local database by dropping the constraint). Pre-existing condition, not caused by this story; the constraint was applied to production manually to unblock it.
