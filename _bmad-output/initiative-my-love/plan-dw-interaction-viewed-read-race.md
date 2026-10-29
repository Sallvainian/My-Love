---
title: 'DW-315: keep a confirmed mark-viewed through a history read that was already out'
type: 'bugfix'
ticket: ''
created: '2026-10-29'
status: 'built'
baseline_revision: '6cd235cd2444c2148d64b9a9cbb292f2f8e34c02'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** In `src/stores/slices/interactionsSlice.ts`, `markInteractionViewed` sets `viewed: true` only after the server confirms, but `loadInteractionHistory` replaces the list with its fetched answer. A read that went out before the mark was confirmed can answer with `viewed: false` for that poke, putting it back in `unviewedCount` (the badge) and the saved copy until the next read (DW-315).

**Approach:** Each history read in flight also notes the ids whose mark-viewed was confirmed while it was out, the same way `readsInFlight` notes rows accepted during a read. When the answer lands, those ids keep `viewed: true` in the applied list, and `unviewedCount` is recounted from it (so the saved copy carries the mark too). Add a unit test with a deferred read that answers after a confirmed mark.

</intent-contract>

## Implementation Notes

Oneshot: one slice and one test file, well under 100 lines. The fix extends the existing per-read bookkeeping (`readsInFlight`/`noteAccepted`) rather than adding a parallel mechanism. The id is noted only after the server confirms and the session check passes, so a failed or stale-session mark never forces `viewed: true`.

Files touched: `src/stores/slices/interactionsSlice.ts` (each `readsInFlight` entry is now `{ accepted, viewed }`; new `noteViewed`, called by `markInteractionViewed` after the server confirms; the applied answer keeps `viewed: true` for noted ids), `tests/unit/stores/interactionsSlice.localCopy.test.ts` (two tests). The main new test failed against the unfixed slice (checked by setting the slice change aside) and passes with it. Surprise: neither file was Prettier-clean at baseline, so only the added lines were checked against Prettier's output; one test title was shortened to keep its line within 100 columns.

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none (the quick lens reported no unmet criteria, broken rules or bugs)

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/interactionsSlice.localCopy.test.ts tests/unit/stores/interactionsCatchUp.test.ts tests/unit/stores/interactionsSubscription.test.ts` -- expected: all pass, including the new deferred-read test
- `npm run typecheck` -- expected: exit 0
- `npx eslint src/stores/slices/interactionsSlice.ts tests/unit/stores/interactionsSlice.localCopy.test.ts` -- expected: no errors

## Auto Run Result

Status: built

**Summary:** A history read that went out before a poke's mark-as-viewed was confirmed no longer undoes the mark when it answers (DW-315). Each read in flight now notes the ids whose mark the server confirmed while it was out, and keeps `viewed: true` for them in the applied list, so the badge (`unviewedCount`) and the saved `interactions` copy both keep the mark.

**Files changed:**
- `src/stores/slices/interactionsSlice.ts` — `readsInFlight` entries track `accepted` and `viewed` ids; `noteViewed` is called after a confirmed, same-session mark; `loadInteractionHistory` keeps noted ids viewed when its answer lands.
- `tests/unit/stores/interactionsSlice.localCopy.test.ts` — a deferred read that answers after a confirmed mark keeps the row viewed in state, badge and copy; a mark that fails while a read is out leaves the answer as read.
- `_bmad-output/initiative-my-love/plan-dw-interaction-viewed-read-race.md` — this plan.

**Review:** quick lens, 0 findings. Patches applied: 0. Deferred: 0. Rejected: 0.

**Follow-up review recommended:** false — no patches this pass (high 0, medium 0, low 0).

**Verification:**
- `npx vitest run` on the three interactions store test files: 71 passed. The new deferred-read test failed against the unfixed slice (1 failed, 36 passed in that file) before the fix was restored.
- `npm run typecheck`: exit 0.
- `npx eslint` on both changed files: exit 0.

**Residual risks:** Low. A forced `viewed: true` is safe because nothing in the app sets `viewed` back to false. The fix was checked by unit test only, not by reproducing the race in a browser; DW-315 itself was read from the code, not reproduced.
