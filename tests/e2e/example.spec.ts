/**
 * Example E2E Test Suite
 *
 * Demonstrates recommended patterns using merged fixtures.
 * Delete this file once you have real tests.
 */
import { test, expect } from '../support/merged-fixtures';

test.describe('Homepage', () => {
  test('should load and display the application', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify page loads', async () => {
      // Adjust this assertion to match your actual app title
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

test.describe('API Health Check', () => {
  test.skip('should be able to make API requests', async ({ apiRequest }) => {
    // TODO: Configure BASE_URL or VITE_SUPABASE_URL for API tests
    // Example: Check Supabase health endpoint
    const { status } = await apiRequest({
      method: 'GET',
      path: '/',
      baseURL: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    });

    expect([200, 404]).toContain(status);
  });
});

test.describe('Authentication Flow', () => {
  test.skip('should login with valid credentials', async ({ page }) => {
    // TODO: Implement after auth fixtures are configured
    await test.step('Navigate to login page', async () => {
      await page.goto('/login');
    });

    await test.step('Fill credentials', async () => {
      // await page.fill('[data-testid="email"]', 'test@example.com');
      // await page.fill('[data-testid="password"]', 'password');
      // await page.click('[data-testid="login-button"]');
    });

    await test.step('Verify redirect to dashboard', async () => {
      // await expect(page).toHaveURL(/dashboard|home/);
    });
  });
});
