import { test, expect } from '../support/fixtures/baseFixture';
import { APP_CONFIG } from '../../src/config/constants';
import { getLocalStorageItem, setLocalStorageItem } from '../support/helpers/pwaHelpers';

/**
 * Settings Persistence Test Suite
 *
 * Tests AC-2.2.3:
 * - Pre-configured partner name loads from constants on first app init
 * - Pre-configured relationship start date loads correctly
 * - Settings updates persist across browser refresh (LocalStorage)
 * - Settings changes persist across 24-hour gap
 *
 * Note: Settings UI component (Settings page) will be added in Epic 3.
 * These tests validate the underlying settings persistence mechanism.
 */

test.describe('Settings Persistence', () => {
  test('should load pre-configured partner name on first init', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Get settings from LocalStorage (Zustand persist)
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(storedSettings).toBeTruthy();

    const settingsData = JSON.parse(storedSettings!);
    expect(settingsData.state.settings).toBeTruthy();
    expect(settingsData.state.settings.relationship.partnerName).toBe(APP_CONFIG.defaultPartnerName);

    console.log(`✓ Pre-configured partner name loaded: ${APP_CONFIG.defaultPartnerName}`);
  });

  test('should load pre-configured start date on first init', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Get settings from LocalStorage
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(storedSettings).toBeTruthy();

    const settingsData = JSON.parse(storedSettings!);
    expect(settingsData.state.settings.relationship.startDate).toBe(APP_CONFIG.defaultStartDate);

    // Verify duration counter shows correct days based on start date
    const durationHeader = cleanApp.locator('h2:has-text("Day")').first();
    await expect(durationHeader).toBeVisible();

    const headerText = await durationHeader.textContent();
    expect(headerText).toMatch(/Day \d+ Together/);

    console.log(`✓ Pre-configured start date loaded: ${APP_CONFIG.defaultStartDate}`);
  });

  test('should persist settings changes across browser refresh', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Programmatically update settings via the store
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        const { updateSettings } = store.getState();
        updateSettings({
          relationship: {
            partnerName: 'Test Partner',
            startDate: '2024-01-01',
            anniversaries: [],
          },
        });
      }
    });

    // Wait for state update
    await cleanApp.waitForTimeout(500);

    // Verify settings persisted to LocalStorage
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const settingsData = JSON.parse(storedSettings!);
    expect(settingsData.state.settings.relationship.partnerName).toBe('Test Partner');
    expect(settingsData.state.settings.relationship.startDate).toBe('2024-01-01');

    // Refresh page
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen if it appears
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // Wait for app to re-initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify settings still persisted after refresh
    const storedAfterRefresh = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const settingsAfterRefresh = JSON.parse(storedAfterRefresh!);
    expect(settingsAfterRefresh.state.settings.relationship.partnerName).toBe('Test Partner');
    expect(settingsAfterRefresh.state.settings.relationship.startDate).toBe('2024-01-01');

    console.log('✓ Settings changes persist across browser refresh');
  });

  test('should update duration counter when start date changes', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Get initial duration
    const initialDuration = await cleanApp.locator('h2:has-text("Day")').first().textContent();
    const initialDayMatch = initialDuration!.match(/Day (\d+) Together/);
    const initialDays = parseInt(initialDayMatch![1], 10);

    // Update start date to 1 year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    await cleanApp.evaluate(({ newStartDate, partnerName }) => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        const { updateSettings } = store.getState();
        updateSettings({
          relationship: {
            partnerName,
            startDate: newStartDate,
            anniversaries: [],
          },
        });
        // Trigger UI update by calling updateCurrentMessage
        store.getState().updateCurrentMessage();
      }
    }, { newStartDate: oneYearAgoStr, partnerName: 'Gracie' });

    // Wait for duration counter to update
    await cleanApp.waitForTimeout(500);

    // Refresh to trigger re-render with new start date
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Get updated duration
    const updatedDuration = await cleanApp.locator('h2:has-text("Day")').first().textContent();
    const updatedDayMatch = updatedDuration!.match(/Day (\d+) Together/);
    const updatedDays = parseInt(updatedDayMatch![1], 10);

    // Updated days should be approximately 365 (1 year)
    expect(updatedDays).toBeGreaterThan(350);
    expect(updatedDays).toBeLessThan(380);

    console.log(`✓ Duration counter updated: ${initialDays} days → ${updatedDays} days (~365)`);
  });

  test('should persist settings across 24-hour gap', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Update settings
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        const { updateSettings } = store.getState();
        updateSettings({
          relationship: {
            partnerName: 'Future Partner',
            startDate: '2024-06-01',
            anniversaries: [],
          },
        });
      }
    });

    await cleanApp.waitForTimeout(500);

    // Mock Date to 24 hours later
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await cleanApp.evaluate((futureDate) => {
      const original = Date;
      // @ts-ignore
      Date = class extends original {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(futureDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return new original(futureDate).getTime();
        }
      };
      // @ts-ignore
      Date.UTC = original.UTC;
      // @ts-ignore
      Date.parse = original.parse;
    }, tomorrow.getTime());

    // Reload app with new date
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify settings still persisted 24 hours later
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const settingsData = JSON.parse(storedSettings!);
    expect(settingsData.state.settings.relationship.partnerName).toBe('Future Partner');
    expect(settingsData.state.settings.relationship.startDate).toBe('2024-06-01');

    console.log('✓ Settings persist across 24-hour gap');
  });

  test('should initialize with pre-configured values on clean state', async ({ cleanApp }) => {
    // cleanApp fixture clears all storage before test
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify settings initialized from APP_CONFIG constants
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const settingsData = JSON.parse(storedSettings!);

    expect(settingsData.state.settings.relationship.partnerName).toBe(APP_CONFIG.defaultPartnerName);
    expect(settingsData.state.settings.relationship.startDate).toBe(APP_CONFIG.defaultStartDate);
    expect(settingsData.state.isOnboarded).toBe(true); // Story 1.4: auto-onboarded with pre-configuration

    console.log('✓ App initializes with pre-configured settings from constants');
  });
});

test.describe('Settings UI (Future Story)', () => {
  // Note: Settings UI component will be added in Epic 3
  // These tests are placeholders for when the Settings page is implemented

  test.skip('should edit partner name via Settings UI', async ({ cleanApp }) => {
    // This test will be enabled when Settings UI component is added
    // Expected flow:
    // 1. Navigate to Settings page/modal
    // 2. Find partner name input field
    // 3. Clear and type new name
    // 4. Save changes
    // 5. Verify persistence

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Settings (UI component doesn't exist yet)
    // const settingsButton = cleanApp.locator('button[aria-label="Settings"]');
    // await settingsButton.click();

    // Edit partner name
    // const nameInput = cleanApp.locator('input[data-testid="settings-partner-name-input"]');
    // await nameInput.fill('New Partner Name');
    // await cleanApp.locator('button:has-text("Save")').click();

    // Verify persistence
    // await cleanApp.reload();
    // const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    // expect(JSON.parse(storedSettings!).state.settings.relationship.partnerName).toBe('New Partner Name');

    console.log('✓ Partner name edited via Settings UI');
  });

  test.skip('should edit start date via Settings UI', async ({ cleanApp }) => {
    // This test will be enabled when Settings UI component is added
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Settings
    // const settingsButton = cleanApp.locator('button[aria-label="Settings"]');
    // await settingsButton.click();

    // Edit start date
    // const dateInput = cleanApp.locator('input[data-testid="settings-start-date-input"]');
    // await dateInput.fill('2023-01-01');
    // await cleanApp.locator('button:has-text("Save")').click();

    // Verify duration counter updates immediately
    // const durationHeader = cleanApp.locator('h2:has-text("Day")');
    // const headerText = await durationHeader.textContent();
    // expect(headerText).toMatch(/Day \d+ Together/); // Should reflect new start date

    console.log('✓ Start date edited via Settings UI with immediate duration update');
  });
});
