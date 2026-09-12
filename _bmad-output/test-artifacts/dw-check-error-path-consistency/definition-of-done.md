# DW-38 automation Definition of Done

## Scope

Generate prioritized API/E2E tests for the CHECK presentation paths in implementation commit `881cef2`, with fixtures and a documented verification result. The orchestrator sprint row and ledger status are not verification evidence.

## Generation requirements

- [x] DW-38 acceptance criteria and implementation changes inspected.
- [x] Existing service/component coverage identified to avoid redundant matrices.
- [x] Existing Playwright framework, merged fixtures and auth provider reused.
- [x] API and browser workers dispatched with the Playwright-utils mandate.
- [x] Generated files aggregated, priorities counted and source snapshots archived.
- [x] All test imports and types validated.
- [x] ESLint and whitespace checks completed.
- [x] Relevant existing regression tests executed.
- [x] Playwright discovery reconciled with generated test count.

## Runtime verification requirements

- [ ] New API/E2E tests pass against local Supabase.
- [ ] Parallel execution and repeated browser runs show no observed flakes.

These runtime boxes cannot currently be checked: `supabase start` fails because the Docker daemon socket is unavailable. This is an execution prerequisite failure, not a passing test or an application failure. Do not use generation completion as a release-verification claim.

## Quality criteria

Assertions must observe production behavior and fail if the expected CHECK presentation or recovery disappears. Test-owned data must use unique identities; teardown must target only rows created by the test. Partner links and shared account rows must not be modified by specs. Intercepts precede triggering actions, async state uses deterministic waits, and every expected HTTP failure is explicitly asserted. No focused/skipped tests, hard sleeps, or production changes are needed.

The workflow checklist's happy-path-only E2E wording does not fit this explicitly requested error-path workflow; focused intercepted failures are intentional. Multiple assertions on one outcome follow the quality fragment's one-concern rule. No Pact tests, package scripts, generic fixture rewrites, or README restructuring are needed for this scope.

## Recorded outcome

Generation complete: 8 cases (7 P1, 1 P2), 2 specs, 2 data factories. Typecheck and generated-file lint pass; project lint passes with 3 existing react-refresh warnings. All 173 tests in the 5 affected unit/component suites pass. Playwright discovers exactly 8 new cases. Evidence is in `validation/`.

Static quality validation found and corrected two utility mismatches: intercepted payloads use `requestJson`, and `log.step` comes from the direct utility export rather than the callable log fixture. Shared CHECK envelopes, fresh UUIDs and deterministic retry-state waits were added during aggregation. No production file was changed.

Known checklist adaptations: API fixture UUIDs use Node `randomUUID`, while browser fixture IDs use Faker; both provide fresh data. Fixed scenario branches select send/accept/decline and table payloads, never branch on observed UI state or suppress assertions. Browser error tests use source-verified roles/labels/test IDs. `try/finally` is solely for exact-owned-row cleanup. Runtime duration, parallel safety and burn-in remain unmeasured for the new cases.
