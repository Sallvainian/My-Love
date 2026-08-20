# Event History: The Countdowns That Already Happened

## Why

The app deletes the couple's past from view. A card leaves Home the moment its day is over, twice over: `src/App.tsx:609` filters it out of the render, and `src/components/RelationshipTimers/EventCountdown.tsx:169-176` retires the card from inside the component when the day rolls over while Home sits open. That is correct dashboard behaviour, specified deliberately as CAP-3 of `_bmad-output/specs/spec-dynamic-events/SPEC.md`. Nothing is deleted — the row stays in `public.events` — but nothing reads it either.

The one surface that renders a passed event is not a reading surface. `src/components/Settings/EventsSettings.tsx:16-19` states its own purpose: *"**The list is unfiltered.** Home hides events whose date has passed; this list must not, because Settings is the only place a mistyped year can be seen and corrected."* It is a repair bench with an edit and a delete button on every row.

Sallvain asked for the other thing: a place to look back at what the two of them counted down to, filtered by year, by month, and by type.

## Capabilities

### Categories

- **CAP-1**
  - **intent:** Every event carries a real category, not just a picture.
  - **success:** `public.events` gains a `category` column constrained to `anniversary | trip | birthday | milestone | holiday | other`. Existing rows are backfilled deterministically from `icon`: `ring → anniversary`, `plane → trip`, `calendar → milestone`. No row is left null and no value is guessed. `src/types/database.types.ts` is regenerated, and `supabase/tests/database/20_events.sql` asserts the new CHECK in the same change.

- **CAP-2**
  - **intent:** Either partner picks a category when creating or editing an event.
  - **success:** The Settings event form offers the six categories, defaulting to `other` for a new event. The icon picker is untouched and independent — a Trip may carry any icon.

### History view

- **CAP-3**
  - **intent:** Either partner can reach a screen listing events that have already passed, most recent first, and read them without being able to change them.
  - **success:** A signed-in user reaches history from inside the running app and it has its own URL. It lists every event whose date is strictly before today in that viewer's local time, newest first, each row showing label, full date, description when present, icon and category. Reloading the browser on that URL returns to history rather than resetting to Home. There is no edit, delete or add control anywhere on the screen — those stay in Settings.

- **CAP-4**
  - **intent:** The screen tells the truth about which state it is in, so a failed load never reads as "you have no history".
  - **success:** Four mutually exclusive states render with distinct testids — first load in flight, load failed with nothing on screen, settled with zero passed events, and the list — with a non-empty list outranking every other state and a warning banner above it when the most recent refresh failed.

- **CAP-5**
  - **intent:** The screen never presents a truncated list as the whole history.
  - **success:** History requests enough rows to cover the couple's entire past (see Constraints > Data) and asserts it did. If a read ever comes back at its ceiling, the screen says plainly that it is showing the most recent N rather than silently ending.

### Filtering

- **CAP-6**
  - **intent:** Narrow the history to one year.
  - **success:** A year control offers "All years" plus exactly the years present in the passed events on hand, newest first; selecting one leaves only that year's events.

- **CAP-7**
  - **intent:** Narrow the history to one month.
  - **success:** A month control offers "All months" plus the twelve calendar months. Year and month combine: December + 2025 shows December 2025; December alone shows every December.

- **CAP-8**
  - **intent:** Narrow the history to one category.
  - **success:** A category control offers "All types" plus the six categories from CAP-1; selecting one leaves only events of that category. All three filters combine, and a filtered-to-zero result says so distinctly from a true-empty history.

## Constraints

### Data

- **This feature needs a migration, because CAP-1 adds a column.** `public.events` today has exactly eight columns (`supabase/migrations/20260818000002_create_events_table.sql:16-24`) and its only categorical column is `icon text not null default 'calendar' check (icon in ('ring', 'plane', 'calendar'))` (:22), whose own comment says it exists to *"Mirror the IconType union in src/components/RelationshipTimers/EventCountdown.tsx"* (:37). Icon is a picture choice, not a meaning. The new `category` column is additive: a `not null default 'other'` with a CHECK, a single `update` backfilling from `icon`, then `supabase gen types typescript --local`. Adding a CHECK moves `supabase/tests/database/20_events.sql`'s `select plan(36);` (:20) — update the count in the same change or `supabase test db` fails.

- **No policy is added, renamed or dropped.** The existing `events_select` already scopes reads to the caller and their partner. `supabase/tests/database/02_rls_policies.sql` and its `policies_are` arrays are untouched. Do not add an index: at a couple's data volume the existing `idx_events_user_event_date` is sufficient, and year/month/category filtering happens client-side over rows already in memory.

- **Baseline is `7a81ed4`, not the current checkout — the read signature changes under this feature.** Commit `7a81ed4 refactor(events): bound the events read and the Home events render` replaces `getEvents()` with `getEvents(limit = 50, offset = 0)`: two parallel reads split at the viewer's own local today — upcoming `.gte('event_date', todayISO)` ascending, past `.lt('event_date', todayISO)` **descending**, each `.range(...)`. Implement against that signature. **The gift:** the past page already arrives most-recent-first, which is history's natural order, and `getUpcomingEventCards` lands beside it as Home's filter helper — history's inverse filter belongs next to it, not re-derived. **The cost:** the past side caps at 50 with no load-more control. Its author filed that as **DW-41, severity medium**, in the same commit.

- **CAP-5 resolves DW-41 by asking for enough rows, not by building paging.** History passes a limit large enough to cover a couple's entire history and asserts the returned page was not at its ceiling. `supabase/config.toml:16-18` sets `max_rows = 1000`, which is the hard ceiling and is roughly two decades of weekly events — far beyond this couple's data. Do not build a load-more control, and do not page.

- **History's membership test is `getCalendarDaysDiff(event.date, now) < 0`, the strict complement of Home's**, sampled from one clock reading. Home keeps `>= 0` (`src/App.tsx:609`) and the card retires on `!isEventToday && calendarDays < 0` (`EventCountdown.tsx:176`). Anything but the exact complement makes an event dated today appear on both screens or neither.

- **Year and month come off the local-midnight `Date`, never the raw column string and never through `toISOString()`.** `parseEventDate` is *"THE one conversion"* and builds from local components because *"`new Date(eventDate)` is UTC midnight and lands a day early west of UTC"* (`src/services/eventsService.ts:141-143`). Group and filter on `event.date.getFullYear()` / `.getMonth()`; display via `formatDateLong` as `EventsSettings.tsx:331` does. `src/utils/dateUtils.ts:126-128` records the mirror trap: `toISOString().split('T')[0]` *"is UTC-based — at 11 PM EST that returns tomorrow's date"*.

### State

- **Do not re-window, re-sort or repurpose `state.events`.** One array already serves two screens with two different windows: Home filters to upcoming, Settings renders unfiltered on purpose. Replacing `events` with a paged load changes both screens behind it; appending older rows makes `getEventsSlotView(events.length, ...)` at `App.tsx:610-615` count rows Home never intended to count. Read `state.events` and filter client-side.

- **Filter selections live in local component state, not the store.** `src/components/AdminPanel/MessageList.tsx:37-52` is the pattern: a `useState` per filter, one `useMemo` keyed on the source array plus every filter. Local state cannot outlive the view, so it cannot leak across an account switch.

- **If any history state does reach the store, it joins `signedOutState()` in the same commit.** `src/stores/slices/authSlice.ts:130-136` already resets `events`, `eventsIsLoading` and `eventsError`. A retained year selection is a fingerprint of the previous couple's data. Nothing typechecks this — give it a story-level acceptance criterion.

- **Nothing here is persisted.** `partialize` (`src/stores/useAppStore.ts:153-156`) is an allowlist returning only `settings`, `isOnboarded` and `messageHistory`. The requirement is that nobody adds a key.

- **The history view loads its own events**, for the reason `EventsSettings.tsx:8-14` records for the sibling screen: a deep link or reload on a non-Home view would otherwise render a permanently empty list. Overlapping with Home's effect is safe — `eventsSlice` carries a monotonic `latestLoadId`.

- **Any async action that `set()`s after an `await` re-checks the user first**, in the shape `eventsSlice.loadEvents` uses (`src/stores/slices/eventsSlice.ts:100-139`).

### Navigation

- **The view literal is `'events-history'` and its path is `/events-history`.** Fix both strings once: five of the six registration sites hardcode the literal as a plain string, so a typo in four of them still compiles.

- **Registration is six hand-maintained edits and the compiler catches exactly one.**
  1. the `ViewType` union — `src/stores/slices/navigationSlice.ts:18-25`
  2. `pathMap` — `:51-59`, declared `Record<ViewType, string>` and therefore total; **the only edit the compiler forces**
  3. the `lazy()` import at module scope — `src/App.tsx:53-55`
  4. the initial-route ternary — `src/App.tsx:173-186`, a new arm before the final `: 'home'`
  5. the popstate ternary — `src/App.tsx:192-205`, a byte-identical second copy
  6. the render chain — beside `src/App.tsx:717`

  Missing #4 or #5 is the "resets to Home on reload" failure. Missing #6 renders an empty `<main>` with no crash and no error.

- **Entry points are Home's events slot and the Settings events section — not the navigation tray.** `DESTINATIONS` (`src/components/Navigation/NavigationTray.tsx:48-56`) is a plain array not keyed on `ViewType`, so a view absent from it still routes and renders. Adding a row takes the tray to eight against a component whose header records the retired bottom bar *"had run out of room at six destinations"* (:5-7), and drags three hand-written destination lists into scope. History is a place you go deliberately from the events you were already looking at, not a top-level destination.

- **Do not add a `navigateEventsHistory` action** — `navigationSlice` has no `navigateSettings` either; call `setView('events-history')` directly. **Do not add a new error boundary or Suspense** — `src/App.tsx:700-701` already supplies both for every lazy view. **No react-router.**

- **The structural template is `EventsSettings.tsx`, not `MoodHistoryTimeline.tsx`.** EventsSettings is already a list of dated `CoupleEvent` rows over the same slice with the same date formatting, so its card markup, dark-mode classes, motion, focus handling and testid scheme lift over directly. Its four-state machine is the model — `type ListSlot = 'loading' | 'list' | 'empty' | 'error'` (:96-97), resolved at :200-207 with a non-empty list outranking everything, plus the stale-list banner at :211.

- **The filter controls have one precedent and it needs dark-mode classes added.** `MessageList.tsx:71-73` is a labelled `<select>`; :111 is the `Showing N of M` count; :122-123 is the filtered-empty copy kept distinct from true-empty. That file has zero `dark:` classes and lives in AdminPanel, reachable only by typing `/admin`. Copy the idiom, add the dark classes it lacks. Do not invent a chip bar or tab strip — neither has anything to copy.

- **New buttons must clear WCAG AA.** DW-28 records white-on-`bg-pink-500` measuring 3.58:1 against the 4.5:1 requirement across 17 sites. Do not add an eighteenth.

### Tests

- **New E2E goes in `tests/e2e/`**, importing `{ test, expect }` from `tests/support/merged-fixtures.ts`, never `@playwright/test`. Sit beside `tests/e2e/home/events.spec.ts` and `tests/e2e/settings/events-crud.spec.ts`.

- **A reload assertion on the history URL is mandatory.** The two route ternaries are untypechecked and nothing else catches a missed entry. Copy `tests/e2e/navigation/tray.spec.ts:87-105` verbatim — navigate, `waitForURL`, assert the view, `page.reload()`, assert again, `toHaveURL`. Add a back-button assertion for the popstate ternary.

- **E2E accounts come from the per-worker pool keyed on `TEST_WORKER_INDEX`.** A spec must not link or unlink partners, reset a password, or null a shared row at teardown. History specs seed and clean up only their own events.

- **The four-state machine and the filtered-to-zero state each need their own assertion**, keyed on distinct testids, because the precedence rule is the bug class `MoodHistoryTimeline.tsx:206-208` and `PhotoGallery.tsx:238-239` both guard against.

- **A backfill assertion is mandatory**: a pgTAP test proving every pre-existing row received a category matching its icon, and that a row with an out-of-set category is rejected.

## Non-goals

- **No pagination UI, no virtualization, no infinite scroll, no `react-window`.** Two people who hand-enter every event in Settings. `MoodHistoryTimeline.tsx:12-13` is the wrong precedent.
- **No search box.** Year, month and category cover how a couple looks back. A text search over a few dozen rows is a control nobody will use.
- **No editing from history.** Edit and delete stay in Settings, which exists to be the repair bench.
- **No new icons.** Category and icon stay independent; the three-value icon union is untouched.
- **No re-tagging UI.** The backfill assigns a category to every existing event; changing one is an ordinary edit in Settings.
- **No analytics, no "on this day", no anniversary reminders.** All plausible, none asked for.

## Success signal

Sallvain opens the app, taps through from the events he can already see on Home, and reads back the trips and anniversaries from a chosen year without touching Settings — and the two of them can find "that December" without scrolling past everything else.

## Assumptions

- The couple's entire event history fits comfortably under `max_rows = 1000`. If that is ever false, CAP-5's ceiling assertion fires and the assumption is revisited then.
- `7a81ed4` merges before this work starts. If it is reverted, the read signature reverts with it and CAP-5 becomes trivial.
- Six categories are enough. Adding a seventh later is a CHECK change plus a picker option — cheap, and not worth pre-building for.

## Open Questions

None. Category set, entry points and the DW-41 resolution were all decided before this spec was written.
