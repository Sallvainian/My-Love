/**
 * P0/P1 E2E: a stale `events` key in the persisted blob reaches neither the
 * screen nor the render path (DW-14, DW-20)
 *
 * `partialize` in `src/stores/useAppStore.ts` keeps `events` out of new
 * localStorage writes, but it governs writes only. The read half is the
 * storage adapter's `getItem`, which deletes every key in
 * `STALE_PERSISTED_KEYS` (`useAppStore.ts:74`) out of the parsed blob before
 * Zustand merges it (`:136-144`).
 *
 * `tests/unit/stores/persistedEvents.test.ts` pins that store state comes back
 * clean. What it cannot reach is the level where the harm is actually visible,
 * because it never renders anything:
 *
 * 1. **Disclosure.** The leak is couple data on a shared device — one couple's
 *    countdown labels, dates and descriptions in front of the next account.
 *    That is a property of the DOM, not of `getState()`.
 * 2. **A `TypeError` in Home's render.** JSON has no `Date`, so a rehydrated
 *    event's `date` is a string. `src/App.tsx:625` passes the array to
 *    `getUpcomingEventCards`, whose filter calls `getCalendarDaysDiff`, whose
 *    first statement is `date.getFullYear()`
 *    (`src/components/RelationshipTimers/EventCountdown.tsx`). Under happy-dom
 *    nothing calls that function; in a browser it takes Home down into the
 *    ErrorBoundary.
 * 3. **Whether the blob is repaired on disk.** Zustand re-persists the
 *    `partialize` allowlist after hydration, so one load removes the stale key
 *    permanently. A `vi.resetModules()` unit test never triggers that write —
 *    no state change occurs — so this is only observable here.
 *
 * ## Seeding
 *
 * Every case seeds `my-love-storage` through `page.addInitScript`, via
 * `tests/support/helpers/persisted-blob.ts`. It has to be an init script: by
 * the time a `page.evaluate` lands, `useAppStore` has already imported and
 * hydrated. The auth fixture's storage state carries only the Supabase token
 * and `lastWelcomeView` (`tests/support/auth/supabase-auth-provider.ts:146-157`),
 * so the seeded blob is the only `my-love-storage` in play.
 *
 * Labels, descriptions and notes are unique per call. Every assertion about
 * them is an ABSENCE assertion, and an absence assertion against a string a
 * real row could also carry is one collision away from passing for the wrong
 * reason.
 *
 * ## Playwright Utils
 *
 * No deviation. `test` comes from the merged fixtures; the one eventually
 * consistent wait uses `recurse` rather than a bare `expect.poll` or a
 * `waitForTimeout`; nothing here observes or stubs an application endpoint, so
 * `interceptNetworkCall` has no call site to own.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import {
  PERSISTED_ALLOWLIST,
  SEEDED_THEME_PRIMARY,
  eventCardTestId,
  readStoredBlob,
  seedPersistedBlob,
  stalePersistedEvent,
  stalePersistedMood,
} from '../../support/helpers/persisted-blob';

test.describe('stale persisted events never rehydrate', () => {
  test('[P0] a device carrying a previous couple\'s events blob shows none of it, and Home still renders', async ({
    page,
    coupleEvents,
  }) => {
    // A real row for this worker's own couple, so "Home rendered" is proved by
    // a card that IS on screen rather than only by the absence of one that is
    // not. Without it, a Home that crashed and a Home that stripped correctly
    // would look identical to the negative assertions below.
    const [real] = await coupleEvents.seed([
      { dayOffset: 14, label: 'Real Anniversary Strip', description: 'Real event description' },
    ]);

    const stale = stalePersistedEvent();
    await seedPersistedBlob(page, { events: [stale] });

    await page.goto('/');

    // The real card renders — so the events render path ran to completion.
    const realCard = page.getByTestId(eventCardTestId(real.label));
    await expect(realCard).toBeVisible();
    await expect(realCard.getByText('Real event description')).toBeVisible();

    // The stale event reaches nothing: not a card, not its label, not its
    // description. This is the disclosure assertion.
    await expect(page.getByTestId(eventCardTestId(stale.label))).toHaveCount(0);
    await expect(page.getByText(stale.label)).toHaveCount(0);
    await expect(page.getByText(stale.description)).toHaveCount(0);

    // Home is Home, not the ErrorBoundary. `getCalendarDaysDiff` would have
    // thrown on the stale row's string `date`, and ErrorBoundary renders
    // 'Something went wrong' (`src/components/ErrorBoundary/ErrorBoundary.tsx:52`).
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(page.getByTestId('event-countdown-wedding')).toBeVisible();
  });

  test('[P1] stripping the stale key leaves the rest of the persisted blob working', async ({
    page,
    coupleEvents,
  }) => {
    // No real rows: this case is about the surrounding keys, and an empty
    // events column keeps the assertions below about nothing else.
    await coupleEvents.clear();
    await seedPersistedBlob(page, { events: [stalePersistedEvent()] });

    await page.goto('/');

    await expect(page.getByTestId('time-together')).toBeVisible();

    // `settings` survived AND was applied: `App.tsx:352` calls
    // `applyTheme(settings.themeName)`, which sets `--color-primary` on the
    // documentElement (`src/utils/themes.ts:70-80`). The seeded theme is
    // 'ocean', deliberately not the 'sunset' default, so this distinguishes
    // "the seeded settings were used" from "defaults were used after the blob
    // was thrown away".
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
    );
    expect(primary).toBe(SEEDED_THEME_PRIMARY);

    // `isOnboarded` survived: the sign-in screen is what an onboarding reset
    // would show, and the events column is what Home shows.
    await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();

    // And the blob was not cleared as corrupt. The adapter's failure path is
    // `localStorage.removeItem(name)` + `return null` (`useAppStore.ts:112-119`),
    // so a null read here would mean the strip took the corruption branch.
    //
    // `messageHistory.currentIndex` is deliberately NOT asserted: the daily
    // message logic resets it to 0 (today) after hydration, so the seeded 7 is
    // gone by the time this reads — measured, and correct app behaviour rather
    // than a strip failure. The seeded-blob-was-used claim is carried by the
    // theme assertion above, which the app does not overwrite.
    const stored = await readStoredBlob(page);
    expect(stored).not.toBeNull();
    expect(stored?.isOnboarded).toBe(true);
    expect(stored?.stateKeys).not.toContain('events');
  });

  test('[P1] a blob carrying both stale keys leaks neither the events nor the moods', async ({
    page,
    coupleEvents,
  }) => {
    await coupleEvents.clear();

    const staleEvent = stalePersistedEvent();
    // Dated today on purpose: `MoodTracker`'s seeding block only reads
    // `getMoodForDate(formatDateISO(new Date()))`
    // (`src/components/MoodTracker/MoodTracker.tsx:165-181`), so a mood dated
    // any other day never reaches the branch that would disclose it.
    const staleMood = stalePersistedMood();

    await seedPersistedBlob(page, { events: [staleEvent], moods: [staleMood] });

    await page.goto('/');

    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(page.getByText(staleEvent.label)).toHaveCount(0);

    await navigateTo(page, 'mood');
    await expect(page.getByTestId('mood-tracker')).toBeVisible();

    // The note never reaches the textarea — and the textarea is never even
    // expanded. `showNoteField` initializes `false` (`MoodTracker.tsx:100`)
    // and is raised only by the rehydrated-mood branch, so its absence is the
    // signal that the branch did not fire.
    await expect(page.getByText(staleMood.note)).toHaveCount(0);
    await expect(page.getByTestId('mood-note-input')).toHaveCount(0);

    // The mood SELECTION is the other half of the same leak: the branch calls
    // `setSelectedMoods(existingMood.moods)`, and a non-empty selection renders
    // "Selected: <label>" — 'Sad' for the seeded 'sad' (`MoodTracker.tsx:49`).
    await expect(page.getByText('Selected: Sad')).toHaveCount(0);
  });

  test('[P1] one load clears both stale keys from the stored blob, not just from state', async ({
    page,
    coupleEvents,
    recurse,
  }) => {
    await coupleEvents.clear();
    await seedPersistedBlob(page, {
      events: [stalePersistedEvent()],
      moods: [stalePersistedMood()],
    });

    // Exactly ONE navigation for the whole test. `seedPersistedBlob` uses
    // `addInitScript`, which re-runs on every navigation — a second `goto` or
    // a `reload` would put the stale keys straight back and this assertion
    // would be measuring the re-seed.
    await page.goto('/');
    await expect(page.getByTestId('time-together')).toBeVisible();

    // Zustand re-persists the `partialize` allowlist on the first state change
    // after hydration, which is what removes the stale keys from disk. That
    // write is eventually consistent with the render above, so it is polled
    // rather than read once.
    const stored = await recurse(
      () => readStoredBlob(page),
      (blob) =>
        blob !== null && !blob.stateKeys.includes('events') && !blob.stateKeys.includes('moods'),
      { timeout: 15_000, interval: 500 }
    );

    // Exhaustive, not just "the stale keys are gone": sorted equality also
    // fails if the rewrite started persisting something new.
    expect([...(stored?.stateKeys ?? [])].sort()).toEqual([...PERSISTED_ALLOWLIST].sort());

    // The repair is a normal persist write, not the corruption clear — the
    // allowlisted data is still there afterwards. (`currentIndex` is not
    // asserted here for the same reason as the case above: the app resets it
    // to today on load, so its value proves nothing about the strip.)
    expect(stored?.isOnboarded).toBe(true);
  });
});
