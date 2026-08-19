---
status: done
---

# TEA Test Design — dw-events-offline-message-honesty

Workflow `bmad-testarch-test-design` completed in **Epic-Level (Phase 4)** mode, `sequential` execution, all five steps.

## Artifacts

- `_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md` — the test design (509 lines)
- `_bmad-output/test-artifacts/test-design-progress-epic-dw-events-offline-message-honesty.md` — per-run progress checkpoint, `workflowStatus: completed`

Both under TEA's configured `test_artifacts` (`_bmad/tea/config.yaml` → `{project-root}/_bmad-output/test-artifacts`).

## Result

10 risks scored (P × I, 1–3 each). One at score 6 requiring mitigation; none at 9; no gate FAIL implied. 7 coverage scenarios, 15 tests, ~9–18 h. **Zero P0** — the decision tree in `test-priorities-matrix.md` yields no revenue, security, data-integrity or compliance impact, and every failure this code reports has a trivial workaround.

The shipped code is correct on every reachable path found. The one score-6 risk is about the evidence, not the product: a zero-row insert has two possible client outcomes and the suite tests only the less likely one. Under `postgrest-js@2.112.3`, `.select()` appends `Prefer: return=representation` and `.single()` sets `Accept: application/vnd.pgrst.object+json`, so a zero-row insert returns `PGRST116` and the caller reads `'[InteractionService.sendInteraction] No rows found'` — a message the spec's I/O matrix does not contain and no test pins. The `{ data: null, error: null }` shape the `!data` branch guards is real but needs a 2xx with an empty body.

The highest-leverage recommendation is smaller: the honesty invariant has no repo-level guard, and a second false sync promise is live at `src/utils/offlineErrorHandler.ts:74`. One ESLint `no-restricted-imports` override would protect features not yet written.

Also corrected: the spec's residual-risk entry about losing the `[Supabase]` log prefix. Measured production delta is zero — the offline path throws before the `try` and never reached `logSupabaseError` before this change either.

## Constraints honored

No production code was modified. `git status --porcelain` shows the same single pre-existing modification (`deferred-work.md`) plus the two new artifacts. `sprint-status.yaml` was neither read nor written — no such file exists in this worktree.

## Verification run for this design

- `npx --no-install vitest run tests/unit/api/interactionService.test.ts` → 15 passed
- `npx --no-install vitest run` → 89 files, 1316 tests passed, 6.24 s
- Coverage of `src/api/interactionService.ts` → 71.42% statements, 50% branches, 57.14% functions, 72.58% lines

## Open items for the operator

1. TEST-03's mechanism (ESLint override recommended) and its Supabase-only scope list.
2. Whether `src/api/interactionService.ts` gets a per-file coverage threshold — the global 25% floor cannot see a regression in it.
3. Whether TEST-06 / TEST-07 belong in this bundle, given both need production changes the spec's Never list excludes and both already have ledger entries (DW-31, DW-35).
4. One assumption stayed inferred rather than measured: PostgREST's zero-row response was read from the client's shipped source, not observed. `supabase start` was not running. TEST-01's optional integration variant closes it.
