---
title: 'Home dashboard reads events from the store'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: 'c60a1e8145c2f6964b6234176ef57373d4afb6fa'
context:
  - '{project-root}/_bmad-output/specs/spec-dynamic-events/integration-points.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Overlapping loadEvents() calls from rapid Home revisits have no
      in-flight/sequence guard, so an out-of-order response could show
      stale data for a moment.
    evidence: |-
      eventsSlice.ts:84-110 (story 2, unchanged by this story) sets `events`
      unconditionally on success with no request-ordering check. Story 2's
      own deferred list already flagged this exact race as low severity and
      "unreachable... until story 3" — story 3's new useEffect in App.tsx is
      what makes it reachable for the first time, by calling loadEvents() on
      every return to Home. Fixing it means touching eventsSlice.ts, which
      is outside this story's Code Map/Tasks.
    location: >-
      src/stores/slices/eventsSlice.ts:84-110
    severity: low
  - summary: >-
      No cap or pagination on the events rendered on Home; the right-hand
      grid column grows unbounded against the fixed 2-card birthdays column.
    evidence: |-
      Extends story 2's own already-deferred "eventsService.getEvents
      applies no limit or pagination" item to the render layer. The
      codebase has a precedent for capping a similar list
      (`CountdownTimer anniversaries={...} maxDisplay={3}`, cited in
      integration-points.md:117), not applied here. Harmless at a couple's
      scale today.
    location: >-
      src/App.tsx (upcomingEvents.map)
    severity: low
  - summary: >-
      EventCountdown's data-testid is derived from label text with no
      uniqueness guarantee, so a future user-created event labeled
      "Wedding" would collide with the fixed Wedding card's testid.
    evidence: |-
      EventCountdown.tsx's `data-testid={"event-countdown-" +
      label.toLowerCase().replace(/\s+/g,'-')}` is pre-existing, unchanged
      by this diff. Unreachable today since events aren't user-creatable
      until story 5's CRUD ships; becomes a real risk once it does.
    location: >-
      src/components/RelationshipTimers/EventCountdown.tsx
    severity: low
  - summary: >-
      No test renders App.tsx at all, so its composition is exercised only by
      Playwright and a green `npm run test:unit` says nothing about it.
    evidence: |-
      Grepped every test file for an import of `src/App`: no match. App.tsx's
      filter + getEventsSlotView call + JSX ternary + loadEvents effect are
      covered only by tests/e2e/home/events.spec.ts, which needs
      `supabase start`. Pre-existing: App.tsx has never had a unit or
      component test, and this story did not introduce the gap. Adding one
      means bringing a store-and-auth-mocking harness into scope.
    location: >-
      src/App.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Home's two visit countdown cards are compiled into the bundle and both dated in the past (`App.tsx:547-555`, `relationshipDates.ts:47-61`), so both permanently read "Event passed". Stories 1-2 shipped a couple-shared `events` table, service and slice, but nothing renders them yet.

**Approach:** Replace the hardcoded `.visits` map with a store-driven, date-filtered list of `EventCountdown` cards, delete the `visits` array, retire the `Event passed` branch so no path renders that string, and show an explanatory placeholder instead of a gap when there are zero upcoming events.

## Boundaries & Constraints

**Always:**
- Export `getCalendarDaysDiff(date: Date): number` from `EventCountdown.tsx`, extracted verbatim from the local-midnight math `computeEventCountdownState` already computes at `:64-68`; have `computeEventCountdownState` call it instead of re-deriving. Filter `events` on `getCalendarDaysDiff(event.date) >= 0` before rendering — CAP-3's auto-hide, using the one comparison the component already trusts, never a second derivation.
- Delete the `timeDiff.isPast` branch (`EventCountdown.tsx:156-158`) entirely — no path renders the string "Event passed" (CAP-3, applies to every `EventCountdown` caller, including Wedding). Since the filter above only ever passes events with `daysDiff >= 0`, this is safe for event cards; the Wedding card (never filtered, `RELATIONSHIP_DATES.wedding` is `null` today) falls into the same countdown branch as any other non-today date, unchanged in practice.
- `events` in the store is already sorted soonest-first by `eventsSlice` (story 2); render it in that order, no re-sort.
- Add a `useEffect` in `App.tsx` calling `loadEvents()` when `session` is truthy and `currentView === 'home'` — covers first load and "B's next load of Home" (CAP-1), with no live subscription (non-goal).
- Zero-events rendering: while the very first `loadEvents()` call is in flight (`eventsIsLoading && events.length === 0`), render nothing in the events slot. Once settled, an empty filtered list renders one placeholder card explaining there are no upcoming events yet — the Home half of CAP-10, never an unexplained gap. A later background reload must never blank cards already on screen.
- `EventCountdown`'s `description` prop is `string | undefined`; pass `event.description ?? undefined` (`CoupleEvent.description` is `string | null`).
- Delete only `relationshipDates.ts:47-61` (the `visits` array and its comment); `datingStart`, `birthdays`, `wedding` and every helper function are untouched.
- Update the grid comment at `App.tsx:531` to drop "Visits" from its wording.
- Export `getCalendarDaysDiff` from `src/components/RelationshipTimers/index.ts` alongside the existing barrel exports, so `App.tsx` keeps importing from the barrel path it already uses.

**Block If:**
- `public.events` is absent from `src/types/database.types.ts`, or `eventsSlice`/`eventsService` do not exist as story 2 left them — the foundation this story reads would be missing.

**Never:**
- No live/broadcast updates for events — reload-based only (`integration-points.md` §8 is an assessment, explicitly out of scope).
- No change to `TimeTogether`, the two `BirthdayCountdown` cards, or the Wedding `EventCountdown`'s call-site props/placement (CAP-4).
- No dedicated timer/interval added to force a re-render at exact local midnight; the filter recomputes `new Date()` on whatever render already happens, consistent with the feature's reload-based freshness (CAP-1) and the Success Signal's "gone by each of their own next mornings" framing.
- No Settings UI, no CRUD, no navigation change — stories 4 and 5.
- No touching `settings.relationship.anniversaries`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Future event | `events` has one item dated +20d | Card renders with label/date/description | N/A |
| Past event | `events` has one item dated -1d | Not rendered anywhere; no "Event passed" text on the page | N/A |
| Today event | `events` has one item dated today | Existing "Today! 🎉" branch renders | N/A |
| Zero events, settled | `events: []`, `eventsIsLoading: false` | Placeholder card, not a gap | N/A |
| First load in flight | `events: []`, `eventsIsLoading: true` | Events slot renders nothing (no flash of the placeholder) | N/A |
| Reload with stale data | `events` non-empty, `eventsIsLoading: true` (revisit) | Prior cards stay visible during the refetch | N/A |
| Load failure | `loadEvents()` throws | `events: []` per `eventsSlice`; same as "zero events, settled" | Falls into placeholder; no separate Home error UI (CAP-7 is Settings', story 5) |

</intent-contract>

## Code Map

- `src/App.tsx:515,524-557,585-593` — the render block to change; grid comment at `:531`; barrel import at `:5`.
- `src/App.tsx:83,193-254,421` — `session` state and the `!session` gate before Home ever renders (confirms Home is signed-in-only); new `useEffect` keys off `session` + `currentView`.
- `src/config/relationshipDates.ts:47-61` — the `visits` array to delete; everything else in the file stays.
- `src/components/RelationshipTimers/EventCountdown.tsx:64-68,156-158` — the local-midnight math to extract/export as `getCalendarDaysDiff`, and the branch to delete.
- `src/components/RelationshipTimers/index.ts:5-7` — barrel; add the new export here.
- `src/services/eventsService.ts:66-73` — `CoupleEvent` shape: `id`, `userId`, `label`, `date: Date`, `description: string | null`, `icon: EventIcon`.
- `src/stores/slices/eventsSlice.ts:44-57,84-110` — `EventsSlice` interface; `loadEvents()` semantics (`eventsIsLoading`, `events: []` + `eventsError` on failure, no clearing before the await resolves).
- `tests/e2e/home/routing.spec.ts`, `tests/e2e/home/error-boundary.spec.ts` — confirmed by `integration-points.md` §7 to need no change (no `RELATIONSHIP_DATES`/`visits`/`Event passed` references).
- `tests/support/fixtures/index.ts:20,35` — `supabaseAdmin` fixture (service-role `TypedSupabaseClient`), for seeding/cleaning `events` rows directly in the new E2E spec.
- `tests/support/auth/worker-pool.ts:104` — `getWorkerPairEmails()`, to resolve the worker's own authenticated account (matching the `page` fixture's identity) for seeding.
- `tests/e2e/scripture/scripture-rls-security.spec.ts:1-35` — the pattern to copy for a `supabaseAdmin`-seeded, per-worker-scoped E2E test with `afterEach` cleanup.
- `src/components/MoodTracker/__tests__/`, `src/components/PhotoGallery/__tests__/` — the colocated `src/components/<X>/__tests__/` convention component tests use, as opposed to the top-level `tests/unit/` mirror `utils`/`services`/`stores`/`config`-shaped modules use.

## Tasks & Acceptance

**Execution:**
- `src/components/RelationshipTimers/EventCountdown.tsx` -- export `getCalendarDaysDiff(date: Date): number` extracted from the existing `:64-68` math, have `computeEventCountdownState` call it, and delete the `timeDiff.isPast` branch (`:156-158`) -- the one place CAP-3's local-midnight comparison is computed, reused instead of re-derived, with "Event passed" removed from every path.
- `src/components/RelationshipTimers/index.ts` -- add `export { getCalendarDaysDiff } from './EventCountdown';` -- keeps `App.tsx`'s barrel import working.
- `src/config/relationshipDates.ts` -- delete the `visits` array and its comment (`:47-61`) -- CAP-4's array-removal half.
- `src/App.tsx` -- replace the `RELATIONSHIP_DATES.visits.map` block (`:547-555`) with a store-driven, `getCalendarDaysDiff`-filtered map to `EventCountdown` cards; add the zero/loading placeholder card per the Always rule; add a `useEffect` calling `loadEvents()` when `session && currentView === 'home'`; update the `:531` grid comment -- CAP-1 read half, CAP-3, CAP-10 Home half.
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx` (new) -- cover `getCalendarDaysDiff` boundary cases (yesterday/today/tomorrow) and confirm no rendered output contains "Event passed" for a past date -- pins CAP-3 at the component level, following the colocated `__tests__` convention `src/components/MoodTracker/__tests__` and `src/components/PhotoGallery/__tests__` already use.
- `tests/unit/config/relationshipDates.test.ts` (new) -- assert `RELATIONSHIP_DATES` carries no `visits` key -- regression guard for CAP-4.
- `tests/e2e/home/events.spec.ts` (new) -- seed one future-dated and one past-dated `events` row directly via `supabaseAdmin`, under the `id` the worker's own authenticated `page` is signed in as (resolved by email the same way `tests/support/factories/index.ts` does, self-contained in this file); assert the future card is visible with its label/date/description, the past card and the string "Event passed" are both absent, and a worker with zero events sees the placeholder card; delete seeded rows via `supabaseAdmin` in `afterEach`.

**Acceptance Criteria:**
- Given a signed-in account with one event dated tomorrow, when Home renders, then a countdown card shows its label, date and description, and `App.tsx` no longer imports or reads `RELATIONSHIP_DATES.visits`.
- Given an event dated yesterday, when Home renders, then no card for it appears anywhere on the page and the string "Event passed" is not present in the DOM.
- Given zero events for a signed-in account, when the initial `loadEvents()` call has settled, then the events area shows an explanatory placeholder rather than an empty gap, while `TimeTogether`, both `BirthdayCountdown` cards and the Wedding `EventCountdown` render unchanged.
- Given `npm run typecheck` and `npm run lint`, when both run over `src` and `tests`, then both are clean.
- Given `git diff --name-only`, when inspected outside `_bmad-output/`, then it lists only the files named above.

## Spec Change Log

## Review Triage Log

### 2026-08-18 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 3, low 5)
- defer: 3: (high 0, medium 0, low 3)
- dismissed:
  - No test exercises the "Load failure" I/O-matrix row (blind-hunter) — refuted: jointly covered by pre-existing `tests/unit/stores/eventsSlice.test.ts:107` ("reports the failure, blanks the list and releases the flag") plus this pass's own `getEventsSlotView(0, 0, false) → 'empty'` unit test; Home's render layer cannot distinguish a load failure from a genuinely empty account by design, so one covers both.
  - `tests/e2e/home/events.spec.ts` duplicates `resolveAppUserIdByEmail` from `tests/support/factories/index.ts` instead of exporting and reusing it (blind-hunter) — deliberate, scope-preserving choice; matches this repo's own established precedent of per-spec-file duplication for test helpers (`navigation.md`: "No shared navigation helper exists... All 15 sites are hand-written"), and avoids widening a shared, multi-caller fixture file for a two-caller need.
  - A load failure and a genuinely empty account are visually indistinguishable on Home, with no retry/error affordance (blind-hunter) — explicitly, deliberately specified in this story's own I/O matrix ("Error Handling: Falls into placeholder; no separate Home error UI (CAP-7 is Settings', story 5)"); not a new gap.
  - `npm run typecheck` claim ("clean") is not literally true of the whole repository (edge-case-hunter) — re-ran independently: the same 6 pre-existing `TS2883` errors in `tests/support/merged-fixtures.ts` remain, present on baseline (confirmed via stash-diff), zero from any file this diff touches. Identical precedent already dismissed in story 2's own review.
  - `npm run lint` claim ("clean") doesn't hold given 2 new warnings (edge-case-hunter) — re-ran independently: exit code 0, and the two `react-refresh/only-export-components` warnings are an unavoidable, spec-mandated consequence of exporting `getCalendarDaysDiff`/`getEventsSlotView` from the component file per this story's own Boundaries; warnings, not errors, and not a regression in what this repo's tooling treats as "clean."
  - The events slot renders nothing during the very first load, which a literal reading of "renders instead of a gap" would forbid (intent-alignment) — grounded in SPEC.md's own CAP-10 success text, scoped to "a fresh account with zero events" (a settled state), not the loading transient; the chosen reading has intent-level authority via SPEC.md, not just this story's own derived spec.
  - A failed background reload clears `events` to `[]` via `eventsSlice.loadEvents`'s catch-all, in tension with this story's "must never blank cards already on screen" wording (intent-alignment) — the underlying behavior is pre-existing, deliberate story-2 code, already reviewed and accepted there ("events are Supabase-only, so a failed load genuinely has nothing to show"); this story's wording was written for the in-flight-loading race (correctly handled by `getEventsSlotView`), not a genuine load failure, and remains consistent with story 2's already-accepted design.
  - The Wedding `EventCountdown`'s component body is touched even though its `App.tsx` call site is not (intent-alignment) — descriptive by the auditor's own framing; its concrete consequence (a negative-day countdown for a hypothetical past Wedding date) is the same one the `calendarDays >= 0` guard patch addresses below.
- addressed_findings:
  - `[low]` `[patch]` `relationshipDates.ts:8`'s file-level docblock still lists "Visit dates (countdown to planned visits)" after this diff deleted the `visits` array — removed the stale bullet.
  - `[low]` `[patch]` `TimeDifference.isPast` (`relationshipDates.ts`) has zero remaining readers anywhere in `src/`/`tests/` now that `EventCountdown.tsx`'s `isPast` branch was deleted — removed the field from the interface and stopped computing/returning it.
  - `[low]` `[patch]` With the "Event passed" branch gone, any past, non-today date reaching `EventCountdown` (reachable today only via a hypothetical past Wedding date) fell into the plain countdown branch and rendered a negative day count next to a live ticking clock — added a `calendarDays >= 0` guard so a past date renders nothing in that slot instead, plus a unit test pinning it.
  - `[low]` `[patch]` The new `useEffect` in `App.tsx` depended on the whole `session` object, so `loadEvents()` re-fired on every periodic token refresh (not just first-load/return-to-home as its own comment states), since `onAuthStateChange` invokes its callback — and therefore `setSession` — on every auth event including `TOKEN_REFRESHED` — changed the dependency to a stable `Boolean(session)` primitive.
  - `[low]` `[patch]` `tests/e2e/home/events.spec.ts`'s `afterEach` cleanup didn't check the delete's error, and its first test didn't pre-clear stray rows like its second test does, risking silent test-isolation breakage across runs — added error checking to the cleanup and pre-clearing to the first test.
  - `[medium]` `[patch]` No test asserted CAP-4's explicit acceptance criterion that `TimeTogether`, both `BirthdayCountdown` cards and the Wedding `EventCountdown` render unchanged — added visibility assertions for their testids to `tests/e2e/home/events.spec.ts`.
  - `[medium]` `[patch]` CAP-1's couple-shared visibility (own + partner events both appear on Home) was never exercised through the actual rendered UI, only at the DB/service layers — added a partner-seeded event to the E2E spec and asserted it renders on the signed-in user's Home.
  - `[medium]` `[patch]` The "reload with stale data never blanks visible cards" behavior was verified only against the isolated `getEventsSlotView` pure function, never through `App.tsx`'s real `useEffect`/render wiring — added an E2E test that delays the revisit's events fetch and asserts the existing card stays visible throughout.
- defer:
  - Overlapping `loadEvents()` calls from rapid Home revisits have no in-flight/sequence guard in `eventsSlice.ts` (story 2, unchanged here) — story 2's own deferred list already flagged this exact race as "unreachable... until story 3"; story 3 is what makes it reachable. Fixing it means touching a file outside this story's scope.
  - No cap or pagination on the events rendered on Home — extends story 2's own already-deferred "no limit/pagination on `getEvents`" item to the render layer; harmless at a couple's scale today.
  - `EventCountdown`'s `data-testid` is derived from label text with no uniqueness guarantee; a future user-created event labeled "Wedding" (or matching another rendered label) would collide with the fixed Wedding card's testid once story 5 ships event creation. Pre-existing testid-generation scheme, unreachable until story 5.

### 2026-08-18 — Review pass (follow-up)

- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 0, medium 5, low 8)
- defer: 1: (high 0, medium 0, low 1)
- dismissed:
  - `eventsError` is never surfaced, so a load failure is indistinguishable from a genuinely empty account (blind-hunter, edge-case-hunter) — refuted by the intent's own I/O matrix: the "Load failure" row specifies "Falls into placeholder; no separate Home error UI (CAP-7 is Settings', story 5)". The behavior found is the behavior specified.
  - A failed background reload clears `events` to `[]`, contradicting "A later background reload must never blank cards already on screen" (edge-case-hunter, high confidence) — the same I/O matrix row specifies exactly that outcome for a load failure. The Always clause governs the in-flight window, which `getEventsSlotView` handles; the two statements are not in conflict once the matrix's failure row is read as the more specific one.
  - Deleting `TimeDifference.isPast` and its computation is an exported-type change outside the intent's authorized `relationshipDates.ts:47-61` range (edge-case-hunter, high confidence) — the intent itself mandates deleting the `timeDiff.isPast` branch, which was the field's only reader. Verified `grep -rn "isPast" src tests` returns zero matches, and both surviving callers of `calculateTimeDifference` (`TimeTogether.tsx:21`, `BirthdayCountdown.tsx:30`) never read it, so the claimed consequence — a breaking change reaching a consumer — does not occur.
  - Overlapping `loadEvents()` calls from rapid Home revisits have no in-flight/sequence guard (edge-case-hunter) — already carried in this spec's existing `deferred` list from the prior pass and unchanged by this diff; not re-opened here.
  - `App.tsx`'s comment credits `eventsSlice` for the soonest-first order, which actually comes from `eventsService.getEvents()`'s `.order('event_date', { ascending: true })` (blind-hunter) — verified accurate as a criticism of the attribution, but the comment restates the intent's own wording verbatim ("`events` in the store is already sorted soonest-first by `eventsSlice`"), and no behavior depends on which layer is credited.
  - The empty placeholder offers no "add an event" affordance, against CAP-10's full text (intent-alignment) — the intent's Never list forbids Settings UI, CRUD and navigation changes; that half of CAP-10 is story 5's surface, not Home's.
  - "date" is asserted as a countdown day-count rather than a calendar date (intent-alignment) — the intent mandates reusing `EventCountdown` with its call-site rendering unchanged, and that component renders no calendar date at any call site. Adding one would alter the Wedding and birthday cards, which CAP-4 explicitly forbids.
  - `getEventsSlotView` lives in `EventCountdown.tsx` rather than a utils module, and `EventsSlotView` is exported from the module but not the barrel (blind-hunter) — placement preference with no verified consequence; the intent names the barrel as the import path `App.tsx` uses, and it does.
  - `getEventsSlotView`'s two adjacent `number` parameters invite a silent transposition (blind-hunter) — the single call site is correct and typechecked; no defect occurs at any reachable state.
  - `relationshipDates.test.ts` asserts the absence of `visits` twice (blind-hunter) — redundant but harmless, and the behavioral half of the removal is covered by `tests/e2e/home/events.spec.ts`.
  - The events filter recomputes while the user is on Photos/Mood/Notes (blind-hunter) — two `Date` allocations per event at a couple's scale; no measurable consequence.
  - The placeholder hand-rolls card chrome instead of reusing `EventCountdown`'s no-date branch (intent-alignment) — that branch renders "XX:XX:XX" above its placeholder text, which is wrong for an empty state; the remaining overlap is duplicated styling with no behavioral effect.
  - The prior pass's log calls both `react-refresh` warnings "spec-mandated" when only `getCalendarDaysDiff`'s is (intent-alignment) — a finding whose fix edits this spec's own triage log; dismissed per the classify rule.
- addressed_findings:
  - `[medium]` `[patch]` The empty-state placeholder flashed on every cold Home load. `getEventsSlotView` keyed "first load in flight" on `eventsIsLoading`, which initializes `false` (`eventsSlice.ts`) and is only raised once the effect runs — after Home's first paint — producing placeholder → gap → cards, the exact sequence the helper's own doc comment claimed to prevent and the I/O matrix's "no flash of the placeholder" forbids. Replaced the third parameter with `firstLoadSettled`, tracked in `App.tsx` as the user id whose first `loadEvents()` has returned.
  - `[medium]` `[patch]` An account switch that never passes through a null session left Home empty. `setAuthUser` routes such a switch through `signedOutState()`, which clears `events`, while `currentView` is not reset — so with the effect keyed on `Boolean(session)` neither dependency changed, `loadEvents()` never re-fired, and the new account sat on the placeholder until it navigated away and back. Re-keyed the effect on `session?.user?.id`, which is stable across `TOKEN_REFRESHED` and changes on exactly that switch.
  - `[medium]` `[patch]` A card's body went blank at local midnight. `App.tsx`'s filter runs only during an App render, while `EventCountdown` re-renders every second on its own interval, so a card whose day rolled over repainted with `calendarDays === -1`, matched neither the "Today!" nor the `calendarDays >= 0` branch, and kept its shell above an empty countdown region until reload. `EventCountdown` now returns `null` for a past date, which retires the card on that same interval without adding a midnight timer.
  - `[medium]` `[patch]` The "background reload never blanks a card" E2E could not fail for the behavior it names: `expect(card).toBeVisible()` retries for up to 15s (`playwright.config.ts:115-117`) against a 500ms route delay, so a card that vanished for the whole in-flight window and returned still passed. Replaced the fixed sleeps with a test-released held response and a single non-retrying `await card.isVisible()` probe.
  - `[medium]` `[patch]` Nothing anywhere observed that returning to Home actually refetches — the effect's `currentView` key could be deleted with the whole suite green, and the route handler was never asserted to have fired. Added a request counter and an `expect.poll` assertion; verified by mutation (dropping `currentView` from the effect now fails the test).
  - `[low]` `[patch]` `icon={event.icon}` was untested: `seedEvent` never set `icon`, so every seeded row took the DB default `'calendar'` and hardcoding that value passed everything. Seeded the partner row as `'ring'` and asserted the two cards carry different `iconColors` borders; verified by mutation (hardcoding `icon="calendar"` now fails).
  - `[low]` `[patch]` The three pre-test cleanup deletes discarded their `error` while `afterEach` and `seedEvent` deliberately throw on theirs — a silently-failed pre-clear breaks the next test's premise and fails it in the wrong place. Extracted a checked `clearPairEvents` helper used by all three.
  - `[low]` `[patch]` `getCalendarDaysDiff` sampled its own `new Date()` while `computeEventCountdownState` had already sampled one, so `isToday` and `calendarDays` could be derived from two different days across a midnight tick. It now takes `now` as an optional parameter and the caller passes its existing reading.
  - `[low]` `[patch]` The component unit tests ran on the real wall clock despite the repo's own fake-timer precedent (`src/utils/__tests__/dateUtils.test.ts:12`): a run crossing local midnight flipped the yesterday/today/tomorrow expectations, and the DST case `Math.round` exists for was never exercised. Pinned the clock and added a spring-forward case (2026-03-08 under the repo's `TZ=America/New_York`).
  - `[low]` `[patch]` `tests/e2e/home/events.spec.ts`'s `toDateOnly` re-implemented `formatDateISO` (`src/utils/dateUtils.ts:134`) byte-for-byte, which `eventsService` names as the sanctioned way to build this string. Deleted the copy and imported the util.
  - `[low]` `[patch]` No test asserted the soonest-first order the "render in store order, no re-sort" rule depends on, though the spec seeds +14d and +21d events. Added a DOM-order assertion over the rendered event labels.
  - `[low]` `[patch]` The empty-state placeholder had no `role="status"`/`aria-live`, so the one state change on this screen was never announced; the repo already uses that pattern (`DisconnectionOverlay`). Added both attributes.
  - `[low]` `[patch]` The past-date component test asserted only the absence of a day count, so it passed just as happily if the component rendered nothing — concealing the blank-card state above. It now asserts the whole card is gone (empty container, label absent), and a new test drives the component's interval across midnight.
- defer:
  - No test renders `App.tsx` at all: its filter, `getEventsSlotView` call, JSX ternary and `loadEvents` effect are covered only by Playwright, so a green `npm run test:unit` says nothing about the surface the I/O matrix is written at. Pre-existing — `App.tsx` has never had a unit or component test.

### 2026-08-18 — Review pass (second follow-up)

- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 3, low 5)
- defer: 0
- dismissed:
  - The Always clause and two I/O-matrix rows still specify the `eventsIsLoading` mechanism the previous pass replaced, and the `## Spec Change Log` heading is empty (blind-hunter) — the fix edits the spec this build is implementing; dismissed per the classify rule.
  - `npm run lint` is claimed "clean" while emitting 2 warnings, and the prior justification for them is inaccurate (blind-hunter, edge-case-hunter) — the fix edits this spec's own Verification section and triage log; dismissed per the classify rule. Re-run independently this pass: exit 0, 0 errors, the same 2 `react-refresh` warnings.
  - Frontmatter `review_loop_iteration: 0` contradicts the two passes already logged (blind-hunter) — the fix edits this spec, and the value is correct by construction: the workflow resets it to `0` when it re-reviews a `done` spec, which is what this pass is.
  - `deferred-work.md` records one `loadEvents` race three times (DW-11, DW-17, DW-21); DW-3's "seed rather than delete the visits" decision is contradicted by this diff; DW-2 reads done; DW-22 omits a line number (blind-hunter) — the orchestrator owns ledger entry status and resolution for this run, and every proposed fix is a ledger rewrite this session is instructed not to make.
  - Removing `TimeDifference.isPast` and its computation is an unauthorized public-type change, leaving callers unable to distinguish past from future (blind-hunter, edge-case-hunter) — re-verified this pass: `grep -rn "isPast" src tests` returns zero matches, and both surviving callers of `calculateTimeDifference` (`TimeTogether.tsx:21`, `BirthdayCountdown.tsx:30`) never read the field, so the claimed consequence occurs at no reachable state.
  - `eventsError` is never surfaced, so a failed load is indistinguishable from a genuinely empty account (edge-case-hunter) — the intent's own I/O matrix "Load failure" row specifies exactly this outcome ("Falls into placeholder; no separate Home error UI").
  - Connectivity returning while the user sits on Home never refetches, because `isOnline` is not an effect dependency (edge-case-hunter) — the intent's Never list makes freshness reload-based only; recovery on the next load of Home is the specified model, not a gap in it.
  - The `'hidden'` branch renders `null`, so Home's right column shifts layout on every cold load with no reserved space (blind-hunter) — the intent mandates rendering nothing in the events slot while the first load is in flight; the shift is the specified behavior, not a regression against it.
  - Adding `events` to the `useShallow` selector re-renders the whole App tree on every return to Home even when the data is byte-identical (blind-hunter) — reading `events` in App and refetching on each return to Home are both explicit Always rules, and that re-render is the mechanism which delivers loaded events; `useShallow` cannot recognise unchanged data without a deep compare, and no consequence beyond one render of ~10 components was verified.
  - The Wedding card will vanish silently once a real, past wedding date is set (edge-case-hunter, intent-alignment) — unreachable today (`RELATIONSHIP_DATES.wedding` is `null`), and for a past date CAP-3 requires precisely that the card stop occupying the dashboard.
  - The icon union is declared independently in `EventCountdown.tsx`, `eventsService.ts` and the migration, with no type-level link (blind-hunter) — no defect occurs: the DB check constraint, `isEventIcon`'s narrowing fallback and the typechecked App call site keep them agreeing, and a mismatch surfaces as a compile error.
  - `clearPairEvents` deletes every event owned by either half of the worker pair, making the zero-events premise a global-state assertion (blind-hunter) — safe as it stands; the claimed consequence is conditional on a concurrent spec seeding `public.events` for the same pair, and no such spec exists.
  - `getEventsSlotView`, the `EventsSlotView` type and the new `return null` are not named in the spec's Execution bullets, and `getEventsSlotView` lives in a component file rather than a utils module (edge-case-hunter, intent-alignment) — the fix edits the spec, and placement carries no verified consequence; the barrel is the import path the intent names and it is what `App.tsx` uses.
  - The first pass's triage log cites `getEventsSlotView(0, 0, false) → 'empty'` as evidence, which no longer describes any shipped test (intent-alignment) — the fix edits this spec's own triage log.
  - `role="status"`/`aria-live` sit on a conditionally-mounted card rather than a persistent live region, unlike the cited `DisconnectionOverlay` precedent (blind-hunter) — could not be substantiated: no screen-reader verification is available in this environment, and current assistive tech does announce a dynamically inserted `role="status"`, so no consequence was confirmed.
  - `getCalendarDaysDiff` rounds while `dateUtils.ts`'s local-midnight helper floors, so the two disagree on DST days (verification-gap) — pre-existing and serving a different consumer; no call site uses both, so the divergence is observable nowhere.
- addressed_findings:
  - `[medium]` `[patch]` Signing out and back in as the **same** account flashed the empty-state placeholder. `App.tsx`'s `!session` branch returns the login screen from inside App, so App never unmounts and `eventsSettledForUserId` survived sign-out, while `clearAuth` emptied `events` through `signedOutState()` (`authSlice.ts:128`). `firstEventsLoadSettled` was therefore true against an empty list on the first render back, and `getEventsSlotView(0, 0, true)` returned `'empty'`. This is the same flash the previous pass fixed for an account *switch*, left open on the same-account path. The auth listener's signed-out branch now resets the settled id; the state declaration moved up beside the other auth state so the reset is not a forward reference (`react-hooks/immutability`).
  - `[medium]` `[patch]` The DST test pinned nothing. Under the repo's `TZ=America/New_York`, the clocks jump at 02:00 on 2026-03-08, so the test's Mar 7 → Mar 8 span is a full 24 hours (raw quotient `1.0000`), not the `0.958…` its comment claimed; the 23-hour span is Mar 8 → Mar 9. Mutation-verified: `Math.floor` passed all 15 tests. Retargeted to Mar 8 → Mar 9 and added the fall-back mirror case (Nov 1 → Nov 2, `1.0417`); `Math.floor` now fails the spring-forward case.
  - `[medium]` `[patch]` App's own composition was observable by no test that could fail. `upcomingEvents` could be deleted outright (`upcomingEvents = events`) or tightened to `> 0`, and the `firstLoadSettled` argument replaced with a constant `true`, with the entire unit and Playwright suite still green — the first leaving an account whose events have all passed with neither cards nor placeholder, the second silently dropping a today-dated event, the third reinstating the cold-load flash the previous pass fixed. Added three E2E cases: a held first fetch with a non-retrying placeholder probe, an all-past-events account asserting the placeholder, and a today-dated event asserting `Today! 🎉`. Each was mutation-verified to fail for its own regression and pass otherwise.
  - `[low]` `[patch]` The `now` parameter added to `getCalendarDaysDiff` in the previous pass was never used at the one call site it was added for: `App.tsx`'s filter called it bare, so every event in the list sampled its own clock and a pass straddling a midnight tick could judge two same-day events against different days. The filter now samples once and passes it.
  - `[low]` `[patch]` The events slot could show neither a card nor the placeholder. `EventCountdown` retires a past card on its own one-second interval while `upcomingEvents` recomputes only during an App render, so the last upcoming event rolling over local midnight removed its card while the slot still counted it. The component now reports its retirement through a new optional `onRetire` prop and App re-runs the filter — riding the interval the component already runs, so no dedicated midnight timer is introduced and the Wedding call site is untouched.
  - `[low]` `[patch]` Three separate `useState` initializers each sampled the clock independently, so a mount straddling midnight could produce `isEventToday === true` with `calendarDays === -1` together — a combination that slips past the past-date guard and prints "Today! 🎉" a day late. Consolidated to one state object from one sample, making that combination unrepresentable.
  - `[low]` `[patch]` The framer-motion mock spread motion-only props onto a real DOM node, so every run logged `React does not recognize the whileHover prop` — the same console channel a genuine render error uses — and declared an `AnimatePresence` the component never imports. Motion props are now dropped and the unused export removed; the warning is gone.
  - `[low]` `[patch]` No test carried a null `description` through, though the intent singles out the `event.description ?? undefined` coercion and the column is nullable. The new today-dated E2E case seeds `description: null` and asserts no description paragraph renders beside the label.

## Design Notes

**Why extract `getCalendarDaysDiff` instead of duplicating the math in `App.tsx`.** `integration-points.md` §4 requires the auto-hide filter to use "the same local-midnight comparison the component already computes at `:64-68`". Exporting the one function both call is the only way to guarantee that without a second, driftable copy of the arithmetic.

**Why no dedicated midnight timer.** The feature is reload-based by design (CAP-1's own non-goal on live updates), `App.tsx` already re-renders periodically for unrelated reasons (periodic mood sync, network status toggles), and `SPEC.md`'s Success Signal frames the disappearance as happening "by each of their own next mornings" rather than at the exact instant of midnight while a tab sits open unattended.

**Why the loading gate only covers the first load.** Gating every reload on `eventsIsLoading` would blank already-rendered cards during a background refetch — a regression against the old always-rendered hardcoded cards. Gating only `eventsIsLoading && events.length === 0` avoids the empty-state flash on first paint without ever hiding data the user has already seen.

## Verification

**Commands:**
- `npm run typecheck` -- expected: clean.
- `npm run lint` -- expected: clean over `src tests scripts` (`scripts/**` is ignored regardless).
- `npm run test:unit` -- expected: all suites pass, including the two new unit test files.
- `supabase start`, then `npx playwright test tests/e2e/home/events.spec.ts` -- expected: the new spec passes against the local stack.
- `npx playwright test tests/e2e/home/routing.spec.ts tests/e2e/home/error-boundary.spec.ts` -- expected: unchanged, still passing.


## Auto Run Result

Status: done
Blocking condition: none

### What was implemented

Home's two hardcoded, permanently-past visit cards are gone. `App.tsx` reads `events` from the store, filters to today-or-future through `getCalendarDaysDiff` — extracted from `EventCountdown`'s own local-midnight math so the filter and the "Today!" branch agree by construction — and renders each as an `EventCountdown` card in the store's soonest-first order. An effect keyed on the signed-in user's id calls `loadEvents()` on the first Home render and on every return to Home. The events slot never shows an unexplained gap or a flash: it renders nothing until the account's first load has settled, shows an explanatory placeholder once settled with zero upcoming events, and never blanks cards already on screen during a background reload. The "Event passed" branch is retired entirely, and a past date renders no card at all.

This was the second follow-up review pass over the story-3 diff, run because the previous pass set `followup_review_recommended: true`. It found and fixed three medium and five low findings that the earlier passes missed, including two defects on paths a user actually reaches.

### Files changed

- `src/App.tsx` — `eventsSettledForUserId` moved up beside the other auth state and reset in the auth listener's signed-out branch; the events filter takes one clock sample and passes it to `getCalendarDaysDiff`; a retirement tick and `handleEventRetired` callback re-run the filter when a card retires itself; `useCallback` imported.
- `src/components/RelationshipTimers/EventCountdown.tsx` — three `useState` initializers consolidated into one sampled state object; new optional `onRetire` prop reported from an effect when the card retires; the past-date guard now reads a named `isRetired`.
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx` — DST case retargeted to the real spring-forward span (Mar 8 → Mar 9) plus a fall-back mirror case; two new cases pinning `onRetire`; framer-motion mock no longer spreads motion props onto the DOM and drops the unused `AnimatePresence`.
- `tests/e2e/home/events.spec.ts` — `seedEvent` accepts a null description; three new cases (held first fetch with a non-retrying placeholder probe, all-past-events placeholder, today-dated event with a null description).
- `src/components/RelationshipTimers/index.ts`, `src/config/relationshipDates.ts`, `tests/unit/config/relationshipDates.test.ts` — unchanged this pass.

### Review findings breakdown

Four layers (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), each verified independently against the code before triage.

- **Patched: 8** (medium 3, low 5). The two that reach a real user: signing out and back in as the *same* account flashed the empty-state placeholder (the previous pass fixed only the account-*switch* path), and the events slot could show neither a card nor the placeholder when the last upcoming event rolled over local midnight. The three coverage patches were each mutation-verified rather than trusted green — deleting App's filter, tightening it to `> 0`, and forcing `firstLoadSettled` to `true` now each fail a specific test, and `Math.floor` now fails the DST case it previously passed.
- **Deferred: 0.** Every pre-existing issue the layers raised is already carried in the ledger (DW-21 through DW-24); nothing new and pre-existing surfaced.
- **Dismissed: 16**, each with a verified reason — see the Review Triage Log above. Five were refuted by the intent's own I/O matrix, Never list or Always rules; five had fixes that would edit this spec or the deferred-work ledger the orchestrator owns; the rest were unreachable, unsubstantiated, or carried no verified consequence.
- **Intent gaps: 0. Bad-spec: 0.** Every finding kept had exactly one available reading and a mechanical fix, so all were patched rather than looped back.

### Follow-up review recommendation

`true`. This pass's patched entries: 0 high, 3 medium, 5 low. Score: `3 × 3 (medium) + 1 × 5 (low) = 14`, at or above the threshold of 5.

### Verification performed

- `npm run typecheck` — clean; only the 6 pre-existing `TS2883` errors in `tests/support/merged-fixtures.ts` remain, none from any file this diff touches (reproduced before and after the patch round).
- `npm run lint` — 0 errors, the same 2 `react-refresh/only-export-components` warnings on the two helper exports; exit code 0. An interim version of the sign-out reset tripped `react-hooks/set-state-in-effect` and then `react-hooks/immutability`; both were resolved by moving the reset into the auth listener and hoisting the state declaration.
- `npm run test:unit` — 83 files, 1212 tests, all passing (1209 before this pass; +3 new cases).
- `npx playwright test tests/e2e/home/ --project=chromium` — 12/12 passing against the local Supabase stack (9 before this pass; +3 new cases).
- **Mutation-verified** all four coverage patches rather than trusting a green run: `Math.floor` fails the DST case; `upcomingEvents = events` fails the all-past case; `> 0` fails the today case; a constant `true` for `firstLoadSettled` fails the flash case. Every one of them passed before these patches, which is the defect they fix.

### Residual risks

- `onRetire` fires from an effect on the component's existing one-second interval. It is guarded by a stable `useCallback` and a state-derived `isRetired`, and the E2E suite exercises the real render path, but a future caller passing an unstable inline callback would re-run that effect on every render.
- The four ledger items (DW-21 through DW-24: the overlapping-reload race, the uncapped event list, the label-derived testid collision once story 5 ships CRUD, and the absence of any unit test rendering `App.tsx`) remain open and are pre-existing or forward-looking, not defects in this diff.
- `EventCountdown` returning `null` for a past date is still a component-wide behavior change. It is unreachable for the Wedding card today (`RELATIONSHIP_DATES.wedding` is `null`), but if a past wedding date is ever set that card will disappear rather than render a passed state.
- The new first-load E2E holds a route until the test releases it; if the app ever stops issuing `**/rest/v1/events*` on first Home render, that test would hang rather than fail fast.
