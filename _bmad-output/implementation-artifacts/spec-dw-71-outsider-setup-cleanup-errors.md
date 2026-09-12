---
title: 'DW-71: Report outsider setup cleanup failures'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '14cd1ceca2efa510671b0fe6da5e76e6a2e87f8f'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `createOutsiderClient` ignores returned account deletion errors when authentication setup fails. A rejected deletion promise instead replaces the setup failure, so callers cannot diagnose both failures.

**Approach:** Inspect cleanup's returned error and preserve the original setup failure together with any returned or thrown cleanup failure. Retain the successful helper return contract and cover the public helper with isolated regression tests.

## Boundaries & Constraints

**Always:** Attempt cleanup of the newly created outsider account once when client setup fails. Await cleanup before rejecting. Rethrow the original setup failure unchanged when cleanup succeeds. If both operations fail, expose both original failures in order (setup, cleanup) and identify the outsider account in the combined diagnostic. Preserve `{ client, userId, cleanup }`, including the cleanup callback's Supabase response and rejection behavior after successful setup.

**Never:** Edit the deferred-work ledger, generated database types, archived E2E tests, production code, shared worker accounts, or unrelated caller teardown behavior. Do not introduce cleanup retries, new dependencies, or a new cleanup API. Unit tests must not require a live Supabase service or secrets.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Setup succeeds | Account created and user signed in | Return same client, account ID, and callable cleanup; no eager deletion | Cleanup continues forwarding deletion response/rejection |
| Setup fails, cleanup succeeds | Setup rejects; deletion resolves with `error: null` | Delete only the created account, await completion | Reject with original setup failure unchanged |
| Setup fails, deletion returns error | Setup rejects; deletion resolves with AuthError | Report both failures and account ID | Preserve setup and returned cleanup failures |
| Setup fails, deletion rejects | Setup rejects; deletion promise rejects | Report both failures and account ID | Preserve setup and thrown cleanup failures, including non-Error rejection values |
| Creation fails | Account creation errors or returns no user | Do not start client setup or deletion | Keep existing creation error behavior |

</intent-contract>

## Code Map

- `tests/support/helpers/rls-security.ts:43` — `createOutsiderClient` owns creation, the deletion closure at line 60, and the setup rejection handler at lines 64–67. Modify only that failure handler and its explanatory comment as needed.
- `tests/support/helpers/rls-security.ts:14` — `createUserClient` looks up the new account, constructs the client through Supabase `createClient`, and signs in. Exercise it through the public outsider helper; mock external auth boundaries rather than its same-module binding.
- `tests/unit/helpers/events.test.ts` — nearby Vitest helper test convention; add `tests/unit/helpers/rls-security.test.ts` beside it. Use explicit Vitest imports and restore environment stubs/mocks.
- `tests/support/factories/index.ts:19` — `TypedSupabaseClient` type for admin mocks; keep this a type-only import. `tests/support/test-credentials.ts` supplies existing test credentials.
- `tests/api/events-wire-contract.spec.ts:645` — caller explicitly inspects `outsider.cleanup()` response and aggregates independent failures; evidence for preserving the callback contract and using `AggregateError`.
- `tests/e2e/scripture/scripture-rls-security.spec.ts:25` — tracks returned outsider objects for later cleanup; read-only compatibility context.
- `vitest.config.ts` — includes `tests/**/*.test.ts`, uses `tests/setup.ts`, and needs no real service. `tsconfig.test.json` covers support/test files; ES2022 supports `AggregateError`.
- `/Users/sallvain/Projects/My-Love/node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts:836` — installed `deleteUser` returns `{ data: { user: null }, error }` for AuthErrors and rethrows other failures. Read-only evidence. Shared dependencies match this worktree's lockfile and resolve through parent directories; prepend `/Users/sallvain/Projects/My-Love/node_modules/.bin` to PATH for npm verification commands if needed.

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/helpers/rls-security.ts` — inspect deletion results in the setup failure handler and aggregate dual failures without changing successful behavior.
- [x] `tests/unit/helpers/rls-security.test.ts` — test the matrix through `createOutsiderClient` with controlled external auth responses, asserting exact account targeting, error preservation, awaited cleanup, and return/callback compatibility.

**Acceptance Criteria:**
- Given a caller of `createOutsiderClient`, when setup and account deletion both fail through either Supabase failure channel, then the rejected helper promise exposes both failures and identifies the affected account.
- Given the new helper regression suite and existing project configuration, when focused Vitest, full typecheck, and lint run, then the tests pass and no new type or lint errors occur without service credentials.
- Given the orchestrator-owned deferred-work ledger, when this bundle completes, then its content remains unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 8 findings — high 0, medium 2, low 3, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` Blind hunter: Playwright drops the setup failure and non-Error cleanup details from reports — reproduced with the installed `playwright/lib/util.js` serializer, which omits `AggregateError.errors`. Added both diagnostic details to the message while retaining original objects and cleanup cause; message assertions and three serializer probes pass.
  - `[low]` `[patch]` Blind hunter: returned setup AuthErrors were absent from the regression suite — added lookup/sign-in returned-error scenarios with successful cleanup and returned/rejected cleanup failures, exercising the actual helper wrapper behavior.
  - `[low]` `[reject]` Blind hunter: falsy setup rejection values lack dedicated tests — exact setup identity is already tested at all three setup stages, and neither rethrow nor aggregation branches on its truthiness. Falsy SDK setup rejections are not an everyday failure; more cases add test complexity without a demonstrated distinct defect.
  - `[false]` `[reject]` Blind hunter: synchronous deletion exceptions need a separate regression — the installed `GoTrueAdminApi.deleteUser` is async, including UUID validation, so actual invocation errors become rejected promises already covered by the suite. A synchronously throwing replacement mock would exercise a different boundary.
  - `[low]` `[reject]` Blind hunter: absolute dependency evidence paths are workstation-specific — the Code Map records this run's inspected installation, while verification commands remain ordinary npm scripts. The proposed correction edits this build's spec, which review rules require rejecting.
  - `[medium]` `[patch]` Intent auditor: helper-level preservation does not establish rendered diagnostic reporting — same serializer defect as the first finding; grouped with it and fixed by preserving both details in the message. The installed serializer now retains both details for Error, string, and object cleanup failures.
  - `[false]` `[reject]` Intent auditor: raw SDK setup error identity differs from the helper rejection — the cleanup handler receives `createUserClient`'s rejection, and that exact failure remains preserved. Existing lookup/sign-in AuthError wrapping precedes this handler and remains unchanged; new returned-error tests verify the wrapper and its diagnostic.
  - `[false]` `[reject]` Intent auditor: tests mock deletion rather than observing actual account removal — the intent targets inspection of the deletion response and preservation of failure channels. Tests exercise that public helper boundary, and the unchanged callback still invokes the installed deletion API for the created account. No live-database verification is claimed.
- Verification-gap reviewer reported no gaps; edge-case hunter reported no findings. All four review layers completed. Two patch groups were applied: medium 1, low 1. No items were deferred.

## Design Notes

Use `AggregateError` to retain both failure objects without flattening their messages or metadata. Scope the cleanup `try/catch` so the original setup rethrow is outside it; successful deletion must not be misclassified as another failure. Keep the cleanup callback unchanged so successful callers still receive Supabase's original response.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/helpers/rls-security.test.ts` — all focused regression tests pass.
- `npm run typecheck` — all three TypeScript projects pass.
- `npm run lint` — no new lint errors.
- `git diff --check` — no whitespace errors.
- `git diff --exit-code -- _bmad-output/implementation-artifacts/deferred-work.md` — ledger unchanged.

## Auto Run Result

Status: done

`createOutsiderClient` now inspects returned deletion errors when setup fails and preserves setup and cleanup failures in an ordered `AggregateError`. Its message includes the account ID and both failure details for Playwright reports; the cleanup failure is also retained as `cause`. Successful deletion rethrows the setup failure unchanged, and successful helper/callback behavior remains intact.

Files changed:
- `tests/support/helpers/rls-security.ts` — handle returned and rejected cleanup failures and retain both diagnostics.
- `tests/unit/helpers/rls-security.test.ts` — add 26 isolated public-helper regression cases.
- This specification — record intent, implementation, review triage, and verification.

Review outcome: two patches applied (medium 1, low 1), zero deferred items. Rejected findings are recorded individually above: uncommon falsy setup cases add no demonstrated coverage value; synchronous deletion throws cannot escape the actual async SDK method; workstation evidence edits target this spec; raw SDK errors are wrapped before the cleanup boundary; real account deletion is outside the claimed response-handling verification.

Follow-up review recommended: `false`. This first pass patched no high entries and only one medium entry. No specific unverified regression risk remains after the checks below.

Verification performed:
- `npm run test:unit -- tests/unit/helpers/rls-security.test.ts` — 26 tests passed.
- `npm run typecheck` — all three TypeScript projects passed.
- `npm run lint` — passed with zero errors and the three existing Fast Refresh warnings in `src/components/RelationshipTimers/EventCountdown.tsx`.
- Invoked the real helper with controlled admin failures, then passed its error through the installed Playwright serializer — both diagnostics survived for Error, string, and object cleanup rejections (three cases passed).
- `git diff --check` and `git diff --cached --check` — passed.
- Compared the deferred-work ledger against the baseline revision — unchanged.
- Matrix audit: successful setup/callback contract (3 cases); successful setup-failure cleanup and awaiting (4 cases); returned deletion AuthError (1 case); rejected deletion values (8 cases); creation failures (4 cases); returned lookup/sign-in setup AuthErrors with all three cleanup outcomes (6 cases). All 26 ran and passed.

Checks used the shared installation's executables on PATH; no dependencies or secrets were added. Live Supabase/API/E2E tests were not run because this change tests the helper's response handling through isolated auth mocks. Existing Vitest configuration also emits its unchanged future native-loader warning about `__dirname`. The deferred-work ledger remains orchestrator-owned and untouched.
