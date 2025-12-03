/**
 * Multi-User Playwright Fixture
 *
 * Extends the base Playwright test to provide two authenticated browser contexts
 * for testing partner interactions like real-time mood updates, love notes, etc.
 *
 * Usage:
 * ```typescript
 * import { multiUserTest, expect } from '../fixtures/multi-user.fixture';
 *
 * multiUserTest('partner sees mood update in real-time', async ({
 *   primaryPage,
 *   partnerPage,
 *   primaryUserId,
 *   partnerUserId,
 * }) => {
 *   // primaryPage is authenticated as primary user
 *   // partnerPage is authenticated as partner user
 *   // Both are linked as partners
 * });
 * ```
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { ensurePartnerRelationship } from '../helpers/partner-setup';

// Environment variables
const PRIMARY_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'frank.cottone97@proton.me';
const PRIMARY_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'test123';
const PARTNER_EMAIL = process.env.VITE_TEST_PARTNER_EMAIL || 'fcottone97@gmail.com';
const PARTNER_PASSWORD = process.env.VITE_TEST_PARTNER_PASSWORD || 'test123';

// Type definitions for the fixture
interface MultiUserFixtures {
  /** Browser context for primary user */
  primaryContext: BrowserContext;
  /** Browser context for partner user */
  partnerContext: BrowserContext;
  /** Page authenticated as primary user */
  primaryPage: Page;
  /** Page authenticated as partner user */
  partnerPage: Page;
  /** Primary user's Supabase ID */
  primaryUserId: string;
  /** Partner user's Supabase ID */
  partnerUserId: string;
}

/**
 * Helper to login and complete onboarding for a user
 */
async function loginAndCompleteOnboarding(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/');

  // Wait for page to be fully loaded (critical for CI)
  await page.waitForLoadState('domcontentloaded');

  // Wait for login form to be ready
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15000 });

  // Fill login form
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait for response
  await page.waitForTimeout(2000);

  // Handle onboarding if needed
  const displayNameInput = page.getByLabel(/display name/i);
  if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const displayName = email.includes('testuser1') ? 'TestUser1' : 'TestUser2';
    await displayNameInput.fill(displayName);
    await page.getByRole('button', { name: /continue|save|submit/i }).click();
    await page.waitForTimeout(1000);
  }

  // Handle welcome screen if shown
  const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
  if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(1000);
  }

  // Wait for main navigation to appear
  await expect(
    page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Extended Playwright test with multi-user fixtures
 *
 * Provides:
 * - primaryPage: Page authenticated as primary test user
 * - partnerPage: Page authenticated as partner test user
 * - primaryUserId: UUID of primary user in Supabase
 * - partnerUserId: UUID of partner user in Supabase
 * - primaryContext: Browser context for primary user (for advanced scenarios)
 * - partnerContext: Browser context for partner user (for advanced scenarios)
 */
export const multiUserTest = base.extend<MultiUserFixtures>({
  // Set up partner relationship before all tests in the describe block
  primaryUserId: [
    async (_, use) => {
      const { primaryUserId } = await ensurePartnerRelationship(
        PRIMARY_EMAIL,
        PARTNER_EMAIL
      );
      await use(primaryUserId);
    },
    { scope: 'worker' }, // Share across all tests in worker
  ],

  partnerUserId: [
    async (_, use) => {
      const { partnerUserId } = await ensurePartnerRelationship(
        PRIMARY_EMAIL,
        PARTNER_EMAIL
      );
      await use(partnerUserId);
    },
    { scope: 'worker' }, // Share across all tests in worker
  ],

  // Create separate browser context for primary user
  primaryContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  // Create separate browser context for partner user
  partnerContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  // Create and authenticate primary page
  primaryPage: async ({ primaryContext }, use) => {
    const page = await primaryContext.newPage();
    await loginAndCompleteOnboarding(page, PRIMARY_EMAIL, PRIMARY_PASSWORD);
    await use(page);
    await page.close();
  },

  // Create and authenticate partner page
  partnerPage: async ({ partnerContext }, use) => {
    const page = await partnerContext.newPage();
    await loginAndCompleteOnboarding(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await use(page);
    await page.close();
  },
});

// Re-export expect for convenience
export { expect };

// Export credentials for tests that need them
export const testCredentials = {
  primary: {
    email: PRIMARY_EMAIL,
    password: PRIMARY_PASSWORD,
  },
  partner: {
    email: PARTNER_EMAIL,
    password: PARTNER_PASSWORD,
  },
};
