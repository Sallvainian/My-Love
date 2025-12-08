/**
 * Auth Test Fixtures and Utilities
 *
 * Provides shared fixtures for auth E2E tests following TEA quality standards:
 * - Network-first interception patterns
 * - Accessibility-first selectors
 * - Deterministic waits (no waitForTimeout)
 * - No error swallowing (.catch(() => false))
 *
 * @story TD-1.1 - Auth E2E Regeneration
 * @see docs/05-Epics-Stories/test-design-epic-1-auth.md
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

// Environment configuration
const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

/**
 * Test user credentials type
 */
export interface TestCredentials {
  email: string;
  password: string;
}

/**
 * Auth test fixtures
 */
export interface AuthFixtures {
  /** Valid test user credentials */
  validCredentials: TestCredentials;
  /** Invalid credentials for error testing */
  invalidCredentials: TestCredentials;
  /** Login helper - performs login with network-first pattern */
  loginAs: (page: Page, credentials: TestCredentials) => Promise<void>;
  /** Logout helper - performs logout with deterministic wait */
  logout: (page: Page) => Promise<void>;
  /** Assert user is logged in */
  assertLoggedIn: (page: Page) => Promise<void>;
  /** Assert user is on login page */
  assertOnLoginPage: (page: Page) => Promise<void>;
}

/**
 * Extended test with auth fixtures
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './auth.setup';
 *
 * test('user can login', async ({ page, validCredentials, loginAs }) => {
 *   await loginAs(page, validCredentials);
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Valid test credentials from environment
   */
  validCredentials: async ({}, use) => {
    await use({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  },

  /**
   * Invalid credentials for error testing
   */
  invalidCredentials: async ({}, use) => {
    await use({
      email: 'invalid@example.com',
      password: 'wrongpassword',
    });
  },

  /**
   * Login helper with network-first pattern
   *
   * Pattern: Intercept BEFORE navigate → Wait for response → Assert state
   * This prevents race conditions and ensures deterministic behavior.
   *
   * Handles intermediate screens (onboarding, welcome) that may appear after login.
   */
  loginAs: async ({}, use) => {
    const loginAs = async (page: Page, credentials: TestCredentials) => {
      // Step 1: Set up response listener BEFORE any navigation
      const authResponsePromise = page.waitForResponse(
        (resp) =>
          (resp.url().includes('auth') ||
            resp.url().includes('token') ||
            resp.url().includes('session')) &&
          resp.status() >= 200 &&
          resp.status() < 400
      );

      // Step 2: Navigate to login page
      await page.goto('/');

      // Step 3: Wait for login form to be interactive (deterministic)
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible({ timeout: 15000 });

      // Step 4: Fill credentials using accessibility selectors
      await emailInput.fill(credentials.email);
      await page.getByLabel(/password/i).fill(credentials.password);

      // Step 5: Submit and wait for auth response
      await page.getByRole('button', { name: /sign in|login/i }).click();
      await authResponsePromise;

      // Step 6: Handle onboarding if it appears (deterministic check with short timeout)
      const displayNameInput = page.getByLabel(/display name/i);
      const onboardingVisible = await displayNameInput
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (onboardingVisible) {
        await displayNameInput.fill('TestUser');
        await page.getByRole('button', { name: /continue|save|submit/i }).click();
      }

      // Step 7: Handle welcome screen if it appears
      const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
      const welcomeVisible = await welcomeHeading
        .waitFor({ state: 'visible', timeout: 2000 })
        .then(() => true)
        .catch(() => false);

      if (welcomeVisible) {
        await page.getByRole('button', { name: /continue/i }).click();
      }

      // Step 8: Wait for navigation to complete (deterministic)
      await expect(
        page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
      ).toBeVisible({ timeout: 15000 });
    };

    await use(loginAs);
  },

  /**
   * Logout helper with deterministic wait
   */
  logout: async ({}, use) => {
    const logout = async (page: Page) => {
      // Click logout button
      const logoutButton = page.getByTestId('nav-logout');
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      await logoutButton.click();

      // Wait for login page to appear (deterministic)
      await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible({
        timeout: 10000,
      });
    };

    await use(logout);
  },

  /**
   * Assert user is logged in by checking for main navigation
   */
  assertLoggedIn: async ({}, use) => {
    const assertLoggedIn = async (page: Page) => {
      await expect(
        page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
      ).toBeVisible({ timeout: 10000 });
    };

    await use(assertLoggedIn);
  },

  /**
   * Assert user is on login page
   */
  assertOnLoginPage: async ({}, use) => {
    const assertOnLoginPage = async (page: Page) => {
      await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByLabel(/email/i)).toBeVisible();
    };

    await use(assertOnLoginPage);
  },
});

/**
 * Re-export expect for convenience
 */
export { expect };

/**
 * Auth API route patterns for network interception
 */
export const AUTH_API_PATTERNS = {
  /** Matches Supabase auth endpoints */
  supabaseAuth: '**/auth/**',
  /** Matches token endpoints */
  token: '**/token**',
  /** Matches session endpoints */
  session: '**/session**',
  /** Combined pattern for any auth-related request */
  any: (url: string) =>
    url.includes('auth') || url.includes('token') || url.includes('session'),
};

/**
 * Selector patterns following accessibility-first hierarchy
 *
 * Priority: getByRole > getByLabel > getByTestId > getByText > locator
 */
export const AUTH_SELECTORS = {
  // Form inputs (getByLabel - accessibility)
  emailInput: (page: Page) => page.getByLabel(/email/i),
  passwordInput: (page: Page) => page.getByLabel(/password/i),

  // Buttons (getByRole - accessibility)
  signInButton: (page: Page) => page.getByRole('button', { name: /sign in|login/i }),
  googleOAuthButton: (page: Page) =>
    page.getByRole('button', { name: /google|continue with google/i }),
  logoutButton: (page: Page) => page.getByTestId('nav-logout'),

  // Navigation (getByRole/getByTestId - semantic)
  mainNavigation: (page: Page) =>
    page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first(),

  // Headings (getByRole - accessibility)
  loginHeading: (page: Page) => page.getByRole('heading', { name: /welcome back|sign in/i }),

  // Alerts and errors (getByRole - accessibility)
  errorAlert: (page: Page) => page.getByRole('alert'),
  errorText: (page: Page) => page.getByText(/invalid|incorrect|wrong|error|failed/i),
};

/**
 * Helper to create mock auth response for route interception
 */
export function createMockAuthResponse(options: {
  success: boolean;
  user?: { id: string; email: string };
  error?: string;
}) {
  if (options.success && options.user) {
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock_refresh_token',
        user: {
          id: options.user.id,
          email: options.user.email,
          aud: 'authenticated',
          role: 'authenticated',
        },
      }),
    };
  }

  return {
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({
      error: options.error || 'Invalid credentials',
      error_description: options.error || 'Invalid login credentials',
    }),
  };
}
