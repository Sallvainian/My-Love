---
title: 'Refactor sweep (epic 6)'
type: chore
ticket: '10'
created: '2026-11-06'
status: done
baseline_revision: '9d8f8e57adc23d18ce47a57ec5627209348abc14'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 6.1 to 6.9 and 6.12 left cleanup behind: four open ledger entries (DW-462, DW-464, DW-465, DW-481), story 4's note that the three fixed E2E coach rows are redundant now that the 520-row pool is seeded, and residual risks written only in the plans' Auto Run Results, which AGENTS.md says must be in the ledger.

**Approach:** Picked at the start of this story:
1. DW-462: AGENTS.md says `useAppStore.ts` composes 14 slices; `grep -c` gives 15. Fix the number.
2. DW-481: add Daily's offline model (the `daily-days` copy, the `daily-write-declined` device kind, the `pick-queue` store drained by `drainQueuedPicks`) to AGENTS.md's data-model paragraph, and name `note-queue` and `pick-queue` as the queue-store exceptions in the localCopy rule.
3. Story 4 residual: delete `TEST_COACH_QUESTIONS` and `ensureTestCoachQuestions` from `tests/support/factories/daily-question.ts` and their import and calls in the six E2E specs; the seed migration `20261106000500_daily_question_coach_pool.sql` is the pool. `readPairQuestionTexts` stays.
4. DW-464 / DW-465 (one finding recorded twice): run `partner-connect.spec.ts` with `--repeat-each=10` beside the realtime-recovery spec on this branch; close both with the result if it does not reproduce, else leave open with the evidence.
5. Record in the ledger, as new entries, each residual risk from the plans that is a real open defect and not already in the ledger or fixed by a later story.

Docs-only changes (AGENTS.md, ledger) go in their own commit. Anything that changes what users see is recorded, not fixed.

</intent-contract>

## Implementation Notes

Oneshot: about 60 changed lines of test code, plus prose in AGENTS.md and the ledger. Every edit is a deletion or a text addition; nothing changes app behaviour.

- Item 3: removed `TEST_COACH_QUESTIONS` and `ensureTestCoachQuestions` from `tests/support/factories/daily-question.ts`, and their import and seven calls from the six specs. The local stack held 523 coach rows (520 from the seed migration, 3 from the helper); the three stay on existing stacks and are absent from fresh ones (CI). No spec asserts their text; the unit fixtures' "Beach day" is their own constant.
- Item 4: `partner-connect.spec.ts` + `realtime-recovery-after-renewal.spec.ts`, `--repeat-each=10`, chromium: 60 of 60 passed (the poke test ran 10 times beside the recovery spec). DW-464 and DW-465 closed as not reproduced; the baseline run was skipped, since it only mattered if the branch failed.
- Item 5: residual risks checked against the current code, then recorded as DW-482 (refusal shows the technical "[DailyQuestionApi.submitDailyPick] Database error: …" text; stories 6.2 and 6.7), DW-483 (a refused pick for a past day is never shown or removed), DW-484 (an online send failing in transit is not queued; stories 6.7 and 6.12), DW-485 (a row waits when another tab's pass stops and that tab closes), DW-486 (a `daily_pick` during a re-join's identity refresh is dropped; story 6.6) and DW-487 (a failed copy read during a merge drops the other saved days; story 6.5). Skipped as not defects or already fixed: story 12's untested `popstate` arm (story 9 added the test), the late-pick rule (story 7), the writer's zone (by design, AD-3), the unpicked test day per run date (cleared before each test), yesterday's card offline past midnight (no question is reachable offline), and "no mood logging" (R6).
- Surprise: the full E2E run cannot load `tests/e2e/auth/token-persistence-overlap.spec.ts` in a loop worktree (it reads `node_modules/@playwright/test/package.json`, and the worktree has no `node_modules`), as story 6.9 found. Every other spec was run by passing the file list.

## Plan Change Log

## Review Triage Log

### 2026-11-06 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` AGENTS.md:66 says `note-queue` and `pick-queue` are "the two exceptions" to the localCopy rule, but `moods` and `image-cache` are per-account stores too, and AGENTS.md:101 names unsynced `moods` rows as a third queue. — Confirmed (`dbSchema.ts` creates both). Reworded to "A queue of unsent writes is the exception and gets its own store, as `note-queue` … and `pick-queue` … do." The defer rule for agent-context edits does not apply: the intent orders this AGENTS.md edit (DW-481), and the finding is about the wording this change wrote.
  - `[low]` `[patch]` AGENTS.md:100 says `drainQueuedPicks` sends "the signed-in account's rows", but it sends only pending ones. — Confirmed (`dailyQuestionSlice.ts:267` filters `!row.failed`; `pickQueue.ts` SENDER rule). Now "pending rows (never a `failed` one)".
  - `[low]` `[patch]` AGENTS.md:25 and :66 sit inside the `bmad:context` block, which a refresh replaces, so the hand-written queue-store sentence can be lost. — Confirmed (markers at lines 1 and 94). The 15-slice count is re-derived from the code on a refresh. The fact is now also in the hand-maintained data-model paragraph (line 100): `pick-queue` is its own store because it is a queue of unsent writes, like `note-queue`.
  - `[low]` `[patch]` Comments in `43_daily_question_pool.sql` (header, and the stand-in row) and the seed migration's header still describe E2E's own coach rows. — Confirmed for the pgTAP file: both comments now say the rows were inserted before story 6.10, and the stand-in stays because existing local stacks keep them. The seed migration `20261106000500` is on `origin/main` and applied, so its header is left as it is; its "never reused" reservation of the `…d00N` ids still holds. DW-461's resolution records what that story did and is the orchestrator's to edit.
  - `[false]` `[reject]` Implementation Notes say "seven calls" where the diff removes eight. — The count is wrong (8), but the fix edits this build's plan, which triage rejects; the notes are append-only, and the diff itself is correct.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`, if present.
- `npm run lint` and `npx knip` -- expected: exit 0, no new findings.
- `npm run test:unit` -- expected: all pass.
- `mise exec -- supabase test db` -- expected: every file passes.
- `npx playwright test --project=chromium` on the local stack -- expected: the full E2E suite passes.
- `npx playwright test tests/e2e/partner/partner-connect.spec.ts tests/e2e/partner/realtime-recovery-after-renewal.spec.ts --project=chromium --repeat-each=10` -- expected: records DW-464's result.
- `grep -rn ensureTestCoachQuestions tests src` -- expected: no match.

## Auto Run Result

Status: built

**Summary:** The epic 6 refactor sweep. It fixed the two AGENTS.md ledger entries (DW-462 slice count, DW-481 Daily's offline model), removed the three fixed E2E coach rows and their helper now that the 520-question pool is seeded, settled the partner-connect poke flake (DW-464 and DW-465, not reproduced in 10 repeats), and copied six real residual risks from the stories' plans into the ledger (DW-482 to DW-487). No app code changed.

**Files changed:**
- `AGENTS.md` -- 15 slices; the localCopy rule's queue-store exception; Daily's offline model in the data-model paragraph.
- `_bmad-output/initiative-my-love/deferred-work.md` -- DW-462, DW-464, DW-465, DW-481 closed; DW-482 to DW-487 added.
- `tests/support/factories/daily-question.ts` -- `TEST_COACH_QUESTIONS` and `ensureTestCoachQuestions` removed.
- `tests/e2e/daily/daily-question-{pick-and-reveal,live-pick,offline-pick,offline-and-invite,write-tomorrow}.spec.ts`, `tests/e2e/partner/realtime-recovery-after-renewal.spec.ts` -- the helper's import and calls removed.
- `supabase/tests/database/43_daily_question_pool.sql` -- two comments updated (review patch).

**Review findings:** quick lens, 5 findings. Patched 4 low (the queue-store wording, the drain's pending rows, the fact kept outside the managed block, the pgTAP comments). Deferred 0. Rejected 1 (`false`): the plan's "seven calls" count, since the fix would edit this plan.

**Follow-up review recommended: false.** First pass; patched high 0, medium 0, low 4.

**Verification (after the patches):**
- `npm run typecheck`, `npm run lint`, `npx knip`: exit 0.
- `npm run test:unit`: 4,566 tests, 0 failures.
- `mise exec -- supabase test db`: 30 files, 838 tests, PASS.
- E2E, chromium, local stack: 301 passed across 74 specs. `tests/e2e/auth/token-persistence-overlap.spec.ts` was excluded because it cannot load in a loop worktree (it reads `node_modules/@playwright/test/package.json`); the dock and Daily do not touch it, and CI runs it.
- DW-464 check: `partner-connect.spec.ts` + `realtime-recovery-after-renewal.spec.ts`, `--repeat-each=10`: 60 of 60 passed.
- `grep -rn ensureTestCoachQuestions tests src`: no match.

**Residual risks:**
- Local stacks that ran the old helper keep the three `…d00N` coach rows in their pool; fresh stacks and CI do not have them. No spec depends on either.
- DW-464 was not run on the pre-story-6.6 baseline; with no failure on the branch, that comparison was not needed.
- DW-482 (a refused pick shows the technical database text) changes what users read when fixed, so its wording is the owner's to choose.
