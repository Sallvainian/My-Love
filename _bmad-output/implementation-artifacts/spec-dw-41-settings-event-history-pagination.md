---
title: Settings event history pagination
type: feature
created: 2026-09-12
status: done
baseline_revision: 0dfa6b5b11695284f97d6d9a6793a8f28e57f603
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Settings cannot reach events beyond the first 50 past rows. A valid deep-past date saved successfully can disappear on reload, and consumers have no indication that the read omitted rows.

**Approach:** Add explicit Settings history loading backed by bounded service pages and reliable per-window continuation metadata. Keep saved rows immediately editable and make them discoverable through the same paging path after refresh or reload. This implements DW-41 and coordinates the DW-44/DW-46 decisions in the bundle.

## Boundaries & Constraints

**Always:** Keep Home’s nearest-upcoming selection, initial read bound, local-calendar dates, own/partner visibility, and own-row edit controls. Preserve latest-load precedence, per-call errors, account/session ownership, successful-write replay, and last-good rows on failure. Event data and pagination remain Supabase-only and nonpersistent; reset account-scoped fields on sign-out. Use the worker-pair E2E fixtures.

**Never:** Edit the deferred-work ledger, generated types, archived tests, schema/policies, or deployment. Do not reject valid past dates, automatically fetch all history, cache saved rows indefinitely, or turn a saved write into a failure because a subsequent read fails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial read | Empty, exactly 50, or 51 raw rows per window | At most 50 per side; continuation false, false, true respectively | Existing load notice |
| Continue | Either or both sides have more rows | Read only unfinished sides; unique globally ordered rows accumulate | Keep rows/cursors and retry same page |
| Ordering | Identical dates and creation timestamps | Stable ID tiebreak prevents skipped or repeated page-boundary rows | Raw cursors survive domain conversion |
| Sparse page | Unreadable date among raw rows | Omit unreadable event, retain truthful raw continuation | Existing conversion diagnostics |
| Save deep date | Add/edit outside initial window | Saved row immediately remains editable; refresh/reload offers history access to locate it again | Write result remains attributable to its write |
| Concurrent mutation | Add/edit/delete settles during page read | Completed mutation wins over fetched snapshot, without duplicate IDs | Preserve replay |
| Superseded request | Refresh or session transition during paging | Old response cannot update rows, metadata, errors, or newer loading state | Return stale |

</intent-contract>

## Code Map

- `src/services/eventsService.ts` — `getEvents(limit, offset)` currently reads two date-partitioned windows; `toCoupleEvent` converts dates. Reuse query/error handling. `DEFAULT_EVENTS_PAGE_SIZE` is 50; raw timestamp precision matters for cursors.
- `src/stores/slices/eventsSlice.ts` — `loadEvents`, `ActiveLoad`, `CompletedMutation`, `replayCompletedMutations`, and CRUD upserts provide ownership/reconciliation. Store currently exposes no paging state.
- `src/stores/slices/authSlice.ts` — `signedOutState()` resets event state; extend with metadata. `src/stores/useAppStore.ts` partialization excludes events and must also exclude metadata.
- `src/components/Settings/EventsSettings.tsx` — load effect, `recordLoadOutcome`, guarded retry/focus handling, and unfiltered list. Existing owner/mount checks must cover paging settlement too.
- `src/App.tsx` and `src/components/RelationshipTimers/EventCountdown.tsx` — read-only Home behavior reference: default load, nearest upcoming capped cards, midnight refill.
- `tests/unit/services/eventsService.test.ts`, `tests/unit/stores/eventsSlice.test.ts`, `tests/unit/stores/loaderIdentityGuards.test.ts`, `tests/unit/stores/persistedEvents.test.ts` — query/replay/session/persistence regression harnesses.
- `src/components/Settings/__tests__/EventsSettings*.test.tsx` — subscribable doubles and retry/unmount/focus conventions.
- `tests/support/factories/events.ts` — `coupleEvents` fixture supports anchored bulk seeding and pair-only cleanup. `tests/e2e/settings/events-crud.spec.ts` supplies form selectors and write-response assertions.
- `supabase/config.toml` — read-only evidence: `max_rows = 1000`; avoid an ever-growing single range.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/eventsService.ts` — add bounded keyset page results with per-window continuation and raw cursors; preserve the existing array/offset API as needed for compatibility.
- [x] `src/stores/slices/eventsSlice.ts`, `src/stores/slices/authSlice.ts` — expose initial/continuation actions and metadata, merge ordered pages, retain mutation replay and session ownership, reset metadata with auth.
- [x] `src/components/Settings/EventsSettings.tsx` — add accessible explicit history-loading control, truthful partial-list notice, busy/disabled/error/retry behavior and mounted/session-safe settlement. Keep successful deep-date upserts reachable and clarify paging after reload.
- [x] Service/store/component test paths above — test matrix boundaries, asymmetric windows, concurrency, retry, ownership, and nonpersistence.
- [x] `tests/e2e/settings/events-history-pagination.spec.ts` — prove loading/editing beyond 50 past events, adding/editing deep dates then reloading/loading/editing again; assert request then store then UI. Run existing Home and Settings regressions.

**Acceptance Criteria:**
- Given more than 50 past events, when Settings loads and the user activates history loading, then a previously omitted own event appears and can be edited through its form.
- Given a newly added or edited date beyond 50 past rows, when the user reloads Settings, loads history, and edits that saved row again, then its prior saved values and subsequent correction survive the server/store/UI round trip.
- Given an empty, exact-page, or truncated history, when Settings settles its load, then its continuation affordance accurately represents whether more raw rows exist and disables repeated activation while loading.
- Given heavy history and additional Settings pages, when the user opens Home, then nearest upcoming events remain visible with the existing card cap and past events remain hidden.
- Given a continuation failure or account transition, when the request settles, then Settings preserves recoverable current-session data and does not display or focus stale-session results.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass

- verdicts: 17 findings/observations — high 0, medium 4, low 8, false 5, maybe-false 0.
- All four layers ran at the session capability. The platform thread limit required staggered launches; no layer was skipped. The intent auditor’s five descriptive surface observations are recorded below as non-defects; its enumerated readings are context rather than additional findings.
- findings:
  - `[medium]` `[patch]` Edge: Chromium blurs the disabled history button before settlement, defeating focus restoration — reproduced in Chromium; capture focus ownership before loading and restore only when focus remains on the button or body, with browser coverage for retry and exhaustion.
  - `[medium]` `[patch]` Blind 1: Disabled-button focus restoration fails in Chromium — same root cause and correction as Edge; deliberate focus moves remain respected.
  - `[medium]` `[patch]` Blind 2: A stalled superseded history promise retains the local lock after a fresh load — demonstrated by starting a full refresh while continuation remains unresolved; release local history ownership when the shared store supersedes it, and verify recovery before the old promise settles.
  - `[low]` `[patch]` Blind 3: A refresh removing the paged edit row changes the form title to Add Event — the form’s input values and PATCH target already survive, but its derived mode changes; retain the initial edit/add mode as the form retains its initial fields.
  - `[low]` `[reject]` Blind 4: Exhausted wholly unreadable history says No events yet — real only for raw dates rejected by all normal event write paths; the pre-existing converter already drops these rows. Distinguishing this state requires extra raw-account metadata and branches for a case users do not meet in ordinary use. The accepted sparse-page contract remains intact.
  - `[low]` `[patch]` Blind 5: Successful continuation has no live completion announcement — add a concise accessible status derived from existing loading, row-count, and continuation state, including exhaustion.
  - `[low]` `[patch]` Blind 6: Browser coverage stops after one continuation — extend the history test through two successive activations and assert the intermediate control remains usable.
  - `[low]` `[patch]` Blind 7: Retry tests do not exercise two unfinished windows when only one fails — strengthen the service test with both windows truncated, either window failing, unchanged original cursors, and a retry that loads both tails. The fake’s fixed upcoming-first completion covers success-before-failure and failure-before-success.
  - `[low]` `[patch]` Blind 8: Real-server precision coverage has only identical timestamps — vary microseconds within one JavaScript millisecond while retaining tied pairs in both windows.
  - `[low]` `[patch]` Blind 9: Sorting actual DOM IDs hides global-order errors — assert the original DOM sequence against date/full-timestamp/ID order.
  - `[low]` `[patch]` Blind 10: Home after Settings paging is checked with only one upcoming event — navigate Home after loading multiple upcoming pages and assert its exact six nearest cards.
  - `[medium]` `[patch]` Verification: Auth bootstrap harness still intercepts getEvents — independently reproduced browser failure: production getEventsPage escaped the harness and its synthetic session received 401. Intercept/restore the current page method and wrap controlled rows in page metadata while preserving the scenario counters.
  - `[false]` `[reject]` Intent/API: Cursor continuation differs from historical limit/offset wording — the human decision requests store/service paging and reliable continuation, not a fixed API signature; the explicit Settings control satisfies it.
  - `[false]` `[reject]` Intent/saved-row visibility: Reload returns to the initial windows — the decision explicitly requires the saved row to remain reachable, and the browser tests reload, load history, and edit its saved values again. Indefinite visibility is not required; the partial-list notice explains the path.
  - `[false]` `[reject]` Intent/metadata freshness: Flags represent the last successful page snapshot — DW-46 expressly allows bounded lookahead. Raw per-window lookahead is the selected semantics, and mutations remain immediately visible through upsert/replay.
  - `[false]` `[reject]` Intent/outer surface: The central requirement is established at Settings — real browser tests drive the production control, server write, store settlement, reload, and edit form; no internal proxy substitutes for the required surface.
  - `[false]` `[reject]` Intent/preserved behavior: Home and ownership checks span existing/new tests — the existing Home midnight/read-window cases passed, and strengthened coverage now also checks its exact cap after multi-page Settings loading; service/store/component tests cover concurrency and ownership.


## Design Notes

Use fixed 50-row pages plus one raw lookahead row in each requested window. A cursor holds the server’s original `event_date`, `created_at`, and `id`; compare these lexicographically in the window’s direction. Fix the local `todayISO` boundary for a traversal. Compute continuation before conversion and deduplication. This avoids offset shifts from deletions and preserves timestamp precision and deterministic ties. Home refresh resets to the first windows; Settings appends only unfinished windows. Each request stays below the server response cap.

A successful save upserts the returned event by ID in the visible list, including deep dates. A full refresh/reload may return to the initial windows; a persistent, truthful partial-list notice and explicit history control provide the path back to that event. No hidden automatic crawl or indefinitely pinned copy is required.

## Verification

- Focused Vitest service/store/auth/persistence/Settings suites: all pass.
- `npm run typecheck` and `npm run lint`: no new errors; record any baseline failures.
- `npm run test:unit`: no regressions.
- `npx playwright test --project=chromium tests/e2e/settings/events-history-pagination.spec.ts tests/e2e/settings/events-crud.spec.ts tests/e2e/settings/events-load-recovery.spec.ts tests/e2e/home/events-read-window.spec.ts`: browser round trips pass using local Supabase.
- `fnox exec -- npm run build`: valid production build, when decryption is available.


### Implementation verification evidence

- Full unit suite: 104 files, 1,803 tests passed (`/tmp/dw41-unit-all-final.log`). Focused service/store/auth/persistence/Home checks: 218 passed; Settings component checks: 115 passed.
- Chromium: 14 targeted tests passed (`/tmp/dw41-e2e.log`), including all five new history cases, existing Settings CRUD/load recovery and Home history/midnight behavior.
- Typecheck and secret-injected production build passed; lint reported only the three baseline EventCountdown react-refresh warnings. `git diff --check` passed.
- Matrix audit: initial/lookahead, continuation, ordering, sparse rows, and retry are exercised by `eventsService.test.ts`; concurrent mutations and superseded refreshes by `eventsSlice.test.ts`; real session transitions by `loaderIdentityGuards.test.ts`; deep saves/reloads by `events-history-pagination.spec.ts`; busy/retry/focus/unmount by `EventsSettings.pagination.test.tsx`. Every covering suite ran and passed in the unit/browser runs above.


## Auto Run Result

Status: done

### Implemented change

Settings now loads event history explicitly in bounded pages of 50 rows per unfinished window. Raw lookahead supplies reliable snapshot continuation metadata; raw date/timestamp/ID cursors retain stable ordering through repeated pages. Saved deep-past events remain immediately editable and can be loaded and edited again after reload. Home retains its initial read bound and six nearest upcoming cards. Session ownership, mutation replay, last-good rows, and nonpersistent account resets cover the new paging state.

### Changed files

- `src/services/eventsService.ts` — bounded keyset page API, raw continuation metadata, and timestamp precision.
- `src/stores/slices/eventsSlice.ts` — shared guarded refresh/continuation loader, ordered merging, and session-scoped mutation replay.
- `src/stores/slices/authSlice.ts` and `src/stores/useAppStore.ts` — reset paging state and keep it out of persistence/hydration.
- `src/components/Settings/EventsSettings.tsx` — history control, partial-list notice, retry, live completion status, focus recovery, supersession cleanup, and stable form mode.
- `src/components/Settings/__tests__/EventsSettings.pagination.test.tsx` — paging, retry, focus, form, unmount, session, and supersession checks.
- `tests/unit/services/eventsService.test.ts` — page boundaries, raw cursors, timestamp ties, sparse pages, and atomic two-window failure/retry.
- `tests/unit/stores/eventsSlice.test.ts` — continuation merging, mutation replay, cursor retention, and same-user session isolation.
- `tests/unit/stores/loaderIdentityGuards.test.ts`, `persistedEvents.test.ts`, and `signOutClearsAccountState.test.ts` — real auth resets and persistence protection.
- `tests/unit/App.eventsSession.test.tsx` and `tests/support/harnesses/auth-bootstrap-notification-order.tsx` — adapt event interception to the page API while preserving existing auth scenarios.
- `tests/e2e/settings/events-history-pagination.spec.ts` — deep save/edit/reload journeys, exact/empty pages, 208-row traversal, full-precision order, Home cap, and Chromium focus recovery.

### Review outcome

All four lenses completed. Seventeen findings/descriptive observations were triaged individually above. Ten root-cause entries were patched: three medium and seven low (the two focus reports share one entry). Six observations were rejected with their individual reasons; none was deferred. The ledger was not edited.

Follow-up review recommended: false. Although three medium entries were corrected, each specific risk has passing targeted evidence: Chromium focus recovery, component supersession recovery before the old request settles, and all seven auth bootstrap browser scenarios. No specific unverified risk from those corrections remains.

### Final verification

- `npm run test:unit` — 104 files, 1,806 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — zero errors; three pre-existing EventCountdown react-refresh warnings.
- Targeted Chromium run across history pagination, Settings CRUD/load recovery, Home read-window, and auth bootstrap notification order — all 22 tests passed.
- Focused service checks passed after strengthening the two-unfinished-window retry test. The final focus assertion additionally waits for actual Chromium body focus before releasing the failed request.
- `fnox exec -- npm run build` — passed with decrypted build configuration.
- `git diff --check` — passed. The intent contract remains unchanged, and generated files, archived tests, schema, and deferred-work ledger remain untouched.

### Residual behavior

Continuation is a snapshot from the last successful read, not a live row count. Refresh/reload returns to the initial windows; the notice and history control provide access to saved out-of-window dates. Two-window reads retain their existing non-atomic behavior under external concurrent date edits. Unreadable raw dates are omitted, but their cursors still advance to avoid a stuck history control.

Implementation commit: `db203f085e53d339a1c8d351a1876e22883c96b5`. Workflow record is committed separately; nothing was pushed.
