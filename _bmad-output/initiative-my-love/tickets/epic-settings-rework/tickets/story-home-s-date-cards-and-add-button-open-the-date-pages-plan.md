---
title: "Home's date cards and Add button open the date pages"
type: 'feature'
ticket: '14'
created: '2026-11-03'
status: done
baseline_revision: '14bffd7c6134b9fcf8156904d8f47f8a577684a8'
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
warnings: ['oversized']
deferred:
  - summary: >-
      A date page or New event opened from Home neither slides in nor starts at the top, because the tap mounts the Settings stack fresh (DW-435).
    evidence: |-
      SettingsStack's trail starts with direction null and its commit effect returns early while shownPath is null, so a first mount gets no slide class, scroll reset or title focus; EXPERIENCE.md Flow 1 step 2 says the event page slides in.
    location: >-
      src/components/Settings/stack/SettingsStack.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Home's date cards are not tappable, and Home's Add button opens the Settings top page. The epic (R10, EXPERIENCE.md "Entry points beyond Settings") wants each card to open its date's page with Home still highlighted in the dock and back returning to Home, and Add to open New event directly.

**Approach:**
- A from-Home marker: a Settings history entry pushed from Home carries `from: 'home'` in `history.state`, and `navigationSlice` mirrors it in a new `settingsFromHome` flag. The dock highlights Home while that flag is set.
- Each Home card gets a whole-card tap target that calls `openSettingsPage(<date path>, { fromHome: true })`. Home's Add event does the same with `dates/new-event`.
- Back needs nothing new: the stack's `goBack` already calls `history.back()` on an app-created entry, which lands on Home's entry.

## Boundaries & Constraints

**Always:**
- Card → path:
  - `TimeTogether` (both the counter and the "Not set yet" card) → `dates/together-since`;
  - your birthday card → `dates/birthday`; the partner's → `dates/partner-birthday`;
  - the wedding card → `dates/wedding`;
  - an event card → `dates/event/<event.id>`;
  - an anniversary card in `CountdownTimer` → `dates/anniversary/<serverId ?? String(id)>`, the key `DatesPage.tsx:226` uses.
- The marker is inherited: a push from a page whose entry is from Home (a field page, say) is from Home too, so Home stays highlighted through Flow 1 (card → event page → Date page → Save → back → Home).
- The marker survives a reload, because `history.state` does. App's initial route detection and its `popstate` handler set the flag from `history.state.from` (through `showSettingsPage`).
- `SettingsStack`'s `replaceSettingsRoute` keeps `from` on every replace except to the top page (`''`). A redirect to the top page is no longer a date flow.
- A view picked by the person (`setView` without `skipHistory`) clears the flag. A non-Settings view is never highlighted as Home through it.
- The dock's active destination is `home` when `currentView === 'settings' && settingsFromHome`, in both forms. In the column form the capsule's Settings button is then not active.
- The tap target covers the whole card. It is a `<button type="button">` laid over the card (`absolute inset-0`, card's `rounded-[20px]`), with the content kept as a sibling. A button's children are presentational, so wrapping the card's h3 would remove the level-3 heading that unit and E2E tests query.
  - Accessible name: the card's label (birthday: the name shown).
  - Kit focus ring: `focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent`.
  - Pressed state: the kit's `transition-opacity hover:opacity-90`.
  - Test id: `<card testId>-open`.
  - The celebration overlay (`pointer-events-none`, z-10) stays above it.
- A card without `onOpen` renders exactly as today (no button).
- Use kit tokens only, with no `dark:`. Match the surrounding style by hand.

**Never:**
- No new view, no router, no change to the five view-registration places.
- No change to the date pages themselves, their fallback-to-Dates or delete behaviour. From Home, their `goBack` lands on Home, and that is intended.
- No change to the Settings top page's back-arrow rule, or to `inApp` semantics.
- No store data, service or migration change.
- No screen-reader, keyboard or axe requirement.
- No specs in `tests/e2e-archive/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tap event card | Home, an upcoming event | URL `/settings/dates/event/<id>`, the event page, one new history entry with `from: 'home'`, `inApp: true`. Dock: Home active | — |
| Back from it | back arrow, or browser back | Home, at `/`, Home active | — |
| Reload on it, then back | reload at the date page | Same page, Home still active. Back → Home | — |
| Field page from it | tap Date row, then Save or back | The field page has Home active. Save or back → event page (Home active). Back → Home | — |
| Each other card | Together, both birthdays, wedding, anniversary | Its page, as in Always. Home active. Back → Home | — |
| Add event | tap `home-add-event` | URL `/settings/dates/new-event`, the New event form, with no Kind chooser. Home active. Cancel → Home. Add → Home with the new card | — |
| Reload on New event from Home | reload | `reloadsToParent`, then `history.back()` → Home | — |
| Delete from a Home-opened page | Delete event, confirmed | Back to Home, card gone | — |
| Opened from the Dates list | row tap inside Settings | No `from`, flag false. Dock: no Home highlight (bottom), Settings (column) | — |
| Dock tap while flagged | tap Mood on a Home-opened page | Mood, flag false | — |
| Pasted `/settings/dates/wedding` | fresh load, no state | Flag false. Back arrow replaces with `/settings/dates` (unchanged) | — |
| Card with no `onOpen` | other `CountdownCard` users | No button, DOM unchanged | — |

</intent-contract>

## Code Map

- `src/stores/slices/navigationSlice.ts`
  - Add `settingsFromHome: boolean` (initial `false`) with a doc comment.
  - `openSettingsPage(path, options?: { fromHome?: boolean })`: compute `fromHome = options?.fromHome ?? (currentView === 'settings' && settingsFromHome)`; push `{ view, settingsPath, inApp: true, ...(fromHome ? { from: 'home' } : {}) }` and set the flag.
  - `showSettingsPage(path)` also sets `settingsFromHome: window.history.state?.from === 'home'`.
  - `setView` clears the flag when not `skipHistory`.
  - Update the file doc.
- `src/App.tsx`
  - Lines 199-244: no change needed if `showSettingsPage` reads the flag, since both handlers already call it after `setView(view, true)`. Verify, don't duplicate.
  - Line 875-879 (Home's Add): call `openSettingsPage('dates/new-event', { fromHome: true })` and fix the stale comment above it.
  - Line 922 (events grid): pass `onOpen` to `EventCountdown`.
  - Line 856: pass the dock `activeView` (or `settingsFromHome`) to `AppNavigation`.
- `src/components/Navigation/AppNavigation.tsx`
  - Add an optional `homeActive`/`fromHome` prop. `isActive` uses `home` when Settings is open from Home.
  - Keep the header hidden on Settings (`isSettings` stays on `currentView`). Update the doc.
- `src/components/RelationshipTimers/CountdownCard.tsx` -- `onOpen?: () => void`. When it is set, add `relative` to the card and render the overlay button (see Always). Update the doc.
- `EventCountdown.tsx` -- pass `onOpen` through.
- `BirthdayCountdown.tsx` -- pass `onOpen` through (both of its `CountdownCard` renders, lines 85 and 130).
- `TimeTogether.tsx` and `BirthdayWeddingCards.tsx` -- read `openSettingsPage` from the store and pass `onOpen`. Update the docs; the "Set it in Settings" strings stay.
- `src/components/CountdownTimer/CountdownTimer.tsx` -- `AnniversaryCard` passes `onOpen`, opening `dates/anniversary/<key>` from Home (store call or a prop from `DailyMessage`, the implementer's choice). Its `relative` wrapper already exists.
- `src/components/Settings/stack/SettingsStack.tsx:93-100` -- `replaceSettingsRoute` keeps `from` unless the path is `''`. Update the `inApp` paragraph of the file doc to mention `from`.
- Read only:
  - `src/components/Settings/Settings.tsx` (SUBPAGES and the `EVENT_PATH`/`ANNIVERSARY_PATH` matchers);
  - `DatesPage.tsx:170-235` (the same targets);
  - `dateNavigation.ts` (`useFallBackToDates` → `goBack`).
- Tests to extend:
  - `tests/unit/stores/navigationSlice.settingsStack.test.ts`;
  - `src/components/Navigation/__tests__/AppNavigation.test.tsx` (mocks `useSideColumn` for the column form);
  - `src/components/Settings/__tests__/SettingsStack.test.tsx`;
  - `src/components/RelationshipTimers/__tests__/CountdownCards.test.tsx`;
  - `tests/unit/App.eventsSession.test.tsx:213`.
- E2E references:
  - `tests/e2e/home/home-kit.spec.ts:250-265` expects Add → `/settings`, and must change to `/settings/dates/new-event`;
  - `tests/e2e/settings/event-pages.spec.ts`, `anniversary-pages.spec.ts`, `date-pages.spec.ts` (pool accounts, `resolveOwnPair`, seeding and cleanup of own rows);
  - `tests/support/helpers/settings-screen.ts`, `events.ts` and `new-date-forms.ts`;
  - `tests/e2e/settings/settings-stack.spec.ts` (history-length checks). The column form cannot be emulated in a desktop browser: unit tests prove it.

## Tasks & Acceptance

**Execution:**
- [ ] `navigationSlice.ts`, `SettingsStack.tsx` -- the marker and the flag, per the Code Map.
- [ ] `AppNavigation.tsx`, `App.tsx` -- Home active while Settings is open from Home; Add opens New event from Home; event cards get `onOpen`.
- [ ] `CountdownCard.tsx`, `EventCountdown.tsx`, `BirthdayCountdown.tsx`, `TimeTogether.tsx`, `BirthdayWeddingCards.tsx`, `CountdownTimer.tsx` -- the tap target and each card's path.
- [ ] Unit tests:
  - Slice: `fromHome` push state, inheritance, `showSettingsPage` reading `from`, `setView` clearing.
  - Stack: `replaceSettingsRoute` keeps `from`, and drops it on a redirect to the top page.
  - `AppNavigation`: Home active in the bottom and column forms (Settings not active in the column).
  - `CountdownCards`: the button only with `onOpen`, the heading still level 3, a click calls `onOpen`.
  - Each Home card opens its exact path with `from: 'home'`, through the real store. A new `src/components/RelationshipTimers/__tests__/homeDateEntryPoints.test.tsx` or an App-level test is fine.
  - The matrix rows not covered by E2E.
- [ ] `tests/e2e/home/home-kit.spec.ts` -- Add → `/settings/dates/new-event` and the New event form (`settings-new-event-page`), with no Kind chooser (`settings-kind-chooser` count 0). Rename the test.
- [ ] `tests/e2e/home/home-date-entry-points.spec.ts` (new), pool account, bottom dock at 390×844, seeding only its own rows and cleaning only them:
  - an event card → its page with `nav-home` `aria-current="page"` → back arrow → `/` and Home active;
  - the same after a reload on the date page;
  - Flow 1: card → Date → change → Save → event page → back → Home shows the new date;
  - the wedding or Together card → its page → browser back → Home;
  - an anniversary card → its page;
  - Add → New event → Add a dated event → Home shows its card;
  - a date page opened from the Dates list does not mark Home active.
  - Arm request listeners before sign-in (AGENTS.md).

**Acceptance Criteria:**
- Given Home with an event, the wedding, Together since, both birthdays and an anniversary, when each card is tapped, then that date's page opens with Home highlighted in the dock, and back (arrow or browser) returns to Home with Home highlighted.
- Given a date page opened from Home, when the page is reloaded and back is taken, then the page reappears with Home highlighted and back still returns to Home.
- Given Home, when Add event is tapped, then the New event form opens with no Kind chooser, and Cancel or a successful Add returns to Home.
- Given the column dock form, when a date page is opened from Home, then the capsule highlights Home, not Settings.

## Implementation Notes

- A Sonnet subagent implemented the plan.
- **Addition beyond the plan: `settingsPushedPath`.**
  - Home's Add mounts the stack straight onto `dates/new-event`, a `reloadsToParent` page, so the stack read its first mount as a reload and went back to Home at once. The first E2E run showed this.
  - `navigationSlice` now records the path `openSettingsPage` pushed, and `showSettingsPage` clears it. `SettingsStack` treats a mount as a reload only when they differ.
  - A real reload starts a fresh store (null), so the matrix's reload row still goes back to Home.
  - Five Settings unit suites' fresh-load helpers now also reset the field.
- `CountdownCard`'s overlay button is a sibling of the content, named by the label, with test id `<testId>-open`. The cards pass their paths as planned; `CountdownTimer`'s `AnniversaryCard` calls the store directly.
- **Parent session, during verify:**
  - Added the missing matrix row's test: delete an event opened from Home lands on Home, with the card gone.
  - The Cancel step now also checks that Home is lit.
- **E2E setup:** E2E ran through the scratchpad `supabase` status shim, as in stories 5.4–5.13. Nothing in the repo changed for it.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` `CountdownCard`'s pressed state never shows.
    - `hover:opacity-90` sat on a transparent, childless overlay button, so nothing on screen changed. Tailwind v4 also gates `hover:` behind `@media (hover: hover)`, so a tap on iPhone never applied it.
    - Fixed: `transition-opacity hover:opacity-90 active:opacity-90` moved to the card container when `onOpen` is set, and the button keeps only its focus ring. The doc and `CountdownCardOpen.test.tsx` are updated.
  - `[low]` `[patch]` `TimeTogether.tsx`'s new doc sentence sat between two bullets and split the list. Fixed: it is now its own paragraph after the list.
  - `[false]` `[reject]` The `onOpen` unit cases went into a new `CountdownCardOpen.test.tsx`, not the existing `CountdownCards.test.tsx` the plan names.
    - The reviewer confirms the coverage exists. It sits beside the old file in the same `__tests__` folder, and no caller or rule diverges because of the split.
    - The only fix would be moving tests to match the plan's wording. That causes no harm either way.

## Design Notes

- **Overlay button, not a wrapping one.** The ARIA button role makes its children presentational, so a wrapped `<h3>` stops being a heading, and `events.spec.ts:166,430`, `events-read-window.spec.ts:230` and `CountdownCards.test.tsx:41` query it. A sibling `absolute inset-0` button keeps the heading and makes the whole card the target. A Playwright click on the card's test id lands on the button.
- **The flag lives in the store, the truth in `history.state`.** `showSettingsPage` is already what every history restore calls (initial load, `popstate`, the stack's redirects and reload-to-parent), so making it read `from` covers every path without a new call site.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0. The worktree TS2883 baseline is excepted only if it is present at baseline.
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/home tests/e2e/settings tests/e2e/navigation --project=chromium` -- expected: pass on the local stack, with no leftover rows.

**Manual checks (if no CLI):**
- In the browser at 390px, light and dark: tapping each Home card shows a pressed state, and no card's layout shifts.

## Auto Run Result

Status: built

**Summary**
- Every Home card that shows a date opens that date's page:
  - Together for (set or not) opens Together since;
  - your birthday and the partner's open their birthday pages;
  - the wedding card opens Wedding;
  - an event card opens its event;
  - an anniversary countdown opens its anniversary.
- Home's Add event opens the New event form directly, with no Kind chooser.
- **Keeping Home highlighted:**
  - The entry these taps push carries `from: 'home'` in `history.state`. `navigationSlice.settingsFromHome` mirrors it, and the dock highlights Home in both forms while it is set; in the column form the Settings button is then not active.
  - Pages pushed from such a page inherit the mark, so Home stays highlighted through Flow 1.
  - The mark survives a reload, because `showSettingsPage` reads it from the entry.
- **Going back:** back, by the arrow, the browser or after a reload, returns to Home, since the stack's `history.back()` lands on Home's entry.
- **Add from Home:** `settingsPushedPath` keeps the stack from reading a mount on `dates/new-event` as a reload (see Implementation Notes).

**Files changed**
- `src/stores/slices/navigationSlice.ts`: `settingsFromHome`, `settingsPushedPath`, and `openSettingsPage(path, { fromHome })`.
- `src/components/Settings/stack/SettingsStack.tsx`: replaces keep `from` except to the top page; a pushed page is not read as a reload.
- `src/components/Navigation/AppNavigation.tsx`: Home is active while Settings is open from Home.
- `src/App.tsx`: Add opens New event from Home; event cards open their pages; the flag is passed to the dock.
- `src/components/RelationshipTimers/CountdownCard.tsx`: an `onOpen` overlay button with the pressed state on the card.
- `EventCountdown.tsx`, `BirthdayCountdown.tsx`, `BirthdayWeddingCards.tsx`, `TimeTogether.tsx` and `src/components/CountdownTimer/CountdownTimer.tsx`: each card's path.
- Unit tests:
  - new: `CountdownCardOpen.test.tsx` and `homeDateEntryPoints.test.tsx`;
  - extended: `navigationSlice.settingsStack`, `AppNavigation`, `SettingsStack` and `App.eventsSession`;
  - five Settings suites' fresh-load helpers now also reset `settingsPushedPath`.
- E2E: new `tests/e2e/home/home-date-entry-points.spec.ts` (8 cases); `home-kit.spec.ts` expects Add to open New event.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-435.

**Review findings.** One quick pass found 3 findings:
- 2 low findings patched: the invisible pressed state, and the doc comment.
- 1 rejected as false: the test-file split, which harms nothing.
- No lens finding was deferred. DW-435 is the parent session's own observation, recorded in the ledger and in `deferred`.

**Follow-up review recommended: false.** Patched this pass: high 0, medium 0, low 2.

**Verification** (after the patches)
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 221 files, 4065 tests passed.
- `npx playwright test tests/e2e/home tests/e2e/settings tests/e2e/navigation --project=chromium`: 140 passed, with no leftover rows.
- `home-date-entry-points.spec.ts` with `--repeat-each=3`: 24 passed.
- Every matrix row has a covering unit or E2E test that ran and passed.

**Residual risks**
- **Column form untested in a browser:** it is proven by unit tests only. A desktop browser cannot emulate the `env()` insets, and no simulator or device check was run.
- **No slide or scroll reset from Home (DW-435):** a page opened from Home neither slides in nor resets to the top, because the stack mounts fresh.
- **Back crosses documents after a reload:** a back after a reload on a Home-opened page relies on the browser's traversal to the pre-reload Home entry. The E2E covers it in Chromium only.
- **Pressed state unchecked by eye:** the 390px light and dark pressed-state check was not done by eye.
- **CLI shim:** E2E ran through the scratchpad Supabase CLI status shim.
