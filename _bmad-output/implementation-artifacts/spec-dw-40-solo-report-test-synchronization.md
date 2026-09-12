---
title: 'Synchronize the solo report partner-completion assertion'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
baseline_revision: 'dff6ca1fd8b674ed96a7683c0873155d618f1b12'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** DW-40 reports that the SoloReadingFlow test `treats partner as complete when session-level reflection exists` intermittently fails under full-suite load. It waits for the report container, which can render before the asynchronous report fetch updates partner completion, then immediately asserts that the waiting indicator is absent.

**Approach:** Synchronize the existing test with the rendered partner-completion state it checks. Attempt reproduction with the full suite and verify that the corrected assertion survives suite load while retaining its ability to reject an incomplete partner.

## Boundaries & Constraints

**Always:** Preserve the session-level reflection fixture, the linked partner, the report navigation, and the assertion that the waiting indicator disappears. Keep the report-presence assertion so an absent report cannot produce a false pass. Use condition-based waiting with the existing bounded timeout behavior. Record reproduction and verification outcomes honestly, including any unrelated environment failures.

**Never:** Do not add arbitrary delays, retries, timeout increases, skipped tests, or weaker behavior checks. Do not change production code, test-runner configuration, dependencies, or unrelated tests. Do not edit `_bmad-output/implementation-artifacts/deferred-work.md`; the orchestrator records resolution. Do not modify archived E2E tests or generated files.

</intent-contract>

## Code Map

- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx:1475` — target test. Its report fixture has a partner reflection at `stepIndex: MAX_STEPS`; the report-presence wait ends at line 1514 and the immediate absence assertion is at line 1515. The file already imports `vi` and consistently uses `vi.waitFor`.
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx:215` — `beforeEach` resets the mock report response and store. The neighboring test at line 1403 checks that a partial reflection plus a partner message still displays the waiting indicator; retain it unchanged as the complementary behavior check.
- `src/components/scripture-reading/hooks/useReportPhase.ts:336` — read-only cause evidence: an effect awaits `getSessionReportData`, derives `isPartnerComplete` from a partner session reflection or all step ratings, then calls `setReportData` at line 419. Fetch initiation or container presence alone does not establish that the UI consumed this update.
- `src/components/scripture-reading/containers/ReportPhaseView.tsx` — read-only: renders DailyPrayerReport immediately for the report subphase and passes through report data.
- `src/components/scripture-reading/reflection/DailyPrayerReport.tsx:61` — read-only: report container always renders; line 200 conditionally renders the waiting indicator while a named partner is incomplete.
- `vitest.config.ts` and `package.json` — read-only: `npm run test:unit` executes the full suite under happy-dom; the focused Vitest command can run this file alone. No configuration change is needed.
- Bundle input: `/Users/sallvain/Projects/My-Love/.bmad-loop/runs/20260911-170829-4a3d/bundles/solo-report-test-synchronization/intent.md`. Baseline revision: `dff6ca1fd8b674ed96a7683c0873155d618f1b12`. No planning-artifacts directory exists; this is a freeform deferred-work bundle, not a new epic story.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — put the existing report-presence and waiting-indicator absence assertions in the same awaited condition-based callback in the target test. Preserve its setup and neighboring cases so the change fixes synchronization alone.
- [x] `_bmad-output/implementation-artifacts/spec-dw-40-solo-report-test-synchronization.md` — record baseline attempts, focused verification, repeated full-suite verification, lint/typecheck outcomes, and review results. Keep diagnostic logs outside tracked source.

**Acceptance Criteria:**
- Given the linked-partner fixture with a session-level reflection, when the report fetch settles after the report container first renders, then the test waits until the report is present and the partner waiting indicator is absent before succeeding.
- Given a regression that leaves the partner incomplete, when the target test executes, then its absence assertion still fails within the ordinary wait timeout.
- Given normal full-suite load, when the unchanged suite is attempted before the fix and repeated after it, then the recorded evidence distinguishes observed baseline failures from successful runs and shows the fixed target test passing without sleeps, retries, or timeout increases.

## Spec Change Log

- 2026-09-11: Moved the existing waiting-indicator absence assertion into the target test's existing `vi.waitFor` callback alongside report presence. Fixture, linked partner, report navigation, neighboring cases, and default wait timeout remain unchanged. No requirements or implementation scope changed.

## Review Triage Log

- Implementation verification complete; independent review is pending the orchestrator's review workflow.

### 2026-09-11 — Review pass

- All four layers completed at the parent session's model capability. The platform's agent limit required serial launches after parallel launches were attempted; no layer was skipped. Edge-case-hunter returned no findings; verification-gap reported no verification gaps. Blind-hunter returned four findings; intent-alignment reported one reproduction-evidence divergence.
- verdicts: 5 findings — high 0, medium 0, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind-hunter: immediately resolved mocks and passing baseline runs do not deterministically demonstrate the repaired timing condition — added a temporary controlled-response full-suite diagnostic. With identical gating, the old assertion failed on the waiting indicator and the fixed assertion passed; the diagnostic was restored afterward. This is a verification correction with no additional shipped code.
  - `[false]` `[reject]` Blind-hunter: absence could pass because the partner name disappears — this test fixes `mockStoreState.partner` to `linkedPartner` with display name Sarah. `useSoloReadingFlow` reads that unchanged store object and ReportPhaseView passes its name through; no action in this case clears or replaces it. The diagnostic also directly observed Sarah's waiting message before releasing the response. A missing name is not reachable in this test's execution.
  - `[low]` `[reject]` Blind-hunter: the Code Map describes the original immediate assertion rather than the delivered code — those investigation anchors describe the baseline, while the execution task and implementation evidence describe the relocation. Clarifying the baseline label would edit this build's spec, which the review workflow explicitly excludes from fixes.
  - `[low]` `[reject]` Blind-hunter: execution evidence omits Node/npm versions and effective worker settings — true as a documentation omission, but the commands use the unchanged repository runner configuration and the recorded logs identify the runs. The proposed fix edits this build's spec, which the review workflow excludes from fixes.
  - `[low]` `[patch]` Intent-alignment: natural full-suite reproduction remains unestablished, although the diff satisfies the rendered-state synchronization expectation — grouped with the first finding's missing controlled before/after evidence. The supplemental full-suite diagnostic demonstrates failure with the old assertion and success with the new one under the same pending-response condition. Natural baseline runs remain honestly reported as passing.
- Grouped patches: one low verification correction; source patches after review: zero. Deferred entries: zero. Rejected findings: three, each with evidence above. No intent gap or bad-spec loopback was needed.

## Verification

**Commands:**
- `npm run test:unit` — baseline: attempt up to five sequential runs, stopping on the reported failure. After the fix: five sequential full-suite runs to exercise the reported intermittent condition; record any unrelated failures separately.
- `npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — all tests pass, including the existing incomplete-partner case.
- `npm run lint` and `npm run typecheck` — exit 0, or document and confirm any pre-existing failures against the baseline.
- Temporary, restored diagnostic mutation in `useReportPhase.ts` making `isPartnerComplete` remain false — the target test fails on the waiting-indicator assertion; restore production code immediately afterward. This verifies that asynchronous waiting preserves regression detection.
- `git diff --check` and final path inspection — no whitespace errors; only the target test and this spec artifact are changed; the deferred-work ledger remains untouched.

### Baseline evidence

Completed before implementation: five sequential `npm run test:unit` runs at the baseline revision all passed (98 files / 1,564 tests, including all 115 SoloReadingFlow tests per run). The reported intermittent failure did not reproduce in this sample. Durations: 7.49s, 6.34s, 6.23s, 6.74s, 7.44s. Logs: `/tmp/dw40-baseline-dff6ca1-run1.log` through `/tmp/dw40-baseline-dff6ca1-run5.log`. No unrelated or environmental failures occurred. These baseline attempts are complete and need not be repeated by the implementer.

### Implementation verification

- Focused file: `npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` exited 0 with all 115 tests passing, including the unchanged incomplete-partner case. Duration: 3.10s. Log: `/tmp/dw40-fixed-focused.log`.
- Five sequential post-fix `npm run test:unit` runs all exited 0 with 98 files / 1,564 tests passing, including all 115 SoloReadingFlow tests in every run. No unrelated test failures or environmental failures occurred. The baseline flake was not observed in either five-run sample, so these runs establish successful verification under suite load, not reproduction of the original intermittent failure.

| Post-fix run | Files passed | Tests passed | Duration | Log |
| --- | ---: | ---: | --- | --- |
| 1 | 98 | 1,564 | 9.35s | `/tmp/dw40-fixed-full-run1.log` |
| 2 | 98 | 1,564 | 8.03s | `/tmp/dw40-fixed-full-run2.log` |
| 3 | 98 | 1,564 | 7.02s | `/tmp/dw40-fixed-full-run3.log` |
| 4 | 98 | 1,564 | 6.43s | `/tmp/dw40-fixed-full-run4.log` |
| 5 | 98 | 1,564 | 6.48s | `/tmp/dw40-fixed-full-run5.log` |

- Regression diagnostic: temporarily replaced the `isPartnerComplete` calculation in `useReportPhase.ts` with `false`, then ran `npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx -t 'treats partner as complete when session-level reflection exists'`. It exited 1 as expected: the target test failed after 1,020ms at line 1514 because `scripture-report-partner-waiting` still rendered Sarah's waiting message. The ordinary `vi.waitFor` timeout remained unchanged. The other 114 cases were excluded only by this diagnostic name filter; no test definitions were skipped. Log: `/tmp/dw40-incomplete-partner-diagnostic.log`.
- The diagnostic restored the production hook immediately in a `finally` block and verified byte-for-byte restoration; `git diff --exit-code HEAD -- src/components/scripture-reading/hooks/useReportPhase.ts` also passed. A fresh focused run after restoration exited 0 with all 115 tests passing in 2.65s. Log: `/tmp/dw40-restored-focused.log`.
- `npm run lint` exited 0 with no errors and three existing `react-refresh/only-export-components` warnings in `src/components/RelationshipTimers/EventCountdown.tsx` at lines 68, 91, and 132. That file is unchanged against the baseline. Log: `/tmp/dw40-fixed-lint.log`.
- `npm run typecheck` exited 0 with no errors or warnings. Log: `/tmp/dw40-fixed-typecheck.log`.
- `git diff --check` passed. Final path inspection contains only the target test and this spec artifact; production code, runner configuration, dependencies, unrelated tests, generated files, and the deferred-work ledger remain untouched. Diagnostic logs are outside tracked source under `/tmp`.

### Controlled race verification after review

The original five-run baseline did not reproduce the flake naturally. To demonstrate the reported scheduling condition deterministically, a temporary version of the target test held `getSessionReportData` on an explicitly controlled promise. On the first waiting-indicator query, a temporary spy checked that both the report container and Sarah's waiting message were present, restored the original query function, and released the report response. The assertion therefore observed the real pending UI before React consumed the resolved report data. No sleep, timer delay, retry setting, or timeout increase was added. Both variants used the same gating and differed only in the location of the existing absence assertion.

- Old assertion outside the wait: `npm run test:unit` exited 1 with exactly the reported target failing on the waiting-indicator absence assertion; 97 files passed / one failed, 1,563 tests passed / one failed. Duration: 7.74s. Log: `/tmp/dw40-controlled-old-full.log`.
- Fixed assertion inside the wait: `npm run test:unit` exited 0 with 98 files / 1,564 tests passing. Duration: 14.66s. Log: `/tmp/dw40-controlled-fixed-full.log`.
- Temporary variants: `/tmp/dw40-controlled-old-test.tsx` and `/tmp/dw40-controlled-fixed-test.tsx`. The original reviewed test was restored byte-for-byte in a `finally` block and checked against the staged one-line relocation. A final focused run passed all 115 tests; log: `/tmp/dw40-final-focused.log`.
- Final `git diff --check` passed. Both the production hook and deferred-work ledger match the baseline revision exactly.

## Auto Run Result

Status: done

Implemented DW-40 by moving the existing waiting-indicator absence assertion inside the same `vi.waitFor` callback as report presence. The test now waits for the completed partner state rather than treating the initial report render as completion. The fixture and expected behavior are preserved.

Files changed:
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` — one assertion relocated into the existing wait.
- `_bmad-output/implementation-artifacts/spec-dw-40-solo-report-test-synchronization.md` — implementation plan, verification evidence, and review results.

Review: four layers completed; one low verification patch added controlled before/after evidence, with no further source edits. No items deferred. Three findings rejected: missing-partner false-pass claims were disproved by the fixed named-partner fixture and traced data flow; the baseline Code Map wording and omitted runtime metadata were spec-only documentation suggestions, excluded from fixes by the review workflow. Each finding and its evidence are recorded in the Review Triage Log.

Follow-up review recommended: false. Patched entry counts: high 0, medium 0, low 1. No unverified risk requiring another review pass remains.

Verification: five natural baseline runs passed; five standard post-fix full-suite runs passed at 98 files / 1,564 tests each. A controlled pending-response full-suite diagnostic failed with the old assertion and passed with the fixed assertion. A separate forced-incomplete diagnostic failed on the intended behavior check within the ordinary wait timeout. All diagnostics were restored; focused verification passed 115/115 afterward. Typecheck and lint passed, with three existing lint warnings in the untouched EventCountdown component. Diff checks passed; the deferred-work ledger was not edited.

Residual limitation: the natural intermittent failure was not observed in the baseline sample. The controlled diagnostic verifies its identified scheduling mechanism; repeated passing runs alone cannot establish that every possible unrelated suite flake is absent.
