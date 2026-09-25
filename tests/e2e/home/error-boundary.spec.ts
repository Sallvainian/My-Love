/**
 * P0 E2E: View error boundary
 *
 * Critical path: when a lazy-loaded view fails, `ViewErrorBoundary`
 * (src/components/ViewErrorBoundary/ViewErrorBoundary.tsx, wrapping the lazy
 * views in src/App.tsx) replaces only that view with its fallback. The bottom
 * dock stays visible and Go Home returns to the home view.
 *
 * The failure is real, not simulated in the store: Playwright intercepts the
 * dev server's request for the Photos module, `PhotoGallery.tsx`, which
 * `React.lazy` imports on the first visit to Photos. Aborting that request is
 * a failed dynamic import, the chunk-load case the fallback words as offline.
 * Answering it with a module that throws while it evaluates is any other
 * render-time error, which the fallback names and prints.
 *
 * Neither test asserts that Try Again recovers: `React.lazy` caches the
 * rejected import, so a retry in the same page fails again by design.
 *
 * Plain navigation between views, with no failure, is covered by
 * home/routing.spec.ts.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';

/** The Photos view's module as the dev server serves it, with or without a query. */
const PHOTO_GALLERY_MODULE = '**/src/components/PhotoGallery/PhotoGallery.tsx*';

test.describe('Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome splash
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    });
  });

  test('[P0] shows the view error and keeps the dock when a view throws while loading', async ({ page }) => {
    // GIVEN: The Photos module evaluates to a thrown error.
    await page.route(PHOTO_GALLERY_MODULE, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: 'throw new Error("E2E forced view failure");',
      })
    );
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // WHEN: The user opens Photos.
    await navigateTo(page, 'photos');

    // THEN: The boundary names the view and shows the error, and the dock stays.
    const boundary = page.getByTestId('view-error-boundary');
    await expect(boundary).toBeVisible();
    await expect(boundary.getByRole('heading')).toHaveText('Error loading photos');
    await expect(boundary).toContainText('E2E forced view failure');
    await expect(page.getByTestId('nav-dock')).toBeVisible();
  });

  test('[P0] shows the offline fallback when a view module fails to load, and Go Home returns home', async ({ page }) => {
    // GIVEN: The request for the Photos module fails, as it does offline.
    await page.route(PHOTO_GALLERY_MODULE, (route) => route.abort());
    await page.goto('/');
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // WHEN: The user opens Photos.
    await navigateTo(page, 'photos');

    // THEN: The boundary shows the chunk-load fallback, and the dock stays.
    const boundary = page.getByTestId('view-error-boundary');
    await expect(boundary).toBeVisible();
    await expect(boundary.getByRole('heading')).toHaveText("Can't load this page offline");
    await expect(page.getByTestId('nav-dock')).toBeVisible();

    // AND: Go Home leaves the failed view for the home view.
    await page.getByTestId('error-go-home').click();
    await expect(page.getByTestId('time-together')).toBeVisible();
    await expect(boundary).toHaveCount(0);
  });
});
