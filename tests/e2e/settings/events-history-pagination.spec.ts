/**
 * Real Dates list pagination, including dates saved beyond its initial history
 * window.
 *
 * The Dates list holds a paged window of events: its mount read brings the
 * first page on each side of today, and the `Load more` row that ends Past
 * appends the next page of both. A row is reached by its own page
 * (`dates/event/<id>`), so an edit of a deep row is made on a field page.
 *
 * Two cases from the old Countdowns-era suite are not here. The "Edit only on
 * this account's own events" case is `event-pages.spec.ts` (a partner's event
 * opens read-only), and the Chromium keyboard-focus case restored focus to a
 * history Retry control and the empty-state Add control, neither of which
 * exists on the Dates list (a failed `Load more` shows the Error box and leaves
 * the row where it was); the owner uses no keyboard.
 */
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { eventDateFrom, type SeededEvent } from '../../support/factories/events';
import { navigateTo } from '../../support/helpers/navigation';
import { EVENTS_PAGE_SIZE, localDateFromIso } from '../../support/helpers/events';
import { listDate } from '../../support/helpers/dates-list-format';
import { fillNewEventForm, openNewEventForm } from '../../support/helpers/new-date-forms';
import {
  EVENT_BY_ID_READ,
  EVENTS_WRITE,
  HISTORY_PAGE_READ,
  UPCOMING_EVENTS_READ,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { reloadDatesList } from '../../support/helpers/settings-screen';

/**
 * Day offsets older than every seeded history row (the oldest sits
 * EVENTS_PAGE_SIZE + 1 days back), so a row saved there always sorts beyond the first
 * page and is reached only through load-more.
 */
const DEEP_PAST_EDIT_DAYS = -500;
const DEEP_PAST_ADD_DAYS = -1000;

/** The row test id prefix before the event's uuid (`settings-dates-event-<id>`). */
const ROW_PREFIX = 'settings-dates-event-';
/** Every event row on the Dates list (the group cards are `settings-dates-events`, with an `s`). */
const ALL_ROWS = `[data-testid^="${ROW_PREFIX}"]`;
const rowTestId = (id: string) => `${ROW_PREFIX}${id}`;

/** Home's countdown card cap: src/App.tsx HOME_MAX_EVENT_CARDS (module-private). */
const HOME_MAX_EVENT_CARDS = 6;

const history = (size: number) => Array.from({ length: size }, (_, index) => ({
  dayOffset: -(index + 1),
  label: `Paged history ${String(index + 1).padStart(2, '0')}`,
}));

/** A fresh load of `/settings/dates`, returned once the list's own events read has answered. */
async function openDates(page: Page, interceptNetworkCall: InterceptNetworkCallFn) {
  const datesRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.goto('/settings/dates');
  await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
  expect((await datesRead).status).toBe(200);
}

async function loadHistory(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  expectedCount: number
) {
  const response = interceptNetworkCall({ method: 'GET', url: HISTORY_PAGE_READ });
  await page.getByTestId('settings-dates-load-more').click();
  expect((await response).status).toBe(200);
  await recurseUntil(
    () => page.evaluate(() => window.__APP_STORE__!.getState().events.length),
    (v) => {
      expect(v).toBe(expectedCount);
    }
  );
  await expect(page.locator(ALL_ROWS)).toHaveCount(expectedCount);
}

/** The id of the event the store holds under `label`. */
const idOf = (page: Page, label: string) =>
  page.evaluate(
    (wanted) => window.__APP_STORE__!.getState().events.find((event) => event.label === wanted)?.id,
    label
  );

/**
 * Saves the open one-field page and waits for the write itself: the PATCH is
 * observed with `interceptNetworkCall` declared BEFORE the Save tap, and the
 * store must then hold the event's new `label` (checked by id from the reply).
 * Returns once the event page is back.
 */
async function saveField(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  expectedLabel?: string
) {
  const response = interceptNetworkCall({ method: 'PATCH', url: EVENTS_WRITE });
  await page.getByTestId('settings-field-save').click();
  const reply = await response;
  expect(reply.status).toBe(200);
  const body = reply.responseJson as { id: string } | { id: string }[];
  const saved = Array.isArray(body) ? body[0] : body;
  expect(saved.id).toBeTruthy();
  if (expectedLabel !== undefined) {
    await recurseUntil(
      () => page.evaluate((id) =>
        window.__APP_STORE__!.getState().events.find((event) => event.id === id)?.label,
      saved.id),
      (v) => {
        expect(v).toBe(expectedLabel);
      }
    );
  }
  await expect(page.getByTestId('settings-event-page')).toBeVisible();
  return saved.id;
}

/** Opens a loaded row's event page, then one of its field pages. */
async function openRowField(page: Page, id: string, field: 'name' | 'date' | 'note') {
  await page.getByTestId(rowTestId(id)).click();
  await expect(page.getByTestId('settings-event-page')).toBeVisible();
  await page.getByTestId(`settings-event-${field}`).click();
  await expect(page.getByTestId(`settings-event-${field}-page`)).toBeVisible();
}

/**
 * Two windows (past and upcoming) of tied rows, each spanning three pages.
 * Most timestamps form tied pairs; singleton ends put pairs across both
 * EVENTS_PAGE_SIZE-row boundaries. Every instant is in the same millisecond, so Date
 * conversion alone cannot preserve this order.
 */
function tiedSpecs() {
  // Rows per window: two full pages and four more on a third.
  const windowRows = 2 * EVENTS_PAGE_SIZE + 4;
  const specs = Array.from({ length: 2 * windowRows }, (_, index) => ({
    dayOffset: index < windowRows ? -10 : 10,
    label: `Tied paging ${index}`,
    createdAt: `2026-01-01T12:00:00.123${String(Math.floor(((index % windowRows) + 1) / 2)).padStart(3, '0')}Z`,
    owner: index % 2 ? 'partner' as const : 'self' as const,
  }));
  return { windowRows, specs };
}

/** The seeded rows in the store's order: date, then creation instant, then id. */
function expectedOrder(seeded: SeededEvent[], specs: { createdAt: string }[]) {
  return seeded.map((row, index) => ({ ...row, createdAt: specs[index].createdAt }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) ||
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * The Dates list's row order for tied rows: the Events group (upcoming, in the
 * store's order), then Past (the past rows reversed, newest first).
 */
function listOrder(expected: ReturnType<typeof expectedOrder>, todayIso: string) {
  return [
    ...expected.filter((row) => row.eventDate >= todayIso),
    ...expected.filter((row) => row.eventDate < todayIso).reverse(),
  ];
}

/** Open the Dates list and load every page of the tied history until load-more is gone. */
async function pageThroughTiedHistory(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  total: number
) {
  await openDates(page, interceptNetworkCall);
  // One page per window on open, a second per window after one load-more.
  await expect(page.locator(ALL_ROWS)).toHaveCount(2 * EVENTS_PAGE_SIZE);
  await loadHistory(page, interceptNetworkCall, 4 * EVENTS_PAGE_SIZE);
  await expect(page.getByTestId('settings-dates-load-more')).toBeEnabled();
  await loadHistory(page, interceptNetworkCall, total);
  await expect(page.getByTestId('settings-dates-load-more')).toHaveCount(0);
}

test.describe('Dates list events history pagination', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] loads and edits omitted history, then finds the saved deep date after reload', async ({
    page,
    coupleEvents,
    interceptNetworkCall,
  }) => {
    // One past row more than the first page holds, plus one upcoming row.
    const pastRows = history(EVENTS_PAGE_SIZE + 1);
    const seeded = await coupleEvents.seed([
      ...pastRows,
      { dayOffset: 7, label: 'Paging upcoming survivor' },
    ]);
    const oldest = seeded[pastRows.length - 1];
    const correctedDate = eventDateFrom(coupleEvents.anchor, DEEP_PAST_EDIT_DAYS);
    // The first page of history plus the upcoming survivor.
    const firstLoad = EVENTS_PAGE_SIZE + 1;
    await openDates(page, interceptNetworkCall);
    await expect(page.locator(ALL_ROWS)).toHaveCount(firstLoad);
    await expect(page.getByTestId(rowTestId(oldest.id))).toHaveCount(0);

    await loadHistory(page, interceptNetworkCall, seeded.length);
    await expect(page.getByTestId('settings-dates-load-more')).toHaveCount(0);
    await openRowField(page, oldest.id, 'name');
    await page.getByTestId('settings-event-name-field').fill('Corrected deep history');
    await saveField(page, interceptNetworkCall, 'Corrected deep history');
    await page.getByTestId('settings-event-date').click();
    await expect(page.getByTestId('settings-event-date-field')).toHaveValue(oldest.eventDate);
    await page.getByTestId('settings-event-date-field').fill(correctedDate);
    await saveField(page, interceptNetworkCall);

    // Back on the Dates list, then a reload brings only the first page again.
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await reloadDatesList(page, interceptNetworkCall);
    await expect(page.locator(ALL_ROWS)).toHaveCount(firstLoad);
    await expect(page.getByTestId(rowTestId(oldest.id))).toHaveCount(0);
    await loadHistory(page, interceptNetworkCall, seeded.length);
    await openRowField(page, oldest.id, 'name');
    await expect(page.getByTestId('settings-event-name-field')).toHaveValue('Corrected deep history');
    await page.getByTestId('settings-event-name-field').fill('Edited history again');
    await saveField(page, interceptNetworkCall, 'Edited history again');
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(correctedDate), new Date())}`
    );

    await navigateTo(page, 'home');
    await expect(page.getByTestId('event-countdown-paging-upcoming-survivor')).toBeVisible();
    await expect(page.getByTestId('event-countdown-edited-history-again')).toHaveCount(0);
  });

  test('[P0] adds a deep-past date and can load and edit it again after each reload', async ({
    page,
    coupleEvents,
    interceptNetworkCall,
  }) => {
    const seeded = await coupleEvents.seed(history(EVENTS_PAGE_SIZE + 1));
    const savedDate = eventDateFrom(coupleEvents.anchor, DEEP_PAST_ADD_DAYS);
    // Every seeded row plus the one this test adds.
    const allRows = seeded.length + 1;
    await openDates(page, interceptNetworkCall);
    // Add returns to the Dates list, which keeps the window it holds rather than
    // reloading the first one, so the new row stays listed although it is older
    // than that window's last row. Every events load raises `eventsIsLoading` in
    // the same tick it starts, so a count of those rises from here on proves the
    // return started none.
    await page.evaluate(() => {
      const store = window.__APP_STORE__!;
      const counter = window as unknown as { __eventsLoads: number; __stopCounting: () => void };
      counter.__eventsLoads = 0;
      counter.__stopCounting = store.subscribe((state, previous) => {
        if (state.eventsIsLoading && !previous.eventsIsLoading) counter.__eventsLoads += 1;
      });
    });
    await openNewEventForm(page);
    await fillNewEventForm(page, {
      label: 'New deep-past event',
      date: savedDate,
      description: 'Saved outside the first page',
    });
    const created = interceptNetworkCall({ method: 'POST', url: EVENTS_WRITE });
    await page.getByTestId('settings-form-add').click();
    expect((await created).status).toBe(201);
    await expect(page).toHaveURL(/\/settings\/dates$/);
    const id = (await idOf(page, 'New deep-past event'))!;
    expect(id).toBeTruthy();
    await expect(page.getByTestId(rowTestId(id))).toContainText('New deep-past event');
    await expect(page.locator(ALL_ROWS)).toHaveCount(EVENTS_PAGE_SIZE + 1);
    const loadsOnReturn = await page.evaluate(() => {
      const counter = window as unknown as { __eventsLoads: number; __stopCounting: () => void };
      counter.__stopCounting();
      return counter.__eventsLoads;
    });
    expect(loadsOnReturn).toBe(0);
    await loadHistory(page, interceptNetworkCall, allRows);

    await reloadDatesList(page, interceptNetworkCall);
    await expect(page.locator(ALL_ROWS)).toHaveCount(EVENTS_PAGE_SIZE);
    await expect(page.getByTestId(rowTestId(id))).toHaveCount(0);
    await loadHistory(page, interceptNetworkCall, allRows);
    await page.getByTestId(rowTestId(id)).click();
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(savedDate), new Date())}`
    );
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName(
      'Note, Saved outside the first page'
    );
    await page.getByTestId('settings-event-name').click();
    await page.getByTestId('settings-event-name-field').fill('Deep-past event edited');
    await saveField(page, interceptNetworkCall, 'Deep-past event edited');

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await reloadDatesList(page, interceptNetworkCall);
    await expect(page.locator(ALL_ROWS)).toHaveCount(EVENTS_PAGE_SIZE);
    await loadHistory(page, interceptNetworkCall, allRows);
    await page.getByTestId(rowTestId(id)).click();
    await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName(
      'Name, Deep-past event edited'
    );
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(savedDate), new Date())}`
    );
  });

  for (const { size, rows } of [
    { size: 0, rows: 0 },
    { size: EVENTS_PAGE_SIZE, rows: EVENTS_PAGE_SIZE },
  ]) {
    test(`[P1] ${size} past rows do not advertise another page`, async ({
      page,
      coupleEvents,
      interceptNetworkCall,
    }) => {
      await coupleEvents.seed(history(size));
      await openDates(page, interceptNetworkCall);
      await expect(page.locator(ALL_ROWS)).toHaveCount(rows);
      await expect(page.getByTestId('settings-dates-load-more')).toHaveCount(0);
    });
  }

  test('[P1] tied dates and microseconds stay ordered through repeated Dates list pages', async ({
    page,
    coupleEvents,
    interceptNetworkCall,
  }) => {
    const { specs } = tiedSpecs();
    const seeded = await coupleEvents.seed(specs);
    const expected = listOrder(expectedOrder(seeded, specs), eventDateFrom(coupleEvents.anchor, 0));
    await pageThroughTiedHistory(page, interceptNetworkCall, specs.length);
    await recurseUntil(
      () => page.locator(ALL_ROWS)
        .evaluateAll((rows, prefix) =>
          rows.map((row) => row.getAttribute('data-testid')!.slice(prefix.length)), ROW_PREFIX),
      (actualIds) => {
        expect(actualIds).toEqual(expected.map((row) => row.id));
      }
    );
  });

  test('[P1] Home keeps the six nearest of many tied upcoming cards after paging history', async ({
    page,
    coupleEvents,
    interceptNetworkCall,
  }) => {
    const { windowRows, specs } = tiedSpecs();
    const seeded = await coupleEvents.seed(specs);
    const expected = expectedOrder(seeded, specs);
    // Paged first, so the store holds every row when Home re-reads at that depth.
    await pageThroughTiedHistory(page, interceptNetworkCall, specs.length);

    const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await navigateTo(page, 'home');
    expect((await homeRead).status).toBe(200);
    await recurseUntil(
      () => page.evaluate(() => ({
        loading: window.__APP_STORE__!.getState().eventsIsLoading,
        count: window.__APP_STORE__!.getState().events.length,
      })),
      (v) => {
        // Home's load keeps the depth the Dates list paged to: every row stays.
        expect(v).toEqual({ loading: false, count: specs.length });
      }
    );
    const cards = page.getByTestId(/^event-countdown-tied-paging-\d+$/);
    await expect(cards).toHaveCount(HOME_MAX_EVENT_CARDS);
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText(expected.filter((row) =>
      row.eventDate === seeded[windowRows].eventDate
    ).slice(0, HOME_MAX_EVENT_CARDS).map((row) => row.label));
  });

  test.describe('a refresh keeps the Load more depth', () => {
    /**
     * The connection drops, then returns, the way App's `online`/`offline`
     * listeners and `isOnline()` see it. Only `navigator.onLine` moves: really
     * cutting the context offline corrupts Playwright's trace recording, which
     * a describe group cannot switch off (events-load-recovery.spec.ts does it
     * for its whole file).
     */
    const setBrowserOnline = (page: Page, online: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(navigator, 'onLine', { value, configurable: true });
        window.dispatchEvent(new Event(value ? 'online' : 'offline'));
      }, online);
    const dropConnection = (page: Page) => setBrowserOnline(page, false);
    const restoreConnection = (page: Page) => setBrowserOnline(page, true);

    test('[P1] a reconnect refresh keeps every row Load more reached and adds a row seeded meanwhile', async ({
      page,
      coupleEvents,
      interceptNetworkCall,
    }) => {
      const pastRows = history(EVENTS_PAGE_SIZE + 1);
      const seeded = await coupleEvents.seed([
        ...pastRows,
        { dayOffset: 7, label: 'Paging upcoming survivor' },
      ]);
      await openDates(page, interceptNetworkCall);
      await expect(page.locator(ALL_ROWS)).toHaveCount(EVENTS_PAGE_SIZE + 1);
      await loadHistory(page, interceptNetworkCall, seeded.length);

      // A past row the list cannot know about yet.
      const [late] = await coupleEvents.seed([
        { dayOffset: -(EVENTS_PAGE_SIZE + 5), label: 'Seeded while away' },
      ]);
      await dropConnection(page);

      const refresh = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
      await restoreConnection(page);
      expect((await refresh).status).toBe(200);

      const everyRow = seeded.length + 1;
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__!.getState().events.length),
        (v) => {
          expect(v).toBe(everyRow);
        }
      );
      await expect(page.locator(ALL_ROWS)).toHaveCount(everyRow);
      await expect(page.getByTestId(rowTestId(late.id))).toBeVisible();
      for (const row of seeded) {
        await expect(page.getByTestId(rowTestId(row.id))).toBeVisible();
      }
    });

    test('[P1] going Back from an event page after a reconnect keeps every row Load more reached', async ({
      page,
      coupleEvents,
      interceptNetworkCall,
    }) => {
      const pastRows = history(EVENTS_PAGE_SIZE + 1);
      const seeded = await coupleEvents.seed([
        ...pastRows,
        { dayOffset: 7, label: 'Paging upcoming survivor' },
      ]);
      const oldest = seeded[pastRows.length - 1];
      await openDates(page, interceptNetworkCall);
      await loadHistory(page, interceptNetworkCall, seeded.length);

      await page.getByTestId(rowTestId(oldest.id)).click();
      await expect(page.getByTestId('settings-event-page')).toBeVisible();

      // The event page holds its event, so it asks nothing; the reconnect only
      // marks the list stale, and the Dates list asks when the person returns.
      await dropConnection(page);
      await restoreConnection(page);
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__!.getState().eventsStale),
        (v) => {
          expect(v).toBe(true);
        }
      );

      const refresh = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page).toHaveURL(/\/settings\/dates$/);
      expect((await refresh).status).toBe(200);

      await recurseUntil(
        () => page.evaluate(() => {
          const state = window.__APP_STORE__!.getState();
          return { stale: state.eventsStale, loading: state.eventsIsLoading, count: state.events.length };
        }),
        (v) => {
          expect(v).toEqual({ stale: false, loading: false, count: seeded.length });
        }
      );
      await expect(page.locator(ALL_ROWS)).toHaveCount(seeded.length);
      await expect(page.getByTestId(rowTestId(oldest.id))).toBeVisible();
    });
  });

  test.describe('an event page reads its event by id', () => {
    test('[P1] a reload of a past event beyond the first window stays on its page, and its Name field opens with the saved name', async ({
      page,
      coupleEvents,
      interceptNetworkCall,
    }) => {
      const pastRows = history(EVENTS_PAGE_SIZE + 1);
      const seeded = await coupleEvents.seed(pastRows);
      const oldest = seeded[pastRows.length - 1];
      await openDates(page, interceptNetworkCall);
      await loadHistory(page, interceptNetworkCall, seeded.length);
      await page.getByTestId(rowTestId(oldest.id)).click();
      await expect(page.getByTestId('settings-event-page')).toBeVisible();
      const eventPath = new URL(page.url()).pathname;
      expect(eventPath).toBe(`/settings/dates/event/${oldest.id}`);

      const byId = interceptNetworkCall({ method: 'GET', url: EVENT_BY_ID_READ });
      await page.reload();
      expect((await byId).status).toBe(200);

      await expect(page.getByTestId('settings-event-page')).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
      const savedName = pastRows[pastRows.length - 1].label;
      await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName(`Name, ${savedName}`);
      await page.getByTestId('settings-event-name').click();
      await expect(page.getByTestId('settings-event-name-field')).toHaveValue(savedName);
    });

    test('[P1] an unknown event id falls back to the Dates list', async ({
      page,
      coupleEvents,
      interceptNetworkCall,
    }) => {
      await coupleEvents.seed(history(3));
      const byId = interceptNetworkCall({ method: 'GET', url: EVENT_BY_ID_READ });
      await page.goto('/settings/dates/event/00000000-0000-4000-8000-000000000000');
      expect((await byId).status).toBe(200);

      await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.getByTestId('settings-event-page')).toHaveCount(0);
    });
  });
});
