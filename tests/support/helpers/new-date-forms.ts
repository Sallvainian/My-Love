/**
 * UI helpers for adding an event from the Dates list: `+`, the Kind chooser,
 * and the New event form (`NewDatePages`).
 *
 * Import by this deep path: `tests/support/helpers` has no barrel. Every helper
 * starts on the Dates list (`/settings/dates`).
 */
import type { Locator, Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { expect } from '../merged-fixtures';
import { localDateFromIso } from './events';
import { listDate } from './dates-list-format';
import { EVENTS_WRITE } from './reads';

export type NewEventIcon = 'calendar' | 'ring' | 'plane';

export interface NewEventInput {
  label: string;
  /** `YYYY-MM-DD`, as the date input holds it. */
  date: string;
  description?: string;
  /** The Calendar tile is selected when the form opens. */
  icon?: NewEventIcon;
}

/** The Dates list row carrying a given label. Row testids key on the event's uuid. */
export function eventRowFor(page: Page, label: string): Locator {
  return page.locator('[data-testid^="settings-dates-event-"]').filter({ hasText: label });
}

/** Opens the Kind chooser with `+` and chooses a kind, landing on that kind's form. */
export async function openNewDateForm(page: Page, kind: 'event' | 'anniversary'): Promise<void> {
  await page.getByTestId('settings-dates-add').click();
  await expect(page.getByTestId('settings-kind-chooser')).toBeVisible();
  await page.getByTestId(`settings-kind-chooser-${kind}`).click();
  await expect(page).toHaveURL(new RegExp(`/settings/dates/new-${kind}$`));
  await expect(
    page.getByRole('heading', { level: 1, name: kind === 'event' ? 'New event' : 'New anniversary' })
  ).toBeVisible();
}

/** Opens the New event form from the Dates list: `+`, then Event in the Kind chooser. */
export async function openNewEventForm(page: Page): Promise<void> {
  await openNewDateForm(page, 'event');
}

/** Fills the open New event form (Name, Date, and the optional Note and Icon). */
export async function fillNewEventForm(page: Page, event: NewEventInput): Promise<void> {
  await page.getByTestId('settings-new-event-name-field').fill(event.label);
  await page.getByTestId('settings-new-event-date-field').fill(event.date);
  if (event.description !== undefined) {
    await page.getByTestId('settings-new-event-note-field').fill(event.description);
  }
  if (event.icon) {
    // The radio itself is sr-only; the styled label is the control a pointer
    // user actually hits, and it carries its own testid for exactly this.
    await page.getByTestId(`settings-new-event-icon-${event.icon}`).click();
    await expect(page.getByTestId(`settings-new-event-icon-${event.icon}`)).toHaveAttribute(
      'data-selected',
      'true'
    );
  }
}

/**
 * Adds an event through `+` → Event on the Dates list and waits until the
 * server took it and the list shows it, back on the Dates list with the form
 * left behind and the new event's own page never opened. Returns its row.
 *
 * The POST is observed with `interceptNetworkCall` declared BEFORE the Add
 * tap (network-first), so the create is confirmed at the wire before any DOM
 * assertion runs. `now` is the page clock the Dates list formats against.
 *
 * Only for a date inside the Dates list's first window: the list mounts again
 * on the return and reloads that window, so a deeper date shows only until the
 * reload answers (`events-history-pagination.spec.ts` adds one by hand).
 */
export async function addEventFromDatesList(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  event: NewEventInput,
  now: Date = new Date()
): Promise<Locator> {
  await openNewEventForm(page);
  await fillNewEventForm(page, event);

  // Layer 1 — the write reached the server.
  const createResponse = interceptNetworkCall({ method: 'POST', url: EVENTS_WRITE });
  await page.getByTestId('settings-form-add').click();
  expect((await createResponse).status).toBe(201);

  // Layer 2 and 3 — the store took it and the Dates list shows it.
  await expect(page).toHaveURL(/\/settings\/dates$/);
  await expect(page.getByTestId('settings-new-event-page')).toHaveCount(0);
  await expect(page.getByTestId('settings-event-page')).toHaveCount(0);
  const addedRow = eventRowFor(page, event.label);
  await expect(addedRow).toBeVisible();
  await expect(addedRow).toContainText(listDate(localDateFromIso(event.date), now));
  return addedRow;
}
