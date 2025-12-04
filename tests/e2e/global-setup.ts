/**
 * Playwright Global Setup
 *
 * Performs one-time authentication before all tests run.
 * Saves session state to storageState.json for reuse across tests.
 */

import { chromium, FullConfig } from '@playwright/test';
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
const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'storageState.json');

async function globalSetup(config: FullConfig) {
  // Ensure auth directory exists
  const authDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Get base URL from config
  const baseURL =
    config.projects[0]?.use?.baseURL || 'http://localhost:5173/';

  console.log('🔐 Global Setup: Starting authentication...');
  console.log(`   Base URL: ${baseURL}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(baseURL);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15000 });

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
    await page
      .locator('nav, [data-testid="bottom-navigation"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });

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
