/**
 * P0 E2E: Authentication - Display Name Setup
 *
 * Critical path: New OAuth users must set display name before using app.
 * Covers display name modal and submission.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Display Name Setup', () => {
  test('[P0] should show display name setup for new OAuth users', async ({ page }) => {
    // GIVEN: User signed up via Google OAuth without display name
    // WHEN: App loads after OAuth redirect
    // THEN: Display name setup modal is shown
    test.skip();
  });

  test('[P0] should allow setting display name and proceed to app', async ({ page }) => {
    // GIVEN: Display name setup modal is shown
    // WHEN: User enters display name and submits
    // THEN: Modal closes and main app is displayed
    test.skip();
  });
});
