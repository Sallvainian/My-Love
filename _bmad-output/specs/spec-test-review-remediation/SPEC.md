---
id: SPEC-test-review-remediation
companions:
  - corrections.md
  - findings-api-integration.md
  - findings-e2e.md
  - findings-unit.md
  - findings-src.md
  - findings-cross-cutting.md
  - ../../../.claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md
  - ../../../AGENTS.md
sources:
  - ../../test-artifacts/test-review/test-review-target-tests.md
  - ../../test-artifacts/test-review/test-review-target-tests-e2e.md
  - ../../test-artifacts/test-review/test-review-target-tests-unit.md
  - ../../test-artifacts/test-review/test-review-target-src.md
  - ../../test-artifacts/test-review/test-review-system.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Test Review Remediation

## Why

A mandate from the owner. The 2026-09-25 TEA test reviews of My-Love's suite (tests/e2e, tests/unit, src, tests/api + tests/integration, and one whole-suite run) found 895 findings in the folder runs and 653 in the suite run. Among them are tests that cannot fail, checks that only log, errors that are swallowed, clock-dependent flakes, and hundreds of maintainability and style findings. The owner wants zero issues, regardless of practical impact: every finding gets fixed, including ones an audit judged overstated. A green suite then means the behaviour works, and a fresh review comes back clean.

## Capabilities

- **CAP-1**
  - **intent:** Every test can fail when the behaviour it names breaks. Covers rows C1–C7, H3 and H10, plus the log-only checks, swallowed errors, vacuous premises and false-coverage specs in `corrections.md`.
  - **success:** A re-review has zero C, H3 or H10 rows. For each CRITICAL fix, breaking the behaviour it targets makes the test fail.
- **CAP-2**
  - **intent:** Tests give the same result regardless of clock, time zone, DST, month end and machine speed. Covers H1, H2, M1 and M6, plus the suite run's normalization-removed H1/H2 rows.
  - **success:** A re-review has zero H1, H2, M1 or M6 rows, and no asserted value derives from the live clock.
- **CAP-3**
  - **intent:** Tests leave no state behind and clean up even when they fail. Covers H4, plus the cleanup-ordering and leaked-row items in `corrections.md`.
  - **success:** A re-review has zero H4 rows, unit suites pass in shuffled order, and a full e2e run leaves behind no rows it created.
- **CAP-4**
  - **intent:** Component tests drive the UI through user-event, as a user would. Covers M5.
  - **success:** A re-review has zero M5 rows, and every test named for a key press or gesture performs it.
- **CAP-5**
  - **intent:** Playwright specs use the installed playwright-utils helpers, or carry a recorded deviation. Covers M9 and L9.
  - **success:** A re-review has zero M9 or L9 rows.
- **CAP-6**
  - **intent:** Tests are readable and failures point to their cause. Covers H5, M2, M3, M4, M7, L1, L2, L3, L5, L6 and L7.
  - **success:** A re-review has zero rows of those ids, and no test file exceeds 1000 lines.

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

## Non-goals

- New coverage for untested behaviour, such as `formatDateLong` and `formatMessageTimestamp`. That comes later from `bmad-testarch-trace` and `bmad-testarch-automate`, in separate PRs.
- Changing TEA's rules, registry or config.
- `tests/e2e-archive/` and the pgTAP files. Neither review scored them.
- `[P#]` priority markers on unit or src Vitest tests. No report flagged them, and each folder's own style has none. Only the Playwright `test:p0` and `test:p1` scripts read markers. The e2e L2 rows are still in scope.

## Success signal

- Fresh `bmad-testarch-test-review` runs on `tests/e2e/`, `tests/unit/`, `src/`, and `tests/api/` + `tests/integration/` each report zero scored findings.
- Every item in `corrections.md` is resolved, and CI is green on main.

## Assumptions

- The four per-folder re-reviews are the done gate. A whole-suite re-run is an optional second opinion, because it cannot score convention rows.
- Every convention row (L2 in e2e, L3, L5, L7, M9) is fixed as listed. An investigation confirmed the baselines (see `corrections.md`): no row disappears under a folder's own baseline, and the only changes are severity shifts for M9.
