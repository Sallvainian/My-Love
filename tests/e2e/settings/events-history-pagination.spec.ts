/** Real Settings pagination, including dates saved beyond its initial history window. */
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { eventDateFrom } from '../../support/factories/events';
import { navigateTo } from '../../support/helpers/navigation';
import { EVENTS_WRITE, UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { reloadSettings, settingsEventsLoaded } from '../../support/helpers/settings-screen';

/** Rows read per window and per load-more page. */
const PAGE_SIZE = 50; // src/services/eventsService.ts DEFAULT_EVENTS_PAGE_SIZE (module-private)

/**
 * Day offsets older than every seeded history row (the oldest sits
 * PAGE_SIZE + 1 days back), so a row saved there always sorts beyond the first
 * page and is reached only through load-more.
 */
const DEEP_PAST_EDIT_DAYS = -500;
const DEEP_PAST_ADD_DAYS = -1000;

/** The row test id prefix before the event's uuid (`event-row-<id>`). */
const ROW_PREFIX = 'event-row-';
/** Every history row, by the prefix its test id starts with. */
const ALL_ROWS = `[data-testid^="${ROW_PREFIX}"]`;
const rowTestId = (id: string) => `${ROW_PREFIX}${id}`;

/** Home's countdown card cap: src/App.tsx HOME_MAX_EVENT_CARDS (module-private). */
const HOME_MAX_EVENT_CARDS = 6;

const history = (size: number) => Array.from({ length: size }, (_, index) => ({
  dayOffset: -(index + 1),
  label: `Paged history ${String(index + 1).padStart(2, '0')}`,
}));

async function openSettings(page: Page, interceptNetworkCall: InterceptNetworkCallFn) {
  const settingsRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.goto('/settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await settingsEventsLoaded(page, settingsRead);
}

/** A load-more read: only it carries the `or=` cursor filter (`eventsService.getEventsPage`). */
const HISTORY_PAGE_READ = '**/rest/v1/events?*&or=*';

async function loadHistory(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  expectedCount: number
) {
  const response = interceptNetworkCall({ method: 'GET', url: HISTORY_PAGE_READ });
  await page.getByTestId('events-settings-load-more').click();
  expect((await response).status).toBe(200);
  await recurseUntil(
    () => page.evaluate(() => window.__APP_STORE__!.getState().events.length),
    (v) => {
      expect(v).toBe(expectedCount);
    }
  );
  await expect(page.locator(ALL_ROWS)).toHaveCount(expectedCount);
}

/** The status PostgREST answers each write with: 201 for an insert, 200 for an update. */
const SUCCESS_STATUS = { POST: 201, PATCH: 200 } as const;

async function submitEvent(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  method: keyof typeof SUCCESS_STATUS,
  label: string
) {
  const response = interceptNetworkCall({ method, url: EVENTS_WRITE });
  await page.getByTestId('events-form-submit').click();
  const reply = await response;
  expect(reply.status).toBe(SUCCESS_STATUS[method]);
  const body = reply.responseJson as { id: string } | { id: string }[];
  const saved = Array.isArray(body) ? body[0] : body;
  expect(saved.id).toBeTruthy();
  await recurseUntil(
    () => page.evaluate((id) =>
      window.__APP_STORE__!.getState().events.find((event) => event.id === id)?.label,
    saved.id),
    (v) => {
      expect(v).toBe(label);
    }
  );
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  await expect(page.getByTestId(`event-label-${saved.id}`)).toHaveText(label);
  return saved.id;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lastWelcomeView', String(Date.now())));
});

test('[P0] loads and edits omitted history, then finds the saved deep date after reload', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
}) => {
  // One past row more than the first page holds, plus one upcoming row.
  const pastRows = history(PAGE_SIZE + 1);
  const seeded = await coupleEvents.seed([
    ...pastRows,
    { dayOffset: 7, label: 'Paging upcoming survivor' },
  ]);
  const oldest = seeded[pastRows.length - 1];
  const correctedDate = eventDateFrom(coupleEvents.anchor, DEEP_PAST_EDIT_DAYS);
  // The first page of history plus the upcoming survivor.
  const firstLoad = PAGE_SIZE + 1;
  await openSettings(page, interceptNetworkCall);
  await expect(page.locator(ALL_ROWS)).toHaveCount(firstLoad);
  await expect(page.getByTestId(rowTestId(oldest.id))).toHaveCount(0);
  await expect(page.getByTestId('events-settings-history-notice')).toBeVisible();

  await loadHistory(page, interceptNetworkCall, seeded.length);
  await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
  await page.getByTestId(`event-edit-${oldest.id}`).click();
  await expect(page.getByTestId('events-form-date')).toHaveValue(oldest.eventDate);
  await page.getByTestId('events-form-label').fill('Corrected deep history');
  await page.getByTestId('events-form-date').fill(correctedDate);
  await submitEvent(page, interceptNetworkCall, 'PATCH', 'Corrected deep history');

  await reloadSettings(page, interceptNetworkCall);
  await expect(page.locator(ALL_ROWS)).toHaveCount(firstLoad);
  await expect(page.getByTestId(rowTestId(oldest.id))).toHaveCount(0);
  await loadHistory(page, interceptNetworkCall, seeded.length);
  await page.getByTestId(`event-edit-${oldest.id}`).click();
  await expect(page.getByTestId('events-form-label')).toHaveValue('Corrected deep history');
  await expect(page.getByTestId('events-form-date')).toHaveValue(correctedDate);
  await page.getByTestId('events-form-label').fill('Edited history again');
  await submitEvent(page, interceptNetworkCall, 'PATCH', 'Edited history again');

  await navigateTo(page, 'home');
  await expect(page.getByTestId('event-countdown-paging-upcoming-survivor')).toBeVisible();
  await expect(page.getByTestId('event-countdown-edited-history-again')).toHaveCount(0);
});

test('[P0] adds a deep-past date and can load and edit it again after each reload', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
}) => {
  const seeded = await coupleEvents.seed(history(PAGE_SIZE + 1));
  const savedDate = eventDateFrom(coupleEvents.anchor, DEEP_PAST_ADD_DAYS);
  // Every seeded row plus the one this test adds.
  const allRows = seeded.length + 1;
  await openSettings(page, interceptNetworkCall);
  await page.getByTestId('events-settings-add').click();
  await page.getByTestId('events-form-label').fill('New deep-past event');
  await page.getByTestId('events-form-date').fill(savedDate);
  await page.getByTestId('events-form-description').fill('Saved outside the first page');
  const id = await submitEvent(page, interceptNetworkCall, 'POST', 'New deep-past event');

  await reloadSettings(page, interceptNetworkCall);
  await expect(page.locator(ALL_ROWS)).toHaveCount(PAGE_SIZE);
  await expect(page.getByTestId(rowTestId(id))).toHaveCount(0);
  await loadHistory(page, interceptNetworkCall, allRows);
  await page.getByTestId(`event-edit-${id}`).click();
  await expect(page.getByTestId('events-form-date')).toHaveValue(savedDate);
  await expect(page.getByTestId('events-form-description'))
    .toHaveValue('Saved outside the first page');
  await page.getByTestId('events-form-label').fill('Deep-past event edited');
  await submitEvent(page, interceptNetworkCall, 'PATCH', 'Deep-past event edited');

  await reloadSettings(page, interceptNetworkCall);
  await expect(page.locator(ALL_ROWS)).toHaveCount(PAGE_SIZE);
  await loadHistory(page, interceptNetworkCall, allRows);
  await page.getByTestId(`event-edit-${id}`).click();
  await expect(page.getByTestId('events-form-label')).toHaveValue('Deep-past event edited');
  await expect(page.getByTestId('events-form-date')).toHaveValue(savedDate);
});

for (const { size, rows, empty } of [
  { size: 0, rows: 0, empty: 1 },
  { size: PAGE_SIZE, rows: PAGE_SIZE, empty: 0 },
]) {
  test(`[P1] ${size} past rows do not advertise another page`, async ({
    page,
    coupleEvents,
    interceptNetworkCall,
  }) => {
    await coupleEvents.seed(history(size));
    await openSettings(page, interceptNetworkCall);
    await expect(page.locator(ALL_ROWS)).toHaveCount(rows);
    await expect(page.getByTestId('events-settings-empty')).toHaveCount(empty);
    await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
    await expect(page.getByTestId('events-settings-history-notice')).toHaveCount(0);
  });
}

test('[P1] tied dates and microseconds stay ordered through repeated pages and Home keeps six nearest cards', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
}) => {
  // Each window spans three pages. Most timestamps form tied pairs; singleton
  // ends put pairs across both PAGE_SIZE-row boundaries. Every instant is in
  // the same millisecond, so Date conversion alone cannot preserve this order.
  // Rows per window: two full pages and four more on a third.
  const windowRows = 2 * PAGE_SIZE + 4;
  const specs = Array.from({ length: 2 * windowRows }, (_, index) => ({
    dayOffset: index < windowRows ? -10 : 10,
    label: `Tied paging ${index}`,
    createdAt: `2026-01-01T12:00:00.123${String(Math.floor(((index % windowRows) + 1) / 2)).padStart(3, '0')}Z`,
    owner: index % 2 ? 'partner' as const : 'self' as const,
  }));
  const seeded = await coupleEvents.seed(specs);
  const expected = seeded.map((row, index) => ({ ...row, createdAt: specs[index].createdAt }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) ||
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  await openSettings(page, interceptNetworkCall);
  // One page per window on open, a second per window after one load-more.
  await expect(page.locator(ALL_ROWS)).toHaveCount(2 * PAGE_SIZE);
  await loadHistory(page, interceptNetworkCall, 4 * PAGE_SIZE);
  await expect(page.getByTestId('events-settings-load-more')).toBeEnabled();
  await expect(page.getByTestId('events-settings-history-notice')).toBeVisible();
  await loadHistory(page, interceptNetworkCall, specs.length);
  await expect(page.getByTestId('events-settings-load-more')).toHaveCount(0);
  const actualIds = await page.locator(ALL_ROWS)
    .evaluateAll((rows, prefix) =>
      rows.map((row) => row.getAttribute('data-testid')!.slice(prefix.length)), ROW_PREFIX);
  expect(actualIds).toEqual(expected.map((row) => row.id));
  // Premises: the first seeded row is this account's own, the second its partner's.
  const [own, partner] = seeded;
  expect(own.ownerId).toBe(coupleEvents.userId);
  expect(partner.ownerId).toBe(coupleEvents.partnerId);
  await expect(page.getByTestId(`event-edit-${own.id}`)).toHaveCount(1);
  await expect(page.getByTestId(`event-edit-${partner.id}`)).toHaveCount(0);

  const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await navigateTo(page, 'home');
  expect((await homeRead).status).toBe(200);
  await recurseUntil(
    () => page.evaluate(() => ({
      loading: window.__APP_STORE__!.getState().eventsIsLoading,
      count: window.__APP_STORE__!.getState().events.length,
    })),
    (v) => {
      expect(v).toEqual({ loading: false, count: 2 * PAGE_SIZE });
    }
  );
  const cards = page.getByTestId(/^event-countdown-tied-paging-\d+$/);
  await expect(cards).toHaveCount(HOME_MAX_EVENT_CARDS);
  await expect(cards.locator('h3')).toHaveText(expected.filter((row) =>
    row.eventDate === seeded[windowRows].eventDate
  ).slice(0, HOME_MAX_EVENT_CARDS).map((row) => row.label));
});

test('[P1] restores Chromium keyboard focus to history retry and then Add after the final page', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
}) => {
  const seeded = await coupleEvents.seed(history(PAGE_SIZE + 1));
  await openSettings(page, interceptNetworkCall);
  let releaseFailure!: () => void;
  const failureGate = new Promise<void>((resolve) => { releaseFailure = resolve; });
  let shouldFail = true;
  // playwright-utils deviation: the route must be installed before the load-more press sends the read, hold it on a gate, abort it and pass every other events request through; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route('**/rest/v1/events*', async (route) => {
    const request = route.request();
    if (shouldFail && request.method() === 'GET' && new URL(request.url()).searchParams.has('or')) {
      await failureGate;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  const button = page.getByTestId('events-settings-load-more');
  const failedRequest = page.waitForEvent('requestfailed', {
    predicate: (request) => new URL(request.url()).pathname.endsWith('/rest/v1/events'),
  });
  await button.focus();
  await button.press('Enter');
  await expect(button).toBeDisabled();
  // Confirm the browser blur that happy-dom misses before allowing settlement.
  await expect(page.locator('body')).toBeFocused();
  releaseFailure();
  await failedRequest;
  await recurseUntil(
    () => page.evaluate(() => ({
      loading: window.__APP_STORE__!.getState().eventsIsLoadingMore,
      failed: Boolean(window.__APP_STORE__!.getState().eventsHistoryError),
      count: window.__APP_STORE__!.getState().events.length,
    })),
    (v) => {
      expect(v).toEqual({ loading: false, failed: true, count: PAGE_SIZE });
    }
  );
  await expect(button).toHaveText('Retry loading history');
  await expect(button).toBeFocused();

  shouldFail = false;
  await loadHistory(page, interceptNetworkCall, seeded.length);
  await expect(button).toHaveCount(0);
  await expect(page.getByTestId('events-settings-add')).toBeFocused();
});
