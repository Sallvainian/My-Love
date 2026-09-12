/**
 * EVG-E2E-001: padded exact ASCII limits traverse the real form, service,
 * database, store, and reload. Independent 101/501 rejection cases already
 * belong to the component suite; this test adds the missing browser round trip.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { eventDateFrom } from '../../support/factories/events';
import { boundaryText, EventRowSchema } from '../../support/factories/events-validation';

async function eventsSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__APP_STORE__?.getState();
    if (!state) return null;
    return {
      loading: state.eventsIsLoading,
      rows: state.events.map(({ id, userId, label, description, icon }) => ({
        id, userId, label, description, icon,
      })),
    };
  });
}

test('[P1] EVG-E2E-001 padded 100/500 boundaries save exactly and survive reload', async ({
  page, coupleEvents, interceptNetworkCall, recurse,
}) => {
  // Historical acceptance criteria are fixed here independently of the shared
  // mutable declaration/catalog contract. ASCII avoids the deferred UTF-16 gap.
  const label = boundaryText(100, 'EVG browser label');
  const description = boundaryText(500, 'EVG browser description');
  const eventDate = eventDateFrom(coupleEvents.anchor, 30);
  const payload = {
    user_id: coupleEvents.userId,
    label,
    event_date: eventDate,
    description,
    icon: 'calendar',
  };

  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });

  // GIVEN the real form, with whitespace around each exact boundary value.
  await log.step('Open the real Settings form with the current worker pair');
  const initialRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.goto('/settings');
  expect((await initialRead).status).toBe(200);
  await expect(page.getByTestId('events-settings-empty')).toBeVisible();
  await page.getByTestId('events-settings-add').click();
  await expect(page.getByTestId('events-form')).toBeVisible();
  await page.getByTestId('events-form-label').fill(`  ${label}  `);
  await page.getByTestId('events-form-date').fill(eventDate);
  await page.getByTestId('events-form-description').fill(`  ${description}  `);

  // WHEN the creator saves through the actual form and service.
  await log.step('Submit padded exact limits and verify the trimmed network payload');
  const createdCall = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/events*' });
  await page.getByTestId('events-form-submit').click();
  const { status, requestJson, responseJson } = await createdCall;
  expect(status).toBe(201);
  expect(requestJson).toEqual(payload);
  const saved = EventRowSchema.parse(responseJson);
  expect(saved).toMatchObject(payload);

  const expectedRows = [{
    id: saved.id,
    userId: coupleEvents.userId,
    label,
    description,
    icon: 'calendar',
  }];

  // THEN the exact payload reaches the store/UI and survives a server reload.
  await log.step('Wait for the successful response to reach Zustand, then assert rendered text');
  const createdState = await recurse(
    () => eventsSnapshot(page),
    (state) => state !== null && !state.loading && state.rows.some((row) => row.id === saved.id),
    { timeout: 10000, interval: 50, log: 'Waiting for the saved event in Zustand' }
  );
  expect(createdState).toEqual({ loading: false, rows: expectedRows });
  await expect(page.getByTestId('events-form')).toHaveCount(0);
  await expect(page.getByTestId(`event-row-${saved.id}`)).toBeVisible();
  await expect(page.getByTestId(`event-label-${saved.id}`)).toHaveText(label);
  await expect(page.getByTestId(`event-description-${saved.id}`)).toHaveText(description);

  await log.step('Reload Settings and verify the server-backed row and edit prefills');
  const reloadRead = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
  await page.reload();
  expect((await reloadRead).status).toBe(200);
  const reloadedState = await recurse(
    () => eventsSnapshot(page),
    (state) => state !== null && !state.loading && state.rows.some((row) => row.id === saved.id),
    { timeout: 10000, interval: 50, log: 'Waiting for the reloaded event in Zustand' }
  );
  expect(reloadedState).toEqual({ loading: false, rows: expectedRows });
  await expect(page.getByTestId(`event-row-${saved.id}`)).toBeVisible();
  await expect(page.getByTestId(`event-label-${saved.id}`)).toHaveText(label);
  await expect(page.getByTestId(`event-description-${saved.id}`)).toHaveText(description);

  await page.getByTestId(`event-edit-${saved.id}`).click();
  await expect(page.getByTestId('events-form-label')).toHaveValue(label);
  await expect(page.getByTestId('events-form-description')).toHaveValue(description);
  await expect(page.getByTestId('events-form-date')).toHaveValue(eventDate);
  await expect(page.getByTestId('events-form-icon-calendar')).toBeChecked();
  await page.getByTestId('events-form-cancel').click();
  await expect(page.getByTestId('events-form')).toHaveCount(0);
});
