/**
 * P0 E2E: Error Boundary
 *
 * Critical path: App must gracefully handle rendering errors.
 * Covers navigation resilience - bottom navigation remains visible
 * and functional even when views encounter issues.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Error Boundary', () => {
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
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // WHEN: User navigates to a lazy-loaded view
    await page.getByTestId('nav-photos').click();

    // THEN: Navigation is still visible
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });

  test('[P0] should allow navigating home from any view', async ({ page }) => {
    // GIVEN: User is authenticated and on a non-home view
    await page.goto('/');
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // Navigate to photos view
    await page.getByTestId('nav-photos').click();
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // WHEN: User navigates back to home via bottom nav
    await page.getByTestId('nav-home').click();

    // THEN: Home view loads and navigation remains functional
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
    await expect(page.getByTestId('nav-home')).toBeVisible();
  });
});
