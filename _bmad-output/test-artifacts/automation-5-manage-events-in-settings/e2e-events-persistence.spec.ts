/**
 * tests/e2e/settings/events-persistence.spec.ts
 *
 * E2E: what an event still carries after the server hands it back.
 *
 * Story 5 (dynamic events), `automate` pass. Every row here is created through
 * the Settings form and then read back after a REAL reload, so each assertion
 * lands on `eventsService`'s row→`CoupleEvent` mapping and on the order
 * Postgres returned — not on the store copy the write left behind.
 *
 * - DE.5-E2E-004 [P1] the chosen icon survives the round trip, into the edit
 *   form's pre-fill and into the Home card's icon treatment
 *   (`EventCountdown.tsx:32-54` maps `ring` → `Gem` + amber)
 * - DE.5-E2E-005 [P1] rows render in server order after a reload —
 *   `eventsService.getEvents` delegates ordering entirely to Postgres and runs
 *   no JS comparator (`eventsService.ts:255-268`)
 * - DE.5-E2E-006 [P2] clearing a description writes `null` rather than leaving
 *   the field unwritten (`EventsSettings.tsx:172,544` vs `EventUpdateInput`'s
 *   "anything left `undefined` is not written", `eventsService.ts:90-97`), and
 *   both the row and the Home card drop it
 *
 * Complements `tests/e2e/settings/events-crud.spec.ts`, which owns the
 * add/edit/delete journey, the deep-link load, the past-event row, the
 * partner-owned row and the rejected write. Nothing here repeats those.
 * Validation, the dismissal guard and focus behaviour stay at component level
 * by design and are deliberately not lifted here.
 *
 * Test data: rows belong to THIS worker's pair only, keyed on
 * TEST_WORKER_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password is reset, no shared row is nulled — those rows belong
 * to other workers. `resolveOwnPair` / `clearPairEvents` / `clearOwnPairEvents`
 * come from `tests/support/helpers/events.ts`, which this automation run
 * extracted from the eight files that had hand-copied them.
 *
 * Nothing is stubbed, so no `skipNetworkMonitoring`: the merged fixtures'
 * network-error-monitor stays armed and a 4xx/5xx here is real signal.
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-persistence.spec.ts --project=chromium
 */
import { test, expect } from '../../support/merged-fixtures';
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
import { formatDateLong } from '../../../src/utils/dateUtils';
import { log } from '@seontechnologies/playwright-utils';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { Page } from '@playwright/test';

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

type EventIconValue = 'calendar' | 'ring' | 'plane';

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

function longForm(isoDate: string): string {
  // `localDateFromIso`, never `new Date(isoDate)` — the date-only string form is
  // parsed as UTC midnight and names the previous day west of UTC.
  return formatDateLong(localDateFromIso(isoDate));
}

/**
 * Create one event through the Settings form and wait for the write itself.
 *
 * The POST is observed with `interceptNetworkCall` declared BEFORE the submit
 * click (network-first), so the create is confirmed at the wire before any DOM
 * assertion runs. `events-crud.spec.ts:185,227,258` uses `page.waitForResponse`
 * for this — a recorded pre-existing deviation; the same file does it the
 * correct way at :414-426, which is what this follows.
 */
async function addEventThroughForm(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  input: { label: string; isoDate: string; description?: string; icon?: EventIconValue }
): Promise<void> {
  await log.step(`Add "${input.label}" through the Settings form`);

  await page.getByTestId('events-settings-add').click();
  await expect(page.getByTestId('events-form')).toBeVisible();

  await page.getByTestId('events-form-label').fill(input.label);
  await page.getByTestId('events-form-date').fill(input.isoDate);

  if (input.description !== undefined) {
    await page.getByTestId('events-form-description').fill(input.description);
  }

  if (input.icon !== undefined) {
    // The radio itself is sr-only; the styled label is the control a pointer
    // user actually hits, and it carries its own testid for exactly this.
    await page.getByTestId(`events-form-icon-option-${input.icon}`).click();
    await expect(page.getByTestId(`events-form-icon-${input.icon}`)).toBeChecked();
  }

  const createCall = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/events*' });
  await page.getByTestId('events-form-submit').click();

  const { status } = await createCall;
  expect(status).toBe(201);

  // The form closes only on a successful write, so its absence is the second
  // layer under the wire confirmation above.
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  await expect(rowFor(page, input.label)).toBeVisible();
}

/** Open Settings from a cold start, with the welcome splash already dismissed. */
async function openSettings(page: Page): Promise<void> {
  await page.goto('/');
  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching the Home and Settings specs.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
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

    const isoDate = isoDateDaysFromNow(30);

    // GIVEN / WHEN: an event created through the Settings form with icon `ring`
    await openSettings(page);
    await addEventThroughForm(page, interceptNetworkCall, {
      label: ICON_LABEL,
      isoDate,
      icon: 'ring',
    });

    // WHEN: the page is reloaded, so the list can only come from the server
    await log.step('Reload /settings so the list comes back from the server');
    await page.waitForURL('**/settings');
    // The reload is what makes this a real round trip: `events` is not
    // persisted, so after it the list can only have come from
    // `eventsService.getEvents` and its row→CoupleEvent mapping.
    await page.reload();
    await expect(page.getByTestId('settings-view')).toBeVisible();

    const row = rowFor(page, ICON_LABEL);
    await expect(row).toBeVisible();
    await expect(row).toContainText(longForm(isoDate));

    // THEN: the edit form pre-fills with the icon that was chosen
    await log.step('Re-open the edit form and read the icon back');
    await row.locator('[data-testid^="event-edit-"]').click();
    await expect(page.getByTestId('events-form')).toBeVisible();
    // The pre-fill reads `event.icon` off the store copy that the reload's
    // fetch produced — the assertion the CRUD spec stops short of, since it
    // checks the radio before the submit and never looks again.
    await expect(page.getByTestId('events-form-icon-ring')).toBeChecked();
    await expect(page.getByTestId('events-form-icon-calendar')).not.toBeChecked();
    await expect(page.getByTestId('events-form-icon-plane')).not.toBeChecked();

    // The form is a full-viewport overlay, so it has to go before the tray is
    // reachable again.
    await page.getByTestId('events-form-cancel').click();
    await expect(page.getByTestId('events-form')).toHaveCount(0);

    // THEN: and Home renders that icon's own treatment
    await log.step("Home renders the ring icon's own treatment");
    await navigateTo(page, 'home');
    const card = page.getByTestId(ICON_CARD_TESTID);
    await expect(card).toBeVisible();

    // The card holds exactly one svg — the icon from `iconComponents`
    // (`EventCountdown.tsx:32-36,209`). `ring` selects lucide's `Gem`, which
    // stamps `lucide-gem` on the element, and `iconColors.ring.text`
    // (`:38-43`) adds `text-amber-500`. Both classes come from the two maps
    // this test exists to pin, so the assertion fails for exactly the reason
    // that matters: the wrong icon, or the wrong colour band.
    const cardIcon = card.locator('svg');
    await expect(cardIcon).toHaveClass(/lucide-gem/);
    await expect(cardIcon).toHaveClass(/text-amber-500/);
  });

  test('[P1] DE.5-E2E-005 rows render in server order after a reload, not in creation order', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    const lateDate = isoDateDaysFromNow(40);
    const soonDate = isoDateDaysFromNow(10);
    const midDate = isoDateDaysFromNow(25);

    await openSettings(page);

    // Created deliberately out of chronological order: late, then soon, then
    // mid. Creation order and `created_at` order therefore both disagree with
    // date order, so a list that echoed either would fail below.
    await addEventThroughForm(page, interceptNetworkCall, {
      label: ORDER_LATE_LABEL,
      isoDate: lateDate,
    });
    await addEventThroughForm(page, interceptNetworkCall, {
      label: ORDER_SOON_LABEL,
      isoDate: soonDate,
    });
    await addEventThroughForm(page, interceptNetworkCall, {
      label: ORDER_MID_LABEL,
      isoDate: midDate,
    });

    // WHEN: the page is reloaded
    // THEN: the rows render in event_date order, not the order they were created in
    await log.step('Reload /settings and read the rendered sequence');
    await page.waitForURL('**/settings');
    // After the reload the sequence is whatever `getEvents` returned:
    // `.order('event_date').order('created_at')` in Postgres, with no JS
    // comparator in the service (`eventsService.ts:255-268`).
    await page.reload();
    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(3);

    // Both assertions are ordered, element-by-element — the labels say which
    // row is where, and the dates say the sequence is ascending by
    // `event_date` rather than merely stable.
    await expect(page.locator('[data-testid^="event-label-"]')).toHaveText([
      ORDER_SOON_LABEL,
      ORDER_MID_LABEL,
      ORDER_LATE_LABEL,
    ]);
    await expect(page.locator('[data-testid^="event-date-"]')).toHaveText([
      longForm(soonDate),
      longForm(midDate),
      longForm(lateDate),
    ]);
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

    const isoDate = isoDateDaysFromNow(18);

    await openSettings(page);
    await addEventThroughForm(page, interceptNetworkCall, {
      label: DESCRIPTION_LABEL,
      isoDate,
      description: DESCRIPTION_TEXT,
    });

    const createdRow = rowFor(page, DESCRIPTION_LABEL);
    await expect(createdRow.locator('[data-testid^="event-description-"]')).toHaveText(
      DESCRIPTION_TEXT
    );

    // GIVEN: the description is on the row and on the Home card
    await log.step('The description is on the Home card too');
    await navigateTo(page, 'home');
    const card = page.getByTestId(DESCRIPTION_CARD_TESTID);
    await expect(card).toBeVisible();
    await expect(card).toContainText(DESCRIPTION_TEXT);

    // WHEN: the user edits the event and clears the description
    // THEN: the PATCH carries an explicit null and the row drops the element
    await log.step('Edit the event and clear the description');
    await navigateTo(page, 'settings');
    const rowToEdit = rowFor(page, DESCRIPTION_LABEL);
    await expect(rowToEdit).toBeVisible();
    await rowToEdit.locator('[data-testid^="event-edit-"]').click();

    await expect(page.getByTestId('events-form')).toBeVisible();
    await expect(page.getByTestId('events-form-description')).toHaveValue(DESCRIPTION_TEXT);
    await page.getByTestId('events-form-description').fill('');

    const updateCall = interceptNetworkCall({ method: 'PATCH', url: '**/rest/v1/events*' });
    await page.getByTestId('events-form-submit').click();

    const { status, requestJson } = await updateCall;
    expect(status).toBe(200);
    // The load-bearing half: `EventsSettings.tsx:544` derives the field as
    // `trimmedDescription || null` and `:172` forwards it as
    // `input.description ?? null`, so an emptied box has to reach the wire as
    // an explicit `null`. `undefined` would be dropped by `updateEvent`'s
    // `!== undefined` guards (`eventsService.ts:394-397`) and the old text
    // would survive the save.
    expect(requestJson).toMatchObject({ description: null });

    await expect(page.getByTestId('events-form')).toHaveCount(0);

    const clearedRow = rowFor(page, DESCRIPTION_LABEL);
    await expect(clearedRow).toBeVisible();
    // The paragraph is rendered only when `event.description` is truthy
    // (`EventsSettings.tsx:332`), so its absence is the row half of the answer.
    await expect(clearedRow.locator('[data-testid^="event-description-"]')).toHaveCount(0);

    // THEN: and the Home card no longer carries it
    await log.step('And the Home card no longer carries it');
    await navigateTo(page, 'home');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(DESCRIPTION_TEXT);
  });
});
