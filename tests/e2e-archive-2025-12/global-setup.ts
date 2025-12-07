/**
 * Playwright Global Setup
 *
 * Performs one-time authentication before all tests run.
 * Also ensures test users have a partner relationship configured.
 * Saves session state to storageState.json for reuse across tests.
 */

import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from '@dotenvx/dotenvx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module compatibility: derive __dirname from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();
config({ path: '.env.test', override: true });

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';
const PARTNER_EMAIL = process.env.VITE_TEST_PARTNER_EMAIL;
const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'storageState.json');

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

async function globalSetup(playwrightConfig: FullConfig) {
  // Ensure auth directory exists
  const authDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('🔐 Global Setup: Starting authentication...');

  // First, ensure partner relationship is configured
  await ensurePartnerRelationship();

  // Get baseURL from top-level config use (not project-level, which doesn't have baseURL)
  // The top-level use.baseURL has the detected port from detectAppPort()
  const baseURL =
    playwrightConfig.use?.baseURL ||
    playwrightConfig.projects[0]?.use?.baseURL ||
    'http://localhost:5173/';

  // Validate baseURL format to catch configuration errors early
  if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
    throw new Error(
      `Invalid baseURL: "${baseURL}". Must start with http:// or https://. ` +
        'Check playwright.config.ts or PORT/VITE_PORT environment variables.'
    );
  }
  console.log(`   Base URL: ${baseURL}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page with extended timeout for CI
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for page to be fully interactive
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form with extended timeout for slow CI environments
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });

    console.log('   Filling login credentials...');

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
      console.log('   Completing onboarding...');
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
      console.log('   Dismissing welcome screen...');
      await page.getByRole('button', { name: /continue/i }).click();
    }

    // Wait for app navigation to be visible (confirms successful login)
    // Extended timeout for CI environments
    await page
      .locator('nav, [data-testid="bottom-navigation"]')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    console.log('   Login successful!');

    // Save storage state (cookies + localStorage)
    await context.storageState({ path: STORAGE_STATE_PATH });

    console.log(`   Storage state saved to: ${STORAGE_STATE_PATH}`);
  } catch (error) {
    console.error('❌ Global Setup: Authentication failed!');
    console.error(error);

    // Take screenshot for debugging
    const screenshotPath = path.join(authDir, 'auth-failure.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`   Screenshot saved: ${screenshotPath}`);

    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global Setup: Complete!');
}

export default globalSetup;
