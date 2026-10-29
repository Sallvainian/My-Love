---
title: 'Pin the real contract in four e2e/api assertions'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: ready-for-dev
baseline_revision: 3e547a40c30d40f6ca995dae444307c617cf4d98
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Four test assertions (DW-303, DW-307, DW-312, DW-317) either hold by construction, hard-code a plural the app does not always write, pin one contract in two forms, or leave half of a decision unrecorded where agents read it.

**Approach:**
- DW-303 — pin the decrement in the unit layer, not over the wire. The limiter's count is a module-level `Map` in each edge-runtime isolate (`supabase/functions/upload-love-note-image/handler.ts:113-115`), and consecutive requests reach different isolates, so no wire test can assert a decrement.
  - `supabase/functions/upload-love-note-image/handler.test.ts`: add a step that makes two accepted uploads through `handleUpload` with one fixed `userId` (`fakeClient({ userId })`) and asserts `rateLimitRemaining` and the `X-RateLimit-Remaining` header are `RATE_LIMIT_MAX_UPLOADS - 1` after the first and `RATE_LIMIT_MAX_UPLOADS - 2` after the second. Use a fresh `crypto.randomUUID()` as the fixed id so no other step shares its window.
  - `tests/api/upload-love-note-image-limits.spec.ts`, first case: no second upload, and the existing assertions stay unchanged (whole number, `< RATE_LIMIT_MAX_UPLOADS`, header equals body, prefix grows by one). Rewrite only the comment above them so it says the count is kept per isolate, consecutive requests can reach different isolates, and the decrement is therefore pinned in `handler.test.ts`.
  - `_bmad-output/initiative-my-love/deferred-work.md`: mark DW-303 resolved by the unit step. Add a new entry at the next free DW id: the upload function's 10-per-minute-per-user limit is kept in isolate memory, so it is not enforced once one user's requests spread across isolates (measured locally under `policy = "per_worker"`; whether hosted functions spread the same way is UNVERIFIED). Severity medium, needs an owner decision on a shared store (a DB table or RPC). Do not change the limiter in this ticket.
- DW-307 — `tests/e2e/home/events.spec.ts:142`: build the expected countdown text with `formatDayCount`'s singular rule (`1 day`, else `N days`), imported from `src/components/RelationshipTimers/eventCountdownHelpers.ts` or mirrored inline.
- DW-312 — `tests/e2e/auth/bootstrap-notification-order.spec.ts` lines 45, 188, 218: replace `not.toBeVisible()` on `login-screen` with `toHaveCount(0)`, matching `login.spec.ts:135`. `App.tsx` renders `LoginScreen` only in the `!session` branch, so the app unmounts it on a signed-in render; the harness mounts the real `App`.
- DW-317 — `tests/support/helpers/events.ts` `clockAnchor` JSDoc: add why a fixed calendar date was rejected — it collides unique `created_at` rows across reruns and puts the page clock arbitrarily far behind server timestamps. No new documentation file; AGENTS.md already carries the rule (`clockAnchor()` line under Known pitfalls), so it is not edited.

</intent-contract>

## Implementation Notes

Oneshot: four localized test-only edits, about 40 lines in four files, no production code touched.

DW-303 was re-scoped at a resolve session on 2026-10-29: the first plan's wire assertion (a second upload, remaining falls by one) failed 9 of 9 serial runs because back-to-back uploads do not share an isolate's counter. See "Intent gap found during verification" below. The intent contract above is the current reading.

## Verification

**Commands:**
- `npx tsc -p tsconfig.test.json --noEmit` -- expected: no new errors in the touched files
- `npx eslint tests/api/upload-love-note-image-limits.spec.ts tests/e2e/home/events.spec.ts tests/e2e/auth/bootstrap-notification-order.spec.ts tests/support/helpers/events.ts` -- expected: clean
- `deno test --no-lock supabase/functions/upload-love-note-image/` -- expected: all pass, including the new two-upload decrement step
- `npx playwright test tests/api/upload-love-note-image-limits.spec.ts tests/e2e/home/events.spec.ts tests/e2e/auth/bootstrap-notification-order.spec.ts tests/e2e/auth/login.spec.ts` (with `supabase start` running) -- expected: all pass

### Intent gap found during verification (DW-303)

The prescribed DW-303 fix (a second upload in the same case, then assert `x-ratelimit-remaining` fell by exactly one) cannot pass over the wire. Two uploads in a row from one client go to different edge-runtime isolates, and each isolate keeps its own counter (`rateLimitStore` is a module-level `Map`, `supabase/functions/upload-love-note-image/handler.ts:113-115`, whose comment already says it resets on cold start). Measured with `supabase functions serve` (edge-runtime 1.77.8, `policy = "per_worker"`):
- 3 workers, `--repeat-each=3`: 2 of 3 runs failed, e.g. expected 7, received 8 and 9.
- `--workers=1`, `--repeat-each=3`, run three times: 9 of 9 runs failed. In some the count went up (expected 7, got 8; expected 2, got 6) and in some it went down by two (expected 3, got 2).

So the residual this plan accepted earlier, a slot expiring between the two requests, was the wrong model: the requests do not share a counter at all. Choosing a different fix changes what the user sees, so it is left to a human:
- (a) Pin the decrement in the unit layer. `handler.test.ts:577-585` asserts `RATE_LIMIT_MAX_UPLOADS - 1` after one upload only. Two `checkRateLimit` calls should give MAX-1 and then MAX-2. Then correct the api spec's comment to say why the wire test cannot assert the decrement.
- (b) Treat the per-isolate limiter as the real defect. A 10-per-minute-per-user bound kept in isolate memory is not enforced once requests spread across isolates, and hosted functions also run several isolates (UNVERIFIED for hosted). The fix would be a shared store (a DB table or RPC), which is a product change, not a test change.

The failing DW-303 attempt was reverted, and its diff was saved outside the repo. The other three items are in the worktree, uncommitted, and verified:
- DW-307: `tests/e2e/home/events.spec.ts` builds the expected countdown with the singular rule, mirrored inline rather than imported, so a broken `formatDayCount` still fails the test.
- DW-312: `tests/e2e/auth/bootstrap-notification-order.spec.ts` lines 45, 188 and 218 now use `toHaveCount(0)`. Line 45 is the same contract, so it was included. `App.tsx` renders `LoginScreen` only when `!session`.
- DW-317: the `clockAnchor` JSDoc in `tests/support/helpers/events.ts` gains the reason a fixed calendar date was rejected. AGENTS.md is unchanged; its `clockAnchor()` pitfall line already states the rule.

