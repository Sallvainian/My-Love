import { faker } from '@faker-js/faker';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { isoDateDaysFromNow } from '../../support/helpers/events';
import {
  installEventTransportFailure,
  readEventTransportFailure,
  restoreEventTransportFailure,
} from '../../support/helpers/event-transport-error';
import type { Database } from '../../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

// The first query rejects before HTTP. Network monitoring remains enabled;
// the deliberate retry below must reach the real API successfully.
test('[P2] DW53-E2E-001 a transport failure retains its cause and the event form can retry', async ({
  page,
  authToken,
  apiRequest,
  interceptNetworkCall,
  recurse,
}) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !authToken) {
    throw new Error('DW53-E2E-001 requires the configured local Supabase auth fixtures');
  }
  const label = `DW53 transport ${faker.string.uuid()}`;
  const eventDate = isoDateDaysFromNow(10);
  const description = 'Retain this description after the transport failure';
  const expectedMessage =
    '[EventsService.createEvent] Network error: socket closed. Check your internet connection.';
  let ownerId: string | undefined;
  let createdId: string | undefined;

  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
  // Registered before navigation. The injected query never sends HTTP, so this
  // observes only the user's explicit retry. Retain a rejection as data until
  // awaited to avoid an unhandled promise if an earlier UI assertion fails.
  const retryCreate = interceptNetworkCall({
    method: 'POST',
    url: '**/rest/v1/events*',
    timeout: 45000,
  }).then(
    (response) => ({ ok: true as const, response }),
    (error: unknown) => ({ ok: false as const, error })
  );

  try {
    await log.step('Given a signed-in event form with complete inputs');
    await page.goto('/settings');
    const currentUserId = await recurse(
      () => page.evaluate(() => window.__APP_STORE__?.getState().userId),
      (id) => typeof id === 'string' && id.length > 0,
      { timeout: 10000 }
    );
    if (!currentUserId) throw new Error('The authenticated app user is unavailable');
    ownerId = currentUserId;
    await recurse(
      () => page.evaluate(() => {
        const state = window.__APP_STORE__?.getState();
        return Boolean(state && !state.eventsIsLoading && state.eventsError === null);
      }),
      (settled) => settled,
      { timeout: 10000 }
    );
    await page.getByTestId('events-settings-add').click();
    const form = page.getByTestId('events-form');
    const labelInput = page.getByTestId('events-form-label');
    const dateInput = page.getByTestId('events-form-date');
    const descriptionInput = page.getByTestId('events-form-description');
    const submit = page.getByTestId('events-form-submit');
    const alert = page.getByTestId('events-form-error');
    await expect(form).toBeVisible();
    await labelInput.fill(label);
    await dateInput.fill(eventDate);
    await descriptionInput.fill(description);

    await log.step('When the events query rejects with the original transport TypeError');
    await installEventTransportFailure(page);
    await submit.click();
    const failure = await recurse(
      () => readEventTransportFailure(page),
      (snapshot) => snapshot !== null,
      { timeout: 10000 }
    );
    expect(failure).not.toBeNull();
    if (!failure) throw new Error('The real events service did not capture its rejection');
    expect(failure).toMatchObject({
      name: 'EventWriteError',
      code: 'transport',
      message: expectedMessage,
      sameCause: true,
      originalName: 'TypeError',
      causeName: 'TypeError',
      originalMessage: 'socket closed',
      causeMessage: 'socket closed',
      originalCode: 'ECONNRESET',
      causeCode: 'ECONNRESET',
      rejectionCount: 1,
    });
    expect(failure.originalStack).toContain('TypeError: socket closed');
    expect(failure.causeStack).toBe(failure.originalStack);

    await log.step('Then the same error reaches the form and preserves unsaved inputs');
    await expect(alert).toHaveText(expectedMessage);
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(form).toBeVisible();
    await expect(labelInput).toHaveValue(label);
    await expect(dateInput).toHaveValue(eventDate);
    await expect(descriptionInput).toHaveValue(description);
    await expect(submit).toBeEnabled();
    await expect(page.getByTestId('events-form-cancel')).toBeEnabled();
    const unsaved = await page.evaluate((attemptedLabel) => {
      const state = window.__APP_STORE__?.getState();
      if (!state) throw new Error('The app store is unavailable');
      return state.events.filter((event) => event.label === attemptedLabel);
    }, label);
    expect(unsaved).toEqual([]);
    await expect(page.getByTestId('events-settings-load-region').getByText(label, { exact: true }))
      .toHaveCount(0);

    await log.step('When the user explicitly retries, the real response reaches store and UI');
    await restoreEventTransportFailure(page);
    await submit.click();
    const retry = await retryCreate;
    if (!retry.ok) throw retry.error;
    expect(retry.response.status).toBe(201);
    expect(retry.response.requestJson).toMatchObject({
      user_id: ownerId,
      label,
      event_date: eventDate,
      description,
    });
    // No exported response schema exists for this endpoint. Assertions cover
    // the fields under test; the existing API suite owns the full row schema.
    const created = retry.response.responseJson as EventRow;
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    createdId = created.id;
    expect(created).toMatchObject({ user_id: ownerId, label, event_date: eventDate, description });
    const stored = await recurse(
      () => page.evaluate((createdId) => {
        const state = window.__APP_STORE__?.getState();
        if (!state) throw new Error('The app store is unavailable');
        return state.events.filter((event) => event.id === createdId);
      }, created.id),
      (events) => events.length === 1,
      { timeout: 10000 }
    );
    expect(stored[0]).toMatchObject({ id: created.id, label, description });
    await expect(form).toHaveCount(0);
    await expect(alert).toHaveCount(0);
    await expect(page.getByTestId(`event-row-${created.id}`)).toContainText(label);
  } finally {
    try {
      await restoreEventTransportFailure(page);
    } finally {
      if (ownerId) {
        // This unique label plus its authenticated owner identifies only this
        // test's row, including a saved row whose response assertion failed.
        const cleanup = await apiRequest<EventRow[]>({
          method: 'DELETE',
          baseUrl: supabaseUrl,
          path: `/rest/v1/events?user_id=eq.${ownerId}&label=eq.${encodeURIComponent(label)}`,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${authToken}`,
            Prefer: 'return=representation',
          },
          retryConfig: { maxRetries: 0 },
        });
        expect(cleanup.status).toBe(200);
        expect(cleanup.body.length).toBeLessThanOrEqual(1);
        if (createdId) {
          expect(cleanup.body.map((row) => row.id)).toEqual([createdId]);
        }
        for (const deleted of cleanup.body) {
          expect(deleted).toMatchObject({ user_id: ownerId, label });
        }
      }
    }
  }
});
