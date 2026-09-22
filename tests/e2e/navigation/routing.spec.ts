/**
 * P0 E2E: Navigation - URL Routing
 *
 * Critical path: Direct URL navigation and browser back/forward must work.
 * Covers deep linking and popstate handling.
 *
 * The readiness proxy is `nav-dock`: the bottom dock is on screen on every
 * view, the role the retired bar's container testid played.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

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

    // THEN: Mood view is loaded (app chrome is visible)
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // AND: The dock marks Mood as the current destination
    await expect(page.getByTestId('nav-mood')).toHaveAttribute('aria-current', 'page');
  });

  test('[P0] should support browser back button', async ({ page }) => {
    // GIVEN: User navigated from home to photos to mood
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // Navigate to photos
    await navigateTo(page, 'photos');
    await page.waitForURL('**/photos');

    // Navigate to mood
    await navigateTo(page, 'mood');
    await page.waitForURL('**/mood');

    // WHEN: User clicks browser back button
    await page.goBack();

    // THEN: Previous view is displayed (URL goes back to /photos)
    await page.waitForURL('**/photos');
    await expect(page.getByTestId('nav-dock')).toBeVisible();
  });

  test('[P0] should fallback to home view for unknown routes', async ({ page }) => {
    // GIVEN: User navigates to an unknown route
    // WHEN: Page loads with unknown route
    await page.goto('/nonexistent-page');

    // THEN: Home view is displayed (app falls back to home)
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expect(page.getByTestId('time-together')).toBeVisible();
  });

  test('[P0] should show home and no scripture view on a direct /scripture load', async ({
    page,
  }) => {
    await page.goto('/scripture');

    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-scripture')).toHaveCount(0);
  });

  test('[P0] should show home and no scripture view on popstate to /scripture', async ({
    page,
  }) => {
    await page.goto('/scripture');
    await expect(page.getByTestId('time-together')).toBeVisible();

    await navigateTo(page, 'mood');
    await page.waitForURL('**/mood');

    await page.goBack();

    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-scripture')).toHaveCount(0);
  });
});
