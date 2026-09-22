/**
 * P0 E2E: Navigation Routing
 *
 * Tests app-chrome visibility and basic navigation between views.
 * Moved from error-boundary.spec.ts (which now tests actual error recovery).
 *
 * "Navigation stays visible through a lazy load" is carried by the bottom dock,
 * so `nav-dock` is the element that has to survive.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

test.describe('Navigation Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] should keep navigation visible when views load', async ({ page }) => {
    // GIVEN: User is authenticated (via auth fixture)
    await page.goto('/');

    // THEN: Navigation remains visible regardless of view state
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // WHEN: User navigates to a lazy-loaded view
    await navigateTo(page, 'photos');

    // THEN: Navigation is still visible
    await expect(page.getByTestId('nav-dock')).toBeVisible();
  });

  test('[P0] should allow navigating home from any view', async ({ page }) => {
    // GIVEN: User is authenticated and on a non-home view
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // Navigate to photos view
    await navigateTo(page, 'photos');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // WHEN: User navigates back to home via the dock
    await navigateTo(page, 'home');

    // THEN: Home view loads and navigation remains functional
    await expect(page.getByTestId('nav-dock')).toBeVisible();
    await expect(page.getByTestId('time-together')).toBeVisible();
  });
});
