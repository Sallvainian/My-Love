---
title: 'DW-466: clear the TEA hook findings in eight test files'
type: chore
ticket: ''
created: '2026-11-06'
status: built
baseline_revision: '8ed298ec63a2e84ad4e1f464bd3a71c3f526cb0b'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** DW-466: `.claude/hooks/tea-enforce.cjs` reports H1 hard waits and H5 oversize files in existing tests, and its `--stop` sweep makes any agent that edits one of them spend an extra turn on old violations.

**Approach:** Replace each H1 hard wait in the eight named files with a wait on the condition the test needs, then split the five oversize files by subject into files under 1,000 lines, moving tests without changing them.

## Boundaries & Constraints

**Always:** Every test that exists today still exists with the same name and passes; per-file counts sum to the baseline. A replaced wait keeps every check the old one guarded (visibility of the negative case included); a negative assertion is made after a positive signal that the forbidden work would already have happened. `vi.mock`/`vi.hoisted` blocks stay in each test file; pure helpers may move to a kit that the split files import.

**Never:** Touch `tests/unit/stores/signOutClearsAccountState.test.ts` (scheduled in the remove-moods epic) or `tests/e2e-archive/` (deleted on main). Change source under `src/` outside `__tests__/`. Add entries to `disabledRules` or raise `maxFileLines`. Edit DW-461–DW-479. Fix hard waits the hook does not flag (record them instead).

**Decisions:** (1) The push spec's split is made safe by `workers: 1` on the `api` Playwright project (`playwright.config.ts`); the "sender is down" test rewrites the one global `push_sender_settings` row, so no two api files may run at once. (2) The full plan is kept, not split. (3) DW-466 is not edited on this branch (it exists only in PR #473); new ledger entries start at DW-480.

</frozen-after-approval>

## Code Map

Baseline: hook finds 23 issues on main at `8ed298ec`; 22 in scope (signOutClearsAccountState H5 excluded). Unit baseline 472 tests in the touched unit files (incl. neighbour `eventsSlice.localCopy.test.ts`, 25).

H1 replacements (no source change needed):
- `MoodTracker.partnerLink.test.tsx:73,161,176` — source defers the lookup with `setTimeout(0)` (`MoodTracker.tsx:142`, cleared `:151`). Scoped `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] })` installed before the listener call, `await vi.runOnlyPendingTimersAsync()`, then `vi.useRealTimers()`; `emit` also awaits `lookupPartnerId.mock.results.at(-1)?.value`. Unmount cases assert `vi.getTimerCount()` is 0 first. Add `afterEach(() => vi.useRealTimers())`. Restore real timers before any Testing Library `waitFor`.
- `dateReminders.test.ts:1080` — `runSerial` is a promise chain (`dateReminders.ts:388`); cancel's first call is `getPending` (`:461`). Flag `scheduleSettled` via `scheduled.then` attached before `cancelDateReminders()`; `getPending` mock pushes `'getPending'` or `'getPending:early'`; final order gains `'getPending'` before the last `'cancel'`. Drop the mid-test wait.
- `pushNotifications.test.ts:284` — renewal calls `checkPermissions()` synchronously when it proceeds (`pushNotifications.ts:369-375`): assert its count unchanged right after `returnToForeground()`, then rpc still 2. `:710 settle` — replace each use (743, 754, 776, 786, 826, 850) with the awaited `rpc.mock.results[i].value` or the `errorLog` `vi.waitFor` the code logs at `:252`.
- `nativeUpdates.test.ts:338 settle` (uses 349, 355, 368, 395) — positive steps `vi.waitFor` fetch count; negative steps assert synchronously (guards return at `nativeUpdates.ts:158,174`; `runCheck` reads `Date.now()` at `:182` before its first await, and the tests spy `Date.now` as `now`).
- `countdownMarks.test.ts:76`, `pushPreferencesCopy.test.ts:74` (afterEach 20 ms) — wait for `deleteAccountData`'s fire-and-forget deletes (`authSlice.ts:69-81`): wrap `deleteAccountCopies`, `deleteAccountImages`, `moodService.deleteSyncedForUser` with `vi.fn(actual)` as `signOutClearsAccountState.test.ts:31-37` does, and `await Promise.allSettled` over their `mock.results` before `vi.restoreAllMocks()`. pushPreferencesCopy also drains real `cancelDateReminders` (or stubs it as countdownMarks `:24-27` does). Put the shared drain in `tests/unit/stores/accountDataFixtures.ts`.
- `dateRemindersAtLaunch.test.ts:668,759 settle,926` — triggers decide synchronously; `readLocalCopySpy` is the signal (pattern already at `:424-428`). Negatives: `mockClear()` then `not.toHaveBeenCalled()` right after the trigger. Drains (`:668`, afterEach): `await replanDateReminders()`. `:926`: delete the wait (everything asserted is synchronous).
- `push-love-note-trigger.spec.ts:247,446,837` — delete: the preceding assertions already show no insert / no accepted transition, so no trigger fires (`push_devices.sql:213`, `moods_photos_interactions.sql:128`, `push_partner_requests.sql:102`). `:505` — delete and add the synchronous `postToSender` replay with `{ recorded: 0, sent: 0, skipped: 1 }`. `:908` — insert a poke (switch defaults on) as an ordering barrier, `expect.poll` its 2 rows, then assert the silenced note has none; add the poke to cleanup.

Splits (vitest `include` and the `api` project's `testDir` pick up new names; nothing in CI or scripts names these paths):
- `dateRemindersAtLaunch.test.ts` → keep 270-747 + 1258-1324; `dateRemindersAtLaunch.triggers.test.ts` gets 749-1256. New `dateRemindersAtLaunchFixture.ts` for pure helpers 109-237 + `ALL_REMINDER_IDS`; `restoreRefreshers`/`emitAuth` stay per file (hoisted values).
- `eventsSlice.test.ts` → keep starts-empty, loadEvent, loadEvents, clearEventsError; `.paging.test.ts` (loadMoreEvents, refresh depth); `.writes.test.ts` (add/edit/removeEvent, dates-changed). Each repeats `describe('eventsSlice')` and its `beforeEach` so names stay.
- `pushNotifications.test.ts` → keep registration, renewal, hasNativePush, getPushPermission; `.remove.test.ts` (remove, removeAll, stopDevicePushes); `.delivered.test.ts` (clearDelivered ×2, clearAppBadge, onForegroundPush, viewForPush, onPushTap). Header (57 lines) repeated.
- `dateReminders.test.ts` → keep planDateReminders, reminderDatesFrom; `.schedule.test.ts` (hasNativeReminders, schedule ×2, cancel, listenForReminderTaps last).
- `push-love-note-trigger.spec.ts` (14 tests, `test.describe.configure({ mode: 'serial' })` at 96, no shared hooks) → keep Love note (98-359), Push switches (858-969), Badge (978-1060); new `tests/api/push-partner-activity-trigger.spec.ts` gets Mood/photo/poke/kiss (384-574), Added dates (576-708), Partner request (710-856, its describe-local helpers 712-763 go with it). Both keep serial mode. Module helpers (`SourceColumn`, `requestsFor`, `clientFor`, `newToken` 57-94; `partnerPayload`, `postToSender`, `uniqueMoodTime` 362-382; `recordedAps` 972-976) move to `tests/support/helpers/push-requests.ts` (no barrel; import by deep path). Rewrite the doc comment (1-46) so each file describes its own describes, and say the cross-file safety now comes from the `api` project's `workers: 1`.
- `playwright.config.ts` `api` project (line ~155) -- add `workers: 1` with a comment naming the `push_sender_settings` reason.

## Tasks & Acceptance

**Execution:**
- [ ] Each H1 file above -- replace the wait as mapped -- DW-466.
- [ ] `tests/unit/stores/accountDataFixtures.ts` -- add the delete drain -- shared by two files.
- [ ] Each split file above, plus the two kits -- move whole describes unchanged -- H5.
- [ ] `_bmad-output/initiative-my-love/deferred-work.md` -- add DW-480: `settleMs` in `dateRemindersAtLaunch.test.ts` (~16 uses) hard-waits with a variable delay the H1 regex cannot see -- out of scope by the frozen block.

**Acceptance Criteria:**
- Given the branch, when the hook's `scanFile` runs over every tracked test file, then the only finding is `signOutClearsAccountState.test.ts` H5.
- Given the touched unit files, when run, then every test name from the baseline passes, total 472.
- Given the push spec(s), when run on the local stack with the edge runtime, then all 14 tests pass, twice in a row.

## Implementation Notes

- Implemented as mapped. Two kits beyond the plan's two, `src/services/__tests__/dateRemindersKit.ts` and `tests/unit/stores/eventsSliceFixture.ts`, so the split files share helpers rather than copy them (AGENTS.md, DW-313). `scheduledTitles`/`titlesOfSchedule` read a per-file hoisted mock, so the fixture builds them from `scheduleReaders(localNotifications.schedule)`.
- `settleMs` (not flagged by H1) moved into `dateRemindersAtLaunchFixture.ts` with its helpers; DW-480 records its 15 calls.
- Main moved during the build (`ee5d0c70` Knip in lint, `978874d0`, `8f243e16` hook excludes signOutClearsAccountState). The uncommitted work was carried onto `8f243e16` before verification; `baseline_revision` stays as set, so a diff of this work alone is taken against `8f243e16`.
- Verified on `8f243e16`: hook scan `findings: 0` over tracked and new test files; 472 unit tests, every baseline name present and passing; `run-push-api.sh --repeat-each=2` 28 passed on the isolated `dw466` stack (baseline 14 of 14 there); `npm run typecheck`, `npm run lint`, `npx knip` clean. The shared stack fails one push test on main because it lacks main's `20261105010000_push_added_dates`.

## Plan Change Log

## Review Triage Log

Pass 1 (quick lens): 5 findings — high 0, medium 0, low 2, false 2, maybe-false 1.

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | `dateRemindersAtLaunch.test.ts:9` and `.triggers.test.ts:9` name `dateReminders.test.ts` for the cancel's own cases | low | patch | `describe('cancelDateReminders')` is now at `dateReminders.schedule.test.ts:275`; `dateReminders.test.ts` holds only planning and `reminderDatesFrom`. Header now names the schedule file. |
| 2 | AC and Verification expect `findings: 1`; the branch gives 0 | false | reject | The fix is an edit to this build's plan. Main's `8f243e16` excluded the one remaining file from the hook during the build; zero findings meets the intent. |
| 3 | `eventsSliceFixture.ts` exports a fifth `deferred<T>()` | low | reject | The copy existed file-local in `eventsSlice.test.ts` before; the split shares it rather than copying it twice. Reusing `accountDataFixtures`' version means renaming `resolve`/`reject` to `settle`/`fail` in moved tests (which the intent forbids) and pulling `useAppStore` into single-slice tests. |
| 4 | The poke barrier in Push switches does not strictly order the note's pg_net call | maybe-false | reject | Accepted when the plan was approved: it is no weaker than the 3 s wait and can only miss a regression in a narrow window, never fail falsely (a late silenced row has a different id from the next note's). Would settle: pg_net's worker batch concurrency. If true, low. |
| 5 | A comment after `cancelDateReminders()` oversells the immediate check | false | reject | No comment follows line 374 in `dateReminders.schedule.test.ts`; the old "must still be waiting" comment was removed with the wait, and the remaining one (369) is accurate. |

## Verification

**Commands:**
Scratch tools live in `/private/tmp/claude-501/-Users-sallvain-Projects-My-Love/89b63488-eb07-4808-9b60-007418ece614/scratchpad/` (call it `$SP`). `$SP/run-unit.sh` names the unit files by prefix, so split files are picked up; `$SP/baseline.json` is the Vitest JSON report from main.
- `node $SP/tea-scan.cjs .` (from the worktree root) -- expected: `findings: 1`, signOutClearsAccountState H5.
- `$SP/run-unit.sh $SP/after.json`, then compare every `fullName` and status in `after.json` with `baseline.json` -- expected: the same set of names, 472 passed.
- `$SP/run-push-api.sh --repeat-each=2` -- runs `tests/api/push-*` in the `api` project against an isolated stack already running from `$SP/iso` (project `dw466`, ports 553xx, edge runtime on, every main migration applied; baseline 14 passed). The shared `My-Love` stack lacks main's migrations and may serve a loop: never migrate, reset or restart it. Expected: 28 passed.
- `npm run typecheck` and `npm run lint` -- expected: clean.
