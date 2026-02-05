/**
 * Playwright Auth Setup
 *
 * Authenticates as test user 1 and saves storageState for E2E tests.
 * Runs once before all chromium tests via the 'setup' project dependency.
 *
 * Requires test users to exist in local Supabase with known credentials.
 * Password can be set via: supabase admin API or scripts/setup-test-users.js
 */
import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/.auth/user.json';

setup('authenticate as test user 1', async ({ page }) => {
  await page.goto('/');

  // Fill login form
  await page.getByRole('textbox', { name: 'Email' }).fill('testuser1@test.example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('testpassword123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for authenticated state — login page disappears
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeHidden({
    timeout: 15_000,
  });

  // Save auth state (includes localStorage with Supabase session)
  await page.context().storageState({ path: authFile });
});
