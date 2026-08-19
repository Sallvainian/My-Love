/**
 * P0 E2E: Navigation - URL Routing
 *
 * Critical path: Direct URL navigation and browser back/forward must work.
 * Covers deep linking and popstate handling.
 *
 * The readiness proxy is `nav-menu-toggle`: the destinations now live inside a
 * tray that opens on demand, so the hamburger is the only navigation element
 * permanently on screen — the role the retired bar's container testid played.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo, openNavTray } from '../../support/helpers/navigation';

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
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

    // AND: The tray marks Mood as the current destination
    await openNavTray(page);
    await expect(page.getByTestId('nav-mood')).toHaveAttribute('aria-current', 'page');
  });

  test('[P0] should support browser back button', async ({ page }) => {
    // GIVEN: User navigated from home to photos to mood
    await page.goto('/');
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

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
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();
  });

  test('[P0] should fallback to home view for unknown routes', async ({ page }) => {
    // GIVEN: User navigates to an unknown route
    // WHEN: Page loads with unknown route
    await page.goto('/nonexistent-page');

    // THEN: Home view is displayed (app falls back to home)
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();
    await expect(page.getByTestId('time-together')).toBeVisible();
  });
});
