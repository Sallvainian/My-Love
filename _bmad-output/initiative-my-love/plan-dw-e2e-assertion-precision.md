---
title: 'Pin the real contract in four e2e/api assertions'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: done
baseline_revision: 3e547a40c30d40f6ca995dae444307c617cf4d98
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals']
deferred:
  - summary: >-
      upload-love-note-image's 10-per-minute-per-user rate limit is kept in isolate memory, so it is not enforced once one user's requests spread across isolates.
    evidence: |-
      rateLimitStore is a module-level Map; two consecutive uploads over the wire failed a decrement assertion 9 of 9 serial runs locally (edge-runtime 1.77.8, policy = "per_worker"). Whether hosted functions spread one user's requests the same way is UNVERIFIED. Fix needs an owner decision on a shared store (DB table or RPC).
    location: >-
      supabase/functions/upload-love-note-image/handler.ts:113-115
    severity: medium
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


### Re-drive (2026-10-29, after the resolve session)

The worktree was clean on re-drive, so the three items listed above as "uncommitted" were redone from the intent, not recovered.

Files touched:
- `supabase/functions/upload-love-note-image/handler.test.ts` — new step "each accepted upload by one user lowers the remaining allowance by exactly one": one `fakeClient({ userId: crypto.randomUUID() })`, two uploads, asserts body `rateLimitRemaining` and `X-RateLimit-Remaining` are MAX-1 then MAX-2, and two Storage writes.
- `tests/api/upload-love-note-image-limits.spec.ts` — comment above the remaining-count assertions rewritten (per-isolate count, decrement pinned in `handler.test.ts`); assertions unchanged.
- `tests/e2e/home/events.spec.ts` — expected countdown built with the singular rule, mirrored inline.
- `tests/e2e/auth/bootstrap-notification-order.spec.ts` — lines 45, 188, 218 use `toHaveCount(0)`.
- `tests/support/helpers/events.ts` — `clockAnchor` JSDoc gains the fixed-date rationale.

Decision — the ledger is not edited. The intent contract says to mark DW-303 resolved and add a new entry in `deferred-work.md`, but this session's invocation says "Do NOT edit the deferred-work ledger; the orchestrator records resolution." The invocation wins. The new finding the contract asked to record is carried here for the orchestrator or a human to write into the ledger:

> **New deferred finding (needs an owner decision, severity medium):** `upload-love-note-image`'s 10-per-minute-per-user limit is kept in isolate memory (`rateLimitStore`, a module-level `Map`, `supabase/functions/upload-love-note-image/handler.ts:113-115`), so it is not enforced once one user's requests spread across isolates. Measured locally under `policy = "per_worker"`; whether hosted functions spread the same way is UNVERIFIED. The fix is a shared store (a DB table or RPC), a product change outside this bundle.

Verification on re-drive (with `supabase functions serve` started for the api leg, then stopped):
- `deno test --no-lock supabase/functions/upload-love-note-image/`: 4 passed (36 steps), including the new step.
- `npx eslint` on the four touched test files: clean.
- `npx tsc -p tsconfig.test.json --noEmit`: no errors in the touched files.
- `npx playwright test` on the four specs: 27 passed.

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 1, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` The ledger is not edited, so the contract's "mark DW-303 resolved and add a new entry" step is unmet — the invocation for this run says "Do NOT edit the deferred-work ledger; the orchestrator records resolution", which excludes the edit at the intent level; the new finding is carried in frontmatter `deferred`, and the orchestrator copies that list into the ledger (DW-319 in `deferred-work.md:2737-2743` came from `plan-dw-synced-moods-signout-delete.md`'s `deferred` block), so the finding is not lost.
  - `[low]` `[patch]` The deferred item's `evidence` ended with "Not written to deferred-work.md because the invocation forbids ledger edits.", which the orchestrator copies verbatim into the ledger's `reason:` line (confirmed against DW-319), leaving a false sentence there — deleted the sentence; evidence now holds only the measurement, the UNVERIFIED hosted case and the owner decision.

## Auto Run Result

Status: built

**Summary:** Four test assertions now pin the real contract. DW-303: the rate-limit decrement is pinned in the unit layer (two uploads by one user give MAX-1 then MAX-2 in body and header), and the api spec's comment now explains why no wire test can assert it (the count is per edge-runtime isolate). DW-307: the expected countdown uses the singular rule. DW-312: all three "login screen is gone" checks in `bootstrap-notification-order.spec.ts` use `toHaveCount(0)`, matching `login.spec.ts`. DW-317: `clockAnchor`'s JSDoc records why a fixed calendar date was rejected.

**Files changed:**
- `supabase/functions/upload-love-note-image/handler.test.ts` — new two-upload decrement step.
- `tests/api/upload-love-note-image-limits.spec.ts` — comment above the remaining-count assertions rewritten; assertions unchanged.
- `tests/e2e/home/events.spec.ts` — expected countdown text built with the inline singular rule.
- `tests/e2e/auth/bootstrap-notification-order.spec.ts` — lines 45, 188, 218 switched from `not.toBeVisible()` to `toHaveCount(0)`.
- `tests/support/helpers/events.ts` — `clockAnchor` JSDoc gains the fixed-date rationale.
- `_bmad-output/initiative-my-love/plan-dw-e2e-assertion-precision.md` — this plan.

**Review findings:** 1 patch applied (low: removed a session note from the deferred item's evidence). 1 item deferred, recorded during implementation, not by review: the per-isolate rate limiter (medium, owner decision; hosted spread UNVERIFIED). 1 rejected: "ledger not edited" (false; the invocation forbids ledger edits and frontmatter `deferred` reaches the ledger through the orchestrator).

**Follow-up review recommended:** false — patched counts: high 0, medium 0, low 1.

**Verification:**
- `deno test --no-lock supabase/functions/upload-love-note-image/`: 4 passed (36 steps), 0 failed; re-run after the patch, same result.
- `npx eslint` on the four touched test files: clean, before and after the patch.
- `npx tsc -p tsconfig.test.json --noEmit`: 0 errors in the touched files, before and after the patch.
- `npx playwright test tests/api/upload-love-note-image-limits.spec.ts tests/e2e/home/events.spec.ts tests/e2e/auth/bootstrap-notification-order.spec.ts tests/e2e/auth/login.spec.ts` (local Supabase, `supabase functions serve` started for the run and stopped after): 27 passed. Not re-run after the patch, which touched only this plan's frontmatter.

**Residual risks:**
- DW-303's wire assertions still cannot catch a counter that never decrements over the wire; that is now pinned only in `handler.test.ts`, which calls `handleUpload` directly.
- The deferred-work ledger still shows DW-303 open and lacks the rate-limiter entry until the orchestrator records them.
