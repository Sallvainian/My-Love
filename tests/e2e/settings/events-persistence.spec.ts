/**
 * tests/e2e/settings/events-persistence.spec.ts
 *
 * E2E: what an event still carries after the server hands it back.
 *
 * Story 5 (dynamic events), `automate` pass. Every row here is created through
 * the New event form (`+` → Event on the Dates list). DE.5-E2E-004/005 then
 * reload `/settings/dates`, reading events through `eventsService`'s
 * row→`CoupleEvent` mapping and `eventsSlice`. DE.5-E2E-006 observes the update
 * request, response and UI without reloading.
 *
 * - DE.5-E2E-004 [P1] the icon chosen on the form survives a reload, into the
 *   event page's Icon row and the Icon field page's selection, and into the Home
 *   card's icon treatment (`EventCountdown.tsx:32-54` maps `ring` → `Gem`)
 * - DE.5-E2E-005 [P1] three future rows with distinct dates display on the
 *   Dates list in chronological order after a reload. The service orders future
 *   rows by `event_date`, then `created_at`; `eventsSlice.loadEvents` also
 *   reconciles completed mutations and calls `sortByDate`. The assertions
 *   establish distinct-date display order, not the source of sorting or
 *   same-date `created_at` tiebreak coverage
 * - DE.5-E2E-006 [P2] clearing a note on its field page observes a pass-through
 *   PATCH carrying `description: null`, HTTP 200, the cleared event page row and
 *   the Home card without the description, without reloading.
 *   `EventFieldPage` converts the empty field to `null`;
 *   `eventsService.updateEvent` includes defined descriptions, including
 *   `null`, in the update
 *
 * Complements `tests/e2e/settings/events-crud.spec.ts`, which owns the
 * add/edit journey, the deep-link load, the past-event row and the rejected
 * write. Nothing here repeats those. Validation and the double-tap guard stay at
 * component level by design and are deliberately not lifted here.
 *
 * Test data: rows belong to THIS worker's pair only, keyed on
 * TEST_PARALLEL_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password is reset, no shared row is nulled — those rows belong
 * to other workers. `resolveOwnPair` / `clearPairEvents` / `clearOwnPairEvents`
 * come from `tests/support/helpers/events.ts`.
 *
 * Nothing is stubbed, so no `skipNetworkMonitoring`: the merged fixtures'
 * network-error-monitor stays armed and a 4xx/5xx here is real signal.
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-persistence.spec.ts --project=chromium
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { navigateTo } from '../../support/helpers/navigation';
// The pair resolution, the scoped teardown and the two date rules live in one
// module now. They were hand-copied into eight files before it existed, and
// `clearPairEvents` is the teardown that keeps one worker's rows out of another
// worker's premise — eight copies was eight chances for one to drift into
// deleting more than its own pair.
import {
  clearOwnPairEvents,
  clearPairEvents,
  isoDateDaysFromNow,
  localDateFromIso,
  resolveOwnPair,
} from '../../support/helpers/events';
import { listDate } from '../../support/helpers/dates-list-format';
import { addEventFromDatesList, eventRowFor } from '../../support/helpers/new-date-forms';
import { UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import {
  openDatesList,
  openSettingsFromHome,
  reloadDatesList,
  returnToSettings,
} from '../../support/helpers/settings-screen';
import { log } from '@seontechnologies/playwright-utils';

/**
 * Labels are prefixed and deliberately unlike any fixed Home testid —
 * `Wedding` slugifies to `event-countdown-wedding`, a hardcoded card that must
 * never be shadowed by a row this spec creates. The Home testid is
 * `event-countdown-<label lowercased, spaces → dashes>`
 * (`EventCountdown.tsx:204`), so each card testid below is derived from its
 * label rather than guessed.
 */
const ICON_LABEL = 'Settings Icon E2E';
const ICON_CARD_TESTID = 'event-countdown-settings-icon-e2e';

const ORDER_LATE_LABEL = 'Settings Order Late E2E';
const ORDER_SOON_LABEL = 'Settings Order Soon E2E';
const ORDER_MID_LABEL = 'Settings Order Mid E2E';

const DESCRIPTION_LABEL = 'Settings Description E2E';
const DESCRIPTION_CARD_TESTID = 'event-countdown-settings-description-e2e';
const DESCRIPTION_TEXT = 'Table booked for two';

const rowFor = eventRowFor;

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

test.afterEach(async ({ supabaseAdmin }) => {
  await clearOwnPairEvents(supabaseAdmin);
});

test.describe('An event survives the round trip through the server', () => {
  test('[P1] DE.5-E2E-004 the icon a user picks comes back on reload and reaches the Home card', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    // Self-healing against stray rows from a previously failed run, for either
    // half of the couple — the SELECT policy returns own + partner.
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = new Date();
    const isoDate = isoDateDaysFromNow(30, anchor);

    // GIVEN / WHEN: an event created through the New event form with icon `ring`
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);
    await log.step(`Add "${ICON_LABEL}" through the New event form`);
    await addEventFromDatesList(
      page,
      interceptNetworkCall,
      { label: ICON_LABEL, date: isoDate, icon: 'ring' },
      anchor
    );

    // WHEN: the Dates list is reloaded, so the list can only come from the server
    await log.step('Reload /settings/dates so the list comes back from the server');
    // The reload is what makes this a real round trip. `addEvent` also wrote
    // the saved copy (`saveEventsCopy` in `eventsSlice.ts`), which renders
    // first after a reload, so the row is read only once the reload's own
    // server read has settled and replaced it — then it can only have come
    // from `eventsService.getEventsPage` and its row→CoupleEvent mapping.
    await reloadDatesList(page, interceptNetworkCall);

    const row = rowFor(page, ICON_LABEL);
    await expect(row).toBeVisible();
    await expect(row).toContainText(listDate(localDateFromIso(isoDate), anchor));

    // THEN: the event's page and its Icon field page carry the icon that was chosen
    await log.step('Open the event and read the icon back');
    await row.click();
    // The row reads `event.icon` off the store copy that the reload's fetch
    // produced — the assertion the CRUD spec stops short of, since it never
    // looks at the icon again after the submit.
    await expect(page.getByTestId('settings-event-icon')).toHaveAccessibleName('Icon, Ring');
    await page.getByTestId('settings-event-icon').click();
    await expect(page.getByRole('radio', { name: 'Ring' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Calendar' })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Plane' })).not.toBeChecked();

    // THEN: and Home renders that icon's own treatment
    await log.step("Home renders the ring icon's own treatment");
    await navigateTo(page, 'home');
    const card = page.getByTestId(ICON_CARD_TESTID);
    await expect(card).toBeVisible();

    // The card's icon is the one from `iconComponents` in
    // `EventCountdown.tsx`. `ring` selects lucide's `Gem`, which stamps
    // `lucide-gem` on the element. Colour no longer varies by icon (every
    // event tile is the kit tint/accent pair), so the glyph is the whole of
    // the icon's own treatment.
    const cardIcon = card.getByTestId('countdown-icon');
    await expect(cardIcon).toHaveClass(/lucide-gem/);
  });

  test('[P1] DE.5-E2E-005 rows render in server order after a reload, not in creation order', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = new Date();
    const lateDate = isoDateDaysFromNow(40, anchor);
    const soonDate = isoDateDaysFromNow(10, anchor);
    const midDate = isoDateDaysFromNow(25, anchor);

    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);

    // Created deliberately out of chronological order: late, then soon, then
    // mid. Creation order and `created_at` order therefore both disagree with
    // date order, so a list that echoed either would fail below.
    await addEventFromDatesList(page, interceptNetworkCall, { label: ORDER_LATE_LABEL, date: lateDate }, anchor);
    await addEventFromDatesList(page, interceptNetworkCall, { label: ORDER_SOON_LABEL, date: soonDate }, anchor);
    await addEventFromDatesList(page, interceptNetworkCall, { label: ORDER_MID_LABEL, date: midDate }, anchor);

    // WHEN: the Dates list is reloaded
    // THEN: the rows render in event_date order, not the order they were created in
    await log.step('Reload /settings/dates and read the rendered sequence');
    // After the reload the sequence is whatever `getEvents` returned:
    // `.order('event_date').order('created_at')` in Postgres, with no JS
    // comparator in the service (`eventsService.ts:255-268`).
    await reloadDatesList(page, interceptNetworkCall);
    const rows = page.getByTestId('settings-dates-events').locator('[data-testid^="settings-dates-event-"]');
    await expect(rows).toHaveCount(3);

    // Both assertions are ordered, element-by-element — the labels say which
    // row is where, and the dates say the sequence is ascending by
    // `event_date` rather than merely stable.
    const labels = [ORDER_SOON_LABEL, ORDER_MID_LABEL, ORDER_LATE_LABEL];
    const dates = [soonDate, midDate, lateDate];
    for (const [index, label] of labels.entries()) {
      await expect(rows.nth(index)).toContainText(label);
      await expect(rows.nth(index)).toContainText(listDate(localDateFromIso(dates[index]), anchor));
    }
  });
});

test.describe('Clearing an optional field', () => {
  test('[P2] DE.5-E2E-006 clearing a description writes null and removes it from the row and Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const anchor = new Date();
    const isoDate = isoDateDaysFromNow(18, anchor);

    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);
    await addEventFromDatesList(
      page,
      interceptNetworkCall,
      { label: DESCRIPTION_LABEL, date: isoDate, description: DESCRIPTION_TEXT },
      anchor
    );

    // GIVEN: the description is on the Home card
    await log.step('The description is on the Home card');
    const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await navigateTo(page, 'home');
    expect((await homeRead).status).toBe(200);
    const card = page.getByTestId(DESCRIPTION_CARD_TESTID);
    await expect(card).toBeVisible();
    await expect(card).toContainText(DESCRIPTION_TEXT);

    // WHEN: the user opens the event's Note page and clears the note
    // THEN: the PATCH carries an explicit null and the Note row drops its value
    await log.step('Open the event and clear the note');
    await returnToSettings(page);
    await openDatesList(page, interceptNetworkCall);
    await rowFor(page, DESCRIPTION_LABEL).click();
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName(`Note, ${DESCRIPTION_TEXT}`);
    await page.getByTestId('settings-event-note').click();

    await expect(page.getByTestId('settings-event-note-field')).toHaveValue(DESCRIPTION_TEXT);
    await page.getByTestId('settings-event-note-field').fill('');

    const updateCall = interceptNetworkCall({ method: 'PATCH', url: '**/rest/v1/events*' });
    await page.getByTestId('settings-field-save').click();

    const { status, requestJson } = await updateCall;
    expect(status).toBe(200);
    // The load-bearing half: `EventFieldPage` derives the field as
    // `value === '' ? null : value` and forwards it as `description`, so an
    // emptied box has to reach the wire as an explicit `null`. `undefined`
    // would be dropped by `updateEvent`'s `!== undefined` guards
    // (`eventsService.ts:394-397`) and the old text would survive the save.
    expect(requestJson).toMatchObject({ description: null });

    // Saving returns to the event page, whose Note row has no value left.
    await expect(page.getByTestId('settings-event-page')).toBeVisible();
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName('Note');

    // THEN: and the Home card no longer carries it
    await log.step('And the Home card no longer carries it');
    await navigateTo(page, 'home');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(DESCRIPTION_TEXT);
  });
});
