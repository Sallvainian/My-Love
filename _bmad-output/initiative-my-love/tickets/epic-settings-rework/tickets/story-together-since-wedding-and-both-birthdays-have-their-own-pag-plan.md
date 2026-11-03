---
title: 'Together since, Wedding and both birthdays have their own pages'
type: 'feature'
ticket: '10'
created: '2026-11-03'
status: done
baseline_revision: 'f7f112e76e6cc499e02e9ef4bcb23df2c53baca1'
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

**Problem:** The Dates list's Together since, Wedding and birthday rows target pages that do not exist (a tap lands on the top page), and the couple dates are still edited in the old always-open `Together` section on the top page (R7, R8, R3).

**Approach:** Register four date pages and their one-field Date pages under `/settings/dates/…`, add a reusable Remind me group (shell only), and delete the old `Together` section with its forms.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md: titles `Together since`, `Wedding`, `Your birthday`, `<Partner>'s birthday`; rows `Date`, `Remind me`, `Clear`, `Not set`; Footnotes `A month and a week before.`, `Date reminders are off. Turn them on in Notifications.`, `<Partner> sets this in their Profile.`. Pages are `small` title style. Field edits go through `OneFieldPage` (registered `reloadsToParent: true`); date pages reload to themselves. Offline refusals via `isOnline()` + `offlineMessage(...)`, never hand-typed. Remind me renders only when `hasNativeReminders()`. Kit classes and tokens only, no `dark:`; rows ≥44pt. Parse `YYYY-MM-DD` with `parseEventDate`. Match surrounding style by hand (no `prettier --write`). Every E2E spec the removal breaks is updated in this story.

**Never:** No event or anniversary pages, `+`, forms or Kind chooser (stories 11–13); do not remove `EventsSettings`, `AnniversarySettings`, the Countdowns section or `CountdownMarks`; no Home card changes (story 14); no store, service, migration or local-copy change; no screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Together since, set | `coupleSettings` linked, `relationshipStart` ISO | `dates/together-since`: Date row value `formatListDate`, target `dates/together-since/date`; Remind me (shell) | — |
| Couple not loaded | `coupleSettings` null, not confirmed unlinked | Together since / Wedding Date row empty and disabled; no Clear | — |
| Couple absent | `coupleSettings.status==='unlinked'`, or null and confirmed unlinked (`partnerKnown && !partner && !partnerLoadError`) | Page (incl. reload) falls back to the Dates list via `goBack()` once | Fires once per mount (StrictMode-safe) |
| Together since Date page | open `dates/together-since/date` | one `datetime-local` field prefilled (local), Save only for a valid past value that differs; saves the ISO instant via `setRelationshipStart`, returns one level | offline → `offlineMessage('Couple settings')` in Error box, field kept; service error → its message |
| Wedding set | `weddingDate` `YYYY-MM-DD` | Date row value `formatListDate`; Remind me; centered danger `Clear` alone in its own card | — |
| Wedding unset | `weddingDate` null | Date row `Not set`, no Clear | — |
| Wedding Date page | `dates/wedding/date` | `type=date`, any valid date; `setWeddingDate` | as Together since |
| Clear | tap `Clear` | `setWeddingDate(null)`, then `goBack()` (Dates list shows `Not set`); disabled while running | offline → refusal in page Error box, no request; failure → message, stays |
| Your birthday | `ownProfile` | Date row value `formatDayMonth` / `Not set` / empty while unknown (disabled while waiting, as Profile); target `dates/birthday/date` = `BirthdayPage` (past only) titled `Date` | as Profile |
| Partner's birthday | `partner` set | Title `${displayName}'s birthday`; read-only Date row (`formatDayMonth` or `Not set`), Footnote `${displayName} sets this in their Profile.`, then Remind me | — |
| Partner unknown / absent | `partner` null | not confirmed unlinked → title `Birthday`, nothing under it; confirmed unlinked → fall back to Dates list | — |
| Remind me | shell, marks loaded | switch checked = `countdownMarks.includes(key)`; tap → `setCountdownMark(key, next)`, disabled while saving; Footnote `A month and a week before.` | offline → `offlineMessage('Reminders')` in page Error box, switch unchanged; failure → message |
| Date reminders off | `pushPreferences.dateReminders === false` | switch disabled (60% via `SwitchRow`), Footnote `Date reminders are off. Turn them on in Notifications.`; mark kept | — |
| Marks not loaded / web | `countdownMarks` null / no plugin | disabled default off / no Remind me group at all | — |

</intent-contract>

## Code Map

- `src/components/Settings/Settings.tsx` -- delete `toLocalInputs`, `fromLocalInputs`, `TogetherSinceRow`, `TogetherSinceForm`, `WeddingRow`, `WeddingForm`, the `Together` `<section>` and now-unused imports; register the pages in `SUBPAGES`; give `dates/partner-birthday` its title from `useAppStore((s) => s.partner?.displayName)` inside `resolveSettingsPage` (SUBPAGES titles are static); update the file doc and the comment above the sign-out card.
- `src/components/Settings/ProfilePage.tsx` -- `BirthdayPage` is reused as-is for `dates/birthday/date`; `NOT_SET` and the `waiting` rule are the pattern.
- `src/components/Settings/DatesPage.tsx` -- already targets `dates/together-since`, `dates/wedding` (or `…/date` for a loaded `Not set`), `dates/birthday`, `dates/partner-birthday`; its `linked`/`confirmedUnlinked` expressions are the ones to mirror. Unchanged.
- `src/components/Settings/stack/OneFieldPage.tsx`, `SettingsRows.tsx` (`SettingsGroup` with `footnote`, `SettingsRow` with `disabled`, `ReadOnlyRow`), `stack/settingsPageContext.ts` (`useSettingsPage().goBack`), `SwitchRow.tsx` (`ROW_BUTTON`; disabled = 60%). `kitClasses.ts`: `FAILURE_BOX`, `FOOTNOTE`.
- `src/components/Settings/CountdownMarks.tsx` -- the toggle/load pattern to copy for Remind me (load marks on mount and on `online`; `saving` guard). `NotificationsPage.tsx` `NotificationsRow` -- loads `loadPushPreferences` on mount and `online`; copy that too.
- `src/services/dateReminders.ts` -- `MARK_KEYS.relationshipStart|wedding|ownBirthday|partnerBirthday`, `hasNativeReminders()`. Store: `countdownMarks`, `loadCountdownMarks`, `setCountdownMark` (`datesSlice`), `pushPreferences`, `loadPushPreferences` (`notificationsSlice`), `setRelationshipStart`, `setWeddingDate`, `coupleSettings`, `ownProfile`, `ownProfileLoadFailed`, `partner`, `partnerKnown`, `partnerLoadError`. A mark write re-plans reminders through the local-copy write (`dateRemindersAtLaunch.ts`); nothing to add.
- `src/components/Settings/settingsFields.ts` -- add the local datetime helpers (Design Notes) beside the other field rules.
- Tests to replace: `src/components/Settings/__tests__/Settings.togetherSince.test.tsx` and `Settings.birthdayWedding.test.tsx` test the deleted forms; carry their checks (past-only rule on a pinned clock, wedding save and clear, errors) into the new test. `Settings.kit.test.tsx:98` expects h2s `['Account','Partner','About','Together','Countdowns']` → drop `Together`. Patterns: `Settings.dates.test.tsx`, `Settings.profile.test.tsx`, `settingsStackKit.ts`; Capacitor mocking for `hasNativeReminders` in `CountdownMarks.test.tsx`.
- E2E using the removed ids (`settings-together-since-*`, `settings-wedding-*`): `tests/e2e/settings/couple-start-date.spec.ts`, `tests/e2e/settings/birthdays-wedding.spec.ts` (`openPartnerSettings` and three tests), `tests/e2e/offline/couple-settings-offline.spec.ts`. Unlinked faking and Dates navigation: `tests/e2e/settings/dates-list.spec.ts`. Import `{ test, expect }` from `tests/support/merged-fixtures.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/Settings/settingsFields.ts` -- add `toLocalDateTime(iso)` → `YYYY-MM-DDTHH:MM` (or `''`), `fromLocalDateTime(value)` → ISO or `null` (built from components, never `new Date(string)`), `isValidTogetherSince(value)` (parses and not after now) -- the Together since field's rules.
- [ ] `src/components/Settings/RemindMe.tsx` (new) -- `RemindMeGroup({ markKey, onError })` per the matrix: `null` without `hasNativeReminders()`; loads marks and push preferences on mount and `online`; one `SwitchRow` (`Bell`, id `settings-remind-me`) in a `SettingsGroup` whose footnote (`settings-remind-me-footnote`) switches with Date reminders; `onError(null)` on each tap, `onError(message)` on refusal or failure. File doc saying stories 11–12 reuse it.
- [ ] `src/components/Settings/DatePages.tsx` (new) -- `TogetherSincePage`, `TogetherSinceDatePage`, `WeddingPage`, `WeddingDatePage`, `YourBirthdayPage`, `PartnerBirthdayPage`, and a once-per-mount fall-back-to-Dates hook using `goBack()`. Each date page owns an Error box (`settings-date-error`, `FAILURE_BOX` + `CircleAlert`, `role="alert"`) above its first card, fed by Remind me and Clear. Test ids: page wrappers `settings-<together-since|wedding|your-birthday|partner-birthday>-page`, Date row `settings-date-row` (read-only `settings-partner-birthday-date`), fields `settings-together-since-field` / `settings-wedding-field`, Clear `settings-wedding-clear`, footnote `settings-partner-birthday-footnote`. File doc.
- [ ] `src/components/Settings/Settings.tsx` -- per Code Map: register `dates/together-since`, `dates/together-since/date` (title `Date`, `reloadsToParent`), `dates/wedding`, `dates/wedding/date` (`Date`, `reloadsToParent`), `dates/birthday` (`Your birthday`), `dates/birthday/date` (`Date`, `reloadsToParent`, `<BirthdayPage />`), `dates/partner-birthday`; remove the old section and helpers.
- [ ] `src/components/Settings/__tests__/Settings.datePages.test.tsx` (new) -- every matrix row through the real store and stack (Capacitor mocked on and off), Date row targets, reload on each date page stays and on a `…/date` page shows its parent, fall-back to `/settings/dates`, Clear online/offline/failure, Remind me on/off/disabled/footnotes/errors; delete `Settings.togetherSince.test.tsx` and `Settings.birthdayWedding.test.tsx` after porting their checks; fix `Settings.kit.test.tsx`; add the new helpers to `settingsFields.test.ts`.
- [ ] `tests/e2e/settings/couple-start-date.spec.ts`, `tests/e2e/settings/birthdays-wedding.spec.ts`, `tests/e2e/offline/couple-settings-offline.spec.ts` -- drive the new pages (Dates → row → Date → field → Save; `Clear` on the Wedding page; the offline refusal in `settings-field-error`), keeping every value, status and store/copy/server check each test made; the "not set" premise becomes the Dates row's accessible name `Wedding, Not set` / `Together since, Not set`.
- [ ] `tests/e2e/settings/date-pages.spec.ts` (new) -- pool account: the partner's birthday page shows the title with the partner's name, a read-only Date row, the Footnote and no Remind me on the web; Your birthday's Date opens the birthday field; a reload on `/settings/dates/wedding` stays there; with the partner read faked unlinked (as `dates-list.spec.ts`), `/settings/dates/together-since` falls back to `/settings/dates`. Clean up only what it seeded.

**Acceptance Criteria:**
- Given the Dates list, when Together since, Wedding, You or the partner's row is tapped, then its page opens with the small title and rows above, and back returns to the Dates list.
- Given a date page's Date row, when it is tapped, edited and saved, then the page returns one level and the row (and the Dates list) shows the new value without a reload.
- Given a set wedding, when `Clear` is tapped online, then the app returns to the Dates list, whose Wedding row reads `Not set`.
- Given the top page, when it opens, then no `Together` section and no date or time field is on it.
- Given the shell with the local-notifications plugin, when Remind me is turned on for a date, then the month and week reminders for that date are scheduled (simulator check, Verification).

## Implementation Notes

- Implemented by a Sonnet subagent from this plan. It moved `yearlyValue`, `coupleValue` and `parseInstant` unchanged from `DatesPage.tsx` into `settingsFields.ts`, so the date pages show the Dates list's values; exporting them from a component file tripped the `react-refresh` lint rule. `DatesPage.tsx` behaves as before.
- `Settings.profile.test.tsx` carried the same stale `Together` h2 expectation as `Settings.kit.test.tsx`; both were updated.
- The orchestrating session stubbed `history.back` in the "goes back once" case: under shuffle seed 510 the real back landed on an entry an earlier case left, whose page fell back again and counted a second call.
- E2E ran on the local stack through a scratch stand-in for `supabase status` (the PATH CLI 3.0.0 rejects the repo's `config.toml`), as stories 5.4 to 5.9 did; nothing in the repo changed for it.
- Simulator check not run: `ax doctor` reported no visible Device Hub window and no booted simulator.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 6 findings — high 0, medium 0, low 6, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` AC5 (Remind me schedules the reminders) has no recorded simulator result — the fix is a plan edit; the result (not run, prerequisites unmet) is recorded in Implementation Notes and the Auto Run Result.
  - `[low]` `[reject]` `DatesPage.tsx` changed though the Code Map said unchanged, unlogged — behavior unchanged (helpers moved verbatim); the fix is a plan edit, recorded in Implementation Notes.
  - `[low]` `[patch]` `fromLocalDateTime` returned null for a spring-forward gap time the iOS picker offers, keeping Save off silently — fixed: checks date parts only (plus an hour/minute range guard); test added.
  - `[low]` `[patch]` The "small title" case asserted only `settings-title`, which large pages carry too — fixed: also asserts `settings-bar-title` (large pages only) is absent.
  - `[low]` `[patch]` The once-per-mount fall-back case did not run under StrictMode — fixed: renders inside `<StrictMode>`.
  - `[low]` `[patch]` New lines over the 100-column print width — fixed: rewrapped by hand in the new and changed lines only.

## Design Notes

- **Together since field.** One `datetime-local` input holds the date and time "as today" (one field, iOS shows one picker); `max` is now as `toLocalDateTime`. `save` wraps `setRelationshipStart(fromLocalDateTime(v)!)`; `saved` is `toLocalDateTime(relationshipStart)`, so Save stays off until it changes. An empty field is invalid (no clear, as today).
- **Fall-back.** "Absent once loaded" is the couple being confirmed unlinked (Together since, Wedding) or the partner confirmed absent (partner's birthday); your birthday is never absent. `goBack()` is the stack's own one-level rule (history.back on an app entry, parent replace on a fresh load), whose parent here is `dates`.
- **Date values on the pages** use the Dates list formatters: `formatListDate` for Together since and Wedding, `formatDayMonth` for birthdays, so the row matches the list.
- **Partner title.** `SettingsPageSpec.title` is a string read when `Settings` resolves the path, so `Settings` subscribes to the partner's name; with no partner yet the title is `Birthday`.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline excepted if present at baseline).
- `npx vitest run src/components/Settings` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings tests/e2e/offline/couple-settings-offline.spec.ts --project=chromium` -- expected: pass on the local stack.

**Manual checks (if no CLI):**
- Simulator, when `scripts/sim-driver/README.md`'s prerequisites are met: `sim build`, `sim signin`, `sim dates kinds`, open Settings → Dates → Wedding, tap Remind me, then `sim pending` lists `In a month: …` and `In a week: …` for that date. Otherwise record it as not run.

## Auto Run Result

Status: built

**Summary.** The Dates list's Together since, Wedding, You and partner rows now open their own small-title pages, and the old `Together` section is gone from the top page.
- **Together since** (`/settings/dates/together-since`): a Date row (`Sat 14 Nov` / `3 Feb 2022`) opening a one-field Date page with one `datetime-local` field. A value in the future cannot be saved. It saves the ISO instant through `setRelationshipStart`.
- **Wedding** (`/settings/dates/wedding`): a Date row opening a `date` field (any date), then Remind me, then a centered danger `Clear` alone in its own card while a date is set. Clear refuses offline before any request, otherwise clears and returns to the Dates list.
- **Your birthday** (`/settings/dates/birthday`): a Date row (`4 Apr` / `Not set`) opening the Profile's past-only birthday field, titled `Date`.
- **Partner's birthday** (`/settings/dates/partner-birthday`): titled `<name>'s birthday` (`Birthday` until a partner is known), a read-only Date row, the Footnote `<name> sets this in their Profile.`, then Remind me.
- **Remind me** (`RemindMe.tsx`, reused by stories 11–12): shell with the local-notifications plugin only. It loads the marks and push preferences on open and on reconnect and saves on tap, server first. It is disabled while saving, while the marks are unloaded, and while Date reminders is off (60%, with the Notifications Footnote; the mark is kept). Refusals and failures go to the page's Error box.
- Date pages reload to themselves; the `…/date` pages reload to their date page. A couple date page falls back to the Dates list once the couple is confirmed unlinked, and the partner's birthday page once the partner is confirmed absent. A failed read never triggers it.

**Files changed**
- `src/components/Settings/DatePages.tsx` (new): the four date pages, the two Date field pages and the fall-back hook.
- `src/components/Settings/RemindMe.tsx` (new): `RemindMeGroup`.
- `src/components/Settings/Settings.tsx`: registers the seven paths, titles the partner's birthday page, removes the old Together section and its helpers.
- `src/components/Settings/settingsFields.ts`: `toLocalDateTime`, `fromLocalDateTime`, `isValidTogetherSince`, plus the row-value helpers moved from `DatesPage.tsx`.
- `src/components/Settings/DatesPage.tsx`: imports the moved helpers; doc line.
- Unit tests: `Settings.datePages.test.tsx` (new); `settingsFields.test.ts`, `Settings.kit.test.tsx`, `Settings.profile.test.tsx` updated; `Settings.togetherSince.test.tsx` and `Settings.birthdayWedding.test.tsx` deleted, their checks ported.
- E2E: `tests/e2e/settings/date-pages.spec.ts` (new); `couple-start-date.spec.ts`, `birthdays-wedding.spec.ts`, `tests/e2e/offline/couple-settings-offline.spec.ts` drive the new pages with every earlier check kept.

**Review findings.** One quick pass found 6 findings, all low. 4 were patched and 2 rejected: their fix was a plan edit, and both are recorded in Implementation Notes. Nothing was deferred.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 4.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 230 files, 4133 tests, 0 failures.
- `npx vitest run src/components/Settings` with shuffle seeds 510 and 9: 523 passed each.
- `npx playwright test tests/e2e/settings tests/e2e/offline/couple-settings-offline.spec.ts --project=chromium`: 71 passed on the local stack, no leftover rows.
- Every I/O matrix row has a passing covering test in `Settings.datePages.test.tsx`.

**Residual risks**
- **Simulator check not run.** "Remind me schedules the month and week reminders" is covered only by unit tests with a stubbed store action and mocked Capacitor. `ax doctor` found no visible Device Hub window and no booted simulator. It needs a `sim` or hand check at the ship story (17).
- **No visual review** of the pages in light and dark, or of the `datetime-local` picker on iOS.
- **CLI version.** E2E ran against a local stack started outside the CI-pinned CLI, through a stand-in for `supabase status`.
