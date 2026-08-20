---
title: 'Bound the events read and the Home events render'
type: 'refactor'
created: '2026-08-19'
baseline_revision: '2860bd77f7dd1c8769d2b2dec0087fc3ef1438c9'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      Settings has no way to reach events the read cap truncates, so past
      roughly 50 past events the oldest ones become uneditable from the UI.
    evidence: |-
      `EventsSettings.tsx` renders the store array unfiltered and calls
      `loadEvents()` with no arguments; `eventsSlice.loadEvents` calls
      `eventsService.getEvents()` bare, so both windows take the default
      `limit = 50, offset = 0`. Measured with `grep -rn "getEvents(" src tests`:
      the only production call site is `src/stores/slices/eventsSlice.ts:116`.
      The screen's own comment states why the list must stay unfiltered — a
      mistyped year is "the only place a mistyped year can be seen and
      corrected" — and a year typed wrong into the deep past is exactly the row
      the descending past window drops first. This change documents the bound in
      both files; closing it needs a "load more" control and a `loadEvents`
      that takes limit/offset, which the spec's Boundaries put out of scope.
    location: >-
      src/components/Settings/EventsSettings.tsx, src/stores/slices/eventsSlice.ts:116
    severity: medium
  - summary: >-
      A row whose date cannot be parsed still consumes a slot inside the capped
      window before it is dropped client-side, so garbage can push a real event
      off the page.
    evidence: |-
      `getEvents` caps in the database (`.range`) and drops unreadable rows in
      JS afterwards (the `toCoupleEvent`/`filter` pair), so an `event_date` of
      `infinity` — a value a Postgres `date` column accepts, and which
      `parseEventDate` is written to reject — counts against `limit` and returns
      one fewer usable event. The covering test for unreadable rows runs at the
      default limit of 50, where the effect is invisible. Same shape as
      `photoService.getPhotos`, which also caps server-side and filters after.
      Closing it means over-fetching and re-capping client-side.
    location: >-
      src/services/eventsService.ts
    severity: low
  - summary: >-
      Three separate literals encode the single product decision "how many
      countdown cards a column shows".
    evidence: |-
      `HOME_MAX_EVENT_CARDS = 3` in `src/App.tsx`, `maxDisplay={3}` passed at
      `src/components/DailyMessage/DailyMessage.tsx:366`, and `count: number = 3`
      in `getUpcomingAnniversaries` (`src/utils/countdownService.ts:49-51`). The
      new constant's JSDoc cites the other two as its precedent but does not
      share a value with them, so changing the product decision means finding
      all three. Unifying them is a cross-feature refactor the intent does not
      reach.
    location: >-
      src/App.tsx, src/components/DailyMessage/DailyMessage.tsx:366, src/utils/countdownService.ts:49
    severity: low
  - summary: >-
      An event saved with a date beyond the past read window appears in Settings
      immediately and then silently disappears on the next load.
    evidence: |-
      Verified path, both halves read this session: `eventsSlice.addEvent`
      inserts the created row into the store unconditionally —
      `set((state) => ({ events: sortByDate([...state.events, created]) }))` —
      while `loadEvents` re-reads a bounded window (`getEvents()` bare, so
      `limit = 50` per side). A couple with more than 50 past events who
      corrects or adds a deep-past date therefore sees the row in Settings, and
      the next `loadEvents()` drops it because the descending past page no
      longer reaches it. The row is not lost — it is in the table — only
      invisible. Distinct from the "no way to reach truncated rows" item: that
      one is about rows the user never sees, this one is about a row the user
      just saw confirmed. Closing it needs the same "load more" plumbing, or an
      in-range check at save time.
    location: >-
      src/stores/slices/eventsSlice.ts (addEvent), src/components/Settings/EventsSettings.tsx
    severity: medium
  - summary: >-
      The two-window read is two requests, so a row whose date is edited across
      today between them can come back in neither page, or come back as the
      pre-edit copy.
    evidence: |-
      `getEvents` issues the upcoming and past windows through `Promise.all`
      and reconciles only the "returned by BOTH" case, dropping one copy to
      avoid a duplicate React key. Two other outcomes exist and are now named
      in the code comment: the row lands in NEITHER page (past answered before
      the edit, upcoming after, or the reverse), and the copy kept is the
      pre-edit one, so an already-passed event renders as upcoming. Both need a
      partner editing an event across today's boundary during a load, and both
      correct themselves on the next `loadEvents()`. Closing either means
      abandoning the two-window read for a single request — the shape the
      Design Notes deliberately chose against — or comparing `updated_at`
      between copies, which the column supports but is client-maintained
      (`20260818000002_create_events_table.sql`, comment on
      `public.events.updated_at`).
    location: >-
      src/services/eventsService.ts (getEvents merge)
    severity: low
  - summary: >-
      Neither window requests a row count, so nothing can tell that truncation
      happened — which the deferred "load more" control would need.
    evidence: |-
      Both reads are plain `.select('*')` with no `{ count: 'exact' }`, so the
      service, the store and any future affordance have no "there are more"
      signal; `logger.debug('[EventsService] Fetched events:', events.length)`
      cannot distinguish 50 events from 50 of 300. The already-recorded
      Settings "load more" item names the control and the `limit`/`offset`
      plumbing it needs, but not the fact that the data to drive its enabled
      state is not fetched. A count also cannot go anywhere today: the intent's
      Never list forbids a store-shape change and a second store action.
    location: >-
      src/services/eventsService.ts (both window queries)
    severity: low
  - summary: >-
      The new API spec re-issues the production query chain by hand, so the two
      copies can drift if a change is made to both.
    evidence: |-
      `tests/api/events-read-window.spec.ts` cannot import `eventsService`:
      `src/api/supabaseClient.ts` reads `import.meta.env`, a Vite build-time
      substitution with no value under the Playwright runner. Its
      `readEventWindows` therefore mirrors the `gte`/`lt`/`order`/`range` chain
      by hand, and already diverges in one respect — it computes
      `offset + limit - 1` with none of production's clamping. The containment
      is real and was re-verified this pass: mutating the production chain fails
      `tests/unit/services/eventsService.test.ts`, whose `backend.queries`
      assertions pin the exact bounds, orderings and range. What is uncovered is
      a change made in production AND mirrored here incorrectly. Closing it
      means making the chain injectable — passing a client into a shared
      function both the service and the spec call — which is a production
      design change the intent does not reach.
    location: >-
      tests/api/events-read-window.spec.ts, src/services/eventsService.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** `eventsService.getEvents()` (`src/services/eventsService.ts:245`) takes no parameters and issues no `.limit()`/`.range()`, so the query grows with the couple's whole event history (DW-9); `src/App.tsx:680` then maps `upcomingEvents` with no cap, so Home's right-hand grid column grows unbounded against the fixed two-card birthdays column (DW-22).

**Approach:** Give `getEvents` the `(limit = 50, offset = 0)` signature `integration-points.md` §1 names (`photoService.getPhotos`, `src/services/photoService.ts:241`), reading a bounded window on **each side of today** — up to `limit` upcoming and up to `limit` already-passed — merged into the same soonest-first order the caller already gets. Cap Home's rendered cards with `.slice(0, 3)`, mirroring `CountdownTimer … maxDisplay={3}` (`integration-points.md:117`, implemented as `.slice(0, count)` in `src/utils/countdownService.ts:66`).

## Boundaries & Constraints

**Always:**
- The array `getEvents` returns stays ordered `event_date` ascending with a `created_at` ascending tiebreak — the contract `eventsSlice.sortByDate` mirrors.
- The window is anchored at today so the soonest upcoming event is **never** the row a cap drops. A plain ascending `.range(0, limit-1)` fails this: past events accumulate forever, so once the couple has `limit` past events the page holds only past events and Home shows its empty placeholder while real events exist.
- Past events keep reaching Settings — `EventsSettings.tsx:16-19` requires the unfiltered list so a mistyped date stays editable.
- No `user_id` filter, ever (the `events_select` policy scopes the read); the offline guard stays ahead of any request.
- Home's slot decision keeps seeing the **uncapped** upcoming count.

**Never:** no migration, no new view/RPC, no realtime, no store-shape change, no second store action, no new call-site arguments (`loadEvents` keeps calling `getEvents()` bare), no "+N more" affordance on Home (the cited precedent has none), no edits to `implementation-artifacts/deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Default read | Couple has 3 past + 2 upcoming events | All 5, ascending by `event_date`, `created_at` tiebreak | No error expected |
| Cap each side | 3 past + 3 upcoming, `getEvents(2)` | 4 events: the 2 **most recent** past, then the 2 **soonest** upcoming | No error expected |
| Next event survives the cap | 5 past + 1 upcoming, `getEvents(2)` | The upcoming event is in the result (the failure a plain ascending `.range` would produce) | No error expected |
| Paging outward | 4 past + 4 upcoming, `getEvents(2, 2)` | The 3rd–4th oldest-side and 3rd–4th farthest-side events | No error expected |
| Today-dated row | Event dated today | Lands in the upcoming window (`gte`), matching App's `>= 0` filter | No error expected |
| Unreadable date | Row with `event_date: 'infinity'` | Still dropped by the parse filter; remaining order intact | Row dropped, no throw |
| Offline | `navigator.onLine === false` | Throws `'You are offline. Events need a connection to load.'`; **zero** requests issued | Throws before any `from()` |
| Query error | Either window returns a PostgREST error | Routed through `handleSupabaseError` exactly as today | Throws `SupabaseServiceError` |
| Home over cap | 5 upcoming events in the store | Home renders the 3 soonest event cards only | No error expected |
| Home under cap | 2 upcoming events | Both render; placeholder/error slots unchanged | No error expected |

</intent-contract>

## Code Map

- `src/services/eventsService.ts:245-284` -- `getEvents()`; the offline guard (`:246-251`), the single `.from('events').select('*')` chain with `.order('event_date', ascending: true)` (`:257`) and `.order('created_at', ascending: true)` (`:261`), the `toCoupleEvent`/`filter` drop of unreadable rows (`:270-273`), and the catch tail (`:277-283`) that must all survive. Its JSDoc `:227-244` states the no-`user_id`-filter rule and the not-index-backed sort note.
- `src/utils/dateUtils.ts:134-139` -- `formatDateISO(date)` builds a **local** calendar `YYYY-MM-DD`; use it for today's cutoff. Never `toISOString().split('T')[0]` (`dateUtils.ts:126-128` records that trap).
- `src/services/photoService.ts:241-253` -- the signature to mirror: `getPhotos(limit = 50, offset = 0)` with `.range(offset, offset + limit - 1)`.
- `src/stores/slices/eventsSlice.ts:116` -- the only caller, `await eventsService.getEvents()`; `sortByDate` (`:62-71`) mirrors the server order. Leave both as they are.
- `src/App.tsx:76-77` -- module-const precedent (`WELCOME_DISPLAY_INTERVAL`); `:609` `upcomingEvents` filter; `:610-615` `getEventsSlotView(events.length, upcomingEvents.length, …)` (must stay uncapped); `:680-689` the `upcomingEvents.map` to cap.
- `src/utils/countdownService.ts:49-69` -- the cap precedent: filter upcoming, sort soonest-first, `.slice(0, count)`, no overflow hint.
- `src/components/Settings/EventsSettings.tsx:1-24` -- documents why the list must stay unfiltered (past events editable) and why it calls `loadEvents()` itself.
- `tests/unit/services/eventsService.test.ts:83-181` -- the hand-rolled thenable PostgREST fake. It implements `select/insert/update/delete/eq/order/single/then` **only**; `gte`, `lt` and `range` must be added. `backend.filters` records `eq` calls only, and `:296-299` asserts `expect(backend.filters).toEqual([])` to prove no `user_id` filter — keep that assertion meaningful by recording date bounds in a separate array. `backend.fromCalls` (`:57`) is asserted `0` by the offline test.
- `tests/e2e/home/events.spec.ts:66-88` -- `seedEvent(supabaseAdmin, userId, dayOffset, label, description, icon)` plus `clearPairEvents` and the `afterEach` id drain; the card testid is `event-countdown-<kebab-label>`.

## Tasks & Acceptance

**Execution:**
- `src/services/eventsService.ts` -- change `getEvents()` to `getEvents(limit = 50, offset = 0)`; issue two bounded, parallel reads against `events` — upcoming `.gte('event_date', todayISO)` ordered `event_date`/`created_at` ascending, and past `.lt('event_date', todayISO)` ordered `event_date`/`created_at` descending — each `.range(offset, offset + limit - 1)`; concatenate the reversed past page ahead of the upcoming page, then map/filter rows exactly as today. Update the JSDoc to state the window, the two-sided `limit`/`offset` meaning, and why ascending-only paging was rejected. -- Bounds the read (DW-9) without letting accumulated history hide the next event.
- `src/App.tsx` -- add a `HOME_MAX_EVENT_CARDS = 3` module const beside `WELCOME_DISPLAY_INTERVAL` and render `upcomingEvents.slice(0, HOME_MAX_EVENT_CARDS)`; leave the `getEventsSlotView` arguments uncapped. -- Bounds the right-hand column (DW-22) on the `maxDisplay={3}` precedent.
- `tests/unit/services/eventsService.test.ts` -- teach the fake builder `gte`, `lt` and `range` (recording date bounds separately from `eq` filters), update the existing order assertion for the two windows, and cover the I/O matrix rows: default read, per-side cap, next-event-survives-the-cap, outward paging, today-dated row, unreadable row, offline (still zero `from()` calls), query error. -- The next-event row is the one that fails against a naive ascending `.range`.
- `tests/e2e/home/events.spec.ts` -- add a P0 test seeding 4 upcoming events and asserting exactly 3 event cards render, being the 3 soonest, with the farthest absent and no placeholder. -- Home's rendered list is the outermost surface DW-22 names.

**Acceptance Criteria:**
- Given a couple whose event history exceeds the limit on either side of today, when `getEvents()` runs, then the number of rows requested is bounded by the limit rather than by the history size, and the soonest upcoming event is still in the result.
- Given the returned page, when the slice stores it, then it is already ascending by `event_date` with a `created_at` tiebreak, so `sortByDate` is a no-op re-sort.
- Given more upcoming events than the Home cap, when Home renders, then exactly `HOME_MAX_EVENT_CARDS` cards appear — the soonest ones — and the events slot still resolves to `'list'` rather than the empty placeholder.
- Given a card retires itself at local midnight, when the filter re-runs, then the next-soonest event takes the freed slot.
- Given Settings, when it renders the store's events, then already-passed events are still listed and editable.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 2, low 6)
- defer: 3: (high 0, medium 1, low 2)
- dismissed:
  - E2E label assertion is a non-retrying `allTextContents()` snapshot — the claimed race is not reachable: the cards come from one `set()` in `eventsSlice`, so they paint in a single render, and the preceding web-first `toBeVisible()` waits for it; the sibling test at `tests/e2e/home/events.spec.ts:177-181` uses the identical pattern.
  - The cap E2E cannot catch a bad merge order — refuted at the named site: Home filters past events out (`getUpcomingEventCards`), so a merge that misplaced past rows can never put them in the cards. The same test's other weakness (a past row consuming a cap slot) was verified and patched instead.
  - The cap E2E never checks DW-22's named symptom, so a regression dropping the Wedding card would pass — refuted: `tests/e2e/home/events.spec.ts:186-188` asserts both birthday cards and `event-countdown-wedding` visible in the same file's sibling P0 test.
  - Clock skew hides today's event from Home entirely — refuted: the row is still returned, from the past page rather than the upcoming one, and Home's own filter reads the same skewed clock it read before this change, so nothing new is hidden.
  - The change doubles the server-side sort — not established: the two windows sort disjoint subsets (`gte today` and `lt today`), so their combined input is the same row set the single unfiltered sort handled, not double it.
  - The test fake's range predicate diverges from Postgres on a null `event_date` — unreachable: `supabase/migrations/20260818000002_create_events_table.sql:20` declares `event_date date not null`.
  - Spec drift: the task text says 4 seeded events, the test seeds 5 — the fix edits the spec this build is implementing, and the count follows the spec's own I/O matrix row ("5 upcoming events in the store"), which is inside the read-only intent-contract.
  - The test file mixes `dateFromToday(n)` with hardcoded `'2026-09-12'` fixtures — the hardcoded ones assert the literal-date parse (`getFullYear`/`getMonth`/`getDate`), so they must keep a literal date; the pin only makes them upcoming, which is what those tests need.
  - `offset` semantics diverge from `photoService` (pages walk outward, so they do not concatenate) — not silent: stated in the `@param offset` JSDoc, and the intent named the signature to mirror, which is preserved.
  - No test crosses the read cap against a real database — refuted in part: every Home and Settings E2E now issues the real two-window chain against local PostgREST under RLS and passes, and truncation is covered at `limit = 2` in unit tests; what remains unexercised is the Supabase client's own `.range` implementation.
- addressed_findings:
  - `[medium]` `[patch]` The read cap silently truncates a list `EventsSettings` documents as complete, and the spec's own Boundaries claimed "past events keep reaching Settings" — corrected both comments to state what the cap drops (the oldest past events, the mistyped-year case) and that there is no "load more"; the affordance itself is deferred.
  - `[medium]` `[patch]` The capped tail's refill at local midnight was untested and untestable — no test renders `App`. Extracted `getUpcomingEventCards` into `EventCountdown.tsx` beside the existing `getEventsSlotView`, wired `App.tsx` to it, and added five unit tests including the midnight refill (soonest retires, 4th takes the freed slot).
  - `[low]` `[patch]` The two reads are two requests, so a row edited across today between them could return in both, giving Home a duplicate React key — the stale past copy is now dropped and the fresh upcoming one kept; covered by a new test.
  - `[low]` `[patch]` `limit`/`offset` were unvalidated: `getEvents(0)` built `.range(0, -1)`. Clamped with `Math.max`/`Math.floor` before the range is built; covered by a new test.
  - `[low]` `[patch]` Nothing asserted the read is exactly two queries, so a third unbounded `.select('*')` would have passed — added `expect(backend.queries).toHaveLength(2)` and `expect(backend.fromCalls).toBe(2)`.
  - `[low]` `[patch]` The past window's `created_at` descending tiebreak was shape-asserted but never behaviourally tested (the existing tiebreak fixture is upcoming-dated) — added a two-same-day-past-events test.
  - `[low]` `[patch]` The local-vs-UTC day cut was unpinned: swapping `formatDateISO(new Date())` for `toISOString().split('T')[0]` left all tests green. Added two near-midnight instants; the mutant now fails.
  - `[low]` `[patch]` The cap E2E seeded no past event, so capping the raw `events` array instead of the filtered one would have passed — seeded one, and verified the mutant now fails.

### 2026-08-19 — Review pass

Follow-up pass over the same baseline, now including the test-automation work
added since the first pass (`tests/api/events-read-window.spec.ts`,
`tests/e2e/home/events-read-window.spec.ts`, `tests/support/factories/events.ts`,
the two new fixtures in `tests/support/fixtures/index.ts`).

- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 1, low 8)
- defer: 4: (high 0, medium 1, low 3)
- dismissed:
  - `getUpcomingEventCards` clamps nothing while `getEvents` does — the sole production call site passes the module constant `HOME_MAX_EVENT_CARDS = 3`, no test varies it to a non-positive value, and the helper's JSDoc promises no clamping, so the claimed empty/truncated column has no path and no stated claim is broken.
  - `HOME_MAX_EVENT_CARDS` is unexported, so the E2E hardcodes a fourth copy of the literal — a test importing the production constant would assert the code against itself; the literal is the test's independent expectation, which is why the sibling cap test in `tests/e2e/home/events.spec.ts` also states its expected cards rather than importing them.
  - Most of the new factory's surface is unreachable — refuted in the load-bearing part: the duplicate-label throw and the row-count check run on every `seedEvents` call and protect each caller whether or not the return value is read; `eventDateFrom`/`eventInsert`/`clear` are the module's declared surface for later specs, and an exported-but-unused test helper has no consumer to harm.
  - The events factory is not wired into the factories barrel — `tests/support/factories/index.ts` is not a barrel: it declares `TypedSupabaseClient`, `SeedResult` and the session factories directly and re-exports nothing, so a peer module importing the shared type from `./index` is the directory's only existing convention.
  - The API spec's mutation evidence exercises the test, not the code, so no API case can go red for a production change — refuted at the named site: `tests/unit/services/eventsService.test.ts` pins each window's exact `bounds`, `orderings` and `range` plus `queries.toHaveLength(2)` and `fromCalls === 2`, and this pass measured it — the sequential-await mutant failed only the new concurrency test and the finiteness mutant only the three clamp tests, both inside that file. The residual drift risk is deferred rather than dismissed.
  - The new API spec does not use `apiRequest`, and `getUserAccessToken` builds a client it discards — the deviation is stated in the file header with its reason (a hand-written URL would assert a transcription of postgrest-js's `.range` serialization rather than the serialization itself, which is the one thing the unit fake cannot cover); and what is discarded is a client object, not a round trip — the `signInWithPassword` is the round trip and is required to obtain the JWT.
  - Symmetric `offset` makes paging non-additive and so breaks the "already ascending, `sortByDate` is a no-op" AC — refuted: that AC is about one returned array, and every returned array is ascending at any offset, because the past page is reversed and every past date sorts before every upcoming one. The cross-page non-additivity is stated in the `@param offset` JSDoc.
  - `getEvents(limit)` returns up to `2 × limit` rows while claiming photoService parity — the intent itself specifies "up to `limit` upcoming and up to `limit` already-passed", and the `@param` says "EACH side", so the 2× total is the specified contract rather than an unflagged divergence.
  - Neither window is index-backed and the migration's own comment is now stale — refuted at the named site: `supabase/migrations/20260818000002_create_events_table.sql:43-44` reads "The events read is 'my events and my partner''s, soonest first', so the index is on the event date, not created_at", which is still true and whose rationale two ordered windows strengthen. The doubled-sort half was refuted in the previous pass (the windows sort disjoint subsets).
  - Three artifacts disagree about the story's state — `status: in-review` is this pass's own transient value, which Finalize sets to `done`; the ledger rows carry `resolution: resolved by sweep bundle …` and are the orchestrator's bookkeeping, which this invocation reserves to the orchestrator.
  - `## Spec Change Log` is empty although the shipped diff exceeds the Tasks section — the fix edits the spec this build is implementing; the change log records bad_spec loopbacks, of which there have been none, and the extra files are recorded under `addressed_findings`.
  - The spec's Never list forbids the `deferred-work.md` edits present in this diff — those edits are not this build's: they carry `resolution: resolved by sweep bundle dw-events-read-cap-and-pagination`, `resolution-undo` hashes, and `origin: spec-deferred` entries, i.e. the orchestrator's sweep, which this invocation explicitly owns and forbids reverting.
  - `warnings: ['oversized']` carries no explanation — the fix edits the spec this build is implementing, and `warnings` is planning-time frontmatter.
  - A device clock outside years 1000–9999 makes `formatDateISO` build a malformed date predicate — no path: a clock that far off fails the JWT `exp`/`nbf` check at sign-in, so no events read is ever issued.
  - The local-vs-UTC day-cut pin is vacuous at UTC offset zero — `vitest.config.ts` pins `TZ: 'America/New_York'` for the whole run, so the offset-zero case does not arise; re-verified green this pass under `TZ=Europe/Berlin` as well.
  - `readEventWindows` sends `range(0, -1)` for `limit = 0`, unlike the clamped production path — the helper is file-private and every call passes 2 or 50, so the claimed throw has no path.
  - `getUpcomingEventCards` slices without sorting, so the cap could keep arbitrary events — premise refuted: `loadEvents` stores the service array unchanged and it is ascending by construction, and `addEvent`/`updateEvent` re-sort with `sortByDate`, so the filtered list is always soonest-first.
  - The Settings acceptance criterion overstates what survives the cap — the fix edits the spec this build is implementing; the bound itself is stated in the service JSDoc, in `EventsSettings.tsx`, and (this pass) in `loadEvents`' JSDoc.
  - App's wiring of the UNCAPPED count into `getEventsSlotView` is unpinned because no test renders App — refuted: with `HOME_MAX_EVENT_CARDS >= 1`, `min(uncapped, cap) === 0` exactly when `uncapped === 0`, so the capped and uncapped counts produce the same `getEventsSlotView` result in every reachable state. The substitution is unobservable, so no test could distinguish it and the boundary cannot be violated visibly.
  - The mid-read duplicate is tested at a surface that cannot hold the state (two rows sharing an id in one fake table) — the fake models two RESPONSES, not one table snapshot; the branch under test is the merge's id comparison, which the fixture reaches directly.
  - `offset` is verified at three surfaces and consumed at none — out of scope on the intent's own authority: Never forbids new call-site arguments, so `loadEvents` keeps calling `getEvents()` bare. Carried as a residual risk instead.
  - Clamping and the dedupe are unrequested contract additions where the matrix claims to be exhaustive — descriptive, not a defect: both were prior-pass patches with covering tests, and neither changes any matrix row's expected outcome.
- addressed_findings:
  - `[medium]` `[patch]` The one acceptance criterion that lives only in `App` — "a card retires itself at local midnight, the next-soonest event takes the freed slot" — had a test that passed with the wiring deleted. Confirmed independently this pass: removing `onRetire={handleEventRetired}` from `src/App.tsx` left both E2E tests green. Cause: the test installed the clock at the anchor and fast-forwarded ~24h, pushing the page clock AHEAD of the stored session's mint time, so supabase-js refreshed the token and `TOKEN_REFRESHED` re-rendered App on its own. Reworked to install the clock five minutes before the anchor day's local midnight — inside the previous day, so the page clock runs BEHIND real time and no refresh is ever due — and to cross with a five-minute jump. Seed offsets shifted one day back to match. Measured after the change: the `onRetire` mutant now FAILS, and the frozen-clock mutant still fails. The same rework removes a flake the anchor version carried (a run starting seconds before real local midnight crossed the day during page load and retired the card before the first assertion), and renames the misleading `cardTestIds` locator to `eventCards`.
  - `[low]` `[patch]` The clamp added last pass is defeated by a non-finite argument: `Math.max(1, Math.floor(NaN))` is `NaN` and `Math.floor(Infinity)` is `Infinity`, so both reach `.range()` and produce exactly the PostgREST 400 the clamp exists to prevent. Added a `Number.isFinite` guard falling back to a new `DEFAULT_EVENTS_PAGE_SIZE` const (now also the signature default, so the two cannot drift), with three tests; verified the guard's removal fails only those three.
  - `[low]` `[patch]` The merge comment reasoned about only one of the three ways two non-atomic reads can disagree. Rewritten to name all three — returned by both (handled), returned by neither, and the kept copy being the pre-edit one — and to say why the latter two are left alone. The correctness fix is deferred.
  - `[low]` `[patch]` `eventsSlice.loadEvents`' JSDoc still promised "Load every event visible to this account", which this change made false. Corrected to state the bounded window, what the cap drops, and that there is no "load more" — the same correction `EventsSettings.tsx` got last pass.
  - `[low]` `[patch]` `getCalendarDaysDiff` was left re-exported from `src/components/RelationshipTimers/index.ts` after App stopped importing it, with no consumer anywhere (its only other user imports it directly from the module). Removed, with a comment saying why it is deliberately absent.
  - `[low]` `[patch]` The 51-past-events E2E asserted no card count and named only the first and last history row, leaving the 49 in between free to render. Replaced with an assertion over the whole seeded history plus an exact count of one event card.
  - `[low]` `[patch]` Nothing pinned that the two windows are issued concurrently, though "costs one extra parallel request" is a load-bearing claim in both the JSDoc and the Design Notes — a sequential rewrite passed every assertion in the file. Added a test reading `backend.fromCalls` synchronously after the call; verified the sequential-await mutant fails only that test.
  - `[low]` `[patch]` Two lines in `tests/support/factories/events.ts` ran to 104 characters where every sibling test file stays at or under 100 and the repo has no formatter. Wrapped; the file's longest line is now 99.
  - `[low]` `[patch]` The new factory's header cited the three hand-rolled copies it supersedes without saying they were deliberately left in place, so a reader would infer the duplication was gone. Added the reason it was not migrated.

### 2026-08-19 — Review pass

Third pass over the same baseline. Production source is unchanged since the
previous pass, so the newest material under review is the test-automation work,
which had had exactly one pass. The four layers were launched together as the
step requires; none returned inside the session's working budget, and this
worktree's `CLAUDE.md` forbids sleep-waiting on a background subagent here
(it burns the whole session timeout), so the four lenses were then run
in-session against the same staged diff, following their own instruction files
(`review-prompts/edge-case-hunter.md`, `review-prompts/verification-gap.md`)
and the blind-hunter and intent-alignment prompts as written.

- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- dismissed:
  - The frontmatter's deferred item "a row whose date cannot be parsed still consumes a slot inside the capped window, so garbage can push a real event off the page" is refuted at the named site — every value a Postgres `date` column can hold that `parseEventDate` rejects sorts to the FAR end of its own window, so it is the first row the cap drops, never a crowder: `infinity` satisfies `gte today` and the upcoming page is ordered `event_date` ASC, so it lands last; `-infinity`, a BC date and a year outside `\d{4}` all satisfy `lt today` and the past page is ordered DESC, so they land last too. Dismissed rather than corrected because the fix edits the spec this build is implementing (its own frontmatter `deferred` list) and the ledger row migrated from it, both of which this invocation reserves to the orchestrator.
  - `getEvents` lets a finite-but-astronomical `limit` (e.g. `1e308`) past the `Number.isFinite` guard and would build `.range(0, 1e308)` — no path to the claimed PostgREST 400: `grep -rn "getEvents(" src tests` shows the only production call site is `src/stores/slices/eventsSlice.ts:116`, which passes no arguments, and no test passes such a value. Same disposal as the previous pass's `getUpcomingEventCards` clamping finding.
  - Dropping `getCalendarDaysDiff` from `src/components/RelationshipTimers/index.ts` orphans a consumer — refuted: `grep -rn "getCalendarDaysDiff" src tests` shows the only import outside `EventCountdown.tsx` itself is `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx:21`, which imports from `'../EventCountdown'` directly, and `npm run typecheck` reports zero non-`TS2883` errors.
  - The API spec's postgrest-js citation is stale, so its `.range` premise may not hold — verified against the installed `@supabase/postgrest-js@2.112.3`: `src/PostgrestTransformBuilder.ts:567-573` is exactly the `keyOffset`/`keyLimit`/`searchParams.set` block, and it emits precisely `offset=<from>` and `limit=<to - from + 1>`, as the header states.
  - The new `[P2]` API case never runs in the normal verification path, so one of the seven is decorative — refuted: `.github/workflows/test.yml:195` runs `npx playwright test --project=${{ matrix.project }}` with no `--grep`, so every priority tier runs in CI, and `[P2]` is an established repo convention (17 occurrences across the existing suite).
  - The events factory's header miscites the three hand-rolled duplicates it supersedes — verified: `tests/e2e/home/events.spec.ts:36-68`, `tests/e2e/settings/events-crud.spec.ts:37-69` and `tests/api/check-constraint-error-mapping.spec.ts:65-84` each contain exactly the resolver the header names at those lines.
  - The service JSDoc's "Neither sort is index-backed: `idx_events_user_event_date` leads on `user_id`" is stale — verified at `supabase/migrations/20260818000002_create_events_table.sql:45-46`: `create index if not exists idx_events_user_event_date on public.events (user_id, event_date)`.
  - The Settings acceptance criterion ("already-passed events are still listed and editable") is unverified at the outermost surface — refuted: `tests/e2e/settings/events-crud.spec.ts:311` is `[P0] lists a past event with its controls, where Home hides it`, and it asserts the row and its controls.
  - `supabaseAsUser` signs in per test, which could invalidate the browser's stored session for the same worker identity — could not be substantiated: GoTrue's password grant creates an additional session rather than revoking existing ones, and no test uses `supabaseAsUser` and a browser context together (`tests/api/events-read-window.spec.ts` is its only consumer, and the `api` project drives no browser).
- addressed_findings:
  - `[medium]` `[patch]` `_bmad-output/test-artifacts/automation-summary-dw-events-read-cap-and-pagination.md` still describes the refill E2E as it stood BEFORE the previous pass reworked it, and the same stale claim is repeated in `bmad-build-auto-result-dw-events-read-cap-and-pagination-tea.automate-1.md`. §6's mutant-C row records "Both E2E tests still passed" for deleting `onRetire={handleEventRetired}`, and the paragraph under it generalises that to "No browser-level test can attribute the re-render to one trigger" — which the reworked test disproves, since removing every other available re-render trigger is exactly how it attributes it. A reader trusting the summary would conclude the refill test is decorative for the wiring its acceptance criterion names, and could delete or weaken it. Two §10 line counts are stale for the same reason (E2E 170 vs 213 actual, factory 223 vs 234 actual; both still under the 1000 criterion). Fixed by appending a dated correction block to §6 and a dated correction under the tea.automate result's mutation line, in both cases preserving the original measurement as the record of what was true when it was taken rather than rewriting it.
  - `[low]` `[patch]` `tests/e2e/home/events-read-window.spec.ts`' justification for existing was wrong in two independent, measurable ways, both from unverified claims about sibling coverage. (1) The header said "the unit file caps at 2, `tests/api/events-read-window.spec.ts` at 2 … none of them exercises the number that actually ships": the unit file's default-limit cases assert `range: { from: 0, to: 49 }`, and three of the seven API cases pass `50` explicitly, so several tests do read at the shipped default — the real, narrower gap is that none of them seeds more rows than that, so the cap never truncates there. (2) The `PAST_HISTORY_SIZE` JSDoc said that at 50 "a naive ascending read would still happen to include the upcoming row": over 50 past rows plus one upcoming, a single ascending `.range(0, 49)` returns the 50 past rows and excludes the upcoming one, so the mutant is caught at 50 as well — 51 is about the cap actually dropping something, not about reaching the mutant. Both blocks rewritten to what the code does. Consequence of leaving them: an auditor would either delete the API spec's limit-50 cases as redundant or delete this test believing it duplicates them.

## Design Notes

Why two windows rather than one `.range()`: the read has to serve Home (soonest upcoming) *and* Settings (full list, past included) from one store array. A single ascending page keeps the **oldest** rows, and every event eventually becomes a past event — so that design is guaranteed to hide all upcoming events given enough time. A single descending page keeps the **farthest-future** rows, which hides the *next* event as soon as the couple has more than `limit` future events. Only a window anchored at today is safe in both directions, and it costs one extra parallel request:

```ts
const todayISO = formatDateISO(new Date());
const [upcoming, past] = await Promise.all([
  supabase.from('events').select('*').gte('event_date', todayISO)
    .order('event_date', { ascending: true }).order('created_at', { ascending: true })
    .range(offset, offset + limit - 1),
  supabase.from('events').select('*').lt('event_date', todayISO)
    .order('event_date', { ascending: false }).order('created_at', { ascending: false })
    .range(offset, offset + limit - 1),
]);
// past is newest-first; reversing it restores event_date ASC + created_at ASC,
// and every past date sorts before every upcoming one, so the concatenation is
// globally ascending without a JS comparator.
```

Reversing an already-ordered page is not a client-side re-sort: it is exact, and it keeps the "no JS comparator runs here" property the existing `getEvents` comment relies on to justify dropping unreadable rows.

## Verification

**Commands:**
- `npx vitest run tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts` -- expected: all pass, including the new cap/paging cases.
- `TZ=America/New_York npx vitest run tests/unit/services/eventsService.test.ts` and the same with `TZ=Europe/Berlin` -- expected: identical results (the file's own timezone rule).
- `npm run typecheck` -- expected: no new errors beyond the worktree TS2883 baseline.
- `npm run lint` -- expected: clean.
- `npm run test:unit` -- expected: no regression.
- `npx playwright test tests/e2e/home/events.spec.ts` (needs `supabase start`) -- expected: all pass. If local Supabase cannot be started, say so plainly rather than reporting the suite as green.



## Auto Run Result

Status: done

### What changed

`eventsService.getEvents()` took no parameters and issued no `.limit()`/`.range()`, so the query grew with the couple's whole event history (DW-9); Home then mapped every upcoming event, so its right-hand grid column grew unbounded against the fixed two-card birthdays column (DW-22). Both are now bounded.

The read takes `(limit = DEFAULT_EVENTS_PAGE_SIZE, offset = 0)` — the `photoService.getPhotos` signature the spec named — and reads a bounded page on **each side of today**: upcoming (`gte` today, ascending) and already-passed (`lt` today, descending), in parallel, merged back into the same `event_date` ascending / `created_at` ascending order the caller already had. One page could not be bounded safely, because every event eventually becomes a past event: an ascending page would eventually hold nothing but past rows and Home would show "No upcoming events yet." while a real event was days away. Home renders `getUpcomingEventCards(events, now, 3)`, following the existing `maxDisplay={3}` precedent, and the events-slot decision still sees the uncapped upcoming count.

This third pass reviewed the same baseline again. No production source changed in it: the two remaining defects were both false statements *about* the shipped tests — one in the newest test file's own justification, one in the test-automation summary that the previous pass's rework had silently invalidated.

### Files changed

- `src/services/eventsService.ts` — `getEvents(limit, offset)`: two bounded date-partitioned reads, clamped range bounds (including a finiteness guard and a shared `DEFAULT_EVENTS_PAGE_SIZE`), stale-duplicate drop, and JSDoc stating what the cap drops, that a call returns up to `2 × limit` rows, and all three ways two non-atomic reads can disagree.
- `src/App.tsx` — `HOME_MAX_EVENT_CARDS = 3`; the filter-and-cap moved into `getUpcomingEventCards`; the slot decision still takes the uncapped count.
- `src/components/RelationshipTimers/EventCountdown.tsx` — new exported `getUpcomingEventCards` helper beside `getEventsSlotView`, so the filter, the cap and the midnight refill are unit-testable.
- `src/components/RelationshipTimers/index.ts` — exports the new helper; `getCalendarDaysDiff` removed, with the reason recorded.
- `src/components/Settings/EventsSettings.tsx` — comment correction: the list is unfiltered but no longer unbounded.
- `src/stores/slices/eventsSlice.ts` — `loadEvents`' JSDoc no longer promises every event; it states the window and what the cap drops.
- `tests/unit/services/eventsService.test.ts` — the PostgREST fake learns `gte`/`lt`/`range` and records per-query windows; sixteen new cases, including the finiteness clamp and the two-window concurrency pin.
- `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx` — five cases for the new helper, including the midnight refill.
- `tests/e2e/home/events.spec.ts` — P0: five upcoming events plus one past render exactly the three soonest cards.
- `tests/api/events-read-window.spec.ts` (new) — 7 cases driving the two-window read against local PostgREST under a real user JWT, so `.range`/`.order`/`.gte`/`.lt` are exercised as postgrest-js actually serialises them.
- `tests/e2e/home/events-read-window.spec.ts` (new) — 2 cases: the shipped default protecting Home at 51 past rows, and the capped tail refilling at local midnight. **This pass:** its two justification blocks corrected to what the sibling tests and the naive-ascending mutant actually do.
- `tests/support/factories/events.ts` (new) — anchored seeding and worker-pair id resolution for new events specs.
- `tests/support/fixtures/index.ts` — `coupleEvents` (seed with clear before and after) and `supabaseAsUser` (RLS-scoped client).
- `_bmad-output/test-artifacts/automation-summary-dw-events-read-cap-and-pagination.md` — **this pass:** dated correction appended to §6, where the mutant-C measurement and the "no browser-level test can attribute the re-render" generalisation had been invalidated by the previous pass's rework; the two stale §10 line counts named in the same block.
- `_bmad-output/implementation-artifacts/bmad-build-auto-result-dw-events-read-cap-and-pagination-tea.automate-1.md` — **this pass:** dated correction under its mutation line, which repeated the same stale claim.

### Review findings

Four lenses ran (blind hunter, edge-case hunter, verification-gap, intent-alignment). The layers were launched together as the step requires and none returned inside the session's working budget; this worktree's `CLAUDE.md` forbids sleep-waiting on a background subagent, so the four lenses were run in-session against the same staged diff, following their own instruction files.

This pass: **2 entries patched** (1 medium, 1 low), **0 deferred**, **9 dismissed**. Every dismissal carries the reason that disposes of its own claim, and every patch its action, in the Review Triage Log above. The frontmatter `deferred` list is unchanged at 7 items.

Cumulative across all three passes: 19 patched, 7 deferred, 41 dismissed.

Follow-up review recommended: **false**. Patched entries this pass: 0 high, 1 medium, 1 low → `3 × 1 + 1 × 1 = 4`, below the threshold of 5.

### Verification performed

Everything below was run in this session, against the reviewed working tree, with the local Supabase stack up (`supabase_db_My-Love`, `supabase_rest_My-Love`, `supabase_auth_My-Love`, `supabase_kong_My-Love` all running).

- `npx vitest run tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts` — 70 passing (48 of them in the service file).
- `TZ=Europe/Berlin npx vitest run tests/unit/services/eventsService.test.ts` — 48 passing. Note `vitest.config.ts` pins `TZ: 'America/New_York'` for the run, so the command-line variable does not actually change the environment.
- `npm run test:unit` — 92 files, 1401 tests, all passing.
- `npx playwright test --project=chromium tests/e2e/home/events.spec.ts tests/e2e/home/events-read-window.spec.ts` — 9 passing, including both tests in the file this pass edited.
- `npx playwright test --project=api tests/api/events-read-window.spec.ts` — 7 passing.
- `npm run typecheck` — 6 `TS2883` errors, all in `tests/support/merged-fixtures.ts`, all pre-existing worktree-only baseline; **zero** non-`TS2883` errors.
- `npm run lint` — 0 errors, 3 warnings, all the pre-existing `react-refresh/only-export-components` kind raised by the helpers `EventCountdown.tsx` exports.
- Longest line in the edited spec measured with `awk` after the patch: 95 characters, inside the file's own 100-character convention.

Not re-run this pass, because the patches touch only comments in one test file and two markdown artifacts and no production source changed since the previous pass: the mutation-testing sweep (`onRetire` deletion, frozen App clock, removed `Number.isFinite` guards, sequential-`await` rewrite) and the `--repeat-each` burn-ins. Their measurements from the previous pass stand and are recorded above.

### Residual risks

- The cap has to drop something. It drops the far future and the deep past; the deferred list records that Settings has no way to page back to truncated rows, and that a row saved outside the window is shown once and then disappears.
- `limit`/`offset` have no production caller — the store still calls `getEvents()` bare, as the spec's Boundaries require — so the paging half of DW-9 ships as API surface that only tests exercise. Nothing detects that a caller written to photoService's paging model would wrongly expect successive pages to concatenate; the `@param offset` JSDoc is the only warning.
- The read depends on the device's calendar day as well as on the rows. Both windows share one cutoff and stay complementary, so no row can fall between them; only which page a same-day row arrives in would shift on a skewed clock.
- The two windows are two requests, not one snapshot. All three disagreement cases are documented; only the duplicate is handled, and the other two are deferred.
- `tests/api/events-read-window.spec.ts` mirrors the production query chain by hand because `import.meta.env` makes the service unloadable under the Playwright runner. The unit file's `backend.queries` assertions are what stop the two drifting silently; a change made in both places, incorrectly, would pass. Deferred.
- Neither window requests a count, so no "there are more" signal exists for a future load-more control. Deferred.
- The frontmatter's "unreadable row consumes a slot" deferred item, and the ledger row migrated from it, state a consequence this pass refuted (such a row always sorts to the far end of its own window, so it is the first thing the cap drops). Left standing because correcting it means editing the spec this build implements and a ledger entry the orchestrator owns; the reasoning is in the triage log above.
