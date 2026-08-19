/**
 * P0 E2E: Error Boundary
 *
 * Critical path: App must gracefully handle rendering errors.
 * Covers navigation resilience - the app chrome remains visible
 * and functional even when views encounter issues.
 *
 * NOTE: these two bodies are byte-identical to home/routing.spec.ts and were
 * before this rewrite too; only the describe name differs. Recorded rather than
 * merged — deduplicating them is not part of the navigation change.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

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
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

    // WHEN: User navigates to a lazy-loaded view
    await navigateTo(page, 'photos');

    // THEN: Navigation is still visible
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();
  });

  test('[P0] should allow navigating home from any view', async ({ page }) => {
    // GIVEN: User is authenticated and on a non-home view
    await page.goto('/');
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

    // Navigate to photos view
    await navigateTo(page, 'photos');
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();

    // WHEN: User navigates back to home via the tray
    await navigateTo(page, 'home');

    // THEN: Home view loads and navigation remains functional
    await expect(page.getByTestId('nav-menu-toggle')).toBeVisible();
    await expect(page.getByTestId('time-together')).toBeVisible();
  });
});
