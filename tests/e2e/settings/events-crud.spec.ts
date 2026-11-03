/**
 * P0 E2E: Managing events from Settings
 *
 * Story 5 (dynamic events), on the Dates list and the pages under it. The real
 * round trip against the local stack, with every row created through the UI
 * rather than seeded — this is the only test anywhere that exercises `addEvent`
 * from the New event form and `editEvent` from a field page against the real
 * store, and the only one that races the Dates list's own `loadEvents()` mount
 * read.
 *
 * - reach the Dates list through the gear and the Dates row, tap `+`, choose
 *   Event, add an event on the New event form, and see it on the list (CAP-1's
 *   write half, CAP-5)
 * - the same event is on Home afterwards, with no reload (CAP-1)
 * - edit its name and date on their field pages, and see both change on the
 *   Dates list and on Home
 * - a reload of `/settings/dates` lists the events (the Dates list loads for
 *   itself; Home was never the source)
 * - a successful edit survives a mount read that answers with the older rows
 * - a past event is listed and editable where Home hides it
 * - a rejected create keeps the form and shows the message the write returned
 *   (CAP-7)
 *
 * What the old Countdowns section's cases checked that other specs now own:
 * deleting an event behind a confirmation (`event-pages.spec.ts`), a partner's
 * event being read-only (`event-pages.spec.ts`), and the empty state's add
 * control (gone: the `+` button is the one way to add, and an empty group is
 * absent).
 *
 * Pair resolution, scoped cleanup, event seeding and local-date helpers are
 * shared through `tests/support/helpers/events.ts`.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { navigateTo } from '../../support/helpers/navigation';
import {
  clearOwnPairEvents,
  clearPairEvents,
  clockAnchor,
  isoDateDaysFromNow,
  localDateFromIso,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { listDate } from '../../support/helpers/dates-list-format';
import {
  addEventFromDatesList,
  eventRowFor,
  fillNewEventForm,
  openNewEventForm,
  type NewEventInput,
} from '../../support/helpers/new-date-forms';
import { createDatabaseErrorEnvelope } from '../../support/factories/database-error-envelope';
import { EVENTS_WRITE, UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import {
  openDatesList,
  openSettingsFromHome,
  reloadDatesList,
  returnToSettings,
} from '../../support/helpers/settings-screen';
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { TypedSupabaseClient } from '../../support/factories';

/**
 * Labels are deliberately unlike any fixed testid on Home — `Wedding` slugifies
 * to `event-countdown-wedding`, which is a hardcoded card that must never be
 * shadowed by a row this spec creates.
 */
const ADDED_LABEL = 'Settings Trip E2E';
const EDITED_LABEL = 'Settings Voyage E2E';
// Vite runs the app in React StrictMode, so the Dates list's mount effect
// starts two loads. Each getEvents() load reads upcoming and past pages in
// parallel.
const DATES_MOUNT_SNAPSHOT_COUNT = 4;

const rowFor = eventRowFor;

/** Calendar days from the anchor to the event every test below adds. */
const TRIP_DAYS_AHEAD = 30;
/** Calendar days from the anchor to the date the edit test moves it to. */
const VOYAGE_DAYS_AHEAD = 45;

/**
 * Pin the page clock to `anchor` (noon of its local day, from `clockAnchor`)
 * and keep the welcome splash off, its stamp read from that clock, before the
 * first navigation. Every
 * date a test builds comes from the returned anchor, so the browser's today
 * is the anchor's day however long the run takes. At noon a date N calendar
 * days ahead reads as N - 1 whole days on a countdown card — the half day left
 * today belongs to its live clock — so the countdowns asserted below are fixed
 * literals, not a rerun of the app's arithmetic.
 */
async function pinClock(page: Page): Promise<Date> {
  const anchor = clockAnchor();
  await page.clock.install({ time: anchor });
  await dismissWelcomeSplash(page);
  return anchor;
}

test.afterEach(async ({ supabaseAdmin }) => {
  await clearOwnPairEvents(supabaseAdmin);
});

/**
 * Open the Dates list from Home with no event on this worker's couple, and
 * wait for its own load to settle on the empty list (no Events group).
 */
async function openEmptyDatesList(
  page: Page,
  supabaseAdmin: TypedSupabaseClient,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  // Self-healing against stray rows from a previously failed run, for either
  // half of the couple — the SELECT policy returns own + partner.
  await clearPairEvents(supabaseAdmin, userId, partnerId);

  await openSettingsFromHome(page, interceptNetworkCall);
  await openDatesList(page, interceptNetworkCall);

  // An empty group is absent; `+` is how the first event is added.
  await expect(page.getByTestId('settings-dates-events')).toHaveCount(0);
  await expect(page.getByTestId('settings-dates-add')).toBeVisible();
}

/** The event every test below adds, dated TRIP_DAYS_AHEAD days after `anchor`. */
function tripEvent(anchor: Date): NewEventInput {
  return {
    label: ADDED_LABEL,
    date: isoDateDaysFromNow(TRIP_DAYS_AHEAD, anchor),
    description: 'Booked and counting',
    icon: 'plane',
  };
}

test.describe('Managing events from Settings', () => {
  test('[P0] adds an event from the empty Dates list and lists it', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const anchor = await pinClock(page);
    await openEmptyDatesList(page, supabaseAdmin, interceptNetworkCall);

    // ── Add ────────────────────────────────────────────────────────────────
    const added = tripEvent(anchor);
    await addEventFromDatesList(page, interceptNetworkCall, added, anchor);

    // The server row holds what the form sent.
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const { data } = await supabaseAdmin
      .from('events')
      .select('label, event_date, description, icon')
      .eq('user_id', userId)
      .eq('label', ADDED_LABEL);
    expect(data).toEqual([
      {
        label: ADDED_LABEL,
        event_date: added.date,
        description: 'Booked and counting',
        icon: 'plane',
      },
    ]);
  });

  test('[P0] an event added from the Dates list shows on Home with no reload', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const anchor = await pinClock(page);
    const added = tripEvent(anchor);
    await openEmptyDatesList(page, supabaseAdmin, interceptNetworkCall);
    await addEventFromDatesList(page, interceptNetworkCall, added, anchor);

    // ── Visible on Home ────────────────────────────────────────────────────
    await navigateTo(page, 'home');
    const card = page.getByTestId('event-countdown-settings-trip-e2e');
    await expect(card).toBeVisible();
    await expect(card.getByText(ADDED_LABEL)).toBeVisible();
    await expect(card.getByText('Booked and counting')).toBeVisible();
    // The date itself, as this component renders it: whole days left on the
    // pinned clock (TRIP_DAYS_AHEAD calendar days from noon). This is the
    // whole date round trip — the <input type="date"> string, the `date`
    // column, and the local-midnight rebuild — pinned to one number.
    await expect(card.getByTestId('countdown-value')).toHaveText('29 days');
  });

  test('[P0] editing an event on its field pages changes its name and date on the Dates list and on Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const anchor = await pinClock(page);
    const added = tripEvent(anchor);
    const editedDate = isoDateDaysFromNow(VOYAGE_DAYS_AHEAD, anchor);
    await openEmptyDatesList(page, supabaseAdmin, interceptNetworkCall);
    await addEventFromDatesList(page, interceptNetworkCall, added, anchor);

    // Premise for the old card's absence below: Home rendered it first.
    const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await navigateTo(page, 'home');
    expect((await homeRead).status).toBe(200);
    await expect(page.getByTestId('event-countdown-settings-trip-e2e')).toBeVisible();

    // ── Edit ───────────────────────────────────────────────────────────────
    await returnToSettings(page);
    await openDatesList(page, interceptNetworkCall);
    await rowFor(page, ADDED_LABEL).click();
    await expect(page.getByTestId('settings-event-page')).toBeVisible();

    await page.getByTestId('settings-event-name').click();
    // Pre-filled with the saved name.
    await expect(page.getByTestId('settings-event-name-field')).toHaveValue(ADDED_LABEL);
    await page.getByTestId('settings-event-name-field').fill(EDITED_LABEL);
    const nameResponse = interceptNetworkCall({ method: 'PATCH', url: EVENTS_WRITE });
    await page.getByTestId('settings-field-save').click();
    expect((await nameResponse).status).toBe(200);

    await page.getByTestId('settings-event-date').click();
    // Pre-filled with the same calendar day the row shows — the off-by-one this
    // feature exists to avoid would surface right here.
    await expect(page.getByTestId('settings-event-date-field')).toHaveValue(added.date);
    await page.getByTestId('settings-event-date-field').fill(editedDate);
    const dateResponse = interceptNetworkCall({ method: 'PATCH', url: EVENTS_WRITE });
    await page.getByTestId('settings-field-save').click();
    expect((await dateResponse).status).toBe(200);

    // Back on the Dates list the row follows both halves of the edit.
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    const editedRow = rowFor(page, EDITED_LABEL);
    await expect(editedRow).toBeVisible();
    await expect(editedRow).toContainText(listDate(localDateFromIso(editedDate), anchor));
    await expect(rowFor(page, ADDED_LABEL)).toHaveCount(0);

    // Home follows the edit — both halves of it. The old card's testid is
    // derived from the old label, so its absence is what proves the card was
    // re-rendered rather than left behind.
    await navigateTo(page, 'home');
    const editedCard = page.getByTestId('event-countdown-settings-voyage-e2e');
    await expect(editedCard).toBeVisible();
    await expect(editedCard.getByText(EDITED_LABEL)).toBeVisible();
    // VOYAGE_DAYS_AHEAD calendar days from noon on the pinned clock.
    await expect(editedCard.getByTestId('countdown-value')).toHaveText('44 days');
    await expect(page.getByTestId('event-countdown-settings-trip-e2e')).toHaveCount(0);
  });

  test('[P0] loads the Dates list on a direct reload of /settings/dates, without visiting Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // App's loadEvents() effect is gated on Home and the `events` local-copy
    // refresher skips Settings, so without the Dates list's own mount effect a
    // deep link would never read the server (a fresh browser has no saved
    // copy, so the list would stay empty). Seeded directly: the point is the read
    // path, not the write path.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = await pinClock(page);
    const seededDate = isoDateDaysFromNow(20, anchor);
    await seedEvent(supabaseAdmin, {
      userId,
      label: 'Settings Deeplink E2E',
      eventDate: seededDate,
      description: 'Seeded for the deep link',
      icon: 'calendar',
    });

    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);
    await expect(page).toHaveURL(/\/settings\/dates$/);

    // The reload is what removes Home from the picture entirely: the app boots
    // straight onto the Dates list and never renders the Home view. The first
    // visit saved a copy that renders before the server answers, so the row is
    // read only after the reload's own read has settled.
    await reloadDatesList(page, interceptNetworkCall);
    const row = rowFor(page, 'Settings Deeplink E2E');
    await expect(row).toBeVisible();
    await expect(row).toContainText(listDate(localDateFromIso(seededDate), anchor));
  });

  test('[P0] keeps a successful edit when the Dates list mount read returns an older snapshot', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = await pinClock(page);
    const originalDate = isoDateDaysFromNow(20, anchor);
    const orderWitnessDate = isoDateDaysFromNow(28, anchor);
    const editedDate = isoDateDaysFromNow(35, anchor);
    await Promise.all([
      seedEvent(supabaseAdmin, {
        userId,
        label: 'Settings Snapshot Before Edit E2E',
        eventDate: originalDate,
        description: 'Original snapshot',
        icon: 'calendar',
      }),
      seedEvent(supabaseAdmin, {
        userId,
        label: 'Settings Snapshot Order Witness E2E',
        eventDate: orderWitnessDate,
        description: 'Must sort before the edited row',
        icon: 'calendar',
      }),
    ]);

    // Home first populates the real Zustand slice, giving the Dates list an
    // editable row while its own mount GET is held below.
    const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await page.goto('/');
    expect((await homeRead).status).toBe(200);
    await expect(page.getByTestId('event-countdown-settings-snapshot-before-edit-e2e')).toBeVisible();
    await returnToSettings(page);

    let markSnapshotsCaptured: () => void = () => {};
    const snapshotsCaptured = new Promise<void>((resolve) => {
      markSnapshotsCaptured = resolve;
    });
    let reservedSnapshotCount = 0;
    let capturedSnapshotCount = 0;
    let releaseSnapshots: () => void = () => {};
    const snapshotsHeld = new Promise<void>((resolve) => {
      releaseSnapshots = resolve;
    });

    // playwright-utils deviation: the route must be installed before the Dates row is tapped and hold every mount read behind route.fetch until released; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/events*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const slot = reservedSnapshotCount++;
      // Only the Dates list's mount reads are held; a read after them (the
      // list mounting again on the way back) goes straight through.
      if (slot >= DATES_MOUNT_SNAPSHOT_COUNT) {
        await route.continue();
        return;
      }

      // Fetch every bounded page for both StrictMode load calls now, before the
      // PATCH, so every response body contains the old row state even though
      // they are delivered only after the edit settles.
      const staleResponse = await route.fetch();
      if (!staleResponse.ok()) {
        throw new Error(`Expected successful snapshot, got ${staleResponse.status()}`);
      }
      capturedSnapshotCount += 1;
      if (capturedSnapshotCount === DATES_MOUNT_SNAPSHOT_COUNT) markSnapshotsCaptured();
      await snapshotsHeld;
      await route.fulfill({ response: staleResponse });
    });

    await page.getByTestId('settings-dates-row').click();
    await snapshotsCaptured;
    const eventsLoading = () =>
      page.evaluate(() => window.__APP_STORE__!.getState().eventsIsLoading);
    expect(await eventsLoading()).toBe(true);

    // The list shows the rows Home loaded; edit one while the load is held.
    const originalRow = rowFor(page, 'Settings Snapshot Before Edit E2E');
    await expect(originalRow).toBeVisible();
    await originalRow.click();
    await page.getByTestId('settings-event-date').click();
    await page.getByTestId('settings-event-date-field').fill(editedDate);
    const updateResponse = interceptNetworkCall({ method: 'PATCH', url: EVENTS_WRITE });
    await page.getByTestId('settings-field-save').click();
    expect((await updateResponse).status).toBe(200);
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(editedDate), anchor)}`
    );

    releaseSnapshots();
    // This flips only after getEvents' two-request Promise.all resolves and the
    // slice installs its reconciled list, giving the assertion a causal settle
    // signal rather than an arbitrary frame boundary.
    await expect.poll(eventsLoading).toBe(false);

    // The older snapshot did not take the edit back.
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(editedDate), anchor)}`
    );
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    const rows = page.getByTestId('settings-dates-events').locator('[data-testid^="settings-dates-event-"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Settings Snapshot Order Witness E2E');
    await expect(rows.nth(1)).toContainText('Settings Snapshot Before Edit E2E');
    await expect(rows.nth(1)).toContainText(listDate(localDateFromIso(editedDate), anchor));

    await page.unroute('**/rest/v1/events*');
  });

  test('[P0] lists a past event under Past and opens it editable, where Home hides it', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // Auto-hide is Home's rule alone: the Dates list is the only place a
    // mistyped year can be seen and corrected, so a past event must be listed
    // AND editable there.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = await pinClock(page);
    const pastDate = isoDateDaysFromNow(-14, anchor);
    // A future event is seeded alongside it purely as a load witness: without
    // one, `toHaveCount(0)` on the past card runs before loadEvents can have
    // resolved and passes vacuously — it would still pass if Home rendered
    // every past event it was given.
    const futureWitnessDate = isoDateDaysFromNow(9, anchor);
    await Promise.all([
      seedEvent(supabaseAdmin, {
        userId,
        label: 'Settings Bygone E2E',
        eventDate: pastDate,
        description: null,
        icon: 'calendar',
      }),
      seedEvent(supabaseAdmin, {
        userId,
        label: 'Settings Witness E2E',
        eventDate: futureWitnessDate,
        description: null,
        icon: 'calendar',
      }),
    ]);

    const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await page.goto('/');
    expect((await homeRead).status).toBe(200);

    // The witness proves this load landed, so the absence below is a real
    // absence rather than an assertion that beat the fetch.
    await expect(page.getByTestId('event-countdown-settings-witness-e2e')).toBeVisible();
    await expect(page.getByTestId('event-countdown-settings-bygone-e2e')).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText('Settings Bygone E2E', {
      ignoreCase: true,
    });

    await returnToSettings(page);
    await openDatesList(page, interceptNetworkCall);
    const row = page.getByTestId('settings-dates-past').locator('[data-testid^="settings-dates-event-"]');
    await expect(row).toContainText('Settings Bygone E2E');
    await expect(row).toContainText(listDate(localDateFromIso(pastDate), anchor));

    // Its page is editable (a Name row, a Delete) and has no Remind me.
    await row.click();
    await expect(page.getByTestId('settings-event-name')).toBeVisible();
    await expect(page.getByTestId('settings-event-delete')).toBeVisible();
    await expect(page.getByTestId('settings-remind-me')).toHaveCount(0);
  });
});

test.describe(
  'A rejected save keeps the form open',
  // Without this the network monitor fails the test on the 500 it was told to
  // inject.
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    test('[P0] shows the message the write returned and leaves the form as typed', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      const anchor = await pinClock(page);
      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);

      // Registered before the form is even opened, so the route is in place
      // long before the create leaves the page. A PostgREST-shaped body is what
      // makes the surfaced message deterministic: eventsService routes it
      // through handleSupabaseError, which prefixes "Database error: ".
      const rejectedCreate = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/events*',
        fulfillResponse: {
          status: 500,
          body: createDatabaseErrorEnvelope({
            message: 'Injected create failure',
            details: '',
            hint: '',
          }),
        },
      });

      await openNewEventForm(page);
      const date = isoDateDaysFromNow(10, anchor);
      await fillNewEventForm(page, { label: 'Settings Rejected E2E', date });
      await page.getByTestId('settings-form-add').click();

      await rejectedCreate;

      // The form stays open, carrying the message from THIS write.
      await expect(page.getByTestId('settings-new-event-page')).toBeVisible();
      await expect(page.getByTestId('settings-form-error')).toContainText('Injected create failure');
      // The fields are as typed.
      await expect(page.getByTestId('settings-new-event-name-field')).toHaveValue('Settings Rejected E2E');
      await expect(page.getByTestId('settings-new-event-date-field')).toHaveValue(date);
      // And Add is usable again, so a retry is possible without reopening.
      await expect(page.getByTestId('settings-form-add')).toBeEnabled();

      // Nothing was added behind it.
      await page.getByTestId('settings-cancel').click();
      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.getByTestId('settings-dates-events')).toHaveCount(0);
    });
  }
);
