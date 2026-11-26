---
title: 'Each daily push has its Settings switch and its tap opens Daily'
type: feature
ticket: '4'
created: '2026-11-25'
status: done
baseline_revision: '2c38fe0f3660dd9a8b9af646f525a16e2c3e449f'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-daily-pushes-and-nudge/push-copy.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 3 gave `push_preferences` five daily switch columns and taught `send-push` to honour them, but the app neither reads nor writes them, so a person cannot turn a daily push off, and a tapped daily push opens nothing because `viewForPush` does not know the five kinds.

**Approach:** Add the five switches to the app's `PushPreferences` shape, its service columns and its saved-copy parser (a copy saved without them reads them as on), show them on Settings > Notifications under "Notify me about" after Partner requests with `push-copy.md`'s labels, count them in the top page's Notifications row, and map the five kinds to `daily` in `viewForPush`.

## Boundaries & Constraints

**Always:**
- Labels and order exactly as `push-copy.md` § Settings > Notifications: New question, Partner picked, Nudges, Evening reminder, Both answered, after Partner requests, in the "Notify me about" group. One switch (`dailyReminder`) covers both 8 PM variants.
- Each switch writes its one column through the existing `savePushPreference` upsert (`user_id` plus one column), never a whole row.
- A saved `push-preferences` copy without the five keys reads each as `true` (the server's default), as the `dates` key already does; a copy with a five-key value that is not a boolean stays malformed (`null`).
- The page stays native-only (`available: hasNativePush` in `SUBPAGES`); the website makes no `push_preferences` read.

**Never:**
- No migration, no `send-push` change, no regenerated types (story 3 shipped the columns; `database.types.ts` already has them).
- No change to `src/services/dateReminders.ts` or `reminderIdsToCancel`.
- No nudge UI, after-pick sheet or `daily_nudge` broadcast (stories 8.8, 8.9); no trigger or cron (8.5 to 8.7).
- Do not remove or rename the mood, poke and kiss switches (epic 10).
- Never `prettier --write` a file; match surrounding style by hand.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Page loaded | row with all on | eleven switches in Notify me about, the five daily ones last, then Reminders | — |
| Toggle one daily switch off | tap "Nudges" | `savePushPreference(userId, 'dailyNudge', false)`; upsert sends `{ user_id, daily_nudge: false }` only | offline: `offlineMessage('Push settings')`, nothing sent; failed save: existing Error box |
| Older saved copy | copy without the five keys | read as all five on, other keys as saved | — |
| Malformed daily key | copy with `dailyNudge: 'no'` | `null` (malformed) | — |
| Row summary | one daily switch off, rest on, granted | `Notifications, Some` | — |
| Row summary | all eleven push + Date reminders off | `Off` | — |
| Tap a daily push | `{ kind: 'daily_question' | 'daily_partner_picked' | 'daily_nudge' | 'daily_reminder' | 'daily_both_answered' }` | `viewForPush` → `'daily'` | — |

</intent-contract>

## Code Map

- `src/services/pushPreferencesService.ts` -- `PushPreferences`, `ALL_PUSH_PREFERENCES_ON`, `PreferencesRow`, `COLUMN`, `toPushPreferences`; add `dailyQuestion`, `dailyPartnerPicked`, `dailyNudge`, `dailyReminder`, `dailyBothAnswered` → columns `daily_question`, `daily_partner_picked`, `daily_nudge`, `daily_reminder`, `daily_both_answered` (migration `20261125000000_daily_push_sender.sql:176-180`, all `not null default true`; grants are table-level, so nothing else is needed). `COLUMNS` (the select list) derives from `COLUMN`. Header comment lists what the switches are.
- `src/stores/slices/notificationsSlice.ts:61-83` -- `PUSH_PREFERENCE_KEYS` (seven keys) and `parseSavedPushPreferences`, which defaults `dates: true` before checking every key is a boolean; extend both and the comment (story 4.4's keys default on the same way).
- `src/components/Settings/NotificationsPage.tsx` -- `ROWS` (key, testId, icon, label); append five rows after Partner requests, test ids `settings-push-new-question`, `settings-push-partner-picked`, `settings-push-nudges`, `settings-push-evening-reminder`, `settings-push-both-answered`; lucide icons (all present in the installed lucide-react): `MessageCircleQuestion`, `CircleCheck`, `BellRing`, `Moon`, `HeartHandshake`. Header comment.
- `src/components/Settings/notificationsStatus.ts` -- `PUSH_SWITCH_KEYS` (doc says "six"; it drives `notificationsSummary`, so the row counts the new keys once they are listed); update the doc comments ("five push switches" there is already stale).
- `src/services/pushNotifications.ts:152-164` -- `VIEW_FOR_KIND`; add the five kinds → `'daily'`; the header comment above `viewForPush` stays true.
- Tests to extend (do not weaken an assertion; update counts that the new rows change and say so in Implementation Notes):
  - `src/components/Settings/__tests__/NotificationsPage.test.tsx` -- `ROWS` table (6 → 11), `toHaveLength(6)` counts in "the groups", header comment ("five push switches"); `notificationsSummary` `allOff` fixture and case names ("all seven", "six on/off") gain the five keys; add a case "one daily switch off → Some" and a toggle test for one daily switch sending only its key.
  - `src/components/Settings/__tests__/Settings.notifications.test.tsx:136` -- add "reads Some when one daily switch is off" beside the existing case.
  - `tests/unit/services/pushPreferencesService.test.ts` -- the row fixture (`:47-53`), the selected columns (`:84-91`) and the per-column upsert `COLUMNS` table (`:122-128`) gain the five.
  - `tests/unit/stores/pushPreferencesCopy.test.ts:313-340` -- add: a copy saved before story 4.4 (no daily keys) reads them as on; a saved daily switch off is kept; a non-boolean daily key is malformed.
  - `src/services/__tests__/pushNotifications.delivered.test.ts:391-410` -- the kind→view table gains the five kinds → `daily`.
  - Any other full `PushPreferences` literal that `npm run typecheck` flags (candidates: `tests/unit/stores/signOutClearsAccountState.test.ts`, `tests/unit/stores/dateRemindersAtLaunch*.ts`, `Settings.datePages.test.tsx`): add the five keys, or spread `ALL_PUSH_PREFERENCES_ON`.
- `tests/e2e/settings/push-switches-web.spec.ts` -- website has no switches; add one `toHaveCount(0)` for the `New question` switch beside the `Love notes` one, keep everything else.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/pushPreferencesService.ts` -- add the five keys, columns, defaults and mapping; header comment -- the app's shape of story 3's columns.
- [x] `src/stores/slices/notificationsSlice.ts` -- five keys in `PUSH_PREFERENCE_KEYS`, defaulted `true` in `parseSavedPushPreferences`; comment -- an older copy reads as on.
- [x] `src/components/Settings/NotificationsPage.tsx` -- five `ROWS` after Partner requests; header comment -- the switches.
- [x] `src/components/Settings/notificationsStatus.ts` -- five keys appended to `PUSH_SWITCH_KEYS` in page order; comments -- the row counts them.
- [x] `src/services/pushNotifications.ts` -- five kinds → `'daily'` in `VIEW_FOR_KIND` -- a tap opens Daily.
- [x] Unit tests listed in the Code Map -- cover every matrix row.
- [x] `tests/e2e/settings/push-switches-web.spec.ts` -- one extra absence check for a daily switch.

**Acceptance Criteria:**
- Given the iOS shell's Settings > Notifications, when the page loads, then "Notify me about" shows New question, Partner picked, Nudges, Evening reminder and Both answered after Partner requests, each on by default.
- Given one of the five switches, when it is toggled, then only that column is sent and the switch shows the saved state; offline it refuses with the existing offline message and sends nothing.
- Given a saved push-preferences copy written before this story, when it is read, then the five switches read as on and the others as saved.
- Given one daily switch off, when the top page shows, then its Notifications row reads Some.
- Given a tapped push of any of the five kinds, when `viewForPush` reads it, then it answers `daily`.
- Given the website, when `push-switches-web.spec.ts` runs, then no switch and no `push_preferences` read appear.

## Implementation Notes

- Files: `src/services/pushPreferencesService.ts`, `src/stores/slices/notificationsSlice.ts`, `src/components/Settings/NotificationsPage.tsx`, `src/components/Settings/notificationsStatus.ts`, `src/services/pushNotifications.ts`; tests `NotificationsPage.test.tsx`, `Settings.notifications.test.tsx`, `pushPreferencesService.test.ts`, `pushPreferencesCopy.test.ts`, `pushNotifications.delivered.test.ts`, `signOutClearsAccountState.test.ts` (a full `PushPreferences` literal typecheck flagged), `push-switches-web.spec.ts`.
- Counts the new rows change: the Notify me about switch count 6 → 11 (with and without the reminders plugin), and the `notificationsSummary` case names "seven"/"six" → "twelve"/"eleven"; the `allOff` fixture gains the five keys. No assertion was removed or narrowed.
- The New question icon is `MessageCircleQuestionMark`: in the installed lucide-react, `MessageCircleQuestion` is only an alias of it.
- Matrix coverage: the offline refusal and failed save for a daily switch use the one `toggle` path the existing offline and failed-save tests exercise on another switch; the new toggle test proves a daily switch goes through that path with its own key.
- Verified 2026-11-25: targeted vitest 6 files / 177 passed; `npm run test:unit` 261 files / 5017 passed; `npm run typecheck` and `npm run lint` clean; `push-switches-web.spec.ts` 1 passed (row audit: no leftovers); no diff since baseline in `dateReminders.ts`, `database.types.ts` or `supabase/`.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` Three new `ROWS` entries in `src/components/Settings/NotificationsPage.tsx` (New question, Partner picked, Both answered) ran past `.prettierrc`'s `printWidth` 100 (107, 102, 102 columns), against AGENTS.md's "match surrounding style by hand" — confirmed with `awk 'length > 100'`; the implementer broke each across lines like the `partnerRequests` entry, Nudges and Evening reminder stay on one line; `NotificationsPage.test.tsx` 61 passed, then the full Verification re-ran green.

## Design Notes

- Keep the `ROWS` / `PUSH_SWITCH_KEYS` / `PUSH_PREFERENCE_KEYS` / `COLUMN` repetition as it is: each list has its own order and purpose (page order, summary set, parser set, column map), and the `Record<PushPreferenceKey, …>` type on `COLUMN` already makes a missing key a type error. Consolidating is outside this ticket.
- Parser default, extended from the existing `dates` case:

```ts
const DEFAULT_ON_WHEN_MISSING = { dates: true, dailyQuestion: true, dailyPartnerPicked: true,
  dailyNudge: true, dailyReminder: true, dailyBothAnswered: true };
const record = { ...DEFAULT_ON_WHEN_MISSING, ...(value as Record<string, unknown>) };
```

## Verification

**Commands:**
- `npx vitest run src/components/Settings/__tests__/NotificationsPage.test.tsx src/components/Settings/__tests__/Settings.notifications.test.tsx tests/unit/services/pushPreferencesService.test.ts tests/unit/stores/pushPreferencesCopy.test.ts tests/unit/stores/pushPreferences.test.ts src/services/__tests__/pushNotifications.delivered.test.ts` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npm run typecheck && npm run lint` -- expected: pass (any TS2883 error is the loop-worktree baseline only if it also appears at `baseline_revision`).
- `npx playwright test tests/e2e/settings/push-switches-web.spec.ts` (local Supabase running, `dev:local` config) -- expected: pass.
- `git diff --exit-code 2c38fe0f3660dd9a8b9af646f525a16e2c3e449f -- src/services/dateReminders.ts src/types/database.types.ts supabase/` -- expected: no diff.

## Auto Run Result

- **Summary:** Settings > Notifications shows the five daily switches from `push-copy.md` (New question, Partner picked, Nudges, Evening reminder, Both answered) after Partner requests in "Notify me about", each on by default and each saved one `push_preferences` column at a time on story 3's columns. A saved `push-preferences` copy written before this story reads the five as on. The top page's Notifications row counts them, so one off reads Some. A tapped push of any of the five kinds opens Daily (`viewForPush`). No migration, sender, types or `dateReminders.ts` change.
- **Files changed:**
  - `src/services/pushPreferencesService.ts`: the five keys, their columns, defaults and mapping.
  - `src/stores/slices/notificationsSlice.ts`: the parser knows the five keys and reads a missing one as on.
  - `src/components/Settings/NotificationsPage.tsx`: the five rows with their labels, icons and test ids.
  - `src/components/Settings/notificationsStatus.ts`: `PUSH_SWITCH_KEYS` gains the five, so the row counts them.
  - `src/services/pushNotifications.ts`: the five kinds map to `daily` in `VIEW_FOR_KIND`.
  - `src/components/Settings/__tests__/NotificationsPage.test.tsx`: eleven switches, a daily toggle, the summary cases.
  - `src/components/Settings/__tests__/Settings.notifications.test.tsx`: the row reads Some with one daily switch off.
  - `tests/unit/services/pushPreferencesService.test.ts`: the five columns selected, mapped and upserted alone.
  - `tests/unit/stores/pushPreferencesCopy.test.ts`: an older copy, a daily switch kept off, a malformed daily key.
  - `src/services/__tests__/pushNotifications.delivered.test.ts`: each kind opens Daily.
  - `tests/unit/stores/signOutClearsAccountState.test.ts`: its full `PushPreferences` literal gains the five keys.
  - `tests/e2e/settings/push-switches-web.spec.ts`: one more absence check, for New question.
- **Review findings:** 1 finding (Quick lens): low 1.
  - **Patched:** 1 low, the three over-wide `ROWS` lines.
  - **Deferred:** none.
  - **Rejected:** none.
- **Follow-up review recommendation:** `false`. This first pass patched one low and no high or medium.
- **Verification (2026-11-25, after the patch):**
  - Targeted vitest (the six files in Verification): 177 passed.
  - `npm run test:unit`: 261 files, 5017 tests passed.
  - `npm run typecheck` and `npm run lint`: clean.
  - `npx playwright test tests/e2e/settings/push-switches-web.spec.ts`: 1 passed; the row audit found no leftover rows.
  - `git diff --exit-code` since the baseline on `src/services/dateReminders.ts`, `src/types/database.types.ts` and `supabase/`: no diff.
- **Residual risks:** none naming a defect. The switches were checked in unit tests and the website, not in the iOS shell; an off switch stopping a push on the owner's iPhone is the epic's closure check.
