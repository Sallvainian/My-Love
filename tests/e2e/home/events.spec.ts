/**
 * P0 E2E: Home dashboard reads events from the store
 *
 * Story 3 (dynamic events). Seeds rows directly into `public.events` for the
 * worker's own account — the identity the `page` fixture is signed in as —
 * then asserts Home's store-driven render:
 * - a future-dated event renders a countdown card with its label, day-count
 *   and description (CAP-1 read half, CAP-3)
 * - a partner-owned event renders too — the SELECT policy returns own +
 *   partner with no client-side user_id filter (CAP-1's couple-shared half)
 * - TimeTogether, both BirthdayCountdown cards and the Wedding EventCountdown
 *   render unchanged alongside the events (CAP-4)
 * - a past-dated event renders nowhere on the page, and the string
 *   "Event passed" never appears (CAP-3)
 * - an account with zero events (own + partner, since the SELECT policy
 *   returns both) sees the explanatory placeholder rather than a gap
 *   (CAP-10, Home half)
 * - a background reload (revisiting Home) never blanks a card already on
 *   screen while the refetch is in flight (Design Notes)
 * - the column renders at most three cards, the three soonest, and a past
 *   event does not consume one of those slots (DW-22)
 *
 * User id resolution mirrors `tests/support/factories/index.ts`'s
 * `resolveAppUserIdByEmail` (email → `public.users.id`), kept self-contained
 * here since that helper is not exported.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import { formatDateISO } from '../../../src/utils/dateUtils';

/** Ids of events seeded by this file's tests, drained in afterEach. */
const pendingEventIds: string[] = [];

async function resolveAppUserId(
  supabaseAdmin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not resolve app user for ${email}: ${error?.message ?? 'not found'}`);
  }

  return data.id;
}

/** This worker's own pair, resolved to `public.users.id`s. Throws outside a worker. */
async function resolveOwnPair(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ userId: string; partnerId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnPair: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

async function seedEvent(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  dayOffset: number,
  label: string,
  description: string | null,
  icon: 'ring' | 'plane' | 'calendar' = 'calendar'
): Promise<void> {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({ user_id: userId, label, event_date: formatDateISO(date), description, icon })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to seed event "${label}": ${error?.message ?? 'no row returned'}`);
  }

  pendingEventIds.push(data.id);
}

/** Remove every event owned by either half of this worker's pair. */
async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  // Checked for the same reason afterEach's delete is: a silently-failed
  // pre-clear leaves stray rows that break the next test's premise and fail it
  // as "placeholder not visible", pointing at the wrong code.
  const { error } = await supabaseAdmin.from('events').delete().in('user_id', [userId, partnerId]);
  if (error) {
    throw new Error(`Failed to clear seeded events for the worker pair: ${error.message}`);
  }
}

test.afterEach(async ({ supabaseAdmin }) => {
  const ids = pendingEventIds.splice(0);
  if (ids.length > 0) {
    const { error } = await supabaseAdmin.from('events').delete().in('id', ids);
    if (error) {
      // Unchecked, this fails silently and leaves orphaned rows for this
      // worker's fixed test identity (worker-pool.ts) to trip over next run.
      throw new Error(`Failed to clean up seeded events [${ids.join(', ')}]: ${error.message}`);
    }
  }
});

test.describe('Home dashboard reads events from the store', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash, matching the other Home specs.
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] shows own and partner future events, hides a past one, and leaves other cards unchanged', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);

    // Self-healing against stray rows left by a previously failed run, for
    // either half of the couple — Home's SELECT reads own + partner.
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await seedEvent(supabaseAdmin, userId, 14, 'Future Meetup E2E', 'Future event description');
    await seedEvent(supabaseAdmin, userId, -14, 'Past Meetup E2E', 'Past event description');
    // CAP-1's couple-shared visibility: the SELECT policy returns own +
    // partner events with no user_id filter applied client-side, so a
    // partner-owned event must render on the signed-in user's Home too.
    // `icon: 'ring'` is not the column default ('calendar'), so this row is
    // what makes `icon={event.icon}` load-bearing: hardcoding any single icon
    // in App.tsx fails the icon assertion below.
    await seedEvent(
      supabaseAdmin,
      partnerId,
      21,
      'Partner Meetup E2E',
      'Partner event description',
      'ring'
    );

    await page.goto('/');

    const futureCard = page.getByTestId('event-countdown-future-meetup-e2e');
    await expect(futureCard).toBeVisible();
    await expect(futureCard.getByText('Future Meetup E2E')).toBeVisible();
    await expect(futureCard.getByText('Future event description')).toBeVisible();
    // The countdown day-count is this component's rendering of "the date".
    await expect(futureCard.getByText(/\d+\s*days?/i)).toBeVisible();

    const partnerCard = page.getByTestId('event-countdown-partner-meetup-e2e');
    await expect(partnerCard).toBeVisible();
    await expect(partnerCard.getByText('Partner Meetup E2E')).toBeVisible();
    await expect(partnerCard.getByText('Partner event description')).toBeVisible();

    // The stored `icon` reaches the card: the partner row is seeded 'ring' and
    // the own row takes the 'calendar' default, so the two must not render the
    // same glyph. iconColors maps each icon to a distinct border class.
    await expect(partnerCard).toHaveClass(/border-amber-300/);
    await expect(futureCard).toHaveClass(/border-green-300/);

    // Soonest-first, straight from the store: own event is +14d, partner's is
    // +21d. `events` is rendered in store order with no re-sort, so a
    // regression that re-sorts or reverses shows up here.
    const eventLabels = await page
      .getByTestId(/^event-countdown-(future|partner)-meetup-e2e$/)
      .locator('h3')
      .allTextContents();
    expect(eventLabels).toEqual(['Future Meetup E2E', 'Partner Meetup E2E']);

    // CAP-4: TimeTogether, both BirthdayCountdown cards and the Wedding
    // EventCountdown render unchanged alongside the events.
    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(page.getByTestId('birthday-countdown-frank')).toBeVisible();
    await expect(page.getByTestId('birthday-countdown-gracie')).toBeVisible();
    await expect(page.getByTestId('event-countdown-wedding')).toBeVisible();

    // The past event renders nowhere — not as its own card, not its text.
    await expect(page.getByTestId('event-countdown-past-meetup-e2e')).toHaveCount(0);
    await expect(page.getByText('Past Meetup E2E')).toHaveCount(0);
    await expect(page.getByText('Past event description')).toHaveCount(0);

    // No path on the page ever renders the retired "Event passed" branch.
    await expect(page.getByText('Event passed')).toHaveCount(0);
  });

  test('[P0] shows the empty-state placeholder for an account with zero events', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);

    // Self-healing against stray rows left by a previously failed run for
    // either half of the couple — this test's own premise is zero events
    // visible to the account, and Home's SELECT reads own + partner.
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await page.goto('/');

    await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();
    await expect(page.getByText('Event passed')).toHaveCount(0);
  });

  test('[P0] does not flash the empty-state placeholder before the first load settles', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);
    await seedEvent(supabaseAdmin, userId, 12, 'Flash Meetup E2E', 'Flash event description');

    // Hold the account's very FIRST events fetch, so the window this test is
    // about — Home painted, loadEvents() still outstanding — lasts as long as
    // the probe needs on any runner. Nothing else observed this state: the
    // `firstLoadSettled` argument App passes to getEventsSlotView could be
    // replaced with a constant `true` and every other test stayed green, which
    // is exactly the placeholder → gap → cards flash the gate exists to stop.
    let releaseFetch: (() => void) | undefined;
    const fetchHeld = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    await page.route('**/rest/v1/events*', async (route) => {
      await fetchHeld;
      await route.continue();
    });

    await page.goto('/');

    // Home itself is up while the events request is still held.
    await expect(page.getByTestId('time-together')).toBeVisible();

    // Non-retrying: a web-first assertion would pass even if the placeholder
    // painted first and was swapped out, since it retries for up to 15s.
    expect(await page.getByTestId('events-empty-placeholder').count()).toBe(0);

    releaseFetch?.();

    await expect(page.getByTestId('event-countdown-flash-meetup-e2e')).toBeVisible();

    await page.unroute('**/rest/v1/events*');
  });

  test('[P0] shows the placeholder when every stored event has already passed', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // Both halves of the couple hold only past events, so the store is
    // non-empty while the upcoming list is empty. This is what pins App's own
    // filter: delete it (`upcomingEvents = events`) and the slot computes
    // 'list', renders two components that each return null, and shows neither
    // cards nor the placeholder — the unexplained gap CAP-10 forbids.
    await seedEvent(supabaseAdmin, userId, -3, 'Old Meetup E2E', 'Old event description');
    await seedEvent(supabaseAdmin, partnerId, -30, 'Older Meetup E2E', 'Older event description');

    await page.goto('/');

    await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();
    await expect(page.getByText('Old Meetup E2E')).toHaveCount(0);
    await expect(page.getByText('Older Meetup E2E')).toHaveCount(0);
    await expect(page.getByText('Event passed')).toHaveCount(0);
  });

  test('[P0] renders an event dated today, with a null description', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // dayOffset 0 pins the filter's `>= 0` boundary: tightening it to `> 0`
    // drops a today-dated event and shows the placeholder instead of the card.
    // `description: null` is the column's nullable case, which App coerces with
    // `event.description ?? undefined` — every other seeded row supplies a
    // string, so this is the only test that carries a null through.
    await seedEvent(supabaseAdmin, userId, 0, 'Today Meetup E2E', null);

    await page.goto('/');

    const card = page.getByTestId('event-countdown-today-meetup-e2e');
    await expect(card).toBeVisible();
    await expect(card.getByText('Today Meetup E2E')).toBeVisible();
    await expect(card.getByText('Today! 🎉')).toBeVisible();

    // No description paragraph is rendered next to the label for a null value.
    expect(await card.locator('h3 ~ p').count()).toBe(0);

    await expect(page.getByTestId('events-empty-placeholder')).toHaveCount(0);
  });

  test('[P0] caps the events column at three cards, keeping the soonest', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // Five upcoming events against a cap of three (DW-22). Without the cap the
    // right-hand column keeps growing past the fixed two-card birthdays column
    // beside it. Seeded out of date order and across both halves of the couple,
    // so the assertion pins "the three SOONEST" rather than "the first three
    // rows the query happened to return".
    await seedEvent(supabaseAdmin, userId, 24, 'Fourth Meetup E2E', 'Fourth event description');
    await seedEvent(supabaseAdmin, partnerId, 6, 'Second Meetup E2E', 'Second event description');
    await seedEvent(supabaseAdmin, userId, 31, 'Fifth Meetup E2E', 'Fifth event description');
    await seedEvent(supabaseAdmin, userId, 18, 'Third Meetup E2E', 'Third event description');
    await seedEvent(supabaseAdmin, partnerId, 2, 'First Meetup E2E', 'First event description');
    // A past event too: the store holds it (Settings lists past events), so
    // this is what pins that the cap counts UPCOMING events only. Cap the raw
    // `events` array instead of the filtered one and this row eats a slot,
    // leaving 'Third Meetup E2E' off the page.
    await seedEvent(supabaseAdmin, userId, -9, 'Old Meetup E2E', 'Old event description');

    await page.goto('/');

    await expect(page.getByTestId('event-countdown-first-meetup-e2e')).toBeVisible();

    const cardLabels = await page
      .getByTestId(/^event-countdown-\w+-meetup-e2e$/)
      .locator('h3')
      .allTextContents();
    expect(cardLabels).toEqual(['First Meetup E2E', 'Second Meetup E2E', 'Third Meetup E2E']);

    // The overflow is not merely off-screen — it renders nowhere on the page.
    await expect(page.getByTestId('event-countdown-fourth-meetup-e2e')).toHaveCount(0);
    await expect(page.getByTestId('event-countdown-fifth-meetup-e2e')).toHaveCount(0);
    await expect(page.getByText('Fourth event description')).toHaveCount(0);
    await expect(page.getByText('Fifth event description')).toHaveCount(0);
    await expect(page.getByText('Old Meetup E2E')).toHaveCount(0);

    // Hiding the tail must never turn a real list into the empty state: the
    // slot decision still sees the uncapped upcoming count.
    await expect(page.getByTestId('events-empty-placeholder')).toHaveCount(0);
    await expect(page.getByTestId('events-load-error')).toHaveCount(0);
  });

  test('[P0] a background reload never blanks a card already on screen', async ({
    page,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await seedEvent(supabaseAdmin, userId, 10, 'Reload Meetup E2E', 'Reload event description');

    await page.goto('/');

    const card = page.getByTestId('event-countdown-reload-meetup-e2e');
    await expect(card).toBeVisible();

    // Hold the revisit's events fetch open on a promise this test releases,
    // rather than sleeping against a fixed delay: the mid-reload window then
    // lasts exactly as long as the assertions below need, on any runner.
    let releaseFetch: (() => void) | undefined;
    const fetchHeld = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    let eventsRequests = 0;

    await page.route('**/rest/v1/events*', async (route) => {
      eventsRequests += 1;
      await fetchHeld;
      await route.continue();
    });

    // Leave Home and come back — re-triggers the loadEvents() effect exactly
    // as CAP-1's "B's next load of Home" does.
    await navigateTo(page, 'photos');
    await navigateTo(page, 'home');

    // The refetch must actually happen: this is the only test anywhere that
    // exercises the effect's `currentView` key, so without this the whole
    // "return to Home reloads events" behaviour could be deleted and every
    // test would still pass off the store's already-loaded data.
    await expect.poll(() => eventsRequests).toBeGreaterThan(0);

    // While that response is still held, the card must not have blanked
    // (Design Notes: "A later background reload must never blank cards
    // already on screen"). Deliberately NOT `expect(card).toBeVisible()`:
    // web-first assertions retry for up to 15s (playwright.config.ts), so a
    // card that vanished for the whole in-flight window and came back would
    // still pass. A single non-retrying read is what catches a transient
    // blank.
    expect(await card.isVisible()).toBe(true);
    expect(await page.getByTestId('events-empty-placeholder').count()).toBe(0);

    // Release the held response; the card is still there once it lands.
    releaseFetch?.();
    await expect(card).toBeVisible();
    await expect(card.getByText('Reload event description')).toBeVisible();

    await page.unroute('**/rest/v1/events*');
  });
});
