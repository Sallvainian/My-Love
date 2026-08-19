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
status: open

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
status: open

### DW-8: A CHECK-constraint violation (23514) is unmapped, so an over-length label or description reaches the user as raw Postgres constraint text.
origin: spec-deferred d44dacbe0efd
location: src/api/errorHandlers.ts:62
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: The errorMessages map in src/api/errorHandlers.ts:62-70 covers 23505, 23503, 23502, 42501, 42P01, PGRST116 and PGRST301 — no 23514 — so the fallback `Database error: ${error.message}` applies. The table enforces char_length(label) <= 100 and char_length(description) <= 500, and nothing rejects a blank label (char_length('') = 0 passes). Input validation belongs to story 5's form; story 1's triage log already carried the blank-label observation forward to that story.
status: open

### DW-9: eventsService.getEvents applies no limit or pagination.
origin: spec-deferred 25448caba914
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: integration-points.md section 1 names photoService.getPhotos(limit = 50, offset = 0) as the signature shape to mirror, and moodApi caps its reads. The read grows with the couple's whole event history. Harmless at a couple's scale today, and a limit would interact with the soonest-first ordering.
status: open

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
status: open

### DW-14: A persisted blob that already contained an events key would be rehydrated; only moods is stripped on read.
origin: spec-deferred 09851f20d430
location: src/stores/useAppStore.ts:120
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: useAppStore.ts:111 records that partialize "stops NEW writes, but it does not govern reads", which is why the adapter deletes data.state.moods at :120-123. Verified by writing the assertion: it fails today. Not fixed here because the state is unreachable — no build has ever written events to localStorage, so unlike moods there is no installed base of bad blobs. It would become real only if a later story added events to partialize and then removed it again.
status: open

### DW-15: A row with an unparseable event_date is silently dropped from the list with only a console.error; nothing surfaces to eventsError or any user-visible state.
origin: spec-deferred 27703d86d257
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: toCoupleEvent (src/services/eventsService.ts) logs '[EventsService] Skipping event with unreadable event_date' and returns null on an unparseable date, and getEvents filters those nulls out with no further signal. Verified unreachable via any app-originated write today: createEvent and updateEvent both call parseEventDate on the input and throw EventWriteError before issuing any request, so only a direct SQL write (e.g. a literal 'infinity', which a Postgres date column accepts) could produce such a row.
status: open

### DW-16: A CHECK-constraint violation (23514) — including a blank or over-length label/description — is unmapped, so it reaches the user as raw Postgres text.
origin: spec-deferred f5a93068dc47
location: src/api/errorHandlers.ts:62
source_spec: `2-events-service-and-store-slice.md`
severity: medium
reason: Re-surfaced by this review pass's edge-case and blind-hunter layers; re-verified unchanged since the prior pass. The errorMessages map in src/api/errorHandlers.ts has no entry for 23514, so the generic 'Database error: ${message}' fallback applies. The table enforces char_length(label) <= 100 and char_length(description) <= 500, and nothing client-side rejects a blank label. Input validation is assigned to story 5's form.
status: open

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
status: open

### DW-19: EventWriteError is unexported and EventWriteResult carries no machine-readable code, so callers must string-match English prose to distinguish outcomes.
origin: spec-deferred 5652fe1c2471
location: src/services/eventsService.ts
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. Story 5's UI will need different affordances for different failure kinds (refresh vs retry); the shape mirrors PhotoUploadResult's same limitation.
status: open

### DW-20: Persistence omission from partialize only prevents new writes; a pre-existing persisted blob with an events key would still rehydrate.
origin: spec-deferred 0f9e6e1214d8
location: src/stores/useAppStore.ts:120
source_spec: `2-events-service-and-store-slice.md`
severity: low
reason: Re-surfaced by this review pass; re-verified unchanged since the prior pass. useAppStore.ts records that partialize "stops NEW writes, but it does not govern reads", which is why moods is stripped on read but events is not. Unreachable today since no build has ever written events to localStorage.
status: open

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
status: open

### DW-23: EventCountdown's data-testid is derived from label text with no uniqueness guarantee, so a future user-created event labeled "Wedding" would collide with the fixed Wedding card's testid.
origin: spec-deferred 17f1ada12518
location: src/components/RelationshipTimers/EventCountdown.tsx
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: EventCountdown.tsx's `data-testid={"event-countdown-" + label.toLowerCase().replace(/\s+/g,'-')}` is pre-existing, unchanged by this diff. Unreachable today since events aren't user-creatable until story 5's CRUD ships; becomes a real risk once it does.
status: open

### DW-24: No test renders App.tsx at all, so its composition is exercised only by Playwright and a green `npm run test:unit` says nothing about it.
origin: spec-deferred 657f5db9659f
location: src/App.tsx
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: Grepped every test file for an import of `src/App`: no match. App.tsx's filter + getEventsSlotView call + JSX ternary + loadEvents effect are covered only by tests/e2e/home/events.spec.ts, which needs `supabase start`. Pre-existing: App.tsx has never had a unit or component test, and this story did not introduce the gap. Adding one means bringing a store-and-auth-mocking harness into scope.
status: open

### DW-25: Follow-up review still recommended for 3 after the damping cap was spent
origin: review-budget-followup
location: n/a
source_spec: `3-home-dashboard-reads-events-from-the-store.md`
severity: low
reason: The follow-up-review damping cap (limits.max_followup_reviews = 1) was spent with the story finalized (status: done, verify green) while the review pass still recommended an independent follow-up. The work was committed by bmad-loop run 20260818-153303-cf19; this entry preserves the lingering recommendation for a deliberate later review.
status: open

### DW-26: A save that fails while the first load is still in flight makes the list paint a false "we couldn't load your events" notice after that load succeeds.
origin: spec-deferred 110da53662a7
location: src/components/Settings/EventsSettings.tsx (load effect) + src/stores/slices/eventsSlice.ts
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: The load-failure flag is read once from the shared `eventsError` key in loadEvents()'s .finally, and `addEvent` writes its own failure into that same key (eventsSlice.ts, addEvent catch tail). The header Add button renders before the load settles, so a save can fail inside the load's flight window and leave the key non-null when the successful load reads it. The list itself still renders correctly; only the notice is wrong. The root cause is that one `eventsError` key serves loads and all three writes with no per-call token, which lives in eventsSlice.ts — a file this story's Never list forbids editing.
status: open

### DW-27: Once the Settings events load fails, nothing re-fires it: the notice and the empty list persist until the user reloads the page.
origin: spec-deferred 289bbe236935
location: src/components/Settings/EventsSettings.tsx (load effect deps)
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: The mount effect's deps are [userId, loadEvents]. App.tsx's otherwise identical Home effect deliberately adds isOnline, commented "coming back online re-fires the load, so the offline error card clears without leaving Home." There is no retry control, and clearEventsError (exported from eventsSlice.ts) still has zero production callers. This story's intent-contract specifies "A mount effect keyed on `userId`", so closing the gap means widening what the intent asked for.
status: open

### DW-28: The three primary buttons this section adds are white text on `bg-pink-500`, which measures 3.58:1 against the 4.5:1 WCAG AA requirement.
origin: spec-deferred d52fd5748eef
location: src/components/Settings/EventsSettings.tsx:255, :296, :813 (root cause: the shared bg-pink-500 button style, 17 sites in 9 files)
source_spec: `5-manage-events-in-settings.md`
severity: medium
reason: Measured twice and independently. The parked axe run at `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts` reports impact "serious" on `events-settings-add` and `events-form-submit` -- "insufficient color contrast of 3.58 (foreground color: #ffffff, background color: #f6339a ... Expected contrast ratio of 4.5:1". Computing the relative luminance of #f6339a by hand gives (1.0 + 0.05) / (0.24294 + 0.05) = 3.58, the same number. A third instance nobody scanned carries the identical class string: `events-settings-empty-add` at EventsSettings.tsx:296. The axe scaffold seeds a row before every scan, so the empty state never renders and that button was never measured -- a developer following the checklist, which lists only :255 and :813, ships two fixed buttons and one unfixed one. The root cause is not this story's markup. `grep -rn "bg-pink-500" src/ | grep -c "text-white"` is 17, across 9 files, including the sibling AnniversarySetting
status: open

### DW-29: A write that lands while the first load is still in flight is discarded by that load, so a saved edit or a new event silently reverts on screen.
origin: spec-deferred a015b45b45be
location: src/stores/slices/eventsSlice.ts (loadEvents resolution) exposed by src/components/Settings/EventsSettings.tsx
source_spec: `5-manage-events-in-settings.md`
severity: medium
reason: `loadEvents` replaces the list wholesale on resolution -- `set({ events, eventsIsLoading: false })` at eventsSlice.ts, guarded only by `latestLoadId` against other loads, never against writes. `addEvent` / `editEvent` mutate `events` in place the moment their own request resolves. So a write that resolves inside the load's flight window is overwritten by the server list the load captured before that write landed. The reachable form is not the empty-list one. `slot` is `'list'` whenever `events.length > 0`, and `events` survives view changes -- so a user who loads Home (App's effect populates `events`) and then opens Settings sees a fully rendered list with Edit and Delete live while EventsSettings' own mount load is still outstanding. An edit accepted in that window reverts visually when the load resolves, and the row is durably changed on the server, so nothing on screen says a write succeeded. This is the success-path twin of DW-26, and it has the same root cause and the same blocker
status: open

### DW-30: Roughly 4,000 lines of measured tests shipped in this change set are matched by no test runner and execute nowhere.
origin: spec-deferred cb64960af166
location: _bmad-output/test-artifacts/ (9 test files, 23 tests)
source_spec: `5-manage-events-in-settings.md`
severity: low
reason: `_bmad-output/test-artifacts/` holds 6 ATDD scaffolds and 3 automation files. `vitest.config.ts` includes only `tests/**` and `src/**`, and Playwright's three projects set testDir to `./tests/e2e`, `./tests/api` and `./tests/integration`, so nothing reaches them. Both TEA summaries say so plainly ("Nothing here is active until it is moved") and record the `git mv` commands that would activate them, along with measurements taken by copying each file to its target, running it, and removing it again. Two of the three defects this review confirmed were first surfaced by that parked tree, so the coverage is real rather than speculative. Activation is a deliberate operator decision, not a patch: `automation-summary.md` measures typecheck at 6 TS2883 errors without the generated files and 1 with them, so acceptance criterion 3 -- which pins the literal number six -- becomes false the moment the activation happens, and the one-line fix the summary proposes at `tests/support/merged-fixtures.ts:
status: open
