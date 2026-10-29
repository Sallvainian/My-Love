---
title: 'Fix the 2026-10-03 tests/unit findings'
type: 'chore'
ticket: '10'
created: '2026-10-28'
status: done
baseline_revision: '4ac86ac6a007724f49dba92c2c88d153c141374e'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-unit.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-suite-high.md'
  - '{project-root}/AGENTS.md'
warnings: [oversized]
deferred:
  - summary: >-
      Two OfflineError tests in offlineErrorHandler.test.ts assert the same default fields, so "creates an error with default message" proves nothing that "is an instance of Error" does not.
    evidence: |-
      At the baseline both tests already asserted name, isRetryable and the default message (per-field toBe at :17-20, toMatchObject at :32-37); only the operation string differs, and only the second adds toBeInstanceOf(Error). The L7 conversion made the overlap visible but did not create it.
    location: >-
      tests/unit/utils/offlineErrorHandler.test.ts:15
    severity: low
---

<intent-contract>

## Intent

**Problem:** The 2026-10-03 TEA review of `tests/unit/` (run at bab5120e) left 28 rows — 1 H10, 12 M3, 6 L5, 5 L6, 4 L7 — and the suite run left 2 H10 rows in `tests/unit/services/moodNormalization.test.ts`. Together these 30 rows are tests that pass on a wrong error, tests that mix three or more subjects so a failure hides which layer broke, mechanism-style names, unnamed domain literals and mixed matcher dialects.

**Approach:** Work every row in the two findings files (located by content; no file changed since bab5120e, so line numbers still match), applying each row's suggested fix unless `corrections.md` or the Design Notes say otherwise. Make one commit per finding group: suite H10, folder H10, M3, L5, L6, L7.

## Boundaries & Constraints

**Always:** Keep or strengthen what each test proves. When you split an M3 test, every assertion in the original survives in exactly one of the new cases, under a name that states its subject, with shared arrange/act moved into a local helper or `describe` + `beforeEach`. Match the surrounding style by hand. Use relative or `@/` imports the way each file already does. Any new `eslint-disable` carries a same-line ` -- ` reason. Commit as `test(unit): …`, ending with the attribution line.

**Never:** Touch app code (no row needs it; if a corrected test exposes a real bug, fix it in a separate `fix(...)` commit). Edit any test file outside the listed rows, `tests/e2e-archive/`, TEA config, or any `findings-*.md` / `corrections.md`. Add `[P#]` markers. Run `prettier --write`. Delete or skip a test.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline wrapped call | `navigator.onLine=false`, `withOfflineCheck('save', fn)` | rejects with `{name:'OfflineError', operation:'save', message: OFFLINE_RETRY_MESSAGE}` (`OfflineError`'s default message), and `fn` is never called | test fails on wrong operation/message, or when `fn` runs |
| Empty mood list | `saveForDate(A, date, [])` | rejects with a `ValidationError` whose message or `fieldErrors` names the empty `moods` refusal (`'At least one mood must be selected'`, `src/validation/schemas.ts:100`); pin the exact observed value | a date or note refusal fails the test |
| No owner | `saveForDate('', date, ['happy'])` | rejects with `'User not authenticated'` (`src/services/moodService.ts:136`) | any other error fails the test |

</intent-contract>

## Code Map

All paths are under `tests/unit/`. Row details and suggested fixes are in the `context` findings files.

- `services/moodNormalization.test.ts:190-196` -- the two suite H10 rows; `isValidationError` import may become unused.
- `utils/offlineErrorHandler.test.ts` -- H10 at `:119-122`, L5 at `:113`, L7: per-field `toBe` at `:15-21` vs `toMatchObject` at `:32-37`.
- M3 sites: `stores/notesSlice.queueMultiTab.test.ts:183`, `stores/loaderIdentityGuards.messages.test.ts:262`, `stores/accountDataSlices.test.ts:168`, `components/AdminPanel.accountData.test.tsx:229` and `:243` (`:259` already covers cancel), `stores/interactionsSlice.localCopy.test.ts:416`, `stores/photosSlice.localCopy.test.ts:149`, `stores/loaderIdentityGuards.customMessages.test.ts:539` and `:601`, `stores/notesSlice.offlineQueue.test.ts:157` and `:180`, `stores/settingsSlice.initializeApp.test.ts:223` (mirror the empty-DB split at `:187/:204/:216` that the `initializeEmptyDb()` helper drives).
- L5 renames: `utils/interactionValidation.test.ts:114`, `utils/messageRotation.test.ts:39`, `utils/dateFormat.test.ts:14,22` (keep the existing `[P0]`), `utils/offlineErrorHandler.test.ts:113`; settingsSlice `:223` gets its new name through the M3 split.
- L6: `CHECK_VIOLATION_CODE` is exported from `tests/support/check-constraint-envelopes.ts:100`. Use it at `stores/notesSlice.queueMultiTab.test.ts:230` and `stores/notesSlice.offlineQueue.test.ts:327,403,513`. offlineQueue already names `INSUFFICIENT_PRIVILEGE` at `:94`; its `'08006'` at `:381` sits in a labelled table and is not a row. Name `CONNECTION_FAILURE = '08006'` at `stores/notesSlice.queueRetry.test.ts:200`. In `services/dbSchema.v15MessageData.test.ts:168`, replace `objectStoreNames.length).toBe(6)` with an assertion of the named store list. At `stores/moodSlice.test.ts:274`, name the limit (`PARTNER_MOOD_LIMIT`, as `moodSlice.partnerMoodsCopy.test.ts:86` does).
- L7: in `services/moodService.test.ts:168,409`, change `.length).toBe(1)` to `toHaveLength`. In `services/storageSchema.test.ts`, convert every `.contains(x)).toBe(true|false)` (`:125,143,170,187,260,296,473,477`) to the `toContain` / `not.toContain` form over `Array.from(...)` that `:501` uses, and `:127` to `toHaveLength`. In `api/moodSyncService.test.ts:251-252`, use `toMatchObject({ synced: 0, failed: 0 })`.

## Tasks & Acceptance

**Execution:**
- [x] `services/moodNormalization.test.ts` -- pin both refusals per the matrix -- suite H10.
- [x] `utils/offlineErrorHandler.test.ts` -- H10 per the matrix -- folder H10.
- [x] the 12 M3 sites in the Code Map -- split each into one case per subject, following the row's "Suggested split" -- M3.
- [x] the L5 sites -- rename to the suggested names, or to an equally outcome-stating name -- L5.
- [x] the L6 sites -- name or import each literal -- L6.
- [x] the L7 files -- one matcher form per file -- L7.

**Acceptance Criteria:**
- Given the 30 rows, when each listed location is inspected, then none of them still shows the defect its row describes.
- Given `withOfflineCheck`, when it is changed to report a different operation or message, or to call `fn` while offline, then the H10 test fails.
- Given each split M3 test, when one layer's assertion is broken, then only the case named for that layer fails, and the union of the new cases holds every assertion of the original.
- Given the finished branch, when lint, typecheck and the unit suite run, then all three pass.

## Implementation Notes

- Empty-moods refusal, pinned from a run: `saveForDate(A, date, [])` rejects with `name: 'ValidationError'`, message `'Invalid mood. Please select a valid option., moods cannot be empty'` and `fieldErrors` `{ mood: 'Invalid mood. Please select a valid option.', moods: 'moods cannot be empty' }`. `createValidationError` rewrites the schema's `'At least one mood must be selected'` into `'moods cannot be empty'`, and the empty list also fails `mood` (`moods[0]` is undefined). The test pins the whole `fieldErrors` map, which Vitest compares exactly, so an extra date or note entry fails it.
- Folder H10 keeps the original class check (`rejects.toBeInstanceOf(OfflineError)`) beside the suggested `toMatchObject` and not-called check. Mutating `withOfflineCheck` to report another operation, another message, or to call `fn` while offline each failed the test.
- M3: the accepted-path queueMultiTab helper `tab1SendsTab2sNote(tab2sOutcome)` now also backs `tab1SendsTab2sNoteAndItIsRejected`. Cases that assert a later step wait on a gate (`untilTab2ConfirmsIt`, `copyWritesSettled`) rather than repeat another case's assertion. The `interactionsSlice` refresher-kind check became its own case. `AdminPanel :243` kept its cancel-enabled assertion, in the failure-report case.
- Test counts, before → after: queueMultiTab 9→12, messages 15→16, accountDataSlices 31→32, AdminPanel 20→24, interactionsSlice 32→35, photosSlice 28→30, customMessages 19→23, offlineQueue 41→47, settingsSlice 19→21.

## Plan Change Log

## Review Triage Log

### 2026-10-28 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 5, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` queueMultiTab: the dedup and copy cases wait on `untilTab2ConfirmsIt`, so breaking tab 2's confirmation fails three cases instead of one — the cascade shows only when the confirmation itself breaks, and then the case named for it fails too, with a waitFor message that names tab 2's confirmation. Removing it would mean restructuring around an internal drain promise the test cannot reach, which adds complexity for a failure developers rarely hit.
  - `[low]` `[patch]` AdminPanel: "closes and drops the row from the rendered list…" owned no close assertion; the close lived only in the shared helper — added `expect(screen.queryByTestId('admin-delete-dialog')).toBeNull()` to that case (81f3055bcd7208e1763a9a5a854a1bc6db2ff72d).
  - `[low]` `[patch]` offlineErrorHandler: "creates an error with custom message" still checked OfflineError fields with per-field `toBe`, so L7 was only partly fixed — converted to one `toMatchObject({ operation, message })` (81f3055bcd7208e1763a9a5a854a1bc6db2ff72d).
  - `[low]` `[defer]` offlineErrorHandler: "creates an error with default message" and "is an instance of Error" assert the same default fields — the overlap predates the change (baseline :17-20 vs :32-37). Recorded in `deferred`.
  - `[low]` `[patch]` customMessages: "an import saves the imported row to the account's copy" asserted only the write count — now asserts the single write `[A, 'message-data', { custom: [{ serverId: 'srv-imported' }] }]` (81f3055bcd7208e1763a9a5a854a1bc6db2ff72d).

## Design Notes

- The M3 rows at `notesSlice.offlineQueue.test.ts:157/:180` are not covered by the `corrections.md` false positive (the epic's 2026-10-28 decision). Split them.
- Pin values from a run, never from a guess. For the ValidationError, print the rejection once, then assert the exact `message` or `fieldErrors` entry.

## Verification

**Commands:**
- `npx vitest run tests/unit/<each touched file>` -- expected: all pass, test count ≥ before for each split file
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0, apart from the known worktree-only TS2883 baseline errors that also occur at the baseline revision
- `npm run test:unit` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** Fixed all 30 rows: the 28 rows of the 2026-10-03 tests/unit report (1 H10, 12 M3, 6 L5, 5 L6, 4 L7) and the 2 tests/unit H10 rows of the suite report. The suite H10 rows now pin the empty-moods refusal's `fieldErrors` and the `'User not authenticated'` message. The folder H10 test now pins the OfflineError's operation and message and checks that the wrapped call never runs. Each of the 12 multi-subject tests is split into one case per layer. Names, literals and matcher styles are fixed as the rows list. No app code changed.

**Commits (on top of 4ac86ac6a007724f49dba92c2c88d153c141374e):**
- 50d962e8a7d244856b7ce2505693bbea76f636e1 — suite H10, `services/moodNormalization.test.ts`
- fcfcdd4eba320abf172a5c099f8d65ce0cb6c2c8 — folder H10, `utils/offlineErrorHandler.test.ts`
- e5118f94427ac9a0c402ab7f565f9878067244d6 — M3 splits
- 117c79d802436b97eb6c46c85a832224f29b706e — L5 renames
- 3c89095384e18290632ef483ed9f2b7343634450 — L6 named literals
- e7cc8503330667a7acba2099a8399fb9c1f6751c — L7 one matcher form per file
- 81f3055bcd7208e1763a9a5a854a1bc6db2ff72d — review patches

**Files changed (all under `tests/unit/`):**
- `services/moodNormalization.test.ts` — the empty-moods and no-owner refusals now assert their exact errors
- `utils/offlineErrorHandler.test.ts` — H10 assertion, L5 rename, L7 `toMatchObject` throughout
- `stores/notesSlice.queueMultiTab.test.ts` — M3 split via `tab1SendsTab2sNote`; `CHECK_VIOLATION_CODE`
- `stores/notesSlice.offlineQueue.test.ts` — two M3 splits; `CHECK_VIOLATION_CODE` at three sites
- `stores/notesSlice.queueRetry.test.ts` — `CONNECTION_FAILURE` constant
- `stores/loaderIdentityGuards.messages.test.ts`, `stores/loaderIdentityGuards.customMessages.test.ts`, `stores/accountDataSlices.test.ts`, `stores/interactionsSlice.localCopy.test.ts`, `stores/photosSlice.localCopy.test.ts`, `stores/settingsSlice.initializeApp.test.ts`, `components/AdminPanel.accountData.test.tsx` — M3 splits (settingsSlice includes the L5 rename)
- `stores/moodSlice.test.ts` — `PARTNER_MOOD_LIMIT`
- `services/dbSchema.v15MessageData.test.ts` — the named store list replaces the store count 6
- `services/moodService.test.ts`, `services/storageSchema.test.ts`, `api/moodSyncService.test.ts` — one matcher form per file
- `utils/interactionValidation.test.ts`, `utils/messageRotation.test.ts`, `utils/dateFormat.test.ts` — L5 renames

**Review findings:** 5 findings, all low. 3 were patched, 1 deferred (the duplicate OfflineError default-field tests, which predate this change) and 1 rejected (the queueMultiTab gate cascade, for the reason recorded in the triage log).

**Follow-up review recommended:** false. The patched entries were 3 low, 0 medium and 0 high.

**Verification:** after the review patches, `npm run lint` exited 0, `npm run typecheck` exited 0 with no TS2883 errors, and `npm run test:unit` passed 197 files and 3090 tests. The three tests covering the matrix rows ran and passed in a verbose run. The implementer also broke `withOfflineCheck` by hand three ways (wrong operation, wrong message, calling the wrapped function while offline), and the H10 test failed each time.

**Residual risks:**
- AC3, "only the named case fails", was not checked by breaking each layer one at a time.
- In the queueMultiTab split, two cases wait on tab 2's confirmation (see the rejected finding).
- The ticket's verify step also calls for a fresh `bmad-tea-test-review` run on `tests/unit/` with no Critical or High. That run is the orchestrator's or owner's gate and was not run here.
