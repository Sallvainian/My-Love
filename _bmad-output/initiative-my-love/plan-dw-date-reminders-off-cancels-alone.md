---
title: 'DW-392: turning date reminders off cancels them even when another saved copy is missing'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '3fb5d227ebc58b7b035386950ed12373390e4cf5'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `planOnce` in `src/services/dateRemindersAtLaunch.ts` returns before any plugin call when any of the seven saved copies reads `null` (absent, failed or malformed). So turning the Settings "Date reminders" switch off while another copy is missing leaves every pending reminder scheduled, against R6 ("off cancels every scheduled reminder") — DW-392, retrospective finding A7.

**Approach:** When the `push-preferences` copy is present and its `dateReminders` is `false`, run the cancel through the existing serial path (`scheduleDateReminders([], isCurrent)` in `dateReminders.ts`: cancels every reminder id, schedules nothing, stops on an identity change) without needing the other six copies. With the switch on (or the switch copy itself missing), keep the current rule: any missing copy skips the re-plan and the pending list stays. Unit-test both in `tests/unit/stores/dateRemindersAtLaunch.test.ts`: off with each other copy missing cancels every id and schedules nothing; on with a missing copy makes no plugin call.

</intent-contract>

## Implementation Notes

Oneshot: one guard in `planOnce` plus its doc comment, and parameterised unit cases — well under 100 lines in two files. `scheduleDateReminders([], …)` is the path the full re-plan already takes when the switch is off (`planDateReminders` returns `[]`), so behaviour with every copy present is unchanged; `cancelDateReminders()` is not used because it takes no identity check and is the sign-out path (stubbed in this test file).

Files touched: `src/services/dateRemindersAtLaunch.ts` (switch-off guard in `planOnce` before the all-copies check; module doc comment names the exception), `tests/unit/stores/dateRemindersAtLaunch.test.ts` (new cases in `describe('the Date reminders switch')`). The "on with a missing copy keeps the pending list" side was already covered per kind by `replanDateReminders reads only loaded copies`, so no new case was kept for it. Red check: with `planOnce` reverted to baseline, the 13 new off-with-missing-copy cases failed; with the fix they pass.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/App.localCopyRefresh.test.tsx src/services/__tests__/dateReminders.test.ts` -- expected: all pass, including the new off-with-missing-copy and on-with-missing-copy cases
- `npx eslint src/services/dateRemindersAtLaunch.ts tests/unit/stores/dateRemindersAtLaunch.test.ts` -- expected: no errors
- `npm run typecheck` -- expected: no new errors versus baseline

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` New test 'with the switch on, a missing date copy keeps the pending list' duplicated the existing per-kind `makes no plugin call, and keeps the pending list, when the %s copy is missing` case and checked less (no `checkPermissions`) — deleted the duplicate; the comment above the new cases points at the existing per-kind "on" coverage.
  - `[medium]` `[patch]` New account-change test switched account before the copy reads resolved, so it returned at the existing post-read identity check and never reached the new branch; nothing verified the identity callback passed to `scheduleDateReminders` — replaced it with 'stops before the cancel when the account changes during the switch-off run', which switches account inside `getPending` and asserts no `cancel`/`checkPermissions`/`schedule`; mutating the callback to `() => true` makes it fail.
  - `[low]` `[patch]` Module doc comment in `src/services/dateRemindersAtLaunch.ts` rewrapped badly ("It never" / "loads anything from the server itself:" / "it reads only saved copies.") — joined the last two lines.

## Auto Run Result

Status: built

**Summary:** Turning the "Date reminders" switch off now cancels every pending reminder even when another saved copy is missing, malformed or fails to read (DW-392). `planOnce` checks the push switches copy first: when it is present and `dateReminders` is false, it runs `scheduleDateReminders([], () => isCurrent(owner))` — the existing serial path that cancels every reminder id, schedules nothing and stops on an identity change — and returns. With the switch on, or the switch copy itself missing, the old rule holds: any missing copy skips the re-plan and the pending list stays.

**Files changed:**
- `src/services/dateRemindersAtLaunch.ts` — switch-off guard in `planOnce`; module doc comment records the exception.
- `tests/unit/stores/dateRemindersAtLaunch.test.ts` — off with each of the six other copies missing cancels every id; off with each other copy's read failing cancels; off with only the switch copy saved cancels; an account switch mid-run stops before the cancel.

**Review:** quick lens, 3 findings, all patched (1 medium, 2 low); none deferred, none rejected.

**Follow-up review recommended:** false — patched counts: high 0, medium 1, low 2 (first pass; one medium is below the threshold of two).

**Verification:**
- `npx vitest run tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/App.localCopyRefresh.test.tsx src/services/__tests__/dateReminders.test.ts` — 3 files, 226 tests passed.
- Red check: with baseline `planOnce`, 13 new switch-off cases failed; mutating the new branch's identity callback to `() => true` failed the mid-run account-switch case.
- `npx eslint` on both changed files — clean. `npm run typecheck` — exit 0.

**Residual risks:** Not exercised on a simulator or device; the native path is the same `scheduleDateReminders` call the full re-plan already makes when the switch is off, so the change is the guard's placement only.

