/** Target path once activated: `tests/e2e/settings/events-write-error-codes.spec.ts`. */
import type { Locator, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/fixtures/events-write-errors';
import { navigateTo } from '../../support/helpers/navigation';

const STALE_EDIT_LABEL = 'Stale Edit Error Code E2E';
const STALE_EDIT_ATTEMPT = 'Stale Edit Attempt E2E';
const STALE_DELETE_LABEL = 'Stale Delete Error Code E2E';
const TRANSPORT_LABEL = 'Transport Error Code E2E';
const TRANSPORT_ATTEMPT = 'Transport Attempt E2E';
const STALE_EDIT_MESSAGE = 'Event not found or not yours to edit';
const STALE_DELETE_MESSAGE = 'Event not found or not yours to delete';
const INJECTED_TRANSPORT_MESSAGE = `Injected transport failure: ${STALE_EDIT_MESSAGE}`;
const MAPPED_TRANSPORT_MESSAGE =
  `[EventsService.updateEvent] Database error: ${INJECTED_TRANSPORT_MESSAGE}`;

async function openSettingsRow(page: Page, eventId: string): Promise<Locator> {
  await page.goto('/');
  await navigateTo(page, 'settings');

  const row = page.getByTestId(`event-row-${eventId}`);
  await expect(row).toBeVisible();
  return row;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Event write error codes select the recovery control', () => {
  test('[P1] DWEW-E2E-001 refreshes and reconciles after an edit loses its row', async ({
    page,
    interceptNetworkCall,
    eventWriteHarness,
  }) => {
    const event = await eventWriteHarness.seed({
      owner: 'self',
      label: STALE_EDIT_LABEL,
      dayOffset: 30,
      description: 'The dialog will outlive this row',
      icon: 'calendar',
    });

    await log.step('Open the edit dialog while the event still exists');
    const row = await openSettingsRow(page, event.id);
    await page.getByRole('button', { name: `Edit ${event.label}` }).click();
    await expect(page.getByTestId('events-form')).toBeVisible();
    await expect(page.getByTestId('events-form-label')).toHaveValue(event.label);

    await log.step('Remove the row server-side and submit the stale edit');
    await eventWriteHarness.remove(event.id);
    const stalePatch = interceptNetworkCall({
      method: 'PATCH',
      url: '**/rest/v1/events*',
    });

    await page.getByTestId('events-form-label').fill(STALE_EDIT_ATTEMPT);
    await page.getByTestId('events-form-submit').click();

    const patchResult = await stalePatch;
    expect(patchResult.status).toBe(200);
    expect(patchResult.responseJson).toEqual([]);
    await expect(page.getByTestId('events-form-error')).toHaveText(STALE_EDIT_MESSAGE);
    await expect(page.getByTestId('events-form-refresh')).toBeVisible();
    await expect(page.getByTestId('events-form-submit')).toHaveCount(0);

    await log.step('Refresh the list and reconcile away the stale client row');
    const refreshLoad = interceptNetworkCall({
      method: 'GET',
      url: '**/rest/v1/events*',
    });
    await page.getByTestId('events-form-refresh').click();

    expect((await refreshLoad).status).toBe(200);
    await expect(page.getByTestId('events-form')).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId('events-settings-empty')).toBeVisible();
    expect(await eventWriteHarness.find(event.id)).toBeNull();
  });

  test('[P1] DWEW-E2E-002 refreshes and reconciles after a delete loses its row', async ({
    page,
    interceptNetworkCall,
    eventWriteHarness,
  }) => {
    const event = await eventWriteHarness.seed({
      owner: 'self',
      label: STALE_DELETE_LABEL,
      dayOffset: 31,
      description: 'The confirmation will outlive this row',
      icon: 'calendar',
    });

    await log.step('Open the delete confirmation while the event still exists');
    const row = await openSettingsRow(page, event.id);
    await page.getByRole('button', { name: `Delete ${event.label}` }).click();
    await expect(page.getByTestId('events-delete-confirmation')).toBeVisible();

    await log.step('Remove the row server-side and confirm the stale delete');
    await eventWriteHarness.remove(event.id);
    const staleDelete = interceptNetworkCall({
      method: 'DELETE',
      url: '**/rest/v1/events*',
    });
    await page.getByTestId('events-delete-confirm').click();

    const deleteResult = await staleDelete;
    expect(deleteResult.status).toBe(200);
    expect(deleteResult.responseJson).toEqual([]);
    await expect(page.getByTestId('events-delete-error')).toHaveText(STALE_DELETE_MESSAGE);
    await expect(page.getByTestId('events-delete-refresh')).toBeVisible();
    await expect(page.getByTestId('events-delete-confirm')).toHaveCount(0);

    await log.step('Refresh the list and reconcile away the stale client row');
    const refreshLoad = interceptNetworkCall({
      method: 'GET',
      url: '**/rest/v1/events*',
    });
    await page.getByTestId('events-delete-refresh').click();

    expect((await refreshLoad).status).toBe(200);
    await expect(page.getByTestId('events-delete-confirmation')).toHaveCount(0);
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId('events-settings-empty')).toBeVisible();
    expect(await eventWriteHarness.find(event.id)).toBeNull();
  });

  test(
    '[P2] DWEW-E2E-003 keeps Update retryable when transport prose resembles a stale-row failure',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({ page, interceptNetworkCall, eventWriteHarness }) => {
      const event = await eventWriteHarness.seed({
        owner: 'self',
        label: TRANSPORT_LABEL,
        dayOffset: 32,
        description: 'This row must survive the injected response',
        icon: 'calendar',
      });

      await log.step('Open the edit dialog for a durable event');
      const row = await openSettingsRow(page, event.id);
      await page.getByRole('button', { name: `Edit ${event.label}` }).click();
      await expect(page.getByTestId('events-form')).toBeVisible();

      await log.step('Submit a PATCH whose transport message resembles a stale-row message');
      const rejectedPatch = interceptNetworkCall({
        method: 'PATCH',
        url: '**/rest/v1/events*',
        fulfillResponse: {
          status: 500,
          body: {
            message: INJECTED_TRANSPORT_MESSAGE,
            details: '',
            hint: '',
            code: 'XX000',
          },
        },
      });

      await page.getByTestId('events-form-label').fill(TRANSPORT_ATTEMPT);
      await page.getByTestId('events-form-submit').click();

      expect((await rejectedPatch).status).toBe(500);
      await expect(page.getByTestId('events-form-error')).toHaveText(
        MAPPED_TRANSPORT_MESSAGE
      );
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-submit')).toBeEnabled();
      await expect(page.getByTestId('events-form-submit')).toHaveText('Update');
      await expect(page.getByTestId('events-form-refresh')).toHaveCount(0);

      await log.step('Verify the rejected transport write changed neither store nor server row');
      await expect(row).toContainText(TRANSPORT_LABEL);
      await expect(row).not.toContainText(TRANSPORT_ATTEMPT);
      const persisted = await eventWriteHarness.find(event.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.label).toBe(TRANSPORT_LABEL);
    }
  );
});
