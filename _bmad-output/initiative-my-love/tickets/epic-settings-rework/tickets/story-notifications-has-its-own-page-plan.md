---
title: 'Notifications has its own page'
type: 'feature'
ticket: '6'
created: '2026-11-03'
status: done
baseline_revision: '41a877b0329d5e23124e1f9fa48096cc0d298c68'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-my-love/ux-settings-page/DESIGN.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The push switches and the Date reminders switch still sit in the old "Push and reminders" section on the top Settings page (`PushSettings` with `CountdownMarks` inside it), with helper lines on every row and no Notifications row (R11, R1).

**Approach:** Turn `PushSettings` into the Notifications subpage (`/settings/notifications`, large title, available only with `hasNativePush()`): the permission Notice re-read on open and on each return to the foreground, group `Notify me about` with five switches without helper lines, group `Reminders` with the Date reminders switch (moved out of `CountdownMarks`) and its Footnote, and one Error box. Add the top page's Notifications row (Preferences group, before Photos) whose value is `On` / `Off` / `Some`. The per-date reminder list (`CountdownMarks`, without the Date reminders switch) stays on the top page under the rows until story 13.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md Voice and Tone (`Notify me about`, `Love notes`, `Moods`, `Photos`, `Pokes and kisses`, `Partner requests`, `Reminders`, `Date reminders`, Footnote `At 9:00 the day before, and on the day for birthdays and anniversaries.`, Notice `Notifications are off for My Love. Turn them on in iOS Settings.`, load errors `Couldn't load your push settings.` and `offlineMessage('Push settings', 'load')`). Offline refusals stay today's: `offlineMessage('Push settings')` for a push switch, `offlineMessage('Reminders')` for Date reminders, checked with `isOnline()` before any request. Switches save server first, are disabled while their own save runs and until `pushPreferences` has loaded, and stay usable with the permission denied. Kit classes and tokens only, no `dark:` variant, no new palette. Register the page in `SUBPAGES` and open it with `SettingsRow target` (AGENTS.md Settings-subpage rule); never `pushState` by hand. Match surrounding style by hand (no `prettier --write`). Every test assertion moved keeps what it checked.

**Never:** No change to `notificationsSlice`, `pushPreferencesService`, `datesSlice` or which writes need a connection. Do not disable the per-date `CountdownMarks` rows while Date reminders is off (story 10–12's date pages do that; story 13 removes the list). No Dates switch. No new local-copy kind. No screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Row value On | permission granted, all five push switches and Date reminders on | row reads `On` | — |
| Row value Some | permission granted, one switch off | `Some` | — |
| Row value Off (switches) | permission granted, all six off | `Off` | — |
| Row value Off (permission) | permission `denied`, any switches | `Off`; on return to the foreground with permission granted, the value recomputes | — |
| Row value unknown | `pushPreferences` null, or permission not read yet and not denied | no value shown (never `Loading...`) | — |
| No reminders plugin | `hasNativePush()` true, `hasNativeReminders()` false | page has no `Reminders` group; row value counts only the five push switches | — |
| Website / old shell | `hasNativePush()` false | no Notifications row; `/settings/notifications` falls back to the top page; no `push_preferences` request | — |
| Switch tap | online | switch disabled while saving, then shows new state | failure: switch stays, Error box shows the service's message, cleared on the next tap |
| Switch tap offline | `navigator.onLine` false | no request; Error box shows today's `offlineMessage` refusal | — |
| Load failed / offline load | nothing saved, read fails / offline | today's strings under the `Notify me about` card; switches disabled | — |

</intent-contract>

## Code Map

- `src/components/Settings/PushSettings.tsx` -- today's section: `ROWS` (keys, `settings-push-<testId>` ids, icons), permission effect (`getPushPermission` on mount + `visibilitychange`), load effect (`loadPushPreferences` on mount + `online`), `toggle` with per-key `saving` set, load-error/offline lines, `NOTICE`. Becomes `NotificationsPage.tsx` (`git mv`); drop the `helper` field, the `Push and reminders` h2, the inner `Pushes` h3 and the `<CountdownMarks />` render.
- `src/components/Settings/CountdownMarks.tsx` -- the `Date reminders` `SwitchRow` (`settings-reminders-switch`, `Bell`, `REMINDERS_HELPER`), `toggleReminders`, `savingReminders`, `pushPreferences`/`setPushPreference` selectors move to the page; the per-date rows, its `Reminders` h3, empty line and error stay. Update its header doc (top page, until story 13; gate is `hasNativeReminders()` alone now).
- `src/components/Settings/SwitchRow.tsx` -- `helper` becomes optional; with none, no helper span and no `aria-describedby`. CountdownMarks' per-date rows keep their helper.
- `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsGroup` gains optional `footnote?: ReactNode` rendered after the card inside the group's wrapper (`flex flex-col gap-2`, also when unlabeled), so a Footnote or a load-error line sits 8px under its card (DESIGN Layout rhythm).
- `src/components/shared/kitClasses.ts` -- add `FOOTNOTE = 'px-1 text-[13px] leading-[1.4] text-muted'` (DESIGN `typography.footnote`, 4px inset); reused by later date pages.
- `src/components/Settings/Settings.tsx:530-540` -- `SUBPAGES`: add `notifications` (`title: 'Notifications'`, `titleStyle: 'large'`, `available: hasNativePush`, `render: () => <NotificationsPage />`). `:699-709` Preferences group: Notifications row first (`hasNativePush() && <NotificationsRow key="notifications" />`). `:850-851` replace `<PushSettings />` with `<CountdownMarks />`. Header doc 1-14 updated. `PushSettings` import goes.
- `src/services/pushNotifications.ts:231,297-320` -- `hasNativePush()`, `PushPermission`, `getPushPermission()`; reuse, do not change.
- `src/services/dateReminders.ts` -- `hasNativeReminders()`; reuse.
- `src/components/Settings/__tests__/PushSettings.test.tsx` -- becomes `NotificationsPage.test.tsx` (`git mv`); its mocks (`hasNativePush`, `getPushPermission`, service) are the pattern. `CountdownMarks.test.tsx:379-520` (`the Date reminders switch` describe) moves into it.
- `src/components/Settings/__tests__/Settings.mobileDataPhotos.test.tsx` and `settingsStackKit.ts` -- the pattern for a top-page row test (store reset, `onPopState`, path assertions).
- `tests/e2e/settings/push-switches-web.spec.ts` -- the website check to update.
- `tests/support/helpers/settings-screen.ts` -- `openSettingsFromHome`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/shared/kitClasses.ts` -- add `FOOTNOTE`.
- [ ] `src/components/Settings/SwitchRow.tsx` -- optional `helper`; doc updated.
- [ ] `src/components/Settings/stack/SettingsRows.tsx` -- `footnote` prop on `SettingsGroup`.
- [ ] `src/components/Settings/NotificationsPage.tsx` (git mv from `PushSettings.tsx`) -- export `NotificationsPage` (root `data-testid="settings-notifications"`, `flex flex-col gap-4`): Error box first (`FAILURE_BOX flex items-start gap-2`, `CircleAlert` icon, `role="alert"`, `data-testid="settings-notifications-error"`, one shared error state cleared at the start of any switch tap), then the Notice (`settings-push-permission-off`) when permission is `denied`, then `SettingsGroup label="Notify me about"` with the five `SwitchRow`s (no helper; ids unchanged) and as footnote the offline/load-error lines (`settings-push-offline`, `settings-push-load-error`), then, only when `hasNativeReminders()`, `SettingsGroup label="Reminders"` with the Date reminders `SwitchRow` (`settings-reminders-switch`, `Bell`, no helper; disabled while `pushPreferences` is null or its save runs) and footnote `<p className={FOOTNOTE} data-testid="settings-reminders-footnote">`. Also export `usePushPermission(): PushPermission | null` (null until the first read; re-read on mount and on `visibilitychange` to visible; cancelled flag), `notificationsSummary(prefs, permission, withReminders): 'On' | 'Off' | 'Some' | undefined` (denied → `Off`; prefs or permission null → undefined; else over the five push keys plus `dateReminders` when `withReminders`), and `NotificationsRow` (loads push preferences on mount and on `online` as today; `SettingsRow icon={Bell} label="Notifications" value={…} target="notifications" testId="settings-notifications-row"`). Header doc rewritten.
- [ ] `src/components/Settings/CountdownMarks.tsx` -- remove the Date reminders switch and everything only it used; doc updated.
- [ ] `src/components/Settings/Settings.tsx` -- as Code Map.
- [ ] `src/components/Settings/__tests__/NotificationsPage.test.tsx` (git mv from `PushSettings.test.tsx`) -- adapt every case to `NotificationsPage`: group labels as headings, five push switches then Date reminders in order, no `-helper` elements, Footnote text, Error box id; move in the Date reminders cases from `CountdownMarks.test.tsx` (saves on tap, disabled until loaded and while saving, offline refusal `offlineMessage('Reminders')`, failure message, log message asserted exactly); add: no Reminders group without `hasNativeReminders()`; `notificationsSummary` table (every I/O row above); `NotificationsRow` value follows a switch save and a `visibilitychange` permission change; nothing renders and nothing is fetched by the row when `hasNativePush()` is false (assert at `Settings` level).
- [ ] `src/components/Settings/__tests__/CountdownMarks.test.tsx` -- drop the moved describe; assert the card has no `settings-reminders-switch`.
- [ ] `src/components/Settings/__tests__/Settings.notifications.test.tsx` (new) -- with `hasNativePush` mocked true: the Preferences group shows the Notifications row before Photos with its value; tapping it opens `/settings/notifications` showing the `Notifications` title and the switches; back returns to the top page with focus on the row. Mocked false: no row, and `/settings/notifications` falls back to the top page.
- [ ] `tests/e2e/settings/push-switches-web.spec.ts` -- the browser has no Notifications row (`settings-notifications-row` count 0, no `Notifications` row button), the old section, headings and switches stay absent, opening `/settings/notifications` directly lands on the top page, and neither `push_preferences` nor `countdown_marks` is requested; header doc updated.

**Acceptance Criteria:**
- Given the shell with the push plugins, when Settings opens, then Preferences shows `Notifications` with its value, and tapping it slides in the Notifications page with the Notice (when denied), `Notify me about` (five switches, no helper lines) and `Reminders` (Date reminders and its Footnote).
- Given the Notifications page, when any switch is tapped online, then it saves on tap and the top page's row value reflects it on return without a reload.
- Given the website, when Settings opens or `/settings/notifications` is loaded, then no Notifications row or page appears.
- Given the shell with the reminders plugin, when Settings' top page is shown, then the per-date reminder list is still there under the rows, without a Date reminders switch.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; `PushSettings.tsx` and its test moved with `git mv` to `NotificationsPage.tsx` and `NotificationsPage.test.tsx`.
- Deviation: `usePushPermission`, `notificationsSummary` and the five push keys live in `src/components/Settings/notificationsStatus.ts`, not `NotificationsPage.tsx`: exporting a hook and a function beside components drew two `react-refresh/only-export-components` lint warnings, and lint was clean at the baseline.
- `CountdownMarks` now wraps its card and error in a `flex flex-col gap-2` div and puts a divider only between rows, since the Date reminders switch no longer precedes the first one.
- The two save-failure logs now start with `[NotificationsPage]`; tests assert them exactly.
- E2E ran through the scratch `supabase` CLI shim from story 5.5's session (CLI 3.0.0 cannot read `supabase status`); nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 5, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The Notifications row lost its value for a moment on every return to the top page: `SettingsStack` remounts the page (`key={path}`) and `usePushPermission` began at `null`, so `notificationsSummary` answered `undefined` until `checkPermissions()` replied, although `pushPreferences` was already in the store — fixed: `notificationsStatus.ts` keeps the last permission read in a module variable that seeds the hook and is updated on every read; a remount still re-reads. Because that cache outlives a test, `resetPushPermissionForTests()` is exported and called in both test files' `beforeEach`, so a shuffled order (CI's `--sequence.shuffle`) cannot hand one test another's `denied`.
  - `[low]` `[patch]` The offline-load and load-failed lines under the `Notify me about` card used `FIELD_ERROR`'s `mt-1`, sitting 12px under the card with no 4px inset — fixed: they use `px-1 text-sm text-danger`, 8px under the card like a Footnote.
  - `[low]` `[patch]` `Settings.tsx` comment above the last card still said the old push section follows — fixed: it names the Account and Countdowns sections and the per-date reminder list.
  - `[low]` `[patch]` Doc lines in `NotificationsPage.tsx`, `SwitchRow.tsx` and `SettingsRows.tsx` ran past the surrounding wrap (two over the 100-column print width) — fixed: rewrapped with the same words; the long `partnerRequests` ROWS entry is split.
  - `[low]` `[patch]` `Settings.notifications.test.tsx` "shows a switch saved on the page in the row on return, without a reload" set `fetchPushPreferences` to the saved value, so the row's own re-read would have produced `Some` without the store — fixed: after the save the read stays pending, so `Notifications, Some` can only come from the store; the test settles it at the end so the account-data queue does not block later tests.

## Design Notes

- The row's value counts Date reminders only where `hasNativeReminders()` is true: EXPERIENCE says rows and switches that need a missing plugin are hidden, so a hidden switch must not turn the value to `Some`. `Off` uses `denied` only, matching the Notice; `prompt` is not "off".
- The value stays empty until both the permission and the switches are known (except `denied`, which alone decides `Off`), so it never flashes `On` before turning `Off`.
- One Error box per page replaces the two inline error lines; the next tap of any switch clears it, and leaving the page unmounts it.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (the worktree TS2883 baseline excepted if it was present before the change).
- `npm run lint` -- expected: exit 0.
- `npx vitest run src/components/Settings` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings` -- expected: pass (local stack; use the scratch `supabase` CLI shim as stories 5.4 and 5.5 did if CLI 3.0.0 cannot read `supabase status`).

**Manual checks (if no CLI):**
- `grep -rn "PushSettings\|Push and reminders\|When your partner" src tests` -- expected: no match outside comments that describe history.
- Simulator, when `scripts/sim-driver/README.md`'s prerequisites are met: `sim build`, `sim signin`, open Settings, check the Notifications row value, `sim tap` into the page and on one switch, confirm it flips and the row value follows on back; otherwise record it as not run.

## Auto Run Result

Status: built

**Summary.** Settings has a Notifications page (`/settings/notifications`, large title), registered in `SUBPAGES` with `available: hasNativePush`, so the website and a shell without the push plugins never show it. The page shows the Error box, the permission Notice while iOS reports `denied` (re-read on open and on each return to the foreground), `Notify me about` with the five push switches and no helper lines, and, with the local-notifications plugin, `Reminders` with the Date reminders switch (moved out of `CountdownMarks`) and its Footnote. Switches save server first, are disabled while their own save runs and until the switches load, and stay usable with the permission off. The offline refusals and load strings are unchanged. The top page's Preferences group starts with the Notifications row, shown only with `hasNativePush()`. Its value is `On`, `Off` or `Some`: `Off` when the permission is denied, and Date reminders is counted only where its switch exists. The value stays empty until it is known. The per-date reminder list stays on the top page under the rows, without the Date reminders switch, until story 13.

**Files changed**
- `src/components/Settings/NotificationsPage.tsx` (moved from `PushSettings.tsx`): the page and `NotificationsRow`.
- `src/components/Settings/notificationsStatus.ts` (new): `usePushPermission` (last read cached across remounts), `notificationsSummary`, `PUSH_SWITCH_KEYS`, `resetPushPermissionForTests`.
- `src/components/Settings/Settings.tsx`: the `notifications` subpage, the Notifications row, and `CountdownMarks` in place of `PushSettings`; doc and comments updated.
- `src/components/Settings/CountdownMarks.tsx`: the Date reminders switch is removed; the per-date rows are unchanged.
- `src/components/Settings/SwitchRow.tsx`: `helper` is optional.
- `src/components/Settings/stack/SettingsRows.tsx`: `SettingsGroup` gains `footnote`.
- `src/components/shared/kitClasses.ts`: `FOOTNOTE`.
- `src/components/Settings/__tests__/NotificationsPage.test.tsx` (moved from `PushSettings.test.tsx`): page, row and summary cases, with the Date reminders cases moved in from `CountdownMarks.test.tsx`.
- `src/components/Settings/__tests__/Settings.notifications.test.tsx` (new): the row's order, value, navigation, website fallback and no-read cases.
- `src/components/Settings/__tests__/CountdownMarks.test.tsx`, `SwitchRow.test.tsx`: updated.
- `tests/e2e/settings/push-switches-web.spec.ts`: the browser has no Notifications row or page.

**Review findings.** One quick pass found 5 low findings, all patched (listed in the Review Triage Log). Nothing was deferred or rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 5.

**Verification.** After the patches:
- `npm run lint`: exit 0, no warnings.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 228 files, 3977 tests passed.
- `npx vitest run src/components/Settings --sequence.shuffle`: 395 passed on seeds 1 to 8 and 11 to 13.
- `npx playwright test tests/e2e/settings`: 59 passed, row audit clean. This ran on the local stack through story 5.5's scratch `supabase` CLI shim.
- The residue grep finds only one history comment in the web spec.
- Every row of the I/O matrix has a passing covering test.

**Residual risks**
- **Simulator check not run.** The shell path (the row's value, opening the page, a switch saving on tap) is covered by unit tests with mocked Capacitor plugins only, not by a simulator or a device. The ticket's verify line ("In the shell, each switch saves on tap…") still needs a hand or `sim` check at the ship story.
- **Value counts Date reminders only with the plugin.** In a shell with the push plugins but no local-notifications plugin, the row's value ignores Date reminders. This is a design choice recorded in Design Notes.
