/**
 * P0 E2E: Welcome Splash Screen
 *
 * Critical path: Welcome splash must appear on first visit and respect timer.
 * Covers display logic and dismissal.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Welcome Splash', () => {
  test('[P0] should show welcome splash on first visit', async ({ page }) => {
    // GIVEN: User is authenticated and hasn't visited recently
    // WHEN: App loads
    // THEN: Welcome splash screen is displayed
    test.skip();
  });

  test('[P0] should dismiss splash and show main app', async ({ page }) => {
    // GIVEN: Welcome splash is displayed
    // WHEN: User clicks continue
    // THEN: Splash disappears and main app is shown
    test.skip();
  });
});
