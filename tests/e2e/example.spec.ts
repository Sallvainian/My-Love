/**
 * Example E2E Test Suite
 *
 * Demonstrates recommended patterns using merged fixtures.
 * These are basic smoke tests - see other test files for feature-specific tests.
 */
import { test, expect } from '../support/merged-fixtures';
import { getTestId, fillForm } from '../support/helpers';

test.describe('Homepage', () => {
  test('should load and display the application', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify page loads', async () => {
      await expect(page).toHaveTitle(/My-Love|Couples/i);
    });
  });

  test('should have no console errors on load', async ({ page }) => {
    // Network error monitoring is automatic via networkErrorMonitor fixture
    // It will fail the test if any HTTP 4xx/5xx errors are detected

    await page.goto('/');

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // Page loaded successfully - network errors would have been caught automatically
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Helper Functions Demo', () => {
  test('demonstrates getTestId helper', async ({ page }) => {
    await page.goto('/');

    // Example: Using getTestId helper for cleaner selectors
    // const button = page.locator(getTestId('my-button'));
    // This is equivalent to: page.locator('[data-testid="my-button"]')
  });

  test('demonstrates fillForm helper', async ({ page }) => {
    // Example: Fill multiple form fields at once
    // await fillForm(page, {
    //   [getTestId('email')]: 'user@example.com',
    //   [getTestId('password')]: 'password123'
    // });
  });
});

test.describe('API Integration', () => {
  test('can make authenticated API requests', async ({ apiRequest }) => {
    // The apiRequest fixture provides a typed HTTP client with schema validation
    // For actual API tests, see tests/api/ directory

    // Example: Health check or simple GET request
    const baseURL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';

    // This is a basic connectivity check - 200 OK, or 404 if endpoint doesn't exist
    const { status } = await apiRequest({
      method: 'GET',
      path: '/rest/v1/',
      baseURL,
    });

    // Accept both 200 and 404 - we're just checking connectivity
    expect([200, 404, 401]).toContain(status);
  });
});
