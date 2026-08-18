---
title: 'Events service and store slice'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a0b101897c14de45666717bf7d1115b5ee9217bc'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-dynamic-events/integration-points.md'
warnings: ['oversized']
deferred:
  - summary: >-
      handleNetworkError promises "Your changes will be synced when you're back online",
      which is false for events — there is no offline queue, IndexedDB mirror or retry.
    evidence: |-
      src/api/errorHandlers.ts:94-95 composes that sentence for every offline throw.
      Pre-existing and repo-wide, not caused by this story: interactionService.ts:111
      emits the same text for partner interactions, which are equally Supabase-only
      (AGENTS.md:65). eventsService's module header already routes EventWriteError
      around the helper for exactly this reason; the offline guards still use it
      because the story's Boundaries mandate moodApi's idiom verbatim.
    location: >-
      src/api/errorHandlers.ts:94
    severity: medium
  - summary: >-
      A CHECK-constraint violation (23514) is unmapped, so an over-length label or
      description reaches the user as raw Postgres constraint text.
    evidence: |-
      The errorMessages map in src/api/errorHandlers.ts:62-70 covers 23505, 23503,
      23502, 42501, 42P01, PGRST116 and PGRST301 — no 23514 — so the fallback
      `Database error: ${error.message}` applies. The table enforces
      char_length(label) <= 100 and char_length(description) <= 500, and nothing
      rejects a blank label (char_length('') = 0 passes). Input validation belongs
      to story 5's form; story 1's triage log already carried the blank-label
      observation forward to that story.
    location: >-
      src/api/errorHandlers.ts:62
    severity: medium
  - summary: >-
      eventsService.getEvents applies no limit or pagination.
    evidence: |-
      integration-points.md section 1 names photoService.getPhotos(limit = 50,
      offset = 0) as the signature shape to mirror, and moodApi caps its reads.
      The read grows with the couple's whole event history. Harmless at a couple's
      scale today, and a limit would interact with the soonest-first ordering.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Two events on the same date have no deterministic order.
    evidence: |-
      The read orders on event_date alone, and Postgres leaves ties unspecified,
      so same-day cards can swap position between reloads. A secondary key such
      as created_at would fix it.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Overlapping loadEvents calls are last-writer-wins; the guard compares userId only.
    evidence: |-
      The identity guard catches an account switch but not two in-flight loads for
      the same account, where an older response can overwrite a newer list. No
      caller triggers this yet — nothing mounts loadEvents until story 3 — so the
      state is currently unreachable.
    location: >-
      src/stores/slices/eventsSlice.ts
    severity: low
  - summary: >-
      A double-submitted addEvent creates two rows.
    evidence: |-
      Deliberate at the data layer: public.events carries no idempotency_key column
      and no UNIQUE constraint, so AGENTS.md:59's retryable-INSERT rule has nothing
      to key on and the story forbids automatic retry. Guarding a double submit is
      story 5's form (disable the button while the write is open).
    location: >-
      src/stores/slices/eventsSlice.ts
    severity: low
  - summary: >-
      EventWriteError is unexported and EventWriteResult carries no machine-readable code,
      so callers must string-match English prose to tell "not yours" from a transport failure.
    evidence: |-
      Story 5's UI needs different affordances for the two outcomes (refresh the
      list vs retry the write). The shape mirrors photosSlice's PhotoUploadResult,
      which has the same limitation, so changing it is a cross-slice decision.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      A persisted blob that already contained an events key would be rehydrated;
      only moods is stripped on read.
    evidence: |-
      useAppStore.ts:111 records that partialize "stops NEW writes, but it does not
      govern reads", which is why the adapter deletes data.state.moods at :120-123.
      Verified by writing the assertion: it fails today. Not fixed here because the
      state is unreachable — no build has ever written events to localStorage, so
      unlike moods there is no installed base of bad blobs. It would become real
      only if a later story added events to partialize and then removed it again.
    location: >-
      src/stores/useAppStore.ts:120
    severity: low
  - summary: >-
      A row with an unparseable event_date is silently dropped from the list with only
      a console.error; nothing surfaces to eventsError or any user-visible state.
    evidence: |-
      toCoupleEvent (src/services/eventsService.ts) logs
      '[EventsService] Skipping event with unreadable event_date' and returns null on
      an unparseable date, and getEvents filters those nulls out with no further
      signal. Verified unreachable via any app-originated write today: createEvent and
      updateEvent both call parseEventDate on the input and throw EventWriteError
      before issuing any request, so only a direct SQL write (e.g. a literal
      'infinity', which a Postgres date column accepts) could produce such a row.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      A CHECK-constraint violation (23514) — including a blank or over-length
      label/description — is unmapped, so it reaches the user as raw Postgres text.
    evidence: |-
      Re-surfaced by this review pass's edge-case and blind-hunter layers; re-verified
      unchanged since the prior pass. The errorMessages map in src/api/errorHandlers.ts
      has no entry for 23514, so the generic 'Database error: ${message}' fallback
      applies. The table enforces char_length(label) <= 100 and
      char_length(description) <= 500, and nothing client-side rejects a blank label.
      Input validation is assigned to story 5's form.
    location: >-
      src/api/errorHandlers.ts:62
    severity: medium
  - summary: >-
      eventsService.getEvents applies no limit or pagination.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass. The
      read grows with the couple's whole event history; harmless at today's scale.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Two events on the same date have no deterministic order.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass. The
      read orders on event_date alone with no secondary key such as created_at, so
      same-day cards can swap position between reloads.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Overlapping loadEvents calls are last-writer-wins; the identity guard compares
      userId only.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass. Two
      in-flight loads for the same account are not distinguished by the guard, so an
      older response can overwrite a newer list. No caller triggers this yet — nothing
      mounts loadEvents until story 3.
    location: >-
      src/stores/slices/eventsSlice.ts
    severity: low
  - summary: >-
      A double-submitted addEvent creates two rows.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass.
      public.events has neither an idempotency_key column nor a UNIQUE constraint, so
      no automatic retry/dedupe is possible at the data layer; guarding a double
      submit is story 5's form.
    location: >-
      src/stores/slices/eventsSlice.ts
    severity: low
  - summary: >-
      handleNetworkError's offline message promises a sync that cannot happen for
      events.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass.
      src/api/errorHandlers.ts composes "Your changes will be synced when you're back
      online" for every offline throw; events have no offline queue, IndexedDB mirror
      or retry. Pre-existing and repo-wide (interactionService.ts emits the same text
      for partner interactions).
    location: >-
      src/api/errorHandlers.ts:94
    severity: medium
  - summary: >-
      EventWriteError is unexported and EventWriteResult carries no machine-readable
      code, so callers must string-match English prose to distinguish outcomes.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass.
      Story 5's UI will need different affordances for different failure kinds
      (refresh vs retry); the shape mirrors PhotoUploadResult's same limitation.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Persistence omission from partialize only prevents new writes; a pre-existing
      persisted blob with an events key would still rehydrate.
    evidence: |-
      Re-surfaced by this review pass; re-verified unchanged since the prior pass.
      useAppStore.ts records that partialize "stops NEW writes, but it does not
      govern reads", which is why moods is stripped on read but events is not.
      Unreachable today since no build has ever written events to localStorage.
    location: >-
      src/stores/useAppStore.ts:120
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1 shipped `public.events`, but no client code reads or writes it — `grep -rn "from('events')" src/` returns nothing. Stories 3 and 5 need a data layer that surfaces save failures (CAP-7), clears on sign-out (CAP-6), and hands the UI a `Date` the renderer cannot misparse.

**Approach:** One new service on the **throwing** convention (`src/api/moodApi.ts`'s idiom, not `photoService`'s swallow), plus one new Zustand slice registered in the composed store. The service owns the single `"YYYY-MM-DD"` → local-`Date` parse so no later story can reach for `new Date(row.event_date)`. Nothing visible ships.

## Boundaries & Constraints

**Always:**
- The `"YYYY-MM-DD"` → `Date` parse happens **once**, in the service: `const [y, m, d] = row.event_date.split('-').map(Number); new Date(y, m - 1, d);`. Never `new Date(row.event_date)` — that is ECMA-262 date-only form, parsed as UTC midnight, and lands a day early west of UTC.
- The write direction uses the `<input type="date">` string untouched, or `formatDateISO` (`src/utils/dateUtils.ts:134-139`, local components). Never `toISOString().split('T')[0]` — `dateUtils.ts:126-128` records that trap.
- Errors **throw**, following `src/api/moodApi.ts` verbatim: `if (!isOnline()) throw handleNetworkError(...)` (`:72-74`); `if (error) throw error` (`:87-89`); catch tail `logSupabaseError` → `if (isPostgrestError(error)) throw handleSupabaseError(error, ctx)` → `throw handleNetworkError(error, ctx)` (`:112-118`). Import from `src/api/errorHandlers.ts`.
- Every UPDATE sets `updated_at: new Date().toISOString()` — the migration comment at `20260818000002_create_events_table.sql:37-40` states it is client-maintained with deliberately no trigger.
- The UPDATE payload is typed `Database['public']['Tables']['events']['Update']`, per the recorded reason at `src/services/scriptureReadingService.ts:270-275` (postgrest-js `RejectExcessProperties` resolves an index signature to `never`).
- An UPDATE or DELETE affecting **zero rows throws**. Story 1 measured that RLS filters a non-creator's write silently with no error; without this the UI would report success for a no-op.
- Reads are ordered `event_date` ascending (SPEC.md Assumptions: "Events are ordered soonest-first"), matching `idx_events_user_event_date`.
- `icon` comes back typed `string`; narrow it with a type guard in the `src/utils/interactionValidation.ts:40` shape, falling back to the column default `'calendar'`.
- All three slice state keys go into `signedOutState()` (`src/stores/slices/authSlice.ts:54-124`) **and** into `EXPECTED_RESET` (`tests/unit/stores/signOutClearsAccountState.test.ts:30-81`) in the same commit — `:367-371` asserts the two key sets are equal, so either half alone fails.
- Every action that `set()`s after an `await` captures `const requestedBy = get().userId;` first and re-checks `if (get().userId !== requestedBy) return;` on **both** the success and catch paths (`src/stores/slices/photosSlice.ts:146,153,157`). Where a loading flag was raised before the await, release it while discarding the data — `src/stores/slices/partnerSlice.ts:62-67`: "Drop the DATA, but release the spinner".

**Block If:**
- The three-key `signedOutState()` addition cannot be made to satisfy `signOutClearsAccountState.test.ts` without editing an assertion other than `EXPECTED_RESET`.
- `public.events` is absent from `src/types/database.types.ts` (expected present at `:55-87`) — the story-1 foundation would be missing.

**Never:**
- No persistence. Do not touch `partialize` (`src/stores/useAppStore.ts:151-177`); omission is the mechanism. Do not bump `version: 0` (`:85`) — the E2E auth fixtures pin it.
- No bare `error` / `isLoading` key names — both collide with `AppSlice` (`src/stores/types.ts:30-31`) and `photosSlice.ts:37`. Use the `notesIsLoading`/`notesError` prefix style.
- No UI, no `App.tsx` edit, no mount point, no `relationshipDates.ts` change, no `EventCountdown.tsx` change — stories 3, 4 and 5.
- No automatic retry on INSERT, and no idempotency key: the table has neither an `idempotency_key` column nor a UNIQUE constraint, so `AGENTS.md:59`'s retryable-INSERT rule has nothing to key on. A failure surfaces to the user, who retries deliberately.
- No realtime, no `supabase.channel()`, no broadcast — `integration-points.md` §8 is an assessment, explicitly out of scope.
- No IndexedDB mirror — events are Supabase-only (`AGENTS.md:65`).
- No hand-edit of `src/types/database.types.ts`; no migration or pgTAP change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load | Rows for self + partner | `CoupleEvent[]`, `event_date` ascending, each `date` a local-midnight `Date` | No error expected |
| Parse boundary | `event_date: '2026-09-12'`, TZ `America/New_York` | `date.getDate() === 12` | No error expected |
| Unknown icon | Row with `icon: 'star'` | Event kept, `icon === 'calendar'` | No throw |
| Create | Valid label + date | Resolves the created event; slice prepends and re-sorts | No error expected |
| Create offline | `navigator.onLine === false` | Throws before any request; slice returns `{ success: false, error }` and sets `eventsError` | `handleNetworkError` |
| Create rejected | Postgrest error (e.g. 42501) | Slice returns `{ success: false, error }`; `events` unchanged | `handleSupabaseError` |
| Update by non-creator | RLS filters the row | Throws "no rows affected"; slice reports failure | Thrown, not silent |
| Delete by non-creator | RLS filters the row | Throws; store array unchanged | Thrown, not silent |
| Account switch mid-load | `userId` changes while `loadEvents` is in flight | New account's `events` untouched; `eventsIsLoading` released | Same on the catch path |
| Sign out | `clearAuth()` with events in memory | `events: []`, `eventsIsLoading: false`, `eventsError: null` | N/A |

</intent-contract>

## Code Map

- `_bmad-output/specs/spec-dynamic-events/integration-points.md` §1-2 — the contract for this story; §8 is out of scope.
- `supabase/migrations/20260818000002_create_events_table.sql:16-24` — column set; `:22` the `icon in ('ring','plane','calendar')` CHECK; `:37-40` the client-maintained `updated_at` comment.
- `src/types/database.types.ts:55-87` — `events` `Row`/`Insert`/`Update`, already regenerated. `event_date` is plain `string`.
- `src/api/moodApi.ts` — **the error convention to copy**: `:72-74` offline guard, `:87-89` throw-on-error, `:91-93` empty-data guard, `:112-118` catch tail, `:336-339` the `updated_at: new Date().toISOString()` write. Class `:51`, singleton `:488`.
- `src/api/errorHandlers.ts` — exported: `isOnline` `:44`, `handleSupabaseError` `:55`, `handleNetworkError` `:90`, `isPostgrestError` `:109`, `logSupabaseError` `:135`. `SupabaseServiceError` `:16` is **not** exported; do not `instanceof` it.
- `src/services/photoService.ts:22,96,609` — file shape only (import, non-exported class, singleton export). Its `return []`/`return false`/`return null` error handling is the anti-pattern here.
- `src/api/interactionService.ts:25,35-42` — the domain-type idiom: a `Database[...]['Row']` alias beside a hand-written interface carrying a real `Date`.
- `src/services/scriptureReadingService.ts:270-275` — why the Update payload must be typed with the generated `Update` row.
- `src/stores/types.ts:11-20,49-61,67` — slice-interface imports, the `AppState extends` list, `AppStateCreator`. Two edits land here.
- `src/stores/useAppStore.ts:5-15,68-82` — imports and the slice-spread block; `:151-177` `partialize` (**leave alone**); `:85` `version: 0`.
- `src/stores/slices/photosSlice.ts:31-49,144-159` — slice interface shape, `PhotoUploadResult` discriminated result at `:29`, and the canonical identity guard with its verbatim comment at `:150-152`.
- `src/stores/slices/partnerSlice.ts:58-81` — the fuller guard: release the loading flag while discarding.
- `src/stores/slices/authSlice.ts:35-42` (ADDING STATE), `:54-124` (`signedOutState()`, grouped by `// <slice>` comment), `:152-163` (`discardAccountState`).
- `src/components/RelationshipTimers/EventCountdown.tsx:14,16-22` — `type IconType = 'ring' | 'plane' | 'calendar'` is **not exported**, and `date: Date | null`. A structurally identical union in the service is assignable; do not export from the component.
- `src/utils/interactionValidation.ts:40` — `export function isValidInteractionType(type: string): type is InteractionType` — the narrowing shape to copy.
- `src/utils/dateUtils.ts:126-128,134-139` — the UTC trap comment and `formatDateISO`.
- `src/utils/countdownService.ts:83` — `const [, month, day] = dateString.split('-').map(Number);`, the in-repo split idiom (it drops the year; events must keep it).
- `src/utils/logger.ts` — only `debug` and `info`; bracketed `[EventsService]` / `[EventsSlice]` tags.
- Tests to model: `tests/unit/services/photoService.idempotency.test.ts:117-143` (per-file fake `supabase.from`, with `:121`'s unmodelled-table throw), `tests/unit/stores/notesSlice.removal.test.ts:181-206` (`create<TestStore>()(createXSlice as unknown as StateCreator<TestStore>)`), `tests/unit/stores/loaderIdentityGuards.test.ts:372-401` (the two-case `describe` per loader), `tests/unit/stores/signOutClearsAccountState.test.ts:30-81,367-371`.
- `vitest.config.ts:26` include globs; `tests/setup.ts` installs `fake-indexeddb` and DOM shims but **no** Supabase mock — mock per file.

## Tasks & Acceptance

**Execution:**
- `src/services/eventsService.ts` (new) — export `type EventIcon`, `type SupabaseEventRecord = Database['public']['Tables']['events']['Row']`, a `CoupleEvent` domain interface (`id`, `userId`, `label`, `date: Date`, `description: string | null`, `icon: EventIcon`), the icon type guard, the `"YYYY-MM-DD"` → local-`Date` parse, and a non-exported class with `getEvents` / `createEvent` / `updateEvent` / `deleteEvent` on the throwing convention, exported as `export const eventsService = new EventsService();` — the single place the date parse and the error convention are decided.
- `src/stores/slices/eventsSlice.ts` (new) — `EventsSlice` interface (`events: CoupleEvent[]`, `eventsIsLoading`, `eventsError`; actions `loadEvents`, `addEvent`, `editEvent`, `removeEvent`, `clearEventsError`) built with `AppStateCreator<EventsSlice>`; writes return a `{ success: true } | { success: false; error: string }` result **and** set `eventsError`, mirroring `PhotoUploadResult` — so CAP-7's caller gets the message for its own write rather than reading a shared key.
- `src/stores/types.ts` — add the `EventsSlice` type import and extend `AppState` — the only typechecked registration site.
- `src/stores/useAppStore.ts` — import `createEventsSlice` and add its spread after `:81`; `partialize` untouched — events are Supabase-only and must not survive a shared device.
- `src/stores/slices/authSlice.ts` — add an `// eventsSlice` group to `signedOutState()` with all three keys — CAP-6.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — mirror the three keys into `EXPECTED_RESET` — the key-set equality assertion at `:367-371` fails otherwise.
- `tests/unit/services/eventsService.test.ts` (new) — cover every service row of the I/O matrix against a per-file fake `supabase`, including a `TZ`-sensitive parse assertion — the parse is the one bug the type system cannot catch.
- `tests/unit/stores/eventsSlice.test.ts` (new) — cover the slice rows: write results on success and failure, `eventsError` set and cleared, array ordering after add/edit/remove.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — add a `loadEvents` `describe` with both house cases (discards the data; still releases the spinner) — `:25-29` states the flag is half the guard.

**Acceptance Criteria:**
- Given the composed store, when `npm run test:unit` runs, then every suite passes including `signOutClearsAccountState.test.ts` and `loaderIdentityGuards.test.ts`.
- Given `npm run typecheck` and `npm run lint`, when both run over `src` and `tests`, then both are clean.
- Given a signed-in session with events in memory, when the persisted blob under `my-love-storage` is read, then it contains no `events` key and the persist `version` is still `0`.
- Given the change set, when `git diff --name-only` is inspected, then outside `_bmad-output/` it lists only the `src`/`tests` files above plus the two the review pass added (`tests/unit/stores/persistedEvents.test.ts` and the timezone pin in `vitest.config.ts`), and nothing from `App.tsx`, `relationshipDates.ts`, `EventCountdown.tsx`, `supabase/` or `src/types/database.types.ts`.

## Spec Change Log

## Review Triage Log

### 2026-08-18 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 1, medium 2, low 4)
- defer: 8: (high 0, medium 2, low 6)
- dismissed:
  - `loadEvents` blanks the list on any failure — deliberate and pinned by a test carrying the rationale; events are Supabase-only, so a failed load genuinely has nothing to show. No path to a wrong outcome at the named site.
  - `editEvent`/`removeEvent` lack `addEvent`'s signed-in precondition — verified: signed out there is no Supabase session, so the write is rejected and an error surfaces either way; the only difference is message wording, and no caller invokes these signed-out (nothing mounts them until story 5).
  - `editEvent`/`removeEvent` report success when the id is absent from the local list — the server write did succeed, so success is truthful; the local array simply never held that row. Reporting failure would be the false answer.
  - Mid-flight account-switch writes return `{ success: true }` — the write did land for the account that made it; the guard's job is to keep the result out of the new account's list, which it does. Returning failure would misreport a completed write.
  - `'2026-02-30'` rolls to March 2 — unreachable from a Postgres `date` column, which rejects it on insert. Folded into the parse guard anyway, so the claim is closed rather than left standing.
  - Story artifact untracked — not a code defect; `_bmad-output/` stopped being ignored at `a0b10189` and the Finalize step commits the file.
  - Typecheck not clean — verified identical on the baseline with all changes stashed: six `TS2883` errors in `tests/support/merged-fixtures.ts` resolving `@seontechnologies/playwright-utils` seven directory levels up. Environmental to the loop worktree, not caused by this change; zero errors come from the changed files.
- addressed_findings:
  - `[high]` `[patch]` The parse test could not discriminate under UTC, which is what CI runs — measured: with the row conversion reverted to `new Date(row.event_date)`, all 29 tests pass under `TZ=UTC` and 3 fail under `TZ=America/New_York`. Pinned `test.env.TZ` in `vitest.config.ts` to a negative-offset zone; whole suite verified green under it.
  - `[medium]` `[patch]` `parseEventDate` had no validity guard, and one unparseable date scrambled the whole list — measured: a comparator returning `NaN` leaves EVERY element unsorted (`[3,NaN,1]` stays `3,NaN,1`). A `date` column accepts `infinity`, which story 2 first made plantable by adding a writer. Now regex-anchored with a rollover and two-digit-year check, returning `null`; `getEvents` drops unreadable rows, and `createEvent`/`updateEvent` refuse an unreadable date before issuing any request.
  - `[medium]` `[patch]` No test pinned the identity guard on `addEvent`/`editEvent`/`removeEvent` — demonstrated: deleting all three guards left the suite green. Added the house two-case `describe` per action to `loaderIdentityGuards.test.ts`; mutation-verified that all three now fail when their guard is removed. The first attempt did not discriminate for `addEvent` because its fixture lacked a `date` and crashed `sortByDate`; the fixture is now a complete `CoupleEvent`, with the reason recorded inline.
  - `[low]` `[patch]` `eventsSlice.test.ts` pinned an invented offline message (`'... please check your connection'`) that appears nowhere in `src/`; replaced with the text `handleNetworkError` actually composes (`errorHandlers.ts:94-95`), copied verbatim.
  - `[low]` `[patch]` Nothing asserted that `getEvents` applies no `user_id` filter — adding one would silently drop the partner's half of the list while every test passed. The fake now records `.eq()` calls and the read asserts `backend.filters` is empty.
  - `[low]` `[patch]` Acceptance criterion 3 (persisted blob carries no `events` key, `version` still `0`) had no test; added `tests/unit/stores/persistedEvents.test.ts`, modelled on `persistedMoods.test.ts`.
  - `[low]` `[patch]` Comment and citation drift in `eventsService.ts`: the ordering was claimed to match `idx_events_user_event_date`, but with no `user_id` predicate the index's leading column cannot supply that order (corrected to say so explicitly); `dateUtils.ts:121-128` → `src/utils/dateUtils.ts:126-128`; migration `:37-40` → `:38-41`; bare `countdownService.ts` → `src/utils/countdownService.ts`; and "the only conversion in the codebase" narrowed, since `countdownService.ts:83` does the same split.

### 2026-08-18 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 9: (high 0, medium 2, low 7)
- dismissed:
  - The Design Notes "Zero-rows-affected" snippet spreads `updates` directly, diverging from `updateEvent`'s actual field-by-field remap of `eventDate` → `event_date` — fixing it would edit this build's own driving spec (the Design Notes section of `{spec_file}`), which the classify rule requires dismissing rather than patching.
  - `eventsService.test.ts` imports via the `@/` alias while `eventsSlice.test.ts` imports via relative paths — verified both match established per-directory precedent: `tests/unit/services/*` tests use `@/` (`photoService.idempotency.test.ts`), `tests/unit/stores/*` tests use relative paths (`notesSlice.removal.test.ts`) — both are this story's own cited test models. Conformance, not inconsistency.
  - `vitest.config.ts` pins `TZ` for the whole `test` block rather than scoping it to the events suites — re-ran the full suite (1192/1192 green) under the pin; this was a deliberate, already-reviewed tradeoff from the prior pass (an unscoped or UTC-run test is the exact regression the pin exists to catch). No demonstrated consequence today.
  - `editEvent`/`removeEvent` omit `addEvent`'s explicit signed-in precondition — verified in `eventsSlice.ts:148-190`: signed out, there is no Supabase session, so the write is rejected by RLS/`isOnline` either way and an error surfaces; only the message wording differs. Same reasoning the prior pass already recorded, still true.
  - `EventUpdateInput.icon` has no explicit "reset to default" sentinel distinct from `description`'s `null` — verified a caller can already pass `icon: 'calendar'` explicitly, which is accepted and correctly resets it; no functional gap, only a documentation nuance.
  - Offline check runs before date validation in `createEvent`/`updateEvent` — verified the ordering in `eventsService.ts`; when offline, no write can succeed regardless of date validity, so the offline message is the accurate, blocking condition either way. No misleading or incorrect outcome results.
  - DW-9's "a limit would interact with the soonest-first ordering" caveat doesn't hold as literally stated (a SQL `LIMIT` after `ORDER BY` composes fine) — critiques the wording of an already-recorded deferred item's `reason` text, not a code defect; this run's directive bars modifying or reopening existing deferred/ledger entries.
  - Ordering-justification citation drift (index vs. sort) flagged by the intent-alignment layer — already corrected in this diff itself: `eventsService.ts:210-214` already states the sort is not index-backed and explains why. No outstanding defect; self-resolved by the prior review pass.
  - Acceptance criterion "`npm run typecheck` ... clean" is not literally true of the whole repository — re-ran `npm run typecheck`: only pre-existing `TS2883` errors in `tests/support/merged-fixtures.ts` remain, none from any file this diff touches. Same environmental baseline the prior pass already verified and dismissed; unchanged.
- addressed_findings:
  - `[low]` `[patch]` Code comments in `eventsService.ts` overclaimed that an unreadable `event_date` would leave "the entire list unsorted" and attributed that mechanism to `getEvents`, which orders server-side via SQL `.order()` and runs no JS comparator at all — measured `[3,NaN,1]` stays fully scrambled but `[9,5,3,NaN,1,4,8,2,7,6].sort()` only misplaces the `NaN` element and one neighbor. Corrected both the `parseEventDate` docstring and the `getEvents` inline comment to attribute the real risk (a future client-side re-sort in `eventsSlice.sortByDate`) instead.
  - `[low]` `[patch]` `tests/unit/stores/persistedEvents.test.ts` was written entirely in double quotes, inconsistent with every other file this diff touches and with its own cited model `persistedMoods.test.ts` (single quotes) — converted to single quotes throughout.
  - `[low]` `[patch]` No test asserted `createEventsSlice`'s pristine initial state (`events: []`, `eventsIsLoading: false`, `eventsError: null`) before any action runs — a typo in the initializer would have passed every existing test. Added `'starts with an empty list, not loading, and no error'` to `eventsSlice.test.ts`.

## Design Notes

**Why a domain type rather than the raw row.** `EventCountdown.tsx:18-19` takes `icon: IconType` and `date: Date | null`. If the slice held raw rows, story 3's render would have to parse — and `database.types.ts` types `event_date` as plain `string`, so `new Date(row.event_date)` typechecks, builds, and is wrong only in some timezones. Converting at the service boundary makes that unreachable from the UI layer. `interactionService.ts:25` + `:35-42` is the in-repo precedent for exactly this pairing.

**Why no Zod.** `moodApi` parses responses with Zod; `interactionService.ts` returns generated Row types with no validation. Both are in-tree precedents. The DB CHECK constraints already guarantee every field's domain, so a schema would restate them; the one narrowing that is genuinely needed — `icon: string` → union — is a three-line type guard.

**Zero-rows-affected.** Story 1's I/O matrix records "Partner write | B updates/deletes A's row | Zero rows affected | Silent filter, no error". Use `.select()` on update and delete so the affected rows come back, and throw when the array is empty:

```ts
const { data, error } = await supabase
  .from('events')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', eventId)
  .select();
if (error) throw error;
if (!data || data.length === 0) throw new Error('Event not found or not yours to edit');
```

## Verification

**Commands:**
- `npm run test:unit` — expected: all suites pass, including the two new files and the two amended ones.
- `npm run typecheck` — expected: clean (`tsc -b --force` builds all three projects, `tests` included).
- `npm run lint` — expected: clean (`src tests scripts`).
- `npx vitest run tests/unit/services/eventsService.test.ts` with `TZ=America/New_York` and again with `TZ=Europe/Berlin` — expected: identical results; the parse case asserts day 12 in both.

## Auto Run Result

Status: done
Blocking condition: none

### What was implemented

The data layer for couple-shared events: a throwing `eventsService` over `public.events` and an `eventsSlice` registered in the composed store. Nothing visible ships — no UI, no mount point, no `App.tsx` edit. The service owns the single `"YYYY-MM-DD"` → local-midnight `Date` conversion, so no later story can reach for `new Date(row.event_date)`, which typechecks and is wrong west of UTC.

### Files changed

- `src/services/eventsService.ts` (new) — `CoupleEvent`/`EventIcon`/`SupabaseEventRecord` types, the guarded `parseEventDate`, the icon type guard, and `getEvents`/`createEvent`/`updateEvent`/`deleteEvent` on `moodApi`'s throwing convention; zero-row writes throw rather than reporting a silent RLS filter as success. This review pass corrected two misleading comments (see Review findings).
- `src/stores/slices/eventsSlice.ts` (new) — `events`/`eventsIsLoading`/`eventsError` plus `loadEvents`/`addEvent`/`editEvent`/`removeEvent`/`clearEventsError`; writes return their own outcome and also park it in `eventsError`. This review pass added a pristine-initial-state test.
- `src/stores/types.ts` — `EventsSlice` imported and added to `AppState`.
- `src/stores/useAppStore.ts` — `createEventsSlice` spread added; `partialize` and `version: 0` untouched.
- `src/stores/slices/authSlice.ts` — the three events keys added to `signedOutState()`.
- `tests/unit/services/eventsService.test.ts` (new) — 29 cases over a per-file fake Supabase.
- `tests/unit/stores/eventsSlice.test.ts` (new) — write outcomes, error handling, list ordering, and (this review pass) the slice's pristine initial state.
- `tests/unit/stores/loaderIdentityGuards.test.ts` — `loadEvents` plus the three write actions, in the house two-case shape.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — the three keys mirrored into `EXPECTED_RESET`.
- `tests/unit/stores/persistedEvents.test.ts` (new, added by the first review pass; requoted to single quotes by this pass) — acceptance criterion 3.
- `vitest.config.ts` (added by the first review pass) — `test.env.TZ` pinned to a negative-offset zone.

### Review findings

Two review passes have now run. **First pass:** 4 layers, 7 patches applied (1 high, 2 medium, 4 low), 8 items deferred (2 medium, 6 low), 0 intent gaps, 0 spec defects, 7 findings dismissed. **This pass (follow-up, triggered by the first pass's `followup_review_recommended: true`):** 4 layers, 3 patches applied (all low — two misleading code comments corrected, a test file requoted to single quotes, one missing initial-state test added), 9 items re-surfaced and deferred (2 medium, 7 low — all duplicates in substance of the first pass's own deferred items, re-verified unchanged), 0 intent gaps, 0 spec defects, 9 findings dismissed. Full detail, including each dismissal's reason, is in the Review Triage Log above.

No high- or medium-severity defect was found in this pass. All three patches were comment/test-hygiene corrections with no behavior change; the full suite and the mutation checks on the identity guards were re-verified green after applying them.

### Follow-up review recommendation

`false`. This pass's patched entries were all low severity, none high. Score: `3 × 0 (medium) + 1 × 3 (low) = 3`, under the threshold of 5.

### Verification performed

- `npm run test:unit` — 81 files, 1192 tests, all passing (1191 before this pass's added test).
- `npm run lint` — clean over `src tests scripts`.
- `npm run typecheck` — no errors from any changed file. The same six pre-existing `TS2883` errors remain in `tests/support/merged-fixtures.ts`, confirmed unrelated to any file in this diff.
- `TZ=America/New_York` and `TZ=Europe/Berlin` runs of `eventsService.test.ts` — 29/29 identical both ways.

### Residual risks

- **Nothing calls this code yet.** `loadEvents` has no mount point until story 3, so the composed-store registration is exercised only by tests.
- **The service↔slice seam is never crossed in tests.** The service suite mocks `supabase`; the slice suites mock `eventsService`.
- **A handful of low/medium pre-existing gaps remain open** in `deferred:` (the offline message promising a sync that cannot happen, unmapped 23514, no pagination, no same-day tie-break, overlapping-load race, double-submit, unexported `EventWriteError`, read-side persistence gap) — none caused by this story, none newly introduced by this pass, all re-verified unchanged.

