import { faker } from '@faker-js/faker';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import { createDatabaseErrorEnvelope } from '../../support/factories/database-error-envelope';
import { isoDateDaysFromNow } from '../../support/helpers/events';

test.describe('DW-39 empty database error fallback', () => {
  test(
    '[P1] DW39-E2E-001 a blank database error leaves the event form ready to retry',
    // This test deliberately injects the 400 that the form must explain.
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, authToken, interceptNetworkCall, recurse }) => {
      expect(authToken).not.toBe('');
      const label = `DW39 event ${faker.string.uuid()}`;
      const eventDate = isoDateDaysFromNow(10);
      const errorEnvelope = createDatabaseErrorEnvelope();
      const expectedMessage =
        '[EventsService.createEvent] Database error: An unknown database error occurred';

      await page.addInitScript(() => {
        localStorage.setItem('lastWelcomeView', Date.now().toString());
      });
      // Fulfill the write before navigation. Existing worker-pool events stay
      // untouched, and no seed, insertion, or cleanup reaches the database.
      const rejectedCreate = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/events*',
        fulfillResponse: { status: 400, body: errorEnvelope },
      });

      await log.step('Given an event form with a valid label and future date');
      await page.goto('/settings');
      const userId = await recurse(
        () => page.evaluate(() => window.__APP_STORE__?.getState().userId),
        (id) => typeof id === 'string' && id.length > 0,
        { timeout: 10000 }
      );
      await page.getByTestId('events-settings-add').click();
      const form = page.getByTestId('events-form');
      const labelInput = page.getByTestId('events-form-label');
      const dateInput = page.getByTestId('events-form-date');
      const submit = page.getByTestId('events-form-submit');
      await expect(form).toBeVisible();
      await labelInput.fill(label);
      await dateInput.fill(eventDate);

      await log.step('When submitting receives a database error containing only whitespace');
      await submit.click();
      const response = await rejectedCreate;
      expect(response.status).toBe(400);
      expect(response.responseJson).toEqual(errorEnvelope);
      expect(response.requestJson).toMatchObject({
        user_id: userId,
        label,
        event_date: eventDate,
      });

      // A rejected create changes no store field. The new error proves that
      // addEvent returned its failure before checking the store; eventsError
      // is load-only, and an enabled submit alone could be its initial state.
      const alert = page.getByTestId('events-form-error');
      await expect(alert).toHaveText(expectedMessage);
      await expect(submit).toBeEnabled();
      const storedEvents = await page.evaluate((attemptedLabel) => {
        const state = window.__APP_STORE__?.getState();
        if (!state) throw new Error('The app store is unavailable');
        return state.events.filter((event) => event.label === attemptedLabel);
      }, label);
      expect(storedEvents).toEqual([]);

      await log.step('Then the fallback and retained inputs allow another attempt');
      await expect(alert).toHaveAttribute('role', 'alert');
      await expect(form).toBeVisible();
      await expect(labelInput).toHaveValue(label);
      await expect(dateInput).toHaveValue(eventDate);
      await expect(submit).toBeEnabled();
      await expect(page.getByTestId('events-form-cancel')).toBeEnabled();
      await expect(page.getByTestId('events-settings-load-region').getByText(label, { exact: true }))
        .toHaveCount(0);
    }
  );
});
