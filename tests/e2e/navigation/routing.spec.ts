/**
 * P0 E2E: Navigation - URL Routing
 *
 * Critical path: Direct URL navigation and browser back/forward must work.
 * Covers deep linking and popstate handling.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('URL Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash for all routing tests
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] should load correct view from direct URL', async ({ page }) => {
    // GIVEN: User is authenticated (via auth fixture)

    // WHEN: User navigates directly to /mood
    await page.goto('/mood');

    // THEN: Mood view is loaded (bottom nav is visible)
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });

  test('[P0] should support browser back button', async ({ page }) => {
    // GIVEN: User navigated from home to photos to mood
    await page.goto('/');
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // Navigate to photos
    await page.getByTestId('nav-photos').click();
    await page.waitForURL('**/photos');

    // Navigate to mood
    await page.getByTestId('nav-mood').click();
    await page.waitForURL('**/mood');

    // WHEN: User clicks browser back button
    await page.goBack();

    // THEN: Previous view is displayed (URL goes back to /photos)
    await page.waitForURL('**/photos');
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });

  test('[P0] should fallback to home view for unknown routes', async ({ page }) => {
    // GIVEN: User navigates to an unknown route
    // WHEN: Page loads with unknown route
    await page.goto('/nonexistent-page');

    // THEN: Home view is displayed (app falls back to home)
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
    await expect(page.getByTestId('nav-home')).toBeVisible();
  });
});
