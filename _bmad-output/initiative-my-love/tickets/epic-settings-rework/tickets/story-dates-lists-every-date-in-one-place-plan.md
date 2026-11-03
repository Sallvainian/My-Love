---
title: 'Dates lists every date in one place'
type: 'feature'
ticket: '9'
created: '2026-11-03'
status: done
baseline_revision: '768153a2f115f2eacacca0fc65130ecca10392a6'
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

**Problem:** Settings has no Dates row or list, so a person cannot see every date (Together since, Wedding, both birthdays, events, anniversaries, past events) in one place (R6, R1).

**Approach:** Add a `Dates` row (CalendarHeart tile, no value) to the top page's Partner group after the Partner row, and a large-title `/settings/dates` page that reads the existing store slices and shows the groups Together, Birthdays, Events, Anniversaries, Past (with `Load more`), each row with its date on the right. Rows carry `target`s for the date pages stories 10–12 register; this story registers none of them.

## Boundaries & Constraints

**Always:** Strings verbatim from EXPERIENCE.md: `Dates`, `Together`, `Together since`, `Wedding`, `Birthdays`, `You`, `Events`, `Anniversaries`, `Past`, `Load more`, `Not set`. Rows are `SettingsRow`s with tiles (Together since `Heart`, Wedding `Gem`, birthdays `Cake`, an event its own icon — ring `Gem`, plane `Plane`, calendar `Calendar` as `EventCountdown.tsx:43` — anniversaries `Heart`). Row targets follow the epic's URL scheme: `dates/together-since`, `dates/wedding` (each `…/date` instead while its value is a loaded `Not set`), `dates/birthday`, `dates/partner-birthday`, `dates/event/<event.id>`, `dates/anniversary/<serverId ?? id>`. Parse `YYYY-MM-DD` with `parseEventDate` only. A value not known yet is left empty, never `Loading...`. Kit classes and tokens only, no `dark:`; every row ≥44pt (`ROW_BUTTON`). Register the page in `SUBPAGES` and open it with `SettingsRow target`. Match surrounding style by hand (no `prettier --write`).

**Never:** No `+` button, Kind chooser or forms (story 13); no date pages or one-field pages (stories 10–12); no removal of the old Together / Countdowns sections or `CountdownMarks` from the top page; no store, service, migration or local-copy change; no screen-reader or keyboard requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Linked, all set | `coupleSettings` linked with start + wedding, `ownProfile.birthday`, `partner.birthday`, upcoming + past events, anniversaries | Groups in order Together, Birthdays, Events, Anniversaries, Past; Birthdays rows `You` then the partner's display name | — |
| Unset couple dates | linked, `relationshipStart`/`weddingDate` null | Rows keep their place, value `Not set`, target `…/date` | — |
| Couple settings not loaded | `coupleSettings` null, `partner` set | Together shown, both values empty, targets the date pages | — |
| Unlinked (loaded) | `coupleSettings` unlinked or (null and no partner); `partnerKnown`, `partner` null, no `partnerLoadError` | No Together group, no partner birthday row; Events and Past keep only events whose `userId` is the account's | — |
| Birthday unknown / unset | `ownProfile` null / `birthday` null | `You` value empty / `Not set` (partner's likewise) | — |
| Empty groups | no upcoming / no anniversaries / no past and nothing more to load | That group and its label are absent | — |
| Upcoming vs past | event dated today | In Events (today counts as upcoming, `getCalendarDaysDiff >= 0` as Home) | — |
| More to load | `eventsPagination.upcoming.hasMore` or `.past.hasMore` | `Load more` row ends Past (Past shown even with no past rows); tap calls `loadMoreEvents`, rows append in place, page does not navigate | Row disabled while `eventsIsLoading` or `eventsIsLoadingMore` |
| Load more fails / offline | `loadMoreEvents` → `{status:'failure', error}` | Loaded rows stay; Error box under the bar shows `error` (offline: the service's `offlineMessage('Events','load')`) | Cleared on the next Load more and on leaving the page |
| Page opened or reloaded | `/settings/dates` | Rows render at once from the store; the page calls `loadEvents()` on mount and on each `syncStatus.isOnline` change | Initial-load failure not shown (not an action just tried) |

</intent-contract>

## Code Map

- `src/components/Settings/Settings.tsx` -- `SUBPAGES` (add `dates`, title `Dates`, `large`, no `reloadsToParent`, so a reload stays on it); top page Partner group: add `<DatesRow key="dates" />` after `<PartnerRow />`; update the file doc.
- `src/components/Settings/PartnerPage.tsx` -- template for a page module (row + page, file doc). `src/components/Settings/stack/SettingsRows.tsx` -- `SettingsGroup` (hides with its label when no truthy rows; `testId` goes on the card), `SettingsRow` (`icon`, `value`, `target`, `testId`; always renders a chevron).
- `src/components/Settings/stack/OneFieldPage.tsx:124-133` -- the Error box markup to copy (`FAILURE_BOX`, `CircleAlert`, `role="alert"`). `SwitchRow.tsx` exports `ROW_BUTTON` for the Load more button.
- `src/components/Settings/settingsFields.ts` -- add the list formatters (Design Notes). `formatDateOnly` / `formatInstantDate` stay as they are.
- Store reads (`useAppStore`): `events`, `eventsPagination`, `eventsIsLoading`, `eventsIsLoadingMore`, `loadEvents`, `loadMoreEvents` (`eventsSlice.ts`; events are soonest first, `date` a local-midnight `Date`); `coupleSettings` (`datesSlice.ts:129`, `relationshipStart` ISO instant, `weddingDate` `YYYY-MM-DD`); `settings?.relationship.anniversaries` (`Anniversary` in `src/types/index.ts:50`, `date` `YYYY-MM-DD`, store order kept); `ownProfile?.birthday` (`profileSlice`); `partner` (`PartnerInfo.displayName`, `.birthday`), `partnerKnown`, `partnerLoadError` (`partnerSlice`); `userId`; `syncStatus.isOnline`.
- `src/components/RelationshipTimers/eventCountdownHelpers.ts` -- `getCalendarDaysDiff(date, now)` for the upcoming/past split (sample `now` once per render).
- `src/components/Settings/EventsSettings.tsx:9-15,208-224` -- why the page loads its own events (the `events` refresher skips the Settings view); copy that effect shape, not its focus/retry machinery.
- Tests: `src/components/Settings/__tests__/Settings.partner.test.tsx` (real store + real stack pattern, mocks, `onPopState` from `settingsStackKit.ts`); `Settings.kit.test.tsx` (h2 order unchanged: the Dates row adds no h2). E2E: `tests/e2e/settings/partner-page.spec.ts` (pool account, `openSettingsFromHome`, faking unlinked by fulfilling `**/rest/v1/users?select=partner_id*`), `tests/e2e/settings/events-history-pagination.spec.ts` (how to force `hasMore`), `tests/support/helpers/events.ts` (`seedEvent`, `clockAnchor`, `isoDateDaysFromNow`, `resolveOwnPair`, cleanup helpers), `tests/support/helpers/reads.ts` (`PAST_EVENTS_READ`, `UPCOMING_EVENTS_READ`, `COUPLE_SETTINGS_READ`, `ANNIVERSARIES_READ`). Import `{ test, expect }` from `tests/support/merged-fixtures.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Settings/settingsFields.ts` -- add `formatListDate(date, now?)` and `formatDayMonth(date)` per Design Notes -- the spine's `Sat 14 Nov` / `3 Feb 2022` / `4 Apr` forms.
- [x] `src/components/Settings/DatesPage.tsx` (new) -- `DatesRow` (`CalendarHeart`, label `Dates`, no value, target `dates`, `settings-dates-row`) and `DatesPage` per the matrix: groups with test ids `settings-dates-together|birthdays|events|anniversaries|past`; rows `settings-dates-together-since`, `settings-dates-wedding`, `settings-dates-birthday-self`, `settings-dates-birthday-partner`, `settings-dates-event-<id>`, `settings-dates-anniversary-<key>`; Load more `settings-dates-load-more` (a `ROW_BUTTON` with label only: no tile, value or chevron); Error box `settings-dates-error` above the first group; the `loadEvents` effect. File doc.
- [x] `src/components/Settings/Settings.tsx` -- register `dates`; add `DatesRow`; doc.
- [x] `src/components/Settings/__tests__/Settings.dates.test.tsx` (new) -- every matrix row through the real store and stack (set state with `useAppStore.setState`; stub `loadEvents` / `loadMoreEvents` on the store): group order and labels, each row's label, value and `data-settings-target`, hidden groups, linked vs unlinked, Load more appends in place and stays on `/settings/dates`, failure and offline Error box and its clearing, the top page's Dates row opens the page, reload on `/settings/dates` stays.
- [x] `src/components/Settings/__tests__/settingsFields.test.ts` (new, or the existing formatter test if one exists) -- `formatListDate` same year / other year / September as `Sep`; `formatDayMonth`.
- [x] `tests/e2e/settings/dates-list.spec.ts` (new) -- linked pool account with a seeded upcoming and a seeded past event: the Dates row opens the list; Together, Birthdays (`You` + partner name), Events and Past show their rows with dates; with the partner read fulfilled as unlinked, no Together group and no partner birthday row; with a past read answering more rows than a page (or the pagination spec's technique), `Load more` appends an older past event without leaving `/settings/dates`; back returns to the top page. Clean up only the rows the spec seeded.

**Acceptance Criteria:**
- Given the top page, when it opens, then the Partner group holds Partner then `Dates` (label and chevron, no value), and tapping `Dates` opens the large-title Dates list; a reload there stays on it.
- Given a linked account, when the Dates list opens, then it shows Together, Birthdays, Events, Anniversaries and Past in that order (empty Events, Anniversaries and Past absent), each row with its date on the right and unset couple dates reading `Not set`.
- Given an unlinked account, when the Dates list opens, then there is no Together group and no partner birthday row, and only the account's own events appear.
- Given more past events than are loaded, when `Load more` is tapped, then older past events append to Past on the same page; a failed or offline attempt keeps the rows and shows the Error box.

## Implementation Notes

- Implemented by a Sonnet subagent from this plan; the orchestrating session rewrapped two lines of `Settings.tsx`'s file doc.
- `Settings.dates.test.tsx` stubs `loadEvents` / `loadMoreEvents` on the store and sets every slice the page reads with `useAppStore.setState` (37 cases).
- The E2E Load more case seeds 51 past events (one more than a page) and deletes only those rows by id afterwards.
- Review patches moved the events page size and the load-more read pattern into `tests/support` (`EVENTS_PAGE_SIZE` in `helpers/events.ts`, `HISTORY_PAGE_READ` in `helpers/reads.ts`); `events-history-pagination.spec.ts` imports them, renaming its `PAGE_SIZE` to `EVENTS_PAGE_SIZE`.
- E2E ran on the local stack through a scratch stand-in for `supabase status` (the PATH CLI 3.0.0 rejects the repo's `config.toml`), as stories 5.4 to 5.8 did; nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 5, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The `Load more` label was `text-accent`; DESIGN.md (Colors) keeps row labels ink and accent off them — fixed: `text-ink`.
  - `[low]` `[patch]` The offline unit case stubbed a hand-typed refusal the app never shows (the service throws `offlineMessage('Events','load')`) — fixed: stub and expectation built with `offlineMessage('Events', 'load')`.
  - `[low]` `[patch]` The top-page chevron check `querySelector('svg:last-child')` matched the tile's glyph, so it could not fail — fixed: asserts the row button's `lastElementChild` is the chevron svg.
  - `[low]` `[patch]` The linked E2E case barely checked the Together since value and not the Wedding or birthday values — fixed: all four asserted exactly (formatted date or `Not set`) from the intercepted own-profile, partner-record and couple-settings reads.
  - `[low]` `[patch]` `PAGE_SIZE` and `HISTORY_PAGE_READ` duplicated `events-history-pagination.spec.ts` (AGENTS.md shared-helpers rule) — fixed: moved to `tests/support/helpers/events.ts` and `reads.ts`, imported by both specs.

## Design Notes

- **Date forms.** No existing formatter yields the spine's examples, so `settingsFields.ts` gains two, composed from `en-US` `Intl` parts in day-first order (`en-GB` would print `Sept`): a one-time date (event, Together since, Wedding) reads `Sat 14 Nov` in the current calendar year and `3 Feb 2022` in any other, so a mistyped year shows; a yearly date (birthday, anniversary) reads `4 Apr`. Matches every value in EXPERIENCE.md Flows 1–2 and v1 frame 3. Together since converts its ISO instant with `new Date` (a full timestamp; an unparsable one shows no value).
- **Linked.** Together shows when `coupleSettings?.status === 'linked'`, or `coupleSettings` is null and `partner` is set; the partner birthday row when `partner` is set. Events are filtered to own only on a confirmed unlinked answer (`partnerKnown && !partner && !partnerLoadError`), since RLS already hides a former partner's rows from the server but the saved copy could still hold them.
- **Load more** loads both windows (`loadMoreEvents`), so the row shows while either has more, at the end of Past as today's bounded paging does. Its error is component state from the action's own result, so it clears on leaving.
- **Interim targets.** Until stories 10–12 register the date pages, a tapped date row lands on the top page (the stack's unknown-path fallback). Never shipped: the epic merges whole.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0, no warnings.
- `npm run typecheck` -- expected: exit 0 (the worktree TS2883 baseline excepted if present at the baseline).
- `npx vitest run src/components/Settings` -- expected: all pass.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/settings` -- expected: pass on the local stack.

## Auto Run Result

Status: built

**Summary.** The top Settings page's Partner group now holds `Dates` after `Partner` (CalendarHeart tile, label and chevron, no value). It opens `/settings/dates`, a large-title list that reloads to itself. The list reads the existing slices and writes nothing. Its groups, in order:
- **Together**: Together since and Wedding. Shown for a linked couple, or while couple settings have not loaded and a partner is known. An unset value reads `Not set` and targets the date's one-field page (`…/date`); a value not known yet is empty.
- **Birthdays**: `You`, then the partner by name when a partner is known.
- **Events**: both partners' upcoming events, soonest first, with today counted as upcoming.
- **Anniversaries**: the account's own, in store order.
- **Past**: past events, newest first, ending in a `Load more` row while either events window has more. Load more appends in place; a failure, offline included, keeps the rows and shows the action's message in the Error box, which clears on the next attempt or on leaving.

Empty Events, Anniversaries and Past groups are hidden with their labels. On a confirmed unlinked answer only the account's own events show. Dates read `Sat 14 Nov` in the current year and `3 Feb 2022` in any other; birthdays and anniversaries read `4 Apr`. The page loads events itself on open and on each connectivity change. Rows target the date pages stories 10–12 register (`dates/together-since`, `dates/wedding`, `dates/birthday`, `dates/partner-birthday`, `dates/event/<id>`, `dates/anniversary/<serverId>`); until then a tap lands on the top page.

**Files changed**
- `src/components/Settings/DatesPage.tsx` (new): `DatesRow` and `DatesPage`.
- `src/components/Settings/Settings.tsx`: registers the `dates` subpage, adds the Dates row and updates the file doc.
- `src/components/Settings/settingsFields.ts`: adds `formatListDate` and `formatDayMonth`.
- Unit tests:
  - `src/components/Settings/__tests__/Settings.dates.test.tsx` (new, 37 cases).
  - `src/components/Settings/__tests__/settingsFields.test.ts` (new, 5 cases).
- E2E: `tests/e2e/settings/dates-list.spec.ts` (new, 3 tests).
- Test support:
  - `tests/support/helpers/events.ts` and `reads.ts`: shared `EVENTS_PAGE_SIZE` and `HISTORY_PAGE_READ`.
  - `tests/e2e/settings/events-history-pagination.spec.ts`: imports both.

**Review findings.** One quick pass found 5 findings, all low. All 5 were patched as logged above; nothing was deferred or rejected.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 5.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 4079 tests, 0 failures.
- `npx vitest run src/components/Settings --sequence.shuffle --sequence.seed=59`: 27 files and 469 tests passed (before the patches).
- `npx playwright test tests/e2e/settings --project=chromium`: 65 passed on the local stack, with no leftover rows in the row audit.
- Every I/O matrix row has a passing covering test in `Settings.dates.test.tsx`.

**Residual risks**
- **No device or simulator check, and no visual review.** Long event names truncating against the date, and light and dark mode, were not looked at.
- **Set values in E2E.** The pool couple most likely has no couple-settings row and no birthdays, so E2E mostly proved `Not set`. Formatted set values are covered by the unit tests.
- **Interim targets.** Tapping a date row lands on the top page until stories 10–12 register the date pages.
- **Failed initial load is silent.** An initial events load that fails with nothing saved shows no Events group and no error. The spine names no state for this.
- **CLI version.** E2E ran against a local stack started outside the CI-pinned CLI, through a stand-in for `supabase status`.
