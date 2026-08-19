---
status: done
---

# TEA Test Automation — story 5 (`5-manage-events-in-settings`)

Workflow `bmad-testarch-automate`, Create mode, `subagent` execution, `detected_stack = frontend`.

## Artifacts

All under TEA's configured `test_artifacts` (`_bmad-output/test-artifacts/`):

- `automation-summary.md` — the coverage plan, measured results, Definition of Done, activation steps (695 lines)
- `automation-5-manage-events-in-settings/api-events-wire-contract.spec.ts` → `tests/api/events-wire-contract.spec.ts` — 5 tests (1×P0, 4×P1)
- `automation-5-manage-events-in-settings/e2e-events-persistence.spec.ts` → `tests/e2e/settings/events-persistence.spec.ts` — 3 tests (2×P1, 1×P2)
- `automation-5-manage-events-in-settings/support-events.ts` → `tests/support/helpers/events.ts` — shared factory/helper module

8 new tests. P0: 1 · P1: 6 · P2: 1 · P3: 0.

## Scope discipline

Nothing was regenerated: the test design's 8 planned scenarios and the ATDD run's 15 scaffolds were
loaded as input and explicitly excluded, along with 7 further candidates each declined with a reason.
The 8 new tests close **layer** gaps — the PostgREST wire contract (create, read order, CHECK
violation, and the two distinct denial paths) and real-browser persistence of the two written fields
no round-trip test had ever read back.

## Verified, not predicted

Every file was copied to its target path, executed against the live local stack, and removed again.

| Check | Result |
|---|---|
| Collection | 5 tests in 1 file (`api`); 3 tests in 1 file (`chromium`) |
| Execution | 5 passed (6.0s); 3 passed (28.3s) |
| Burn-in `--repeat-each=3` | 15 passed; 9 passed — 24/24 |
| ESLint | exit 0 |
| Typecheck | 0 errors attributable to the new files |
| Full `chromium` regression | 130 passed / 2 skipped / 0 failed (baseline without the files: 127/2/0) |
| Playwright Utils deviations | **None** |
| Mutation check (E2E) | all 3 assertions proven to fail when deliberately mutated |
| Cleanup | `git status --porcelain` lists only `_bmad-output/` paths; `public.events` = 0 rows; no leaked accounts |

## Things the operator should read

1. **A worker created 554 `node_modules` symlinks in the worktree; they were removed.** Gitignored,
   so never at risk of a commit, but they silently zeroed the six-`TS2883` baseline that story 5's own
   acceptance criterion asserts. Every measurement above was taken after the removal. The baseline's
   cause is now measured and the memory note updated: the count is not stable at six, and the error
   message itself prescribes a one-line fix at `tests/support/merged-fixtures.ts:53`.
2. **One flake, located and bounded.** Run 1 of the full suite failed at
   `tests/e2e/scripture/scripture-accessibility.spec.ts:207` — unrelated to events. It passed in
   isolation, the repeat full run was 130/130, and the baseline was 127/127. Pre-existing and
   timing-sensitive; the added parallel load is a plausible trigger.
3. **Two checklist items deliberately not satisfied**, both recorded with reasons in the summary:
   one-assertion-per-test (these are round trips, and two API tests carry positive controls on
   purpose), and `tests/README.md` / `package.json` script updates (ungated variables, and both would
   write outside `_bmad-output/`).
4. **Process defect worth fixing next run:** Workers A and B were launched in parallel but share one
   worker-pool identity under `--workers=1`. A lock was issued mid-flight and every number was
   re-measured serially afterwards, so no claim rests on the overlap — but launch them sequentially.

Nothing outside `_bmad-output/` was changed. Recommended next: `test-review` over the two new specs
plus the six parked ATDD scaffolds, then `trace`.
