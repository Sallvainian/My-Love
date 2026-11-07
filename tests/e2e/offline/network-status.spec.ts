/**
 * P0 E2E: Offline Support - Network Status
 *
 * Critical path: App must indicate network status and work offline.
 * Covers offline banner and graceful degradation.
 *
 * Test IDs: 4.6-E2E-001, 4.6-E2E-002
 */
import { test, expect } from '../../support/merged-fixtures';

// Disable tracing for offline tests - Playwright trace recording
// corrupts when the browser context goes offline, causing ENOENT errors.
test.use({ trace: 'off', video: 'off' });

test.describe('Network Status', () => {
  test('[P0] 4.6-E2E-001 should show offline indicator when network is disconnected', async ({
    page,
    context,
  }) => {
    // GIVEN: User is authenticated and on Daily, with the app-wide banner hidden
    await page.goto('/daily');
    await expect(page.getByTestId('daily-question-view')).toBeVisible();
    await expect(page.getByTestId('network-status-banner')).toHaveCount(0);

    // WHEN: Network connection is lost
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // THEN: The app-wide offline banner is visible
    await expect(page.getByTestId('network-status-banner')).toBeVisible();
    await expect(page.getByTestId('network-status-label')).toHaveText('Offline');

    // Cleanup
    await context.setOffline(false);
  });

  test('[P0] 4.6-E2E-002 should hide offline indicator when network reconnects', async ({
    page,
    context,
  }) => {
    // GIVEN: User is on Daily
    await page.goto('/daily');
    await expect(page.getByTestId('daily-question-view')).toBeVisible();
    await expect(page.getByTestId('network-status-banner')).toHaveCount(0);

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('network-status-banner')).toBeVisible();
    await expect(page.getByTestId('network-status-label')).toHaveText('Offline');

    // WHEN: Network reconnects
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // THEN: The banner goes away again
    await expect(page.getByTestId('network-status-banner')).toHaveCount(0);
  });
});
