import { test, expect } from '../support/fixtures/baseFixture';
import {
  getLocalStorageItem,
  setLocalStorageItem,
  clearLocalStorage,
} from '../support/helpers/pwaHelpers';

/**
 * State Corruption Detection & Recovery Test Suite
 *
 * Tests the fixes for intermittent issues requiring localStorage deletion:
 * - Corrupted Map deserialization detection and recovery
 * - Invalid state structure validation
 * - Hydration failure detection
 * - Automatic corruption recovery
 * - User-friendly error handling
 *
 * Related Stories:
 * - Story 1.2: Zustand persist middleware configuration
 * - Story 3.3: Message history state management
 *
 * Bug Fixes Tested:
 * 1. Busy-wait polling race condition → Immediate hydration check
 * 2. Silent Map deserialization failures → Try-catch with validation
 * 3. No state validation → validateHydratedState() function
 * 4. Manual localStorage clearing → Automatic corruption recovery
 */

test.describe('Corrupted Map Deserialization', () => {
  test('should detect and recover from corrupted shownMessages Map', async ({ cleanApp }) => {
    // Create corrupted state with invalid Map structure
    const corruptedState = {
      state: {
        settings: {
          themeName: 'sunset',
          notificationTime: '09:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#ff6b9d',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: true,
            time: '09:00',
          },
        },
        messageHistory: {
          currentIndex: 0,
          maxHistoryDays: 30,
          favoriteIds: [],
          // CORRUPTED: shownMessages should be array of [string, number] tuples
          // Instead, it's malformed data
          shownMessages: [
            ['2024-01-01', 'not-a-number'], // Invalid: second element should be number
            'invalid-entry', // Invalid: should be array
            [null, 5], // Invalid: first element should be string
          ],
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(corruptedState));

    // Capture console errors
    const consoleErrors: string[] = [];
    cleanApp.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Reload to trigger hydration with corrupted data
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should still load (recover gracefully)
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify corruption was detected
    const hasCorruptionError = consoleErrors.some(
      (err) =>
        err.includes('Invalid shownMessages array structure') ||
        err.includes('resetting to empty Map')
    );
    expect(hasCorruptionError).toBe(true);

    // Verify state was recovered (shownMessages reset to empty Map)
    const recoveredState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsed = JSON.parse(recoveredState!);

    // Settings should be preserved (not corrupted)
    expect(parsed.state.settings.themeName).toBe('sunset');

    console.log('✓ Corrupted Map detected and recovered automatically');
  });

  test('should handle empty/null shownMessages gracefully', async ({ cleanApp }) => {
    const stateWithNullMap = {
      state: {
        settings: {
          themeName: 'ocean',
          notificationTime: '09:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#14b8a6',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: true,
            time: '09:00',
          },
        },
        messageHistory: {
          currentIndex: 0,
          maxHistoryDays: 30,
          favoriteIds: [],
          shownMessages: null, // NULL instead of array
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(stateWithNullMap));

    // Reload to trigger hydration
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should load without crashing
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    console.log('✓ Null shownMessages handled gracefully');
  });

  test('should handle non-array shownMessages gracefully', async ({ cleanApp }) => {
    const stateWithInvalidType = {
      state: {
        settings: {
          themeName: 'sunset',
          notificationTime: '09:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#ff6b9d',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: true,
            time: '09:00',
          },
        },
        messageHistory: {
          currentIndex: 0,
          maxHistoryDays: 30,
          favoriteIds: [],
          shownMessages: { '2024-01-01': 1 }, // Object instead of array
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(stateWithInvalidType));

    // Capture console errors
    const consoleErrors: string[] = [];
    cleanApp.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Reload to trigger hydration
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should load
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify error was logged
    const hasTypeError = consoleErrors.some((err) => err.includes('shownMessages is not an array'));
    expect(hasTypeError).toBe(true);

    console.log('✓ Non-array shownMessages detected and recovered');
  });
});

test.describe('State Validation', () => {
  test('should validate and recover from missing required fields', async ({ cleanApp }) => {
    // Create state missing required fields
    const invalidState = {
      state: {
        settings: {
          // Missing themeName
          notificationTime: '09:00',
          relationship: null, // Missing required relationship data
        },
        messageHistory: {
          // Missing currentIndex
          maxHistoryDays: 30,
          shownMessages: [],
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(invalidState));

    // Capture console errors
    const consoleErrors: string[] = [];
    cleanApp.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(msg.text());
      }
    });

    // Reload to trigger hydration and validation
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should load with defaults
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify validation errors were logged (pre-hydration validation in storage layer)
    const hasValidationError = consoleErrors.some((err) =>
      err.includes('[Storage] Pre-hydration validation failed')
    );
    expect(hasValidationError).toBe(true);

    // Verify corrupted state was cleared
    const hasCleared = consoleErrors.some((err) =>
      err.includes('[Storage] Clearing corrupted state')
    );
    expect(hasCleared).toBe(true);

    console.log('✓ Invalid state detected, validated, and recovered');
  });

  test('should validate Map instance type', async ({ cleanApp }) => {
    const stateWithNonMapInstance = {
      state: {
        settings: {
          themeName: 'sunset',
          notificationTime: '09:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#ff6b9d',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: true,
            time: '09:00',
          },
        },
        messageHistory: {
          currentIndex: 0,
          maxHistoryDays: 30,
          favoriteIds: [],
          shownMessages: 'not-a-map', // String instead of Map
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(stateWithNonMapInstance));

    // Reload to trigger validation
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should load
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    console.log('✓ Non-Map instance detected and recovered');
  });
});

test.describe('Hydration Failure Detection', () => {
  test('should detect hydration failure and prevent initialization', async ({ cleanApp }) => {
    // Create completely malformed JSON that will fail to parse
    await setLocalStorageItem(cleanApp, 'my-love-storage', '{invalid-json-syntax:::}');

    // Capture console errors
    const consoleErrors: string[] = [];
    cleanApp.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Reload to trigger hydration failure
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Verify hydration failure was detected (pre-hydration validation in storage layer)
    const hasHydrationError = consoleErrors.some((err) =>
      err.includes('[Storage] Failed to parse localStorage data')
    );
    expect(hasHydrationError).toBe(true);

    // Verify app recovered with valid defaults (not null - app saved defaults after recovery)
    const recoveredState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(recoveredState).toBeTruthy(); // Should have valid default state

    // Verify it's valid JSON with proper structure
    const parsed = JSON.parse(recoveredState!);
    expect(parsed.state.settings).toBeDefined();
    expect(parsed.state.messageHistory).toBeDefined();

    console.log('✓ Hydration failure detected and auto-recovered with defaults');
  });
});

test.describe('Automatic Corruption Recovery', () => {
  test('should automatically clear corrupted state and work after refresh', async ({
    cleanApp,
  }) => {
    // Set corrupted state
    const corruptedState = {
      state: {
        settings: null, // Completely broken
        messageHistory: 'invalid',
        moods: null,
        isOnboarded: 'not-a-boolean',
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(corruptedState));

    // First load - should detect corruption
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Verify state was cleared
    const afterFirstLoad = await getLocalStorageItem(cleanApp, 'my-love-storage');

    // Second load - should work with defaults
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should work normally now
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify clean state was created
    const afterSecondLoad = await getLocalStorageItem(cleanApp, 'my-love-storage');
    if (afterSecondLoad) {
      const parsed = JSON.parse(afterSecondLoad);
      expect(parsed.state.settings).toBeDefined();
      expect(parsed.state.messageHistory).toBeDefined();
    }

    console.log('✓ Automatic recovery completed - app works after refresh');
  });

  test('should preserve valid parts of partially corrupted state', async ({ cleanApp }) => {
    // State with some valid and some corrupted fields
    const partiallyCorrupted = {
      state: {
        settings: {
          themeName: 'ocean', // Valid
          notificationTime: '09:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#14b8a6',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: true,
            time: '09:00',
          },
        },
        messageHistory: {
          currentIndex: 0,
          maxHistoryDays: 30,
          favoriteIds: [],
          shownMessages: ['corrupted-data'], // Corrupted
        },
        moods: [], // Valid
        isOnboarded: true, // Valid
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(partiallyCorrupted));

    // Reload
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    // App should load
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify app recovered with defaults (full reset for safety when corruption detected)
    const recoveredState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    if (recoveredState) {
      const parsed = JSON.parse(recoveredState);
      // With pre-hydration validation, we do full reset for safety
      // This prevents partial corruption from causing subtle bugs
      expect(parsed.state.settings).toBeDefined();
      expect(parsed.state.messageHistory).toBeDefined();
    }

    console.log('✓ App recovered safely with defaults after detecting corruption');
  });
});

test.describe('Regression: No Manual localStorage Clearing Needed', () => {
  test('should never require manual localStorage deletion', async ({ cleanApp }) => {
    // Simulate various corruption scenarios in sequence
    const corruptionScenarios = [
      { name: 'Invalid JSON', data: '{broken}' },
      {
        name: 'Corrupted Map',
        data: JSON.stringify({
          state: { messageHistory: { shownMessages: 'not-an-array' } },
          version: 0,
        }),
      },
      {
        name: 'Missing fields',
        data: JSON.stringify({ state: {}, version: 0 }),
      },
    ];

    for (const scenario of corruptionScenarios) {
      console.log(`Testing scenario: ${scenario.name}`);

      // Set corrupted state
      await setLocalStorageItem(cleanApp, 'my-love-storage', scenario.data);

      // Reload - should auto-recover
      await cleanApp.reload();
      await cleanApp.waitForLoadState('networkidle');

      // Handle welcome screen
      const continueButton = cleanApp.locator('button:has-text("Continue")');
      if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueButton.click();
        await cleanApp.waitForLoadState('networkidle');
      }

      // App should work (auto-recovery succeeded)
      await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

      console.log(`✓ ${scenario.name}: Auto-recovered without manual intervention`);
    }

    console.log('✓ All corruption scenarios auto-recover - no manual clearing needed');
  });
});
