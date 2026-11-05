---
title: 'An events refresh keeps the Load more depth, and an event page reads its event by id'
type: 'bugfix'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: 'ce235809fda3a9bbf026c3daf2a31a86c04a0997'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `loadEvents` (`loadPage(false)`) always reads the server's first 50-row window per side and replaces the list, so a reconnect or `eventsStale` load on the Dates list drops every row `Load more` reached (DW-440); and a reload of an event page whose event lies beyond the first window falls back to the Dates list as if it were deleted, because nothing reads one event by id (DW-445).

**Approach:** The slice counts how many pages deep the shown traversal is, and a refresh asks `getEventsPage` for that many pages per window in one read (one request per window), committing cursors at that depth. `eventsService.getEvent(id)` reads one row; a new slice action `loadEvent(id)` upserts a found row; `EventPage` calls it after its own `loadEvents()` succeeded without the event, and falls back only when that read also answers "no such event".

## Boundaries & Constraints

**Always:** A refresh still reads fresh rows from the server and replaces the list (the owner's 2026-11-03 choice of an up-to-date list); the depth resets to one page whenever the pagination it was counted against is gone (sign-out's `signedOutState()` nulls it, a test `setState`s a new one). Session guards (`userId` + `authSessionVersion`) around every await. `loadEvent` failures never touch `eventsError`, and a `failure`/`stale` answer never falls back. Keep every assertion old tests checked; where one changes, say why in the commit.

**Never:** No new store field and no change to the `EventsPagination` type (19 test files build it literally). No sequential per-page loop. Do not remove `DatesPage`'s `keptOnArrival` skip or `EventPage`'s `held` skip — they still keep a row added beyond the depth. No `supabase.channel()`, no edit of `deferred-work.md`, no `prettier --write`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Refresh at depth | 1 refresh + 2 Load more succeeded | next `loadEvents` calls `getEventsPage(undefined, 3)`; list = server's 150 rows/side; later Load more continues from that cursor | — |
| No traversal | `eventsPagination` null (fresh start, after sign-out) | `getEventsPage(undefined, 1)` | — |
| Failed refresh | depth 3, read rejects | rows, cursors and depth 3 kept | `eventsError` set as today |
| Event beyond window | reload `dates/event/<deep id>` | `loadEvents` success → absent → `loadEvent` finds it → page shows it, field pages work | — |
| Deleted / unknown id | row absent, `getEvent` → null | falls back to Dates once | — |
| Malformed id | `getEvent('not-a-uuid')` → PostgREST `22P02` | answers `null` (falls back) | other errors throw as `getEventsPage` does |
| By-id read fails / offline | `getEvent` throws | `loadEvent` → `failure`; page stays, no fallback | offline refuses before any request with `offlineMessage('Events', 'load')` |

</intent-contract>

## Code Map

- `src/services/eventsService.ts` -- `getEventsPage` (:332) reads `DEFAULT_EVENTS_PAGE_SIZE`(50)+1 lookahead per window via `windowPage` (:293); add a `pages = 1` param (clamped finite int ≥ 1) multiplying the window size in `.range` and `windowPage`. Add `getEvent(eventId): Promise<CoupleEvent | null>` (`select('*').eq('id', …).maybeSingle()`, `toCoupleEvent`, same offline guard and catch tail as `getEventsPage`; `isPostgrestError(error) && error.code === '22P02'` → `null`). Update docstrings.
- `src/stores/slices/eventsSlice.ts` -- `loadPage` (:361). Add a closure `traversal: { pagination: EventsPagination; pages: number } | null`; depth = `traversal.pages` only when `traversal.pagination === get().eventsPagination`, else 1. Refresh calls `getEventsPage(undefined, depth)`, append keeps `getEventsPage(eventsPagination)`; on success set `traversal = { pagination: page.pagination, pages: append ? depth + 1 : depth }`. New action `loadEvent(eventId): Promise<EventLoadResult>` beside `loadEvents`: on a found row `recordMutation(upsert)`, `sortByDate(upsertEvent(...))`, `saveEventsCopy`. Update header (:19-23) and refresher comment (:301-305).
- `src/components/Settings/EventPages.tsx` -- load effect (:198-204): after `success`, if `useAppStore.getState().events` lacks `eventId`, await `loadEvent(eventId)`; `setAnswered(true)` only on its `success`. Add `loadEvent` to deps. Update header (:20-31) and effect comment (:187-193).
- `src/components/Settings/DatesPage.tsx` -- comments only (:21-27, :115-121): a load now keeps the depth; the arrival skip remains for a date added beyond it.
- `tests/unit/services/eventsService.test.ts`, `tests/unit/stores/eventsSlice.test.ts` -- its mock wrapper (:27) forwards only the first arg; forward all, and update `calls[1]).toEqual([undefined])` (:276) to `[undefined, 1]`.
- `src/components/Settings/__tests__/Settings.eventPages.test.tsx` -- stubs store actions in `beforeEach` (:184) and `original` (:76); add a `loadEvent` stub (default `{status:'success'}`, store untouched).
- `tests/e2e/settings/events-history-pagination.spec.ts` -- helpers `openDates`, `loadHistory`, `rowTestId`, `history`; `coupleEvents.seed` may be called again mid-test. Home test (:349-360) expects `count: 2 * EVENTS_PAGE_SIZE` after Home's read: with depth kept it becomes `specs.length`. Reconnect pattern: `events-load-recovery.spec.ts:161-190`. Read globs in `tests/support/helpers/reads.ts`; add `EVENT_BY_ID_READ = '**/rest/v1/events?*id=eq.*'` there.

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/eventsService.ts` -- `pages` param and `getEvent` -- depth read in one request per window; DW-445's by-id read.
- [ ] `src/stores/slices/eventsSlice.ts` -- depth counter, refresh at depth, `loadEvent` action -- DW-440, DW-445.
- [ ] `src/components/Settings/EventPages.tsx` -- read by id before the fallback -- DW-445.
- [ ] `src/components/Settings/DatesPage.tsx` -- correct the comments that say a load drops Load-more rows.
- [ ] `tests/unit/services/eventsService.test.ts` -- `pages` range/lookahead/cursor; `getEvent` found, null, 22P02, other error, offline.
- [ ] `tests/unit/stores/eventsSlice.test.ts` -- every matrix row for the slice, plus `loadEvent` found/absent/failure/identity-change (stale, no write).
- [ ] `src/components/Settings/__tests__/Settings.eventPages.test.tsx` -- found by id stays and renders; by-id failure never falls back; not found falls back once under StrictMode.
- [ ] `tests/support/helpers/reads.ts`, `tests/e2e/settings/events-history-pagination.spec.ts` -- new cases below; Home test count.

**Acceptance Criteria:**
- Given the Dates list showing every seeded row after Load more and a past row seeded on the server meanwhile, when the connection drops and returns, then the list's refresh read answers 200 and the list shows every earlier row plus the new one.
- Given an event page opened from a row Load more reached, when a reconnect marks the list stale and the person goes Back, then the Dates list's load keeps every row Load more reached.
- Given a past event beyond the first window, when its page `/settings/dates/event/<id>` is reloaded, then the page stays on that URL showing the event's name, and its Name field page opens with the saved name.
- Given a deleted or unknown event's URL, when it loads, then it falls back to the Dates list once, as today.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; touched `eventsService.ts`, `eventsSlice.ts`, `EventPages.tsx`, `DatesPage.tsx` (comments), `reads.ts`, the three unit test files, `tests/unit/services/fakeEventsBackend.ts` (`maybeSingle`) and `events-history-pagination.spec.ts` (four new cases; Home case's post-read count is now `specs.length`, because Home's refresh keeps the depth the Dates list paged to).
- Added beyond the plan: `MAX_EVENTS_PAGES_PER_READ = 19` in `getEventsPage`, so one request never exceeds PostgREST `max_rows` (1000 in `supabase/config.toml`; hosted value UNVERIFIED), where a capped answer would pass for a finished window.
- Verify-time fix (main session): the subagent's `EventPage` read the live store with `useAppStore.getState()` under an `eslint-disable` of `no-restricted-properties`. Moved the "already held" check into `loadEvent` instead (a held event answers `success` with no request), so `EventPage` always calls `loadEvent` after a successful load and carries no suppression; slice and component tests adjusted.
- E2E reconnect cases move `navigator.onLine` and dispatch `offline`/`online` rather than `context.setOffline`, which corrupts traces a describe group cannot switch off. No E2E sends a malformed id (its PostgREST 400 would trip the network-error monitor); `22P02` is unit-tested.
- Behaviour note: offline with a saved copy lacking the event, the page now stays (by-id read refuses) instead of falling back, per the matrix's offline row.

## Plan Change Log

## Review Triage Log

### 2026-11-04 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 3, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` A refresh at depth k reads exactly k×50 rows per side, so a past row inserted nearer today than the deepest shown row pushes the k×50th row off until Load more — real, but it needs more than 50 past events on one side, a Load more, and a past date added between today and the deepest row before a refresh, and the one row comes back with Load more; the only exact fix is a cursor-bounded read plus a lookahead request, which is new branching beyond a direct correction. Recorded as a residual risk.
  - `[low]` `[reject]` Past 19 pages (950 rows) per side a refresh reads only 19, and `traversal.pages` records the asked depth, not the clamped one — the cap stops PostgREST `max_rows` (1000) from silently truncating a window, and 950 past events per side is not met in everyday use for a couple; the overstated count is harmless because the service clamps every read. Recorded as a residual risk.
  - `[low]` `[patch]` The Home E2E post-read count changed from `2 * EVENTS_PAGE_SIZE` to `specs.length`, so it no longer proves the list was replaced — replacement at depth is proved by the unit test "replaces the list with the server's rows at that depth"; fix: the commit message states why the assertion narrows (AGENTS.md assertion-rewrite rule).
  - `[low]` `[patch]` The E2E case "an unknown event id falls back to the Dates list once" never checked "once" — fix: the implementer dropped "once" from the title; "once" stays proved by the StrictMode unit test that counts `replaceState` calls.
  - `[low]` `[reject]` The plan's task checkboxes are unchecked — its fix edits this build's plan, which triage rejects.
  - `[false]` `[reject]` A failed by-id read leaves a blank page with no message — this is the matrix's specified behaviour ("page stays, no fallback"), and a failed `loadEvents` already left the same blank page before this change; the by-id failure logs the same way `loadEvents` failures do.

## Auto Run Result

Status: built

**Summary:** An events refresh (`loadEvents`) now re-reads as many 50-row pages per side as `Load more` reached, in one request per side, so a reconnect, an `eventsStale` load or Home's load keeps the older dates while staying up to date (DW-440). `eventsService.getEvent(id)` and the slice action `loadEvent(id)` read one event by id; an event page that its own load did not return reads it by id and falls back to the Dates list only when the server says there is no such event (DW-445).

**Files changed:**
- `src/services/eventsService.ts` — `getEventsPage(pagination, pages)` reads `pages × 50` rows + lookahead per window, capped at 19 pages; new `getEvent` (22P02 → null).
- `src/stores/slices/eventsSlice.ts` — closure depth counter keyed to the `eventsPagination` object; refresh at depth; new `loadEvent` (held event answers with no request; found row upserted, replayed into in-flight loads, copy saved).
- `src/components/Settings/EventPages.tsx` — reads by id after a successful load before the fallback.
- `src/components/Settings/DatesPage.tsx` — comments corrected.
- `tests/support/helpers/reads.ts` — `EVENT_BY_ID_READ`.
- `tests/unit/services/eventsService.test.ts`, `tests/unit/services/fakeEventsBackend.ts`, `tests/unit/stores/eventsSlice.test.ts`, `src/components/Settings/__tests__/Settings.eventPages.test.tsx` — depth, by-id and fallback coverage.
- `tests/e2e/settings/events-history-pagination.spec.ts` — reconnect refresh, Back after a reconnect, reload of a deep event page, unknown id; Home case count now `specs.length`.

**Review findings:** 2 patches applied (both low: E2E title no longer claims "once"; commit message explains the Home assertion change). 0 deferred. Rejected: the page-boundary displacement (low, rare, fix needs a cursor-bounded read), the 950-row cap (low, never met in everyday use), unchecked plan checkboxes (fix edits the plan), blank page on a failed by-id read (false: specified by the matrix and pre-existing for failed loads).

**Follow-up review recommendation:** false — patched: high 0, medium 0, low 2.

**Verification:** `npm run typecheck` exit 0 (no errors); `npm run lint` exit 0; `npm run test:unit` 223 files / 4118 tests passed; the four E2E specs (`events-history-pagination`, `event-pages`, `dates-list`, `events-load-recovery`) 16 passed against local Supabase, run before and after the review patch.

**Residual risks:** a past row added nearer today than the deepest shown row pushes one row past the re-read depth until Load more; beyond 19 pages per side a refresh reads 950 rows; the hosted PostgREST `max_rows` is UNVERIFIED (local is 1000); the E2E reconnect cases move `navigator.onLine` rather than cutting the network; offline with a saved copy lacking the event, an event page now stays blank instead of falling back.

## Design Notes

One read at depth (`pages × 50` rows + 1 lookahead per window) instead of re-walking cursors: same rows, one round trip, and its cursor is the last row read, so Load more continues seamlessly. The depth lives in the slice closure keyed to the pagination object's identity, so any reset invalidates it without a new account-scoped field. `loadEvent` records an upsert mutation so a load already in flight replays the found row instead of dropping it under the open page.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors other than the worktree-only `TS2883` ones at `tests/support/merged-fixtures.ts` (their count varies; any other error fails)
- `npm run lint` -- expected: exit 0
- `npx vitest run tests/unit/services/eventsService.test.ts tests/unit/stores/eventsSlice.test.ts tests/unit/stores/eventsSlice.localCopy.test.ts src/components/Settings/__tests__/Settings.eventPages.test.tsx src/components/Settings/__tests__/Settings.dates.test.tsx` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npx playwright test --project=chromium tests/e2e/settings/events-history-pagination.spec.ts tests/e2e/settings/event-pages.spec.ts tests/e2e/settings/dates-list.spec.ts tests/e2e/settings/events-load-recovery.spec.ts` -- expected: all pass (needs `supabase start`)
