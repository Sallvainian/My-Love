/**
 * P1 E2E: Settings event-load recovery
 *
 * Target path once activated: `tests/e2e/settings/events-settings-load-retry.spec.ts`.
 * These journeys cover the browser-to-store-to-service seam added by DW-27.
 * The component suite owns isolated Retry and stale-account behavior; this file
 * proves that real connectivity events and the real two-window PostgREST read
 * drive the mounted Settings surface correctly.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/fixtures/events-settings-load-retry';
import { navigateTo } from '../../support/helpers/navigation';

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash using the established Settings/Home E2E pattern.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

// The existing offline suite documents that trace/video recording can corrupt
// when Chromium is deliberately disconnected. These are worker-scoped options,
// so Playwright requires the opt-out at file scope.
test.use({ trace: 'off', video: 'off' });

test.describe('Settings event-load reconnect recovery', () => {
  test('[P1] DWER-E2E-001 preserves the last-good row and automatically recovers in place on reconnect', async ({
    page,
    interceptNetworkCall,
    eventsLoadRetryHarness,
    eventsLoadRetryBrowser,
  }) => {
    await log.step('Seed a real event for this worker pair');
    const [seeded] = await eventsLoadRetryHarness.seed([
      { dayOffset: 14, label: 'Settings Auto Recovery E2E' },
    ]);

    await log.step('Mount Settings and settle its real initial event load');
    await page.goto('/');
    await expect(page.getByText(seeded.label, { exact: true })).toBeVisible();
    await navigateTo(page, 'settings');

    const row = page.getByTestId(`event-row-${seeded.id}`);
    const notice = page.getByTestId('events-settings-load-error');
    const retry = page.getByTestId('events-settings-retry');
    const addEvent = page.getByRole('button', { name: 'Add event' });
    const loadRegion = page.getByTestId('events-settings-load-region');

    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(row).toBeVisible();
    await expect(loadRegion).toHaveAttribute('aria-busy', 'false');
    await expect(notice).toHaveCount(0);

    // Put focus on the stable control before the connectivity transition. The
    // automatic recovery must not strand or steal it while the notice mounts
    // and unmounts around the surviving list.
    await addEvent.focus();
    await expect(addEvent).toBeFocused();

    await log.step('Disconnect the browser and keep the last-good row visible after the reload fails');
    await eventsLoadRetryBrowser.goOffline();

    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText('try again');
    await expect(row).toBeVisible();
    await expect(retry).toBeEnabled();

    await log.step('Observe both live read windows before reconnecting the mounted view');
    const upcomingRecovery = interceptNetworkCall({
      method: 'GET',
      url: eventsLoadRetryBrowser.readPatterns.upcoming,
    });
    const pastRecovery = interceptNetworkCall({
      method: 'GET',
      url: eventsLoadRetryBrowser.readPatterns.past,
    });

    await eventsLoadRetryBrowser.goOnline();

    const [upcomingResult, pastResult] = await Promise.all([
      upcomingRecovery,
      pastRecovery,
    ]);
    expect(upcomingResult.status).toBe(200);
    expect(pastResult.status).toBe(200);

    await log.step('Verify automatic recovery settles without navigation or reload');
    await expect(notice).toHaveCount(0);
    await expect(retry).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(loadRegion).toHaveAttribute('aria-busy', 'false');
    await expect(addEvent).toBeFocused();
  });
});

test.describe('Settings event-load manual recovery', () => {
  test(
    '[P1] DWER-E2E-002 runs exactly one two-window load and restores focus after Retry succeeds',
    { annotation: [{ type: 'skipNetworkMonitoring' }] },
    async ({
      page,
      interceptNetworkCall,
      recurse,
      eventsLoadRetryHarness,
      eventsLoadRetryBrowser,
    }) => {
      await log.step('Seed a real event and let Home establish the last-known store snapshot');
      const [seeded] = await eventsLoadRetryHarness.seed([
        { dayOffset: 21, label: 'Settings Manual Recovery E2E' },
      ]);

      await page.goto('/');
      await expect(page.getByText(seeded.label, { exact: true })).toBeVisible();

      await log.step('Fail both exact Settings read windows before navigating to Settings');
      const rejectedUpcoming = interceptNetworkCall({
        method: 'GET',
        url: eventsLoadRetryBrowser.readPatterns.upcoming,
        fulfillResponse: {
          status: 503,
          body: {
            message: 'Injected Settings upcoming-window failure',
            details: '',
            hint: '',
            code: 'XX000',
          },
        },
      });
      const rejectedPast = interceptNetworkCall({
        method: 'GET',
        url: eventsLoadRetryBrowser.readPatterns.past,
        fulfillResponse: {
          status: 503,
          body: {
            message: 'Injected Settings past-window failure',
            details: '',
            hint: '',
            code: 'XX000',
          },
        },
      });

      await navigateTo(page, 'settings');
      const failedResults = await Promise.all([rejectedUpcoming, rejectedPast]);
      expect(failedResults.map(({ status }) => status)).toEqual([503, 503]);

      const row = page.getByTestId(`event-row-${seeded.id}`);
      const notice = page.getByTestId('events-settings-load-error');
      const retry = page.getByTestId('events-settings-retry');
      const addEvent = page.getByRole('button', { name: 'Add event' });

      await expect(notice).toHaveCount(1);
      await expect(row).toBeVisible();
      await expect(retry).toBeEnabled();
      await expect(retry).toHaveText('Retry');

      await log.step('Replace the injected failures with a teardown-safe live request gate');
      await eventsLoadRetryBrowser.removeReadInterceptors();
      const retryGate = eventsLoadRetryBrowser.createReadGate();
      const retryUpcoming = interceptNetworkCall({
        method: 'GET',
        url: eventsLoadRetryBrowser.readPatterns.upcoming,
        handler: retryGate.handler,
      });
      const retryPast = interceptNetworkCall({
        method: 'GET',
        url: eventsLoadRetryBrowser.readPatterns.past,
        handler: retryGate.handler,
      });

      await retry.focus();

      try {
        await log.step('Activate Retry once and hold both live reads in flight');
        await retry.click();

        await expect(retry).toBeDisabled();
        await expect(retry).toHaveText('Retrying…');
        // A single non-retrying read catches any transient blank while the two
        // gated requests are unresolved.
        expect(await row.isVisible()).toBe(true);

        await recurse(
          async () => retryGate.counts(),
          ({ total }) => total === 2,
          {
            timeout: 5_000,
            interval: 50,
            log: 'Waiting for the upcoming and past Retry reads',
          }
        );

        expect(retryGate.counts()).toEqual({ upcoming: 1, past: 1, total: 2 });
        await Promise.all([retryUpcoming, retryPast]);
      } finally {
        // The fixture also releases outstanding gates during teardown; this
        // finally keeps a failed assertion from leaving the app request hung.
        retryGate.release();
      }

      await log.step('Verify the successful Retry owns the settled UI state');
      await expect(notice).toHaveCount(0);
      await expect(retry).toHaveCount(0);
      await expect(row).toBeVisible();
      await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute(
        'aria-busy',
        'false'
      );
      await expect(addEvent).toBeFocused();
      expect(retryGate.counts()).toEqual({ upcoming: 1, past: 1, total: 2 });
    }
  );
});
