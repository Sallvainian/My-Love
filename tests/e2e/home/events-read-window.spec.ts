/**
 * P0/P1 E2E: what the read cap and the render cap look like to the user
 *
 * Two claims the story makes that nothing else reaches:
 *
 * 1. **The shipped default protects Home.** `getEvents` defaults to
 *    `limit = 50` and `eventsSlice.loadEvents` calls it bare
 *    (`src/stores/slices/eventsSlice.ts:116`), so 50 is the only limit a user
 *    ever runs. Other tests do READ at 50 — the unit file's default-limit
 *    cases assert `range: { from: 0, to: 49 }`, and three of the seven cases
 *    in `tests/api/events-read-window.spec.ts` pass 50 explicitly — but every
 *    one of those seeds fewer than 50 rows on a side, so the cap never
 *    actually truncates there. The cases that do truncate use a limit of 2,
 *    because a small number is cheap to seed. The first test here is the only
 *    one that seeds past history BEYOND 50, which is what makes the shipped
 *    default do its job, and then asserts the next event is still on Home.
 *
 * 2. **The capped tail refills at local midnight, in the running app.**
 *    `getUpcomingEventCards` is unit-tested
 *    (`src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx`)
 *    and `EventCountdown`'s self-retirement is unit-tested beside it, but no
 *    test renders `App`, where the two meet. The story's own review recorded
 *    this as "untested and untestable"; extracting the helper made the filter
 *    testable and left the composition uncovered. A controlled clock is the
 *    only level that can reach it.
 *
 * ## Why the second test crosses midnight from BEHIND real time
 *
 * The refill has more than one possible cause, and only one of them is the
 * behaviour under test. `now` is sampled in App's render body, so ANY re-render
 * after the day rolls refills the slot. The re-render this test must isolate is
 * the retire tick: `onRetire` → `handleEventRetired` → `setRetiredEventTick`
 * (`src/App.tsx:470-471`, `:711`).
 *
 * An earlier version installed the clock at the anchor and fast-forwarded a
 * whole day to reach midnight. That jump pushed the page clock ~24h AHEAD of
 * when the stored session was minted, so supabase-js saw an expired token and
 * refreshed it — and `TOKEN_REFRESHED` sets a new `session`, which re-renders
 * App on its own (`src/App.tsx:417` depends on it). Measured: with that
 * arrangement, deleting `onRetire={handleEventRetired}` left the test GREEN.
 * The token refresh, not the retire tick, was doing the work.
 *
 * So the clock is installed five minutes before the anchor day's local
 * midnight — i.e. inside the PREVIOUS calendar day, which puts the page clock
 * at most a day BEHIND real time and never ahead of it. A clock that runs
 * behind makes the stored session look further from expiry, not closer, so no
 * refresh is due; and the crossing itself is a five-minute jump, far too small
 * to expire anything. Seed offsets are shifted one day back to match: the
 * retiring event is `dayOffset: -1`, which is "today" to the installed clock.
 *
 * Measured after the change, each mutant reverted afterwards:
 * - deleting `onRetire={handleEventRetired}` (`src/App.tsx:711`) — now FAILS
 *   here, which is the wiring the acceptance criterion names.
 * - freezing App's clock reading (`const now = <module-level Date>`, the shape
 *   a "stop re-deriving this every render" optimisation takes) — FAILS here.
 *
 * That is the acceptance criterion in the story's own words: "Given a card
 * retires itself at local midnight, when the filter re-runs, then the
 * next-soonest event takes the freed slot."
 *
 * Installing before midnight also removes a flake the anchor version carried:
 * a run starting seconds before real local midnight installed a clock that
 * crossed the day during page load, retiring the card before the first
 * assertion could see it.
 *
 * Cleanup is the `coupleEvents` fixture's: it clears this worker pair's events
 * before and after every test, so nothing seeded here outlives its test.
 */
import { test, expect } from '../../support/merged-fixtures';

/** Home renders at most this many event cards (`HOME_MAX_EVENT_CARDS`, `src/App.tsx`). */
const HOME_MAX_EVENT_CARDS = 3;

/**
 * More past events than `getEvents`' default `limit` of 50.
 *
 * 51 rather than exactly 50 so the past window is genuinely truncated: at 50
 * the page holds the couple's whole past history and the cap drops nothing,
 * which leaves the assertion resting on a bound that never bound anything.
 *
 * Note the mutant is caught either way, so this is about what the test MEANS
 * rather than about reaching it: a single ascending `.range(0, 49)` over 50
 * past rows plus one upcoming row returns the 50 past rows and excludes the
 * upcoming one, so the survivor card is missing at 50 as well.
 */
const PAST_HISTORY_SIZE = 51;

/**
 * How far before local midnight the refill test installs its clock.
 *
 * Long enough that a slow page load cannot cross the day before the first
 * assertion runs, short enough that the jump over midnight stays far below any
 * access-token lifetime — which is what keeps the retire tick the only thing
 * that can re-render App at the crossing.
 */
const CROSSING_LEAD_MINUTES = 5;

test.describe('Home under the bounded events read', () => {
  test('[P0] still shows the next event when past history fills the read window', async ({
    page,
    coupleEvents,
  }) => {
    // The mutant this catches: replacing the two date-anchored windows with a
    // single ascending `.range(0, 49)`. That page would hold 50 of these past
    // rows and none of the upcoming one, and Home would show "No upcoming
    // events yet." while a real event is a week away — the DW-9 symptom, at
    // the only limit a user actually runs.
    //
    // Truncation itself is asserted over the wire in
    // `tests/api/events-read-window.spec.ts`; what is asserted here is the
    // user-visible consequence, which is the part the API level cannot see.
    const history = Array.from({ length: PAST_HISTORY_SIZE }, (_, index) => ({
      dayOffset: -(index + 1),
      label: `History ${String(index + 1).padStart(2, '0')} E2E`,
      description: null,
    }));

    await coupleEvents.seed([
      ...history,
      { dayOffset: 7, label: 'Window Survivor E2E', description: 'Still ahead' },
    ]);

    await page.addInitScript((stamp) => {
      localStorage.setItem('lastWelcomeView', String(stamp));
    }, coupleEvents.anchor.getTime());

    await page.goto('/');

    const survivor = page.getByTestId('event-countdown-window-survivor-e2e');
    await expect(survivor).toBeVisible();
    await expect(survivor.getByText('Window Survivor E2E')).toBeVisible();
    await expect(survivor.getByText('Still ahead')).toBeVisible();

    // Hiding the tail must never turn a real list into the empty state, and a
    // failed load must not be read as an empty one.
    await expect(page.getByTestId('events-empty-placeholder')).toHaveCount(0);
    await expect(page.getByTestId('events-load-error')).toHaveCount(0);

    // The history reached the store but not the column. Asserted over the whole
    // seeded set rather than two named ends: naming only the first and last row
    // leaves the 49 in between free to render, and whether a regression happens
    // to surface the named ends depends on which end of the window survived.
    await expect(page.getByTestId(/^event-countdown-history-\d+-e2e$/)).toHaveCount(0);

    // And exactly one event card, so a regression that rendered past rows
    // alongside the survivor fails on the count even if the labels still match.
    await expect(
      page.getByTestId(/^event-countdown-(?:history-\d+|window-survivor)-e2e$/)
    ).toHaveCount(1);
  });

  test('[P1] hands the freed slot to the next event when local midnight passes', async ({
    page,
    coupleEvents,
  }) => {
    // Five minutes before the anchor day's local midnight, so the installed
    // clock sits in the PREVIOUS calendar day — behind real time, never ahead
    // of it. See the header for why the direction is load-bearing.
    const anchor = coupleEvents.anchor;
    const beforeMidnight = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate(),
      0,
      0,
      0
    );
    beforeMidnight.setMinutes(beforeMidnight.getMinutes() - CROSSING_LEAD_MINUTES);

    // Four upcoming events against a cap of three, so exactly one is hidden and
    // the refill has somewhere to come from. Offsets are relative to the
    // anchor's day, and the installed clock is one day behind it, so
    // `dayOffset: -1` is what "today" means to the browser: that is the card
    // that retires when the jump below crosses midnight.
    await coupleEvents.seed([
      { dayOffset: -1, label: 'Refill Today E2E', description: 'Retires at midnight' },
      { dayOffset: 0, label: 'Refill Second E2E', description: 'Second up' },
      { dayOffset: 1, label: 'Refill Third E2E', description: 'Third up' },
      { dayOffset: 2, label: 'Refill Fourth E2E', description: 'Waiting for a slot' },
    ]);

    // Installed before navigating, which `page.clock` requires; the clock then
    // runs normally, so the page loads, authenticates and animates as it would
    // without it — the jump below is the only discontinuity.
    await page.clock.install({ time: beforeMidnight });
    await page.addInitScript((stamp) => {
      localStorage.setItem('lastWelcomeView', String(stamp));
    }, beforeMidnight.getTime());

    await page.goto('/');

    const eventCards = page.getByTestId(/^event-countdown-refill-\w+-e2e$/);

    await expect(page.getByTestId('event-countdown-refill-today-e2e')).toBeVisible();
    await expect(eventCards).toHaveCount(HOME_MAX_EVENT_CARDS);
    await expect(page.getByTestId('event-countdown-refill-fourth-e2e')).toHaveCount(0);

    // Cross the viewer's own local midnight, and only that. `fastForward` fires
    // each due timer at most once, so this costs one tick of EventCountdown's
    // one-second interval; five minutes is also far short of any token
    // lifetime, so no auth event is available to re-render App in its place.
    await page.clock.fastForward(CROSSING_LEAD_MINUTES * 60_000 + 5_000);

    // The retiring card leaves, and the fourth event moves into the slot it
    // freed — with no reload, which is the whole point: `events` in the store
    // is untouched, so only a re-run of the filter against a LATER clock
    // reading can produce this. Both the frozen-clock mutant and the deleted
    // `onRetire` wiring fail here (see the header).
    await expect(page.getByTestId('event-countdown-refill-today-e2e')).toHaveCount(0);
    await expect(page.getByTestId('event-countdown-refill-fourth-e2e')).toBeVisible();
    await expect(eventCards).toHaveCount(HOME_MAX_EVENT_CARDS);

    const cardLabels = await eventCards.locator('h3').allTextContents();
    expect(cardLabels).toEqual(['Refill Second E2E', 'Refill Third E2E', 'Refill Fourth E2E']);

    // The list is still a list: a slot decision reading the CAPPED count would
    // be indistinguishable here today, but the placeholder must never appear
    // while three cards are on screen.
    await expect(page.getByTestId('events-empty-placeholder')).toHaveCount(0);
  });
});
