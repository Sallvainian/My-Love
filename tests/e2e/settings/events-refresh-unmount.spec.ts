/**
 * DW-57 browser integration: actual navigation while Refresh/Retry owns both
 * pending events GETs, shared-store settlement, remount recovery, native focus.
 * Zero post-unmount React setter calls are proved by the component lifetime
 * suite; browser silence cannot observe those calls because React discards them.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import { test, expect } from '../../support/merged-fixtures';
import type { EventsRefreshControl } from '../../support/fixtures/events-refresh-control';
import { navigateTo } from '../../support/helpers/navigation';

const expectedLoadFailure = { annotation: [{ type: 'skipNetworkMonitoring' }] };
const injectedLoadError = '[EventsService.getEventsPage] Database error: TEA forced events refresh failure';

async function eventsSnapshot(page: Page) {
  return page.evaluate(() => {
    const state = window.__APP_STORE__!.getState();
    return {
      ids: state.events.map((event) => event.id).sort(),
      loading: state.eventsIsLoading,
      error: state.eventsError,
      view: state.currentView,
    };
  });
}

async function openSettings(page: Page, control: EventsRefreshControl) {
  await page.goto('/settings');
  // Two loads (four GETs) on first mount under the app's real StrictMode.
  await control.waitForIdle();
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByTestId('events-settings-loading')).toHaveCount(0);
  await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
}

async function openFailedSettings(page: Page, control: EventsRefreshControl) {
  const initialLoad = control.holdNextLoad('failure');
  await page.goto('/settings');
  await initialLoad.waitForPending(2);
  initialLoad.release();
  const statuses = await initialLoad.waitForCompleted();
  await control.waitForIdle();
  await expect(page.getByTestId('events-settings-load-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  return statuses;
}

async function leaveForMood(page: Page) {
  // Home also calls loadEvents and could supersede the pending load under test.
  await navigateTo(page, 'mood');
  await expect(page.getByTestId('mood-tracker')).toBeVisible();
  await expect(page.getByTestId('events-settings')).toHaveCount(0);
  await page.getByRole('button', { name: 'Happy mood', exact: true }).focus();
}

async function waitForEventsSettlement(page: Page) {
  return recurse(
    () => eventsSnapshot(page),
    (state) => !state.loading,
    { timeout: 15000, interval: 50, log: 'Waiting for the shared events load to settle' }
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.describe('DW-57 events refresh and retry across Settings unmount', () => {
  test('[P1] DW-57-E2E-001 stale edit refresh succeeds after navigating to Mood', async ({
    page, coupleEvents, eventsRefreshControl, apiRequest, authToken, interceptNetworkCall,
  }) => {
    const [stale, witness] = await coupleEvents.seed([
      { label: 'DW57 stale edit', dayOffset: 14 },
      { label: 'DW57 edit survivor', dayOffset: -14 },
    ]);
    await log.step('Open a creator event, then remove its server row outside the stale UI');
    await openSettings(page, eventsRefreshControl);
    await expect(page.getByTestId(`event-row-${stale.id}`)).toBeVisible();
    const removed = await apiRequest({
      method: 'DELETE', baseUrl: process.env.SUPABASE_URL,
      path: `/rest/v1/events?id=eq.${stale.id}`,
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
    });
    expect(removed.status).toBe(204);
    const rejectedWrite = interceptNetworkCall({ method: 'PATCH', url: '**/rest/v1/events*' });
    await page.getByTestId(`event-edit-${stale.id}`).click();
    await page.getByTestId('events-form-label').fill('DW57 attempted stale edit');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    const rejected = await rejectedWrite;
    expect(rejected.status).toBe(200);
    expect(rejected.responseJson).toEqual([]);
    await expect(page.getByTestId('events-form-error')).toContainText('Event not found or not yours to edit');

    await log.step('Hold both Refresh reads, then unmount Settings through navigation');
    const refresh = eventsRefreshControl.holdNextLoad('success');
    await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
    await refresh.waitForPending();
    await expect(page.getByTestId('events-form')).toHaveCount(0);
    await leaveForMood(page);
    refresh.release();
    expect(await refresh.waitForCompleted()).toEqual([200, 200]);
    const settled = await waitForEventsSettlement(page);
    expect(settled).toEqual({ ids: [witness.id], loading: false, error: null, view: 'mood' });
    await expect(page.getByTestId('mood-tracker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Happy mood', exact: true })).toBeFocused();
    await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);

    await navigateTo(page, 'settings');
    const recovered = await waitForEventsSettlement(page);
    expect(recovered).toEqual({ ids: [witness.id], loading: false, error: null, view: 'settings' });
    await expect(page.getByTestId(`event-row-${witness.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-row-${stale.id}`)).toHaveCount(0);
    await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeEnabled();
  });

  test('[P1] DW-57-E2E-002 stale delete refresh fails after navigating to Mood', expectedLoadFailure, async ({
    page, coupleEvents, eventsRefreshControl, apiRequest, authToken, interceptNetworkCall,
  }) => {
    const [stale, witness] = await coupleEvents.seed([
      { label: 'DW57 stale delete', dayOffset: 14 },
      { label: 'DW57 delete survivor', dayOffset: -14 },
    ]);
    await log.step('Keep a stale creator row rendered after an actual server deletion');
    await openSettings(page, eventsRefreshControl);
    await expect(page.getByTestId(`event-row-${stale.id}`)).toBeVisible();
    const removed = await apiRequest({
      method: 'DELETE', baseUrl: process.env.SUPABASE_URL,
      path: `/rest/v1/events?id=eq.${stale.id}`,
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${authToken}` },
    });
    expect(removed.status).toBe(204);
    const rejectedWrite = interceptNetworkCall({ method: 'DELETE', url: '**/rest/v1/events*' });
    await page.getByTestId(`event-delete-${stale.id}`).click();
    await page.getByTestId('events-delete-confirm').click();
    const rejected = await rejectedWrite;
    expect(rejected.status).toBe(200);
    expect(rejected.responseJson).toEqual([]);
    await expect(page.getByTestId('events-delete-error')).toContainText('Event not found or not yours to delete');

    await log.step('Let a failed Refresh settle after Settings has unmounted');
    const refresh = eventsRefreshControl.holdNextLoad('failure');
    await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
    await refresh.waitForPending();
    await expect(page.getByTestId('events-delete-confirmation')).toHaveCount(0);
    await leaveForMood(page);
    refresh.release();
    expect(await refresh.waitForCompleted()).toEqual([400, 400]);
    const settled = await waitForEventsSettlement(page);
    expect(settled).toEqual({
      ids: [stale.id, witness.id].sort(), loading: false, error: injectedLoadError, view: 'mood',
    });
    await expect(page.getByTestId('mood-tracker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Happy mood', exact: true })).toBeFocused();
    await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);

    await navigateTo(page, 'settings');
    const recovered = await waitForEventsSettlement(page);
    expect(recovered).toEqual({ ids: [witness.id], loading: false, error: null, view: 'settings' });
    await expect(page.getByTestId(`event-row-${witness.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-row-${stale.id}`)).toHaveCount(0);
    await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeEnabled();
  });

  for (const outcome of ['success', 'failure'] as const) {
    const id = outcome === 'success' ? 'DW-57-E2E-003' : 'DW-57-E2E-004';
    test(`[P1] ${id} pending Retry settles with ${outcome} after navigating to Mood`, expectedLoadFailure, async ({
      page, coupleEvents, eventsRefreshControl,
    }) => {
      const [witness] = await coupleEvents.seed([{ label: `DW57 retry ${outcome}`, dayOffset: 21 }]);
      await log.step('Fail both initial Settings load windows and expose Retry');
      expect(await openFailedSettings(page, eventsRefreshControl)).toEqual([400, 400, 400, 400]);
      expect(await eventsSnapshot(page)).toEqual({
        ids: [], loading: false, error: injectedLoadError, view: 'settings',
      });

      await log.step(`Hold Retry, unmount Settings, then release its ${outcome} response`);
      const retry = eventsRefreshControl.holdNextLoad(outcome);
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await retry.waitForPending();
      await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'true');
      await leaveForMood(page);
      retry.release();
      expect(await retry.waitForCompleted()).toEqual(outcome === 'success' ? [200, 200] : [400, 400]);
      const settled = await waitForEventsSettlement(page);
      expect(settled).toEqual({
        ids: outcome === 'success' ? [witness.id] : [],
        loading: false,
        error: outcome === 'success' ? null : injectedLoadError,
        view: 'mood',
      });
      await expect(page.getByTestId('mood-tracker')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Happy mood', exact: true })).toBeFocused();
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);

      await navigateTo(page, 'settings');
      const recovered = await waitForEventsSettlement(page);
      expect(recovered).toEqual({ ids: [witness.id], loading: false, error: null, view: 'settings' });
      await expect(page.getByTestId(`event-row-${witness.id}`)).toBeVisible();
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeEnabled();
    });
  }

  test('[P2] DW-57-E2E-005 mounted Retry fails then succeeds and restores native focus', expectedLoadFailure, async ({
    page, coupleEvents, eventsRefreshControl,
  }) => {
    const [witness] = await coupleEvents.seed([{ label: 'DW57 mounted retry', dayOffset: 21 }]);
    await log.step('Start from an empty failed load under the app StrictMode');
    expect(await openFailedSettings(page, eventsRefreshControl)).toEqual([400, 400, 400, 400]);
    expect(await eventsSnapshot(page)).toEqual({
      ids: [], loading: false, error: injectedLoadError, view: 'settings',
    });

    await log.step('A failed manual Retry restores an enabled, focused Retry control');
    const failure = eventsRefreshControl.holdNextLoad('failure');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await failure.waitForPending();
    await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'true');
    failure.release();
    expect(await failure.waitForCompleted()).toEqual([400, 400]);
    const failed = await waitForEventsSettlement(page);
    expect(failed).toEqual({ ids: [], loading: false, error: injectedLoadError, view: 'settings' });
    await expect(page.getByTestId('events-settings-load-error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeFocused();

    await log.step('A second Retry recovers the event list and focuses the surviving Add control');
    const recovery = eventsRefreshControl.holdNextLoad('success');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await recovery.waitForPending();
    recovery.release();
    expect(await recovery.waitForCompleted()).toEqual([200, 200]);
    const recovered = await waitForEventsSettlement(page);
    expect(recovered).toEqual({ ids: [witness.id], loading: false, error: null, view: 'settings' });
    await expect(page.getByTestId(`event-row-${witness.id}`)).toBeVisible();
    await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add event', exact: true })).toBeFocused();
  });
});
