/**
 * Target path once activated: `tests/e2e/settings/events-load-concurrency.spec.ts`.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils/log';
import { test, expect } from '../../support/fixtures/events-load-concurrency';

const EVENTS_ENDPOINT = '**/rest/v1/events*';

async function navigateToSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open navigation menu' }).click();

  const navigation = page.getByRole('dialog', { name: 'Navigation' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: 'Settings', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('Settings event load/write concurrency', () => {
  test(
    '[P1] DWEA-E2E-001 preserves a failed edit error when the pending load succeeds',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({
      page,
      eventApiHarness,
      heldEventLoads,
      interceptNetworkCall,
    }) => {
      const label = eventApiHarness.label('failed-edit-attribution');
      const existing = await eventApiHarness.seed({
        owner: 'creator',
        label,
        dayOffset: 21,
        description: 'Original description',
        icon: 'calendar',
      });

      await log.step('Prime Zustand with the editable event on Home');
      await page.goto('/');
      await expect(page.getByText(label, { exact: true })).toBeVisible();

      const pendingLoad = heldEventLoads.holdNextPair();

      await log.step('Open Settings and capture both StrictMode loads’ successful snapshots');
      await navigateToSettings(page);
      await pendingLoad.captured;

      const loadRegion = page.getByTestId('events-settings-load-region');
      await expect(loadRegion).toHaveAttribute('aria-busy', 'true');
      await expect(page.getByTestId('event-row-' + existing.id)).toBeVisible();

      const rejectedUpdate = interceptNetworkCall({
        method: 'PATCH',
        url: EVENTS_ENDPOINT,
        fulfillResponse: {
          status: 500,
          body: {
            message: 'Injected edit failure',
            details: '',
            hint: '',
            code: 'XX000',
          },
        },
      });

      await log.step('Attempt an edit while the Settings load remains pending');
      await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click();

      const editDialog = page.getByRole('dialog', { name: 'Edit Event' });
      await expect(editDialog).toBeVisible();
      await editDialog
        .getByLabel('Description (optional)', { exact: true })
        .fill('This change must fail');
      await editDialog.getByRole('button', { name: 'Update', exact: true }).click();

      expect((await rejectedUpdate).status).toBe(500);
      await expect(editDialog.getByRole('alert')).toContainText('Injected edit failure');

      await log.step('Release all successful snapshots and verify error ownership');
      await pendingLoad.release();
      await expect(loadRegion).toHaveAttribute('aria-busy', 'false');

      await expect(editDialog).toBeVisible();
      await expect(editDialog.getByRole('alert')).toContainText('Injected edit failure');
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
      await expect(page.getByTestId('event-row-' + existing.id)).toBeVisible();
      await expect(page.getByTestId('event-row-' + existing.id)).toContainText(
        'Original description'
      );

      expect(await eventApiHarness.find(existing.id)).toMatchObject({
        id: existing.id,
        description: 'Original description',
      });
    },
  );

  test(
    '[P1] DWEA-E2E-002 replays a successful add over older empty snapshots',
    async ({
      page,
      eventApiHarness,
      heldEventLoads,
      interceptNetworkCall,
    }) => {
      const label = eventApiHarness.label('add-over-empty-snapshots');

      await log.step('Settle Home with no dynamic events');
      await page.goto('/');
      await expect(page.getByTestId('events-empty-placeholder')).toBeVisible();

      const pendingLoad = heldEventLoads.holdNextPair();

      await log.step('Open Settings and capture both StrictMode loads’ empty snapshots');
      await navigateToSettings(page);
      await pendingLoad.captured;

      const loadRegion = page.getByTestId('events-settings-load-region');
      await expect(loadRegion).toHaveAttribute('aria-busy', 'true');

      const createdEvent = interceptNetworkCall({
        method: 'POST',
        url: EVENTS_ENDPOINT,
      });

      await log.step('Add an event while the older snapshots remain held');
      await page.getByRole('button', { name: 'Add event', exact: true }).click();

      const addDialog = page.getByRole('dialog', { name: 'Add Event' });
      await expect(addDialog).toBeVisible();
      await addDialog.getByLabel('Label').fill(label);
      await addDialog.getByLabel('Date').fill(eventApiHarness.date(30));
      await addDialog
        .getByLabel('Description (optional)', { exact: true })
        .fill('Created after all mount snapshots');
      await addDialog.getByTestId('events-form-icon-option-plane').click();
      await expect(addDialog.getByTestId('events-form-icon-plane')).toBeChecked();
      await addDialog.getByRole('button', { name: 'Add', exact: true }).click();

      const createResult = await createdEvent;
      expect(createResult.status).toBe(201);
      expect(createResult.responseJson).toMatchObject({ label });

      const created = createResult.responseJson as {
        id?: unknown;
        label?: unknown;
      } | null;
      if (!created || typeof created.id !== 'string') {
        throw new Error('Create response did not include the durable event id');
      }

      await expect(addDialog).toHaveCount(0);
      await expect(page.getByTestId('event-row-' + created.id)).toHaveCount(1);
      await expect(page.getByText(label, { exact: true })).toHaveCount(1);

      await log.step('Release the empty snapshots and verify the add is replayed once');
      await pendingLoad.release();
      await expect(loadRegion).toHaveAttribute('aria-busy', 'false');

      await expect(page.getByTestId('event-row-' + created.id)).toHaveCount(1);
      await expect(page.getByText(label, { exact: true })).toHaveCount(1);
      expect(await eventApiHarness.find(created.id)).toMatchObject({
        id: created.id,
        label,
        description: 'Created after all mount snapshots',
      });
    },
  );

  test(
    '[P1] DWEA-E2E-003 replays a successful delete over older snapshots',
    async ({
      page,
      eventApiHarness,
      heldEventLoads,
      interceptNetworkCall,
    }) => {
      const label = eventApiHarness.label('delete-over-stale-snapshots');
      const existing = await eventApiHarness.seed({
        owner: 'creator',
        label,
        dayOffset: 24,
        description: 'Delete while Settings loads',
        icon: 'ring',
      });

      await log.step('Prime Zustand with the deletable event on Home');
      await page.goto('/');
      await expect(page.getByText(label, { exact: true })).toBeVisible();

      const pendingLoad = heldEventLoads.holdNextPair();

      await log.step('Open Settings and capture both StrictMode loads’ older snapshots');
      await navigateToSettings(page);
      await pendingLoad.captured;

      const loadRegion = page.getByTestId('events-settings-load-region');
      const eventRow = page.getByTestId('event-row-' + existing.id);
      await expect(loadRegion).toHaveAttribute('aria-busy', 'true');
      await expect(eventRow).toBeVisible();

      const deletedEvent = interceptNetworkCall({
        method: 'DELETE',
        url: EVENTS_ENDPOINT,
      });

      await log.step('Delete the event while all mount snapshots remain held');
      await page.getByRole('button', { name: 'Delete ' + label, exact: true }).click();

      const deleteDialog = page.getByRole('dialog', { name: 'Delete this event?' });
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();

      expect((await deletedEvent).status).toBe(200);
      await expect(deleteDialog).toHaveCount(0);
      await expect(eventRow).toHaveCount(0);

      await log.step('Release the stale snapshots and verify the delete is replayed');
      await pendingLoad.release();
      await expect(loadRegion).toHaveAttribute('aria-busy', 'false');

      await expect(eventRow).toHaveCount(0);
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
      expect(await eventApiHarness.find(existing.id)).toBeNull();
    },
  );
});
