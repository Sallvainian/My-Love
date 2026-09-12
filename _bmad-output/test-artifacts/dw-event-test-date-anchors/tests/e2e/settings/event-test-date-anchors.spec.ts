/**
 * DW-61/64/69: one setup clock anchor reaches form writes and server-rendered dates.
 * The data factory crosses Node setup midnight synchronously, then restores Date.
 * Browser, auth, and server clocks remain real; all event dates are safely future.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { createDateAnchorBatch } from '../../support/factories/event-test-date-anchors';
import { navigateTo } from '../../support/helpers/navigation';

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

test('[P1] DW.DATE-E2E-001 shared setup dates survive Settings writes, reload, and Home ordering', async ({
  page,
  coupleEvents,
  interceptNetworkCall,
  recurse,
}) => {
  const batch = createDateAnchorBatch();
  // coupleEvents owns checked cleanup before/after this test; no factory rows
  // are seeded because submitting the date through the real form is the subject.
  const ownerId = coupleEvents.userId;
  const nextState = {
    label: batch.next.label,
    userId: ownerId,
    calendar: batch.expectedNextDate.split('-').map(Number),
  };
  const sameState = {
    label: batch.after.label,
    userId: ownerId,
    calendar: batch.expectedSameDate.split('-').map(Number),
  };

  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });

  await log.step('Open Settings with the worker pair empty');
  const initialRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.goto('/settings');
  expect((await initialRead).status).toBe(200);
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByTestId('events-settings-empty')).toBeVisible();

  await log.step('Create the later date first and verify response, store, then UI');
  await page.getByTestId('events-settings-add').click();
  await page.getByTestId('events-form-label').fill(batch.next.label);
  await page.getByTestId('events-form-date').fill(batch.next.date);
  const nextWrite = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/events*' });
  await page.getByTestId('events-form-submit').click();

  const nextCreated = await nextWrite;
  expect(nextCreated.status).toBe(201);
  expect(nextCreated.requestJson).toMatchObject({
    user_id: ownerId,
    label: batch.next.label,
    event_date: batch.expectedNextDate,
  });
  expect(nextCreated.responseJson).toMatchObject({
    user_id: ownerId,
    label: batch.next.label,
    event_date: batch.expectedNextDate,
  });
  const afterNextWrite = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 1,
    { timeout: 15000, interval: 100, log: 'Waiting for the first event in Zustand' }
  );
  expect(afterNextWrite.rows).toEqual([nextState]);
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  await expect(page.getByTestId(/^event-label-/)).toHaveText([batch.next.label]);
  await expect(page.getByTestId(/^event-date-/)).toHaveText([batch.expectedNextLongDate]);

  await log.step('Create the anchored December date after setup midnight');
  await page.getByTestId('events-settings-add').click();
  await page.getByTestId('events-form-label').fill(batch.after.label);
  await page.getByTestId('events-form-date').fill(batch.after.date);
  const sameWrite = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/events*' });
  await page.getByTestId('events-form-submit').click();

  const sameCreated = await sameWrite;
  expect(sameCreated.status).toBe(201);
  expect(sameCreated.requestJson).toMatchObject({
    user_id: ownerId,
    label: batch.after.label,
    event_date: batch.expectedSameDate,
  });
  expect(sameCreated.responseJson).toMatchObject({
    user_id: ownerId,
    label: batch.after.label,
    event_date: batch.expectedSameDate,
  });
  const afterSameWrite = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 2,
    { timeout: 15000, interval: 100, log: 'Waiting for both events in Zustand' }
  );
  expect(afterSameWrite.rows).toEqual([sameState, nextState]);
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  await expect(page.getByTestId(/^event-label-/)).toHaveText([batch.after.label, batch.next.label]);

  await log.step('Reload and verify dates and server order independently of creation order');
  const reloadRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.reload();
  expect((await reloadRead).status).toBe(200);
  await expect(page.getByTestId('settings-view')).toBeVisible();
  const reloaded = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 2,
    { timeout: 15000, interval: 100, log: 'Waiting for the reloaded server events' }
  );
  expect(reloaded.rows).toEqual([sameState, nextState]);
  await expect(page.getByTestId(/^event-label-/)).toHaveText([batch.after.label, batch.next.label]);
  await expect(page.getByTestId(/^event-date-/)).toHaveText([
    batch.expectedSameLongDate,
    batch.expectedNextLongDate,
  ]);

  await log.step('Show both future events on Home in their persisted date order');
  const homeRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await navigateTo(page, 'home');
  expect((await homeRead).status).toBe(200);
  const homeState = await recurse(
    () => eventSnapshot(page),
    (snapshot) => !snapshot.loading && snapshot.rows.length === 2,
    { timeout: 15000, interval: 100, log: 'Waiting for the Home events load' }
  );
  expect(homeState.rows).toEqual([sameState, nextState]);

  // Home renders a countdown rather than a calendar-date string. Exact dates
  // were checked above at the wire, store, and Settings; Home proves visibility/order.
  const sameCard = page.getByTestId('event-countdown-' + batch.after.label);
  const nextCard = page.getByTestId('event-countdown-' + batch.next.label);
  await expect(sameCard).toBeVisible();
  await expect(nextCard).toBeVisible();
  await expect(sameCard.or(nextCard).getByRole('heading')).toHaveText([
    batch.after.label,
    batch.next.label,
  ]);
});
