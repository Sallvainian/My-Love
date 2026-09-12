---
title: 'DW-61/64/69 Event test date anchors'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '6afb20e2b69485307ecb25fac7c59f0e86ab45af'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The helper's existing time-of-day arithmetic can skip a calendar day in a late-evening DST gap.
    evidence: |-
      Reproduced with TZ=America/Nuuk: local 2026-03-27 23:30 plus one day using
      the helper's unchanged setDate arithmetic yields 2026-03-29, while
      eventDateFrom's local-midnight constructor yields 2026-03-28. The target
      23:30 falls in a skipped DST hour. Baseline revision
      6afb20e2b69485307ecb25fac7c59f0e86ab45af uses the same time-preserving
      arithmetic, so this is a pre-existing calendar issue rather than the
      independent-clock defect resolved by this bundle. Current unit coverage
      runs in America/New_York, where its spring/fall DST cases pass.
    location: >-
      tests/support/helpers/events.ts:180
    severity: low
---

<intent-contract>

## Intent

**Problem:** Repeated `isoDateDaysFromNow` calls read independent clocks, so an event setup crossing local midnight can seed rows relative to different days. DW-61, DW-64, and DW-69 describe this same defect.

**Approach:** Extend the helper with an optional caller-owned anchor and capture one anchor per affected API, Home, and Settings setup. Verify calendar arithmetic and midnight stability while retaining the existing single-row and anchored factory contracts.

## Boundaries & Constraints

**Always:** Derive dates using local calendar components; leave the supplied anchor unchanged. Keep one-argument calls working from the current date. Preserve assertions, event ownership, checked cleanup, and `TEST_WORKER_INDEX` isolation. Use merged Playwright fixtures.

**Never:** Edit the deferred-work ledger, production code, generated files, runner configuration, or archived/artifact copies of tests. Replace the complementary `coupleEvents` factory or change its behavior. Freeze production/browser time as a substitute for fixing setup anchoring.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Midnight crossing | Several offsets use an anchor captured before local midnight; clock advances during setup | Every date remains relative to the captured day | No error expected |
| Default call | Offset supplied without an anchor | Date remains relative to the current local day | No error expected |
| Local calendar | Late evening with a different UTC date, negative/zero/positive offsets | Local YYYY-MM-DD; input Date unchanged | No error expected |
| Calendar transitions | Month/year rollover, leap day, spring/fall DST | Calendar-day offsets agree with the existing anchored factory | No error expected |

</intent-contract>

## Code Map

- `tests/support/helpers/events.ts:177` — `isoDateDaysFromNow` currently creates and mutates a fresh Date; `seedEvent` at line 143 defaults to its one-argument form. Keep `formatDateISO` and deep imports.
- `tests/support/factories/events.ts:135` — read-only `eventDateFrom(anchor, dayOffset)` calendar implementation; `eventInsert` and `seedEvents` already propagate one anchor. `tests/support/fixtures/index.ts:130` owns the anchored `coupleEvents` fixture.
- `tests/api/events-wire-contract.spec.ts` — DE.5-API-005 four date offsets and five rows; DE.5-API-008 initial own/partner rows plus later cleanup witness; DE.5-API-006 accepted/refused label comparison. Preserve raw requests and tiebreak timestamps.
- `tests/e2e/home/events.spec.ts` — three affected setups: own/partner future and past rows, all-past pair, and eight-row cap test.
- `tests/e2e/settings/events-crud.spec.ts` — stale snapshot/order witness and past/future witness batches; initial add/edit test also captures related dates together.
- `tests/e2e/settings/events-persistence.spec.ts:231` — DE.5-E2E-005 creates three rows through the real form from independently captured dates.
- `vitest.config.ts` — unit discovery includes `tests/**/*.test.ts`; timezone is already `America/New_York`, allowing UTC and DST regressions to be detected. `playwright.config.ts` defines `api` and `chromium` projects with local Supabase setup.

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/helpers/events.ts` — add an optional `anchor: Date` defaulting to a new Date; calculate from a copy and document batch usage.
- [x] `tests/api/events-wire-contract.spec.ts` — capture one anchor in each repeated-date setup above and pass it to all related date calls; derive ordering timestamps from the captured instant where appropriate.
- [x] `tests/e2e/home/events.spec.ts` — capture one anchor for each of the three multi-row setups and pass it to every row's date helper.
- [x] `tests/e2e/settings/events-crud.spec.ts`, `tests/e2e/settings/events-persistence.spec.ts` — share one anchor per related setup described above, retaining existing form flows and expected dates.
- [x] `tests/unit/helpers/events.test.ts` — add deterministic clock-driven regression coverage for the matrix, including immutable anchors and compatibility with `eventDateFrom` using literal expected dates.

**Acceptance Criteria:**
- Given each affected API, Home, or Settings setup, when its dates are constructed, then every related call receives the same test-local anchor and its existing server/UI assertions still pass.
- Given a setup straddling midnight, when the real helper runs before and after the clock changes, then results retain the original anchor's calendar offsets and the anchor timestamp is unchanged.
- Given existing single-row callers and the anchored factory, when the focused tests and typecheck run, then both contracts remain supported without production or isolation changes.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass

- verdicts: 7 findings — high 0, medium 0, low 4, false 3, maybe-false 0
- findings:
  - `[low]` `[defer]` Blind hunter: retained time of day can disagree with the factory across Nuuk's late-evening DST gap — reproduced the March 27 example and confirmed identical arithmetic in the baseline. Record the existing issue in this spec's deferred list; the shared-clock change does not introduce it.
  - `[low]` `[reject]` Blind hunter: literal transition tests use only offsets of one day — true for that table; the midnight/local cases also cover two-day offsets and the API/Home suites exercise larger offsets. No large-offset defect was shown. Adding more test cases for an unlikely native-calendar regression provides negligible value beyond the existing boundary coverage.
  - `[low]` `[reject]` Blind hunter: no fake-client test exercises seedEvent's omitted eventDate — that pre-existing default is unchanged, all current seedEvent callers supply an explicit date, and the one-argument helper is covered across midnight. Adding fake-client plumbing for a path no current caller uses exceeds a direct correction and has negligible practical benefit here.
  - `[low]` `[reject]` Blind hunter: the deterministic midnight test does not execute the real API/Home/Settings setup callbacks — true; the helper is tested under a moving clock and all 32 related calls in ten setups were inspected to pass their shared anchor. Actual API/browser suites pass. Preventing a future accidental argument deletion during a midnight run would require additional setup instrumentation; that rare regression does not justify its complexity.
  - `[false]` `[reject]` Blind hunter: planned verification text lacks completed results — the reviewed spec was explicitly in-review and its command entries described expected outcomes. The workflow records execution counts and warnings at finalization below. This was interim workflow state, and a finding whose fix edits the build spec is rejected by review policy.
  - `[false]` `[reject]` Edge-case hunter: an Invalid Date anchor produces a database parsing error — every introduced anchor is constructed from the current clock, with no external input or mutation. No active caller can supply the proposed invalid value; the finding demonstrates no reachable failure requiring a new guard.
  - `[false]` `[reject]` Intent auditor: a stronger reading requires forced midnight inside actual setup flows — both readings describe identical required date behavior, so there is no unresolved observable intent difference. The implementation directly updates all affected setup surfaces, helper tests force midnight, and API/UI tests verify their results. Additional future-regression instrumentation is the low-priority coverage suggestion already assessed separately, not an intent gap.

The verification-gap reviewer found no verification gaps or other defects after inspecting discovery, callers, and the focused test results. No findings were grouped; no implementation patches were required.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/helpers/events.test.ts` — all midnight, local-date, transition, and compatibility cases pass.
- `npm run typecheck` and `npm run lint` — no errors; record existing warnings separately.
- `npx playwright test --project=api tests/api/events-wire-contract.spec.ts --workers=1` — all wire-contract tests pass against running local Supabase.
- `npx playwright test --project=chromium tests/e2e/home/events.spec.ts tests/e2e/settings/events-crud.spec.ts tests/e2e/settings/events-persistence.spec.ts --workers=1` — all affected Home/Settings tests pass.
- `git diff --check` and inspect all active helper callers — no whitespace errors, every repeated-date setup anchored, and protected files unchanged.

## Auto Run Result

Status: done

Implemented optional shared anchors for event-date setup and preserved one-argument calls. All 32 related helper calls across ten API, Home, and Settings setups use their test-local anchor. The helper copies its input, and the existing factory, production date handling, worker ownership, and cleanup are unchanged. DW-61, DW-64, and DW-69's independent-clock defect is resolved; the orchestrator owns ledger bookkeeping.

Files changed:

- `tests/support/helpers/events.ts` — optional anchor and batch-usage documentation.
- `tests/api/events-wire-contract.spec.ts` — shared anchors for ordering, outsider rows, and the accepted/refused label comparison.
- `tests/e2e/home/events.spec.ts` — shared anchors for the three multi-row setups.
- `tests/e2e/settings/events-crud.spec.ts` — shared anchors for related add/edit and witness dates.
- `tests/e2e/settings/events-persistence.spec.ts` — shared anchor for the three form-created rows.
- `tests/unit/helpers/events.test.ts` — 16 deterministic date regressions.
- This spec — planning, completed tasks, review triage, and verification evidence.

Review breakdown: 0 patches, 1 pre-existing low-severity issue deferred, and 6 rejected findings. Every rejection and its reason is recorded in the Review Triage Log. Follow-up review recommendation: false; patched entries were high 0, medium 0, low 0, with no new unverified risk requiring another review pass.

Verification completed by both implementation and parent sessions:

- `npm run test:unit -- tests/unit/helpers/events.test.ts` — 1 file, 16 tests passed.
- `npm run typecheck` — passed, no errors.
- `npm run lint` — passed, 0 errors; 3 existing Fast Refresh warnings at `src/components/RelationshipTimers/EventCountdown.tsx:68`, `:91`, and `:132`.
- `npx playwright test --project=api tests/api/events-wire-contract.spec.ts --workers=1` — 5 tests passed against local Supabase.
- `npx playwright test --project=chromium tests/e2e/home/events.spec.ts tests/e2e/settings/events-crud.spec.ts tests/e2e/settings/events-persistence.spec.ts --workers=1` — 17 tests passed against local Supabase and Vite.
- `git diff --check` and `git diff --cached --check` — passed. Caller inspection confirmed all repeated-date setups share their anchor and remaining one-argument calls belong to single-row tests or the preserved seed default.

Matrix audit: all four rows are covered by executed, passing tests. The midnight batch and default-current-day cases each have one test, local-versus-UTC behavior has three cases, and calendar transitions have eleven cases covering month/year boundaries, leap day, and both DST directions. Every explicit-anchor case checks immutability; local/transition cases also compare against literal dates and the preserved factory.

Residual risks: the pre-existing Nuuk DST issue is recorded above. Browser runs emitted existing React state-update-before-mount and PostCSS warnings without test failures; Vitest emitted its existing future-native-config warning. No production build was needed for these test-only changes. The deferred-work ledger was neither edited nor staged, and no push was performed.
