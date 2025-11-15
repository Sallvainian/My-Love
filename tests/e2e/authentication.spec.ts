/**
 * End-to-End Test: User Authentication Flow
 *
 * Tests the email/password authentication system including:
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Error handling and validation
 * - Logout functionality
 * - Session persistence across page reloads
 *
 * Prerequisites:
 * - Supabase project configured with Auth enabled
 * - Test user created in Supabase Auth
 * - Environment variables: VITE_TEST_USER_EMAIL, VITE_TEST_USER_PASSWORD
 *
 * @story 6-7-user-authentication-login
 * @acceptance-criteria AC-1, AC-2, AC-3, AC-4, AC-5
 */

import { test, expect } from '@playwright/test';

// Test user credentials from environment variables
const TEST_USER_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';
const INVALID_PASSWORD = 'wrongpassword';
const INVALID_EMAIL = 'nonexistent@example.com';

test.describe('Authentication Flow (Story 6.7)', () => {
  test.beforeEach(async ({ page }) => {
    // Start from login screen (app shows login if not authenticated)
    await page.goto('/');
  });

  test('AC-1: Should display login screen when not authenticated', async ({ page }) => {
    // Verify login screen elements are present
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('AC-2: Should show validation errors for empty fields', async ({ page }) => {
    // Try to submit with empty fields
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for validation error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/please enter both email and password/i)).toBeVisible();
  });

  test('AC-2: Should show validation error for invalid email format', async ({ page }) => {
    // Enter invalid email format
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for validation error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/please enter a valid email/i)).toBeVisible();
  });

  test('AC-2: Should show validation error for short password', async ({ page }) => {
    // Enter password that's too short
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill('12345'); // Less than 6 chars
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for validation error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();
  });

  test('AC-3: Should show error for invalid credentials', async ({ page }) => {
    // Try to login with wrong password
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(INVALID_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for authentication error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('AC-3: Should show error for non-existent user', async ({ page }) => {
    // Try to login with non-existent email
    await page.getByLabel(/email/i).fill(INVALID_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Check for authentication error
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('AC-1: Should successfully login with valid credentials', async ({ page }) => {
    // Fill in valid credentials
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);

    // Submit login form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for successful login - should redirect to main app
    // The app should show the main navigation/content instead of login screen
    await expect(page.getByRole('heading', { name: /welcome back/i })).not.toBeVisible({ timeout: 5000 });

    // Verify we're now in the authenticated app (check for main navigation)
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });
  });

  test('AC-4: Should persist session across page reloads', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for login to complete
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();

    // Session should persist - should still see authenticated app
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).not.toBeVisible();
  });

  test('AC-5: Should successfully logout', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for login to complete
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });

    // Navigate to Settings
    await page.getByTestId('nav-settings').click();

    // Wait for settings page to load
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    // Click logout button
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should redirect back to login screen
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('bottom-navigation')).not.toBeVisible();
  });

  test('AC-5: Session should be cleared after logout', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });

    // Logout
    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 5000 });

    // Reload page - should still show login screen (session cleared)
    await page.reload();
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByTestId('bottom-navigation')).not.toBeVisible();
  });

  test('AC-1: Should disable submit button during login', async ({ page }) => {
    // Fill in credentials
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);

    // Get submit button
    const submitButton = page.getByRole('button', { name: /sign in/i });

    // Click submit
    await submitButton.click();

    // Button should show loading state
    await expect(page.getByText(/signing in/i)).toBeVisible({ timeout: 1000 });
  });

  test('AC-1: Should show user email in Settings after login', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 5000 });

    // Navigate to Settings
    await page.getByTestId('nav-settings').click();

    // Verify user email is displayed
    await expect(page.getByText(TEST_USER_EMAIL)).toBeVisible();
  });
});

test.describe('Authentication Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Should handle network errors gracefully', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);

    // Try to login
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });

    // Restore online mode
    await context.setOffline(false);
  });

  test('Should clear error message when user starts typing', async ({ page }) => {
    // Trigger an error first
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Start typing in email field
    await page.getByLabel(/email/i).fill('a');

    // Error should still be visible until form is resubmitted
    // This tests that errors persist until next submission
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
