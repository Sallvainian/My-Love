---
title: 'Every event has its own page'
type: 'feature'
ticket: '11'
created: '2026-11-03'
status: done
baseline_revision: '2779fbc8c8f306e0b54a7f39dfc09e3a46b2df88'
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
deferred:
  - summary: >-
      An event's Icon row shows a text value and its Icon page uses check rows, where DESIGN.md asks for the glyph and the Form page's three-tile picker (ledger DW-430).
    evidence: |-
      DESIGN.md Components: "An Icon field row shows the event's glyph in accent in place of a text value" and "The icon field is the three-option picker used on the Form page". This plan's matrix specified text values and check rows; the implementer flagged the mismatch. Story 5.13 builds the picker.
    location: >-
      src/components/Settings/EventPages.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Dates list's event rows target `dates/event/<id>`, which has no page (a tap lands on the top page), so an event can be changed only in the old Countdowns form (R7, R8, R3).

**Approach:** Match `dates/event/<id>` and its four one-field pages in `resolveSettingsPage`, build the own / past / partner's event page and its field pages, a reusable delete Confirmation dialog, and make the stack's "page above" the nearest ancestor path that has a page.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md: page title is the event's label (`Event` until it is known); rows `Name`, `Date`, `Note`, `Icon`, `Remind me`; `Delete event`; dialog question `Delete this event?`, buttons `Cancel` and `Delete`; icon choices `Calendar`, `Ring`, `Plane`. Pages `small` title style; field pages are `OneFieldPage`s with `reloadsToParent`; the event page reloads to itself. Writes go through `editEvent` / `removeEvent`; offline refusals via `isOnline()` + `offlineMessage('Events')` / `offlineMessage('Events', 'delete')`, never typed. Remind me is `RemindMeGroup` with `MARK_KEYS.event(id)`. Upcoming vs past is `getCalendarDaysDiff(event.date, now) >= 0` (today is upcoming), as on the Dates list. Kit classes and tokens only, no `dark:`; rows ≥44pt, fields 16px. Match surrounding style by hand (no `prettier --write`).

**Never:** No anniversary page, `+`, forms or Kind chooser (stories 12–13); do not change or remove `EventsSettings`, `AnniversarySettings`, the Countdowns section or `CountdownMarks`; no Home card change (story 14); no store, service, migration or local-copy change; no single-event fetch; no screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own upcoming event | `event.userId === userId`, date ≥ today | Rows Name (label), Date (`formatListDate`), Note (description, empty when none, truncated), Icon (`Calendar`/`Ring`/`Plane`), each targeting `dates/event/<id>/<field>`; Remind me (shell); `Delete event` centered danger, alone in its own card | — |
| Own past event | date < today | Same rows and Delete; no Remind me group | — |
| Partner's event | `userId` differs | `ReadOnlyRow`s Date, Note (full text, wraps), Icon; Remind me if upcoming; no Delete, no footnote | — |
| Event not in store, not answered | reload before the page's own `loadEvents` resolves | Title `Event`, nothing under the bar | — |
| Event absent once answered | page's `loadEvents()` resolved `success` and no event with the id | Falls back to the Dates list once per mount (StrictMode-safe) | A `failure`/`stale` load never falls back |
| Name page | `…/name` | text field prefilled; Save only for a trimmed, non-empty value of ≤100 code points that differs; `editEvent(id, { label })`; back one level | offline → `offlineMessage('Events')` in `settings-field-error`, value kept; failure → the result's `error` |
| Date page | `…/date` | `type=date`; any `parseEventDate`-valid date (past allowed); `editEvent(id, { eventDate })` | as Name |
| Note page | `…/note` | textarea; empty allowed (saves `description: null`), ≤500 code points; `editEvent(id, { description })` | as Name |
| Icon page | `…/icon` | three check rows (radio semantics), current one checked; Save once a different one is picked; `editEvent(id, { icon })` | as Name |
| Field page, not own / absent | partner's or unknown event | renders nothing (no field, no Save) | — |
| Delete, online | tap `Delete event` | Confirmation dialog, Cancel focused; Escape / scrim / Cancel closes with no request; `Delete` closes it, disables the row, runs `removeEvent`, then returns to the Dates list exactly once | failure → the result's `error` in the page Error box, row re-enabled |
| Delete, offline | tap `Delete event` (or confirm after dropping offline) | no dialog (or dialog closes); Error box `offlineMessage('Events', 'delete')`; no request | — |
| Pasted `/settings/dates/event/<id>` | fresh load, back arrow | Goes to `dates` (the nearest ancestor with a page), not the top page | — |

</intent-contract>

## Code Map

- `src/components/Settings/stack/SettingsStack.tsx` -- `parentOf` is used by `goBack`'s fresh-load replace and the reload-to-parent effect; `dates/event` has no page, so add a "nearest ancestor that `resolvePage` answers" helper and use it in those two places (leave the focus walk and `segments` as they are). Update the file doc's parent wording.
- `src/components/Settings/Settings.tsx` -- `resolveSettingsPage` (end of file) already special-cases `dates/partner-birthday`'s title; add the `dates/event/<id>` and `dates/event/<id>/(name|date|note|icon)` match there, reading `useAppStore((s) => s.events)` for the title. Update the file doc's subpage list.
- `src/components/Settings/DatePages.tsx` -- `DatePage` (wrapper with `settings-date-error` Error box), `useFallBackToDates` (once-per-mount `goBack`), and the Wedding `Clear` button styling (centered danger row in its own `SettingsGroup`) are the patterns. Export `DatePage`; move `useFallBackToDates` to a new non-component module so the `react-refresh` lint rule stays green, and have it return an idempotent `leave()` the delete path shares (so a delete and the absence fallback never both go back).
- `src/components/Settings/RemindMe.tsx` -- `RemindMeGroup({ markKey, onError })`, reuse unchanged; its doc already names story 11.
- `src/components/Settings/DatesPage.tsx` -- `EVENT_ICONS`, the `loadEvents` effect on `[userId, authSessionVersion, isOnline]`, `formatListDate`, upcoming/past split; rows already target `dates/event/${event.id}`. Its doc line about the targets may be updated; behavior unchanged.
- `src/components/Settings/stack/OneFieldPage.tsx` -- `save` must throw to show an error: wrap `editEvent`'s `EventWriteResult` (`if (!r.success) throw new Error(r.error)`). Focus goes to the element with the field `id`.
- `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsRow`'s value is `shrink-0 whitespace-nowrap`, so a long note would spill past the card: add an opt-in prop that lets the value truncate (`min-w-0` + `truncate`, capped width); other rows unchanged. `ReadOnlyRow` already wraps.
- `src/components/Settings/PhotosPage.tsx` -- check-row radio pattern (`GROUP_ROW`, sr-only radio, `Check` icon) for the Icon page.
- `src/components/Settings/EventsSettings.tsx` -- `LABEL_MAX_LENGTH = 100`, `DESCRIPTION_MAX_LENGTH = 500` (code points, `[...s].length`), `ICON_OPTIONS`, and `EventDeleteConfirmation` (focus trap with `useFocusTrap`, `DIALOG_*` classes) are the rules and look to mirror; read-only, do not import from it (story 13 deletes the section). `Settings.tsx`'s `SignOutEverywhereConfirmation` is the simpler dialog shape DESIGN.md specifies.
- Store: `events`, `loadEvents` (returns `EventLoadResult`), `editEvent`, `removeEvent` (return `EventWriteResult`), `userId`, `authSessionVersion`, `syncStatus.isOnline` (`eventsSlice`). `MARK_KEYS.event` in `src/services/dateReminders.ts`. `getCalendarDaysDiff` in `src/components/RelationshipTimers/eventCountdownHelpers.ts`.
- Tests: patterns in `__tests__/Settings.datePages.test.tsx`, `settingsStackKit.ts`, `SettingsStack.test.tsx`; Capacitor mocking for `hasNativeReminders` as there. E2E: `tests/e2e/settings/date-pages.spec.ts`, `dates-list.spec.ts` (seeding events with `seedEvent` / `clearOwnPairEvents`, opening Settings), `tests/support/helpers/events.ts` (`clockAnchor`, `isoDateDaysFromNow`). Import `{ test, expect }` from `tests/support/merged-fixtures.ts`.
- `AGENTS.md` -- the Settings-subpage paragraph says a subpage is added to `SUBPAGES`; add one sentence that a path carrying an id (`dates/event/<id>`) is matched in `resolveSettingsPage`, and that "the page above" is the nearest ancestor path with a page.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/Settings/stack/SettingsStack.tsx` -- nearest-ancestor parent for `goBack` and reload-to-parent -- so an id path goes up to `dates`.
- [ ] `src/components/Settings/stack/SettingsRows.tsx` -- opt-in truncating value on `SettingsRow` -- the Note row stays inside the card.
- [ ] `src/components/Settings/dateNavigation.ts` (new) + `DatePages.tsx` -- move `useFallBackToDates` there returning `leave()`; export `DatePage`; DatePages behavior unchanged.
- [ ] `src/components/Settings/ConfirmDialog.tsx` (new) -- `ConfirmDialog({ question, confirmLabel, onCancel, onConfirm, testId })` per DESIGN.md (kit dialog, Cancel initial focus, Escape/scrim cancel, destructive button); file doc saying story 12 reuses it for anniversaries.
- [ ] `src/components/Settings/EventPages.tsx` (new) -- `EventPage({ eventId })` and `EventFieldPage({ eventId, field })` per the matrix; the page loads events on mount and on connectivity change and falls back only after its own `success` answer. Test ids: `settings-event-page`, rows `settings-event-name|date|note|icon` (read-only: `settings-event-<field>-readonly`), `settings-event-delete`, dialog `settings-event-delete-confirmation` / `-cancel` / `-confirm`, fields `settings-event-name-field|date-field|note-field`, icon options `settings-event-icon-<calendar|ring|plane>`. File doc.
- [ ] `src/components/Settings/Settings.tsx` -- resolve the event paths (title from the store's event, `Event` otherwise; field titles `Name`/`Date`/`Note`/`Icon`, `reloadsToParent`); doc update.
- [ ] `src/components/Settings/__tests__/Settings.eventPages.test.tsx` (new) -- every matrix row through the real store and stack (Capacitor on and off), field Save rules and errors, reload on the page stays and on a field page shows its parent, delete online/offline/failure/cancel and single go-back under `<StrictMode>`; `SettingsStack.test.tsx` -- a fresh-load id path's back arrow and a reload-to-parent land on the nearest ancestor page.
- [ ] `tests/e2e/settings/event-pages.spec.ts` (new) -- pool account, seeded own upcoming event and partner's event: Dates → own event → edit Name, Date, Note, Icon (each returns to the page showing the new value, server row checked), `Delete event` → Cancel keeps it → Delete removes it and lands on the Dates list; partner's event page shows read-only Date/Note/Icon and no Delete; a reload on the event page stays. Clean up only what it seeded.
- [ ] `AGENTS.md` -- the one sentence in the Code Map.

**Acceptance Criteria:**
- Given the Dates list, when an own event's row is tapped, then its page opens titled with the event's name showing Name, Date, Note, Icon and `Delete event`, and back returns to the Dates list.
- Given an own event's page, when a field row is tapped, edited and saved, then the page returns one level and the row, the title (for Name) and the Dates list show the new value without a reload.
- Given an own event's page, when `Delete event` is confirmed online, then the event is gone from the Dates list and the app is on the Dates list; Cancel leaves it untouched.
- Given a partner's event, when its page opens, then its rows are read-only with no chevrons and there is no `Delete event`.
- Given the shell with the local-notifications plugin, when an upcoming event's page opens, then Remind me is there (own or partner's), and a past event's page has none (unit check; simulator check in Verification).

## Implementation Notes

- Implemented by a Sonnet subagent from this plan. `SettingsRow`'s opt-in prop is `truncateValue`; it is set on the Name row as well as the Note row, since a 100-character name spills the same way.
- The E2E spec ran on the local stack through a scratch stand-in for `supabase` (the PATH CLI 3.0.0 rejects the committed `config.toml`'s `[inbucket]`), as stories 5.4 to 5.10 did; nothing in the repo changed for it.
- Review patch: the event page now loads events only while the store does not hold its event (see the triage log). The subagent first read the store with `useAppStore.getState()` behind an `eslint-disable`; the orchestrating session replaced that with a ref synced in an effect, since the project's lint rule bans `getState()` in React code and AGENTS.md says fix before suppressing.
- Not met against DESIGN.md, deferred as DW-430: the Icon row shows a text value and the Icon page uses check rows (both as this plan's matrix said); DESIGN.md asks for the glyph and the Form page's three-tile picker, which story 13 builds.
- Simulator check not run: no booted simulator was checked for in this run; Remind me on an event is covered by unit tests with Capacitor mocked.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` Opening an event reached through `Load more` (or one whose edited date left the first window) bounced to the Dates list, because the page's own `loadEvents()` replaces `events` with the server's first page (`eventsSlice.ts` `loadPage(false)`: `merged = append ? … : page.events`) and then answers `success` without it — fixed: the page loads only while the store does not hold its event (held read through a ref synced in an effect, so a delete triggers no load); unit test added that a held event sends no read, under StrictMode and a connectivity flip, and stays open.
  - `[low]` `[patch]` `event-pages.spec.ts` copied `part`/`listDate` from `dates-list.spec.ts` (and `date-pages.spec.ts` carried another `dayMonth`), against AGENTS.md's shared-test-helper rule — fixed: `dayMonth` and `listDate` moved to `tests/support/helpers/dates-list-format.ts` and imported by all three specs.

## Design Notes

- **Absent once loaded.** The store holds a paged window, so an older past event reached through `Load more` is absent after a reload and the page falls back to the Dates list, as the epic's reload decision allows; no single-event fetch is added. Only the page's own successful `loadEvents()` counts as the answer (offline with a saved copy resolves `success` too).
- **One go-back.** `removeEvent` drops the event from the store before it resolves, so the absence effect and the delete handler can both want to leave; both call the same once-only `leave()`.
- **Delete offline** refuses before the dialog, like Log out of all devices: the person is never asked to confirm what cannot go through.
- **Read-only Note with no note** shows the row with an empty value; no new string is invented.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline excepted if present at baseline).
- `npx vitest run src/components/Settings` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings --project=chromium` -- expected: pass on the local stack.

**Manual checks (if no CLI):**
- Simulator, when `scripts/sim-driver/README.md`'s prerequisites are met: open an upcoming event's page, tap Remind me, and `sim pending` lists its month and week reminders; a past event's page has no Remind me. Otherwise record it as not run.

## Auto Run Result

Status: built

**Summary.** The Dates list's event rows now open the event's own page, `/settings/dates/event/<id>`, titled with the event's name.
- **Own event:** Name, Date, Note and Icon rows, each opening a one-field page (`…/name`, `…/date`, `…/note`, `…/icon`) that saves through `editEvent` and returns one level. Then Remind me while the event is upcoming (shell only), then `Delete event` centered in its own card.
- **Delete:** asks in a Confirmation dialog (`Delete this event?`, Cancel focused, Escape and the scrim cancel). Offline it refuses before the dialog. On success it returns to the Dates list exactly once; a failure shows in the page's Error box.
- **Partner's event:** read-only Date, Note and Icon rows, Remind me while upcoming, no Delete. A past event has no Remind me.
- **Stack:** "the page above" a path is now its nearest ancestor that has a page, so a pasted event URL's back arrow and a reload on a field page land on `dates` and on the event page.
- The event page reloads to itself. It loads events only while the store does not hold its event, and falls back to the Dates list only after that load answers `success` without the event.

**Files changed**
- `src/components/Settings/EventPages.tsx` (new): `EventPage` and `EventFieldPage`.
- `src/components/Settings/ConfirmDialog.tsx` (new): the reusable Confirmation dialog (story 12 reuses it).
- `src/components/Settings/dateNavigation.ts` (new): `useFallBackToDates`, moved from `DatePages.tsx`, now returning a once-only `leave()`.
- `src/components/Settings/DatePages.tsx`: imports the moved hook and exports `DatePage`; behavior unchanged.
- `src/components/Settings/Settings.tsx`: matches the event paths in `resolveSettingsPage` and titles the page from the store.
- `src/components/Settings/stack/SettingsStack.tsx`: nearest-ancestor parent for the back arrow's fresh-load replace and for reload-to-parent.
- `src/components/Settings/stack/SettingsRows.tsx`: opt-in `truncateValue` on `SettingsRow`.
- `src/components/Settings/DatesPage.tsx`: doc line about row targets.
- `AGENTS.md`: one sentence on id paths and "the page above".
- Unit tests: `Settings.eventPages.test.tsx` (new, 40 cases); `SettingsStack.test.tsx` gets 3 cases.
- E2E: `tests/e2e/settings/event-pages.spec.ts` (new); `tests/support/helpers/dates-list-format.ts` (new), now shared by `dates-list.spec.ts`, `date-pages.spec.ts` and `event-pages.spec.ts`.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-430.

**Review findings.** One quick pass found 2 findings: 1 medium and 1 low, both patched. None was rejected. One item the review did not raise was deferred as DW-430 (the Icon row and Icon page against DESIGN.md).

**Follow-up review recommended: false.** Patched this pass: high 0, medium 1, low 1.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 231 files, 4176 tests, 0 failures.
- `npx vitest run src/components/Settings` with shuffle seed 511: 566 passed.
- `npx playwright test tests/e2e/settings --project=chromium`: 71 passed on the local stack, no leftover rows.
- Every I/O matrix row has a passing covering test in `Settings.eventPages.test.tsx` or `SettingsStack.test.tsx`.

**Residual risks**
- **DW-430:** the Icon row and the Icon page do not match DESIGN.md (glyph value, three-tile picker). Story 13 builds the picker.
- **Older past events after a reload:** an event outside the first page window, reloaded on its page, falls back to the Dates list. This is the epic's accepted reload rule; no single-event fetch was added.
- **Simulator check not run:** Remind me on an event page is covered only by unit tests with Capacitor mocked.
- **No visual review** of the pages in light and dark.
- **CLI version:** E2E ran through a stand-in for the CLI, against a local stack started outside the CI-pinned CLI.
