---
title: 'New events and anniversaries are added from the Dates list'
type: 'feature'
ticket: '13'
created: '2026-11-03'
status: done
baseline_revision: 'a766d1b0d951d016ac82653566b07aa4b98e5dd1'
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

**Problem:** The only way to create an event or anniversary is still the old Countdowns section on the Settings top page. That section and the per-date reminder list (`CountdownMarks`) duplicate the new date pages, so the top page does not hold only its rows (R1, R9).

**Approach:**
- Give the Dates list a `+` button in its bar. It opens a Kind chooser dialog, which pushes `dates/new-event` or `dates/new-anniversary`: Form pages with Cancel and Add in the bar.
- Delete `EventsSettings`, `AnniversarySettings`, `CountdownMarks` and their unit suites.
- Move the E2E specs and helpers that drove the old UI onto the new pages.

## Boundaries & Constraints

**Always:**
- Copy EXPERIENCE.md's strings exactly:
  - titles `New event` and `New anniversary`; bar actions `Cancel` and `Add`; field labels `Name`, `Date`, `Note`, `Icon`;
  - icon options `Calendar`, `Ring`, `Plane`;
  - placeholders `e.g., Weekend trip` and `Add a note about this event...` (event), `e.g., First Date Anniversary` and `Add a note about this anniversary...` (anniversary).
- Both form pages go in `SUBPAGES` with title style `small` and `reloadsToParent`, so a reload shows the Dates list.
- Add is enabled when:
  - the trimmed Name is non-empty;
  - Date passes `parseEventDate`;
  - for an event only, the Name is at most 100 code points and the Note at most 500, using the limits in `EventPages.tsx`;
  - and no add is in flight.
- Add refuses offline before any request, keeping every field, with `isOnline()` and `offlineMessage('Events')` or `offlineMessage('Anniversaries')`.
- A failed add shows its message in the form's Error box, keeps the fields and re-enables Add. The box clears on the next Add.
- A successful add calls `goBack()`, which returns to the page that opened the form. It never opens the new date's page.
- The anniversary add passes `useSubmitKey().keyFor(payload)` as `addAnniversary`'s `clientKey`, so a retry of the same payload reuses its key.
- An event add that returns `code: 'invalid-response'` may have committed. Add stays disabled for the rest of that form's life, with the message shown.
- Writes go through `addEvent({ label, eventDate, description: note || null, icon })` and `addAnniversary({ label, date, description: note || undefined }, key)`.
- Use kit classes and tokens only, with no `dark:`. Targets are at least 44pt and fields 16px (`fieldClass`). Match the surrounding style by hand (no `prettier --write`).
- Keep every behaviour an old spec checked that still exists in the app (see the E2E tasks). When a rewrite narrows an old assertion, say why in the commit message.

**Never:**
- No Home change: Home's Add button and its cards are story 14. `home-kit.spec.ts:265` keeps its `/settings` expectation.
- No change to the Icon row or the Icon field page (DW-430 and DW-431 stay open).
- No store, service or migration change.
- No new axe or other accessibility scans: no screen-reader or keyboard requirement.
- Never add specs to `tests/e2e-archive/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `+` on Dates list | tap `settings-dates-add` | The Kind chooser opens: kit dialog, no visible title, `aria-label="Add a date"`. It has the secondary pills `Event` and `Anniversary`, then `Cancel` | Escape, the scrim or Cancel close it with no navigation |
| Choose kind | tap Event / Anniversary | The dialog closes, then `openSettingsPage('dates/new-event' \| 'dates/new-anniversary')` runs. One history entry | — |
| Event form opens | `dates/new-event` | Name (focused), Date, Note, Icon. The icon is three tiles with Calendar selected. Add is disabled at 50% opacity | — |
| Anniversary form opens | `dates/new-anniversary` | Name (focused), Date, Note. Add is disabled | — |
| Add enabled | Name and valid Date filled (limits as Always) | Add is active | — |
| Add, online | tap Add | One write. Add is disabled while the write runs. On success the app returns to the Dates list, and the new row sits in its group in date order (event) or in the list (anniversary). The new event is on Home's cards without a reload | — |
| Add, offline | `isOnline()` false | No request. The offline refusal shows in the Error box; the fields are kept | — |
| Add fails | `addEvent` returns a failure, or `addAnniversary` throws | Its message shows in the Error box; the fields are kept; Add is re-enabled | `invalid-response` latches Add disabled |
| Anniversary retry | same payload, after a failed add | The same `clientKey` is sent again | — |
| Cancel | tap Cancel in the bar | `goBack()` with nothing written | — |
| Reload on a form | fresh mount at `dates/new-*` | The Dates list is shown (`reloadsToParent`) | — |
| Top page | open `/settings` | Only the IA rows and the version line. No `Countdowns` heading, `settings-countdowns-card` or reminder list | — |

</intent-contract>

## Code Map

- `src/components/Settings/stack/SettingsStack.tsx`
  - Add `leading?: 'back' | 'cancel'` to `SettingsPageSpec` and pass it to `SettingsBar`. `'cancel'` runs the same `goBack`.
  - Document the field in the file doc.
- `src/components/Settings/stack/SettingsBar.tsx`
  - With `leading === 'cancel'` (and `onBack` set), the leading cell is a text button labelled `Cancel`, `data-testid="settings-cancel"`.
  - It uses 17px ink at weight 400, with `min-h-11`, focus ring as Save.
  - The 64px leading column may need widening to fit `Cancel`. Widen both side columns equally so the title stays centred.
- `src/components/Settings/stack/OneFieldPage.tsx` -- the pattern for the bar Save button (classes, `SettingsBarAction`), the Error box (`FAILURE_BOX` with `CircleAlert`, `role="alert"`) and the `mounted` ref.
- `src/components/Settings/EventPages.tsx`
  - Export `LABEL_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`, `codePoints` and `ICON_OPTIONS` for the form.
  - Keep them top-level `const` declarations, because `tests/support/eventsValidationContract.ts` will parse this file.
- `src/components/Settings/ConfirmDialog.tsx` -- the dialog pattern for the Kind chooser: `useFocusTrap`, a stable cancel, scrim-click cancel, `DIALOG_BACKDROP`/`DIALOG_PANEL`, `SECONDARY_BUTTON`.
- `src/components/Settings/DatesPage.tsx`
  - Add the `+` button through `SettingsBarAction`: `ADD_BUTTON`, lucide `Plus` 20px, `aria-label="Add a date"`, `data-testid="settings-dates-add"`.
  - Add the chooser state, with the chooser inside `AnimatePresence`.
  - Update the doc.
- `src/components/Settings/Settings.tsx`
  - Add the two `SUBPAGES` entries (`leading: 'cancel'`, `small`, `reloadsToParent`).
  - Delete the Countdowns section and `<CountdownMarks />`, with their imports and the now-unused kit imports (`CARD`, `DIVIDER`, `SECTION_LABEL`).
  - Update the file doc and the comment at about line 454.
- `src/stores/slices/eventsSlice.ts` (`addEvent`, returns `EventWriteResult`) and `datesSlice.ts` (`addAnniversary(input, clientKey)`, throws) -- read only.
- `src/hooks/useSubmitKey.ts` -- `keyFor`, plus `reset` on success.
- `tests/support/helpers/settings-screen.ts` -- `settingsEventsLoaded`, `returnToSettings` and `reloadSettings` wait on `events-settings-load-region`, and on an events GET that only `EventsSettings` sent. They are used by about 25 specs, including every new one.
- `tests/support/eventsValidationContract.ts` (lines 29, 35, 42) and `tests/unit/components/eventsValidationMirrors.test.ts` (lines 5, 20, 119) -- they parse `EventsSettings.tsx` for the three constants. Check that the extractor accepts `export const`, and adjust it if not.
- `src/components/shared/kitClasses.ts` -- `GROUP_TITLE`, `GROUP_SUBTITLE`, `EDIT_BUTTON`, `DELETE_BUTTON`, `ITEM_ROW`, `ITEM_LABEL`, `ITEM_META`, `SMALL_SECONDARY`, `DIALOG_CLOSE`, `REQUIRED_MARK` and `FIELD_ERROR` are used only by the deleted files. Delete any of them still unimported after the change (check with grep across `src` and `tests`), and fix the header comment at line 3.
- Shared test pieces: `src/components/Settings/__tests__/Settings.anniversaryPages.test.tsx`, `Settings.eventPages.test.tsx` and `settingsStackKit.ts` show the store, stack and Capacitor harness. E2E pieces: `tests/e2e/settings/event-pages.spec.ts` and `anniversary-pages.spec.ts` (pool accounts, `resolveOwnPair`, cleanup of seeded rows only), plus `tests/support/helpers/reads.ts` and `dates-list-format.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `SettingsStack.tsx` and `SettingsBar.tsx` -- the `leading: 'cancel'` bar form described in the Code Map.
- [ ] `src/components/Settings/NewDatePages.tsx` (new) -- build `KindChooser`, `NewEventPage`, `NewAnniversaryPage` and an exported `IconPicker`, with a file doc.
  - Layout: the Error box, then one `CARD` with `gap-4` and each field under a visible `FIELD_LABEL` label. The Note is a `fieldClass(false, true)` textarea with `rows={3}`.
  - `IconPicker` is three equal 48px tiles, as DESIGN.md's Form page describes. Copy the tile classes from `EventsSettings.tsx` (around line 1113) before deleting it.
  - Test ids:
    - forms: `settings-new-event-page`, `settings-new-anniversary-page`
    - fields: `settings-new-<event|anniversary>-<name|date|note>-field`
    - icon tiles: `settings-new-event-icon-<value>`
    - Add: `settings-form-add`; Error box: `settings-form-error`
    - chooser: `settings-kind-chooser`, with `-event`, `-anniversary` and `-cancel`
- [ ] `EventPages.tsx`, `DatesPage.tsx`, `Settings.tsx` -- per the Code Map.
- [ ] Delete `EventsSettings.tsx`, `AnniversarySettings.tsx`, `CountdownMarks.tsx`, every `__tests__/EventsSettings.*`, `eventsSettingsKit.tsx`, `AnniversarySettings.*` and `CountdownMarks.test.tsx`.
- [ ] Unit test edits:
  - Drop the `vi.mock('../AnniversarySettings' | '../EventsSettings')` lines in the six `Settings.*.test.tsx` files.
  - `Settings.kit.test.tsx`: the h2 list becomes Account, Partner, About; drop the Events/Anniversaries h3s and fix the header.
  - `Settings.profile.test.tsx:223`: the Countdowns h2 is now absent.
  - `kitDialogs.test.tsx`: assert the same panel and scrim classes by rendering `ConfirmDialog`.
  - Retarget `eventsValidationContract.ts` and `eventsValidationMirrors.test.ts` to `EventPages.tsx`.
- [ ] `src/components/Settings/__tests__/Settings.newDatePages.test.tsx` (new) -- through the real store and stack, cover:
  - every matrix row;
  - the Add rules at the limits (100 and 101 code points, 500 and 501);
  - the trimmed label and the null or undefined note in the write payload;
  - a double tap sends one write;
  - `invalid-response` latches Add;
  - the same key on an anniversary retry and a new key for a changed payload (carried from `AnniversarySettings.writes.test.tsx`);
  - a reload on each form shows the Dates list;
  - Cancel writes nothing;
  - the top page has no Countdowns.
- [ ] `tests/support/helpers/settings-screen.ts` -- `openSettingsFromHome`, `returnToSettings` and `reloadSettings` settle on `settings-view`, with no Settings events GET. Delete `settingsEventsLoaded`, or make it wait for the Dates list's own `loadEvents` read when called from `/settings/dates`. Update the callers.
- [ ] E2E rewrites, in place:
  - `events-crud`: add from an empty Dates list through `+` → Event; the added event shows on Home with no reload; a field-page edit changes the Dates list row and Home; a reload of `/settings/dates` lists events; a rejected create (500) keeps the form. Rewrite the older-snapshot test onto the Dates list's mount read if that race still exists there; otherwise delete it and give the reason in the commit. Delete the cases `event-pages`/`dates-list` already cover.
  - `events-persistence`: the icon chosen on the form survives a reload (the event page's Icon row) and shows on Home; the Dates list orders by date; clearing the Note sends `description: null` and Home drops it.
  - `events-check-constraint` and `errors/empty-database-error-fallback`: the same stubbed responses and the exact messages, on the New event form.
  - `events-write-failures`: a zero-row edit goes to a field page's Error box, a zero-row delete to the event page's Error box, and an offline add keeps the fields. The Refresh controls are gone.
  - `events-history-pagination`: Load more reaches a deep row; edit it, reload, page back and edit again; a deep-past event added through the form can be paged to; Load more is absent at 0 rows and at exactly one page; tied timestamps keep their order; Home stays at 6 cards.
  - `events-load-recovery`: rows appear on the Dates list after reconnect.
  - `offline/events-offline-copy`: Dates list rows.
  - `navigation/theme-sweep` (lines 135-137) and `settings-kit`: drop the Countdowns waits and assertions.
  - `account-data/cross-device`: create the anniversary through the form; the fresh context finds `settings-dates-anniversary-*`.
  - A new `tests/e2e/settings/new-date-forms.spec.ts` with a pool account: `+` → Anniversary → Add → the row is on the Dates list, the server row exists, and the anniversary shows on Home's countdown. Cancel creates nothing. A reload on `/settings/dates/new-event` shows the Dates list. Clean up only the seeded rows.
- [ ] Delete `events-accessibility.spec.ts` (axe scans of the deleted modal) and `events-refresh-unmount.spec.ts` (Refresh and Retry controls that no longer exist). Give the reasons in the commit.
- [ ] Comments: `NotificationsPage.tsx:27`, `eventsService.ts:392`, and the stale `EventsSettings` file references in the `tests/` comments listed by grep.
- [ ] `AGENTS.md` -- the Settings-subpage paragraph: a form page is registered with `reloadsToParent` and `leading: 'cancel'`.
- [ ] `_bmad-output/initiative-my-love/deferred-work.md` -- add two open entries (next ids after DW-431):
  - no E2E axe coverage of the new Settings pages since `events-accessibility` was deleted;
  - `reminderDateEntries` (`src/services/dateReminders.ts`) has no production caller now that `CountdownMarks` is gone.

**Acceptance Criteria:**
- Given the Dates list, when `+` → Event, then Name, Date and Note are filled and Add is tapped, then the app is on the Dates list with the event in its Events group, and Home shows its card without a reload.
- Given the Dates list, when `+` → Anniversary is added the same way, then it is listed under Anniversaries and on Home's countdown, and the partner's Dates list never shows it.
- Given a New event or New anniversary form, when the page is reloaded, then the Dates list is shown.
- Given `/settings`, when the top page renders, then it shows only its row groups, the log-out card and the version line, with no Countdowns section and no reminder list.

## Implementation Notes

- A Sonnet subagent implemented the plan.
  - `SettingsBar` widens both side columns to 88px only on a Cancel bar, so the title stays centred.
  - `EventPages.tsx` exports the limits, `codePoints` and `ICON_OPTIONS`, each with a lint-suppression reason. The validation contract now parses that file and accepts `export const`.
- **Narrowed or dropped E2E assertions** (the commit message records them):
  - `settings-stack`'s collapse test runs at a 480px-tall viewport. The top page is too short to scroll without the Countdowns section.
  - `events-history-pagination` drops the history notice and the Retry-focus case. The Dates list has neither.
  - The "edit only own events" case and `events-crud`'s delete and partner-read-only cases are dropped: `event-pages.spec.ts` covers them.
  - `events-load-recovery` drops the load-error notice and Retry. The Dates list shows no load outcome, so the spec now checks that rows appear after reconnect.
  - The older-snapshot race test was rewritten onto the Dates list's mount read, because that race still exists there.
- **Deleted specs:**
  - `events-accessibility.spec.ts` axe-scanned only the deleted modal (DW-432).
  - `events-refresh-unmount.spec.ts` tested Refresh and Retry controls that no longer exist.
- **Parent session, during verify:**
  - Fixed the deprecated `FormEvent` type (now `SubmitEvent<HTMLFormElement>`) and removed a stale comment in `Settings.profile.test.tsx`.
  - Fixed a 1-in-8 race in `events-history-pagination`'s deep-past add. Add returns to the Dates list, which mounts again and reloads its first window, and that drops a date beyond the window. The test now waits for that reload and pages to the row; the add helper's doc says it is only for dates inside the first window. The reload on return is existing Dates-list behaviour, recorded as DW-434.
- **E2E setup:** E2E ran through a scratchpad `supabase` shim that points `status` at a patched config copy. The Homebrew CLI 3.0.0 rejects the committed `config.toml`, as in stories 5.4–5.12. Nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 8 findings — high 0, medium 0, low 7, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` After Add, the Dates list's remount reload drops a new date that lies beyond its first window, against the matrix's "sits in its group".
    - Real. It needs a past date more than 50 past events deep, which is rare for one couple.
    - The cause is the existing reload-on-mount in `DatesPage` (story 5.9), and the fix adds branching. Recorded as DW-434.
  - `[low]` `[patch]` The `settings-reminder-marks` absence check in `Settings.newDatePages.test.tsx` could never fail, because Capacitor was mocked off. Fixed: the test turns native and the plugin on before rendering.
  - `[low]` `[patch]` No test checked that the partner never sees an anniversary added through the form. Fixed: `new-date-forms.spec.ts` signs the partner in a second context and asserts the row is absent from their Dates list.
  - `[low]` `[patch]` `empty-database-error-fallback.spec.ts` dropped the DOM check that no event was added. Fixed: it taps Cancel and asserts no row with the label on the Dates list.
  - `[false]` `[reject]` The deleted specs and dropped cases need their reasons in the commit message. Nothing was committed yet; the finalize commit carries the reasons, listed in Implementation Notes.
  - `[low]` `[patch]` `@axe-core/playwright` had no user left. Fixed: removed with `npm uninstall --package-lock-only`, after a check that nothing requires it. The lock loses only its entries and `axe-core`'s, and DW-432 says it returns if a scan is wanted.
  - `[low]` `[patch]` The `codePoints` lint-suppression reason named the contract parser, which never reads `codePoints`. Fixed: the reason now says it is shared with `NewDatePages`.
  - `[low]` `[patch]` A `vitest.config.ts` comment named the deleted `eventsSettingsKit`. Fixed: it now names `settingsStackKit`.

## Design Notes

- **The constants stay in `EventPages.tsx`.** The source-parsing contract can read only one file, so the form imports the limits rather than copying them.
- **The Kind chooser has no visible title.** DESIGN.md describes only the buttons, and EXPERIENCE.md confirms no question string. Its accessible name reuses the `+` button's label.
- **`IconPicker` is exported for the Icon page.** That reuse is DW-430's, for the sweep, not this story.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0. The worktree TS2883 baseline is excepted if it is present at baseline.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings tests/e2e/errors tests/e2e/offline tests/e2e/account-data tests/e2e/navigation tests/e2e/home --project=chromium` -- expected: pass on the local stack, with no leftover rows.
- `grep -rn "EventsSettings\|AnniversarySettings\|CountdownMarks\|events-settings-\|settings-countdowns" src tests` -- expected: no code references.

**Manual checks (if no CLI):**
- In the browser, check both forms in light and dark at phone width. Cancel and Add fit the bar, the title stays centred, and nothing scrolls sideways.

## Auto Run Result

Status: built

**Summary.**
- **Adding a date:** the Dates list's bar has a `+` button (`Add a date`). It opens the Kind chooser, the kit dialog with `Event`, `Anniversary` and `Cancel`. A kind pushes `dates/new-event` or `dates/new-anniversary`.
- **The Form pages:** Cancel and Add in the bar, every field at once. Add is disabled at 50% until Name and a valid Date are filled; for an event, within the 100 and 500 code-point limits. The event form starts on Calendar.
- **Add:**
  - offline, it refuses before any request and keeps the fields;
  - a failure shows in the Error box;
  - an event `invalid-response` keeps Add disabled;
  - an anniversary retry reuses its `clientKey`;
  - success returns to the opener with `goBack()`.
- **Reload:** a reload on either form shows the Dates list.
- **Removed:** the old Countdowns section (`EventsSettings`, `AnniversarySettings`) and the per-date reminder list (`CountdownMarks`). The top page now holds only its rows and the version line.

**Files changed**
- `src/components/Settings/NewDatePages.tsx` (new): `KindChooser`, `NewEventPage`, `NewAnniversaryPage` and `IconPicker`.
- `src/components/Settings/DatesPage.tsx`: the `+` button and the chooser.
- `src/components/Settings/Settings.tsx`: the two form subpages; the Countdowns section and reminder list removed.
- `src/components/Settings/stack/SettingsStack.tsx`, `SettingsBar.tsx`: `leading: 'cancel'` for form pages.
- `src/components/Settings/EventPages.tsx`: the validation limits and `ICON_OPTIONS` are exported.
- `src/components/shared/kitClasses.ts`: the exports only the deleted files used are removed.
- Deleted: `EventsSettings.tsx`, `AnniversarySettings.tsx`, `CountdownMarks.tsx`, and their 14 unit suites and kit.
- Unit tests:
  - `Settings.newDatePages.test.tsx` (new, 30 cases);
  - edits to `Settings.kit`, `Settings.profile`, `Settings.dates`, `kitDialogs` and six mock blocks;
  - the validation contract and its test now parse `EventPages.tsx`.
- E2E:
  - the `settings-screen.ts` helpers no longer wait on a Settings events read; `openDatesList` and `reloadDatesList` are new;
  - `tests/support/helpers/new-date-forms.ts` (new) and `tests/e2e/settings/new-date-forms.spec.ts` (new);
  - rewritten: `events-crud`, `events-persistence`, `events-check-constraint`, `events-write-failures`, `events-history-pagination`, `events-load-recovery`, `empty-database-error-fallback`, `cross-device`, `events-offline-copy`, `account-data-offline-copy`, `theme-sweep`, `settings-kit` and `settings-stack`;
  - deleted: `events-accessibility` and `events-refresh-unmount`.
- `package.json` and `package-lock.json`: the unused `@axe-core/playwright` is removed.
- `AGENTS.md`: the form-page rule in the Settings-subpage paragraph.
- `deferred-work.md`: DW-432 (no E2E axe coverage), DW-433 (`reminderDateEntries` unused) and DW-434 (the Dates list reloads its first window on return).
- Comment fixes: `NotificationsPage.tsx`, `eventsService.ts`, `vitest.config.ts`, and test headers.

**Review findings.** One quick pass found 8 findings:
- 6 low findings patched: a vacuous absence check, the partner-privacy check for a form-made anniversary, the restored no-row DOM check, a lint-suppression reason, a stale comment, and the unused axe dependency.
- 1 low rejected: the Dates list drops a newly added date beyond its first window. It is rare, the cause is the list's existing reload on mount, and DW-434 records it.
- 1 false: the commit-message reasons, which this commit carries.
- Nothing deferred.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 6.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck` (`tsc -b --force`): exit 0.
- `npm run test:unit`: 219 files, 4032 tests passed.
- `npx playwright test tests/e2e/settings tests/e2e/errors tests/e2e/offline tests/e2e/account-data tests/e2e/navigation tests/e2e/home --project=chromium`: 179 passed on the local stack, with no leftover rows.
- Burn-in:
  - 13 changed specs, 3 repeats each: 183 passed;
  - `events-history-pagination`, 6 repeats: 36 passed;
  - the two patched specs, 3 repeats each: 18 passed.
- The stale-name grep finds only absence assertions and store names.
- Every matrix row has a covering unit or E2E test that ran and passed.
- The subagent screenshotted the New event form and the Kind chooser in light and dark at 390px: no sideways scroll, and Cancel and Add fit the bar.

**Residual risks**
- **Deep-past dates (DW-434):** a date added beyond the Dates list's first window disappears from the list when it reloads on return. It can still be reached through Load more.
- **No device check:** neither form was tried on a phone or simulator.
- **No axe coverage:** nothing scans the Settings pages (DW-432).
- **CLI shim:** E2E ran through the scratchpad Supabase CLI shim.
