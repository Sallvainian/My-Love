/**
 * E2E: Settings > Dates
 *
 * A linked pool account opens the Dates list from the top page's Dates row and
 * sees Together, Birthdays (`You` and the partner by name), Events and Past,
 * each row with its date. An account the server says is unlinked sees no
 * Together group, no partner birthday row and only its own events. With more
 * past events than a page holds, `Load more` appends the older ones on the same
 * page, and Back returns to the top page.
 *
 * Seeds its own rows through the admin client and deletes only those by id, so
 * the pair's other rows are left alone. Bottom-dock form on a phone viewport, as
 * `partner-page.spec.ts` runs.
 */
import { test, expect } from '../../support/merged-fixtures';
import { eventDateFrom, seedEvents, type EventSpec } from '../../support/factories/events';
import { dayMonth, listDate } from '../../support/helpers/dates-list-format';
import { EVENTS_PAGE_SIZE, localDateFromIso, resolveOwnPair } from '../../support/helpers/events';
import {
  COUPLE_SETTINGS_READ,
  HISTORY_PAGE_READ,
  OWN_PROFILE_READ,
  partnerRecordRead,
  UPCOMING_EVENTS_READ,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** A row the app read as an array of at most one (`maybeSingle`), or `undefined` for none. */
const firstRow = <T>(json: unknown): T | undefined => (Array.isArray(json) ? json[0] : json) as T | undefined;

test.describe('Settings > Dates', () => {
  let seededIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    seededIds = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seededIds.length === 0) return;
    const { error } = await supabaseAdmin.from('events').delete().in('id', seededIds);
    if (error) throw new Error(`Failed to delete the rows this spec seeded: ${error.message}`);
  });

  async function seed(
    supabaseAdmin: Parameters<typeof resolveOwnPair>[0],
    anchor: Date,
    specs: EventSpec[]
  ) {
    const pair = await resolveOwnPair(supabaseAdmin);
    const rows = await seedEvents(supabaseAdmin, pair, specs, anchor);
    seededIds.push(...rows.map((row) => row.id));
    return rows;
  }

  test('[P1] should list Together, Birthdays, Events and Past with their dates for a linked account, and go back to the top page', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: a linked account with one upcoming and one past event of its own
    const anchor = new Date();
    const [upcoming, past] = await seed(supabaseAdmin, anchor, [
      { dayOffset: 3, label: 'Dates list upcoming' },
      { dayOffset: -3, label: 'Dates list past' },
    ]);
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    // The reads whose answers the list shows, armed before the sign-in that sends them
    const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
    const profileRead = interceptNetworkCall({ method: 'GET', url: OWN_PROFILE_READ });
    const coupleRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await openSettingsFromHome(page, interceptNetworkCall);
    const partner = firstRow<{ display_name: string | null; birthday: string | null }>(
      (await partnerRead).responseJson
    );
    const own = firstRow<{ birthday: string | null }>((await profileRead).responseJson);
    const couple = firstRow<{ relationship_start: string | null; wedding_date: string | null }>(
      (await coupleRead).responseJson
    );
    const partnerName = (partner?.display_name ?? '').trim();
    expect(partnerName).not.toBe('');

    // WHEN: the Dates row is tapped
    await expect(page.getByTestId('settings-dates-row')).toHaveText('Dates');
    await page.getByTestId('settings-dates-row').click();

    // THEN: the large-title list opens under /settings/dates
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();

    // THEN: each couple and birthday value is exactly what the reads answered, or Not set
    const now = new Date();
    const start = couple?.relationship_start ? listDate(new Date(couple.relationship_start), now) : 'Not set';
    const wedding = couple?.wedding_date ? listDate(localDateFromIso(couple.wedding_date), now) : 'Not set';
    const birthday = (value: string | null | undefined) =>
      value ? dayMonth(localDateFromIso(value)) : 'Not set';
    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Together');
    await expect(page.getByTestId('settings-dates-together-since')).toHaveAccessibleName(
      `Together since, ${start}`
    );
    await expect(page.getByTestId('settings-dates-wedding')).toHaveAccessibleName(`Wedding, ${wedding}`);

    // THEN: Birthdays holds You, then the partner by name
    const birthdays = page.getByTestId('settings-dates-birthdays').getByRole('button');
    await expect(birthdays).toHaveCount(2);
    await expect(birthdays.nth(0)).toHaveAccessibleName(`You, ${birthday(own?.birthday)}`);
    await expect(birthdays.nth(1)).toHaveAccessibleName(`${partnerName}, ${birthday(partner?.birthday)}`);

    // THEN: Events and Past show the seeded rows with their dates on the right
    const upcomingRow = page
      .getByTestId('settings-dates-events')
      .getByTestId(`settings-dates-event-${upcoming.id}`);
    await expect(upcomingRow).toContainText('Dates list upcoming');
    await expect(upcomingRow).toContainText(listDate(localDateFromIso(upcoming.eventDate), now));
    const pastRow = page.getByTestId('settings-dates-past').getByTestId(`settings-dates-event-${past.id}`);
    await expect(pastRow).toContainText('Dates list past');
    await expect(pastRow).toContainText(listDate(localDateFromIso(past.eventDate), now));

    // WHEN: back is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: the top page, one level up
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });

  test('[P1] should show no Together group, no partner birthday and only own events when the server says unlinked', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: this browser only, the partner_id read answers unset (the pool
    // couple stays linked in the database), and both halves own an upcoming event
    const anchor = new Date();
    const [own, partners] = await seed(supabaseAdmin, anchor, [
      { dayOffset: 4, label: 'Dates unlinked own' },
      { dayOffset: 5, label: 'Dates unlinked partner', owner: 'partner' },
    ]);
    // playwright-utils deviation: the route must be installed before the next navigation and answer every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/users?select=partner_id*', (route) =>
      route.fulfill({ json: { partner_id: null, updated_at: '2026-01-01T00:00:00Z' } })
    );
    await openSettingsFromHome(page, interceptNetworkCall);
    await expect(page.getByTestId('settings-partner-row')).toContainText('Not linked');

    // WHEN: the Dates list opens
    await page.getByTestId('settings-dates-row').click();
    await expect(page).toHaveURL(/\/settings\/dates$/);

    // THEN: no Together group, no partner birthday row, only the account's own event
    await expect(page.getByTestId('settings-dates-birthday-self')).toBeVisible();
    await expect(page.getByTestId(`settings-dates-event-${own.id}`)).toBeVisible();
    await expect(page.getByTestId('settings-dates-together')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Together' })).toHaveCount(0);
    await expect(page.getByTestId('settings-dates-birthday-partner')).toHaveCount(0);
    await expect(page.getByTestId(`settings-dates-event-${partners.id}`)).toHaveCount(0);
  });

  test('[P1] should append older past events on Load more without leaving the Dates list', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: one past event more than the first page holds, so the oldest is
    // reached only through Load more
    const anchor = new Date();
    const rows = await seed(
      supabaseAdmin,
      anchor,
      Array.from({ length: EVENTS_PAGE_SIZE + 1 }, (_, index) => ({
        dayOffset: -(index + 1),
        label: `Dates paged past ${String(index + 1).padStart(2, '0')}`,
      }))
    );
    const oldest = rows[EVENTS_PAGE_SIZE];
    expect(oldest.eventDate).toBe(eventDateFrom(anchor, -(EVENTS_PAGE_SIZE + 1)));
    await openSettingsFromHome(page, interceptNetworkCall);

    // WHEN: the Dates list opens and its own events load settles
    const datesRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await page.getByTestId('settings-dates-row').click();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    expect((await datesRead).status).toBe(200);
    await recurseUntil(
      () => page.evaluate(() => window.__APP_STORE__!.getState().eventsIsLoading),
      (loading) => {
        expect(loading).toBe(false);
      }
    );

    // THEN: the newest page is listed, the oldest row is not, and Load more ends Past
    const past = page.getByTestId('settings-dates-past');
    const loadMore = page.getByTestId('settings-dates-load-more');
    await expect(past.getByTestId(`settings-dates-event-${rows[0].id}`)).toBeVisible();
    await expect(page.getByTestId(`settings-dates-event-${oldest.id}`)).toHaveCount(0);
    await expect(loadMore).toBeVisible();

    // WHEN: Load more is tapped
    const pageRead = interceptNetworkCall({ method: 'GET', url: HISTORY_PAGE_READ });
    await loadMore.click();
    expect((await pageRead).status).toBe(200);

    // THEN: the oldest event is appended in place, Load more is gone and the URL is unchanged
    await expect(past.getByTestId(`settings-dates-event-${oldest.id}`)).toBeVisible();
    await expect(past.getByTestId(`settings-dates-event-${oldest.id}`)).toContainText(
      listDate(localDateFromIso(oldest.eventDate), new Date())
    );
    await expect(loadMore).toHaveCount(0);
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
  });
});
