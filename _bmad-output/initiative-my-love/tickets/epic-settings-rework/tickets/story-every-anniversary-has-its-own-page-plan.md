---
title: 'Every anniversary has its own page'
type: 'feature'
ticket: '12'
created: '2026-11-03'
status: done
baseline_revision: 'beab1781e085d0a7e6c11174b2da2185deb8b9a7'
route: 'full'
route_source: 'auto'
risk: 'low'
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

**Problem:** The Dates list's anniversary rows target `dates/anniversary/<key>`, which has no page (a tap lands on the top page), so an anniversary can be changed only in the old Countdowns form (R7, R8, R3).

**Approach:** Match `dates/anniversary/<key>` and its three one-field pages in `resolveSettingsPage`, and build the anniversary page and its field pages on story 11's pieces (`DatePage`, `ConfirmDialog`, `useFallBackToDates`, `RemindMeGroup`, `OneFieldPage`). `loadAnniversariesFromServer` reports whether it got an answer, so the page can tell "absent" from "not loaded yet".

## Boundaries & Constraints

**Always:** Copy EXPERIENCE.md's strings exactly. The page title is the anniversary's label (`Anniversary` until it is known). The rows are `Name`, `Date` and `Note`, with no Icon row, then `Remind me`, then `Delete anniversary` centered in danger, alone in its own card. The dialog asks `Delete this anniversary?` with `Cancel` and `Delete`, the same shape as `Delete this event?`. Field page titles are `Name`, `Date` and `Note`. Every page uses the `small` title style. Field pages are `OneFieldPage`s with `reloadsToParent`; the anniversary page reloads to itself. The path key is `serverId ?? String(id)`, as `DatesPage` builds it. Writes go through `updateAnniversary(id, { label, date, description })`, sending the whole input with one field replaced, and `removeAnniversary(id)`; both throw. Offline refusals are `offlineMessage('Anniversaries')` and `offlineMessage('Anniversaries', 'delete')`, called through `isOnline()`, never typed out. Remind me is `RemindMeGroup` with `MARK_KEYS.anniversary(serverId)`, shown only while the anniversary has a `serverId`. It shows on every anniversary, because an anniversary recurs. The Date row's value is `yearlyValue(date)`, as on the Dates list. Use kit classes and tokens only, with no `dark:`. Rows are at least 44pt and fields 16px. Match the surrounding style by hand (no `prettier --write`).

**Never:**
- No `+`, forms or Kind chooser (story 13).
- Do not change or remove `AnniversarySettings`, `EventsSettings`, the Countdowns section or `CountdownMarks`.
- No Home card change (story 14).
- No migration and no service change.
- The only store change is `loadAnniversariesFromServer`'s return value.
- No new length limits: the table checks only `char_length(label) >= 1`.
- No screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Page | anniversary held | The rows are Name (label, `truncateValue`), Date (`yearlyValue`) and Note (description, or empty when there is none, `truncateValue`), each targeting `dates/anniversary/<key>/<field>`. Then Remind me (shell only, when there is a `serverId`). Then `Delete anniversary`. | — |
| Not held yet | reload before the answer arrives | Title `Anniversary`, nothing under the bar | — |
| Absent once answered | the page's own `loadAnniversariesFromServer()` resolved `true` without the key | Falls back to the Dates list once per mount (StrictMode-safe) | A `false` answer (offline with no copy, or a failed read) never falls back |
| Held | anniversary in the store at mount | The page sends no read | — |
| Name page | `…/name` | Text field prefilled. Save is enabled for a trimmed, non-empty value that differs. Then back one level | Offline → `offlineMessage('Anniversaries')` in the field page's Error box, with the value kept. A thrown error → its message |
| Date page | `…/date` | `type=date`; any `parseEventDate`-valid date | as Name |
| Note page | `…/note` | Textarea. Empty is allowed and saves `description: undefined` | as Name |
| Field page, unknown key | absent anniversary | renders nothing | — |
| Delete, online | tap `Delete anniversary` | The dialog opens with Cancel focused. Escape, the scrim or Cancel closes it with no request. `Delete` closes it, disables the row and runs `removeAnniversary`, then returns to the Dates list exactly once | A thrown error → its message in the page Error box, and the row re-enabled |
| Delete, offline | tap (or confirm after dropping offline) | No dialog, or the dialog closes. `offlineMessage('Anniversaries', 'delete')` in the Error box. No request | — |
| Partner's anniversary | a row owned by the partner | Never in the reader's Dates list: the mirror holds only the reader's rows | — |

</intent-contract>

## Code Map

- `src/components/Settings/EventPages.tsx` -- the template to mirror: page and field-page structure, the `mounted` and `held` refs, the load-only-when-not-held effect on `[userId, authSessionVersion, online, …]`, `requestDelete` and `confirmDelete` (refuse before the dialog, once-only `leave()`), the Delete button classes, `ConfirmDialog` inside `AnimatePresence`, and the field classes. Read only; do not refactor it into shared code.
- `src/components/Settings/ConfirmDialog.tsx`, `dateNavigation.ts` (`useFallBackToDates(absent)` → `leave`), `DatePages.tsx` (`DatePage` wrapper with the `settings-date-error` box), `RemindMe.tsx` (`RemindMeGroup`), `stack/OneFieldPage.tsx` (`save` throws to show its message; the value arrives trimmed), `stack/SettingsRows.tsx` (`SettingsRow` `truncateValue`), and `settingsFields.ts` (`yearlyValue`) -- reuse them unchanged.
- `src/components/Settings/Settings.tsx` -- next to `EVENT_PATH` (~line 290), add `ANNIVERSARY_PATH = /^dates\/anniversary\/([^/]+)(?:\/(name|date|note))?$/` and its field titles. Match it in `resolveSettingsPage`, taking the title from `useAppStore((s) => s.settings?.relationship.anniversaries)`. Update the comment above `resolveSettingsPage` and the file doc's subpage list.
- `src/stores/slices/datesSlice.ts` -- in `loadAnniversariesFromServer` (~line 424), change the interface (~line 91) to `Promise<boolean>`. It returns `true` when the server's rows were applied, or when the device is offline and the session is fresh or a saved copy was applied. It returns `false` otherwise: no user, an account change, offline with no copy, or a failed read. Keep `registerLocalCopy` typed `() => Promise<void>` with a wrapper. Update the doc line for the action.
- `src/components/Settings/DatesPage.tsx` -- update the doc paragraph that says the anniversary page arrives in story 12. Behavior stays the same.
- Store test: `tests/unit/stores/accountDataSlices.anniversaries.test.ts` -- add return-value cases there.
- Tests: `src/components/Settings/__tests__/Settings.eventPages.test.tsx`, `settingsStackKit.ts` and `SettingsStack.test.tsx` show the patterns, including the Capacitor mock that turns `hasNativeReminders` on. For E2E: `tests/e2e/settings/event-pages.spec.ts` covers pool accounts, `resolveOwnPair` and cleanup of only the rows it seeded; `tests/support/helpers/dates-list-format.ts` and `tests/support/helpers/reads.ts` (`ANNIVERSARIES_READ`) are the helpers. Seed anniversaries with `supabaseAdmin.from('anniversaries').insert(...)` before the app reads them. Import `{ test, expect }` from `tests/support/merged-fixtures.ts`.
- `AGENTS.md` -- the Settings-subpage paragraph names `dates/event/<id>` as the id-path example. Add `dates/anniversary/<id>` beside it.

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/datesSlice.ts` -- `loadAnniversariesFromServer` resolves the answered boolean -- so the page can fall back only after a real answer.
- [ ] `src/components/Settings/AnniversaryPages.tsx` (new) -- build `AnniversaryPage({ anniversaryKey })` and `AnniversaryFieldPage({ anniversaryKey, field })` per the matrix, plus a file doc. Test ids:
  - page: `settings-anniversary-page`
  - rows: `settings-anniversary-name`, `settings-anniversary-date`, `settings-anniversary-note`
  - delete row: `settings-anniversary-delete`
  - dialog: `settings-anniversary-delete-confirmation`, with `-cancel` and `-confirm`
  - field pages: `settings-anniversary-<field>-page`
  - fields: `settings-anniversary-name-field`, `settings-anniversary-date-field`, `settings-anniversary-note-field`
- [ ] `src/components/Settings/Settings.tsx` -- resolve the anniversary paths. Update the docs.
- [ ] `src/components/Settings/DatesPage.tsx`, `AGENTS.md` -- the doc lines above.
- [ ] `src/components/Settings/__tests__/Settings.anniversaryPages.test.tsx` (new) -- through the real store and stack, with Capacitor on and off, cover:
  - every matrix row
  - the field Save rules, errors and the whole-input write
  - a reload: on the page it stays; on a field page it shows its parent
  - delete online, offline, failing and cancelled, with a single go-back under `<StrictMode>`
  - Remind me hidden without a `serverId`

  In the store test, add the return-value cases.
- [ ] `tests/e2e/settings/anniversary-pages.spec.ts` (new) -- use a pool account and seed the reader's own anniversary plus one owned by the partner.
  - Flow: Dates list → own anniversary → edit Name, Date and Note. Each save returns to the page with the new value, and the test checks the server row.
  - `Delete anniversary` → Cancel keeps it → Delete removes it, lands on the Dates list and removes the server row.
  - A reload on the page stays on it.
  - The partner's anniversary never appears in the Dates list.
  - Clean up only the rows it seeded.

**Acceptance Criteria:**
- Given the Dates list, when an anniversary row is tapped, then its page opens, titled with its name, and shows Name, Date, Note and `Delete anniversary` with no Icon row, and back returns to the Dates list.
- Given an anniversary's page, when a field is edited and saved, then the page returns one level, and the row, the title (for Name) and the Dates list show the new value without a reload.
- Given an anniversary's page, when `Delete anniversary` is confirmed online, then the anniversary is gone and the app is on the Dates list. Cancel leaves it untouched.
- Given a linked couple where the partner has an anniversary, when the reader opens the Dates list, then the partner's anniversary is not listed.
- Given the shell with the local-notifications plugin, when an anniversary's page opens, then Remind me is there with `A month and a week before.` (unit check).

## Implementation Notes

- A Sonnet subagent implemented this from the plan. `loadAnniversariesFromServer` now resolves a boolean, and `registerLocalCopy` gets a `Promise<void>` wrapper around it.
- The E2E specs ran on the local stack through a scratch preload shim that points `playwright.config.ts`'s `supabase status` at the 2.122.0 CLI. The Homebrew 3.0.0 binary on PATH rejects the committed `config.toml`, the same issue stories 5.4–5.11 worked around. Nothing in the repo changed for it.
- Simulator check not run: this run did not check for a booted simulator. Remind me on an anniversary page is covered by unit tests with Capacitor mocked.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `AnniversaryPages.tsx` file doc and load-effect comment said the Dates list loads anniversaries, but `DatesPage` only calls `loadEvents` — fixed: both comments reworded to say the page asks for itself; no code change.
  - `[low]` `[patch]` The same comments said nothing refreshes anniversaries while Settings is open, but `App.tsx` runs `refreshLocalCopies()` (the anniversaries refresher included) on the window `online` event — fixed: the comments now name the signed-in start and reconnect refreshes.
  - `[low]` `[patch]` In `anniversary-pages.spec.ts`, `row()` ignored the admin query's `error`, so a failed read made the "server row removed" check pass vacuously — fixed: `row()` throws on a query error.

## Design Notes

- **Answered boolean, not a new status type.** Unlike events, anniversaries are not paged, so a load cannot drop a held row. The page still loads only when the anniversary is not held, matching the event page: a delete removes the row and must not start a read. Offline with a saved copy counts as an answer, as `loadEvents` treats it.
- **Delete offline** is refused before the dialog opens, as on the event page.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0 (the worktree TS2883 baseline is excepted if it is present at baseline).
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings --project=chromium` -- expected: pass on the local stack.

**Manual checks (if no CLI):**
- On a simulator, when the prerequisites in `scripts/sim-driver/README.md` are met: open an anniversary's page and tap Remind me; `sim pending` should list its month and week reminders. Otherwise record the check as not run.

## Auto Run Result

Status: built

**Summary.** A Dates list anniversary row now opens that anniversary's own page at `/settings/dates/anniversary/<key>`, titled with its name (`Anniversary` until the name is known).
- **Rows:** Name, Date and Note, with no Icon row. Each opens a one-field page (`…/name`, `…/date`, `…/note`) that saves the whole input through `updateAnniversary` and returns one level.
- **Remind me:** shown in the shell with the local-notifications plugin, while the anniversary has a server id.
- **Delete anniversary:** centred, alone in its own card. It asks `Delete this anniversary?` (Cancel focused; Escape and the scrim cancel). Offline it refuses before the dialog. On success it returns to the Dates list exactly once.
- **Reloads:** the page reloads to itself. A field page reloads to the anniversary page.
- **Absent anniversary:** the page falls back to the Dates list only after its own `loadAnniversariesFromServer()` answers `true` without that anniversary. The function now reports whether it got an answer.
- **Privacy:** a partner's anniversary is never listed, because the store holds only the reader's own anniversaries (confirmed in E2E).

**Files changed**
- `src/components/Settings/AnniversaryPages.tsx` (new): `AnniversaryPage` and `AnniversaryFieldPage`.
- `src/components/Settings/Settings.tsx`: `ANNIVERSARY_PATH` is matched in `resolveSettingsPage`, with the title taken from the store; docs updated.
- `src/stores/slices/datesSlice.ts`: `loadAnniversariesFromServer` resolves the answered boolean; the refresher registration is wrapped.
- `src/components/Settings/DatesPage.tsx`: the doc line about row targets.
- `AGENTS.md`: `dates/anniversary/<id>` added beside the event example of an id path.
- `src/components/Settings/__tests__/Settings.anniversaryPages.test.tsx` (new): 35 cases.
- `tests/unit/stores/accountDataSlices.anniversaries.test.ts`: 7 return-value cases.
- `tests/e2e/settings/anniversary-pages.spec.ts` (new): edit, reload, cancel and delete; the partner's anniversary is never listed.

**Review findings.** One quick pass found 3 low findings, all patched: two comments that described refreshes wrongly, and an E2E read helper that ignored errors. None was deferred or rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 3.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 232 files, 4218 tests passed.
- `npx playwright test tests/e2e/settings --project=chromium`: 72 passed on the local stack, with no leftover rows.
- Every row of the I/O matrix has a passing covering test.

**Residual risks**
- **Simulator not run:** `sim pending` was not run for Remind me on an anniversary page.
- **No visual review:** the pages were not checked in light and dark.
- **CLI shim:** E2E ran through the CLI shim described in Implementation Notes.
