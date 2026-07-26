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

## From: Mood Stale Sync Discards Edit (2026-07-26)

- source_spec: `_bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md`
  summary: Pending moods are not scoped to the signed-in user, so after a sign-out/sign-in on a shared device the service worker uploads the previous user's unsynced moods into the new user's account.
  evidence: `src/sw.ts` builds its request as `moodSyncPayload(mood, authToken.userId)` — the owner comes from the stored auth token, not from `mood.userId`. `src/api/auth/actionService.ts` clears the auth token on sign-out but nothing clears the `moods` object store, and `getPendingMoods()` (`src/sw-db.ts`) filters only on `!mood.synced`, never on user. So user A's pending mood text and note are written under user B's `user_id`, and B's partner sees them. Change detection cannot catch it: `moodSyncFingerprint` deliberately excludes `user_id` (`src/services/moodSyncPayload.ts`), so the record fingerprints as unchanged and is flagged clean. Pre-existing — the SW read `authToken.userId` before this story too; this story only moved the payload construction into a shared module. Likely fix: skip records whose `mood.userId` does not match the token's user, and clear or reassign the store on sign-out.

- source_spec: `_bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md`
  summary: `moodService.updateMood` still reads and writes across two IndexedDB transactions, so a UI edit landing mid-sync can overwrite the `supabaseId` that `markAsSynced` just recorded.
  evidence: `markAsSynced` is now a single `readwrite` transaction, but `updateMood` still calls `super.update`, which is `db.get` at `src/services/BaseIndexedDBService.ts:181` and `db.put` at `:188` with an `await` between them. If `markAsSynced` commits in that gap, `updateMood` writes back `{...staleItem, ...updates}` carrying the pre-sync `supabaseId: undefined`, discarding the server id. The sync lock does not cover this — it serialises sync *batches*, not a plain UI edit against the service worker's batch. Consequence is a lost server id, not lost data or a duplicate row: the next pass takes the upsert path and `(user_id, created_at)` resolves it to the same row. Fix would be giving `updateMood` the same single-transaction shape.
