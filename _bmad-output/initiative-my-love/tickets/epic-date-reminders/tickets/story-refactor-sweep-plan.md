---
title: 'Refactor sweep'
type: 'chore'
ticket: '4'
created: '2026-11-01'
status: done
baseline_revision: 'aa6ccf1cf09358ccf0be6a900fc4e83117a3bb6f'
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
deferred:
  - summary: >-
      The docs this sweep added for DW-372 say iOS writes PendingNotifications.plist "up to about 25 s after a schedule", but no measurement bounds the lag on a fresh install's first schedule.
    evidence: |-
      DW-372 and story 4.1's plan record the only measurements: on the first schedule after a fresh install the plist still did not exist 15 s after launch and appeared only by the next launch; "within 25 s" was seen on later launches, timed from launch, not from the schedule. So a later agent can wait 25 s and still read a false empty list. Found by story 4.4's quick review. The fix rewords `sim help` (pending), the comment in scripts/sim-driver/pending.py, AGENTS.md's sim-driver paragraph and DW-372's resolution to drop the bound: "iOS writes the file some time after a schedule, on a first install sometimes not until the next launch, so an empty or stale list right after one is not proof". It edits AGENTS.md, so it is deferred.
    location: >-
      AGENTS.md (Maintained by hand, sim-driver paragraph); scripts/sim-driver/sim (help, pending); scripts/sim-driver/pending.py (missing-file comment); _bmad-output/initiative-my-love/deferred-work.md (DW-372 resolution)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Stories 7, 1, 6, 2, 3 and 8 of epic-date-reminders deferred findings to the ledger as DW-365–DW-379; two pairs are open duplicates (DW-367 of 365, DW-368 of 366), several are cheap fixes nobody has made, and three plan residual risks (stories 1, 2 and 3) are in no ledger entry. Story 5 ships whatever this sweep leaves.

**Approach:** Cleanup only, no new behaviour. Fix DW-373 by having the re-plan cancel the same id union the sign-out cancel already uses (ids 1..64 plus every pending id), so a lagging pending list can never leave a stale reminder. Correct the sim-driver documentation (`sim help` and AGENTS.md's hand-maintained sim-driver paragraph: DW-366/368, 369, 371, 372, plus story 1's residual risk that `sim dates` sends the partner date-change pushes) and write story 4.8's session rules into AGENTS.md's hand-maintained section (DW-379); the AGENTS.md edit is its own docs commit. Close the duplicates. Record the two product residual risks (story 2's partner-birthday mark surviving a re-link, story 3's offline switch showing its default) as new ledger entries. Leave every finding that needs an owner decision, a later iOS runtime, a new driver command or a simulator or device run open and unchanged.

</intent-contract>

## Implementation Notes

Oneshot: about 100 changed lines, mostly prose and test assertions; one product function changes (`scheduleDateReminders`' cancel step).

Inventory (plan frontmatter `deferred:`, Review Triage Logs, residual risks):

| Entry | Finding | Disposition |
|---|---|---|
| DW-365 (367 dup) | pending.py ignores SchemaVersion | open: needs a later runtime's archive; close 367 |
| DW-366 (368 dup) | AGENTS.md omits schedule/unschedule side effects | fix; close 368 |
| DW-369 | AGENTS.md omits `permission allow --host` prerequisite | fix |
| DW-370 | first sign-in permission re-plan | already done (story 4.6) |
| DW-371 | `sim dates kinds|many` clear every date first | fix (`sim help`, AGENTS.md) |
| DW-372 | `sim pending` false empty right after a schedule | fix by documenting the lag (`sim help`, pending.py's note, AGENTS.md); behaviour kept |
| DW-373 | re-plan cancels only `getPending`'s ids | fix: id union, shared with `cancelDateReminders` |
| DW-374 | `database.types.ts` not raw CLI output | open: owner decision (as DW-357) |
| DW-375 | simulator ignores a clock jump until reboot | open: a new driver command, not cleanup |
| DW-376 | foreground firing never observed | open: needs a simulator firing run |
| DW-377 | offline sign-out leaves refresh token valid | open: owner decision / hosted setting |
| DW-378 | Realtime may join as anon on a stored session | open: needs a simulator delivery run |
| DW-379 | AGENTS.md lacks story 4.8's session rules | fix (Maintained by hand, outside the generated block) |
| story 1 residual | `sim dates` fires date-change pushes (`notify_date_change` triggers on events, couple_settings, users.birthday) | fix: documented with DW-371 |
| story 1 residual | fired year-pinned request staying pending | nothing owed: a year-pinned trigger never matches again, and every re-plan (foreground included) cancels every pending id; story 4.8's 64-cut run showed the passed ones replaced |
| story 2 residual | `partner-birthday` mark carries over after a re-link | new ledger entry |
| story 3 residual | offline, the switch row shows default on while the copy says off | new ledger entry |

Code facts: `cancelDateReminders` (`src/services/dateReminders.ts:358`) already builds the union; the plugin's iOS `cancel` calls `removePendingNotificationRequests`, a no-op for unknown ids, and rejects only an empty list. `scheduleDateReminders` keeps its `isCurrent` checks and keeps aborting when `getPending` itself fails (unchanged). Tests asserting the cancel's argument or "no cancel when nothing is pending" move to the union: `src/services/__tests__/dateReminders.test.ts`, `tests/unit/stores/dateRemindersAtLaunch.test.ts`. Every replaced assertion keeps what it checked (call count, ordering) besides the argument.

Implementation (2026-11-01):
- `src/services/dateReminders.ts`: new private `reminderIdsToCancel(pending)` (ids 1..64, then any pending id above them); `scheduleDateReminders` always cancels that union after `getPending` (still aborting when `getPending` throws, still checking `isCurrent` before the cancel); `cancelDateReminders` uses the same helper, unchanged in behaviour.
- Tests: `dateReminders.test.ts` (union with a pending id 70; the "nothing pending" case now expects ids 1..64; the in-flight ordering case now starts with the schedule's own cancel) and `dateRemindersAtLaunch.test.ts` (five cancel arguments move to ids 1..64). No other test asserted the old argument.
- `scripts/sim-driver/sim` help: `dates` says what `clear` removes, that `kinds`/`many` clear first, and that the event and birthday writes send the other person date-change pushes (`notify_date_change` fires for service-role `events` and `users.birthday` writes; `couple_settings` needs `auth.uid()` in the pair, so not for it); `pending` says the file lags a schedule by up to about 25 s.
- `scripts/sim-driver/pending.py`: the missing-file note names the lag; `test-pending.zsh` matches only "PendingNotifications.plist does not exist", so it still passes.
- `AGENTS.md` (Maintained by hand only; the generated block is untouched): sim-driver paragraph (DW-366/368, 369, 371, 372) and a new session-rules bullet (DW-379), each claim checked against `authStorage.ts`, `sessionService.ts` and `supabaseClient.ts`.
- Ledger: DW-366, 369, 371, 372, 373, 379 resolved; DW-367 and 368 closed as duplicates; DW-380 and DW-381 appended (374 → 376 entries).
- xcodebuild needed the gitignored web assets: `fnox exec -- npm run build` then `npx cap copy ios`; `dist/` and `ios/App/App/public/` hold that secrets build (gitignored).

Verification run: `npm ci`; `npm run lint` and `npm run typecheck` exit 0; `npm run test:unit` 223 files, 3706 tests passed; `zsh scripts/sim-driver/test-pending.zsh` 62 ok, 0 failed; xcodebuild of the App scheme for the iOS Simulator: BUILD SUCCEEDED.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 3, false 1, maybe-false 0
- findings:
  - `[low]` `[defer]` (quick) `sim help`, pending.py's comment, AGENTS.md and DW-372's resolution state an "up to about 25 s" lag the evidence does not bound — confirmed against DW-372's reason (first-install plist absent at 15 s, present only by the next launch; 25 s seen on later launches, timed from launch); the fix edits AGENTS.md, so it is deferred to frontmatter `deferred` with the rewording.
  - `[low]` `[patch]` (quick) pending.py's new missing-file note says "a schedule made in the last few seconds", contradicting the comment two lines above and `sim help` — confirmed at `scripts/sim-driver/pending.py:201-205`; the note now reads "or iOS has not yet written a recent schedule: read again", with no window; `test-pending.zsh` 62 ok after it.
  - `[low]` `[reject]` (quick) Implementation Notes say five cancel arguments moved in `dateRemindersAtLaunch.test.ts`, the diff moves four — confirmed (old lines 210, 303, 444, 483), but the fix is to edit this build's plan; recorded in the Auto Run Result instead.
  - `[false]` `[reject]` (quick) The AGENTS.md edit is not in its own docs commit — at review time nothing is committed, because commits are made at Finalize; this run commits `AGENTS.md` alone as a `docs` commit before the rest.

## Verification

**Commands:**
- `npm ci` then `npm run lint` and `npm run typecheck` -- expected: exit 0
- `npm run test:unit` -- expected: pass
- `zsh scripts/sim-driver/test-pending.zsh` -- expected: every case passes
- `fnox exec -- npm run build`, `npx cap copy ios`, then `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <scratchpad> CODE_SIGNING_ALLOWED=NO build` -- expected: BUILD SUCCEEDED

**Manual checks:**
- `git diff` of the ledger touches only the status/resolution lines of DW-366, 367, 368, 369, 371, 372, 373 and 379, plus two appended entries; `grep -c '^### DW-'` goes up by exactly two

## Auto Run Result

**Status:** built

**Summary:** The cleanup sweep over the deferrals of stories 7, 1, 6, 2, 3 and 8 (DW-365–DW-379, plus the plans' residual risks). Every one is fixed or recorded in the ledger (inventory table in Implementation Notes). Fixed: the re-plan now cancels the same id union as the sign-out cancel (ids 1..64 plus every pending id), so a lagging pending list cannot leave a stale reminder pending (DW-373, also story 4.3's switch-off residual risk); the sim-driver docs in `sim help` and AGENTS.md now cover `schedule`/`unschedule` side effects and the host-permission prerequisite (DW-366, 369), what `sim dates kinds|many` clear and the date-change pushes they send (DW-371, story 4.1's residual risk), and the pending file's write lag (DW-372, documented, behaviour kept); story 4.8's session rules are in AGENTS.md's hand-maintained section (DW-379). Closed as duplicates: DW-367, 368. New ledger entries: DW-380 (a `partner-birthday` mark carries over to a new partner) and DW-381 (offline, the Date reminders switch shows its default on). Left open, unchanged: DW-365 (needs a later runtime's archive), DW-374 (owner decision), DW-375 (a new driver command), DW-376 and DW-378 (simulator runs), DW-377 (owner decision or hosted setting).

**Files changed:**
- `src/services/dateReminders.ts` — shared `reminderIdsToCancel`; `scheduleDateReminders` cancels the union every time.
- `src/services/__tests__/dateReminders.test.ts` — union, nothing-pending and in-flight ordering cases updated.
- `tests/unit/stores/dateRemindersAtLaunch.test.ts` — four cancel assertions move to ids 1..64 (the Implementation Notes' "five" is wrong; four).
- `scripts/sim-driver/sim` — help text for `dates` and `pending`.
- `scripts/sim-driver/pending.py` — the missing-file note and comment name the write lag.
- `AGENTS.md` — Maintained by hand only: the sim-driver paragraph and a session-rules bullet (own docs commit).
- `_bmad-output/initiative-my-love/deferred-work.md` — 8 entries closed (6 resolved, 2 duplicates); DW-380 and DW-381 appended.
- `_bmad-output/initiative-my-love/tickets/epic-date-reminders/tickets/story-refactor-sweep-plan.md` — this plan.

**Review findings:** Quick lens, 4 findings. Patched 1 low (pending.py's note contradicted the stated lag). Deferred 1 low (the stated 25 s bound is unmeasured for a first install; its fix edits AGENTS.md), as a frontmatter `deferred` item, not written into the ledger, so the orchestrator's import does not duplicate it. Rejected 1 low (the plan's "five" assertions, a plan-text fix) and 1 false (commit separation, refuted because commits are made at Finalize and AGENTS.md is committed alone).

**Follow-up review recommended:** false. Patched counts: high 0, medium 0, low 1.

**Verification:** After the patch: `npm run lint` and `npm run typecheck` exit 0; `npm run test:unit` 223 files, 3706 tests passed; `zsh scripts/sim-driver/test-pending.zsh` 62 ok, 0 failed; xcodebuild of the App scheme for the iOS Simulator: BUILD SUCCEEDED (after `fnox exec -- npm run build` and `npx cap copy ios`). Ledger `### DW-` count 374 → 376; only the intended status and resolution lines changed.

**Residual risks:**
- The DW-373 fix was checked by unit tests only, not on a simulator; the iOS `cancel` is a no-op for unknown ids (read in the plugin source), and the sign-out cancel has used the same union on the simulator since story 4.6.
- The `sim help`/pending.py/AGENTS.md doc changes were not exercised on a simulator; the 25 s figure is deferred above.
- `dist/` and `ios/App/App/public/` hold this worktree's secrets build from `fnox exec -- npm run build` (both gitignored).
