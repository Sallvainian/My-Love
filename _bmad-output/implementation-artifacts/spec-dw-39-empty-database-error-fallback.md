---
title: 'Give database errors with missing or blank messages a useful fallback'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
baseline_revision: '3441acad344f454b5a04176d53fc724319072eb1'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      The existing error-handler test header incorrectly says four callers never import the handler.
    evidence: |-
      tests/unit/api/errorHandlers.test.ts:16-20 contains this unchanged inventory.
      photoService.ts:396-397, partnerService.ts:192-193, scriptureReadingService.ts:332-333,
      and notesSlice.ts:519-520 now use handleSupabaseError for selected CHECK errors.
      The stale inventory can mislead maintainers assessing existing coverage; it predates DW-39.
    location: >-
      tests/unit/api/errorHandlers.test.ts:16-20
    severity: low
  - summary: >-
      Errors that omit message or code entirely can bypass database classification in service callers.
    evidence: |-
      isPostgrestError requires code, message, and details properties to exist.
      MoodApi.create and EventsService.createEvent use that unchanged guard before conversion.
      An omitted-message object therefore bypasses handleSupabaseError, while an explicitly
      present undefined, null, empty, or whitespace message reaches the fixed fallback.
      This pre-existing classifier behavior is distinct from DW-39's specifically identified
      unconditional interpolation in handleSupabaseError; the change does not claim to fix routing.
    location: >-
      src/api/errorHandlers.ts:122-130
    severity: low
---

<intent-contract>

## Intent

**Problem:** DW-39 identifies that `handleSupabaseError` unconditionally interpolates an unmapped database error's message. Empty or whitespace messages produce unhelpful text, and an absent message surfaces `undefined`.

**Approach:** Give the existing fallback a useful generic message when no meaningful message is available. Preserve all existing mapped errors and nonempty message text.

## Boundaries & Constraints

**Always:** Return `Database error: An unknown database error occurred` for unmapped errors with an absent, undefined, null, empty, or whitespace-only message. Keep existing code mappings ahead of this fallback. Preserve the original nonempty message verbatim, including surrounding whitespace. Keep the optional context prefix, error name, code, details, hint, and `isNetworkError: false` behavior unchanged.

**Never:** Do not edit the deferred-work ledger; the orchestrator records resolution. Do not expand mappings, change prototype lookup behavior, rewrite error classification or network handling, change callers/UI, add dependencies, or touch generated files, migrations, or archived E2E tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Missing message | Unmapped `XX000`; message omitted, explicitly undefined, or null | `Database error: An unknown database error occurred` | Returns an error without throwing during conversion |
| Blank message | Unmapped `XX000`; message is empty, spaces, or tabs/newlines | Same generic fallback | Whitespace does not count as useful text |
| Missing code too | Code omitted with missing or blank message | Same generic fallback; code remains undefined | No new code required |
| Meaningful message | Unmapped `XX000`; message is `Injected create failure` or `  Injected create failure \n` | `Database error: ` followed by the original message verbatim | Do not trim the returned text |
| Mapped error | Any of the eight mapped codes, including `23514`, with a missing or blank message | Existing mapped message | Mapping takes precedence |
| Context and diagnostics | Unmapped blank-message error with context `EventsService.createEvent` and diagnostic fields | `[EventsService.createEvent] Database error: An unknown database error occurred`; original fields retained | Name stays `SupabaseServiceError`; network flag stays false |

</intent-contract>

## Code Map

- `src/api/errorHandlers.ts:55` — `handleSupabaseError` is the public conversion surface named by the intent. The `errorMessages` object at line 64 contains eight mapped codes. Only its fallback expression at line 75 needs behavioral changes.
- `src/api/errorHandlers.ts:77` — the shared constructor already applies context and passes diagnostics through. Keep this code unchanged.
- `tests/unit/api/errorHandlers.test.ts` — existing 13 tests cover all mapped codes, check-constraint diagnostics, and the nonempty fallback with/without context. Extend the existing unmapped-code coverage. The `asPostgrestError` fixture already bridges wire values and the stricter SDK type; malformed message fixtures must explicitly model missing/null values without changing production types.
- `vitest.config.ts` — discovers this unit-test path, supplies a tests-only `@/` alias and inert Supabase configuration. No server or secrets are needed for unit tests.
- `package.json`, `tsconfig.test.json` — existing scripts provide unit tests, all-project typecheck, and lint; no configuration changes needed.
- Read-only context: `_bmad-output/implementation-artifacts/spec-dw-8-16-check-constraint-error-mapping.md` records DW-39's origin and a historical worktree-only TS2883 typecheck issue. Its other deferred findings are outside this bundle; verify current code instead of treating historical line numbers as authoritative.
- Read-only input: `/Users/sallvain/Projects/My-Love/.bmad-loop/runs/20260911-170829-4a3d/bundles/empty-database-error-fallback/intent.md` supplies this bundle's intent and verbatim DW-39 entry.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/api/errorHandlers.test.ts` — add regression tests for the matrix, using exact public return-value assertions and preserving the existing mapping checks. Update fallback-related comments as needed to describe the final behavior.
- [x] `src/api/errorHandlers.ts` — guard the unmapped-message fallback against missing and blank text, using the specified generic message only when needed.
- [x] `_bmad-output/implementation-artifacts/spec-dw-39-empty-database-error-fallback.md` — record completed verification and workflow review results.

**Acceptance Criteria:**
- Given an error supplied directly to `handleSupabaseError`, when its public returned fields are inspected across the matrix cases, then the matrix's messages and diagnostic behavior hold.
- Given the existing mapped-code and nonempty-message tests, when the focused unit suite runs after the change, then all prior behavior checks and the new cases pass.
- Given the final working tree, when its diff is inspected, then changes are limited to the handler, its unit tests, and this spec; the deferred-work ledger is unchanged.

## Spec Change Log

No implementation-driven spec changes were needed.

## Review Triage Log

### 2026-09-11 — Review pass

- verdicts: 6 findings — high 0, medium 2, low 2, false 2, maybe-false 0
- findings:
  - `[medium]` `[patch]` Blind hunter: calling `.trim()` on a nonstring message introduces a TypeError — reproduced through the installed SDK with a controlled HTTP 400 response containing `message: 42`; the existing classifier accepts it. Corrected the blankness check with a runtime string guard while preserving the prior `Database error: 42` result; numeric 42 and 0 regression tests pass. Shares one root cause with the edge-case finding below.
  - `[false]` `[reject]` Blind hunter: ASCII-only fixtures leave the whitespace contract unprotected — no current Unicode behavior defect or narrower implementation was demonstrated. A direct assertion with nonbreaking and em spaces confirms the standard trim operation returns the generic fallback; existing whitespace tests already pin the required branch.
  - `[false]` `[reject]` Blind hunter: null diagnostic values may not survive the generic fallback — the unchanged constructor passes diagnostics through without branching, and a direct assertion confirms null details and hint are preserved on a Unicode-blank error. String-valued regression checks cover the same pass-through mechanism.
  - `[low]` `[defer]` Blind hunter: the test header's caller inventory is stale — confirmed that all four named non-adopters now call the handler for CHECK errors. Those lines are unchanged from the baseline, so this documentation defect is recorded separately in frontmatter.
  - `[low]` `[defer]` Intent alignment: omitted message/code fields bypass the converter in service callers — confirmed against `isPostgrestError` and the callers. The bundle specifically identifies the interpolation expression as the defect; its direct returned-error surface is covered. The broader classifier issue predates the change and is recorded separately; no new application-wide routing behavior is claimed.
  - `[medium]` `[patch]` Edge-case hunter: a non-nullish nonstring message throws in error conversion — same SDK reproduction and correction as the first finding, grouped into one patch entry.
- The verification-gap layer reported no verification gaps. All four required layers completed; the fourth started after a slot opened because the platform permits only three concurrent child agents.
- No intent-gap or bad-spec loopback is required. The single grouped patch is verified below.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/errorHandlers.test.ts` — new fallback cases should fail before the production fix and all cases should pass afterward.
- `npm run test:unit` — all unit tests should pass; investigate and document any unrelated baseline failure without expanding scope.
- `npm run typecheck` — exit 0, or establish baseline evidence for unrelated existing failures.
- `npm run lint` — exit 0; document existing warnings.
- `git diff --check` and `git diff --name-only` — no whitespace errors or unrelated tracked changes; ledger unchanged.

### 2026-09-11 — Implementation verification

- `npx vitest run tests/unit/api/errorHandlers.test.ts` before the production fix: exit 1, 18 failed and 64 passed. All failures were the new generic-fallback assertions for missing/blank messages, with and without a code or context.
- The same focused command after the fix: exit 0, 82 passed. Coverage includes all six missing/blank variants, an omitted code, all eight mapped codes taking precedence, meaningful messages retaining surrounding whitespace, and context/diagnostic preservation.
- `npm run test:unit`: exit 0, 98 files and 1562 tests passed. The run emits existing React `act(...)` warnings and diagnostic logs from error-path tests; no test failed.
- `npm run typecheck`: exit 0. The historical worktree-only TS2883 issue did not reproduce.
- `npm run lint`: exit 0, with three existing `react-refresh/only-export-components` warnings in untouched `src/components/RelationshipTimers/EventCountdown.tsx` at lines 68, 91, and 132.
- `git diff --check`: exit 0. `git diff --name-only` lists only the handler and its tests; `git status --short` additionally lists this newly created spec. No other tracked or untracked changes were present, and the deferred-work ledger is unchanged.
- Vitest also reports an existing Vite configuration warning about `__dirname` and the future native config loader. No configuration changes were required.


### 2026-09-11 — Final patch verification

- Focused regression before the patch: the new numeric 42 and 0 cases both failed with TypeError. After the patch, `npx vitest run tests/unit/api/errorHandlers.test.ts` passes all 84 tests.
- `npm run test:unit`: exit 0, 98 files and 1564 tests passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, with the same three existing warnings in EventCountdown.tsx.
- `git diff --check` and `git diff --cached --check`: exit 0. `git diff HEAD --name-only` lists only this spec, the handler, and its test file.
- Matrix audit: all six rows have executed, passing assertions. The malformed-number regressions additionally protect behavior exposed during review.
- Direct review probes confirmed Unicode whitespace produces the generic message and null diagnostics remain null. A controlled SDK response established that numeric messages reach the existing classifier, justifying the patch.

## Auto Run Result

Status: done

Implemented DW-39 in the shared error converter. Missing, null, empty, and whitespace-only messages now produce `Database error: An unknown database error occurred`. Existing mappings, nonempty text including surrounding whitespace, context, and diagnostic fields retain their behavior. The final blankness check also preserves the prior behavior for nonstring messages instead of introducing a TypeError.

Files changed:

- `src/api/errorHandlers.ts` — guard only the fallback message selection.
- `tests/unit/api/errorHandlers.test.ts` — expand the 13 existing tests to 84 cases covering missing/blank values, mapped precedence, original messages, diagnostics, absent code, and numeric messages.
- `_bmad-output/implementation-artifacts/spec-dw-39-empty-database-error-fallback.md` — implementation contract, verification, and review results.

Review breakdown:

- Four review layers completed. Six findings were individually triaged; the verification-gap layer found no gaps.
- One grouped medium patch applied, addressing both reports of the same nonstring-message TypeError. Patched entry counts: high 0, medium 1, low 0.
- Two pre-existing low issues recorded in this spec's `deferred` frontmatter: stale caller documentation and omitted-property classifier behavior. The deferred-work ledger itself was not edited.
- Two findings rejected: Unicode whitespace already works under the standard trim operation, and null diagnostics already survive the shared constructor. Both behaviors were confirmed directly; evidence is recorded in the triage log.
- Follow-up review recommended: false. One medium patch and no high patch do not trigger another pass; no unresolved introduced risk was identified.

Verification: 84 focused tests and all 1564 unit tests pass; typecheck and lint exit 0, with only the three existing lint warnings. Diff whitespace checks and the matrix audit pass. No build, browser, or database changes are involved.

Residual limits: service callers still classify malformed omitted-property envelopes using the existing guard, and the existing test header has a stale caller inventory. Both predate this fallback repair and are recorded above. The repository's ledger remains unchanged. Local code/test and documentation commits complete the run; no push is performed.
