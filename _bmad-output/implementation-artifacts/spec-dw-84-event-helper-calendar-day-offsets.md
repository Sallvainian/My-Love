---
title: 'DW-84 Event helper calendar-day offsets'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '8abeb6a2da4d61245864e1674ca7b0de946e4e94'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `isoDateDaysFromNow` preserves the anchor's time of day while adding days. In America/Nuuk, local March 27, 2026 at 23:30 plus one day lands in a skipped DST hour and returns March 29 instead of March 28 (DW-84).

**Approach:** Calculate offsets from the anchor's local calendar components, preserving the helper's contracts. Add deterministic coverage of the reproduced gap in an isolated timezone context while retaining the existing regression cases.

## Boundaries & Constraints

**Always:** Return local `YYYY-MM-DD` through the existing `formatDateISO`. Leave the supplied anchor unchanged. Preserve optional-anchor and one-argument calls. Keep the complementary `eventDateFrom` factory unchanged and verify agreement with literal expected dates. Run the Nuuk regression without changing the parent test process's timezone.

**Never:** Edit production code, runner configuration, the deferred-work ledger, archived tests, existing artifact copies, or the complementary factory. Add dependencies or broaden this into general date validation or timezone infrastructure. The orchestrator records ledger resolution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Late-evening DST gap | America/Nuuk local 2026-03-27 23:30, offset +1 | Helper and factory both return `2026-03-28`; anchor unchanged | No error expected |
| Gap-adjacent offsets | Same anchor, negative, zero and multi-day positive offsets | Literal local calendar dates; helper agrees with factory; anchor unchanged | No error expected |
| Midnight crossing | Fixed anchor before midnight; clock advances | Explicit-anchor calls keep the captured day; one-argument calls follow the current local day | No error expected |
| Existing calendar boundaries | New York late evening, month/year changes, leap day, spring/fall DST | Existing literal date and factory-agreement assertions keep passing | No error expected |

</intent-contract>

## Code Map

- `tests/support/helpers/events.ts:179` — `isoDateDaysFromNow(dayOffset, anchor = new Date())` currently copies the full timestamp and calls `setDate`. Change only its calendar calculation and any directly relevant explanation. `seedEvent` retains its default one-argument call.
- `tests/unit/helpers/events.test.ts` — 16 existing unit cases cover midnight, default calls, local versus UTC dates, immutability, transitions, and agreement with the factory. Add the Nuuk regression here without replacing them.
- `tests/support/factories/events.ts:135` — read-only `eventDateFrom` already constructs a Date from local year, month, and day plus offset; reference behavior for this correction.
- `src/utils/dateUtils.ts:142` — read-only `formatDateISO` formats local components; preserve its use.
- `vitest.config.ts` — read-only: unit discovery already includes the target file and pins America/New_York. Use a child Node process with its own `TZ` instead of mutating shared environment or changing the runner.
- `package.json` — read-only: Node 24 environment and existing `tsx` dependency support loading the actual TypeScript modules in a child process. Imports in the helper/factory have no database side effects; `worker-pool.ts` reads the OS only when its functions run.
- `_bmad-output/implementation-artifacts/spec-dw-61-64-69-event-test-date-anchors.md` — read-only predecessor records the exact pre-existing Nuuk failure. No edits to that spec or copied tests.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/helpers/events.test.ts` — add isolated Nuuk cases that execute the actual helper and factory exports, assert literal expected dates and anchor immutability, and verify that the intended timezone/gap is active. Demonstrate failure with the original helper before fixing it.
- [x] `tests/support/helpers/events.ts` — derive the target day from local calendar components without carrying the anchor's hours/minutes; retain formatting and function signature.
- [x] `tests/unit/helpers/events.test.ts` — run all existing and new cases, then typecheck and lint; inspect the diff for protected-file changes.

**Acceptance Criteria:**
- Given the reproduced Nuuk anchor, when the real helper calculates the requested offsets in an isolated timezone process, then its returned strings match literal calendar dates and the existing factory while the anchor timestamp remains unchanged.
- Given the existing helper regression suite, when it runs with the new case, then midnight/default-call behavior and all calendar-transition cases pass with the existing runner configuration.
- Given the completed bundle, when the diff is inspected, then implementation changes are limited to the helper and its unit tests, with only this new workflow spec added and all protected files unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass

- verdicts: 7 findings — high 0, medium 0, low 7, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: years 0–99 are remapped by the component constructor — reproduced year 99 returning `1999-01-16`, matching the unchanged factory. All active setup anchors use the current clock, and unit anchors use 2024/2026. Supporting ancient dates would require additional construction logic for a scenario outside everyday use; reject under the negligible-impact rule.
  - `[low]` `[patch]` Blind hunter: child imports depend on the runner's working directory — reproduced all five Nuuk cases failing to resolve `tsx` when Vitest starts in `/tmp` with the worktree supplied through `--root`. Set the child's `cwd` from `import.meta.dirname`; all 21 tests now pass from both locations.
  - `[low]` `[reject]` Blind hunter: the negative Nuuk case does not cross the gap backward — the coverage observation is correct, but the helper has no direction-specific branch, existing tests exercise negative offsets, and an additional execution of March 29 at 23:30 minus one day returned `2026-03-28` from both helper and factory. Adding another anchor parameterization for a hypothetical direction-specific regression offers negligible benefit over the retained coverage and demonstrated forward failure.
  - `[low]` `[reject]` Blind hunter: five child processes repeat startup and timezone checks — measured the complete focused suite's test execution at 379 ms after patching, with every offset independently reported. Batching adds loop/diagnostic plumbing to save a fraction of a second; no everyday performance problem warrants that complexity.
  - `[low]` `[reject]` Edge-case hunter: a year 0–99 anchor changes centuries, including offset zero — same verified native constructor behavior as the first finding, before grouping. No active caller supplies ancient years, and special construction logic would add complexity for negligible practical benefit.
  - `[low]` `[reject]` Edge-case hunter: the minimum valid Date can normalize to an unrepresentable local midnight — reproduced `NaN-NaN-NaN` for offset zero in New York, also produced by the preserved factory. Current-clock callers and 2024/2026 test anchors cannot encounter the Date range limit; adding a guard and new error contract is disproportionate.
  - `[low]` `[patch]` Edge-case hunter: inherited child working directory breaks module resolution outside the repository — same reproduced defect as the blind hunter's working-directory finding; grouped into one patch and verified from `/tmp` after the correction.

The verification-gap reviewer reported no gaps. The intent auditor found all readings compatible and no substantive divergence between the requested helper API and the implementation/test surfaces. Its observation that a diff alone cannot prove command execution is addressed by the actual command results below. The platform allowed three concurrent reviewers; the fourth was launched as soon as a slot became available, before triage began. All four reviews completed in this workflow turn.

## Verification

**Commands:**
- `npm run test:unit -- tests/unit/helpers/events.test.ts` — new regression fails against the original helper, then all cases pass after correction.
- `npm run typecheck` — all referenced TypeScript projects pass.
- `npm run lint` — no errors; record unrelated existing warnings.
- `git diff --check` and `git diff --name-only` — clean whitespace and only the authorized paths changed.

## Auto Run Result

Status: done

DW-84 is implemented: `isoDateDaysFromNow` constructs the target date from the anchor's local calendar components, so March 27, 2026 at 23:30 in Nuuk plus one day returns `2026-03-28`. Formatting, optional/default anchors, and anchor immutability are preserved. Ledger resolution belongs to the orchestrator; the ledger was not edited or staged.

Files changed:

- `tests/support/helpers/events.ts` — calendar-only offset calculation and a short explanation of the DST gap.
- `tests/unit/helpers/events.test.ts` — five isolated Nuuk regressions using actual exports, literal dates, factory agreement, anchor immutability, active-gap assertions, and parent-timezone checks; child working directory anchored to the test module.
- This new spec — plan, completed tasks, review triage, and execution evidence.

Review breakdown: one low-severity patch applied, grouping two working-directory findings; zero deferred items; five rejected findings. The two ancient-year reports and the minimum-Date report were rejected because special handling would add complexity for dates no active caller supplies. The backward-gap coverage suggestion was rejected because the same unbranched calculation and existing negative-offset tests cover that path, with the exact backward result additionally verified. Process batching was rejected because the measured startup cost is negligible and separate cases preserve direct diagnostics. Full evidence is in the seven triage rows above.

Follow-up review recommendation: false. Patched entry counts: high 0, medium 0, low 1. The patch was verified from the previously failing external working directory; no specific unverified risk remains that warrants another pass.

Verification:

- Red phase, before the arithmetic change: 20 tests passed and the new +1 case failed with actual `2026-03-29` versus literal expected `2026-03-28`; the factory and gap checks passed.
- `npm run test:unit -- tests/unit/helpers/events.test.ts` — all 21 tests passed after the change and again after the review patch. All 16 original tests remain intact.
- `npm run typecheck` — passed after implementation and after the review patch.
- `npm run lint` — passed with zero errors and three existing Fast Refresh warnings in `src/components/RelationshipTimers/EventCountdown.tsx` at lines 68, 91, and 132.
- Vitest invoked from `/tmp` with `--root` pointing to the worktree — reproduced five child import failures before the review patch; all 21 tests passed afterward.
- `git diff --check` and `git diff --cached --check` — passed. Diff inspection confirmed only the two authorized test paths and this new spec changed. The factory, production files, configuration, archive, prior artifacts, and ledger are unchanged.

Matrix audit: the +1 Nuuk case covers the reproduced gap; the -1, 0, +2, and +5 cases cover adjacent offsets; two original tests cover anchored midnight stability and default-current-day calls; three original local-versus-UTC cases and eleven original transition cases cover the existing calendar matrix. Every covering test ran and passed, with explicit-anchor immutability checks. A separate direct execution confirmed the backward Nuuk gap produces March 28 in both exports.

Residual limits: native Date behavior for ancient years and the minimum representable timestamp remains as described in review triage and in the unchanged factory. No active caller uses those inputs. Vitest emits its existing future-native-config warning. No production build, browser, or database run was necessary for this helper-only correction. No push was performed.
