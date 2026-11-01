---
title: 'Reminders re-plan on every change, stop at sign-out, stack with pushes and open Home'
type: 'feature'
ticket: '6'
created: '2026-11-01'
status: done
baseline_revision: 'ae0b9d5b49993a53e153678c56478d657e9508fb'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      A re-plan cancels only the ids `getPending` reports, so if a follow-up re-plan's `getPending` misses requests the previous run just scheduled, ids above the new N stay pending.
    evidence: |-
      Quick review finding, verdict maybe-false. The plugin's `schedule` calls `center.add` and resolves without waiting for its completion (LocalNotificationsPlugin.swift:211-227), and this story makes back-to-back re-plans routine (single-flight follow-up, copy-write bursts). Whether a `getPendingNotificationRequests` issued right after can miss an `add` still in flight is undocumented. On the simulator in this pass, a delete took the list from 12 to 10 and both stale ids were cancelled, but a single run does not settle the race. To settle it, schedule N and then immediately run getPending in a loop on a device or simulator and check whether it ever lists fewer than N. The fix, if needed, is the sign-out cancel's id union (1..64 plus pending) in scheduleDateReminders' cancel step.
    location: >-
      src/services/dateReminders.ts scheduleDateReminders
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Story 1 plans date reminders only once per signed-in start, from store state that may not have loaded, so a launch can wipe reminders it cannot replace. Nothing re-plans on foreground or a date change. Sign-out leaves the reminders pending. Reminders stack apart from the non-love-note pushes, and a tap opens nothing.

**Approach:** Plan every time from the saved local copies of all five date kinds, and skip the whole re-plan when any copy is missing or unreadable. Run that one re-plan, single-flight and serialized with the other native calls, on four triggers:
- the signed-in start (story 1's trigger, kept);
- the push permission answer;
- every return to the foreground;
- every successful write of a date kind's local copy.

Sign-out cancels the reminders through `deleteAccountData()`. Every reminder carries thread id `partner-activity`. A reminder tap goes through story 3.9's tap fan-out to Home.

## Boundaries & Constraints

**Always:**
- Loaded-data-only. A re-plan reads the saved copies of `events`, `anniversaries`, `couple-settings`, `profile` and `partner` for the current `userId`. If any read returns `null` (absent, failed or malformed), no plugin call is made and the pending list stays. Copies are written only from server answers and confirmed writes (`localCopy.ts` header), so they are "loaded copies or a successful read".
- Single-flight. While one re-plan runs, any number of further requests collapse into one more run after it.
- Serialization. Every native reminder call runs in one serial chain, so a sign-out cancel never interleaves with a schedule: `scheduleDateReminders`'s body and the sign-out cancel both go through it.
- Identity. A run captures `{ userId, authSessionVersion }` before its first await and re-checks it before every plugin call, as story 1 does.
- The sign-out cancel removes ids `1..MAX_SCHEDULED_REMINDERS` plus every id `getPending` reports, so a pending list that lags (`schedule` resolves before iOS's `add` completes) cannot keep one. It runs in `deleteAccountData()`, so a sign-out, an account switch and a no-session boot all cancel.
- Every scheduled reminder carries `threadIdentifier: 'partner-activity'`. That is `PARTNER_ACTIVITY_THREAD_ID` in `supabase/functions/send-push/payload.ts`; keep a comment naming that constant.
- Tap. A `localNotificationActionPerformed` with `actionId === 'tap'` routes `'home'` through the same deliver-or-hold path as the push taps. A cold-start tap is kept until a handler subscribes (`onPushTap`). The plugin retains the event until a listener exists. Any other `actionId` does nothing.
- Every native call stays behind `hasNativeReminders()`. The web and an older shell do nothing: no listener, no plugin call, no IndexedDB read, no error.
- Never throws. Failures are logged, and only failures are logged (Vitest teardown rule, AGENTS.md).
- Match the surrounding style by hand. Never run Prettier.

**Never:**
- No countdown marks, no month or week reminders, no Settings switch (stories 2 and 3).
- No `@capacitor/app` plugin and no native code change. Foreground is `document.visibilitychange` to `visible`, as `PushSettings.tsx` uses it.
- No new `registerLocalCopy` kind, IndexedDB store or store field.
- No server refresh on foreground. The foreground trigger plans from the copies.
- No prompt for permission.
- No change to the planner's output, Home's cards or `send-push`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All five copies saved | signed in, native | cancel and schedule from the copies, thread `partner-activity` | none |
| One copy missing or unreadable | e.g. no `events` copy | no plugin call; pending list kept | none |
| Own edit | `addAnniversary` succeeds and writes its copy | one re-plan that includes it | none |
| Partner's change arrives | a refresh writes the `partner` or `events` copy | re-plan | none |
| Non-date kind written | `love-notes` copy | no re-plan | none |
| Copy written for a non-current user | `writeLocalCopy(B, …)` while A is signed in | no re-plan | none |
| Return to foreground | `visibilitychange`, visible | re-plan; hidden does nothing | none |
| Burst of triggers | 5 copy writes + launch | runs never overlap; ≤ 1 queued follow-up | none |
| Push permission answered | `startPushRegistration()` → `'registering'` | re-plan | none |
| Sign-out / switch / no-session boot | `deleteAccountData(id)` | ids 1..64 ∪ pending cancelled, after any in-flight schedule | logged |
| Earliest reminders pass | 70 due; clock passes the soonest | the next plan's 64 move on | none |
| Reminder tapped, warm or cold | `actionId: 'tap'` | `onPushTap` handlers get `'home'`; a tap before subscribe is held | logged |
| Web / older shell | `hasNativeReminders()` false | nothing | none |

</intent-contract>

## Code Map

- `src/services/dateRemindersAtLaunch.ts` -- story 1's launch step, `scheduleDateRemindersAtLaunch(owner)`. It reads events from the copy, but the other four kinds from the store, which is the gap. Rebuild it around `replanDateReminders()`:
  - single-flight, all five copies;
  - it keeps `scheduleDateRemindersAtLaunch(owner)` as the launch wrapper: it returns unless `owner` is current, then requests a re-plan;
  - it adds `startDateReminderTriggers(): () => void`, which wires the foreground and copy-write triggers and returns a stop function.

  The file name and the export stay, because `tests/unit/App.localCopyRefresh.test.tsx` mocks this module.
- `src/services/dateReminders.ts` -- store-free; keep it so. Add:
  - the serial native chain;
  - `REMINDER_THREAD_ID`;
  - `threadIdentifier` on each scheduled item;
  - `cancelDateReminders()`;
  - `listenForReminderTaps()`, which adds the listener once, retries after a failed add, and no-ops off native.

  `scheduleDateReminders` keeps its signature. Its body now runs inside the chain.
- `src/services/localCopy.ts:107` `writeLocalCopy` -- after a successful `put`, notify listeners `(userId, kind)`. Add `onLocalCopyWritten(listener): () => void`. A throwing listener is caught and logged. Update the header's API list. The module must not import the store.
- Copy readers, each `(userId) => Promise<T | null>` over `readLocalCopy`:
  - `src/stores/slices/settingsSlice.ts`: export `readSavedAnniversaries`, `readSavedCoupleSettings` and `readSavedOwnProfile`, built on the private `parseSavedAnniversaries`, `parseSavedCoupleSettings` and `parseSavedOwnProfile` and the kinds `ANNIVERSARIES_COPY_KIND`, `COUPLE_SETTINGS_COPY_KIND` and `PROFILE_COPY_KIND`.
  - `src/stores/slices/partnerSlice.ts`: export `readSavedPartner`, from `normalizePartnerCopy` and `PARTNER_COPY_KIND`. It returns a `PartnerCopy`, whose `{status:'unlinked'}` is a loaded answer.
  - `src/stores/slices/eventsSlice.ts`: `readSavedEvents` already exists.
- `src/stores/slices/authSlice.ts:66` `deleteAccountData` -- add the fire-and-forget `cancelDateReminders()` beside the deletes, with the same `.catch` log pattern. Update its doc comment.
- `src/services/pushNotifications.ts`:
  - Extract the deliver-or-hold body of the `pushNotificationActionPerformed` listener (`:240-252`) into an exported `routeNotificationTap(view: ViewType)`. Both the push listener and the reminder listener call it.
  - Update the header's "Not here yet" line. The module stays store-free.
- `src/App.tsx`:
  - `:417-424`, the launch effect: keep it.
  - `:426-432`, the push effect: `startPushRegistration().then(o => o === 'registering' && …)` requests a re-plan with the start's captured owner. This closes story 1's deferred first-sign-in gap.
  - Add `useEffect(() => startDateReminderTriggers(), [])`.
  - In the `onPushTap` effect (`:438-446`), also call `void listenForReminderTaps()` once on mount.
- Tests and helpers:
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- story 1's launch tests seed four kinds through the store. Rewrite `seedOneOfEachKind` to write all five copies with `writeLocalCopy`, and keep every assertion. "No saved events copy" flips to "no plugin call".
  - `tests/unit/stores/accountDataFixtures.ts` holds the shared helpers.
  - `tests/unit/stores/signOutStopsDevicePushes.test.ts` is the pattern for sign-out transitions. Its `pushNotifications` mock has only two exports, which is fine while nothing calls `routeNotificationTap` there.
- Thread id: `supabase/functions/send-push/payload.ts:42`.
- Tap listener: `node_modules/@capacitor/local-notifications/ios/.../LocalNotificationsHandler.swift:73-98`. It maps the default action to `'tap'` and retains the event until a listener exists.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/localCopy.ts` -- add the write listeners (`onLocalCopyWritten`) and notify after a successful `put`. -- this is the date-change trigger.
- [x] `src/stores/slices/settingsSlice.ts`, `src/stores/slices/partnerSlice.ts` -- export the four copy readers. -- the plan reads only loaded copies.
- [x] `src/services/dateReminders.ts` -- add the serial chain, the thread id, `cancelDateReminders` and `listenForReminderTaps`. Update the header. -- the native half.
- [x] `src/services/pushNotifications.ts` -- extract `routeNotificationTap`. -- tap reuse.
- [x] `src/services/dateRemindersAtLaunch.ts` -- add `replanDateReminders`, the launch wrapper and `startDateReminderTriggers`. Date kinds: events, anniversaries, couple-settings, profile, partner. -- all the triggers.
- [x] `src/stores/slices/authSlice.ts` -- cancel in `deleteAccountData`. -- the sign-out cancel.
- [x] `src/App.tsx` -- add the triggers effect, the tap listener and the re-plan after the permission answer. -- the wiring.
- [x] `src/services/__tests__/dateReminders.test.ts` -- add cases for:
  - the thread id on every item;
  - `cancelDateReminders`: the web no-op, the union of ids, a rejection logged;
  - the chain: a cancel requested during an in-flight `schedule` runs after it;
  - the tap: warm, cold (held until `onPushTap`), `dismiss` ignored, no listener off native;
  - the soonest-64 cut moving on as `now` passes the earliest.
  -- Verify's unit coverage.
- [x] `tests/unit/stores/dateRemindersAtLaunch.test.ts` -- seed from copies, and cover:
  - each I/O row about copies, triggers, identity and single-flight;
  - the own-edit path through a real `addAnniversary`, with `anniversariesService` mocked;
  - a partner's change, as a refresh writing the `partner` copy;
  - the foreground trigger;
  - a stopped trigger set, which does nothing.
  -- the triggers and the loaded-data rule.
- [x] `tests/unit/stores/signOutStopsDevicePushes.test.ts`, or a sibling `signOutCancelsDateReminders.test.ts` -- sign-out, a switch and a no-session boot each call the cancel; a fresh sign-in with no leftover does not. -- the sign-out cancel.
- [x] `tests/unit/App.localCopyRefresh.test.tsx` -- extend the mocks with the new exports. Check that `startDateReminderTriggers` is wired on mount, and that a `'registering'` outcome requests a re-plan with the start's identity. -- wiring coverage.

**Acceptance Criteria:**

The simulator checks run on the local stack, through `scripts/sim-driver/sim`, after `sim dates kinds`, `sim build` and `sim signin`. `sim pending` lags the real list after a schedule, so read it after the plist's mtime passes the action, or relaunch first.
- Given that setup, when the shell is relaunched, then every `sim pending` entry has `threadId` `partner-activity`.
- Given a signed-in shell, when Casey adds or edits an anniversary in Settings, then `sim pending` lists that anniversary's reminders without a relaunch.
- Given a signed-in shell, when the partner's event is added on the server and the shell shows Home again, then its `Tomorrow:` reminder is listed.
- Given a signed-in shell, when the shell is backgrounded and foregrounded, then the console shows a fresh getPending, cancel and schedule run, and the list is unchanged.
- Given Kong stopped (`docker stop supabase_kong_My-Love`), when the shell is relaunched and foregrounded, then the list is the same as before; afterwards run `docker start supabase_kong_My-Love`.
- Given a signed-in shell with reminders, when `sim signout` runs, then `sim pending` prints `[]`.
- Given `sim build --from ae0b9d5b49993a53e153678c56478d657e9508fb` plus `serve-update`, when that shell takes this tree's bundle, then Home renders with no error lines, and `sim pending` exits 0. Afterwards clean up with `serve-update --stop`, `sim build`, `sim dates clear` and `sim provision`.

## Implementation Notes

- Implemented by the step-03 subagent from this plan. The sign-out cases went into a sibling `tests/unit/stores/signOutCancelsDateReminders.test.ts`. `dateRemindersAtLaunch.test.ts` stubs `cancelDateReminders`, because its account-switch cases would otherwise call the plugin from the sign-out cancel; the real cancel is covered in `dateReminders.test.ts` and the sign-out test.
- `readSavedPartner` checks the copy's shape itself, because `normalizePartnerCopy` passes any non-`linked` object through.
- Added in verification: `replanDateReminders(owner)` returns at once when `owner` is no longer the store identity. Without that, a late request from a replaced start (the push-permission `.then`) could overwrite the queued follow-up's owner and drop the current account's re-plan. The new single-flight test fails without the guard.
- The older-shell check used a shell built from b7d7ac09 (before the epic, with no LocalNotifications plugin), as the ticket's "a shell built before this epic" requires. The AC's ae0b9d5b already carries the plugin.
- The own-edit check deleted an anniversary in Settings rather than adding one, because the sim driver has no text entry.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 5 findings — high 0, medium 2, low 2, false 0, maybe-false 1
- findings:
  - `[maybe-false]` `[defer]` A back-to-back re-plan cancels only `getPending`'s ids, so a lagging pending list could leave ids above the new N pending. `schedule` resolves before `center.add` completes (LocalNotificationsPlugin.swift:211-227), but whether a following `getPendingNotificationRequests` can miss that add is undocumented. This pass's simulator delete (12 to 10) cancelled both stale ids. To settle it, loop schedule then getPending and look for a short list. Deferred as medium (unverified).
  - `[medium]` `[patch]` `PushSettings.test.tsx` mocks native with every plugin available but not `@capacitor/local-notifications`, so `clearAuth()` in `beforeEach` now logs two TypeErrors from the sign-out cancel. That makes `expect(console.error).toHaveBeenCalled()` (line 334) pass vacuously. Confirmed by reading the mocks. Fixed: added a resolving `@capacitor/local-notifications` mock.
  - `[low]` `[patch]` Ledger DW-370 (story 1's first-sign-in permission gap) is still open, though this change closes it. Fixed: set to `done 2026-11-01` with a resolution naming the App push-effect re-plan and its test.
  - `[low]` `[patch]` The App launch-effect comment still says the plan follows `refreshLocalCopies()` because each kind "applied its copy to the store". Fixed: it now says the re-plan reads the five saved copies, and covers an offline start.
  - `[medium]` `[patch]` The seven simulator ACs were unverified. Fixed by running all seven on the iPhone Duo simulator against the local stack; all pass (Auto Run Result).

## Design Notes

Plan from copies, not the store, because the store cannot tell "not loaded" apart for these kinds:
- `settings.relationship.anniversaries` starts as `[]`;
- `partner` is `null` both when unlinked and before it has loaded;
- the events list is filled only by Home's own load.

A copy exists only after a server answer or a confirmed write, which is exactly the epic's rule. The write hook fires after the copy lands, so a re-plan triggered by an edit reads the new value; a store subscription would fire before `writeLocalCopy`.

A missing kind skips the whole re-plan rather than planning the others. Planning the others would cancel that kind's pending reminders, which is the wipe the rule forbids.

The sign-out cancel covers ids 1..64 on top of the pending ids because ids are positional (`1..N`, story 1), and story 1 found `getPending` lagging a fresh `schedule`.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/dateReminders.test.ts tests/unit/stores/dateRemindersAtLaunch.test.ts tests/unit/stores/signOutStopsDevicePushes.test.ts tests/unit/App.localCopyRefresh.test.tsx` -- expected: all pass.
- `npm run test:unit` -- expected: green.
- `SEED=1 npm run test:unit:coverage` -- expected: green, so the shuffled order holds.
- `npm run lint` and `npm run typecheck` -- expected: clean.
- `fnox exec -- npm run build` -- expected: exit 0, with `dist/` left as a production build.
- The simulator ACs above, against `supabase start`.


## Auto Run Result

Status: built

**Summary:** Date reminders now re-plan on every change and stop at sign-out. Every reminder joins the partner-activity lock-screen stack, and a tap opens Home.
- **Source of each plan:** the saved local copies of all five date kinds. If any copy is missing or unreadable, the whole re-plan is skipped and the pending list stays.
- **Triggers:**
  - the signed-in start (story 1's trigger);
  - the push permission answer, which closes DW-370;
  - every return to the foreground (`visibilitychange`);
  - every successful write of a date kind's copy (`onLocalCopyWritten`), covering the person's own edits and a partner's changes arriving.
- **Concurrency:** re-plans are single-flight, and every native call runs in one serial chain.
- **Sign-out:** `deleteAccountData()` cancels ids 1..64 plus every pending id.
- **Grouping:** every reminder carries thread id `partner-activity`.
- **Tap:** a tap goes through story 3.9's deliver-or-hold fan-out (`routeNotificationTap`) to Home, cold start included.
- **Web and older shells:** nothing runs there.

**Files changed:**
- Source:
  - `src/services/localCopy.ts`: write listeners (`onLocalCopyWritten`).
  - `src/stores/slices/settingsSlice.ts`, `src/stores/slices/partnerSlice.ts`: copy readers for anniversaries, couple settings, profile and partner.
  - `src/services/dateReminders.ts`: the serial native chain, `REMINDER_THREAD_ID`, `cancelDateReminders`, `listenForReminderTaps`.
  - `src/services/pushNotifications.ts`: `routeNotificationTap`, extracted from the push tap listener.
  - `src/services/dateRemindersAtLaunch.ts`: `replanDateReminders` (copies only, single-flight, stale-owner guard), the launch wrapper, `startDateReminderTriggers`.
  - `src/stores/slices/authSlice.ts`: the sign-out cancel in `deleteAccountData`.
  - `src/App.tsx`: the triggers effect, the tap listener, and the re-plan on a granted permission.
- Tests:
  - `src/services/__tests__/dateReminders.test.ts`: thread id, cancel, chain order, taps, and the moving 64 cut.
  - `tests/unit/stores/dateRemindersAtLaunch.test.ts`: copies, the loaded-only rule, single-flight, each trigger.
  - `tests/unit/stores/signOutCancelsDateReminders.test.ts` (new): every account-leaving transition.
  - `tests/unit/App.localCopyRefresh.test.tsx`: wiring.
  - `src/components/Settings/__tests__/PushSettings.test.tsx`: the local-notifications mock.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-370 closed.

**Review (quick lens, 5 findings: 2 medium, 2 low, 1 maybe-false):**
- **Patched:** 4.
  - The PushSettings mock (medium).
  - The simulator ACs run (medium).
  - DW-370 closed (low).
  - The App comment (low).
- **Deferred:** 1, the re-plan's pending-only cancel against a lagging `getPending` (maybe-false; medium if true).
- **Rejected:** 0.

**Follow-up review recommended:** false. Two medium entries were patched, but neither leaves a named unverified risk:
- one is a test mock, proven by the green suite;
- the other is the simulator run itself, which passed.

Patched counts by verdict: high 0, medium 2, low 2.

**Verification (patched tree):**
- **Static and unit checks:**
  - `npm run test:unit`: 218 files, 3549 tests pass.
  - `SEED=1` and `SEED=7 npm run test:unit:coverage`: exit 0.
  - `npm run lint`: clean.
  - `npm run typecheck`: 0 errors.
  - `fnox exec -- npm run build`: exit 0, so `dist/` is a production build.
- **Mutation:** removing the stale-owner guard fails the new single-flight test; the guard was restored.
- **Simulator** (iPhone Duo A0A486ED, local stack, no person; shell built from this tree, `sim dates kinds`, `sim signin`):
  - **thread id:** after a relaunch, 11 reminders, every `threadId` `partner-activity`, all `{…, hour:9, minute:0}` calendar triggers.
  - **own edit:** deleting anniversary `First dance` in Settings took the list from 12 to 10 with no relaunch, and both its reminders were gone.
  - **partner's change:** an event inserted for Jessie (`Partner picnic`); Mood, then Home; `Tomorrow: Partner picnic` was listed within 8 s, with no relaunch.
  - **foreground:** after a background and foreground, the PendingNotifications.plist was rewritten after the foreground, with the same 10 reminders.
  - **failed reads:** with `supabase_kong_My-Love` stopped, a relaunch and a foreground re-planned (plist rewritten) and left the identical 10 (title, trigger and thread compared). Kong was restarted.
  - **sign-out:** `sim signout` then a relaunch: `sim pending` printed `[]`, exit 0.
  - **older shell:** shell built from b7d7ac09 (pre-epic, no plugin) with `serve-update --port 8791`. CapgoUpdater logged "Current bundle loaded successfully" for `sim-tree-1793527253` (this tree). The `--console-pty` capture had no error lines and no LocalNotifications call, Home rendered (screenshot), and `sim pending` gave `[]` with exit 0.
  - **cleanup:** `serve-update --stop`, `sim build`, `sim dates clear`, `sim provision`.

**Residual risks:**
- The deferred `getPending` lag on back-to-back re-plans.
- The tap to Home and the moving 64 cut are unit-tested only. A reminder must fire for the device check, which story 8 owns.
- Whether `visibilitychange` fires when iOS's permission alert closes is still unknown. The push-permission re-plan covers the first sign-in instead.
- A device whose copies never all load (for example, a couple-settings lookup that keeps failing) schedules nothing until they do, by the loaded-data-only rule.
