# Deferred Work

### DW-1: Calendar vs Timeline date grouping mismatch (UTC vs local)

origin: migrated from legacy ledger ("From: Mood Tracker State Issues (2026-03-20)"), 2026-08-17
location: mood Calendar and Timeline views
reason: The Calendar and Timeline groupings disagreed about which day a mood belongs to because one grouped by UTC date and the other by local date, so the same mood could appear on different days in the two views.
status: done 2026-03-20
resolution: Picked up in A+B patch

### DW-2: Stale visit events on Home dashboard

origin: migrated from legacy ledger ("From: Mood Tracker State Issues (2026-03-20)"), 2026-08-17
location: Home dashboard event cards
reason: The Home dashboard showed visit events that had already passed, because the event cards were hardcoded and had no expiry; the fix was folded into the dynamic events feature rather than patched in place.
status: done 2026-03-20
resolution: Superseded by dynamic events feature (Goal C), tracked as DW-3

### DW-3: Dynamic events system

origin: migrated from legacy ledger ("From: A+B Patch (2026-03-20)"), 2026-08-17
location: Home dashboard event cards
reason: Replace hardcoded home dashboard event cards with user-managed events: new Supabase table, CRUD UI for adding, editing and deleting events, and dynamic timer cards that auto-hide once the event has passed. Full feature build spanning DB migration, service, store slice and UI components, so it was deferred as its own piece of work rather than done inside the A+B patch.
status: open
decision: 2026-08-17 Couple-shared Supabase events table — Build user-managed events backed by Supabase so both partners see the same events. Add a migration creating an `events` table (owner user id, couple/partner visibility, label, event timestamp, optional description, icon kind, created/updated timestamps) with RLS policies matching the pattern used by the existing mood and photo tables, regenerate src/types/database.types.ts, add an events service alongside src/services/, add an `eventsSlice` to src/stores/slices/ and compose it into src/stores/useAppStore.ts, and add a Settings CRUD UI modelled on src/components/Settings/AnniversarySettings.tsx. Then replace the hardcoded `RELATIONSHIP_DATES.visits` render at src/App.tsx:547-555 with store-driven cards, and auto-hide events once they have passed instead of showing "Event passed" (src/components/RelationshipTimers/EventCountdown.tsx:158). Keep the existing birthday and wedding cards working; migrate the two literal visits in src/config/relationshipDates.ts:48-61 as seed data rather than deleting user-visible cards outright. This is the largest of the three options and should be sequenced migration + service + slice first, UI second, if it does not fit one session.

### DW-4: CI never applies migrations to production

origin: migrated from legacy ledger ("From: Mood Duplicate Entries (2026-07-26)"), 2026-07-26
location: .github/workflows/supabase-migrations.yml
source_spec: _bmad-output/implementation-artifacts/spec-mood-duplicate-log-entries.md
reason: Migrations are never applied to production by CI — `.github/workflows/supabase-migrations.yml` only validates them against a throwaway local Supabase, so any schema change the app depends on must be applied by hand or the deployed frontend breaks against an unmigrated database.
status: done 2026-08-17
resolution: already resolved: .github/workflows/deploy.yml:23 adds a `migrate:` job (environment: production) that runs `supabase link --project-ref` (:40) and `supabase db push` (:61) on push to main (:4-5), with `build` gated behind `needs: migrate` (:64) — added by commit 67f73791 "ci: apply Supabase migrations before deploying the frontend" (2026-07-26); supabase-migrations.yml is still PR-only validation, but it is no longer the only path to production.

The workflow is named "Supabase Migration Validation"; its steps are checkout, Setup
Supabase CLI, Start Supabase local, Apply migrations, Validate RLS policies, Check for
security advisories, Stop Supabase, Migration Summary. There is no `supabase link` and no
`supabase db push`, and it triggers only on `pull_request` (paths `supabase/migrations/**`,
`supabase/config.toml`) and `workflow_dispatch` — never on push to main. Confirmed impact:
with the frontend's `on_conflict=user_id,created_at` upsert, a production database lacking
`moods_user_id_created_at_key` rejects every insert with `ERROR: there is no unique or
exclusion constraint matching the ON CONFLICT specification` (reproduced against the local
database by dropping the constraint). Pre-existing condition, not caused by the mood
duplicate-entries story; the constraint was applied to production manually to unblock it.

### DW-5: Pending moods are not scoped to the signed-in user

origin: migrated from legacy ledger ("From: Mood Stale Sync Discards Edit (2026-07-26)"), 2026-07-26
location: src/sw.ts
source_spec: _bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md
reason: Pending moods are not scoped to the signed-in user, so after a sign-out/sign-in on a shared device the service worker uploads the previous user's unsynced moods into the new user's account.
status: done 2026-08-17
resolution: already resolved: src/sw-db.ts:62 `export async function getPendingMoods(userId: string)` filters at :66 `return allMoods.filter((mood) => !mood.synced && mood.userId === userId);` and src/sw.ts:232 calls `getPendingMoods(authToken.userId)` — commit 1b37a76c scoped the worker's read, ebaf370e (2026-08-03) made the param required (closing the omit-to-read-everyone trapdoor) and reset syncStatus on sign-out; regression tests at tests/unit/services/swDbScoping.test.ts:77 "returns only the named user's unsynced rows" and :122 "fails closed rather than open when the owner is missing".

`src/sw.ts` builds its request as `moodSyncPayload(mood, authToken.userId)` — the owner comes
from the stored auth token, not from `mood.userId`. `src/api/auth/actionService.ts` clears the
auth token on sign-out but nothing clears the `moods` object store, and `getPendingMoods()`
(`src/sw-db.ts`) filters only on `!mood.synced`, never on user. So user A's pending mood text
and note are written under user B's `user_id`, and B's partner sees them. Change detection
cannot catch it: `moodSyncFingerprint` deliberately excludes `user_id`
(`src/services/moodSyncPayload.ts`), so the record fingerprints as unchanged and is flagged
clean. Pre-existing — the SW read `authToken.userId` before that story too; the story only
moved the payload construction into a shared module. Likely fix: skip records whose
`mood.userId` does not match the token's user, and clear or reassign the store on sign-out.

### DW-6: updateMood's split-transaction read/write can clobber a freshly synced supabaseId

origin: migrated from legacy ledger ("From: Mood Stale Sync Discards Edit (2026-07-26)"), 2026-07-26
location: src/services/BaseIndexedDBService.ts:181
source_spec: _bmad-output/implementation-artifacts/spec-mood-stale-sync-discards-edit.md
reason: `moodService.updateMood` still reads and writes across two IndexedDB transactions, so a UI edit landing mid-sync can overwrite the `supabaseId` that `markAsSynced` just recorded.
status: open

`markAsSynced` is now a single `readwrite` transaction, but `updateMood` still calls
`super.update`, which is `db.get` at `src/services/BaseIndexedDBService.ts:181` and `db.put` at
`:188` with an `await` between them. If `markAsSynced` commits in that gap, `updateMood` writes
back `{...staleItem, ...updates}` carrying the pre-sync `supabaseId: undefined`, discarding the
server id. The sync lock does not cover this — it serialises sync *batches*, not a plain UI
edit against the service worker's batch. Consequence is a lost server id, not lost data or a
duplicate row: the next pass takes the upsert path and `(user_id, created_at)` resolves it to
the same row. Fix would be giving `updateMood` the same single-transaction shape.
