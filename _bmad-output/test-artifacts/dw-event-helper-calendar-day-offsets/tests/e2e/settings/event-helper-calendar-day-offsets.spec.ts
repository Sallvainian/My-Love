/**
 * DW-84: a calendar date produced across Nuuk's late-evening DST gap
 * survives the real Settings write, reload, display, and edit prefill.
 * Only the factory's child process uses Nuuk; browser and auth clocks stay real.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { createNuukGapCase } from '../../support/factories/event-helper-calendar-day-offsets';

async function eventSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__APP_STORE__!.getState();
    return {
      loading: state.eventsIsLoading,
      rows: state.events.map((event) => ({
        label: event.label,
        userId: event.userId,
        calendar: [event.date.getFullYear(), event.date.getMonth() + 1, event.date.getDate()],
      })),
    };
  });
}

test('[P1] DW84-E2E-001 Settings preserves the Nuuk gap date through save, reload, and edit', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
  recurse,
}) => {
  const gap = createNuukGapCase();
  // GIVEN: the existing fixture clears this worker's pair before and after the test,
  // including rows created through the form. No rows are seeded for this journey.
  const expectedRows = [{
    label: gap.label,
    userId: coupleEvents.userId,
    calendar: [2026, 3, 28],
  }];

  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });

  await log.step('Open Settings with the worker pair empty');
  const initialRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.goto('/settings');
  expect((await initialRead).status).toBe(200);
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByTestId('events-settings-empty')).toBeVisible();

  // WHEN: the user saves a date produced by the actual helper across the gap.
  await log.step('Submit the actual helper date and verify the server response');
  await page.getByTestId('events-settings-empty-add').click();
  await expect(page.getByTestId('events-form')).toBeVisible();
  await page.getByTestId('events-form-label').fill(gap.label);
  await page.getByTestId('events-form-date').fill(gap.date);
  const write = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/events*' });
  await page.getByTestId('events-form-submit').click();

  // THEN: the wire, local store, and UI must all retain the same calendar date.
  const created = await write;
  expect(created.status).toBe(201);
  expect(created.requestJson).toMatchObject({
    user_id: coupleEvents.userId,
    label: gap.label,
    event_date: gap.expectedDate,
  });
  expect(created.responseJson).toMatchObject({
    user_id: coupleEvents.userId,
    label: gap.label,
    event_date: gap.expectedDate,
  });

  await log.step('Wait for the exact local calendar date in Zustand, then verify the row');
  const saved = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 1,
    { timeout: 15000, interval: 100, log: 'Waiting for March 28, 2026 in Zustand after save' }
  );
  expect(saved.rows).toEqual(expectedRows);
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  const row = page.getByTestId(/^event-row-/).filter({ hasText: gap.label });
  await expect(row).toBeVisible();
  await expect(row.getByTestId(/^event-label-/)).toHaveText(gap.label);
  await expect(row.getByTestId(/^event-date-/)).toHaveText(gap.expectedLongDate);

  await log.step('Reload Settings and verify the persisted date in store and UI');
  const reloadRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.reload();
  expect((await reloadRead).status).toBe(200);
  await expect(page.getByTestId('settings-view')).toBeVisible();
  const reloaded = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 1,
    { timeout: 15000, interval: 100, log: 'Waiting for the reloaded March 28, 2026 event' }
  );
  expect(reloaded.rows).toEqual(expectedRows);
  await expect(row).toBeVisible();
  await expect(row.getByTestId(/^event-date-/)).toHaveText(gap.expectedLongDate);

  await log.step('Open the saved event and verify its date input');
  await row.getByRole('button', { name: 'Edit ' + gap.label, exact: true }).click();
  await expect(page.getByTestId('events-form')).toBeVisible();
  await expect(page.getByTestId('events-form-label')).toHaveValue(gap.label);
  await expect(page.getByTestId('events-form-date')).toHaveValue('2026-03-28');
  await page.getByTestId('events-form-close').click();
  await expect(page.getByTestId('events-form')).toHaveCount(0);
});
