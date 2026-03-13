/**
 * P0 E2E: Authentication - Display Name Setup
 *
 * Critical path: New OAuth users must set display name before using app.
 * Covers display name modal and submission.
 *
 * NOTE: These tests require a dedicated test user created via Google OAuth
 * without a display_name in user_metadata. The display name flow is triggered
 * by Supabase's onAuthStateChange when user_metadata.display_name is falsy.
 * Network interception cannot mock this because the Supabase JS client manages
 * auth state internally. These tests are skipped until a test user without
 * display_name is provisioned in the auth pool.
 */
import { test } from '../../support/merged-fixtures';

test.describe('Display Name Setup', () => {
  test('[P0] should show display name setup for new OAuth users', async ({ page }) => {
    // GIVEN: User signed up via Google OAuth without display name
    // WHEN: App loads after OAuth redirect
    // THEN: Display name setup modal is shown
    // TODO: Requires a test user without display_name in user_metadata.
    test.skip();
  });

  test('[P0] should allow setting display name and proceed to app', async ({ page }) => {
    // GIVEN: Display name setup modal is shown
    // WHEN: User enters display name and submits
    // THEN: Modal closes and main app is displayed
    // TODO: Requires display name setup to be visible first (see above).
    test.skip();
  });
});
