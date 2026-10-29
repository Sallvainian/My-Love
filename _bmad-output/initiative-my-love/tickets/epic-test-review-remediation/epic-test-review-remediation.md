---
type: epic
title: "Test Review Remediation"
parent: initiative-my-love
covers: []
sources: [_bmad-output/test-artifacts/test-reviews/test-review-target-tests.md, _bmad-output/test-artifacts/test-reviews/test-review-target-tests-e2e.md, _bmad-output/test-artifacts/test-reviews/test-review-target-tests-unit.md, _bmad-output/test-artifacts/test-reviews/test-review-target-src.md, _bmad-output/test-artifacts/test-reviews/test-review-system.md, _bmad-output/test-artifacts/test-review/test-review-target-tests-unit.md, _bmad-output/test-artifacts/test-review/test-review-target-src.md]
companions: [_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/corrections.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-28-unit-src.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-e2e.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-unit.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-src.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-api-integration.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-suite-high.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-api-integration.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-e2e.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-unit.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-src.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-cross-cutting.md, .claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md, AGENTS.md]
after: []
status: in-progress
risk: low
---

# Test Review Remediation

## Description

A mandate from the owner. The 2026-09-25 TEA test reviews of My-Love's suite (tests/e2e, tests/unit, src, tests/api + tests/integration, and one whole-suite run) found 895 findings in the folder runs and 653 in the suite run. Among them are tests that cannot fail, checks that only log, errors that are swallowed, clock-dependent flakes, and hundreds of maintainability and style findings. The owner wants zero issues, regardless of practical impact: every finding gets fixed, including ones an audit judged overstated. A green suite then means the behaviour works. Re-runs on 2026-10-03 still reported 69 rows in the folder runs and 4 High rows in the suite run. After stories 10–12 fixed them, re-runs on 2026-10-28 reported 9 High rows in tests/unit and 3 in src.

## Outcome

For the owner and anyone changing the code, a green suite means the behaviour works; the success signal is the 2026-10-03 rows and every item in `findings-2026-10-28-unit-src.md` fixed, and fresh per-folder re-reviews with no Critical or High, under Done when.

## Requirements

R1 (CAP-1): Every test can fail when the behaviour it names breaks. Covers rows C1–C7, H3 and H10, plus the log-only checks, swallowed errors, vacuous premises and false-coverage specs in `corrections.md`, and the H10 rows of the 2026-10-03 folder and suite reports, plus the H3 and H10 rows and the advisory notes in `findings-2026-10-28-unit-src.md`. Success: no row of those ids from the 2026-09-25, 2026-10-03 or 2026-10-28 reports remains, none of those advisory notes still describes its test, and a re-review has zero C, H3 or H10 rows. For each CRITICAL fix, breaking the behaviour it targets makes the test fail.

R2 (CAP-2): Tests give the same result regardless of clock, time zone, DST, month end and machine speed. Covers H1, H2, M1 and M6, plus the suite run's normalization-removed H1/H2 rows and the M1 rows of the 2026-10-03 folder reports. Success: no row of those ids from the 2026-09-25 or 2026-10-03 folder reports remains, a re-review has zero H1 or H2 rows, and no asserted value derives from the live clock.

R3 (CAP-3): Tests leave no state behind and clean up even when they fail. Covers H4, plus the cleanup-ordering and leaked-row items in `corrections.md`. Success: a re-review has zero H4 rows, unit suites pass in shuffled order, and a full e2e run leaves behind no rows it created.

R4 (CAP-4): Component tests drive the UI through user-event, as a user would. Covers M5. Success: no M5 row from the 2026-09-25 or 2026-10-03 folder reports remains, and every test named for a key press or gesture performs it.

R5 (CAP-5): Playwright specs use the installed playwright-utils helpers, or carry a recorded deviation. Covers M9 and L9. Success: no M9 or L9 row from the 2026-09-25 or 2026-10-03 folder reports remains.

R6 (CAP-6): Tests are readable and failures point to their cause. Covers H5, M2, M3, M4, M7, L1, L2, L3, L5, L6 and L7, including the 2026-10-03 folder reports' rows of those ids. Success: no row of those ids from the 2026-09-25 or 2026-10-03 folder reports remains, a re-review has zero H5 rows, and no test file exceeds 1000 lines.

## Constraints

- A fix keeps or strengthens what a test proves. Never weaken, skip or delete a test to satisfy a rule. A test is deleted only when another test covers its behaviour.
- For a verified false positive, make a harmless change so the rule stops firing.
- `corrections.md` overrides the finding catalogs and their suggested fixes.
- Catalog line numbers are from main at 92f1c517 in `findings-*.md` and at bab5120e in `findings-2026-10-03-*.md`; they match main at 6103e00a in `findings-2026-10-28-unit-src.md`. Later commits shift lines, so locate each finding by its content.
- App-code changes are limited to two kinds:
  - test hooks (`data-testid`, aria attributes)
  - fixes for real app bugs that a corrected test exposes. A bug fix is a separate commit named as a fix.
- The repo is public. Fixtures use the fictional values (Casey/Jessie, Harper). No personal data, emails or keys in tests, specs or commits.
- Every story leaves lint, typecheck, unit and e2e green. Any new `eslint-disable` line carries a same-line ` -- ` reason (see `AGENTS.md`).

## Done when

1. Every finding in the 2026-10-03 folder reports (`findings-2026-10-03-*.md`, the four High suite rows included) and every item in `findings-2026-10-28-unit-src.md` is fixed, and fresh `bmad-tea-test-review` runs on `tests/e2e/`, `tests/unit/`, `src/`, and `tests/api/` + `tests/integration/` each report no Critical or High.
2. Every item in `corrections.md` is resolved.
3. CI is green on main.

## Boundaries

- New coverage for untested behaviour, such as `formatDateLong` and `formatMessageTimestamp`. That comes later from `bmad-tea-trace` and `bmad-tea-automate`, in separate PRs.
- Changing TEA's rules, registry or config.
- The 2026-10-03 suite report's Medium and Low rows, and Medium or Low rows a fresh review adds beyond the 2026-10-03 reports.
- The 2026-10-28 reports' advisory notes other than those in `findings-2026-10-28-unit-src.md`.
- `tests/e2e-archive/` and the pgTAP files. Neither review scored them.
- `[P#]` priority markers on unit or src Vitest tests. No report flagged them, and each folder's own style has none. Only the Playwright `test:p0` and `test:p1` scripts read markers. The e2e L2 rows are still in scope.

## References

- parent — _bmad-output/initiative-my-love/initiative-my-love.md, section Requirements
- corrections — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/corrections.md, the audit's corrections; overrides the finding catalogs
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-api-integration.md, tests/api and tests/integration
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-e2e.md, tests/e2e
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-unit.md, tests/unit
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-src.md, src co-located Vitest files
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-cross-cutting.md, cross-cutting and outside the four folders
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-e2e.md, tests/e2e, 2026-10-03 re-run
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-unit.md, tests/unit, 2026-10-03 re-run
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-src.md, src co-located Vitest files, 2026-10-03 re-run
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-api-integration.md, tests/api and tests/integration, 2026-10-03 re-run
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-suite-high.md, the four High rows of the 2026-10-03 whole-suite run
- findings — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-28-unit-src.md, the High rows and can't-fail advisory notes of the 2026-10-28 tests/unit and src runs
- project rules — AGENTS.md
- criteria registry — .claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md, TEA's rule definitions
- source — _bmad-output/test-artifacts/test-reviews/, the five TEA reports in `sources:`; since 2026-10-03 they hold the 2026-10-03 re-runs, earlier runs are in its `archive/`
- source — _bmad-output/test-artifacts/test-review/, the 2026-10-28 tests/unit and src reports in `sources:`
- evidence — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/worklists/story-8/, story 8's worklists
- v6 spec — _bmad-output/initiative-my-love/archive-v6/spec-test-review-remediation/SPEC.md

## Notes

- Decision: 2026-09-25 Every convention row (L2 in e2e, L3, L5, L7, M9) is fixed as listed. An investigation confirmed the baselines (see `corrections.md`): no row disappears under a folder's own baseline, and the only changes are severity shifts for M9.
- Decision: 2026-10-28 Reopened. The 2026-10-03 re-runs of the reports in `sources:` still report 69 rows in the four folder runs (e2e 19, unit 28, src 21, api + integration 1) and 4 High rows in the suite run, so Done when 1 was not met when the epic was marked done. The Done when also named the v6 skill `bmad-testarch-test-review`, now `bmad-tea-test-review`.
- Decision: 2026-10-28 Done when 1 now reads: every 2026-10-03 folder-report row is fixed, and fresh folder re-reviews report no Critical or High (owner). The reviewer varies between runs: PR #386 fixed every 2026-10-01 row, yet src went from 9 to 21 rows and the four folders from 74 to 69, so a zero-findings gate re-rolls on every run.
- Decision: 2026-10-28 The suite report's 4 High (H10) rows are in scope, because they are tests that check a value exists but not what it is (owner). Its Medium and Low rows are out.
- Decision: 2026-10-28 Stories 10–12 split the 2026-10-03 rows by folder so each story spec stays short: 10 tests/unit (30 rows), 11 tests/e2e + tests/api (22), 12 src (21). The two stories with High rows come first. They touch disjoint test files and different app components. Shared support modules are only read, except that 11 adds an export to `tests/support/factories/check-error-path-data.ts` and 12 extends `src/components/Settings/__tests__/eventsSettingsKit.tsx`; no other story touches either file, so none waits on another. There is no tracer bullet, because every story is the same kind of test fix.
- Decision: 2026-10-28 No refactor sweep story. Stories 10–12 fix listed rows, and the epic's earlier deferrals are tracked in `deferred-work.md`.
- Decision: 2026-10-28 The `corrections.md` false positives cover only the 2026-09-25 rows they name, never a 2026-10-03 row. The M3 false positive at `notesSlice.offlineQueue.test.ts:312` judged one test that asserted one invariant; by bab5120e that test was split, and the M3 rows at `:157` and `:180` judge the split tests, which assert state, local copy and queue separately. Story 10 fixes them, unless its builder verifies that they are false positives under the Constraints.
- Note: 2026-10-28 Done when 3: CI passed on main at 804ccee8 on 2026-10-28 (owner); it must hold again after stories 10–12 merge. Done when 2 was not re-checked.
- Decision: 2026-10-28 Story 13 fixes the 12 High rows of the 2026-10-28 tests/unit and src re-runs (unit 8 H10 and 1 H3, src 2 H10 and 1 H4) and seven advisory notes on tests that cannot fail, copied into `findings-2026-10-28-unit-src.md` (owner). Three of the notes (A3, A4, A5) were added on the PO's recommendation, because they are the same defect. The reports' other advisory notes and their Medium and Low rows are out. The tests/e2e and tests/api + tests/integration runs of 2026-10-28 report no High.
- Decision: 2026-10-28 Story 13 verifies with lint, typecheck and the unit suite, plain and shuffled; it changes Vitest files in tests/unit and src. If a corrected test exposes a real app bug, the story fixes it in its own `fix(...)` commit and then also runs the e2e suite (owner). The owner runs the fresh test reviews for Done when 1 after it merges (owner).
- Decision: 2026-10-28 Story 13 waits on nothing: stories 10–12 are done, and no open story touches its files.
