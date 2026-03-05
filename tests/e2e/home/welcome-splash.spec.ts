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
    // Clear the lastWelcomeView key before navigation so splash appears
    await page.addInitScript(() => {
      localStorage.removeItem('lastWelcomeView');
    });

    // WHEN: App loads
    await page.goto('/');

    // THEN: Welcome splash screen is displayed
    await expect(page.getByTestId('welcome-splash')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('[P0] should dismiss splash and show main app', async ({ page }) => {
    // GIVEN: Welcome splash is displayed
    await page.addInitScript(() => {
      localStorage.removeItem('lastWelcomeView');
    });

    await page.goto('/');
    await expect(page.getByTestId('welcome-splash')).toBeVisible({ timeout: 5000 });

    // WHEN: User clicks continue
    await page.getByTestId('welcome-continue-button').click();

    // THEN: Splash disappears and main app is shown
    await expect(page.getByTestId('welcome-splash')).not.toBeVisible();
    await expect(page.getByTestId('app-container')).toBeVisible({ timeout: 5000 });
  });
});
