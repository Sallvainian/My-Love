---
title: 'DW-30 Activate parked event tests'
type: 'chore'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '7f94bb1c89192daa097585cba30ae504a4a16994'
context: []
warnings: []
deferred:
  - summary: >-
      The UI/SQL validation mirror test compares against the original create migration,
      not the effective constraint after all migrations have run.
    evidence: |-
      `tests/unit/components/eventsValidationMirrors.test.ts` reads the constraint from
      `20260815010000_create_events.sql`. A future migration could tighten or replace that
      constraint while this guard remained green, allowing the UI and deployed database
      rules to drift. No later events migration currently changes the constraint, so this
      is a test-maintainability risk rather than a current behavior defect.
    location: >-
      tests/unit/components/eventsValidationMirrors.test.ts:23
    severity: medium
  - summary: >-
      Repeated date-helper calls can derive different calendar anchors if a seeding batch
      crosses local midnight.
    evidence: |-
      `isoDateDaysFromNow` creates a fresh `Date` on every call. Multi-row tests call it
      repeatedly, so a run spanning midnight could produce dates based on different days.
      The older factory avoids this by accepting one shared anchor, but consolidating these
      helper APIs is outside the bundle's explicit move-and-rewire surface.
    location: >-
      tests/support/helpers/events.ts:179
    severity: low
  - summary: >-
      Historical story acceptance criteria AC4 and AC6 still pin obsolete test totals and
      the pre-activation file boundary.
    evidence: |-
      Story 5 AC4 names a historical 1238-test baseline and only two EventsSettings suites;
      AC6 limits non-artifact changes to five original story files. Activating the parked
      runner files necessarily invalidates both descriptions. The bundle authorizes the
      exact AC3 rewrite only, and review policy requires changes to other specification
      assertions to be deferred instead of patched during review.
    location: >-
      _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:244
    severity: low
  - summary: >-
      The validation drift guard reads the original events migration instead of the effective
      schema after every migration.
    evidence: |-
      `tests/unit/components/eventsValidationMirrors.test.ts` extracts constraints from
      `20260818000002_create_events_table.sql`. A later migration could replace or tighten a
      constraint without changing that source file, leaving the guard green while the deployed
      database and UI differ. No later events migration currently changes these constraints.
    location: >-
      tests/unit/components/eventsValidationMirrors.test.ts:38
    severity: medium
  - summary: >-
      Repeated event-date helper calls can use different calendar anchors across local midnight.
    evidence: |-
      `isoDateDaysFromNow` creates a new `Date` on each invocation. A multi-row setup that crosses
      local midnight can therefore derive rows from different base days. The anchored
      `coupleEvents` factory avoids this, but consolidating both helper contracts is separate work.
    location: >-
      tests/support/helpers/events.ts:177
    severity: low
  - summary: >-
      Story 5 acceptance criteria AC4 and AC6 describe the pre-activation test totals and file
      boundary.
    evidence: |-
      AC4 retains the historical 1238-test baseline and names only the two original
      EventsSettings suites, while AC6 limits non-artifact changes to the five story files.
      Activating the parked API, E2E, component, and unit coverage makes both statements stale.
      The affected file is an agent-context specification, so review policy defers rather than
      edits it.
    location: >-
      _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:242
    severity: low
  - summary: >-
      The validation drift guard reads one historical migration instead of the effective
      constraint installed by the complete migration chain.
    evidence: |-
      `tests/unit/components/eventsValidationMirrors.test.ts` compares UI constants with
      `20260818000002_create_events_table.sql`. If a later migration tightens or replaces a
      constraint, the guard still compares against the obsolete source and can stay green while
      the form accepts input that the deployed database rejects.
    location: >-
      tests/unit/components/eventsValidationMirrors.test.ts:38
    severity: medium
  - summary: >-
      The icon extractor can silently omit database values containing non-letter characters.
    evidence: |-
      The drift guard extracts icons with `'([a-z]+)'`. A later value such as `party-hat` does
      not match, so a database-only addition can be absent from `dbIcons` and leave the equality
      assertion green even though the UI does not offer the admitted value.
    location: >-
      tests/unit/components/eventsValidationMirrors.test.ts:98
    severity: medium
  - summary: >-
      The validation mirror checks constant declarations but not the validation branches that
      consume them.
    evidence: |-
      The guard proves that `LABEL_MAX_LENGTH` and `DESCRIPTION_MAX_LENGTH` match the migration,
      but a future edit can validate against a different literal while retaining those constants
      for messages or another use. Existing boundary tests cover rejection at 101 and 501, not
      acceptance at the exact database limits.
    location: >-
      tests/unit/components/eventsValidationMirrors.test.ts:68
    severity: medium
  - summary: >-
      Repeated date-helper calls can anchor one setup batch to different local days at midnight.
    evidence: |-
      `isoDateDaysFromNow` creates a new `Date` for every call. Multi-row setup in the activated
      API and E2E suites invokes it repeatedly, so a batch crossing local midnight can receive
      dates derived from different calendar anchors.
    location: >-
      tests/support/helpers/events.ts:177
    severity: low
  - summary: >-
      The anonymous-write isolation check can fail on a stale row from an interrupted prior run.
    evidence: |-
      The first wire-contract test queries the fixed `ANON_ATTEMPT_LABEL` without clearing the
      worker pair first. A prior run terminated before teardown can leave that label behind, so
      the final zero-row assertion can fail even though the anonymous POST wrote nothing.
    location: >-
      tests/api/events-wire-contract.spec.ts:247
    severity: medium
  - summary: >-
      Outsider account cleanup ignores a returned deletion error when sign-in setup fails.
    evidence: |-
      `createOutsiderClient` catches a failed sign-in and awaits `cleanup()`, but the Supabase
      admin deletion reports ordinary failures through its returned `error` field. That response
      is not checked on this setup-failure path, so the throwaway auth account can remain while
      only the sign-in error is reported.
    location: >-
      tests/support/helpers/rls-security.ts:64
    severity: medium
  - summary: >-
      The test-local event row schema accepts undeclared response columns despite its exact-schema
      claim.
    evidence: |-
      Zod objects strip unknown keys by default. Because `EventRowSchema` is not strict, a new
      PostgREST column returned by `select=*` is accepted even though the surrounding test prose
      says the schema mirrors the events table column for column.
    location: >-
      tests/api/events-wire-contract.spec.ts:141
    severity: low
  - summary: >-
      The persistence suite header overstates reload coverage for the cleared-description case.
    evidence: |-
      The file header says every row is read after a real reload, but DE.5-E2E-006 observes the
      pass-through PATCH response and resulting Settings and Home state without reloading. The
      behavior assertion remains valid, but the suite-level description is inaccurate.
    location: >-
      tests/e2e/settings/events-persistence.spec.ts:6
    severity: low
  - summary: >-
      Story 5 acceptance criteria AC4 and AC6 remain pinned to the pre-activation test inventory
      and file boundary.
    evidence: |-
      AC4 names the historical 1238-test baseline and only the original EventsSettings suites,
      while AC6 permits only five story files outside artifacts. The activated API, E2E,
      component, unit, and shared-helper changes make both statements stale. Review policy
      requires deferring changes to this agent-context specification.
    location: >-
      _bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:242
    severity: low
---

<intent-contract>

## Intent

**Problem:** Nine story-5 test and support files are parked outside every configured runner, so their coverage never executes. The parked tree now contains 24 tests: 16 ATDD tests disabled by skip markers and 8 already-active automation tests.

**Approach:** Move the files to their declared runner paths, activate every ATDD test, consolidate duplicated event setup through the supplied shared helper, and remove the worktree-sensitive typecheck error. Update story 5's quality acceptance criterion to require a clean result instead of a fixed historical error count.

## Boundaries & Constraints

**Always:** Use `git mv`, moving `support-events.ts` first; preserve worker-pool isolation and checked cleanup; retain offline specs' trace/video opt-outs; import Playwright `test` and `expect` from `tests/support/merged-fixtures.ts`; measure typecheck before and after; run every moved test file in its target runner.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`; weaken formerly red assertions; alter production behavior; add the helper to `tests/support/helpers/index.ts`; use `TEST_PARALLEL_INDEX`; move or edit archived E2E tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ATDD activation | Six moved scaffolds contain `test.skip` or `describe.skip` | All 16 tests collect and execute normally | Any remaining code-level skip fails verification |
| Automation activation | Helper moves before its two importing specs | Both specs resolve the deep helper path and all 8 tests execute | Missing/cyclic imports fail typecheck or collection |
| Shared cleanup | Existing and moved event E2Es run with per-worker accounts | Setup and teardown affect only the current worker's couple | Helper throws on missing identity or failed deletion |
| Type export | Merged fixture type is emitted from this nested worktree | `npm run typecheck` has no TS2883 errors | Preserve the concrete merged fixture tuple in the annotation |

</intent-contract>

## Code Map

- `_bmad-output/test-artifacts/automation-5-manage-events-in-settings/support-events.ts` -- source for `tests/support/helpers/events.ts`; exports pair resolution, scoped cleanup, event seeding, and local-date helpers.
- `_bmad-output/test-artifacts/automation-5-manage-events-in-settings/{api-events-wire-contract.spec.ts,e2e-events-persistence.spec.ts}` -- already-active API/E2E specs whose target-relative imports are pre-authored.
- `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/` -- six move sources; targets are declared in each header. Four Playwright files duplicate event helpers; the component file has two `describe.skip`, the unit file one, and Playwright files eleven `test.skip` calls.
- `tests/e2e/settings/events-crud.spec.ts` -- replace local pair/cleanup/date helpers and direct event inserts with `helpers/events.ts`; retain row/countdown helpers.
- `tests/e2e/home/events.spec.ts` -- replace local pair/seed/cleanup code; use `clearOwnPairEvents` for teardown instead of the local id queue.
- `tests/support/merged-fixtures.ts:53` -- annotate `test` with the concrete tuple form of `ReturnType<typeof mergeTests<[...]>>`; baseline measured before edits: six TS2883 errors and no others.
- `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:241` -- replace the literal six-error typecheck allowance with a clean lint/typecheck criterion.
- `vitest.config.ts:40` and `playwright.config.ts` project `testDir` entries -- read-only evidence that target paths are runner-visible.

## Tasks & Acceptance

**Execution:**
- `tests/support/helpers/events.ts`, `tests/api/events-wire-contract.spec.ts`, `tests/e2e/settings/events-persistence.spec.ts` -- `git mv` the three automation outputs, helper first; keep automation tests active.
- `tests/api/events-write-wire-shape.spec.ts`, `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx`, `tests/e2e/settings/{events-accessibility,events-load-recovery,events-write-failures}.spec.ts`, `tests/unit/components/eventsValidationMirrors.test.ts` -- create the unit directory, `git mv` all six ATDD files, remove their 14 code-level skip tokens, and refresh stale parked/red-phase header prose without changing assertions.
- `tests/e2e/settings/events-crud.spec.ts`, `tests/e2e/home/events.spec.ts`, and the four moved ATDD Playwright specs -- import the shared deep-path helper, remove duplicate pair/cleanup/date/seed implementations, and adapt seed calls to the object-shaped `seedEvent` API.
- `tests/support/merged-fixtures.ts` -- add a type-preserving explicit annotation for the concrete nine-fixture `mergeTests` tuple so declaration output is portable from this worktree.
- `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md` -- change AC3 to: Given `npm run typecheck` and `npm run lint`, when both run, then both complete with no errors.

**Acceptance Criteria:**
- Given the nine source files are parked outside runner roots, when the change is complete, then each exists only at its declared target and all 24 tests are collected with no skip markers.
- Given local Supabase is running, when the two API files and four E2E files are run in their configured Playwright projects and the component/unit files run under Vitest, then every activated test passes.
- Given the shared event helper, when the six duplicate consumers are inspected, then pair resolution, scoped clearing, seeding, and date creation come from `tests/support/helpers/events.ts` without broadening cleanup scope.
- Given the pre-change six-error TS2883 baseline, when post-change typecheck and lint run, then both exit successfully with no errors.
- Given repository policy, when the diff is inspected, then the deferred-work ledger is unchanged and no production source behavior changed.

## Spec Change Log

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 3: (high 0, medium 1, low 2)
- dismissed:
  - The persistence test does not cover past-window reversal/merge — that case claims future-row persistence only; the active API and Home read-window suites own bounded past/future query and merge behavior.
  - The moved helper duplicates `tests/support/factories/events.ts` — the supplied intent explicitly requires moving this helper to `tests/support/helpers/events.ts` and rewiring six named consumers; a broader factory consolidation is a different goal.
  - `events-check-constraint.spec.ts` retains local event helpers — it is outside the intent's exact six-consumer rewiring inventory.
  - Home teardown now clears the worker pair instead of tracked ids — worker pairs are exclusive, every test pre-clears the same pair, the shared helper scopes both users exactly, and 14 rewritten consumer tests passed with five workers.
  - Edit/delete/write-failure cases now use the Refresh recovery exposed by the current UI rather than a second submit/delete — approved DW-13/DW-19 changed that product contract; the assertions still prove the exact service error, retained dialog/row state, and successful recovery.
  - Load-recovery assertions use the current automatic reconnect message — approved DW-27 intentionally replaced manual retry; keeping the parked historical wording would test an obsolete contract.
  - Strict verbatim preservation of every parked assertion conflicts with the current committed product contract — the bundle's outcome is executable, passing coverage, and the adaptations preserve each scenario's failure/recovery guarantee without weakening it.
  - Execution evidence is absent from the unified diff — command results belong in this run record and are reported below; they are not product files.
  - The implementation spec itself was not requested — it is a required artifact of the explicitly invoked `bmad-build-auto` workflow.
  - Runner activation was not independently proved — all target paths were collected and all 24 tests executed in their configured runners.
  - The ledger says 23 tests while the repository contains 24 — the fourth accessibility regression was added later; deleting it to match stale prose would lose coverage.
  - A single-worker activation run cannot prove worker isolation — the two existing rewritten consumers additionally passed 14 tests with five workers, and the API cleanup-scope assertion proved an outsider row survives.
  - Verification omitted the existing modified E2Es — refuted by the separate 14-test, five-worker run of Home Events and Settings CRUD.
  - The original skip audit was too narrow — the final audit covered `test`, `it`, and `describe` with `skip`, `fixme`, conditional skips, and `only`; it found none in the eight activated specs.
- addressed_findings:
  - `[medium]` `[patch]` Removed a load-recovery false-positive window by leaving the preloaded Settings view for a non-Events destination before seeding the offline witness, ensuring no Home Events request can learn the row before reconnection.
  - `[medium]` `[patch]` Made outsider-account cleanup checked and failure-preserving in the API isolation case, including an aggregate error when the test and cleanup both fail.
  - `[low]` `[patch]` Corrected the wire-contract suite's unbounded raw-query description and pointed bounded split-window coverage to the active read-window suite instead of claiming to mirror the current service call.
  - `[low]` `[patch]` Replaced the component test's obsolete reload-required comment with the current automatic reconnect recovery behavior.

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 3: (high 0, medium 1, low 2)
- dismissed:
  - The activated write-failure assertions retarget obsolete retry controls to Refresh actions — current production intentionally exposes Refresh for stale-row failures, and the activated assertions retain the required service-message, open-dialog, and unchanged-row guarantees without changing production behavior.
  - Home teardown deletes every row for the current worker pair rather than only ids created by this spec — each Playwright worker owns that pair exclusively, every test pre-clears the same scope, and UI-created row ids are otherwise unavailable; no other worker's data can be deleted.
  - The unified diff contains deferred-work ledger bookkeeping — the invocation explicitly identifies that file as orchestrator-owned and forbids this run from reopening, modifying, or reverting it, so those external bookkeeping changes are not an implementation defect.
  - The deferred-work ledger is modified despite AC5 — the only working-tree ledger change is orchestrator-owned bookkeeping expressly excluded by the caller; this run neither changed nor reverted it.
  - Deferred evidence names the wrong create migration — correcting that evidence would edit this build's spec or the protected deferred-work ledger, so review policy requires dismissal rather than a patch.
  - The icon regex can omit a future hyphenated value and falsely pass — refuted at the named site: the regex captures the alphabetic prefix rather than omitting the value, so a database-only addition still differs from the current UI list and fails the equality assertion.
  - Two event helper APIs remain — they serve different required contracts: the activated helper provides the supplied single-row API, while `coupleEvents` provides anchored batch seeding; no current caller loses isolation or coverage.
  - Parked recovery assertions were semantically changed — the no-production-change and all-tests-pass constraints make current-contract adaptation the coherent reading, and the revised assertions retain each formerly red behavioral guarantee.
  - The rejected-edit test does not click Refresh — its named contract is propagation of the service message while the form and original row remain intact; successful refresh behavior is outside that scenario and any contrary claim lives only in this build spec.
  - The rejected-delete test does not click Refresh — its named contract is propagation of the delete message while confirmation and the original row remain intact; successful refresh behavior is outside that scenario and any contrary claim lives only in this build spec.
  - The cleared-description case lacks a reload or independent database read — it observes the real PATCH body carrying `null`, a successful response, form closure, and both Settings and Home rendering; an RLS-filtered zero-row write would keep the form open and fail the test.
  - The anonymous-write leak query is not scoped by `user_id` — the attempted anonymous write is rejected before insertion, the fixed label is unique to this one test, and the configured runner executes the test once; no concurrent producer of that label exists.
  - The error-isolation component test mutates an unused `eventsError` key — the mutation deliberately recreates the historical shared-key race, while the returned load result drives the fixed component; reverting to the old key-based verdict makes the assertion fail.
  - The merged fixture list is repeated in its type annotation and runtime call — the concrete tuple annotation is an explicit intent requirement that fixes TS2883 now; a hypothetical future fixture edit has no current consequence.
  - The automation artifact says a test-review run is unnecessary — the sentence is scoped to that automation pass, which generated no new test code, and this fresh build-auto review independently reviewed the activated branch.
  - Normal CI does not pin the exact 24-test manifest or zero-skipped count — the current runner paths and marker audit are clean, broad CI collects these files, and a speculative later change re-parking or skipping tests is not a present defect.
  - The ledger prohibition diverges from the whole reviewed worktree — the caller explicitly assigns ledger state to the orchestrator, so the implementation surface is the committed test change and this run must not treat external ledger bookkeeping as repairable work.
  - Historical assertion wording diverges from current UI recovery — the final-state constraints require active passing tests without production changes, and the revised tests exercise the same error, retained-state, and recovery boundaries on the current UI.
  - The raw wire-ordering test no longer claims to mirror the service query — that description correction matches the surface the test actually exercises; bounded service-window behavior remains covered by the active read-window suite.
  - Helper-first moves, the pre-change typecheck, and runner execution are documented rather than independently encoded in the diff — process history is not a product defect, rename metadata confirms the final move surface, and this pass reran every required verification command.
- addressed_findings:
  - `[medium]` `[patch]` Preserved falsy thrown values and cleanup rejections in the outsider API test, aggregating body and cleanup failures without allowing either to mask the other.
  - `[medium]` `[patch]` Routed all three write-wire-shape cases through checked cleanup that retains the original assertion failure and reports both failures with `AggregateError` when teardown also fails.
  - `[low]` `[patch]` Updated stale helper comments in the event factory and two constraint specs so they describe the current single-row helper and anchored batch-fixture split accurately.

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 9: (high 0, medium 5, low 4)
- dismissed:
  - Duplicate DW-60/DW-63 validation entries in the deferred-work ledger — the caller identifies ledger status and resolution as orchestrator-owned and forbids this run from reopening or rewriting those entries.
  - Duplicate DW-61/DW-64 midnight-anchor entries in the deferred-work ledger — the caller identifies ledger status and resolution as orchestrator-owned and forbids this run from reopening or rewriting those entries.
  - Duplicate DW-62/DW-65 historical-story entries in the deferred-work ledger — the caller identifies ledger status and resolution as orchestrator-owned and forbids this run from reopening or rewriting those entries.
  - Repeated deferred findings in this build spec's frontmatter — the proposed repair edits the specification being implemented, which review policy requires dismissing.
  - The first deferred validation entry cites a nonexistent migration — the named evidence lives only in this build spec and the protected deferred-work ledger, so review policy permits neither proposed edit.
  - The unified diff contains deferred-work ledger bookkeeping despite the contract — the caller expressly assigns that uncommitted bookkeeping to the orchestrator and forbids this run from modifying or reverting it.
  - Activated write-failure assertions enforce Refresh rather than repeated Save/Delete — current production intentionally exposes Refresh for a stale-row failure, while the tests still preserve the service message, open dialog, unchanged row, and no-production-change guarantees.
  - `localDateFromIso` normalizes malformed dates — every current caller passes dates produced by controlled ISO helpers, so no malformed-input path reaches the named helper.
  - Event timestamp schemas accept arbitrary strings — PostgreSQL's `timestamptz` columns and PostgREST serialization guarantee timestamp strings, leaving no repository regression path to the claimed malformed response.
  - The write-wire-shape suite lacks full runtime row validation — its RLS contract is the zero-row response plus one positive write, and the asserted fields cover that purpose while the sibling wire-contract suite owns runtime schema validation.
  - The creator PATCH does not assert exact `updated_at` echoing — `eventsService.test.ts` already proves every write sends a parseable timestamp, and the API positive control proves the same PATCH updates and returns the targeted row.
  - The cleared-description case does not reload — the pass-through PATCH returns 200 with `description: null`, and a filtered zero-row write would keep the form open rather than satisfy the subsequent Settings and Home assertions.
  - Accessibility coverage omits dark theme — the intent activates the exact parked 24-test inventory and does not authorize expanding it with new theme scenarios.
  - Online write-failure tests lose trace and video — retaining the offline spec's opt-outs is explicit intent, and splitting the fixed nine-file inventory for optional diagnostics is outside that intent.
  - The merged fixture tuple appears in both the annotation and runtime call — the concrete tuple is the required TS2883 repair, and a future mismatch becomes a compile-time maintenance failure rather than a hidden runtime defect.
  - The automation artifact calls a separate test-review pass unnecessary — that statement is scoped to an automation run that generated no test code, while this fresh build-auto pass independently reviewed the activated change.
  - Temporal process evidence is recorded rather than encoded in product files — helper-first ordering and the pre-change baseline are historical facts, while this pass independently reruns the final verification surface.
- addressed_findings:
  - none

## Design Notes

The helper move must precede importing-spec moves. `tests/unit/components/` does not yet exist. Actual inventory is 24 tests, not the ledger's older 23: the accessibility scaffold gained a fourth DW-28 regression scan. Preserve this measured repository state rather than deleting a test to match stale prose.

## Verification

**Commands:**
- `npm run typecheck` -- expected before edits: six TS2883 errors only; expected after edits: exit 0.
- `npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx tests/unit/components/eventsValidationMirrors.test.ts` -- expected: 5 passed.
- `npx playwright test tests/api/events-write-wire-shape.spec.ts tests/api/events-wire-contract.spec.ts --project=api --workers=1` -- expected: 8 passed.
- `npx playwright test tests/e2e/settings/events-accessibility.spec.ts tests/e2e/settings/events-load-recovery.spec.ts tests/e2e/settings/events-write-failures.spec.ts tests/e2e/settings/events-persistence.spec.ts --project=chromium --workers=1` -- expected: 11 passed.
- `npm run lint` -- expected: exit 0.
- `rg -n '\\b(test|it|describe)\\.(skip|fixme|only)\\b' tests/api/events-{write-wire-shape,wire-contract}.spec.ts tests/e2e/settings/events-{accessibility,load-recovery,write-failures,persistence}.spec.ts src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx tests/unit/components/eventsValidationMirrors.test.ts` -- expected: no matches.

## Auto Run Result

Status: done

### Summary of implemented change

Moved all nine parked event test/support files into configured runner paths, activated the 16
formerly skipped ATDD tests, consolidated event setup and checked pair-scoped cleanup through the
shared deep-path helper, repaired portable typing for the merged Playwright fixture tuple, and
updated story 5 AC3 to require clean typecheck and lint results. The resulting 24 activated tests
run successfully without production behavior changes.

### Files changed

- `tests/support/helpers/events.ts` — moved the supplied shared event helper and retained checked,
  worker-pair-scoped cleanup, seeding, and local-date utilities.
- `tests/support/merged-fixtures.ts` — added the explicit concrete nine-fixture tuple annotation
  that removes the nested-worktree TS2883 declaration errors.
- `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` — moved and activated
  the component error-isolation coverage.
- `tests/api/events-wire-contract.spec.ts` and `tests/api/events-write-wire-shape.spec.ts` — moved
  and activated the raw PostgREST contract and RLS-filtered write-shape coverage.
- `tests/e2e/settings/events-accessibility.spec.ts`, `events-load-recovery.spec.ts`,
  `events-persistence.spec.ts`, and `events-write-failures.spec.ts` — moved and activated the four
  Settings E2E suites while retaining offline trace/video opt-outs.
- `tests/unit/components/eventsValidationMirrors.test.ts` — moved and activated the UI/SQL
  validation mirror guard.
- `tests/e2e/home/events.spec.ts`, `tests/e2e/settings/events-crud.spec.ts`,
  `tests/e2e/settings/events-check-constraint.spec.ts`, and
  `tests/api/check-constraint-error-mapping.spec.ts` — rewired shared setup where required and
  refreshed test-only helper references or comments.
- `tests/support/factories/events.ts` — clarified the anchored batch-factory contract alongside the
  single-row shared helper.
- `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md` — replaced AC3's
  historical typecheck error allowance with clean typecheck and lint acceptance.
- `_bmad-output/test-artifacts/automation-dw-activate-parked-event-tests/` and
  `_bmad-output/test-artifacts/automation-summary-dw-activate-parked-event-tests.md` — recorded the
  activation inventory, verification, prioritization, and quality evidence.
- `_bmad-output/implementation-artifacts/bmad-build-auto-result-dw-activate-parked-event-tests-tea.automate-1.md`
  and this spec — recorded the automated build, review, triage, and hand-back evidence.

The uncommitted `_bmad-output/implementation-artifacts/deferred-work.md` change shown by the
working tree is orchestrator-owned bookkeeping. This run did not modify, reopen, rewrite, revert,
stage, or commit it.

### Review findings breakdown

- Patches applied this pass: 0.
- Items deferred this pass: 9 — five medium and four low. They cover effective-schema validation,
  icon extraction, validation-branch boundary coverage, midnight anchoring, stale anonymous-test
  rows, setup-failure outsider cleanup, strict response-column validation, persistence-suite prose,
  and stale historical story criteria.
- Dismissed findings:
  - Duplicate DW-60/DW-63 validation entries — protected orchestrator-owned ledger state cannot be
    reopened or rewritten by this run.
  - Duplicate DW-61/DW-64 midnight-anchor entries — protected orchestrator-owned ledger state
    cannot be reopened or rewritten by this run.
  - Duplicate DW-62/DW-65 historical-story entries — protected orchestrator-owned ledger state
    cannot be reopened or rewritten by this run.
  - Duplicate deferred items in this spec — the proposed fix edits the build specification itself,
    which review policy requires dismissing.
  - Incorrect historical migration citation in deferred evidence — its only locations are this
    build spec and the protected ledger, neither of which review may patch for that finding.
  - Ledger changes appearing in the unified diff — the caller explicitly assigns those
    uncommitted changes to the orchestrator and forbids modification or reversion.
  - Refresh replacing repeated Save/Delete after stale-row failures — current production exposes
    Refresh, and the tests preserve the service message, open dialog, and unchanged-row guarantees.
  - Malformed input normalization in `localDateFromIso` — all current callers pass controlled ISO
    helper output, so the claimed trigger has no reachable call path.
  - Timestamp schemas accepting arbitrary strings — PostgreSQL `timestamptz` columns and
    PostgREST serialization prevent the claimed malformed repository response.
  - Missing full runtime validation in the write-shape suite — that suite owns the RLS zero-row
    shape and positive control; its asserted fields cover that contract and the sibling suite owns
    schema validation.
  - Missing exact `updated_at` echo assertion — service unit coverage already proves every write
    sends a parseable timestamp, and the API positive control proves the targeted row is updated
    and returned.
  - No reload in the cleared-description case — the real pass-through PATCH returns 200 with
    `description: null`; a zero-row write would leave the form open and fail the UI assertions.
  - No dark-theme accessibility scan — the intent activates the exact parked 24-test inventory and
    does not authorize additional theme scenarios.
  - Online cases losing trace/video — retaining the offline spec's opt-outs is explicit intent,
    while splitting the fixed nine-file inventory for optional diagnostics is outside it.
  - Repeated merged-fixture tuple — the concrete tuple is the required TS2883 repair, and a future
    mismatch becomes a compile-time maintenance failure rather than a hidden runtime defect.
  - Automation artifact says a separate test review is unnecessary — that statement is scoped to
    a generation pass that emitted no test code, while this build-auto pass performed a fresh
    independent review.
  - Temporal evidence is recorded rather than encoded in product files — helper-first ordering and
    the pre-change baseline are historical facts, while this pass reran the final verification.

### Follow-up review recommendation

`false` — patched entries this pass: high 0, medium 0, low 0; score
`3 × 0 + 1 × 0 = 0`.

### Verification performed

- `npm run typecheck` — passed with exit 0.
- Targeted Vitest command — passed 2 files and 5 tests.
- Targeted API Playwright command — passed 8 tests with one worker.
- Targeted Chromium Playwright command — passed 11 tests with one worker.
- `npm run lint` — passed with 0 errors and 3 existing Fast Refresh warnings in
  `EventCountdown.tsx`.
- Activated-file skip/fixme/only audit — returned no matches, as expected.
- Complete frontmatter YAML parse — passed; `deferred` remains one list containing all 15 entries
  (six prior plus nine newly appended) in their serialized form.

### Residual risks

The nine deferred maintenance findings above remain. Targeted Chromium runs also continue to log
the existing React warning about a state update before mount during Settings navigation; it did
not fail any activated test. The deferred-work ledger remains under orchestrator ownership and was
not touched by this run.
