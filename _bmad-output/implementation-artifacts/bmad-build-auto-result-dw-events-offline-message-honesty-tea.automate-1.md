---
status: done
---

# TEA Test Automation — dw-events-offline-message-honesty

`bmad-testarch-automate` completed in Create mode, BMad-Integrated (the epic test design
was available and used as the build list).

## Deliverables

| Path | State |
|---|---|
| `_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md` | new — workflow summary + Definition of Done |
| `tests/unit/api/fakeInteractionsBackend.ts` | new — shared fixture (336 lines) |
| `tests/unit/api/interactionService.test.ts` | updated — 15 → 33 tests |
| `tests/unit/api/offlineMessageHonesty.test.ts` | new — 11 tests, repo-wide invariant guard |

No production code was changed: `git diff src/` is empty.

## Verified in this session

- `npx --no-install vitest run` → **90 files / 1345 tests passed** (baseline was 89 / 1316)
- `npm run lint` → **exit 0** (2 pre-existing warnings in an untouched file)
- `npx --no-install tsc -b --force` → **6 × TS2883**, all in `tests/support/merged-fixtures.ts`,
  the known worktree-only baseline; zero new errors
- Coverage of `src/api/interactionService.ts` → **82.53% stmts / 87.5% branch** (from 71.42% / 50%)
- Burn-in 10× on both new/updated files → **10 / 10 clean**
- Five mutations (four to production code, one to the guard's own detector) each produced the
  expected failures and were reverted — the new assertions are falsifiable, not just green

## Coverage plan status

Built: TEST-01, TEST-02, TEST-03 (all P1) and TEST-04, TEST-05 (P2), plus the fixture correction
TEST-01 depends on. Deferred: TEST-06 and TEST-07 (P3) — both require production changes the
spec's Never list excludes, and both already carry ledger entries (DW-31, DW-35). They are the
entire remaining statement-coverage gap (`subscribeInteractions`, lines 238-262).

## Two things the operator should read

1. **The test design's one open assumption was measured and its predicted string was wrong.**
   Local PostgREST returns `{"code":"PGRST116","details":"The result contains 0 rows","hint":null,
   "message":"Cannot coerce the result to a single JSON object"}` for a zero-row
   `Accept: application/vnd.pgrst.object+json` request. The design predicted the client's
   `maybeSingle` text, which never reaches a `.single()` call. The fixture carries the measured
   envelope; pinning the predicted one would have reproduced R-1 one layer along.

2. **`workflow.yaml`'s `default_output_file` collides across runs.** It resolves to the fixed path
   `{test_artifacts}/automation-summary.md`, already occupied by the completed
   `5-manage-events-in-settings` run. This session overwrote it, caught it via `git status`,
   restored the previous version from `HEAD` (`git diff` against it is empty), and wrote to a
   run-scoped filename instead. Any future `automate` run in this repo will hit the same collision.

Four further operator decisions — promoting the honesty guard to an ESLint rule, a per-file
coverage threshold, the still-false `OFFLINE_ERROR_MESSAGE` at `src/utils/offlineErrorHandler.ts:74`,
and whether DW-31 / DW-35 get scheduled — are set out in the summary.

Nothing was committed; the artifacts and tests are left in the working tree, matching the
preceding `tea.td` session in this run.
