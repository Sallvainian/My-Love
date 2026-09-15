# Deferred Work

Who may edit what. A run closing its own bundle writes two things here and
nothing else: `status:`/`resolution:` on the entries it actually resolved, and
new entries appended for what it deferred. Everything else -- another entry's
status, reason or severity, and any repair to an entry's `location:` -- belongs
to the orchestrator, because a run has neither the context to judge another
bundle's entry nor a way to tell the next reader it did so. Several entries
below say "this run is directed not to edit the ledger" while sitting in a diff
that closed two entries and appended six; both are true of different edits, and
this paragraph is the distinction they were missing (DW-116).

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
status: done 2026-08-19
resolution: already resolved: All five spec-dynamic-events stories are status: 'done' and the feature merged as PR #268 (a375671): supabase/migrations/20260818000002_create_events_table.sql creates public.events with RLS via get_my_partner_id(), src/types/database.types.ts:55 carries the events row type, src/services/eventsService.ts and src/stores/slices/eventsSlice.ts ship the service and slice (composed at src/stores/useAppStore.ts:7), src/components/Settings/EventsSettings.tsx is the CRUD UI rendered at src/components/Settings/Settings.tsx:161, src/App.tsx:609 filters to non-passed events and :680 maps them as store-driven cards, and `visits` no longer appears anywhere in src/config/relationshipDates.ts.
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
status: done 2026-08-19
resolution: closed by human decision: the two-transaction shape in BaseIndexedDBService.update is still there, but the only consequence is a dropped local supabaseId that moodApi.create's upsert on (user_id, created_at) (src/api/moodApi.ts:83) silently re-resolves to the same row on the next pass — nothing either person can see or lose.

`markAsSynced` is now a single `readwrite` transaction, but `updateMood` still calls
`super.update`, which is `db.get` at `src/services/BaseIndexedDBService.ts:181` and `db.put` at
`:188` with an `await` between them. If `markAsSynced` commits in that gap, `updateMood` writes
back `{...staleItem, ...updates}` carrying the pre-sync `supabaseId: undefined`, discarding the
server id. The sync lock does not cover this — it serialises sync *batches*, not a plain UI
edit against the service worker's batch. Consequence is a lost server id, not lost data or a
duplicate row: the next pass takes the upsert path and `(user_id, created_at)` resolves it to
the same row. Fix would be giving `updateMood` the same single-transaction shape.

### DW-7: handleNetworkError promises "Your changes will be synced when you're back online", which is false for events — there is no offline queue, IndexedDB mirror or retry.
origin: spec-deferred 67d2bdb34631
location: src/api/errorHandlers.ts:94
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: src/api/errorHandlers.ts:94-95 composes that sentence for every offline throw. Pre-existing and repo-wide, not caused by this story: interactionService.ts:111 emits the same text for partner interactions, which are equally Supabase-only (AGENTS.md:65). eventsService's module header already routes EventWriteError around the helper for exactly this reason; the offline guards still use it because the story's Boundaries mandate moodApi's idiom verbatim.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-offline-message-honesty
resolution-undo: 5c46b35490321cbf6fdd6bc5255a477608d829bd27ecbf075ab278ce08b5c8f2 2026-08-19 7374617475733a206f70656e

### DW-8: A CHECK-constraint violation (23514) is unmapped, so an over-length label or description reaches the user as raw Postgres constraint text.
origin: spec-deferred d44dacbe0efd
location: src/api/errorHandlers.ts:62
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: The errorMessages map in src/api/errorHandlers.ts:62-70 covers 23505, 23503, 23502, 42501, 42P01, PGRST116 and PGRST301 — no 23514 — so the fallback `Database error: ${error.message}` applies. The table enforces char_length(label) <= 100 and char_length(description) <= 500, and nothing rejects a blank label (char_length('') = 0 passes). Input validation belongs to story 5's form; story 1's triage log already carried the blank-label observation forward to that story.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-check-constraint-error-mapping
resolution-undo: cb693b6131bc19853836c66541daaed38f371857c1a417872aed38cbb28440ec 2026-08-19 7374617475733a206f70656e

### DW-9: eventsService.getEvents applies no limit or pagination.
origin: spec-deferred 25448caba914
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: integration-points.md section 1 names photoService.getPhotos(limit = 50, offset = 0) as the signature shape to mirror, and moodApi caps its reads. The read grows with the couple's whole event history. Harmless at a couple's scale today, and a limit would interact with the soonest-first ordering.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-read-cap-and-pagination
resolution-undo: 529326357e46ff317c67b4b965b0aadeeac222881428309d7abbd8fad3749743 2026-08-19 7374617475733a206f70656e

### DW-10: Two events on the same date have no deterministic order.
origin: spec-deferred 3c6d3601f0c8
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: The read orders on event_date alone, and Postgres leaves ties unspecified, so same-day cards can swap position between reloads. A secondary key such as created_at would fix it.
status: done 2026-08-19
resolution: already resolved: src/services/eventsService.ts:261 adds `.order('created_at', { ascending: true })` after the event_date order, with the comment at :258-260 naming DW-10 by id — commit 44188ba 'fix(events): pin same-day event order with a created_at tiebreak'; src/stores/slices/eventsSlice.ts:69 mirrors the same tiebreak client-side so a write holds the server's position.

### DW-11: Overlapping loadEvents calls are last-writer-wins; the guard compares userId only.
origin: spec-deferred 27d87ebc0b13
location: src/stores/slices/eventsSlice.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: The identity guard catches an account switch but not two in-flight loads for the same account, where an older response can overwrite a newer list. No caller triggers this yet — nothing mounts loadEvents until story 3 — so the state is currently unreachable.
status: done 2026-08-19
resolution: already resolved: src/stores/slices/eventsSlice.ts:87 declares a module-scoped monotonic `latestLoadId`, :112 captures `const loadId = ++latestLoadId` per call, and both the success path :125 and the error path :134 bail with `if (loadId !== latestLoadId) return;` — so a superseded same-user load abandons its own resolution. Commit 0417813 'fix(events): abandon a stale same-user load instead of racing the newer one'.

### DW-12: A double-submitted addEvent creates two rows.
origin: spec-deferred 3ef25a69c45f
location: src/stores/slices/eventsSlice.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Deliberate at the data layer: public.events carries no idempotency_key column and no UNIQUE constraint, so AGENTS.md:59's retryable-INSERT rule has nothing to key on and the story forbids automatic retry. Guarding a double submit is story 5's form (disable the button while the write is open).
status: done 2026-08-19
resolution: already resolved: The events form's submit button carries `disabled={isSaving}` at src/components/Settings/EventsSettings.tsx:812 (data-testid `events-form-submit` at :813) — the exact guard this entry assigned to story 5's form — added by commit dab5142 'feat(settings): manage events from Settings'; Cancel is disabled the same way at :803.

### DW-13: EventWriteError is unexported and EventWriteResult carries no machine-readable code, so callers must string-match English prose to tell "not yours" from a transport failure.
origin: spec-deferred 87c45d388242
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Story 5's UI needs different affordances for the two outcomes (refresh the list vs retry the write). The shape mirrors photosSlice's PhotoUploadResult, which has the same limitation, so changing it is a cross-slice decision.
status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-write-error-codes
resolution-undo: a56e133f78fb9ed825473b5a7526f95d98b1b0ae337b60eaae078e8a484b671c 2026-08-20 7374617475733a206f70656e
decision: 2026-08-19 Add a code to events only — Export EventWriteError from src/services/eventsService.ts and widen EventWriteResult in src/stores/slices/eventsSlice.ts to carry a machine-readable discriminant — at minimum separating 'not yours / not found' from 'offline' from 'transport failure' — then switch src/components/Settings/EventsSettings.tsx off prose matching onto that code, choosing refresh-the-list versus retry-the-write affordances from it. Leave photosSlice's PhotoUploadResult exactly as it is and record in the eventsSlice module header that the two shapes now diverge deliberately, so a future reader does not 'restore' the symmetry.

### DW-14: A persisted blob that already contained an events key would be rehydrated; only moods is stripped on read.
origin: spec-deferred 09851f20d430
location: src/stores/useAppStore.ts:120
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: useAppStore.ts:111 records that partialize "stops NEW writes, but it does not govern reads", which is why the adapter deletes data.state.moods at :120-123. Verified by writing the assertion: it fails today. Not fixed here because the state is unreachable — no build has ever written events to localStorage, so unlike moods there is no installed base of bad blobs. It would become real only if a later story added events to partialize and then removed it again.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-persisted-events-key-strip
resolution-undo: ddb7df62ab97dd5914d84da1658d2bfa011c9cce356a202cdd1b9be1033c6c85 2026-08-19 7374617475733a206f70656e

### DW-15: A row with an unparseable event_date is silently dropped from the list with only a console.error; nothing surfaces to eventsError or any user-visible state.
origin: spec-deferred 27703d86d257
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: toCoupleEvent (src/services/eventsService.ts) logs '[EventsService] Skipping event with unreadable event_date' and returns null on an unparseable date, and getEvents filters those nulls out with no further signal. Verified unreachable via any app-originated write today: createEvent and updateEvent both call parseEventDate on the input and throw EventWriteError before issuing any request, so only a direct SQL write (e.g. a literal 'infinity', which a Postgres date column accepts) could produce such a row.
status: done 2026-08-19
resolution: closed by human decision: unreachable — createEvent (eventsService.ts:311) and updateEvent (:387) both reject an unparseable date before any write, so only direct SQL could create the row this branch drops.

### DW-16: A CHECK-constraint violation (23514) — including a blank or over-length label/description — is unmapped, so it reaches the user as raw Postgres text.
origin: spec-deferred f5a93068dc47
location: src/api/errorHandlers.ts:62
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: Re-surfaced by this review pass's edge-case and blind-hunter layers; re-verified unchanged since the prior pass. The errorMessages map in src/api/errorHandlers.ts has no entry for 23514, so the generic 'Database error: ${message}' fallback applies. The table enforces char_length(label) <= 100 and char_length(description) <= 500, and nothing client-side rejects a blank label. Input validation is assigned to story 5's form.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-check-constraint-error-mapping
resolution-undo: cb693b6131bc19853836c66541daaed38f371857c1a417872aed38cbb28440ec 2026-08-19 7374617475733a206f70656e

### DW-17: Overlapping loadEvents calls are last-writer-wins; the identity guard compares userId only.
origin: spec-deferred d1a10b88a17a
location: src/stores/slices/eventsSlice.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. Two in-flight loads for the same account are not distinguished by the guard, so an older response can overwrite a newer list. No caller triggers this yet — nothing mounts loadEvents until story 3.
status: done 2026-08-19
resolution: already resolved: Verbatim re-file of DW-11 and fixed by the same change: src/stores/slices/eventsSlice.ts:87 declares the monotonic `latestLoadId`, :112 captures it per call, and :125 and :134 abandon a superseded same-user load's resolution. Commit 0417813 'fix(events): abandon a stale same-user load instead of racing the newer one'.

### DW-18: handleNetworkError's offline message promises a sync that cannot happen for events.
origin: spec-deferred a118de54f9a8
location: src/api/errorHandlers.ts:94
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. src/api/errorHandlers.ts composes "Your changes will be synced when you're back online" for every offline throw; events have no offline queue, IndexedDB mirror or retry. Pre-existing and repo-wide (interactionService.ts emits the same text for partner interactions).
status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-offline-message-honesty
resolution-undo: 5c46b35490321cbf6fdd6bc5255a477608d829bd27ecbf075ab278ce08b5c8f2 2026-08-19 7374617475733a206f70656e

### DW-19: EventWriteError is unexported and EventWriteResult carries no machine-readable code, so callers must string-match English prose to distinguish outcomes.
origin: spec-deferred 5652fe1c2471
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. Story 5's UI will need different affordances for different failure kinds (refresh vs retry); the shape mirrors PhotoUploadResult's same limitation.
status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-write-error-codes
resolution-undo: a56e133f78fb9ed825473b5a7526f95d98b1b0ae337b60eaae078e8a484b671c 2026-08-20 7374617475733a206f70656e

### DW-20: Persistence omission from partialize only prevents new writes; a pre-existing persisted blob with an events key would still rehydrate.
origin: spec-deferred 0f9e6e1214d8
location: src/stores/useAppStore.ts:120
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. useAppStore.ts records that partialize "stops NEW writes, but it does not govern reads", which is why moods is stripped on read but events is not. Unreachable today since no build has ever written events to localStorage.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-persisted-events-key-strip
resolution-undo: ddb7df62ab97dd5914d84da1658d2bfa011c9cce356a202cdd1b9be1033c6c85 2026-08-19 7374617475733a206f70656e

### DW-21: Overlapping loadEvents() calls from rapid Home revisits have no in-flight/sequence guard, so an out-of-order response could show stale data for a moment.
origin: spec-deferred 5c30b7108a47
location: src/stores/slices/eventsSlice.ts:84-110
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: eventsSlice.ts:84-110 (story 2, unchanged by this story) sets `events` unconditionally on success with no request-ordering check. Story 2's own deferred list already flagged this exact race as low severity and "unreachable... until story 3" — story 3's new useEffect in App.tsx is what makes it reachable for the first time, by calling loadEvents() on every return to Home. Fixing it means touching eventsSlice.ts, which is outside this story's Code Map/Tasks.
status: done 2026-08-19
resolution: already resolved: Story 3's Home effect (src/App.tsx:432 `void loadEvents()`) is the caller this entry said would make the race reachable, and the race is now guarded: src/stores/slices/eventsSlice.ts:87/:112/:125/:134 carry the monotonic `latestLoadId` so an out-of-order response is discarded rather than painted (commit 0417813). Story 5's spec cites the same fix at 5-manage-events-in-settings.md:144 — 'eventsSlice.ts:87,112,125 carries a monotonic latestLoadId so a superseded load abandons its own resolution'.

### DW-22: No cap or pagination on the events rendered on Home; the right-hand grid column grows unbounded against the fixed 2-card birthdays column.
origin: spec-deferred b8c2e0998b06
location: src/App.tsx (upcomingEvents.map)
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: Extends story 2's own already-deferred "eventsService.getEvents applies no limit or pagination" item to the render layer. The codebase has a precedent for capping a similar list (`CountdownTimer anniversaries={...} maxDisplay={3}`, cited in integration-points.md:117), not applied here. Harmless at a couple's scale today.
status: done 2026-08-19
resolution: resolved by sweep bundle dw-events-read-cap-and-pagination
resolution-undo: 529326357e46ff317c67b4b965b0aadeeac222881428309d7abbd8fad3749743 2026-08-19 7374617475733a206f70656e

### DW-23: EventCountdown's data-testid is derived from label text with no uniqueness guarantee, so a future user-created event labeled "Wedding" would collide with the fixed Wedding card's testid.
origin: spec-deferred 17f1ada12518
location: src/components/RelationshipTimers/EventCountdown.tsx
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: EventCountdown.tsx's `data-testid={"event-countdown-" + label.toLowerCase().replace(/\s+/g,'-')}` is pre-existing, unchanged by this diff. Unreachable today since events aren't user-creatable until story 5's CRUD ships; becomes a real risk once it does.
status: done 2026-08-19
resolution: closed by human decision: the testid is read only by Playwright specs that already avoid the collision by convention (tests/e2e/settings/events-crud.spec.ts:30-32); React keys on event.id, so a duplicate label renders two correct cards and costs the users nothing.

### DW-24: No test renders App.tsx at all, so its composition is exercised only by Playwright and a green `npm run test:unit` says nothing about it.
origin: spec-deferred 657f5db9659f
location: src/App.tsx
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: Grepped every test file for an import of `src/App`: no match. App.tsx's filter + getEventsSlotView call + JSX ternary + loadEvents effect are covered only by tests/e2e/home/events.spec.ts, which needs `supabase start`. Pre-existing: App.tsx has never had a unit or component test, and this story did not introduce the gap. Adding one means bringing a store-and-auth-mocking harness into scope.
status: done 2026-08-19
resolution: closed by human decision: App.tsx's composition is covered in CI by tests/e2e/home/events.spec.ts and its only extracted logic is unit-tested at EventCountdown.test.tsx:209-253, so the missing component test buys nothing for the cost of a store-and-auth mocking harness.

### DW-25: Follow-up review still recommended for 3 after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260818-153303-cf19; this entry preserves the lingering recommendation for a deliberate later review.
status: done 2026-08-19
resolution: closed by human decision: Story 3's code was independently reviewed after the cap was spent: PR #268 merged 2026-08-19 with a claude review comment and five successful claude-code-review runs, and this sweep re-verified its deferred findings against the current tree.
decision: 2026-08-19 Close — since reviewed in PR #268 — Story 3's code was independently reviewed after the cap was spent: PR #268 merged 2026-08-19 with a claude review comment and five successful claude-code-review runs, and this sweep re-verified its deferred findings against the current tree.

### DW-26: A save that fails while the first load is still in flight makes the list paint a false "we couldn't load your events" notice after that load succeeds.
origin: spec-deferred 110da53662a7
location: src/components/Settings/EventsSettings.tsx (load effect) + src/stores/slices/eventsSlice.ts
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: The load-failure flag is read once from the shared `eventsError` key in loadEvents()'s .finally, and `addEvent` writes its own failure into that same key (eventsSlice.ts, addEvent catch tail). The header Add button renders before the load settles, so a save can fail inside the load's flight window and leave the key non-null when the successful load reads it. The list itself still renders correctly; only the notice is wrong. The root cause is that one `eventsError` key serves loads and all three writes with no per-call token, which lives in eventsSlice.ts — a file this story's Never list forbids editing.
status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-error-attribution
resolution-undo: 967f607d893782fd21a702cf860f2384988b9ba6aceeda5267c395049534142b 2026-08-20 7374617475733a206f70656e

### DW-27: Once the Settings events load fails, nothing re-fires it: the notice and the empty list persist until the user reloads the page.
origin: spec-deferred 289bbe236935
location: src/components/Settings/EventsSettings.tsx (load effect deps)
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: The mount effect's deps are [userId, loadEvents]. App.tsx's otherwise identical Home effect deliberately adds isOnline, commented "coming back online re-fires the load, so the offline error card clears without leaving Home." There is no retry control, and clearEventsError (exported from eventsSlice.ts) still has zero production callers. This story's intent-contract specifies "A mount effect keyed on `userId`", so closing the gap means widening what the intent asked for.
status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-settings-load-retry
resolution-undo: 433cb6cdb4b7a3a109c2c9469796fa50d337228f20bc12a5857dcfafb8a9ccf3 2026-08-20 7374617475733a206f70656e

### DW-28: The three primary buttons this section adds are white text on `bg-pink-500`, which measures 3.58:1 against the 4.5:1 WCAG AA requirement.
origin: spec-deferred d52fd5748eef
location: src/components/Settings/EventsSettings.tsx:255, :296, :813 (root cause: the shared bg-pink-500 button style, 17 sites in 9 files)
source_spec: `5-manage-events-in-settings.md`
severity: medium
reason: Measured twice and independently. The parked axe run at `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` reports impact "serious" on `events-settings-add` and `events-form-submit` -- "insufficient color contrast of 3.58 (foreground color: #ffffff, background color: #f6339a ... Expected contrast ratio of 4.5:1". Computing the relative luminance of #f6339a by hand gives (1.0 + 0.05) / (0.24294 + 0.05) = 3.58, the same number. A third instance nobody scanned carries the identical class string: `events-settings-empty-add` at EventsSettings.tsx:296. The axe scaffold seeds a row before every scan, so the empty state never renders and that button was never measured -- a developer following the checklist, which lists only :255 and :813, ships two fixed buttons and one unfixed one. The root cause is not this story's markup. `grep -rn "bg-pink-500" src/ | grep -c "text-white"` is 17, across 9 files, including the sibling AnniversarySetting
status: done 2026-08-20
resolution: resolved by sweep bundle dw-pink-primary-button-contrast
resolution-undo: 1f1ce66048fcb7a2fbfadd78a511a0aa0175348f683c99cc90ca35cd1aef7178 2026-08-20 7374617475733a206f70656e
decision: 2026-08-19 Darken the shared token app-wide — Move every white-on-pink primary button to a darker pink across all 17 sites in 9 files so the app stays visually uniform and passes AA everywhere at once. Pick the shade by measurement rather than assumption — Tailwind v4 resolves its palette through oklch, so pink-500 renders as #f6339a rather than the v3 hex, and the chosen replacement must be re-measured against white to confirm it clears 4.5:1 before the change lands. Include EventsSettings.tsx:296, the empty-state Add button the axe scaffold never reaches, and extend the parked accessibility scan so the empty state is scanned too. This changes the app's primary button colour on every screen, so confirm the new shade looks right in both light and dark mode.

### DW-29: A write that lands while the first load is still in flight is discarded by that load, so a saved edit or a new event silently reverts on screen.
origin: spec-deferred a015b45b45be
location: src/stores/slices/eventsSlice.ts (loadEvents resolution) exposed by src/components/Settings/EventsSettings.tsx
source_spec: `5-manage-events-in-settings.md`
severity: medium
reason: `loadEvents` replaces the list wholesale on resolution -- `set({ events, eventsIsLoading: false })` at eventsSlice.ts, guarded only by `latestLoadId` against other loads, never against writes. `addEvent` / `editEvent` mutate `events` in place the moment their own request resolves. So a write that resolves inside the load's flight window is overwritten by the server list the load captured before that write landed. The reachable form is not the empty-list one. `slot` is `'list'` whenever `events.length > 0`, and `events` survives view changes -- so a user who loads Home (App's effect populates `events`) and then opens Settings sees a fully rendered list with Edit and Delete live while EventsSettings' own mount load is still outstanding. An edit accepted in that window reverts visually when the load resolves, and the row is durably changed on the server, so nothing on screen says a write succeeded. This is the success-path twin of DW-26, and it has the same root cause and the same blocker
status: done 2026-08-20
resolution: resolved by sweep bundle dw-events-error-attribution
resolution-undo: 967f607d893782fd21a702cf860f2384988b9ba6aceeda5267c395049534142b 2026-08-20 7374617475733a206f70656e

### DW-30: Roughly 4,000 lines of measured tests shipped in this change set are matched by no test runner and execute nowhere.
origin: spec-deferred cb64960af166
location: _bmad-output/test-artifacts/ (9 test files, 23 tests)
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: `_bmad-output/test-artifacts/` holds 6 ATDD scaffolds and 3 automation files. `vitest.config.ts` includes only `tests/**` and `src/**`, and Playwright's three projects set testDir to `./tests/e2e`, `./tests/api` and `./tests/integration`, so nothing reaches them. Both TEA summaries say so plainly ("Nothing here is active until it is moved") and record the `git mv` commands that would activate them, along with measurements taken by copying each file to its target, running it, and removing it again. Two of the three defects this review confirmed were first surfaced by that parked tree, so the coverage is real rather than speculative. Activation is a deliberate operator decision, not a patch: `automation-summary.md` measures typecheck at 6 TS2883 errors without the generated files and 1 with them, so acceptance criterion 3 -- which pins the literal number six -- becomes false the moment the activation happens, and the one-line fix the summary proposes at `tests/support/merged-fixtures.ts:
status: done 2026-08-20
resolution: resolved by sweep bundle dw-activate-parked-event-tests
resolution-undo: 17ce3b66d18c0b51d563a4a8722d775298fe4d3f3192f08273b06052a5fbaf4f 2026-08-20 7374617475733a206f70656e
decision: 2026-08-19 Activate the parked tests — Run the git mv sequence recorded at automation-summary.md:594-600, helper first, then remove the test.skip markers each file's header and the ATDD checklist enumerate. Apply the one-line tests/support/merged-fixtures.ts fix the summary proposes, then rewire the six other files onto tests/support/helpers/events.ts as automation-summary.md:616 describes. Measure typecheck before and after rather than trusting the recorded numbers — the six-error TS2883 baseline is recorded as an artifact of the loop's worktree layout and this repo is not a worktree — and update story 5's acceptance criterion 3 in the same change so it no longer pins a count the activation invalidates. Every activated file must actually run and pass in its new home before the change is finished.

### DW-31: markAsViewed resolves successfully when its UPDATE matches zero rows, so a row the caller may not update is reported as marked.
origin: spec-deferred 1a8de2676ad0
location: src/api/interactionService.ts:379
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
reason: The UPDATE policy is `USING (auth.uid() = to_user_id)` (supabase/migrations/20251206024345_remote_schema.sql:316-321), so RLS filters a non-recipient's update into a zero-row success with no error. src/api/interactionService.ts:379-400 checks only `error`, never the row count, and interactionsSlice.markInteractionViewed then decrements unviewedCount regardless. This is the same silent-RLS class eventsService guards with 'Event not found or not yours to edit' (src/services/eventsService.ts:413). Not reachable through today's UI: handleAnimationComplete only passes rows from getUnviewedInteractions, which already filters toUserId === userId. Pre-existing; untouched by this change.
status: done 2026-08-19
resolution: closed by human decision: the only caller passes ids already filtered to rows the signed-in user received, so the UPDATE can never match zero rows, and the count it guards is ephemeral anyway.

### DW-32: getInteractionHistory, getUnviewedInteractions and markAsViewed have no isOnline() guard, so an offline caller gets a mid-flight message.
origin: spec-deferred 1effec975be0
location: src/api/interactionService.ts:282
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
reason: Only sendInteraction guards (src/api/interactionService.ts:156). The other three go straight into the try, so offline they surface '[InteractionService.<method>] Network error: Failed to fetch. Check your internet connection.' rather than naming the offline state. Truthful either way after this change, so this is specificity, not honesty. Adding guards is new behavior and was excluded by this spec's Never list.
status: done 2026-08-19
resolution: closed by human decision: every caller of these three methods discards the error, so the less-specific offline wording is never shown to either person.

### DW-33: The write-error class and networkFailure builder now exist in two copies, one per Supabase-only feature.
origin: spec-deferred fb1db7ca9280
location: src/api/interactionService.ts:76
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
reason: src/services/eventsService.ts:108-127 and src/api/interactionService.ts:53-79 carry the same class shape and a byte-identical networkFailure body. Copying was what the intent asked for ('the same treatment eventsService applied'), but a third Supabase-only feature would make extraction worth doing. eventsService.ts:120-122 already records that rewording the shared helper is cross-feature work.
status: done 2026-08-19
resolution: closed by human decision: pure source duplication with byte-identical behavior (eventsService.ts:124-127 and interactionService.ts:76-79), invisible to both users, and the entry's own extraction trigger — a third Supabase-only feature — has not occurred.

### DW-34: The new interactionService test file covers the failure surface only; the success paths of the three read/update methods stay untested.
origin: spec-deferred 498cf9493c5a
location: tests/unit/api/interactionService.test.ts:129
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
reason: tests/unit/api/interactionService.test.ts asserts happy paths for sendPoke/sendKiss only. getInteractionHistory, getUnviewedInteractions and markAsViewed appear solely in rejection tests, and the fake builder's or(), order() and range() are deliberate no-ops, so the history read's predicate, ordering and pagination are not exercised at all. Those methods are unchanged by this diff, so the gap is pre-existing rather than introduced.
status: done 2026-08-19
resolution: already resolved: The three success paths now have their own describes: tests/unit/api/interactionService.test.ts:335 "describe('getInteractionHistory — what the read actually returns', () => {" with :360 "it('returns interactions in both directions and nobody else’s'", :366 "it('returns the newest first'", :372 "it(

### DW-35: subscribeInteractions has no error handling — a failed subscribe only logs its status and the returned unsubscribe still looks healthy.
origin: spec-deferred 0f06e1c320a7
location: src/api/interactionService.ts:225
source_spec: `spec-dw-7-18-events-offline-message-honesty.md`
severity: low
reason: src/api/interactionService.ts:253-255 passes a logger into .subscribe() and never surfaces CHANNEL_ERROR or TIMED_OUT to the caller. It also calls supabase.channel() directly, which AGENTS.md already records as a repo-wide teardown pitfall; the missing error path is the half AGENTS.md does not cover. Unchanged by this diff.
status: done 2026-08-20
resolution: resolved by sweep bundle dw-interaction-subscribe-error-surfacing
resolution-undo: 2b166d2a835fd67e36fae399847dd6a6dbf4ddc63c28d08a577652ead0c14b78 2026-08-20 7374617475733a206f70656e

### DW-36: The SQLSTATE lookup walks Object.prototype, so a code of toString, constructor, valueOf or hasOwnProperty returns an inherited function and renders it to the user as the error message.
origin: spec-deferred d3c350f0c7d6
location: src/api/errorHandlers.ts:72
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
reason: `errorMessages` is a bare object literal (src/api/errorHandlers.ts:62) and the lookup is `errorMessages[error.code] || ...` (:72), both unchanged by this story. Measured with node against a literal of the same shape: code 'toString' yields "function toString() { [native code] }", 'constructor' yields "function Object() { [native code] }", and '__proto__' yields "[object Object]". Each is truthy, so the fallback never runs and the string is interpolated straight into the user-facing message. `Object.hasOwn(errorMessages, error.code)` or `Object.create(null)` closes it. error.code comes from the response body, and tests/e2e/settings/events-crud.spec.ts:413-425 shows arbitrary PostgREST bodies are injectable.
status: done 2026-08-19
resolution: closed by human decision: reaching the prototype walk needs a server-sent `error.code` of `toString`/`constructor`/`__proto__`, but every code reaching errorHandlers.ts:73 comes off a PostgREST body (five-char SQLSTATE or PGRSTnnn) and nothing in src/ builds a PostgrestError by hand — the only demonstrated route is a Playwright route stub.

### DW-37: Sibling SQLSTATEs that also carry raw Postgres text are still unmapped, so the same leak class this story closed for 23514 remains open for them.
origin: spec-deferred 4115baed8bbf
location: src/api/errorHandlers.ts:62-70
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: medium
reason: After this change the map covers 23505, 23503, 23502, 23514, 42501, 42P01, PGRST116 and PGRST301. Still falling through to `Database error: ${error.message}`: 22001 (string data right truncation), 22007 and 22P02 (invalid input syntax, which render the rejected literal verbatim), 23P01, 40001, 57014, PGRST202 and PGRST204. public.events.event_date is `date not null` (supabase/migrations/20260818000002_create_events_table.sql:20), so a malformed date is a 22007 on a live column.
status: done 2026-08-19
resolution: closed by human decision: every listed SQLSTATE is unreachable in this app — no varchar(n) and no exclusion constraints in the schema, dates validated client-side before the request (eventsService.ts:313, :388), no .rpc() call routed through handleSupabaseError, and deploy.yml:91 gates build behind migrate — and the worst outcome is ugly-but-truthful text shown only to th

### DW-38: Four CHECK-carrying write paths never reach handleSupabaseError, so the SQLSTATE map cannot protect them however many codes it maps.
origin: spec-deferred 613aa9858056
location: src/services/photoService.ts, src/services/scriptureReadingService.ts, src/api/partnerService.ts, src/stores/slices/notesSlice.ts
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: medium
reason: Only three modules import handleSupabaseError (measured with `grep -rln handleSupabaseError src/`): src/api/moodApi.ts:14, src/api/interactionService.ts:23, src/services/eventsService.ts:39. The non-adopters each handle rejections themselves: photoService.ts rethrows the raw insertError, scriptureReadingService.ts interpolates `Failed to submit reflection: ${error.message}`, notesSlice.ts swallows the error into a flag, and partnerService.ts throws hand-written Errors. The CHECK constraints on photos (20251203190800_create_photos_table.sql:18,24), scripture ratings (20260128000001_scripture_reading.sql:65), love_notes and partner_requests (20251206024345_remote_schema.sql:93,105,109,113) sit behind those paths. Pre-existing routing, not introduced here.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-check-error-path-consistency
resolution-undo: e6195a259cb9d15982632c3e6d4cddb9316f11afe7e8f29ae8f4aac5e9a2e827 2026-09-11 7374617475733a206f70656e

### DW-39: A PostgrestError with a missing or empty message takes the fallback and surfaces the bare string "Database error: " with nothing after the colon.
origin: spec-deferred e9534049eabc
location: src/api/errorHandlers.ts:72
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
reason: The fallback at src/api/errorHandlers.ts:72 interpolates error.message unconditionally. tsconfig.app.json sets no noUncheckedIndexedAccess, so an absent code is typed as string and silently takes the same branch. Nothing in the repo covers either case. Pre-existing; the new tests scope to 23514 per the story intent.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-empty-database-error-fallback
resolution-undo: e3a692278d474f40ee244679eb6d6ad33513dc3e08354984bb02e9c81c6da4b3 2026-09-11 7374617475733a206f70656e

### DW-40: SoloReadingFlow.test.tsx is flaky under the full suite, failing about one run in five while passing in isolation.
origin: spec-deferred ef241b3821d3
location: src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx
source_spec: `spec-dw-8-16-check-constraint-error-mapping.md`
severity: low
reason: Measured during this story's verification. `npm run test:unit` was run five times: four reported 91 files / 1358 tests passed; one reported "1 failed | 1357 passed" on "SoloReadingFlow > Story 2.3: Daily Prayer Report > treats partner as complete when session-level reflection exists". The file run alone (`npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`) passed 113/113 three times consecutively. This story touches only src/api/errorHandlers.ts and tests/unit/api/errorHandlers.test.ts, neither of which SoloReadingFlow imports.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-solo-report-test-synchronization
resolution-undo: 1fab1f23a7e64ee869a98f06387b24c37f5d019856a0b920ead1e0a39c18af1f 2026-09-11 7374617475733a206f70656e

### DW-41: Settings has no way to reach events the read cap truncates, so past roughly 50 past events the oldest ones become uneditable from the UI.
origin: spec-deferred 9ee0fff5525a
location: src/components/Settings/EventsSettings.tsx, src/stores/slices/eventsSlice.ts:116
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: medium
reason: `EventsSettings.tsx` renders the store array unfiltered and calls `loadEvents()` with no arguments; `eventsSlice.loadEvents` calls `eventsService.getEvents()` bare, so both windows take the default `limit = 50, offset = 0`. Measured with `grep -rn "getEvents(" src tests`: the only production call site is `src/stores/slices/eventsSlice.ts:116`. The screen's own comment states why the list must stay unfiltered — a mistyped year is "the only place a mistyped year can be seen and corrected" — and a year typed wrong into the deep past is exactly the row the descending past window drops first. This change documents the bound in both files; closing it needs a "load more" control and a `loadEvents` that takes limit/offset, which the spec's Boundaries put out of scope.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-41
resolution-undo: 11a3495e84f703f2c798e725ed4ccea80dcb1f63e9048f8904475ed7271cc247 2026-09-12 7374617475733a206f70656e
decision: 2026-09-12 Build Settings pagination — Add an explicit Settings history-loading control with store/service paging and a reliable indication that more rows exist. Preserve Home's upcoming-event behavior, ownership guards, and mutation replay, and prove that an event beyond 50 past rows can be loaded and edited. Coordinate the associated visibility and metadata behavior described by DW-44 and DW-46.
decision: 2026-09-11 Keep pagination deferred
decision: 2026-09-11 Defer pagination

### DW-42: A row whose date cannot be parsed still consumes a slot inside the capped window before it is dropped client-side, so garbage can push a real event off the page.
origin: spec-deferred 6ae6d93ad3e8
location: src/services/eventsService.ts
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
reason: `getEvents` caps in the database (`.range`) and drops unreadable rows in JS afterwards (the `toCoupleEvent`/`filter` pair), so an `event_date` of `infinity` — a value a Postgres `date` column accepts, and which `parseEventDate` is written to reject — counts against `limit` and returns one fewer usable event. The covering test for unreadable rows runs at the default limit of 50, where the effect is invisible. Same shape as `photoService.getPhotos`, which also caps server-side and filters after. Closing it means over-fetching and re-capping client-side.
status: done 2026-09-12
resolution: closed by human decision: Retain the strict raw-row read budget and accept that dates rejected during conversion can leave a partially filled page.
decision: 2026-09-12 Accept sparse capped pages — Retain the strict raw-row read budget and accept that dates rejected during conversion can leave a partially filled page.

### DW-43: Three separate literals encode the single product decision "how many countdown cards a column shows".
origin: spec-deferred 9fcc81a217ea
location: src/App.tsx, src/components/DailyMessage/DailyMessage.tsx:366, src/utils/countdownService.ts:49
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
reason: `HOME_MAX_EVENT_CARDS = 3` in `src/App.tsx`, `maxDisplay={3}` passed at `src/components/DailyMessage/DailyMessage.tsx:366`, and `count: number = 3` in `getUpcomingAnniversaries` (`src/utils/countdownService.ts:49-51`). The new constant's JSDoc cites the other two as its precedent but does not share a value with them, so changing the product decision means finding all three. Unifying them is a cross-feature refactor the intent does not reach.
status: done 2026-09-12
resolution: closed by human decision as obsolete: Commit 32c583f8fe021a93a74e11c91aefbde77835ca8c intentionally raised Home to six event cards while anniversary countdowns retain three (src/App.tsx:84-93; src/components/DailyMessage/DailyMessage.tsx:366; src/utils/countdownService.ts:51). These are distinct display choices, so the original single-limit consolidation is no longer needed. No runtime change.
decision: 2026-09-12 Close as obsolete — Preserve six Home event cards and three anniversary countdowns; do not unify the limits.

### DW-44: An event saved with a date beyond the past read window appears in Settings immediately and then silently disappears on the next load.
origin: spec-deferred 6e4344fda920
location: src/stores/slices/eventsSlice.ts (addEvent), src/components/Settings/EventsSettings.tsx
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: medium
reason: Verified path, both halves read this session: `eventsSlice.addEvent` inserts the created row into the store unconditionally — `set((state) => ({ events: sortByDate([...state.events, created]) }))` — while `loadEvents` re-reads a bounded window (`getEvents()` bare, so `limit = 50` per side). A couple with more than 50 past events who corrects or adds a deep-past date therefore sees the row in Settings, and the next `loadEvents()` drops it because the descending past page no longer reaches it. The row is not lost — it is in the table — only invisible. Distinct from the "no way to reach truncated rows" item: that one is about rows the user never sees, this one is about a row the user just saw confirmed. Closing it needs the same "load more" plumbing, or an in-range check at save time.
status: done 2026-09-12
resolution: already resolved: Commit 690cfcad3c4a248856e34dd778c73bb09bf70d78 (2026-09-12) implements the approved saved-row reachability: src/stores/slices/eventsSlice.ts:245 appends history pages and :307/:336 records successful add/edit upserts; src/components/Settings/EventsSettings.tsx:609 exposes the partial-list notice and Load more history control. tests/e2e/settings/events-history-pagination.spec.ts:55 and :93 cover editing and adding beyond 50 past rows, reloading, loading history, and editing saved values again. Reload returns to initial windows, with an explicit path back to saved rows, as approved and documented at _bmad-output/implementation-artifacts/spec-dw-41-settings-event-history-pagination.md:102.
decision: 2026-09-12 Preserve saved-row access — Add Settings paging and post-save reconciliation that keeps an out-of-window saved event reachable after reload without rejecting valid past dates. Coordinate the history-loading path with DW-41 and truncation metadata with DW-46, preserving bounded Home reads and session ownership. Verify adding and editing a row beyond 50 past events, then reloading and locating it for another edit.
decision: 2026-09-11 Keep pagination deferred
decision: 2026-09-11 Defer pagination

### DW-45: The two-window read is two requests, so a row whose date is edited across today between them can come back in neither page, or come back as the pre-edit copy.
origin: spec-deferred b8ca2f59b73d
location: src/services/eventsService.ts (getEvents merge)
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
reason: `getEvents` issues the upcoming and past windows through `Promise.all` and reconciles only the "returned by BOTH" case, dropping one copy to avoid a duplicate React key. Two other outcomes exist and are now named in the code comment: the row lands in NEITHER page (past answered before the edit, upcoming after, or the reverse), and the copy kept is the pre-edit one, so an already-passed event renders as upcoming. Both need a partner editing an event across today's boundary during a load, and both correct themselves on the next `loadEvents()`. Closing either means abandoning the two-window read for a single request — the shape the Design Notes deliberately chose against — or comparing `updated_at` between copies, which the column supports but is client-maintained (`20260818000002_create_events_table.sql`, comment on `public.events.updated_at`).
status: done 2026-08-19
resolution: closed by human decision: Both outcomes need a partner editing an event across today's boundary during a load and both correct themselves on the next loadEvents(); eventsService.ts:369-380 already names them in place for the next reader.
decision: 2026-08-19 Accept the race as documented — Both outcomes need a partner editing an event across today's boundary during a load and both correct themselves on the next loadEvents(); eventsService.ts:369-380 already names them in place for the next reader.

### DW-46: Neither window requests a row count, so nothing can tell that truncation happened — which the deferred "load more" control would need.
origin: spec-deferred 3eedd014be6b
location: src/services/eventsService.ts (both window queries)
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
reason: Both reads are plain `.select('*')` with no `{ count: 'exact' }`, so the service, the store and any future affordance have no "there are more" signal; `logger.debug('[EventsService] Fetched events:', events.length)` cannot distinguish 50 events from 50 of 300. The already-recorded Settings "load more" item names the control and the `limit`/`offset` plumbing it needs, but not the fact that the data to drive its enabled state is not fetched. A count also cannot go anywhere today: the intent's Never list forbids a store-shape change and a second store action.
status: done 2026-09-12
resolution: already resolved: Commit 690cfcad3c4a248856e34dd778c73bb09bf70d78 (2026-09-12) adds the approved bounded-lookahead metadata and consumer: src/services/eventsService.ts:268 defines per-window cursor/hasMore, :285 derives continuation from the raw 51st row, and :324 returns bounded pages with metadata; src/stores/slices/eventsSlice.ts:253 stores pagination and src/components/Settings/EventsSettings.tsx:301 consumes both hasMore flags for the history control. tests/unit/services/eventsService.test.ts:381 verifies empty, exact-50, and truncated-51 windows on both sides.
decision: 2026-09-12 Add paging metadata and consumer — Define per-window continuation metadata and carry it through the events service and store to a Settings paging control. Choose a count or bounded lookahead strategy with explicit semantics, preserve existing ordering and Home behavior, and verify empty, exact-limit, and truncated windows. Coordinate this contract change with the history-access behavior in DW-41 and DW-44.
decision: 2026-09-11 Keep metadata deferred
decision: 2026-09-11 Defer pagination

### DW-47: The new API spec re-issues the production query chain by hand, so the two copies can drift if a change is made to both.
origin: spec-deferred 71695d066668
location: tests/api/events-read-window.spec.ts, src/services/eventsService.ts
source_spec: `spec-dw-9-22-events-read-cap-and-pagination.md`
severity: low
reason: `tests/api/events-read-window.spec.ts` cannot import `eventsService`: `src/api/supabaseClient.ts` reads `import.meta.env`, a Vite build-time substitution with no value under the Playwright runner. Its `readEventWindows` therefore mirrors the `gte`/`lt`/`order`/`range` chain by hand, and already diverges in one respect — it computes `offset + limit - 1` with none of production's clamping. The containment is real and was re-verified this pass: mutating the production chain fails `tests/unit/services/eventsService.test.ts`, whose `backend.queries` assertions pin the exact bounds, orderings and range. What is uncovered is a change made in production AND mirrored here incorrectly. Closing it means making the chain injectable — passing a client into a shared function both the service and the spec call — which is a production design change the intent does not reach.
status: done 2026-08-19
resolution: closed by human decision: eventsService.test.ts pins the production chain's bounds, orderings and range, so only a change mirrored incorrectly into the API spec escapes, and no user-facing behaviour depends on the duplication.
decision: 2026-08-19 Accept the mirror; the unit test contains it — eventsService.test.ts pins the production chain's bounds, orderings and range, so only a change mirrored incorrectly into the API spec escapes, and no user-facing behaviour depends on the duplication.

### DW-48: The read-side strip covers the `events` key only; a persisted blob carrying `eventsIsLoading` or `eventsError` would still rehydrate those two.
origin: spec-deferred ed3babe6b83b
location: src/stores/useAppStore.ts:74
source_spec: `spec-dw-14-20-persisted-events-key-strip.md`
severity: low
reason: `STALE_PERSISTED_KEYS` (src/stores/useAppStore.ts:74) lists `moods` and `events`. A blob carrying `eventsIsLoading: true` would rehydrate it, and `loadEvents` bails at `if (!requestedBy) return;` (src/stores/slices/eventsSlice.ts:118) *before* raising the flag — so on a signed-out start nothing clears it until the next sign-in, leaving a stranded loading state. `eventsError` would likewise show a stale banner. Neither carries couple data, so this is not the disclosure class DW-14/DW-20 describe, and both are the same unreachability class as the original entries: no build has ever written any events key to localStorage. Excluded from this change on the authority of the bundle intent, which names the `events` key alone ("Strip a stale `events` key out of the persisted blob on read").
status: done 2026-09-11
resolution: closed by human decision: Preserve the existing persistence scope: no shipped build wrote these transient events flags, as documented in the source spec's Design Notes.
decision: 2026-09-11 Retain the deliberate exclusion — Preserve the existing persistence scope: no shipped build wrote these transient events flags, as documented in the source spec's Design Notes.

### DW-49: An invalid-response write can already have landed, but Settings still offers the same write control and a create retry can duplicate the event.
origin: spec-deferred db701c73ed1f
location: src/components/Settings/EventsSettings.tsx:872
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
reason: This behavior predates the bundle: every failure previously left Save enabled. The new `invalid-response` code now identifies it, but choosing a distinct safe affordance was not part of the events-only refresh-versus-retry decision. `createEvent` can throw after insert when the returned row cannot be converted, while Settings routes every code except `not-found` to Save/Delete.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-49
resolution-undo: 5978483b28512c6b5e1f3ce7a7cecad6eb9f4cce3c4aa2f746285eb1c55c8e39 2026-09-12 7374617475733a206f70656e
decision: 2026-09-12 Refresh before another write — Give invalid-response save failures an explicit uncertain-save explanation and replace immediate Add/Update retry with reconciliation through the existing events refresh flow. Prevent resubmission from that failed form, preserve offline and transport retry behavior, and cover create/update recovery and refresh failure.
decision: 2026-09-12 Keep recovery deferred
decision: 2026-09-11 Keep recovery deferred
decision: 2026-09-11 Defer the recovery choice

### DW-50: The EventsSlice interface comment says `eventsError` is raised only by loads even though writes also park messages there.
origin: spec-deferred ce0f9f82f812
location: src/stores/slices/eventsSlice.ts:54
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: low
reason: The contradiction existed at the baseline: addEvent, editEvent, and removeEvent already set `eventsError` on failure while the state-field comment called it load-only. The current bundle preserves that behavior and documents the result-shape divergence elsewhere in the module header.
status: done 2026-09-11
resolution: already resolved: Commit 9fef9c7 makes eventsError load-only: src/stores/slices/eventsSlice.ts:19 documents ownership and write actions at :266-342 no longer set that field.

### DW-51: A load outcome can be misreported when an event write settles in the narrow window before Settings snapshots the shared error field.
origin: spec-deferred a61e4d489ca9
location: src/components/Settings/EventsSettings.tsx:130
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
reason: This shared-state race predates this bundle and is already identified in the component tests as DW-26. `loadEvents` resolves without its own outcome, so `recordLoadOutcome` reads `eventsError`, which write actions can independently clear or replace before that read. A successful load can therefore show a failure banner, or a failed load can appear successful.
status: done 2026-09-11
resolution: already resolved: Commit 9fef9c7 adds call-owned EventLoadResult at src/stores/slices/eventsSlice.ts:45-49, returns outcomes at :241-255, and src/components/Settings/EventsSettings.tsx:148-155 reads result.status instead of the shared error field.

### DW-52: Invalid-response writes keep the write control even though the mutation may already have landed.
origin: spec-deferred 7567c0b98908
location: src/components/Settings/EventsSettings.tsx:872
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: medium
reason: The behavior predates this bundle, but the coded result makes the ambiguity explicit. Create and update can throw `invalid-response` only after a successful response is missing or cannot be converted; Settings routes every non-`not-found` code back to Save or Update, so create can duplicate a committed event and update can retry without reconciling the stale list.
status: done 2026-09-11
resolution: closed by human decision: Duplicate recovery concern retained by open DW-49; consolidation does not approve implementation or accept the behavior.
decision: 2026-09-11 Consolidate under DW-49 — Duplicate recovery concern retained by open DW-49; consolidation does not approve implementation or accept the behavior.
decision: 2026-09-11 Defer the recovery choice

### DW-53: Transport wrapping drops the original non-PostgREST network error as an Error cause.
origin: spec-deferred 2d2ac9a00a50
location: src/services/eventsService.ts:147
source_spec: `spec-dw-13-19-events-write-error-codes-2.md`
severity: low
reason: The pre-existing `networkFailure` helper creates a new message-only Error. `writeTransportFailure` now wraps only that message, so the original error identity, stack, and transport metadata remain unavailable for diagnostics even though PostgREST wrapping preserves its mapped error as `cause`.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-transport-error-cause
resolution-undo: 3dd40b40769bee717376c7b1b12a8e1da3afdbc2619c849abc2abf476b1e51bf 2026-09-11 7374617475733a206f70656e

### DW-54: User-id-only event load ownership can admit a pre-sign-out response after signing back into the same account.
origin: spec-deferred f281396e181b
location: src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
reason: `loadEvents` validates only `requestedBy` and `latestLoadId`. If account A signs out, signs back in as A, and the old request settles before the new mount effect increments the load id, both guards match and the prior-session response can own the reset list. App's local settled marker is also keyed only by user id. This path predates the bundle; the change preserves rather than introduces those guards.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e

### DW-55: A prior-session event load can still own state after signing back into the same account.
origin: spec-deferred d08cc52656ce
location: src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
reason: `loadEvents` continues to identify ownership with `requestedBy` and `latestLoadId`. If account A signs out and signs back in as A before the old request settles and before a successor load allocates a new id, both guards still match. The user-id-only guard predates this bundle; the reviewed change preserves it while adding call-owned outcomes and mutation replay.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e

### DW-56: A prior-session event load can still own the reset list after signing back into the same account.
origin: spec-deferred a52c0c10748d
location: src/stores/slices/eventsSlice.ts:210; src/App.tsx:441
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: medium
reason: `loadEvents` captures only `userId` and `latestLoadId`. A request started before sign-out can therefore pass both guards after the same user signs in again if the successor Home effect has not allocated a new load id yet. This ownership gap predates the reviewed change, which preserves the existing identity guards while adding per-call results and mutation replay.
status: done 2026-09-11
resolution: resolved by sweep bundle dw-event-load-session-ownership
resolution-undo: 3b9cbe14c278fe58eeb36f2bec269a9c112a29bf26ee5e0dbaacf33079abba46 2026-09-11 7374617475733a206f70656e

### DW-57: A manual stale-row refresh can settle after Events Settings unmounts and call its local state setters.
origin: spec-deferred 0c21a7d01775
location: src/components/Settings/EventsSettings.tsx:185
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: low
reason: The mount load has a cancellation flag, but `refreshEvents()` awaits `loadEvents()` and then calls `recordLoadOutcome()` without an unmount guard. Navigating away during that request therefore reaches `setLoadFailed` and `setSettledForUserId` after unmount. The path and navigation warning predate this bundle; React discards the update, so the verified consequence is limited to development/test noise.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-refresh-unmount-guard
resolution-undo: 43f8322f8e9453ab7fae582d3293bad815aac27fdbba3dcfbf3ddf12734f027c 2026-09-12 7374617475733a206f70656e

### DW-58: Follow-up review still recommended for dw-events-error-attribution after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `spec-dw-26-29-events-error-attribution.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260819-202616-75cc; this entry preserves the lingering recommendation for a deliberate later review.
status: done 2026-09-12
resolution: already resolved: Independent Claude review on PR #270 explicitly traced eventsSlice mutation replay, overlapping loads, and account transitions: https://github.com/Sallvainian/My-Love/pull/270#issuecomment-5351724351. Its embedded run 34668191072 completed successfully on 2026-09-12 at head f5a9fa62dd7df285e867cddb1e1df061852c787a, after the 2026-09-11 keep-open decisions; verified run metadata and read the complete matching review. The reviewed implementation includes src/stores/slices/eventsSlice.ts:169 (ordered replay), :248 (load reconciliation), and src/components/Settings/EventsSettings.tsx:169 (call-owned load outcome); PR #270 merged as 5b755b14.
decision: 2026-09-11 Keep recommendation open
decision: 2026-09-11 Keep the review recommendation

### DW-59: The translucent own-photo badge can still miss WCAG AA over a bright photo.
origin: spec-deferred c395d4263ff0
location: src/components/PhotoGallery/PhotoGridItem.tsx:100
source_spec: `spec-dw-28-pink-primary-button-contrast.md`
severity: medium
reason: `bg-pink-600/90` composites to approximately `#e91a84` over white, which is about 4.27:1 against the badge's small white text. The same image-dependent contrast issue was pre-existing with `bg-pink-500/90`; DW-28 improves the token but does not make this non-button overlay opaque.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-own-photo-badge-contrast
resolution-undo: ec432d0278a3fa08017a373672da1b3036f4a4639752cce7124810859e34903d 2026-09-12 7374617475733a206f70656e

### DW-60: The UI/SQL validation mirror test compares against the original create migration, not the effective constraint after all migrations have run.
origin: spec-deferred eb5b0fb56687
location: tests/unit/components/eventsValidationMirrors.test.ts:23
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: `tests/unit/components/eventsValidationMirrors.test.ts` reads the constraint from `20260815010000_create_events.sql`. A future migration could tighten or replace that constraint while this guard remained green, allowing the UI and deployed database rules to drift. No later events migration currently changes the constraint, so this is a test-maintainability risk rather than a current behavior defect.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e

### DW-61: Repeated date-helper calls can derive different calendar anchors if a seeding batch crosses local midnight.
origin: spec-deferred 07bf0f3e8d6a
location: tests/support/helpers/events.ts:179
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: `isoDateDaysFromNow` creates a fresh `Date` on every call. Multi-row tests call it repeatedly, so a run spanning midnight could produce dates based on different days. The older factory avoids this by accepting one shared anchor, but consolidating these helper APIs is outside the bundle's explicit move-and-rewire surface.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e

### DW-62: Historical story acceptance criteria AC4 and AC6 still pin obsolete test totals and the pre-activation file boundary.
origin: spec-deferred 0bff1e60324b
location: _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:244
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: Story 5 AC4 names a historical 1238-test baseline and only two EventsSettings suites; AC6 limits non-artifact changes to five original story files. Activating the parked runner files necessarily invalidates both descriptions. The bundle authorizes the exact AC3 rewrite only, and review policy requires changes to other specification assertions to be deferred instead of patched during review.
status: done 2026-09-11
resolution: closed by human decision: AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.
decision: 2026-09-11 Preserve the historical contract — AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.

### DW-63: The validation drift guard reads the original events migration instead of the effective schema after every migration.
origin: spec-deferred 8995c6651fba
location: tests/unit/components/eventsValidationMirrors.test.ts:38
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: `tests/unit/components/eventsValidationMirrors.test.ts` extracts constraints from `20260818000002_create_events_table.sql`. A later migration could replace or tighten a constraint without changing that source file, leaving the guard green while the deployed database and UI differ. No later events migration currently changes these constraints.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e

### DW-64: Repeated event-date helper calls can use different calendar anchors across local midnight.
origin: spec-deferred f5a669342ad5
location: tests/support/helpers/events.ts:177
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: `isoDateDaysFromNow` creates a new `Date` on each invocation. A multi-row setup that crosses local midnight can therefore derive rows from different base days. The anchored `coupleEvents` factory avoids this, but consolidating both helper contracts is separate work.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e

### DW-65: Story 5 acceptance criteria AC4 and AC6 describe the pre-activation test totals and file boundary.
origin: spec-deferred 7792fe01375e
location: _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:242
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: AC4 retains the historical 1238-test baseline and names only the two original EventsSettings suites, while AC6 limits non-artifact changes to the five story files. Activating the parked API, E2E, component, and unit coverage makes both statements stale. The affected file is an agent-context specification, so review policy defers rather than edits it.
status: done 2026-09-11
resolution: closed by human decision: AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.
decision: 2026-09-11 Preserve the historical contract — AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.

### DW-66: The validation drift guard reads one historical migration instead of the effective constraint installed by the complete migration chain.
origin: spec-deferred 4abe4f39af4c
location: tests/unit/components/eventsValidationMirrors.test.ts:38
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: `tests/unit/components/eventsValidationMirrors.test.ts` compares UI constants with `20260818000002_create_events_table.sql`. If a later migration tightens or replaces a constraint, the guard still compares against the obsolete source and can stay green while the form accepts input that the deployed database rejects.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e

### DW-67: The icon extractor can silently omit database values containing non-letter characters.
origin: spec-deferred 0fdd766222cc
location: tests/unit/components/eventsValidationMirrors.test.ts:98
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: The drift guard extracts icons with `'([a-z]+)'`. A later value such as `party-hat` does not match, so a database-only addition can be absent from `dbIcons` and leave the equality assertion green even though the UI does not offer the admitted value.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e

### DW-68: The validation mirror checks constant declarations but not the validation branches that consume them.
origin: spec-deferred aa42fa28a662
location: tests/unit/components/eventsValidationMirrors.test.ts:68
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: The guard proves that `LABEL_MAX_LENGTH` and `DESCRIPTION_MAX_LENGTH` match the migration, but a future edit can validate against a different literal while retaining those constants for messages or another use. Existing boundary tests cover rejection at 101 and 501, not acceptance at the exact database limits.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-validation-guard-fidelity
resolution-undo: d8a7554e2a46ce41c0e9381203ae0d7309996f2e00c30fac38a2c24316f0fe6b 2026-09-12 7374617475733a206f70656e

### DW-69: Repeated date-helper calls can anchor one setup batch to different local days at midnight.
origin: spec-deferred 48f645dfe7e2
location: tests/support/helpers/events.ts:177
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: `isoDateDaysFromNow` creates a new `Date` for every call. Multi-row setup in the activated API and E2E suites invokes it repeatedly, so a batch crossing local midnight can receive dates derived from different calendar anchors.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-test-date-anchors
resolution-undo: 97b97851d902cda684f6d7a952dfa833a050c31e1b11ef4ff6bbc3cda802a21c 2026-09-12 7374617475733a206f70656e

### DW-70: The anonymous-write isolation check can fail on a stale row from an interrupted prior run.
origin: spec-deferred 1f8f5181ea11
location: tests/api/events-wire-contract.spec.ts:247
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: The first wire-contract test queries the fixed `ANON_ATTEMPT_LABEL` without clearing the worker pair first. A prior run terminated before teardown can leave that label behind, so the final zero-row assertion can fail even though the anonymous POST wrote nothing.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-wire-contract-fidelity
resolution-undo: c4828021067babf12116479690590415b10721d96a8ca12d9d16f45a0fc9e054 2026-09-12 7374617475733a206f70656e

### DW-71: Outsider account cleanup ignores a returned deletion error when sign-in setup fails.
origin: spec-deferred 588dd42563e8
location: tests/support/helpers/rls-security.ts:64
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: medium
reason: `createOutsiderClient` catches a failed sign-in and awaits `cleanup()`, but the Supabase admin deletion reports ordinary failures through its returned `error` field. That response is not checked on this setup-failure path, so the throwaway auth account can remain while only the sign-in error is reported.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-outsider-setup-cleanup-errors
resolution-undo: 0ff32d336aaa8e746d9aea6f42cd2b250588938c82ff6e059de3598a09c53c07 2026-09-12 7374617475733a206f70656e

### DW-72: The test-local event row schema accepts undeclared response columns despite its exact-schema claim.
origin: spec-deferred ebb7963b5d9c
location: tests/api/events-wire-contract.spec.ts:141
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: Zod objects strip unknown keys by default. Because `EventRowSchema` is not strict, a new PostgREST column returned by `select=*` is accepted even though the surrounding test prose says the schema mirrors the events table column for column.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-wire-contract-fidelity
resolution-undo: c4828021067babf12116479690590415b10721d96a8ca12d9d16f45a0fc9e054 2026-09-12 7374617475733a206f70656e

### DW-73: The persistence suite header overstates reload coverage for the cleared-description case.
origin: spec-deferred 5000b9059f98
location: tests/e2e/settings/events-persistence.spec.ts:6
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: The file header says every row is read after a real reload, but DE.5-E2E-006 observes the pass-through PATCH response and resulting Settings and Home state without reloading. The behavior assertion remains valid, but the suite-level description is inaccurate.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e

### DW-74: Story 5 acceptance criteria AC4 and AC6 remain pinned to the pre-activation test inventory and file boundary.
origin: spec-deferred 41994f83a590
location: _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:242
source_spec: `spec-dw-30-activate-parked-event-tests.md`
severity: low
reason: AC4 names the historical 1238-test baseline and only the original EventsSettings suites, while AC6 permits only five story files outside artifacts. The activated API, E2E, component, unit, and shared-helper changes make both statements stale. Review policy requires deferring changes to this agent-context specification.
status: done 2026-09-11
resolution: closed by human decision: AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.
decision: 2026-09-11 Preserve the historical contract — AC4 and AC6 describe the original story change; DW-30 separately records the expanded activated test inventory and verification.

### DW-75: Incoming interaction callbacks can still write records from a previous account after the active user changes or teardown begins.
origin: spec-deferred cdf80216e859
location: src/stores/slices/interactionsSlice.ts:223
source_spec: `spec-dw-35-interaction-subscribe-error-surfacing.md`
severity: high
reason: The pre-existing record callback in interactionsSlice calls addIncomingInteraction without checking the captured user or the subscription's active flag. A queued record from the old channel can therefore repopulate shared store state after an account switch. This was not introduced by DW-35's new status callback.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-interaction-record-ownership
resolution-undo: 36085192bfdd9a00d2e10275fcf8718ec07ee7b516b36fc6c20e3e9e0882adaa 2026-09-12 7374617475733a206f70656e

### DW-76: The subscribeInteractions JSDoc example does not match the method's required arguments.
origin: spec-deferred 81acc5a7d387
location: src/api/interactionService.ts:216
source_spec: `spec-dw-35-interaction-subscribe-error-surfacing.md`
severity: low
reason: The example already omitted userId before this change and now also omits the status callback, so copied sample code does not typecheck. It is pre-existing documentation debt outside DW-35's runtime error surface.
status: done 2026-09-11
resolution: already resolved: Commit fb19de6f89d8faa6861f622a40a2f8c425485805 (docs(api): correct interaction subscription example, 2026-09-11) updated src/api/interactionService.ts:220-230 to pass userId, the record callback, and the status callback, matching the required signature at src/api/interactionService.ts:236-240.

### DW-77: The existing error-handler test header incorrectly says four callers never import the handler.
origin: spec-deferred daacdcd2980b
location: tests/unit/api/errorHandlers.test.ts:16-20
source_spec: `spec-dw-39-empty-database-error-fallback.md`
severity: low
reason: tests/unit/api/errorHandlers.test.ts:16-20 contains this unchanged inventory. photoService.ts:396-397, partnerService.ts:192-193, scriptureReadingService.ts:332-333, and notesSlice.ts:519-520 now use handleSupabaseError for selected CHECK errors. The stale inventory can mislead maintainers assessing existing coverage; it predates DW-39.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e

### DW-78: Errors that omit message or code entirely can bypass database classification in service callers.
origin: spec-deferred e6d9258059df
location: src/api/errorHandlers.ts:122-130
source_spec: `spec-dw-39-empty-database-error-fallback.md`
severity: low
reason: isPostgrestError requires code, message, and details properties to exist. MoodApi.create and EventsService.createEvent use that unchanged guard before conversion. An omitted-message object therefore bypasses handleSupabaseError, while an explicitly present undefined, null, empty, or whitespace message reaches the fixed fallback. This pre-existing classifier behavior is distinct from DW-39's specifically identified unconditional interpolation in handleSupabaseError; the change does not claim to fix routing.
status: done 2026-09-12
resolution: closed by human decision: Treat malformed omitted-field database responses as unsupported without a demonstrated project response, consistent with prior exclusions of synthetic server-error scenarios.
decision: 2026-09-12 Exclude malformed envelopes — Treat malformed omitted-field database responses as unsupported without a demonstrated project response, consistent with prior exclusions of synthetic server-error scenarios.

### DW-79: Auth token persistence may race between overlapping auth events and the duplicate action-service writes.
origin: spec-deferred 5d23934f706e
location: src/api/auth/sessionService.ts:onAuthStateChange; src/api/auth/actionService.ts:signIn,signOut; src/sw-db.ts:storeAuthToken,clearAuthToken
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
reason: sessionService and actionService both write/delete the current service-worker token, and neither associates those operations with a generation. Those writers and their asynchronous IndexedDB opens predate this bundle. Reversing mocked promise completion does not demonstrate reversed real IndexedDB commits; establishing the reported late-clear outcome requires a controlled trace of actual IndexedDB operations plus actionService signOut/signIn overlap. Earlier auth delivery alone does not establish the claimed regression.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-decision-dw-79
resolution-undo: 977f0a57bd3de369e757ae7c4e0d16f435a03d43904b8da6a9062c4a084f34f8 2026-09-12 7374617475733a206f70656e
decision: 2026-09-12 Trace real token persistence overlap — Build a controlled browser regression harness that exercises the actual sw-db IndexedDB implementation alongside overlapping actionService signOut/signIn and auth notifications. Record operation dispatch, transaction creation, commit order, and the final current-token owner without exposing token contents. Establish whether a stale operation can overwrite or delete the newer token before choosing a persistence-coordination change.
decision: 2026-09-12 Keep pending stronger evidence
decision: 2026-09-11 Keep pending stronger evidence

### DW-80: A replacement same-user session without an observed sign-out is not distinguished from a same-session update.
origin: spec-deferred 883a7daa57da
location: src/stores/slices/authSlice.ts:setAuthUser; src/api/auth/sessionService.ts:onAuthStateChange
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
severity: medium
reason: setAuthUser receives user identity rather than a server session identifier, and same-user notifications deliberately preserve ownership. The previous implementation also accepted these loads. The bundle explicitly repairs requests crossing sign-out and same-account sign-in; replacement sessions without that transition are a separate pre-existing boundary.
status: done 2026-09-11
resolution: closed by human decision: Accept user identity plus observed sign-out/account transitions as the ownership boundary; same-user notifications preserve load ownership and no incorrect same-account result has been demonstrated.
decision: 2026-09-11 Preserve the current boundary — Accept user identity plus observed sign-out/account transitions as the ownership boundary; same-user notifications preserve load ownership and no incorrect same-account result has been demonstrated.

### DW-81: A delayed initial getSession result can overwrite a newer auth-listener identity.
origin: spec-deferred 70b954c2c502
location: src/App.tsx:checkAuth
source_spec: `spec-dw-54-55-56-event-load-session-ownership.md`
severity: medium
reason: App's checkAuth applies its awaited result whenever the component is mounted, without checking whether an auth notification arrived in the meantime. A stale null or different-user snapshot can overwrite the listener's newer state. Both this initialization branch and its missing notification guard are unchanged from the baseline.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-auth-bootstrap-notification-order
resolution-undo: 30550be193d560a0999139ba0de7bc8c278b2e00d6da154dbe892975020e2218 2026-09-12 7374617475733a206f70656e

### DW-82: The interactions slice header incorrectly describes its cross-slice dependencies as self-contained.
origin: spec-deferred 37d6cf07740f
location: src/stores/slices/interactionsSlice.ts:10
source_spec: `spec-dw-75-interaction-record-ownership.md`
severity: low
reason: The baseline already read authSlice.userId for sends, history, and subscriptions while its header said "None (self-contained)". The record callback now also reads authSessionVersion. This pre-existing documentation mismatch can mislead a developer composing an isolated slice fixture about the auth state it requires; production behavior is unaffected.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-source-test-contract-comments
resolution-undo: a76a4c8413ab1f9522820a2ace3807a71cfccc9190e72bb3e41b1435e26c2a3c 2026-09-12 7374617475733a206f70656e

### DW-83: EventsSettings counts UTF-16 code units while PostgreSQL char_length counts Unicode characters.
origin: spec-deferred 40fa82030481
location: src/components/Settings/EventsSettings.tsx:689
source_spec: `spec-dw-60-63-66-67-68-events-validation-guard-fidelity.md`
severity: medium
reason: The unchanged submit handler uses trimmedLabel.length and trimmedDescription.length. Measured 100 repeated emoji have JavaScript length 200 and PostgreSQL char_length 100, so the form rejects some values admitted by the existing database CHECK. This predates this bundle, which explicitly preserves production validation. The new boundary tests characterize the existing limits with ASCII and do not establish Unicode equivalence.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-events-unicode-character-limits
resolution-undo: 0be197926a87be6e2c1fbbaed78db765bec7e69a592d2449494dfec36cb22e27 2026-09-12 7374617475733a206f70656e
decision: 2026-09-12 Match PostgreSQL character counts — Count Unicode code points in the event form's trimmed label and description validation while retaining the existing 100/500 database limits, icons, and trimming behavior. Align any counters or input restrictions with that rule and add exact-limit and limit-plus-one tests using supplementary-plane emoji and combining characters for the shared add/edit submission path. Keep the database schema unchanged and verify the form accepts the same character counts as PostgreSQL.

### DW-84: The helper's existing time-of-day arithmetic can skip a calendar day in a late-evening DST gap.
origin: spec-deferred 7ad2fd885b7b
location: tests/support/helpers/events.ts:180
source_spec: `spec-dw-61-64-69-event-test-date-anchors.md`
severity: low
reason: Reproduced with TZ=America/Nuuk: local 2026-03-27 23:30 plus one day using the helper's unchanged setDate arithmetic yields 2026-03-29, while eventDateFrom's local-midnight constructor yields 2026-03-28. The target 23:30 falls in a skipped DST hour. Baseline revision 6afb20e2b69485307ecb25fac7c59f0e86ab45af uses the same time-preserving arithmetic, so this is a pre-existing calendar issue rather than the independent-clock defect resolved by this bundle. Current unit coverage runs in America/New_York, where its spring/fall DST cases pass.
status: done 2026-09-12
resolution: resolved by sweep bundle dw-event-helper-calendar-day-offsets
resolution-undo: f1f54829eeec8a92362ccf7d56827785f3782bece2e52d1232ce15cc31764d98 2026-09-12 7374617475733a206f70656e

### DW-85: The forward DELETE migration is only ever verified on a fresh replay, where the row it deletes never exists.
origin: spec-deferred ee22b3cb6330
location: supabase/migrations/20260912000000_remove_claude_bot_password_row.sql:13
source_spec: `1-contain-the-exposed-bot-credential.md`
severity: low
reason: supabase/tests/database/22_claude_bot_config_no_secret.sql runs against a db reset database whose edited seed never inserts test_password, so the DELETE in 20260912000000_remove_claude_bot_password_row.sql matches nothing there; the migration was hand-verified inside a rolled-back transaction (insert placeholder row, apply, before=1 after=0) and the repo has no pattern for replaying one migration against pre-seeded state. Settle by running `select count(*) from public.claude_bot_config where key = 'test_password'` against the linked project after the next deploy and expecting 0.
status: done 2026-09-15
resolution: verified against the linked project after the deploy, exactly as this entry asked: `select count(*) from public.claude_bot_config where key = 'test_password'` returns 0. Read-only, and only the count is recorded here — the repo is public.

### DW-86: AGENTS.md carries no durable prose about the bot credential being provisioned out of band or the rotation command.
origin: spec-deferred 77116e136280
location: AGENTS.md (Running and verifying)
source_spec: `1-contain-the-exposed-bot-credential.md`
severity: low
reason: AGENTS.md says durable prose goes in that block, but the rotation procedure (fnox set -p age CLAUDE_BOT_PASSWORD, then fnox exec -- node scripts/provision-claude-bot.mjs) lives only in script and migration comments and an out-of-repo memory note. Fix edits an agent-context file, so it is recorded rather than applied here.
status: done 2026-09-13
resolution: AGENTS.md (Running and verifying) now carries the rotation line: update CLAUDE_BOT_PASSWORD in fnox.toml, then `fnox exec -- node scripts/provision-claude-bot.mjs`. Added by the 2026-09-13 bmad-project-context refresh.

### DW-87: The retry's re-subscribe cannot rejoin an errored channel at all, because the SDK gates the whole of subscribe() on the channel already being closed.
origin: spec-deferred 7f2be02c1cc5
location: src/hooks/useRealtimeMessages.ts `handleStatus`, the CHANNEL_ERROR retry (baseline d3306502:260; :190-196 was the SUBSCRIBED snapshot comment, not the retry)
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: medium
reason: node_modules/@supabase/realtime-js/dist/module/RealtimeChannel.js:134 wraps the entire join body in `if (this.channelAdapter.isClosed())` and otherwise returns `this`. After a CHANNEL_ERROR the state is `errored`, not closed, so the retry at useRealtimeMessages.ts is a no-op however many times it fires. Pre-existing and untouched by this story: the baseline retry had the identical shape, and passing `handleStatus` (patched this pass) fixes only the reporting half. Settle by removing and reopening the channel on retry rather than re-subscribing the same object, with a test that drives a real CHANNEL_ERROR.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-channel-rejoin-lifecycle
resolution-undo: 0cc4137f6b281b58f559fe5e6b090ec351e5bf79bc001829e38a38cee52e68d1 2026-09-14 7374617475733a206f70656e

### DW-88: getPartnerId() returning null for a transient error is indistinguishable from "unlinked", and would drop every note and mood for the life of the channel.
origin: spec-deferred 2f395306ff06
location: src/api/supabaseClient.ts:128-136
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
reason: src/api/supabaseClient.ts:128-136 returns null on any PostgREST error, and both receivers treat a null snapshot as "trust nothing". A snapshot taken at join would then stay null until the next SUBSCRIBED. I could not show the program reaches this: the users query and the Realtime socket address the same host, so a network failure denies the join too and the retry path runs. Settle by reproducing a PostgREST-only failure (for example a 500 injected at /rest/v1/users) while the websocket stays healthy, and observing whether notes stop arriving.
status: done 2026-09-14
resolution: already resolved: Resolved by 6fe1fdad and 467e020c: src/api/supabaseClient.ts:180 lookupPartnerId now returns {status:'error',reason} instead of null for a PostgREST failure (:205-210), resolvePartnerLookupForDelivery retries three times with backoff (:222-243), and both receivers restore the previous snapshot rather than muting -- src/hooks/useRealtimeMessages.ts:159-162 (if lookup.status === 'error' then partnerIdRef.current = previous; return) and src/api/moodSyncService.ts:492-495 (if lookup.status === 'error' then entry.partnerId = previous; return). The permanent drop the entry describes is closed.

### DW-89: The Array.isArray guard was adopted at the three broadcast-facing mood sites and not at the four siblings that share the identical idiom.
origin: spec-deferred c4d4e08547c9
location: src/stores/slices/moodSlice.ts:384
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
reason: src/stores/slices/moodSlice.ts:384, src/components/MoodHistory/MoodDetailModal.tsx:91, src/components/MoodHistory/CalendarDay.tsx:72 and src/components/MoodTracker/MoodTracker.tsx:170 still use `x && x.length > 0` ahead of an unconditional MOOD_CONFIG[allMoods[0]] deref. No broadcast reaches them: moodSlice's transform consumes moodApi.fetchByUser output, already parsed by MoodArraySchema, and the MoodHistory pair read the offline-first IndexedDB path. Pre-existing hardening rather than a hole this story opened. Settle by deciding whether the IndexedDB read path needs the same guard and covering it in the shape of src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-mood-array-shape-guards
resolution-undo: db52fa9894ee31ba5b66017c3aac8ac433ce45263c21a54d94782f0a1386fd0a 2026-09-14 7374617475733a206f70656e

### DW-90: No E2E drives the app's own Realtime clients in a browser against the new policies; live evidence stops at the raw SDK.
origin: spec-deferred 4e2d371094d1
location: tests/e2e/notes/love-notes.spec.ts
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
reason: tests/api/couple-broadcast-authorization.spec.ts builds its own createClient identities and calls join()/httpSend() directly; it imports neither useRealtimeMessages, moodSyncService, sendEphemeralBroadcast nor the store, and tests/e2e/notes/love-notes.spec.ts and tests/e2e/partner/partner-mood.spec.ts mention neither realtime nor broadcast. The policy predicates themselves are measured because the spec builds the same topic strings and the same session-based clients, but the composition shipped to users is covered only by mocked unit tests. Pre-existing for both features. Settle with a two-context E2E in the shape of the togetherMode scripture specs.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-browser-e2e
resolution-undo: 5c15a4b3473ab95dce8d5efbbfbf9ea1f4df3395307ef5d5fdbbbf666e03049e 2026-09-14 7374617475733a206f70656e

### DW-91: An effect re-run that lands while the previous run's un-awaited removeChannel is still deregistering is handed the dying channel.
origin: spec-deferred 76257cdda80f
location: src/hooks/useRealtimeMessages.ts, the effect cleanup's removeChannel (baseline d3306502:311; :215-232 was the backoff block, not the cleanup)
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
severity: low
reason: useRealtimeMessages' cleanup calls supabase.removeChannel without awaiting it, and src/api/realtimeSocket.ts documents that the registry entry is dropped later still, from the _onClose hook, so supabase.channel(topic) in the replacement run can return the leaving object whose subscribe() is a silent no-op. Pre-existing: the baseline cleanup had the same shape, and the new `cancelled` guard covers only the subscribe-after-unmount half. Settle by awaiting the leave the way moodSyncService's closingMoodChannels registry does.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-realtime-channel-rejoin-lifecycle
resolution-undo: 0cc4137f6b281b58f559fe5e6b090ec351e5bf79bc001829e38a38cee52e68d1 2026-09-14 7374617475733a206f70656e

### DW-92: getSignedInUserId() returning null for a transient getSession error is read as "the account changed", which mutes the mood channel until a fresh subscriber re-arms it.
origin: spec-deferred e08d417d905d
location: src/api/supabaseClient.ts:81-92
source_spec: `2-authorize-and-validate-couple-broadcasts.md`
reason: src/api/supabaseClient.ts:81-92 returns null on any getSession error or throw, and refreshChannelIdentity (src/api/moodSyncService.ts:455-460) treats `null !== entry.ownerUserId` as an account change and nulls the partner snapshot. Only the next SUBSCRIBED or a new subscriber's `entry.partnerId = partnerIdAtJoin` restores it, and an already-joined channel emits no further SUBSCRIBED. I could not show the program reaches this: refreshChannelIdentity runs only from the SUBSCRIBED arm, i.e. moments after the same session authorized the private join, so a session read that fails while that join succeeds is not demonstrated. Same shape as the getPartnerId ambiguity already recorded. Settle by injecting a getSession failure while the websocket stays healthy and observing whether partner moods stop arriving.
status: done 2026-09-14
resolution: already resolved: Resolved by aa2357ca and e611f45d: src/api/supabaseClient.ts:111 lookupSignedInUser returns {status:'error',reason} rather than null for a getSession failure (:117-120), and src/api/moodSyncService.ts:510-531 verifyChannelOwner returns true on session.status === 'error' -- logging 'Session read was inconclusive; not treating it as an account change' -- so a transient session read is no longer read as an account change and no longer mutes the channel.

### DW-93: The PKCE callback is never exercised against the deployed site: no real Google consent round-trip, and the hosted redirect-URL allow list was not read.
origin: spec-deferred 5ada678c7e15
location: src/api/auth/actionService.ts:119 (redirectTo) / hosted project xojempkrugifnaveqtqc
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: medium
reason: The hosted project issues the PKCE authorize redirect (measured: HTTP 302 to accounts.google.com with response_type=code), but completing consent needs a Google account this session does not hold and no authorized integration provides. Separately, /auth/v1/authorize does not validate redirect_to up front -- a deliberately bogus https://not-allowed.example.com/steal returned the same 302 with no error parameter -- so the allow list is not readable from here and the Supabase MCP exposes no auth settings endpoint. The local substitute (tests/api/pkce-code-exchange.spec.ts) mints a real GoTrue code and proves only the initiating client redeems it. Settle by completing one real Google sign-in on https://sallvainian.github.io/My-Love/ after deploy.yml ships this, confirming the session lands and the URL returns with ?code=.
status: done 2026-09-15
resolution: closed by human decision: One real Google sign-in on https://sallvainian.github.io/My-Love/ confirmed the session landed with ?code=; hosted redirect allow-list was read.
decision: 2026-09-15 Operator completes the hosted sign-in, then close — One real Google sign-in on https://sallvainian.github.io/My-Love/ confirmed the session landed with ?code=; hosted redirect allow-list was read.
decision: 2026-09-15 Keep open until a hosted Google sign-in is recorded

### DW-94: A PKCE sign-in cannot complete where localStorage is unavailable, which the previous implicit flow tolerated.
origin: spec-deferred 33150c174af6
location: src/api/supabaseClient.ts:59
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
reason: With site data blocked or in a private window, supportsLocalStorage() is false and the SDK falls back to an in-memory store, which a full-page redirect to the provider wipes along with the verifier; the returning ?code= then finds nothing and is ignored. Under the old implicit flow the fragment carried the tokens, so the same browser signed in for that tab. Password sign-in is unaffected either way. Not fixed here: a cookie or sessionStorage adapter is new storage surface rather than a direct correction. Settle by deciding whether a private-window Google sign-in is supported, then adding an adapter or a stated limitation.
status: done 2026-09-14
resolution: closed by human decision: Google sign-in requires site data to be enabled; password sign-in covers that browser, and persistSession would not survive a reload there either, so an adapter buys one session and adds new auth storage surface.
decision: 2026-09-14 State the limitation, no adapter — Google sign-in requires site data to be enabled; password sign-in covers that browser, and persistSession would not survive a reload there either, so an adapter buys one session and adds new auth storage surface.

### DW-95: A code callback that finds no verifier is ignored in silence, with nothing shown to the person who just came back from the provider.
origin: spec-deferred f540b6e377f9
location: src/App.tsx:229-296
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
reason: GoTrueClient.js:3356-3366 classifies such a URL as not-a-callback, so _initialize falls through to _recoverAndRefresh and the app renders the login screen with no explanation; measured in tests/unit/api/supabaseClientAuthFlow.test.ts, which asserts exactly that silence. Recoverable -- signing in again from this browser works -- and the fix is user-facing callback handling, which the story's contract excludes ("Never: add ... an exchangeCodeForSession call of our own"). Settle by deciding whether a "finish sign-in in the browser you started in" message is wanted, and where it would live given that the SDK owns callback classification.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-auth-callback-messages
resolution-undo: 45d33d5c56801a82a03ab02c9101da88d2a9561d993b000e83b939dfb8c7330f 2026-09-14 7374617475733a206f70656e
decision: 2026-09-14 Show a recoverable message — Detect a returning ?code= that produced no session and render a recoverable explanation on the login screen -- that sign-in has to be finished in the browser it was started in -- without adding an exchangeCodeForSession call of our own. Settle DW-96's provider-denial silence in the same handler and on the same surface, and replace the unit case that currently pins the silence.

### DW-96: The provider-denial callback is as silent as the missing-verifier one, and only the second was recorded.
origin: spec-deferred 34a72182aa5f
location: src/App.tsx:229-296
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
reason: GoTrueClient.js:3252-3259 throws AuthImplicitGrantRedirectError for any `#error=` URL before the flowType switch, _initialize returns it at :417, and nothing in src/App.tsx:229-296 reads _initialize's return value -- so a user who declines Google consent lands on the login screen with no explanation. Pre-existing: the implicit flow behaved identically, so this story neither caused nor changed it. The unit case "preserves an existing session for an error callback" asserts the session and the request count, never the returned error. Settle together with the missing-verifier silence: decide whether a "sign-in was cancelled" message is wanted, and where it lives given that the SDK owns callback classification.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-auth-callback-messages
resolution-undo: 45d33d5c56801a82a03ab02c9101da88d2a9561d993b000e83b939dfb8c7330f 2026-09-14 7374617475733a206f70656e
decision: 2026-09-14 Show a cancelled-sign-in message — Read the SDK initialize outcome for an error callback and render a sign-in was cancelled message on the login screen, sharing one handler and one surface with DW-95's missing-verifier case, and extend the existing unit case to assert the returned error rather than only the preserved session.

### DW-97: Every redirect_to assertion runs where BASE_URL is "/", so the production "/My-Love/" base path is pinned nowhere.
origin: spec-deferred 90661930e678
location: tests/unit/api/supabaseClientAuthFlow.test.ts / tests/e2e/auth/google-oauth.spec.ts
source_spec: `3-require-browser-initiated-auth-callbacks.md`
severity: low
reason: vite.config.ts:11 is `base: mode === 'production' ? '/My-Love/' : '/'` and playwright.config.ts:178 boots the dev server with `npx vite --mode test`, so both new assertions -- the unit case's `redirect_to` equality and the E2E's `appBaseUrl + '/'` -- only ever observe `/`. The byte-for-byte requirement the story pins is therefore verified at local origins alone. Not fixable from this session for the same reason the deployed-site verification is not. Recorded separately rather than folded into that entry, because the triage log of the previous pass said it had been grouped there and the text does not carry it. Settle by asserting the authorize URL's `redirect_to` once against a production-mode build, or by reading it during the outstanding deployed-site sign-in.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-production-base-redirect-assertion — closed on the unit half only, and by a substituted mechanism. This entry's `location:` named two files; `tests/e2e/auth/google-oauth.spec.ts:68` still reads `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/')` and was deliberately excluded, the story's Never recording that "the deployed-origin round-trip stays operator work under DW-93". The reason text asked this be settled by asserting `redirect_to` against a production-mode build or by reading it during the outstanding deployed-site sign-in; what shipped is neither, but a stubbed `BASE_URL` under happy-dom bound to `vite.config.ts` through `loadConfigFromFile`. That is unit-level evidence, not deployed-site evidence, and DW-93 still carries the hosted half. Recorded here rather than left in the bundle's triage log (DW-126).
resolution-undo: 9a82e817c408383cfb4ee4e071886a4e6b282feec426a7f3d34cf8aab443dba0 2026-09-14 7374617475733a206f70656e

### DW-98: Whether an installed PWA returns from Google consent into the same storage partition that wrote the verifier was not established.
origin: spec-deferred 194da630c317
location: src/api/supabaseClient.ts:59-77
source_spec: `3-require-browser-initiated-auth-callbacks.md`
reason: Unverified. vite.config.ts:71 declares `display: 'standalone'`, and signInWithGoogle navigates the current context with window.location.href, which on the platforms checked keeps the round trip inside the app's own context and storage. What was not measured is an actual installed-PWA Google sign-in on a platform that hands OAuth to a separate browser context: there the returning `?code=` would find no verifier and be ignored, where the old implicit fragment carried the tokens themselves. Same failure mode as the private-window entry, a different trigger. Settle by completing one Google sign-in from the installed PWA on iOS and Android after deploy; if it fails, the fix is a storage adapter or a stated limitation, not a change to the flow type.
status: done 2026-09-15
resolution: closed by human decision: Installed-PWA Google sign-in is an unmeasured sibling of DW-94; Google requires the same storage partition that wrote the verifier, and password sign-in covers a handoff to another browser context. No adapter.
decision: 2026-09-15 Close; extend DW-94's limitation without measuring — Installed-PWA Google sign-in is an unmeasured sibling of DW-94; Google requires the same storage partition that wrote the verifier, and password sign-in covers a handoff to another browser context. No adapter.
decision: 2026-09-15 Keep open until iOS and Android PWA sign-in are measured

### DW-99: storageService.getMessage / updateMessage / deleteMessage / toggleFavorite still reach any row in the messages store by id with no ownership check.
origin: spec-deferred f5bbde9a7366
location: src/services/storage.ts:157,227-276
source_spec: `7-partition-custom-messages-by-account.md`
severity: medium
reason: Verified at src/services/storage.ts:157 (getMessage returns any row) and :256-260 (toggleFavorite reads through it then writes isFavorite with no owner check). Pre-existing: none of these four were introduced or altered by this story, and the intent's Always list names only getAllMessages and getMessagesByCategory. Not reachable from the UI today because the ids a component can offer now come from the scoped `messages` array, but the service surface remains unscoped for any future caller.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-message-store-ownership-scoping
resolution-undo: ea1805a2ada35a4f2bffdb6ddfe19f128423b1fb03cc6e8e6f4e08bc94b3c14d 2026-09-14 7374617475733a206f70656e

### DW-100: messagesSlice.toggleFavorite set()s after an await with no identity capture or recheck.
origin: spec-deferred 50b8808c997c
location: src/stores/slices/messagesSlice.ts:130-148
source_spec: `7-partition-custom-messages-by-account.md`
severity: medium
reason: Verified at src/stores/slices/messagesSlice.ts:130-148: `await storageService.toggleFavorite(messageId)` is followed by an unguarded set() writing both `messages` and `messageHistory.favoriteIds`. Pre-existing and outside the seven actions the intent enumerates; AGENTS.md records the guard as copy-pasted at 19 sites with uneven coverage. A switch landing mid-flight appends the outgoing account's message id to the incoming account's favoriteIds.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-store-identity-guard-gaps
resolution-undo: 5ed869dbc9cc632ed55dafb4788b27e92f4377b334530e348b14959aaeb28d6d 2026-09-14 7374617475733a206f70656e

### DW-101: settingsSlice.initializeApp reads get().userId live at two points separated by an await, with no identity capture or recheck around its set({ messages }).
origin: spec-deferred c9cd7a4ea314
location: src/stores/slices/settingsSlice.ts:126,141
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
reason: Verified at src/stores/slices/settingsSlice.ts:126,141 with set() at :143,:147 and get().updateCurrentMessage() at :151. Caused by this story (the argument is new), but initializeApp is guarded by a module-level isInitialized flag and an App-level ref, so it runs once per page load and no reachable interleaving was demonstrated. It is now the only messages writer without the guard idiom this story introduced elsewhere.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-store-identity-guard-gaps
resolution-undo: 5ed869dbc9cc632ed55dafb4788b27e92f4377b334530e348b14959aaeb28d6d 2026-09-14 7374617475733a206f70656e

### DW-102: The intent's I/O matrix states outcomes at three surfaces (service, store, UI) but the tests occupy two; the "AdminPanel shows none" half of row 1 is unasserted.
origin: spec-deferred cd5ea7d12745
location: src/components/AdminPanel/AdminPanel.tsx:26-30
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
reason: No AdminPanel component test exists anywhere under tests/, and no E2E spec covers admin or custom messages. The store chain that would carry it (customMessagesLoaded: false re-firing AdminPanel.tsx:26-30) is verified to exist by reading, not by test. Story :73 sanctions this ("AdminPanel needs no change if the slice signature stays"), so it is a gap against the verbatim matrix rather than a deviation from the plan.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: tests/unit/components/AdminPanel.accountData.test.tsx renders the real AdminPanel over real fake-IndexedDB services and the real store, asserting A/B/A ownership at the UI surface the matrix named.

### DW-103: DeleteConfirmDialog calls deleteCustomMessage without await or catch, so a rejected delete closes the dialog as if it succeeded and surfaces as an unhandled rejection.
origin: spec-deferred 3c0512dcb4a2
location: src/components/AdminPanel/DeleteConfirmDialog.tsx:21-24
source_spec: `7-partition-custom-messages-by-account.md`
severity: low
reason: Verified at src/components/AdminPanel/DeleteConfirmDialog.tsx:21-24 (`deleteCustomMessage(message.id); onConfirm();`) against src/stores/slices/messagesSlice.ts:497-500, which re-throws. The missing await is pre-existing — messagesSlice re-threw before this story and BaseIndexedDBService.delete already threw on a DB error — but deleteForUser adds two new throw cases (signed out via requireOwner, and a row owned by someone else). Neither new case is reachable from the dialog today: the ids it offers come from the owner-scoped `customMessages` list and AdminPanel renders only behind a session. Settle by driving deleteCustomMessage through a rejection in a component test.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: DeleteConfirmDialog now awaits the deletion, blocks dismissal and duplicate submits while it is pending, and surfaces an accessible failure with retry/cancel instead of closing as if it succeeded. Covered by AdminPanel.accountData.test.tsx.

### DW-104: An unnamed partner is rendered as their full email address in the chat, while the own-name path falls back to the email prefix.
origin: spec-deferred a5c51df004b8
location: src/api/supabaseClient.ts (getPartnerDisplayName)
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
reason: getPartnerDisplayName returns the stored display_name verbatim and LoveNotes renders it. For a profile still carrying the trigger's email seed that value IS the email. Pre-existing: this function is untouched by story 8 and behaved identically before, because the old trigger also seeded display_name from the email. The fix is to share one seed-fallback classification between the own-name and partner-name readers.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e

### DW-105: If a public.users row were ever absent while its auth user exists, the setup modal could never be satisfied, and the users INSERT policy now has no client caller.
origin: spec-deferred 05606ebe644a
location: src/components/DisplayNameSetup/DisplayNameSetup.tsx (zero-row branch)
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: medium (unverified)
reason: lookupOwnDisplayName maps PGRST116 to `unset`, which opens the modal, while DisplayNameSetup's plain UPDATE cannot create the row and `id` is outside the new column grant. No reachable path to that state was demonstrated: public.users.id is REFERENCES auth.users(id) ON DELETE CASCADE and no client code deletes profiles. What would settle it: whether any operator or admin path deletes a public.users row without deleting the auth user. The intent requires the INSERT policy be left untouched, so removing the now-callerless policy is out of scope here regardless.
status: done 2026-09-14
resolution: closed by human decision: No client or cascade path produces a profile row without an auth user, the modal surfaces a visible error rather than failing silently, and the INSERT policy is deliberately pinned by supabase/tests/database/25_profile_name_email_ownership.sql:150-153.
decision: 2026-09-14 Unreachable; keep the policy — No client or cascade path produces a profile row without an auth user, the modal surfaces a visible error rather than failing silently, and the INSERT policy is deliberately pinned by supabase/tests/database/25_profile_name_email_ownership.sql:150-153.

### DW-106: Hosted evidence for the migration has not been recorded.
origin: spec-deferred 930d06819af2
location: n/a
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
reason: The story's execution list asks for a hosted refused email PATCH, a hosted own-name change, and green FN-GRANT checks against the hosted project. The migration reaches that project only through .github/workflows/deploy.yml on merge, so this evidence cannot be produced before the branch lands. Outstanding operator action.
status: done 2026-09-15
resolution: closed by human decision: Hosted evidence substituted by local profile-name-email-ownership.spec.ts and pgTAP FN-GRANT checks; deploy.yml migrate has run on main after story 8.
decision: 2026-09-15 Close; accept local tests plus a successful db push — Hosted evidence substituted by local profile-name-email-ownership.spec.ts and pgTAP FN-GRANT checks; deploy.yml migrate has run on main after story 8.

### DW-107: The acceptance criterion "the name shows in chat after reload" is not covered end to end.
origin: spec-deferred 02bb20c02356
location: tests/e2e/auth/display-name-setup.spec.ts
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
reason: display-name-setup.spec.ts asserts the saved profile row and the app container after reload but never navigates to love notes; OwnDisplayName.test.tsx covers the chat rendering with getOwnDisplayName mocked. Closing this needs a partner-linked dedicated account, which the setup spec's throwaway nameless account does not have.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e

### DW-108: The ledger entry migrated from this story's second deferred item lost its severity when it was written to deferred-work.md.
origin: spec-deferred 67f592004a06
location: _bmad-output/implementation-artifacts/deferred-work.md (DW-105)
source_spec: `8-separate-profile-names-from-auth-identity.md`
severity: low
reason: Verified by reading the block: `### DW-105` in _bmad-output/implementation-artifacts/deferred-work.md goes straight from `source_spec:` to `reason:` with no `severity:` line, while DW-104, DW-106 and DW-107 each carry `severity: low`. This spec's frontmatter records that same item as `severity: medium (unverified)`, so DW-105 is the only non-low severity of the four and it is the one the ledger dropped. Not repaired here: this run was instructed not to modify, re-open or rewrite existing ledger entries -- the orchestrator owns them. Raised through this list because it is the only channel back to the owner.
status: done 2026-09-15
resolution: DW-105's `severity: medium (unverified)` restored. Confirmed against the source spec's frontmatter before writing it: the deferred item whose `location:` is `src/components/DisplayNameSetup/DisplayNameSetup.tsx (zero-row branch)` carries that value at `_bmad-output/specs/spec-security-remediation/stories/8-separate-profile-names-from-auth-identity.md:37`.

### DW-109: A phx_leave answered 'error' leaves the channel stuck in `leaving`, yet removeChannel still resolves, so the leave-wait clears and the reopen is handed a channel whose subscribe() is gated shut.
origin: spec-deferred ab6f498a5c7a
location: src/hooks/useRealtimeMessages.ts `releaseNoteChannel`
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: medium
reason: @supabase/phoenix assets/js/phoenix/channel.js:247-249 wires the close hook to "ok" and "timeout" only, so an 'error' leave never reaches `closed` and never runs `socket.remove(this)`. @supabase/realtime-js dist/module/RealtimeChannel.js:604-612 still resolves 'error', and RealtimeClient.js:254-259 skips `teardown()` unless the status is 'ok'. The same hole exists in moodSyncService's closingMoodChannels, which the intent told this work to mirror, so fixing it here alone would diverge the two. The `.catch()` in releaseNoteChannel guards a rejection the SDK never produces, and the test that exercises it uses a shape the real client cannot return.
status: done 2026-09-15
resolution: REFUTED, and the refutation pinned rather than asserted. The wedged-channel state is unreachable on the installed @supabase/phoenix 0.4.5: `leave()` sets `state = leaving` (channel.js:242) before testing `canPush()` (:251), and `canPush()` requires `isJoined()` (:188, :326), so the check is always false and `leavePush.trigger("ok", {})` fires locally and synchronously. The close hook runs, `socket.remove(this)` runs, and `removeChannel` sees 'ok'. Measured: a leave the server never answers still resolves 'ok', still closes the channel, still removes it from the registry, and the next `channel(topic)` builds a fresh object. The sub-claim that both `.catch()`s guard a rejection the SDK cannot produce is TRUE and was acted on — `unsubscribe()` resolves 'ok' | 'timed out' | 'error' with no rejection path (RealtimeChannel.js:604-612) — so both comments now say the catch is a belt rather than the mechanism, and the test that drove a rejection is labelled as defensive. tests/unit/api/realtimeLeaveContract.test.ts turns red if an SDK bump reintroduces the wait.

### DW-110: CLOSED remains an unhandled terminal status, so a close the hook did not ask for leaves the topic permanently silent with no retry scheduled.
origin: spec-deferred 2b5328606176
location: src/hooks/useRealtimeMessages.ts `handleStatus`
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: medium
reason: subscribe() wires `_onClose(() => callback(CLOSED))` (@supabase/realtime-js dist/module/RealtimeChannel.js:148), but handleStatus retries only CHANNEL_ERROR and TIMED_OUT. Pre-existing: the baseline hook ignored CLOSED too. Any fix must distinguish the hook's own deliberate leave from a close it did not initiate, since ignoring CLOSED is load-bearing for the release path.
status: done 2026-09-15
resolution: CONFIRMED and fixed. `RealtimeChannel.js:148` delivers CLOSED to the subscribe callback and `handleStatus` branched only on SUBSCRIBED, CHANNEL_ERROR and TIMED_OUT, so a close the app did not ask for left the topic silent for the rest of the mount with nothing logged. CLOSED now routes into the existing backoff. The entry's warning that ignoring CLOSED is load-bearing for the release path is not hypothetical — every deliberate leave produces one too, measured in realtimeLeaveContract.test.ts — so two guards separate them using state that already existed: the cleanup lowers `subscriptionActive` and the retry nulls `channelRef` before releasing, and `subscribe` is wrapped per channel so a status can be attributed. Written independently of `useScripturePresence`, which AGENTS.md forbids copying. Scoped to this entry's stated location: `moodSyncService` reports the same status but has no retry mechanism to route it into, raised as DW-138.

### DW-111: This is a third uncoordinated per-topic leave registry, against the repo's stated direction to route Realtime work through a shared one.
origin: spec-deferred 5770bf9b09b4
location: src/hooks/useRealtimeMessages.ts `closingNoteChannels`
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: moodSyncService.ts:149 and ephemeralBroadcast.ts already hold their own; interactionService and the scripture hooks still take none. AGENTS.md says to route new Realtime work through moodSyncService's refcounted registry and never call supabase.channel() directly. Extracting the pair into realtimeSocket.ts would cover the whole channel namespace. Pre-existing duplication, widened rather than created by this change.
status: done 2026-09-14
resolution: closed by human decision: Three registries is accepted pre-existing duplication; the realtime-note-channel-lifecycle bundle keeps useRealtimeMessages and moodSyncService in sync by applying the same leave fix to both, and ephemeralBroadcast's send chains serve a different purpose.
decision: 2026-09-14 Accept the duplication and close — Three registries is accepted pre-existing duplication; the realtime-note-channel-lifecycle bundle keeps useRealtimeMessages and moodSyncService in sync by applying the same leave fix to both, and ephemeralBroadcast's send chains serve a different purpose.

### DW-112: realtimeSocket.ts's header rationale quotes SDK behaviour that no longer matches the installed realtime-js, and this change newly depends on it.
origin: spec-deferred c8dd2018bb24
location: src/api/realtimeSocket.ts:1-46
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: The header quotes `RealtimeClient.js:213-219` disconnecting as soon as the last channel is removed. In 2.116.0 removeChannel only tears down on 'ok' (dist/module/RealtimeClient.js:254-259); the disconnect moved to `_remove` -> `_schedulePendingDisconnect`, with `_disconnectOnEmptyChannelsAfterMs` defaulting to 2x heartbeatIntervalMs (:646-647), and `channel()` cancels it (:340). The ~100ms window the helper waits out is likely unreachable on a rejoin now. The gate is cheap and harmless; the comment justifying it should be re-verified.
status: done 2026-09-15
resolution: CONFIRMED, and worse than filed. `realtimeSocket.ts:7-10` quoted `if (this.channels.length === 0) { this.disconnect(); }`, which no longer exists: `removeChannel` only tears down on 'ok' (RealtimeClient.js:254-260), the disconnect moved to `_remove` -> `_schedulePendingDisconnect` and is deferred by `_disconnectOnEmptyChannelsAfterMs`, which defaults to twice the 25s heartbeat and is not overridden here — a 50 SECOND window, not ~100ms — and `channel()` cancels it on reopen (:340). `_setConnectionState` is gone entirely, taking the 100ms fallback timer with it, and `isDisconnecting()` now reads WebSocket.CLOSING directly. The header is rewritten against 2.116.0. `waitForSocketReady` is KEPT: the race it was written for is unreachable on a rejoin, but it still describes a genuinely closing socket, which sign-out produces, and it costs one boolean read. `moodSyncService`'s matching docblock carried the same stale citations and is corrected alongside.

### DW-113: Giving up after five retries is entrenched with no exit and no signal to the UI, and closingNoteChannels is unobservable from tests.
origin: spec-deferred a9a9ffc293cb
location: src/hooks/useRealtimeMessages.ts `handleStatus` max-retry branch, and the hook's return value
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: handleStatus returns after the max-retry check, leaving the errored channel in channelRef and in client.channels, and the hook returns {} so no consumer can tell the feed is dead; moodSyncService at least keeps lastStatus and replays it. closingNoteChannels is unexported, so a wedged entry and an empty map look identical from outside the module. Pre-existing give-up behaviour: the baseline had the same five-retry ceiling and the same empty return value.
status: done 2026-09-15
resolution: fixed in all three halves. The retry ceiling released nothing, leaving the dead channel in `channelRef` and in the client registry — and since a join is gated on the channel being closed, that made the topic unjoinable by any later consumer, not just this hook; it is handed back now. The hook returned `{}`, so its one terminal state was invisible; it now reports a status, `useLoveNotes` passes it through, and `LoveNotes` renders it when the feed is reconnecting or has given up. `closingNoteChannels` stays unexported: the reported status is what makes the wedged state observable, which is what the entry was actually asking for, and the existing leave-wait cases already observe the registry indirectly.

### DW-114: Both DW ledger entries' `location:` fields point at the wrong code, so a future reader reconciling the bundle against the ledger lands in the wrong block.
origin: spec-deferred 35b1312c2b70
location: this ledger, DW-87 and DW-91 `location:` fields (the bundle intent that carried the correct citations was `.bmad-loop/runs/20260914-114531-81a7/`, which is gitignored and no longer readable)
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: Against baseline d3306502, DW-87's cited src/hooks/useRealtimeMessages.ts:190-196 is inside the SUBSCRIBED snapshot comment, not the retry; DW-91's :215-232 is the backoff block, not the cleanup. The intent prose citations (:260, :311, :174) do match the baseline verbatim, and the implementation followed the prose. Not fixed here: this run is directed not to edit the deferred-work ledger.
status: done 2026-09-15
resolution: DW-87's and DW-91's `location:` fields corrected, and re-pointed at symbols with the baseline noted rather than bare line numbers, since the file has changed since d3306502 and a number alone would go stale again. This entry's own location is repaired under DW-115.

### DW-115: The `location:` fields this bundle wrote into the DW ledger are unreliable: one points into a gitignored run directory that cannot be opened later, and the rest land on comment lines or carry no line
origin: spec-deferred 169b5ae59949
location: _bmad-output/implementation-artifacts/deferred-work.md
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: DW-114's location is `.bmad-loop/runs/20260914-114531-81a7/bundles/realtime-channel-rejoin-lifecycle/intent.md`, but `.gitignore` lists `.bmad-loop/runs/`, and AGENTS.md records that a deleted run directory is unrecoverable -- so the one entry whose whole subject is "location fields point at the wrong code" files a location a future reader cannot open. In the same append, DW-111's `src/hooks/useRealtimeMessages.ts:69` is a comment line (the registry it describes is the `const closingNoteChannels` declaration below it), DW-109's `:79-96` starts on a blank docblock line and runs past the end of `releaseNoteChannel`, and DW-110 and DW-113 carry no line range while DW-87, DW-91, DW-109, DW-111 and DW-112 all do. Not repaired here: this run is directed not to modify, re-open or rewrite ledger entries, and the orchestrator owns them.
status: done 2026-09-15
resolution: the six `location:` fields corrected. DW-109, DW-110, DW-111 and DW-113 now name symbols rather than line numbers or nothing, which is what survives an edit to the file. DW-114's location no longer points into `.bmad-loop/runs/`, which is gitignored and, per AGENTS.md, unrecoverable once deleted — it names this ledger and records that the bundle intent carrying the correct citations is no longer readable.

### DW-116: The ledger's own reason text states that the run must not edit the ledger, while the same change rewrites two entry statuses and appends six new entries to it.
origin: spec-deferred e17ee324ad13
location: _bmad-output/implementation-artifacts/deferred-work.md
source_spec: `spec-dw-87-91-realtime-channel-rejoin-lifecycle.md`
severity: low
reason: DW-114's reason reads "Not fixed here: this run is directed not to edit the deferred-work ledger", and the DW-105 entry above it reads "this run was instructed not to modify, re-open or rewrite existing ledger entries -- the orchestrator owns them"; the same diff sets DW-87 and DW-91 to `status: done 2026-09-14` with `resolution:` and `resolution-undo:` lines and appends DW-109 through DW-114. Both statements are true of different edits -- the run does not touch OTHER entries, while its own done-markers and new entries are exactly what it is supposed to write -- but neither says so, so the next reader meets a file that contradicts itself. Needs a sentence distinguishing the edits the run owns from the ones it does not; the orchestrator owns that text.
status: done 2026-09-15
resolution: a paragraph at the top of this file now states which edits a run owns — its own entries' status/resolution, and its own appends — and which belong to the orchestrator. The contradiction the entry describes was real and both halves were true of different edits; what was missing was anyone saying so.

### DW-117: An eighth site, src/services/moodSyncPayload.ts:58, reads MoodEntry.moods with the same bare truthy-plus-length idiom and was left unguarded.
origin: spec-deferred 717f9a6f63ec
location: src/services/moodSyncPayload.ts:58
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
reason: `const moodTypes = mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood];` reads the same field as the seven converted sites. Its output is both the sync request body (src/api/moodSyncService.ts:197, src/sw.ts:169) and the change-detection fingerprint (moodSyncPayload.ts:85-86), so a truthy non-array would be sent to the server verbatim. Pre-existing and outside this bundle's four named sites: it feeds a payload, not a MOOD_CONFIG deref. No local writer can produce a non-array today -- addMoodEntry takes MoodType[] (moodSlice.ts:38). Every existing test feeds it a real array or undefined.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: src/services/moodSyncPayload.ts now projects through the shared normalizer (normalizeMoodValues) and throws before the network on a row with no recognized values, replacing the bare truthy-plus-length idiom.

### DW-118: The guard tests the container, not the elements: a genuine MoodType[] holding an unknown mood string still throws at every one of the seven sites.
origin: spec-deferred cc319fe80d55
location: src/components/MoodHistory/MoodDetailModal.tsx:152, src/components/MoodHistory/CalendarDay.tsx:103
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: medium
reason: MoodDetailModal.tsx:152-157 runs `MOOD_CONFIG[m].icon` per element, CalendarDay.tsx:103 runs `MOOD_CONFIG[primaryMood].bgColor`, and MoodTracker.tsx renders `selectedMoods.map((m) => MOOD_CONFIG[m].label)`. Array.isArray says nothing about element validity. The Supabase path is protected by MoodTypeSchema, but the IndexedDB path that feeds these three components applies no schema. Pre-existing and identical at the three sites that adopted the guard earlier, so not caused by this change. What would settle reachability: whether a stored IndexedDB row can hold a mood string outside the MOOD_CONFIG keys -- for example a retired mood key left behind by an older app version.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: src/types/moods.ts is one canonical twelve-key vocabulary with element-level validation; all seven consumers normalize through it, so an unknown mood string can no longer reach a MOOD_CONFIG lookup. Covered by tests/unit/services/moodNormalization.test.ts and the display cases in moodArrayGuards.test.tsx.

### DW-119: The offline-first IndexedDB read path normalizes nothing, so the three components that read it each carry their own per-consumer guard instead.
origin: spec-deferred 7af76122fac6
location: src/services/moodService.ts:255
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
reason: moodSlice.loadMoods (moodSlice.ts:160-171) calls moodService.getAllForUser (src/services/moodService.ts:255-264), which filters by userId and returns raw rows with no shape check, and the same is true of getMoodsInRange as called from MoodHistoryCalendar.tsx:81. The Supabase side is normalized at its boundary; the larger path is not. Deferred rather than fixed because the intent scoped this bundle to four named consumer sites and framed the work as defensive hardening at those sites.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: the offline-first IndexedDB read path normalizes at the service boundary — moodService display reads return normalized copies and hide wholly invalid rows, while the raw pending queues keep them for accounting — so the per-consumer guards are no longer each component’s own problem.

### DW-120: DW-117 dismisses itself with an argument DW-119 contradicts: moodSyncPayload is fed from the unvalidated IndexedDB path, not from addMoodEntry, so its real exposure is higher than filed.
origin: spec-deferred 23b5564b69a8
location: src/services/moodSyncPayload.ts:58, src/api/moodSyncService.ts:337
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: medium
reason: DW-117 argues "No local writer can produce a non-array today -- addMoodEntry takes MoodType[]". That reasons about the writer's signature, but the read path is IndexedDB: src/api/moodSyncService.ts:337 `const unsyncedMoods = await moodService.getUnsyncedMoods(currentUserId);` feeds :186 `const moodInsert: MoodInsert = moodSyncPayload(mood, mood.userId);`. That is the same path DW-119 says normalizes nothing. Either the IndexedDB path can hold a non-array -- in which case moodSyncPayload ships it into the request body and the change fingerprint, a worse outcome than a render crash -- or it cannot, in which case the four guards this bundle added are equally unreachable. The two entries argue from mutually exclusive premises. Secondary: the cited signature is at moodSlice.ts:39, not :38 (:38 is the comment `// Actions`), and reads `MoodEntry['mood'][]`. Not fixed here: the intent forbids touching moodSyncPayload.ts:58, and this run is directed not to edit the ledger.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: the contradiction is settled the way this entry framed it. moodSyncPayload is fed from the IndexedDB path, so it validates there: the shared payload/fingerprint projection now normalizes and fails before either writer sends. Closed together with DW-117 and DW-119 rather than as separate work.

### DW-121: Nothing pins the Array.isArray idiom, so the consistency this bundle bought decays on the next PR that copies the surviving truthy form.
origin: spec-deferred 40c86f3fe220
location: eslint.config.js, src/services/moodSyncPayload.ts:58
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
reason: The change's only stated value is that "a reader copying the idiom can no longer copy the wrong one", but the wrong one is still in the tree: src/services/moodSyncPayload.ts:58 reads `const moodTypes = mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood];`. No lint rule, no-restricted-syntax entry, or grep-based test enforces the invariant. Not fixed here: any enforcement is config surface beyond the intent's "one-expression shape guard per site", and the rule would immediately flag the one line the intent forbids touching.
status: done 2026-09-15
resolution: SUPERSEDED, no lint rule added. The entry's premise is that the wrong idiom survives at `src/services/moodSyncPayload.ts:58`, `mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood]`. Commit 5dd934b0 replaced that line with `normalizeMoodValues(mood.mood, mood.moods)`; `grep -rn "\.moods && .*\.moods\.length" src/` now returns nothing, and the single array-shape decision lives at `src/types/moods.ts:29`. There is no surviving form to copy, so the rule would pin an invariant that already has exactly one home.

### DW-122: Seven hand-rolled copies of one expression and four separate MOOD_CONFIG definitions mean DW-118's element validation would need four key sets rather than one.
origin: spec-deferred 0ac06de3be9c
location: src/components/MoodHistory/CalendarDay.tsx:23, src/components/MoodTracker/MoodTracker.tsx:57
source_spec: `spec-dw-89-mood-array-shape-guards.md`
severity: low
reason: All seven guarded sites hand-roll `Array.isArray(x) && x.length > 0 ? x : [fallback]`: moodSlice.ts:394, CalendarDay.tsx:79, MoodDetailModal.tsx:97, PartnerMoodView.tsx:673, PartnerMoodDisplay.tsx:112, MoodTracker.tsx:177, MoodHistoryItem.tsx:44. MOOD_CONFIG is itself defined four times -- MoodDetailModal.tsx:27, CalendarDay.tsx:23, PartnerMoodView.tsx:35, MoodTracker.tsx:57 (measured with grep). A single normalizeMoods() would collapse the expression and turn DW-118 into a one-line change. Not fixed here: the intent scopes this to a one-expression shape guard per site and forbids type-level changes, so extracting a shared normalizer is a different piece of work.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: src/types/moods.ts holds the single normalizer and vocabulary; the seven hand-rolled copies of the expression now call it. The four MOOD_CONFIG definitions are kept deliberately — they carry different per-surface icons and styling — but are typed against the one MoodType.

### DW-123: The sibling private-broadcast path, mood-updates:<partnerId>, still has no browser-level Realtime coverage; DW-90 is closed for love notes only.
origin: spec-deferred de21e27d0575
location: tests/e2e/partner/partner-mood.spec.ts
source_spec: `spec-dw-90-realtime-browser-e2e.md`
severity: low
reason: src/api/moodSyncService.ts:257 runs the same composition (private topic, sendEphemeralBroadcast, store, UI) under the same policy migration 20260912010000_private_couple_broadcast_policies.sql, whose predicates cover both prefixes. grep -c "realtime\|broadcast" tests/e2e/partner/partner-mood.spec.ts returns 0, and the only other tests/e2e files mentioning realtime are the interaction specs, whose own header states they do not exercise live Realtime. Pre-existing: this story's intent names one deliverable, "sends a love note from one context and asserts it arrives live in the other", so the mood leg was never in scope for it.
status: done 2026-09-15
resolution: tests/e2e/partner/partner-mood-realtime.spec.ts, the sibling of the notes spec DW-90 produced. Two contexts from this worker's own pooled pair, the receiver parked until PartnerMoodView reports SUBSCRIBED on the console, the 202 asserted before the UI, and the receiving page never reloaded. Verified non-vacuous: with the sender untouched and the receiver listening for a different event name, the send still answers 202 and the delivery assertion fails.

### DW-124: `resetPasswordForEmail` composes the same `origin + BASE_URL` prefix as the Google flow, but its composed link is asserted at no base, production or dev.
origin: spec-deferred 6d932a2a3909
location: src/api/auth/actionService.ts:97
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: low
reason: `src/api/auth/actionService.ts:97` is ``redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password` ``, and the path join is correct only because `BASE_URL` ends in `/`. Measured: `grep -rn "reset-password" tests/ src/` (excluding `tests/e2e-archive/`) returns that one source line and nothing under `tests/`; the only other reference, `src/api/auth/__tests__/authServices.test.ts:41`, registers `resetPasswordForEmail` as a mock and never inspects its options. Pre-existing: the DW-97 intent names only the authorize URL's `redirect_to`, so this change neither caused nor exposed it. Settle by adding a sibling case that stubs `BASE_URL` to the production base and asserts the reset link is `http://localhost:3000/My-Love/reset-password`.
status: done 2026-09-15
resolution: a sibling case in tests/unit/api/supabaseClientAuthFlow.test.ts pins the composed reset link at the production base, copying the authorize-URL case's `loadConfigFromFile` binding and env leak guard, and capturing `redirect_to` from the recover request rather than restating the template. Verified: dropping BASE_URL from `actionService.ts:97` turns it red.

### DW-125: `navigationSlice.setView`'s production branch and `App.getRoutePath`'s base-stripping branch read the same `import.meta.env.BASE_URL` this story pinned for the authorize URL, and neither branch is
origin: spec-deferred 198ce5879b5a
location: src/stores/slices/navigationSlice.ts:63, src/App.tsx:179-180
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: medium
reason: `src/stores/slices/navigationSlice.ts:63` is `const fullPath = base === '/' ? basePath : base.slice(0, -1) + basePath;` and `src/App.tsx:179-180` is `if (base !== '/' && pathname.startsWith(base)) { return pathname.slice(base.length - 1); }`. Both are production-only branches: every test runs at `BASE_URL === '/'`, which takes the other arm each time. Demonstrated by the review's verification-gap layer -- rewriting `navigationSlice.ts:63` to `base + basePath` and `App.tsx:180` to `return pathname;` left `npx vitest run` at 91 files / 1705 passed, both mutants green. On the deployed site those two edits emit `/My-Love//photos` and then fail base-stripping on reload, so no `currentView` arm matches and the app resets to home. E2E cannot reach it either: `playwright.config.ts:178` is `command: 'npx vite --mode test'` and `vite.config.ts:11` serves `/` off production. Pre-existing: this story's intent names only the authorize URL's `redirect_to` and its Never forbids touching `src/`, so
status: done 2026-09-15
resolution: both production branches now covered, and the cause fixed rather than the symptom. They are inverse operations that lived in different files with nothing asserting either, which is why the round trip — the property that actually matters — could not be expressed at all; they are now `withBasePath` and `stripBasePath` in `src/utils/basePath.ts`, used by both call sites. tests/unit/utils/basePath.test.ts stubs BASE_URL to the production base with hard-coded expectations rather than interpolating it on both sides. Both mutants the entry named now fail. This is unit-level evidence, not deployed-site evidence: no browser runs at the production base, and DW-93 still carries the hosted half.

### DW-126: DW-97's ledger entry names two files and is closed whole, but only the unit half was addressed and the resolution line records neither the carve-out nor the substituted settle mechanism.
origin: spec-deferred 59ad7c8a9014
location: _bmad-output/implementation-artifacts/deferred-work.md (DW-97)
source_spec: `spec-dw-97-production-base-redirect-assertion.md`
severity: low
reason: DW-97's `location:` is `tests/unit/api/supabaseClientAuthFlow.test.ts / tests/e2e/auth/google-oauth.spec.ts` and its reason covers `both new assertions`. Verified: `tests/e2e/auth/google-oauth.spec.ts:68` still reads `expect(authorizeParams.get('redirect_to')).toBe(appBaseUrl + '/');` and this story's Never excludes it deliberately (`the deployed-origin round-trip stays operator work under DW-93`). Separately, DW-97's reason ends `Settle by asserting the authorize URL's redirect_to once against a production-mode build, or by reading it during the outstanding deployed-site sign-in.` -- what shipped is a stubbed `BASE_URL` under happy-dom bound to `vite.config.ts` via `loadConfigFromFile`, which is neither. The rationale for accepting that substitution lives only in this spec's triage log, not in the ledger a later sweep reads. Not fixable from this session: the orchestrator owns ledger entry status and resolution text, and this story's Never forbids editing the ledger. Settle by
status: done 2026-09-15
resolution: DW-97's resolution line rewritten to record both the E2E carve-out and the substituted settle mechanism. See that entry.

### DW-127: storageService.updateMessage merges `updates` unfiltered, so a caller who may see a row can reassign its owner or convert a shared daily row into a private one.
origin: spec-deferred 33d30b016bed
location: src/services/storage.ts:275
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
reason: src/services/storage.ts:275 writes `{ ...message, ...updates, id: message.id }`. The id is now pinned to the checked row, but `userId` and `isCustom` still pass straight through, so `updateMessage(myRowId, { userId: other }, me)` donates a row and `updateMessage(dailyId, { isCustom: true, userId: me }, me)` takes a shared bundled row out of the partner's rotation pool. Pre-existing: the unfiltered spread predates this change. The repo's stronger door already solves it with an explicit field allowlist at src/services/customMessageService.ts:335-342. No production caller passes arbitrary `updates` today — src/stores/slices/messagesSlice.ts:138 is the only production call of any of the four methods, and it calls toggleFavorite.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: storageService.updateMessage now requires signed-in ownership of a custom row and applies an editable-field allowlist, so protected fields including the owner cannot be reassigned, and a denied or missing write throws instead of silently succeeding.

### DW-128: Shared daily rows stay arbitrarily updatable and deletable by every caller, signed out included, because the by-id guard enforces visibility rather than ownership.
origin: spec-deferred 831a770c8b3c
location: src/services/storage.ts:261,291
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
reason: src/services/storage.ts isVisibleTo returns true unconditionally for `!isCustom` rows, so `deleteMessage(dailyId, null)` and `updateMessage(dailyId, { text }, B)` both succeed. The rule had to be visibility for toggleFavorite — Home favorites the daily message through it (src/components/DailyMessage/DailyMessage.tsx:157) — but updateMessage and deleteMessage have no production caller and were widened on that same rationale. The repo holds both rules at once: tests/unit/services/customMessageService.ownership.test.ts:326 asserts the same daily row is NOT editable through customMessageService. A deleted daily row does not heal: src/stores/slices/settingsSlice.ts:129 re-seeds only when the whole visible set is empty. Settle by deciding whether the two callerless writers should take customMessageService's stricter isOwnedBy rule (src/services/customMessageService.ts:110).
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: readable shared daily rows are separated from writable owned custom rows. Generic update and delete enforce ownership rather than visibility; favoriting no longer routes through updateMessage and has its own account-keyed write.

### DW-129: One row-level isFavorite flag is shared by every account on a device, so each partner sees and can clear the other's favorited daily messages.
origin: spec-deferred c98a4ba7aa0c
location: src/types/index.ts:21
source_spec: `spec-dw-99-message-store-ownership-scoping.md`
severity: medium
reason: src/types/index.ts:21 gives Message a single `isFavorite` boolean and the bundled daily rows are shared by both accounts, so toggleFavorite on a daily row writes a flag the partner reads. Pre-existing and schema-level — the fix is per-account favorite storage, well past this change's service boundary.
status: done 2026-09-15
resolution: resolved on branch fix/account-data-mood-validation: favorites moved to a dedicated message-favorites store keyed [messageId, userId] with a by-account index, added by the existence-gated v8→9 upgrade in dbSchema.ts. The one-time migration carries only known-owner custom favorites and never assigns unattributed shared flags; sign-out scrubs the projections and favoriteIds is no longer persisted or hydrated.
decision: 2026-09-14 Build per-account favorites — Move favorite state off the shared Message row onto per-account storage. Add a favorites store or index keyed on (messageId, userId) in src/services/dbSchema.ts alone, bumping DB_VERSION and gating the upgrade branch on whether the store exists rather than on oldVersion < N, and plan how the existing shared isFavorite booleans on daily rows are carried over or dropped. Then update storage.ts's toggleFavorite and getMessage, messagesSlice.ts's toggleFavorite and messageHistory.favoriteIds, and the UI readers including DailyMessage.tsx, and make sure the new account-scoped field is added to signedOutState() in authSlice.ts in the same commit so a sign-out does not leak it.
decision: 2026-09-14 Build per-account favorites — Move favorite state off the shared Message row onto per-account storage. Add a favorites store or index keyed on (messageId, userId) in src/services/dbSchema.ts alone, bumping DB_VERSION and gating the upgrade branch on whether the store exists rather than on oldVersion < N, and plan how the existing shared isFavorite booleans on daily rows are carried over or dropped. Then update storage.ts's toggleFavorite and getMessage, messagesSlice.ts's toggleFavorite and messageHistory.favoriteIds, and the UI readers including DailyMessage.tsx, and make sure the new account-scoped field is added to signedOutState() in authSlice.ts in the same commit so a sign-out does not leak it.

### DW-130: A display name can be set once at signup and never changed, because the only form that writes it is unreachable afterwards.
origin: operator report during post-merge verification of sweep 7, 2026-09-14
location: src/App.tsx:581
severity: medium
reason: `DisplayNameSetup` is the only UI that writes `display_name`, and src/App.tsx:581 renders it only when `needsDisplayName`, which src/App.tsx:301 sets solely on `result.status === 'unset'`. Nothing under src/components/Settings/ references display_name, so once a name is chosen there is no route back to that form. The backend already supports the change and needs no work: policy `users_update_self_safe` is `USING ((select auth.uid()) = id)`, `authenticated` holds UPDATE on only (display_name, updated_at) on the hosted project, and DisplayNameSetup.tsx:102-108 already issues `.update({ display_name, updated_at }).eq('id', user.id)`. The work is a settings entry point that reopens that form prefilled with the current name -- no schema, migration or grant change. Any edit surface must keep the write-side refusal of a name equal to the account email (DisplayNameSetup.tsx:85), because supabaseClient.ts:373-376 classifies a stored name equal to SEED_FALLBACK_NAME or the account email as 'unset' and would otherwise re-prompt the user forever. Related: DW-104, where a partner who never chose a name renders as their full email address in the love-notes chat.
status: done 2026-09-14
resolution: resolved by sweep bundle dw-display-name-edit-and-fallback
resolution-undo: 2a5be6a21fc8557ab95cbf923102fd327464ac93f3ac85eee86f2e3bd7896463 2026-09-14 7374617475733a206f70656e

### DW-131: A `?code=` whose exchange fails in the browser that started the flow -- the ordinary expired-or-reused code -- still ends on the login screen with nothing to read.
origin: spec-deferred 1af676a73b92
location: src/api/supabaseClient.ts:161
source_spec: `spec-dw-95-96-auth-callback-messages.md`
severity: medium
reason: `getAuthCallbackOutcome` returns null for it (`src/api/supabaseClient.ts:161`, the `error ||` half of the guard), and a unit case now pins that answer. Pre-existing: every callback was silent before this change, and the bundle scoped the fix to exactly two outcomes, so naming a third is a product decision rather than a correction. Probably the most common real callback failure. Settle by deciding whether a third recoverable message is wanted and what it should say.
status: done 2026-09-15
resolution: a third outcome, `code-expired`, with its own copy. The branch is wider than the name — any exchange failure lands there, a GoTrue 5xx included — and the message still names expiry because the recovery is identical whichever it was, and copy vague enough to cover every cause would be indistinguishable from `provider-error`. An error on a load carrying no callback at all stays silent, as before. Closes the incidental gap that `provider-error` had no render coverage.

### DW-132: A password sign-in that resolves with neither an error nor a session leaves the login screen with no feedback at all, and now also clears the callback notice.
origin: spec-deferred 50f5b0ba3a4a
location: src/components/LoginScreen/LoginScreen.tsx:88-103
source_spec: `spec-dw-95-96-auth-callback-messages.md`
reason: `LoginScreen.handleSubmit` branches on `result.error` then `result.session` (`src/components/LoginScreen/LoginScreen.tsx:88-103`) with no else, and `setNoticeDismissed(true)` has already run. The dead-end branch predates this change; the change only adds the cleared notice. Unverified: nothing was found that makes `signInWithPassword` answer with neither, so the state may be unreachable. Settle by checking whether any GoTrue path (MFA challenge, unconfirmed identity) returns a null session with a null error, and adding an else branch if so.
status: done 2026-09-15
resolution: REFUTED at the installed SDK, and guarded anyway. `dist/module/GoTrueClient.js:960-962` (the build Vite resolves; the CJS build is the same code at different offsets) substitutes an `AuthInvalidTokenResponseError` for exactly the null-session/null-error shape before it can reach a caller, and all four returns in `signInWithPassword` carry an error or a session — so the missing `else` is unreachable through auth-js 2.116.0. The `else` was added regardless, because `AuthResult` (src/api/auth/types.ts:8-12) declares both fields nullable and the SDK is pinned only by `^2.116.0`. Its test stubs `actionService.signIn`, our own boundary, rather than mocking an SDK state that cannot occur.

### DW-133: A third reader of `users.display_name` still renders a seeded partner's own email address as their name, on the partner-mood surface.
origin: spec-deferred 6ea62add7c44
location: src/api/partnerService.ts:88 (rendered at src/components/PartnerMoodView/PartnerMoodView.tsx:535,565,628)
source_spec: `spec-dw-104-107-130-display-name-edit-and-fallback.md`
severity: medium
reason: `partnerService.getPartner` builds `displayName: partnerRecord.display_name || partnerRecord.email || 'Partner'`, applying no seed rule, and that value reaches `partnerSlice` and is rendered as "<name>'s Moods" and "Connected with <name>". For the exact DW-104 couple -- a partner row still carrying `sync_user_profile()`'s email seed -- love notes now correctly shows 'Partner' while the partner-mood view still shows the full address from the same stored row. No test reaches that `||` chain: the store test stubs `getPartner` with fixtures that already carry a displayName, and the only spec rendering PartnerMoodView passes `partner: null`. Pre-existing and outside this bundle's intent, which names `getPartnerDisplayName` alone.
status: done 2026-09-15
resolution: `partnerService.getPartner` now applies `isSeedFallbackName`, the predicate `getPartnerDisplayName` has used since DW-104, so the two readers of `PartnerInfo.displayName` cannot disagree again. Narrower than this first read: `partnerService.ts:155` (`searchUsers`) and `:274` (the request user map) still compose `display_name || email || 'Unknown'`, and `searchUsers` renders at `PartnerMoodView.tsx:426`. Those are deliberately left alone — in a list of people to search for and link with, the address is the identifier you are searching by, not a name standing in for someone you already know — but "the readers of that column" was too broad and is corrected. The `||` chain never fell through because the seed is a non-empty string in all three COALESCE cases. `getPartner` had no test at all; the new one repeats the sibling contract's seed table verbatim, and 9 of its 14 cases fail against the old chain.

### DW-134: Two sibling destructive buttons still fail WCAG AA contrast with white text on `bg-red-500`.
origin: spec-deferred b30b9041cf61
location: src/components/Settings/AnniversarySettings.tsx:207 and src/components/PhotoGallery/PhotoViewer.tsx:671
source_spec: `spec-dw-104-107-130-display-name-edit-and-fallback.md`
severity: low
reason: Measured against this repo's Tailwind 4.3.3 palette: `--color-red-500` is `oklch(63.7% 0.237 25.331)` = #fb2c36, which is 3.82:1 against #ffffff -- below the 4.5:1 AA floor, and the exact figure axe reported for the events delete-confirm button before it was moved to `bg-red-600` (#e7000b, 4.76:1) in this change. The same `bg-red-500` + `text-white` pairing remains on the anniversary reset button and the photo delete button. Neither sits under an axe scan today, so both are silently non-compliant. Pre-existing; only the events button was touched here because only it was under a scan this change's page-height increase brought into evaluation.
status: done 2026-09-15
resolution: both buttons moved to bg-red-600/hover:bg-red-700, the precedent set in 2f56c7df. Computed from the installed palette and matching this entry's figures: red-500 is #fb2c36 at 3.82:1, red-600 is #e7000b at 4.76:1. No axe scan was added — AnniversarySettings carries no test ids and the one existing axe spec scopes itself away from that component on purpose — so the guard generalises instead: tests/unit/a11y/whiteOnColorContrast.test.ts measures every text-white + bg-<colour>-<shade> pairing in src/ against the palette read from node_modules at run time. Six pairings were already below the floor. Two are in the frozen scripture feature and excluded wholesale; four are recorded with measured ratios and raised as DW-139, DW-140, DW-141 and DW-142. Two of those four were invisible to the guard as first written — it matched only `className="…"` and read only Tailwind's built-in palette — which independent review caught before this landed.

### DW-135: initializeApp's mid-flight cases all change userId as well as authSessionVersion, so dropping the version half of stillCurrent() in settingsSlice stays green.
origin: spec-deferred c2486f7a296d
location: tests/unit/stores/settingsSlice.initializeApp.test.ts:215-335
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: medium
reason: The three mid-flight cases at settingsSlice.initializeApp.test.ts:215-335 set userId to USER_C or null whenever they bump authSessionVersion. toggleFavorite has a same-account re-login case; initializeApp does not. Pre-existing in 84e6c8ea, not introduced by this pass.
status: done 2026-09-15
resolution: SUPERSEDED by commit dfca89a9, and verified by mutation rather than by reading. `tests/unit/stores/settingsSlice.initializeApp.test.ts` now carries a version-only case (userId unchanged, authSessionVersion bumped); deleting the version half of `stillCurrent()` turns three cases red.

### DW-136: No case changes identity a second time while the stale-path loadMessages() handoff is in flight, so deleting the inner pair recheck in the .then() stays green.
origin: spec-deferred 2102472b0dc6
location: src/stores/slices/settingsSlice.ts:163-165
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: low
reason: settingsSlice.ts:163-165 re-checks userId and authSessionVersion before updateCurrentMessage(). The three handoff cases settle the handoff under a still-current incoming identity. Pre-existing in 84e6c8ea.
status: done 2026-09-15
resolution: SUPERSEDED by commit dfca89a9, verified by mutation. "withholds the handoff completion when a second version-only change lands" drives a second identity change while the handoff is in flight; deleting the inner recheck in the `.then()` turns it red.

### DW-137: Nothing makes the initializeApp stale-path handoff chain reject, so deleting its .catch() stays green. The test double's loadMessages also does not swallow errors the way production does.
origin: spec-deferred 8dae3341d08c
location: src/stores/slices/settingsSlice.ts:171-173
source_spec: `spec-dw-100-101-store-identity-guard-gaps-2.md`
severity: low
reason: settingsSlice.ts:171-173 attaches .catch() because nothing awaits the chain. settingsSlice.initializeApp.test.ts:124-132's loadMessages rethrows into that catch, unlike messagesSlice.ts:97-99 which swallows. Pre-existing in 84e6c8ea.
status: done 2026-09-15
resolution: SUPERSEDED by commit dfca89a9, verified by mutation: deleting the `.catch()` turns "handles a thrown handoff completion without an unhandled rejection" red. The entry's second half was still true and is fixed — the test double's `loadMessages` rethrew where production swallows (messagesSlice.ts:105-107 — the `catch` block itself; `:104` is the line above it), which gave the chain a rejection route production does not have. It now swallows, and the mutant still dies, so the case was passing for the right reason.

### DW-138: moodSyncService reports an unsolicited CLOSED but has no rejoin for it, so a mood topic closed by the server stays silent for the life of the page.
origin: raised while closing DW-110, 2026-09-15
location: src/api/moodSyncService.ts `subscribeMoodUpdates`, the `.subscribe((status) => ...)` callback
severity: medium
reason: DW-110 was fixed at its stated location, `useRealtimeMessages`, where a CLOSED now routes into the hook's existing backoff. The mood path has the same hole and no backoff to route into: the subscribe callback records `lastStatus` and fans the status out to subscribers, and `PartnerMoodView.tsx:210` maps CLOSED to a `disconnected` indicator, but nothing reopens the channel. Measured against the installed SDK in tests/unit/api/realtimeLeaveContract.test.ts: a server-initiated `phx_close` moves the channel to `closed`, removes it from the client registry, and schedules no rejoin — so the partner's moods stop arriving until the view is remounted, with the indicator the only sign. Not fixed while closing DW-110 because building a retry loop in the refcounted registry is a different change from adding a branch to one that already exists, and DW-110's `location:` names the hook alone. Settle by giving the registry a bounded reopen, or by deciding the indicator is sufficient and recording that.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-mood-channel-closed-rejoin
resolution-undo: 51b235da13de19eaafbd6598d967c09b0a0ea129dff00b8d127e53b16b7dc772 2026-09-15 7374617475733a206f70656e

### DW-139: A non-destructive badge pairs white text with bg-purple-500, at 4.12:1.
origin: raised while closing DW-134, 2026-09-15
location: src/components/InteractionHistory/InteractionHistory.tsx:183
severity: low
reason: `<div className="rounded-full bg-purple-500 px-3 py-1 text-xs font-medium text-white">`. Measured from the installed Tailwind palette: `--color-purple-500` is oklch(62.7% 0.265 303.9) = #ad46ff, 4.12:1 against white — below the 4.5:1 AA floor, and at `text-xs` it is small text, so the 3:1 large-text allowance does not apply. Pre-existing and outside DW-134, which named two destructive buttons. Allowlisted in tests/unit/a11y/whiteOnColorContrast.test.ts with its measured ratio, and that allowlist fails if the pairing is fixed without removing the entry. Settle by moving to purple-600 or darker, the way DW-28 moved the pink family and DW-134 the red.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-badge-contrast-shades
resolution-undo: 8f95a4b0e2a9d093a35cedfb5015a1e19979fec05a43e48b1f65f7842ad21ff3 2026-09-15 7374617475733a206f70656e

### DW-140: The partner-mood action button pairs white text with bg-green-500, at 2.22:1.
origin: raised while closing DW-134, 2026-09-15
location: src/components/PartnerMoodView/PartnerMoodView.tsx:497
severity: medium
reason: `className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-2 font-medium text-white transition-colors hover:bg-green-600"`. Measured from the installed palette: `--color-green-500` is oklch(72.3% 0.219 149.579) = #00c950, 2.22:1 against white — less than half the AA floor and materially worse than the 3.82:1 that DW-134 was raised for. Not the worst in the tree, though this entry claimed so when first written: DW-141's coral-500 send button is 1.99:1. That claim was made while the contrast guard could not see the project's own palette, and is corrected here. Severity is medium rather than low on that ratio alone: measured from the same palette, green-600 is 3.22:1 and still fails, and green-700 is 4.94:1 and clears — so unlike the red family, where one step sufficed, this needs a two-step move and a look at how it reads next to the surrounding UI. Pre-existing and outside DW-134's two named buttons. Allowlisted in tests/unit/a11y/whiteOnColorContrast.test.ts with its measured ratio. Settle by moving to green-700 or darker, or by darkening the text instead of the ground.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-140
resolution-undo: 41a640e02e5ef2a3bfed871e706e818fa110f554685606288daf3cae7e548eb0 2026-09-15 7374617475733a206f70656e
decision: 2026-09-15 Darken the ground to green-700 / hover green-800 — Change the Accept button to bg-green-700 hover:bg-green-800 text-white, re-measure against the installed palette, and remove the PartnerMoodView.tsx:green-500 KNOWN_BELOW_FLOOR row so the honesty test stays true. Leave coral, purple, blue, and the primary gradient alone.

### DW-141: The love-notes send button pairs white text with bg-coral-500, at 1.99:1 — the worst contrast in the app, and not fixable by a shade bump.
origin: raised while closing DW-134, 2026-09-15
location: src/components/love-notes/MessageInput.tsx:269
severity: medium
reason: `className="bg-coral-500 hover:bg-coral-600 focus:ring-coral-500 disabled:hover:bg-coral-500 min-h-[44px] rounded-lg px-6 py-2 font-medium text-white ..."`. `coral` is a project colour, not a Tailwind one — `tailwind.config.js:20`, reached through `src/index.css:4` `@config '../tailwind.config.js'`. Measured from that file: `coral-500` is `#ffa07a`, 1.99:1 against white, less than half the 4.5:1 AA floor and worse than DW-140's green-500. This is the primary action of the love-notes screen. Unlike the red family, where DW-134 moved one step from 500 to 600, no step fixes it: measured across the whole ramp, coral-600 is 2.5:1, coral-700 is 2.95:1, coral-800 is 3.79:1, and only coral-900 (`#c44536`) clears at 4.94:1 — a colour far darker than the brand's coral. So this is a design decision, not a class edit: either the button stops being coral, or the label stops being white. Allowlisted in tests/unit/a11y/whiteOnColorContrast.test.ts with its measured ratio. Settle by choosing between a darker ground and dark text on coral.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-141
resolution-undo: 3a81584d964cd09861eb5d3d1b59ee312b892f68054f4b2bec7ae3c377aeb673 2026-09-15 7374617475733a206f70656e
decision: 2026-09-15 Keep coral-500; switch the Send label to dark text — Keep the brand coral-500 ground on the love-notes Send button and replace text-white with a dark text colour that clears 4.5:1 against #ffa07a. Remove the MessageInput.tsx:coral-500 KNOWN_BELOW_FLOOR row. Decide in the same session whether LoveNoteMessage and MessageList bg-[#FF6B6B] text-white stay as hex or join the same treatment.

### DW-142: The photo owner badge pairs white text with bg-blue-500/90 over a photograph, at 3.76:1 even before the photo shows through.
origin: raised while closing DW-134, 2026-09-15
location: src/components/PhotoGallery/PhotoGridItem.tsx:100
severity: low
reason: `photo.isOwn ? 'bg-pink-600 text-white' : 'bg-blue-500/90 text-white'` — the second arm only. Measured from the installed palette: `--color-blue-500` is oklch(62.3% 0.214 259.815) = #2b7fff, 3.76:1 against white at full opacity, below the 4.5:1 floor and below even the 3.82:1 that DW-134 was raised for; the badge is `text-xs`, so the large-text allowance does not apply. The true ratio is worse and not knowable from the class alone, because `/90` lets the photograph behind it through, and the opaque figure is the optimistic bound. The `isOwn` arm, `bg-pink-600` (#e60076), clears at 4.54:1 — so the two arms of one conditional disagree about the standard. Allowlisted in tests/unit/a11y/whiteOnColorContrast.test.ts. Settle by moving the second arm to blue-600 or darker, measured the same way the first arm evidently was.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-dw-badge-contrast-shades
resolution-undo: 8f95a4b0e2a9d093a35cedfb5015a1e19979fec05a43e48b1f65f7842ad21ff3 2026-09-15 7374617475733a206f70656e

### DW-143: The app's primary call-to-action is a gradient whose every point fails AA, in ten components, while its own hover state passes.
origin: raised while closing DW-134, 2026-09-15
location: src/components/DailyMessage/DailyMessage.tsx:133 and :260, src/components/WelcomeSplash/WelcomeSplash.tsx:110, src/components/WelcomeButton/WelcomeButton.tsx:46, src/components/PhotoGallery/PhotoGallery.tsx:309, src/components/ErrorBoundary/ErrorBoundary.tsx:67, src/components/ViewErrorBoundary/ViewErrorBoundary.tsx:61, src/components/AdminPanel/AdminPanel.tsx:149, src/components/AdminPanel/CreateMessageForm.tsx:230, src/components/AdminPanel/EditMessageForm.tsx:252
severity: medium
reason: One idiom, copied ten times: `bg-gradient-to-r from-pink-500 to-rose-500` with `text-white`. A gradient carries no `bg-<colour>-<shade>`, so it has never been measured by anything — it was outside tests/unit/a11y/whiteOnColorContrast.test.ts until that file learned to read `from-`/`via-`/`to-` stops, which is how this was found. Measured at both ends: `pink-500` is Tailwind's `#f6339a` at 3.58:1, and `rose-500` resolves to this project's own override `#f43f5e` (`tailwind.config.js:65`) at 3.67:1. Both are below the 4.5:1 AA floor, so every point along the sweep is, and `DailyMessage.tsx:260` is `text-xs`, where the large-text allowance does not apply either. The fix is already written in the tree and applied to the wrong state: several of these carry `hover:from-pink-600 hover:to-rose-600`, and those stops clear at 4.54:1 and 4.70:1 — so today the button becomes compliant only while the pointer is on it. Not fixed here: promoting the hover values changes the resting colour of the app's primary action in ten places, which is a design decision rather than a class edit, and DW-134 named two destructive buttons. Allowlisted as a group in that test, keyed by swatch with an expected count of ten each, so fixing some and not others turns it red. Settle by deciding whether the resting gradient becomes the 600 pair.
status: done 2026-09-15
resolution: resolved by sweep bundle dw-decision-dw-143
resolution-undo: dd676099fa1be563a5689ab4e6a46363e0c539df80e00b09b29992dc1215c901 2026-09-15 7374617475733a206f70656e
decision: 2026-09-15 Promote resting stops to pink-600 / rose-600 everywhere the idiom appears — Change the resting gradient from from-pink-500 to-rose-500 to from-pink-600 to-rose-600 with text-white on all ten bg-gradient-to-r sites, plus PokeKissInterface.tsx:439 and src/index.css .btn-primary, in one change. Darken or drop the existing hover:from-pink-600 hover:to-rose-600 so hover is not lighter than rest. Clear both KNOWN_GRADIENT_BELOW_FLOOR counts together; do not ship a subset.

### DW-144: Own-message bubbles still drop below 4.5:1 while isSending applies opacity-70.
origin: spec-deferred 7390a9ee0dac
location: src/components/love-notes/LoveNoteMessage.tsx:276
source_spec: `spec-dw-141-love-notes-send-button-contrast.md`
severity: low
reason: LoveNoteMessage.tsx:276 already had `${isSending ? 'opacity-70' : ''}`. Group-composite of canvas gray-800 (30,41,57) on #FF6B6B at 0.7 over LoveNotes bg #FFF5F5 is 2.715:1. Pre-change white on the same stack was 2.07:1. Rest of the own bubble is 5.286:1. Removing the fade would change in-flight send UX this bundle did not restyle.
status: open
decision: 2026-09-15 Drop opacity-70; keep the Sending... caption — Remove `${isSending ? 'opacity-70' : ''}` from LoveNoteMessage.tsx:276 so in-flight own bubbles stay at the measured rest 5.286:1. Keep the existing Sending... aria-live span, the #FF6B6B fill, text-gray-800, partner bubbles, and send/scroll/remove behaviour. Do not convert the hex ground to coral-500 or add a contrast-scanner hex matcher.

### DW-145: Admin panel title icon still pairs white text with the old pink-500 / rose-500 gradient.
origin: spec-deferred adccd24143eb
location: src/components/AdminPanel/AdminPanel.tsx:103
source_spec: `spec-dw-143-promote-resting-gradient-to-600.md`
severity: medium
reason: AdminPanel.tsx:103 is still `bg-gradient-to-r from-pink-500 to-rose-500` with a child span at :104 `text-xl text-white`. The scanner requires both utilities on the same literal, so this pairing is invisible. Intent named :149, not :103. Pre-existing; this change left it.
status: open
