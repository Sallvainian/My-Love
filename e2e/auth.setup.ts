/**
 * Playwright Authentication Setup
 *
 * Uses project dependencies pattern (recommended approach).
 * Performs one-time authentication before all tests run.
 * Saves session state to storageState.json for reuse across tests.
 *
 * @see https://playwright.dev/docs/auth
 * @see https://playwright.dev/docs/test-global-setup-teardown#option-1-project-dependencies
 */

import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from '@dotenvx/dotenvx';

// Load environment variables
config();
config({ path: '.env.test', override: true });

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';
const PARTNER_EMAIL = process.env.VITE_TEST_PARTNER_EMAIL;
const STORAGE_STATE_PATH = './e2e/.auth/storageState.json';

// Supabase credentials for partner setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Ensure test users have a partner relationship configured.
 * Uses Supabase admin client to link test user to partner user.
 */
async function ensurePartnerRelationship() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PARTNER_EMAIL) {
    console.log('   ⚠️ Partner setup skipped - missing env vars');
    return;
  }

  console.log('   Setting up partner relationship...');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Get test user ID
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const testUser = users?.users?.find((u) => u.email === TEST_EMAIL);
    const partnerUser = users?.users?.find((u) => u.email === PARTNER_EMAIL);

    if (!testUser || !partnerUser) {
      console.log('   ⚠️ Could not find test users in auth');
      return;
    }

    // Check if partner already configured
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('partner_id')
      .eq('id', testUser.id)
      .single();

    if (existingUser?.partner_id === partnerUser.id) {
      console.log('   Partner already configured ✓');
      return;
    }

    // Update test user to have partner relationship
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ partner_id: partnerUser.id })
      .eq('id', testUser.id);

    if (updateError) {
      console.log(`   ⚠️ Could not set partner: ${updateError.message}`);
      return;
    }

    // Also set partner's partner_id to test user (bidirectional)
    await supabaseAdmin
      .from('users')
      .update({ partner_id: testUser.id })
      .eq('id', partnerUser.id);

    console.log('   Partner relationship configured ✓');
  } catch (error) {
    console.log(`   ⚠️ Partner setup error: ${error}`);
  }
}

setup('authenticate', async ({ page }) => {
  // First, ensure partner relationship is configured
  await ensurePartnerRelationship();

  // Navigate to login page
  await page.goto('/');

  // Wait for login form
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });

  // Fill login form
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Handle onboarding if needed
  const displayNameInput = page.getByLabel(/display name/i);
  const onboardingVisible = await displayNameInput
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (onboardingVisible) {
    await displayNameInput.fill('TestUser');
    await page.getByRole('button', { name: /continue|save|submit/i }).click();
  }

  // Handle welcome/intro screen if needed
  const welcomeHeading = page.getByRole('heading', {
    name: /welcome to your app/i,
  });
  const welcomeVisible = await welcomeHeading
    .waitFor({ state: 'visible', timeout: 2000 })
    .then(() => true)
    .catch(() => false);

  if (welcomeVisible) {
    await page.getByRole('button', { name: /continue/i }).click();
  }

  // Wait for app navigation to be visible (confirms successful login)
  await expect(
    page.locator('nav, [data-testid="bottom-navigation"]').first()
  ).toBeVisible({ timeout: 20000 });

  // Save storage state
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
