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
    // GIVEN: User is authenticated and on the mood tracker
    await page.goto('/mood');
    await expect(page.getByTestId('mood-tracker')).toBeVisible();

    // Verify initially shows "Online" in the sync status area
    await expect(page.getByTestId('mood-tracker').getByText('Online')).toBeVisible();

    // WHEN: Network connection is lost
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // THEN: Offline indicator is visible within the mood tracker sync status
    await expect(page.getByTestId('mood-tracker').getByText('Offline')).toBeVisible();

    // Cleanup
    await context.setOffline(false);
  });

  test('[P0] 4.6-E2E-002 should hide offline indicator when network reconnects', async ({
    page,
    context,
  }) => {
    // GIVEN: User is on mood tracker
    await page.goto('/mood');
    await expect(page.getByTestId('mood-tracker')).toBeVisible();
    await expect(page.getByTestId('mood-tracker').getByText('Online')).toBeVisible();

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('mood-tracker').getByText('Offline')).toBeVisible();

    // WHEN: Network reconnects
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // THEN: Online indicator shows again
    await expect(page.getByTestId('mood-tracker').getByText('Online')).toBeVisible();
  });
});
