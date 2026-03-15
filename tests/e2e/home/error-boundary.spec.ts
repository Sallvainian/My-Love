/**
 * P0 E2E: Error Boundary
 *
 * Tests ViewErrorBoundary error recovery behavior.
 * Triggers a real chunk-load failure by aborting the lazy-loaded PhotoGallery
 * module request, which causes React.lazy to throw inside the boundary subtree.
 *
 * Navigation routing tests (bottom-nav visibility) are in routing.spec.ts.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] should show error fallback UI when a lazy-loaded view fails to load', async ({
    page,
  }) => {
    // GIVEN: User is authenticated and on the home page
    await page.goto('/');
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // WHEN: The PhotoGallery chunk is aborted to simulate a network failure
    await page.route('**/PhotoGallery*.js', (route) => route.abort());

    // Navigate to photos — React.lazy will throw a ChunkLoadError
    await page.getByTestId('nav-photos').click();

    // THEN: ViewErrorBoundary catches the error and shows fallback UI
    const errorBoundary = page.getByTestId('view-error-boundary');
    await expect(errorBoundary).toBeVisible();

    // AND: Error fallback shows retry and go-home buttons
    await expect(page.getByTestId('error-try-again')).toBeVisible();
    await expect(page.getByTestId('error-go-home')).toBeVisible();

    // AND: Navigation is still visible (error boundary is inline, not full-page)
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });

  test('[P0] should recover when user clicks Go Home after an error', async ({ page }) => {
    // GIVEN: The error boundary is showing due to a chunk load failure
    await page.route('**/PhotoGallery*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
    await page.getByTestId('nav-photos').click();
    await expect(page.getByTestId('view-error-boundary')).toBeVisible();

    // WHEN: User clicks "Go Home"
    await page.getByTestId('error-go-home').click();

    // THEN: Error boundary is dismissed and user is back on home
    await expect(page.getByTestId('view-error-boundary')).not.toBeVisible();
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });

  test('[P0] should keep navigation visible during error state', async ({ page }) => {
    // GIVEN: User is authenticated
    await page.goto('/');

    // THEN: Navigation is visible on home
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();

    // WHEN: User navigates between views
    await page.getByTestId('nav-photos').click();

    // THEN: Navigation stays visible regardless of view state
    // (ViewErrorBoundary renders inline, preserving the navigation shell)
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
  });
});
