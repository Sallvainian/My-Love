---
epic: epic-date-reminders
date: 2026-11-02
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: Date Reminders (epic-date-reminders)

## Epic summary

**Epic:** `_bmad-output/initiative-my-love/tickets/epic-date-reminders/` (id 4). It was resolved from the slug `epic-date-reminders` through `tickets.py status`.

**Tickets in build order** (`tickets.py status <folder>`). Every row is `status: done`, `state: done`. None is still at `built`, and none is unfinished.

| Ref | Title | Risk | Review run | Plan range | Commits |
|---|---|---|---|---|---|
| 4.7 | The simulator driver lists an app's scheduled reminders | high | thorough, plus a follow-up pass | `58da06ce..b7d7ac09` | `4bed585d` (shipped as `6898c9ed`) |
| 4.1 | The planner schedules day-before and on-the-day reminders at launch | high | thorough, plus a follow-up pass | `b7d7ac09..ae0b9d5b` | `67a9b0c5` (`0c15b9a6`) |
| 4.6 | Re-plan on every change, stop at sign-out, stack with pushes, open Home | high (plan) / medium (ticket) | quick only; the loop skipped its review session | `ae0b9d5b..8b24113f` | `21e4f8bb` (`edfe4ec1`) |
| 4.2 | Dates marked for the countdown remind a month and a week before | high (plan) / medium (ticket) | quick only; review skipped; two dev sessions (the first stalled) | `8b24113f..eaee2310` | `10e9a34f` (`ef3ce77c`); fix `5cc03752` |
| 4.3 | A Settings switch turns date reminders off | medium / low | quick only; review skipped | `980671cb..6e84b584` | `10ff29b6` (`def0010f`); `1817b4ed`, `e8402e99` on the PR branch |
| 4.8 | Reminders fire at 9:00 and a tap opens Home (hitl) | high | quick, then thorough; review loop 1 | `6e84b584..aa6ccf1c` | `7497ca3c` (`0cc7047a`), `aa6ccf1c` |
| 4.4 | Refactor sweep | low | quick only; review skipped | `aa6ccf1c..81cceccc` | `ccae8b47` (`4cfb26ec`) |
| 4.5 | Date reminders ship to the owner's iPhone (hitl) | medium | reviewer subagent on `bbe3cd8b` only | `871463b0..3f036bd3`, cut (see below) | `bbe3cd8b`, `f07ce016`, `20282aa2`, `d47ea7c5`, `3f036bd3` |

**How the ranges were derived:**
- Each plan's `baseline_revision` is a commit on `loop/integration`. The baselines are strictly ordered by `git merge-base --is-ancestor`, and each range runs to the next baseline.
- 4.2's range ends at its own merge, `eaee2310`. The next baseline, `980671cb`, is a merge of `origin/main` that brought in #433 (`9717aa5d`, `65a51437`) and `fc9d490d`, none of which is this epic's work.
- 4.4's range ends at its merge, `81cceccc`.
- 4.5's range `871463b0..3f036bd3` holds 31 commits. Only the five listed in the table are this story's, per its plan's Result. The 26 CI commits from PRs #434–#437 are excluded.

**What shipped:** PR #432 replayed loop/integration as a linear branch, `d6638a23..f29ea57b`, and added commits that loop/integration never held:
- `5cc03752`: the type fix
- `1817b4ed`: a comment fix
- `e8402e99`: the DW-373 fix
- `3f551b1b`: mood channel
- `b64ceb38`, `a9e73a81`, `ccf6ab2d`: love-notes re-arm
- `f29ea57b`: test fix

The whole-epic measure (`git_evidence.py`, `d6638a23..f29ea57b`) counts 23 commits, 2 merges and 1 measured merge. The unmeasured merge is `726bf8af`, main's own PR merge, so nothing of the epic is missing from the count.

**Evidence inventory:**
- **Available:**
  - the epic file and `.memlog.md`
  - `tickets.toml`, the 8 plans and the `find` output for each ticket (no story files, since no ticket was pulled)
  - the git history above
  - the deferred-work ledger
  - the bmad-loop run `.bmad-loop/runs/20261031-222538-4880/`: `journal.jsonl`, logs for 4.7, 4.1, 4.6, 4.2 (two sessions), 4.3 and 4.4, and review logs for 4.7 and 4.1
- **Missing:**
  - session transcripts for the hitl stories 4.8 and 4.5, and for the PR #432 follow-up session; their plans and commit messages are the only record
  - a retrospective for the previous epic (see Previous-retro follow-through)

## Findings

Each finding has a source, a disposition for this instance, and the lesson that would prevent the next one. The review lenses' findings were re-checked against the source before routing. Findings that did not hold, or that are recorded design, are listed under Dropped or accepted.

### Aggregate views

**A1. Architecture delta: no cycle, new cross-layer edges.** Accept as-is.
- New edges:
  - `dateRemindersAtLaunch.ts` (a service) imports the copy readers of `settingsSlice`, `eventsSlice` and `partnerSlice`, plus `useAppStore`
  - `settingsSlice.ts` and `authSlice.ts` import `dateReminders.ts`
  - `dateReminders.ts` imports `pushNotifications.ts` (`routeNotificationTap`) and `eventsService.ts`
- `dateReminders.ts` stays store-free, so these edges form no cycle.
- `src/services/storage.ts` is the precedent for a service that imports the store.
- Narrowed scope: no dependency tool is installed (no madge or dependency-cruiser), so the graph was derived from the import lines of the changed files.

**A2. `src/stores/slices/settingsSlice.ts` grew from 930 lines (at `58da06ce`) to 1116.** Its `registerLocalCopy` calls went from 4 to 6, because it took the `countdown-marks` and `push-preferences` kinds plus their readers, refreshers and setters (4.2, 4.3, 4.6).
- Disposition: defer. It is a split candidate (copy kinds and readers by domain), not yet broken.
- Lesson: a sweep should measure the slice it extends.

**A3. The DW-373 fix was written twice.** Disposition: accept (resolved).
- `e8402e99` made the fix on the PR #432 branch, at the owner's request on story 4.3.
- Story 4.4's sweep re-implemented the same `reminderIdsToCancel` union on loop/integration (`ccae8b47`), because the PR-branch commit was never there.
- The replay kept `e8402e99`'s version (message of `4cfb26ec`). So the sweep plan's Auto Run Result ("Fixed: the re-plan now cancels the same id union…") describes code that did not ship.
- Lesson: fixes made on the PR branch must reach `loop/integration` before the sweep's inventory, or the sweep should inventory the PR branch.

**A4. Two builders of the planner's input diverge.**
- `planOnce` (`dateRemindersAtLaunch.ts:79-117`) builds `ReminderDates` from the saved copies.
- `CountdownMarks.tsx:75-87` builds it from the store.
- Each kind has its own eligibility rule: `reminderDateEntries` in `dateReminders.ts:193-229`, and `planDateReminders` in `:236-285`.
- This divergence is the cause of L10.
- Disposition: defer (low).

**A5. A vacuous assertion pattern recurred.** `src/components/Settings/__tests__/PushSettings.test.tsx:357` asserts only `expect(console.error).toHaveBeenCalled()`. It passed vacuously twice when a new native module mounted inside the section logged an unrelated error: once in 4.6's triage (the local-notifications mock) and once in 4.2's (the countdown-marks mock).
- Disposition: fix now. Assert the specific message.
- Lesson: never assert a bare `console.error` call.

**A6. R4's "another device at its next open" holds only for a cold start.**
- The epic's Constraints define "open" as every launch and every return to the foreground. Story 4.6's frozen intent says "No server refresh on foreground. The foreground trigger plans from the copies".
- So `visibilitychange` (`dateRemindersAtLaunch.ts:179-182`) re-plans from unchanged copies. A grep of `src` finds no other `visibilitychange` handler that refreshes data.
- Copies refresh only on a signed-in start (`App.tsx:434`), on `online` (`App.tsx:500`) and when a view loads its own data.
- No copy refresh follows `TOKEN_REFRESHED` either. A grep finds only `useRealtimeMessages.ts:711` reacting to it. So reads that story 4.8's guard refused at start stay stale for the session.
- A mark, a switch change or a partner's birthday edit made on another device therefore reaches a phone that is only resumed at its next cold start or reconnect.
- Story 4.2's check used a terminate and relaunch. Story 4.5's second-device check used a fresh sign-in.
- Sources: adversarial lens 1 and verification-gap lens 3, both confirmed.
- Disposition: defer. It is a spec reconciliation or a fix, and the owner decides which.
- Lesson: a ticket's "Never" must not narrow an epic-level definition without a Decision line in the epic.

**A7. The R6 switch-off cancel can be skipped.** `dateRemindersAtLaunch.ts:96` skips the whole re-plan when any of the seven copies is `null`. So turning the switch off while another copy is missing or malformed leaves the pending reminders scheduled. R6 says "off cancels every scheduled reminder"; story 4.3's residual risks name the first-launch case only.
- Source: the edge-case lens, plus the claim that `def0010f` overstates this.
- Disposition: defer (low). The fix: when the prefs copy says off, cancel without needing the other copies.

**A8. Story 4.2 hand-edited `src/types/database.types.ts`, against AGENTS.md Policy.** Its plan records the edit, and it was deferred as DW-374.
- CI's types check, added concurrently by #433 (`9717aa5d`), failed on the branch. `5cc03752` added the missing `ComputedFields` line.
- Story 4.3 then ran `npm run db:types` on the pinned CLI, which changed only its own three lines (plan, Implementation Notes). So the drift DW-374 records is settled, but DW-374 is still `status: open`.
- Disposition: fix now. Close DW-374 with that evidence.
- Lesson: when a generator does not reproduce the file, stop and ask; do not hand-insert.

**A9. An order-dependent test reached CI.** `e8402e99` made `scheduleDateReminders` cancel before every schedule. One describe block in `dateReminders.test.ts` did not reset `cancel`, so CI's shuffled run (seed 1250) failed. `f29ea57b` fixed it.
- Disposition: accept (fixed).
- Lesson: run `SEED=<n> npm run test:unit:coverage` for any change that alters a shared mock's call sequence. `e8402e99`'s message records no shuffled run.

**A10. Plans rated high risk ran the quick lens only.**
- Stories 4.6 and 4.2 have `risk: 'high'` in their plans, but `review: 'quick'` was pinned. The journal records `review-skipped` for 4.6, 4.2, 4.3 and 4.4.
- 4.6's quick review deferred DW-373 as "maybe-false". The owner found it real on 4.3 (`e8402e99`).
- Disposition: accept (fixed).
- Lesson: pin `review: thorough` for a high-risk plan.

**A11. The AGENTS.md edit was not committed on its own.** Story 4.4's triage rejected a finding that the AGENTS.md edit lacked its own docs commit, saying "this run commits `AGENTS.md` alone as a `docs` commit before the rest". But `ccae8b47` and `4cfb26ec` each mix AGENTS.md with code, test and ledger changes, against AGENTS.md Policy ("Documentation-only changes get their own commit").
- Disposition: accept as-is (history).
- Lesson: the loop's per-story commit cannot split commits, so a review must not refute a finding on a promise the orchestrator does not keep.

**A12. DW-378 is stale.**
- Its location names `src/services/moodSyncService.ts`; the file is `src/api/moodSyncService.ts`.
- `3f551b1b` (the partner-mood channel) and `b64ceb38` and `ccf6ab2d` (love notes) addressed two of its three channels and cite it, but the entry is unchanged and `status: open`. The `interactionService` part is untouched.
- Disposition: fix now (a ledger update).

**A13. A check story became an auth rewrite.**
- Story 4.8 was a hitl check story. It found a pre-existing defect (an offline cold start signed the person out) and became an auth rewrite: `sessionService`, the `authStorage` guard and `actionService` sign-out.
- PR #432 follow-ups followed (mood, love notes), and story 4.5 added four more auth commits. Two of them, `20282aa2` and `d47ea7c5`, were pushed without review by the owner's decision (4.5 Result).
- Disposition: accept. Each step was an owner decision.
- Lesson: a defect a check story finds becomes its own story. L1 and L16 are in that unreviewed code.

### Diff-scope review

`bmad-review` ran the adversarial, edge-case-hunter and verification-gap lenses on the shipped code diff, weighting the ticket boundaries:
- `d6638a23..edfe4ec1`
- `eb543ab5..f29ea57b`
- `bbe3cd8b`, `f07ce016`, `20282aa2` and `d47ea7c5`

The diff is 9,942 lines across 87 files, excluding `_bmad-output/`, `package-lock.json` and the sim-driver fixtures. Lens tags: (adv) adversarial, (ech) edge-case hunter, (vg) verification gap.

**L1. "Sign out of all devices" silently becomes a this-device sign-out (adv, ech, vg).**
- Settings refuses it only when `isOnline()` is false (`Settings.tsx:548`).
- With the browser online but the auth server unreachable, `actionService.ts:99-109` turns the retryable error into `error = null`, or falls back to a local sign-out. Settings then reports success.
- The only test of `{ everywhere: true }` uses `error: null`.
- Confirmed by reading the code.
- Disposition: fix now. Report a partial sign-out when `everywhere` meets a retryable error.

**L2. Reminders fire with no sound, and their in-front presentation differs from pushes (adv).**
- `scheduleDateReminders` passes no `sound`. The plugin sets `content.sound` only for a non-empty string (`LocalNotificationsPlugin.swift:472-473`).
- With no `LocalNotifications.presentationOptions` in `capacitor.config.ts`, an in-front reminder uses `[.badge, .sound, .banner, .list]` (`LocalNotificationsHandler.swift:35`). Pushes use `presentationOptions: ['badge']` (`capacitor.config.ts:15`).
- The code is confirmed. That delivery is silent on the device is UNVERIFIED: story 4.5's Result does not record sound.
- Disposition: fix now, after the owner decides the sound. It extends DW-376, and a native config change needs a reinstall.

**L3. No copy refresh on a foreground return or on `TOKEN_REFRESHED` (adv, vg).** Merged into A6.

**L4. The love-notes re-arm can get stuck (ech).**
- `rearm()` (`useRealtimeMessages.ts:685-701`) sets `gaveUp = false` before calling `openChannel`. If that rejects, the catch only logs.
- Every later `rearm()` then sees `gaveUp` false with a zero retry count and returns. The feed stays `reconnecting` with no channel until Love Notes remounts.
- Confirmed by reading the code.
- Disposition: fix now (low). Restore `gaveUp` and report `disconnected` in the catch.

**L5. A background refresher failure can disable an open Settings section (adv).**
- Story 4.3 made `loadPushPreferences` the `push-preferences` refresher, so it runs on every signed-in start and reconnect.
- A failed read sets `pushPreferences: null, pushPreferencesLoadFailed: true` (`settingsSlice.ts:1030-1031`). An open Settings section then shows its load failure and disables all seven rows.
- This widens 4.3's rejected "Couldn't load" row.
- Disposition: defer.

**L6. `sim dates kinds|many|clear` leaves the countdown marks and the switch (adv).** `clearDates` (`scripts/sim-driver/dates.ts:53-63`) deletes events, anniversaries, `couple_settings` and birthdays. It leaves `countdown_marks` and `push_preferences.date_reminders` in place, so leftovers from a 4.2 or 4.3 check change later seeds.
- Disposition: fix now (low).

**L7. Delivered reminders survive sign-out (adv).** `cancel` removes pending requests only. DW-352 covers delivered push notifications only, so delivered "Tomorrow: … turns N" banners stay in Notification Center with nothing in the ledger.
- Disposition: fix now. Widen DW-352.

**L8. "Sign out of all devices" cannot stop a lost phone's local reminders (adv).** They are local to that phone and are cancelled only by its own JavaScript after it sees a sign-out, so up to 64 stay scheduled. DW-384 covers only the `push_devices` rows.
- Disposition: defer. Add a ledger entry.

**L9. The launch re-plan waits for the slowest refresher (adv).** `App.tsx:434` chains the re-plan onto `refreshLocalCopies()`. The partner lookup "has no request timeout" (comment at `settingsSlice.ts:836-837`), so a stalled connection that the browser reports as online can hold the launch plan until a foreground return.
- PLAUSIBLE, not reproduced.
- Disposition: defer.

**L10. The marks list offers rows that can plan nothing (adv, ech).** Examples: an event dated tomorrow after 9:00 today, and a relationship start dated today or later, which the planner skips (`dateReminders.ts:263`).
- Disposition: defer (low). See A4.

**L11. The switch helper text is inaccurate (adv).** "At 9:00 before each date." (`CountdownMarks.tsx:40`), but anniversaries and birthdays also fire on the day.
- Disposition: fix now (low; the owner chooses the wording).

**L12. Non-Gregorian calendars (ech).** The plugin builds `DateComponents` with no calendar (`LocalNotificationsPlugin.swift:576-579`, `calendar` commented out). Whether a device on a Buddhist or Japanese calendar reads year 2026 in that calendar, so the reminders never fire, is UNVERIFIED.
- Disposition: defer. Settle it on a simulator set to another calendar.

**L13. Marks keyed by role carry over to a new couple (ech).** Besides `partner-birthday` (DW-380), the `relationship-start` and `wedding` marks are per user and survive an unlink and relink, so they mark the new couple's dates.
- Disposition: fix now. Widen DW-380.

**L14. Every re-plan cancels all pending local notifications (adv).** `reminderIdsToCancel` adds every pending id. Story 4.1's review rejected this because the shell schedules no other local notification, which still holds.
- Disposition: accept as-is. Record a ledger note that any future local-notification feature must reserve an id range or tag.

**L15. `scripts/sim-driver/test-pending.zsh` runs in no CI job (vg).** Story 4.7's review rejected this because the tool is Mac-only and hand-run, which still holds. Whether it runs on an ubuntu runner is UNVERIFIED.
- Disposition: accept as-is.

**L16. "Sign out of all devices" has no confirmation step (adv).** It is placed directly under Sign out (`d47ea7c5`, unreviewed).
- Disposition: defer (owner's product decision).

**L17. A comment may misstate the callback case (ech, a claim with medium confidence).** At `App.tsx:262-266`, "a session present means its outcome is `null`" may not hold for a callback error that arrives with a stored session.
- PLAUSIBLE: `getAuthCallbackOutcome` was not read.
- Disposition: defer.

### Dropped or accepted (so later retros stop re-flagging them)

- **29 February:** a 29 February birthday reminds on 28 February and 1 March, while a 29 February anniversary clamps to 28 February (adv 8, ech). This is by design: each reminder matches its Home card, as the epic's next-occurrence constraint requires. It was rejected in 4.1's review and pinned by 4.1's 29 February test.
- **"turns 0":** a birth year in the future reads "turns 0" (ech). It matches the card, and 4.1's review rejected it.
- **Positional ids:** ids replace an unread delivered reminder (ech). This is UNVERIFIED and negligible, and 4.1's review rejected it.
- **The ef3ce77c claim:** that the commit "lists every set date" (ech). Leaving out past events and anniversaries without a `serverId` is the plan's specified behavior.

## Behavior verification

The retrospective did not run the shell, the simulator or the device. That is a narrowed scope. What it ran on HEAD (`4f8238bf`):
- `npx vitest run` over the 10 unit files the epic added or extended: `dateReminders`, `dateRemindersAtLaunch`, `countdownMarks`, `pushPreferencesCopy`, `signOutCancelsDateReminders`, `CountdownMarks`, `authStorage`, `sessionService`, `supabaseClientAuthFlow` and `App.localCopyRefresh`. 319 tests passed.
- `zsh scripts/sim-driver/test-pending.zsh`: 62 ok, 0 failed.

The end-to-end evidence is the builds' own:
- Story 4.5's device run on the owner's iPhone against production, 2026-11-02 05:58–07:20 UTC (plan, Result):
  - every reminder kind fired at 09:00 in airplane mode
  - taps opened Home from a cold start and from the background
  - the switch off and a sign-out each left nothing firing
  - the older shell took the live update
  - the website showed no section and 0 console errors
- The simulator runs recorded in stories 4.7, 4.1, 4.6, 4.2, 4.3 and 4.8.

Never exercised:
- the Home Screen web app (the owner's decision, 2026-11-02)
- the soonest-64 cut on a device (simulator only: 4.1 AC2, 4.8 check 6)
- a reminder firing with the shell in front (DW-376)
- reminder sound (L2)
- a foreground return on a second device (A6)

## Previous-retro follow-through

Nothing to follow through on, because no previous retrospective exists. The previous epic in `tickets.py status`'s `epics` order is `epic-push-notifications` (id 3). Its folder holds no `epic-push-notifications-retrospective.md`, and the loop journal recorded its closure with "retrospective verdict: unknown". This is a missing file, not a file with no outstanding items.

## Action items

Every item is proposed. Nothing was applied.

| # | Action | Owner | Kind | Source |
|---|---|---|---|---|
| 1 | Make "Sign out of all devices" report a partial sign-out when the global logout meets a retryable error, and add a test with a retryable error on `{ everywhere: true }`. | dev loop; the owner approves the message | remediation | L1 |
| 2 | Decide the reminders' sound and in-front presentation. Then set `sound` on each scheduled reminder and `LocalNotifications.presentationOptions` in `capacitor.config.ts` (needs a reinstall), and check sound on the device. | owner, then dev loop | remediation | L2, DW-376 |
| 3 | Decide whether "next open" in R4 includes a foreground return. Either refresh the date copies on foreground and after `TOKEN_REFRESHED` (throttled, online only), or reconcile R4 and the Constraints wording to "next launch or reconnect". | owner, through `bmad-agent-po` | spec reconciliation or remediation | A6, L3 |
| 4 | In `rearm()`'s catch, restore `gaveUp = true` and report `disconnected`, with a test for a rejected `openChannel`. | dev loop | remediation | L4 |
| 5 | Have `clearDates` delete both people's `countdown_marks` and reset `push_preferences.date_reminders` to true. Update `sim help`. | dev loop | remediation | L6 |
| 6 | Replace the bare `expect(console.error).toHaveBeenCalled()` at `PushSettings.test.tsx:357` with an assertion on the expected message. | dev loop | remediation | A5 |
| 7 | Reword the Date reminders helper, for example "At 9:00 the day before, and on the day for anniversaries and birthdays." | owner, then dev loop | remediation | L11 |
| 8 | Ledger, in one change: close DW-374 with 4.3's `npm run db:types` evidence and #433. Update DW-378's path and record what `3f551b1b`, `b64ceb38` and `ccf6ab2d` settled. Widen DW-352 to delivered date reminders (L7) and DW-380 to the `relationship-start` and `wedding` marks (L13). Add entries for A2, A4/L10, A7, L5, L8, L9, L12, L14, L16 and L17. | owner, or whoever runs `bmad-agent-po` | ledger | A8, A12, L7, L13 and the defer rows |
| 9 | Pin `review: thorough` when a plan's `risk` is high, including when the ticket's own risk is lower. | owner (loop policy) | process | A10 |
| 10 | Merge PR-branch fixes back into `loop/integration`, or have the sweep inventory the PR branch, before a sweep story starts. | owner (loop operation) | process | A3 |
| 11 | When a check story finds a pre-existing defect, open a new story for the fix rather than growing the check story. | `bmad-agent-po` | process | A13 |
| 12 | Run a shuffled unit run (`SEED=<n> npm run test:unit:coverage`) for any change that alters a shared mock's call sequence. | dev loop convention | process | A9 |
| 13 | Do not refute a commit-shape finding on a promise of separate commits that the orchestrator's single per-story commit cannot keep. Either commit AGENTS.md from the story session or accept the mix in triage. | owner (loop policy) | process | A11 |

## Decision records

Headless run: these are proposed, none is written. No `adr-*.md` file or decisions folder exists in the repository (`git ls-files` returned nothing). Before any is written, AGENTS.md Policy needs reconciling with this skill's `docs/decisions/` default: it deleted the `docs/` tree and says durable agent-facing prose goes in AGENTS.md (see Open questions).

| Proposed record | Decision | Plan | Commit | Why (source) |
|---|---|---|---|---|
| `adr-an-unreachable-server-never-signs-anyone-out.md` | Only an empty SDK session key means signed out. While a session is stored, a request with no user token is refused, and offline sign-out is local. | 4.8 | `0cc7047a` (loop/integration `7497ca3c`) | Owner decisions 2026-11-01 in 4.8's frozen block: an offline cold start was deleting sign-in and offline data. |
| `adr-sign-out-ends-only-this-device.md` | Sign out ends this device's session; a separate row signs out every device. | 4.5 | `20282aa2`, `d47ea7c5` | Owner decision 2026-11-02 (4.5 Result): a simulator's global sign-out signed the phone out. |
| `adr-date-reminders-plan-only-from-saved-copies.md` | A re-plan reads the saved local copies of all seven kinds and skips entirely when any is missing. | 4.6 | `edfe4ec1` | 4.6 Design Notes: the store cannot tell "not loaded" apart, and a partial plan would wipe a kind's reminders. |
| `adr-date-reminders-are-year-pinned-calendar-triggers.md` | Each occurrence is its own floating calendar trigger with the year set (`schedule.on`), never `schedule.at` or a yearly repeat. | 4.1 | `0c15b9a6` | 4.1 Design Notes: the texts name an age or change after the wedding, the 64 cut needs concrete moments, and no time zone keeps 9:00 local. |
| `adr-reminder-ids-are-positional.md` | Reminder ids are `1..N` in plan order, and every re-plan and sign-out cancels ids `1..64` plus every pending id. | 4.1, 4.6 | `0c15b9a6`, `e8402e99` | 4.6 Design Notes and the `e8402e99` message: `schedule` resolves before iOS's add completes. |
| `adr-countdown-marks-use-role-keys.md` | `countdown_marks.date_key` is `event:<id>`, `anniversary:<id>` or one of four fixed role keys, enforced by a check constraint. | 4.2 | `ef3ce77c` | 4.2's plan states the key forms but gives no reason for role keys over partner or couple ids; DW-380 is the consequence. |
| `adr-date-reminders-switch-is-a-push-preferences-column.md` | The switch is `push_preferences.date_reminders`, not its own table. | 4.3 | `def0010f` | Epic decision 2026-10-29: "kept on the account like the push switches". |

## Acceptance verdict

**Machine verdict: accepted-with-open-items.** The criteria are declared (Requirements R1–R12 and Done when 1–5). No human decision was taken in this headless run.

`pending_tickets` is empty: every one of the 8 rows is `done`.

Done when, against the evidence:
1. **Met on the owner's iPhone** (4.5 Result): day-before reminders at 09:00 for each kind, in airplane mode; month and week reminders for the marked event; on-the-day reminders for the anniversary, the relationship start, the wedding and both birthdays; none naming the daily message; a tap opening Home from a cold start and from the background.
2. **Met:**
   - marking on one device added the reminders on a second device (the simulator, after a fresh sign-in) and not the partner's (4.5; 4.2 on two simulators)
   - the switch off left nothing firing (4.5)

   Open item A6: a second device that is only resumed does not pick up the mark until its next cold start or reconnect.
3. **Met on the simulator:**
   - the soonest 64 were scheduled (4.1 AC2)
   - the cut moved on after a later open (4.8 check 6)
   - after sign-out none was scheduled (4.6 simulator; 4.5 device, where nothing fired)

   It was not re-run on the device, as the ticket's verify omits it.
4. **Met** for the older shell after a live update (4.5) and for the website (4.5, 0 console errors). The Home Screen web app was not checked, by the owner's decision of 2026-11-02, recorded in 4.5's Result.
5. **Met:** deploy run `41395344231` on `871463b0` succeeded, and the shell built from `871463b0` is installed on the owner's iPhone. Tests, CodeQL, Lighthouse and Deploy succeeded on `f07ce016` (4.5 Result), and Tests succeeded on `3f036bd3` (run `41404398009`). The Tests run on the later, post-epic HEAD `4f8238bf` was still in progress at the time of this retro.

No blocking finding stands. The open items are A2, A4, A6, A7, L1, L2 and L4–L17, routed above. L1 and L2 are the most consequential, but neither is an epic requirement as written: R6 covers the switch, not "Sign out of all devices", and no requirement names sound.

## Open questions

- **R4 and foreground returns (A6):** does "next open" include a foreground return? The answer decides between a fix and a spec reconciliation.
- **Sound (L2):** should reminders play a sound, and match pushes when the app is in front? Story 4.5 does not say whether the device run's reminders were audible.
- **"Sign out of all devices" (L1, L16):** should a partial result tell the person, and should the row ask for confirmation?
- **Decision records:** where should they live, given AGENTS.md's documentation policy?
- **Home Screen web app:** it was skipped by the owner's decision. Is a check wanted before the epic is closed?
- **Non-Gregorian calendars (L12):** is a simulator check worth running?

## Assumptions

Headless run: every choice below was made without the owner.

- **Epic reference:** `-H epic-date-reminders` was matched by slug in `tickets.py status`'s `epics` list (id 4). The folder is the parent of `epic_file` from `find`: `_bmad-output/initiative-my-love/tickets/epic-date-reminders/`.
- **`pending_tickets`:** the `status <folder>` output carried no `pending_tickets` key. All 8 rows read `status: done`, `state: done`, so the list was taken as empty.
- **Diff ranges:**
  - **Plan ranges:** each runs between consecutive loop/integration baselines. 4.2's is cut at its merge `eaee2310`, excluding main's #433 merge, and 4.4's at its merge `81cceccc`.
  - **Story 4.5:** its range is narrowed to its five commits named in its plan; the 26 CI commits were excluded.
  - **Review diff:** the review's diff excluded `_bmad-output/`, `package-lock.json` and `scripts/sim-driver/fixtures/`.
  - **PR #432 commits:** they are counted as this epic's work, including the mood and love-notes fixes (`3f551b1b`, `b64ceb38`, `a9e73a81`, `ccf6ab2d`) that PR #432's session made at the owner's request.
- **Behavior check:** not run by the retro. Recorded under Behavior verification.
- **Lens findings:** reviewer subagents reported them; each was re-checked against the cited file before routing. L2's device behavior, L9, L12 and L17 remain PLAUSIBLE or UNVERIFIED, as marked.
- **Verdict:** the machine verdict, accepted-with-open-items, was rendered with no human decision.
- **Proposals:** every action item and decision record above is proposed only. No ledger entry, ticket, plan, epic file or status was changed.
