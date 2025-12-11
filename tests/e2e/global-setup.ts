/**
 * Playwright Global Setup
 *
 * Performs one-time authentication before all tests run.
 * Integrates with @seontechnologies/playwright-utils auth-session for token persistence.
 *
 * Features:
 * - One-time login (tokens reused across test runs)
 * - Partner relationship setup
 * - Auth state saved to storageState.json
 *
 * @see .bmad/bmm/testarch/knowledge/auth-session.md
 */

import { chromium, type FullConfig } from '@playwright/test';
import { config } from '@dotenvx/dotenvx';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Auth utilities
import { ensurePartnerRelationship, initAuthStorage } from '../support/fixtures/auth-provider';

// ES module compatibility: derive __dirname from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();
config({ path: '.env.test', override: true });

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';
const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'storageState.json');

async function globalSetup(playwrightConfig: FullConfig) {
  console.log('🔐 Global Setup: Starting...');

  // Step 1: Initialize auth storage directories
  console.log('   Initializing auth storage...');
  try {
    initAuthStorage();
    console.log('   Auth storage initialized ✓');
  } catch (error) {
    console.log(`   ⚠️ Auth storage init warning: ${error}`);
  }

  // Step 2: Ensure auth directory exists
  const authDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Step 3: Ensure partner relationship is configured
  await ensurePartnerRelationship();

  // Step 4: Check if we have valid cached auth state
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
      const authCookie = storageState.cookies?.find((c: { name: string }) =>
        c.name.includes('-auth-token')
      );

      if (authCookie) {
        // Check if token is still valid (not expired)
        try {
          const tokenData = JSON.parse(decodeURIComponent(authCookie.value));
          const expiresAt = tokenData.expires_at * 1000;
          const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

          if (expiresAt > fiveMinutesFromNow) {
            console.log('   Using cached auth state ✓');
            console.log('✅ Global Setup: Complete (cached)!');
            return;
          }
          console.log('   Cached auth expired, re-authenticating...');
        } catch {
          console.log('   Could not parse cached token, re-authenticating...');
        }
      }
    } catch {
      console.log('   Could not read cached auth, re-authenticating...');
    }
  }

  // Step 5: Perform browser-based authentication
  console.log('   Performing browser authentication...');

  // Get baseURL from config (check projects first, then fall back to default)
  const baseURL =
    playwrightConfig.projects[0]?.use?.baseURL ||
    process.env.VITE_BASE_URL ||
    'http://localhost:5173/';

  // Validate baseURL format
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
    // Navigate to login page
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for login form
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });

    console.log('   Filling login credentials...');

    // Fill login form using accessible selectors
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

    // Handle welcome screen if needed
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

    // Wait for navigation to confirm successful login
    await page
      .locator('nav, [data-testid="bottom-navigation"]')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    console.log('   Login successful!');

    // Save storage state
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
