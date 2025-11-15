import { test as base, expect, Page } from '@playwright/test';
import { clearIndexedDB, clearLocalStorage, setLocalStorageItem } from '../helpers/pwaHelpers';

/**
 * Test Fixtures for PWA Testing
 *
 * Provides reusable test setups for different application states:
 * - cleanApp: Fresh state with cleared storage (baseline for all tests)
 * - appWithMessages: App initialized with default messages
 * - appWithFavorites: App with 5 pre-favorited messages
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../support/fixtures/baseFixture';
 *
 * test('should do something', async ({ cleanApp }) => {
 *   // Test with clean state
 * });
 * ```
 */

/**
 * Custom fixture types extending Playwright's base Page
 */
type TestFixtures = {
  /**
   * Fresh application state with all storage cleared.
   * Use this as the default fixture for test isolation.
   */
  cleanApp: Page;

  /**
   * Application with default messages loaded.
   * Messages are initialized from src/data/defaultMessages.ts
   */
  appWithMessages: Page;

  /**
   * Application with 5 pre-favorited messages (IDs 1-5).
   * Favorites are persisted in LocalStorage messageHistory.favoriteIds
   */
  appWithFavorites: Page;
};

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  /**
   * cleanApp fixture: Fresh state with cleared storage
   *
   * - Clears IndexedDB 'my-love-db'
   * - Clears LocalStorage
   * - Navigates to app base URL
   * - Returns page ready for testing
   *
   * Use this fixture when you need complete test isolation.
   */
  cleanApp: async ({ page }, use) => {
    // Navigate to app first (required for IndexedDB access)
    await page.goto('/');

    // Clear all storage for test isolation
    await clearIndexedDB(page, 'my-love-db');
    await clearLocalStorage(page);

    // Reload to apply clean state
    await page.reload();

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Handle welcome screen if it appears (appears on first visit)
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Provide page to test
    await use(page);

    // Cleanup happens automatically via Playwright teardown
  },

  /**
   * appWithMessages fixture: App with default messages loaded
   *
   * - Clears storage for clean state
   * - Navigates to app
   * - Waits for app initialization
   * - Default messages load automatically from src/data/defaultMessages.ts
   *
   * Use this fixture when testing message display, rotation, or filtering.
   */
  appWithMessages: async ({ page }, use) => {
    // Navigate to app first
    await page.goto('/');

    // Clear storage
    await clearIndexedDB(page, 'my-love-db');
    await clearLocalStorage(page);

    // Reload to apply clean state
    await page.reload();

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');

    // Handle welcome screen if it appears
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Messages load automatically on app initialization
    // They're populated from defaultMessages.ts via store initialization

    await use(page);
  },

  /**
   * appWithFavorites fixture: App with 5 pre-favorited messages
   *
   * - Clears storage for clean state
   * - Pre-populates LocalStorage with favorited message IDs (1-5)
   * - Navigates to app
   * - Waits for state hydration from LocalStorage
   *
   * Use this fixture when testing favorites list, favorite filtering, or favorite persistence.
   */
  appWithFavorites: async ({ page }, use) => {
    // Navigate to app first
    await page.goto('/');

    // Clear storage
    await clearIndexedDB(page, 'my-love-db');
    await clearLocalStorage(page);

    // Pre-populate LocalStorage with Zustand persist state
    // Structure matches Zustand persist middleware format
    const persistedState = {
      state: {
        messageHistory: {
          lastShownDate: new Date().toISOString().split('T')[0],
          lastMessageId: 1,
          favoriteIds: [1, 2, 3, 4, 5], // Pre-favorite messages 1-5
          viewedIds: [1, 2, 3, 4, 5],
        },
        settings: {
          themeName: 'rose',
          notificationTime: '09:00',
          relationship: {
            startDate: '2025-10-18', // Matches APP_CONFIG.defaultStartDate
            partnerName: 'Gracie', // Matches APP_CONFIG.defaultPartnerName
            anniversaries: [],
          },
          customization: {
            accentColor: '#ff6b9d',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: false,
            time: '09:00',
          },
        },
        isOnboarded: true,
      },
      version: 0,
    };

    // Write to LocalStorage (Zustand persist key is 'my-love-storage')
    await setLocalStorageItem(page, 'my-love-storage', JSON.stringify(persistedState));

    // Reload to apply persisted state
    await page.reload();

    // Wait for Zustand persist to hydrate state from LocalStorage
    await page.waitForLoadState('networkidle');

    // Handle welcome screen if it appears
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await page.waitForLoadState('networkidle');
    }

    // State is now hydrated with 5 favorited messages
    await use(page);
  },
});

/**
 * Re-export expect for convenience
 */
export { expect };
