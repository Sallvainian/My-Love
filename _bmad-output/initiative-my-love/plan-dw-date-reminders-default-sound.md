---
title: 'DW-390: date reminders play the default notification sound'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'f9a8ebe5d0646f5f3ad6b80f5a596982efe8c3ce'
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

**Problem:** `scheduleDateReminders` (`src/services/dateReminders.ts`) schedules each reminder with no `sound`, and `@capacitor/local-notifications` 8.3.1 sets `content.sound` only for a non-empty string (`ios/.../LocalNotificationsPlugin.swift:472-473`), so iOS delivers date reminders silently (DW-390). The owner decided on 2026-11-02 that reminders play the default notification sound and keep the plugin's default in-front presentation with a banner.

**Approach:** Give every scheduled reminder `sound: 'default'` through an exported constant. Per the plugin's type definition for `LocalNotificationSchema.sound` ("If the sound file is not found, (i.e. … wrong name) the default system notification sound will be used"), and its `resolveSound` (`:493-511`), a non-empty name with no extension skips the bundled-file search and becomes `UNNotificationSound(named: "default")`; no bundled file has that name, so iOS plays the default sound. An empty string is not an option in 8.3.1 — the `!sound.isEmpty` guard drops it, contradicting the stale doc line. Leave `capacitor.config.ts` (PushNotifications `presentationOptions`) and the in-front presentation (`LocalNotificationsHandler.swift:35`) alone. Unit-test the scheduled payload; the audible device check belongs to DW-376's run outside the loop.

</intent-contract>

## Tasks & Acceptance

- `src/services/dateReminders.ts` — add exported `REMINDER_SOUND = 'default'` beside `REMINDER_THREAD_ID`, with a comment citing the plugin's behaviour; pass `sound: REMINDER_SOUND` in each scheduled notification.
- `src/services/__tests__/dateReminders.test.ts` — add `sound: 'default'` to the exact payload in the existing `toHaveBeenCalledWith` test, and a test that every scheduled reminder carries `sound: 'default'` (and that `REMINDER_SOUND` is `'default'`).

Given granted permission and a non-empty plan, when `scheduleDateReminders` runs, then every notification passed to `LocalNotifications.schedule` carries `sound: 'default'`, with id, title, body, thread id and schedule unchanged.

## Implementation Notes

Oneshot: two files, under 30 changed lines, no design choice beyond the value, which the plugin source and its type definitions settle.

Touched `src/services/dateReminders.ts` (new `REMINDER_SOUND`, passed as `sound` in `scheduleDateReminders`) and `src/services/__tests__/dateReminders.test.ts` (exact payload now includes `sound: 'default'`; new `scheduleDateReminders sound` test). Plugin source read from the main checkout's `node_modules` (8.3.1, the version `package-lock.json` resolves); the worktree has no `node_modules` of its own. Nothing schedules with `foreground`/`silent`, so the in-front presentation stays the plugin default `[.badge, .sound, .banner, .list]`; `capacitor.config.ts` untouched. Audible check on a device is DW-376's.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` New test's `as [...]` cast ran to 109 columns, past `.prettierrc` `printWidth: 100`, unlike the thread-id test's three-line cast — wrapped it over three lines the same way.
  - `[low]` `[patch]` New `scheduleDateReminders sound` block copied the `beforeEach` of `scheduleDateReminders`/`thread id` verbatim, a third copy to keep in step — moved the test into the existing `scheduleDateReminders` block, which has the same setup, and deleted the new block.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/dateReminders.test.ts` -- expected: all tests pass, including the new sound assertions
- `npx eslint src/services/dateReminders.ts src/services/__tests__/dateReminders.test.ts` -- expected: no errors
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 baseline errors, if any, are pre-existing and unrelated)

## Auto Run Result

Status: built

**Summary:** Date reminders now ask for the default notification sound. `scheduleDateReminders` passes `sound: REMINDER_SOUND` (`'default'`) on every scheduled notification. `@capacitor/local-notifications` 8.3.1 drops an empty or missing `sound` (`LocalNotificationsPlugin.swift:472-473`), and turns a name with no extension into `UNNotificationSound(named:)` (`resolveSound`, `:493-511`). Its `LocalNotificationSchema.sound` type documentation says a name with no matching file plays the default system sound. No file named `default*` is bundled under `ios/` or `public/`. The in-front presentation and `capacitor.config.ts` are unchanged.

**Files changed:**
- `src/services/dateReminders.ts` — new exported `REMINDER_SOUND = 'default'` with its rationale; passed as `sound` in each scheduled reminder.
- `src/services/__tests__/dateReminders.test.ts` — the exact-payload assertion includes `sound: 'default'`; new test that every scheduled reminder carries it.
- `_bmad-output/initiative-my-love/plan-dw-date-reminders-default-sound.md` — this plan.

**Review:** quick lens, 2 findings, both `low`, both patched (line wrap; duplicated `describe` setup removed). 0 deferred, 0 rejected. Patched by verdict: high 0, medium 0, low 2. Follow-up review: not recommended (`false`): no high patched and fewer than two medium.

**Verification:**
- `npx vitest run src/services/__tests__/dateReminders.test.ts`: 91 passed. With the `sound:` line removed from the source, 2 failed (the exact-payload test and the new sound test), then green again after restoring it.
- `npx eslint` on both files: clean.
- `npm run typecheck`: exit 0.

**Residual risk:** whether iOS audibly plays `UNNotificationSound(named: "default")` was not checked on a device. That rests on the plugin's documented fallback. The device check after a reinstall belongs to DW-376's run, outside the loop.

