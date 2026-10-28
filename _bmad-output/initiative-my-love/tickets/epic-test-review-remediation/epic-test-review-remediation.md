---
type: epic
title: "Test Review Remediation"
parent: initiative-my-love
covers: []
sources: [_bmad-output/test-artifacts/test-reviews/test-review-target-tests.md, _bmad-output/test-artifacts/test-reviews/test-review-target-tests-e2e.md, _bmad-output/test-artifacts/test-reviews/test-review-target-tests-unit.md, _bmad-output/test-artifacts/test-reviews/test-review-target-src.md, _bmad-output/test-artifacts/test-reviews/test-review-system.md]
companions: [_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/corrections.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-api-integration.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-e2e.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-unit.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-src.md, _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-cross-cutting.md, AGENTS.md]
after: []
status: done
risk: low
---

# Test Review Remediation

## Description

A mandate from the owner. The 2026-09-25 TEA test reviews of My-Love's suite (tests/e2e, tests/unit, src, tests/api + tests/integration, and one whole-suite run) found 895 findings in the folder runs and 653 in the suite run. Among them are tests that cannot fail, checks that only log, errors that are swallowed, clock-dependent flakes, and hundreds of maintainability and style findings. The owner wants zero issues, regardless of practical impact: every finding gets fixed, including ones an audit judged overstated. A green suite then means the behaviour works, and a fresh review comes back clean.

## Outcome

For the owner and anyone changing the code, a green suite means the behaviour works; the success signal is the fresh per-folder re-reviews under Done when.

## Requirements

R1 (CAP-1): Every test can fail when the behaviour it names breaks. Covers rows C1–C7, H3 and H10, plus the log-only checks, swallowed errors, vacuous premises and false-coverage specs in `corrections.md`. Success: a re-review has zero C, H3 or H10 rows. For each CRITICAL fix, breaking the behaviour it targets makes the test fail.

R2 (CAP-2): Tests give the same result regardless of clock, time zone, DST, month end and machine speed. Covers H1, H2, M1 and M6, plus the suite run's normalization-removed H1/H2 rows. Success: a re-review has zero H1, H2, M1 or M6 rows, and no asserted value derives from the live clock.

R3 (CAP-3): Tests leave no state behind and clean up even when they fail. Covers H4, plus the cleanup-ordering and leaked-row items in `corrections.md`. Success: a re-review has zero H4 rows, unit suites pass in shuffled order, and a full e2e run leaves behind no rows it created.

R4 (CAP-4): Component tests drive the UI through user-event, as a user would. Covers M5. Success: a re-review has zero M5 rows, and every test named for a key press or gesture performs it.

R5 (CAP-5): Playwright specs use the installed playwright-utils helpers, or carry a recorded deviation. Covers M9 and L9. Success: a re-review has zero M9 or L9 rows.

R6 (CAP-6): Tests are readable and failures point to their cause. Covers H5, M2, M3, M4, M7, L1, L2, L3, L5, L6 and L7. Success: a re-review has zero rows of those ids, and no test file exceeds 1000 lines.

## Constraints

- A fix keeps or strengthens what a test proves. Never weaken, skip or delete a test to satisfy a rule. A test is deleted only when another test covers its behaviour.
- For a verified false positive, make a harmless change so the rule stops firing.
- `corrections.md` overrides the finding catalogs and their suggested fixes.
- Catalog line numbers are from main at 92f1c517. Earlier stories shift lines, so locate each finding by its content.
- App-code changes are limited to two kinds:
  - test hooks (`data-testid`, aria attributes)
  - fixes for real app bugs that a corrected test exposes. A bug fix is a separate commit named as a fix.
- The repo is public. Fixtures use the fictional values (Casey/Jessie, Harper). No personal data, emails or keys in tests, specs or commits.
- Every story leaves lint, typecheck, unit and e2e green. Any new `eslint-disable` line carries a same-line ` -- ` reason (see `AGENTS.md`).

## Done when

1. Fresh `bmad-testarch-test-review` runs on `tests/e2e/`, `tests/unit/`, `src/`, and `tests/api/` + `tests/integration/` each report zero scored findings.
2. Every item in `corrections.md` is resolved.
3. CI is green on main.

## Boundaries

- New coverage for untested behaviour, such as `formatDateLong` and `formatMessageTimestamp`. That comes later from `bmad-testarch-trace` and `bmad-testarch-automate`, in separate PRs.
- Changing TEA's rules, registry or config.
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
- project rules — AGENTS.md
- criteria registry — .claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md, TEA's rule definitions; TEA is not installed, so this path does not resolve
- source — _bmad-output/test-artifacts/test-reviews/, the five TEA reports in `sources:`
- evidence — _bmad-output/initiative-my-love/tickets/epic-test-review-remediation/worklists/story-8/, story 8's worklists
- v6 spec — _bmad-output/initiative-my-love/archive-v6/spec-test-review-remediation/SPEC.md

## Notes

- Assumption: The four per-folder re-reviews are the done gate. A whole-suite re-run is an optional second opinion, because it cannot score convention rows.
- Decision: 2026-09-25 Every convention row (L2 in e2e, L3, L5, L7, M9) is fixed as listed. An investigation confirmed the baselines (see `corrections.md`): no row disappears under a folder's own baseline, and the only changes are severity shifts for M9.
