/**
 * App-Specific Test Fixtures
 *
 * Custom fixtures for My-Love application testing.
 * Extends Playwright base fixtures with app-specific helpers.
 *
 * @see .bmad/bmm/testarch/knowledge/fixture-architecture.md
 */

import { test as base, expect } from '@playwright/test';
import { createSelectors, type StrictPage } from '../selectors';
import { loveNotesSelectors, type LoveNotesSelectors } from '../selectors/love-notes';

/**
 * App fixture types
 */
export interface AppFixtures {
  /**
   * Strict selector interface for the page.
   * Enforces accessibility-first patterns at compile time.
   *
   * @example
   * ```typescript
   * test('example', async ({ $ }) => {
   *   await $.getByRole('button', { name: 'Submit' }).click();
   * });
   * ```
   */
  $: StrictPage;

  /**
   * Love Notes domain selectors.
   * Pre-defined locators for Love Notes feature testing.
   *
   * @example
   * ```typescript
   * test('send message', async ({ loveNotes }) => {
   *   await loveNotes.messageInput.fill('Hello!');
   *   await loveNotes.sendButton.click();
   * });
   * ```
   */
  loveNotes: LoveNotesSelectors;

  /**
   * Navigate to Love Notes section with network-first pattern.
   * Sets up response listener BEFORE navigation.
   *
   * @example
   * ```typescript
   * test('love notes', async ({ navigateToLoveNotes, loveNotes }) => {
   *   await navigateToLoveNotes();
   *   await expect(loveNotes.messageInput).toBeVisible();
   * });
   * ```
   */
  navigateToLoveNotes: () => Promise<void>;

  /**
   * Navigate to a specific app section by nav item.
   *
   * @param section - Section name (home, love-notes, mood, photos, settings)
   */
  navigateToSection: (section: AppSection) => Promise<void>;

  /**
   * Wait for app to be ready (authenticated, loaded).
   * Use after navigation or page reload.
   */
  waitForAppReady: () => Promise<void>;

  /**
   * Clear app state (localStorage, IndexedDB).
   * Useful for testing fresh state scenarios.
   */
  clearAppState: () => Promise<void>;
}

/**
 * App sections for navigation
 */
export type AppSection = 'home' | 'love-notes' | 'mood' | 'photos' | 'settings';

/**
 * Section to nav testId mapping
 */
const SECTION_NAV_IDS: Record<AppSection, string> = {
  home: 'nav-home',
  'love-notes': 'nav-notes',
  mood: 'nav-mood',
  photos: 'nav-photos',
  settings: 'nav-logout', // Settings uses logout button
};

/**
 * App fixtures extension.
 *
 * Provides strict selectors, domain helpers, and navigation utilities.
 */
export const test = base.extend<AppFixtures>({
  /**
   * Strict selector interface ($)
   */
  $: async ({ page }, use) => {
    const selectors = createSelectors(page);
    await use(selectors);
  },

  /**
   * Love Notes domain selectors
   */
  loveNotes: async ({ page }, use) => {
    const selectors = loveNotesSelectors(page);
    await use(selectors);
  },

  /**
   * Navigate to Love Notes with network-first pattern
   */
  navigateToLoveNotes: async ({ page, baseURL, loveNotes }, use) => {
    const navigateToLoveNotes = async () => {
      // Step 0: Ensure we're on the app (may already be if test chained)
      const currentUrl = page.url();
      if (!currentUrl.startsWith(baseURL || 'http://localhost') || currentUrl === 'about:blank') {
        await page.goto('/');
        // Wait for app to be ready (nav visible indicates auth successful)
        await expect(page.locator('nav, [data-testid="bottom-navigation"]').first()).toBeVisible({
          timeout: 15000,
        });
      }

      // Network-first: Set up response listener BEFORE clicking
      const messagesPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('love_notes') &&
          resp.request().method() === 'GET' &&
          resp.status() >= 200 &&
          resp.status() < 400,
        { timeout: 15000 }
      );

      // Click navigation
      await expect(loveNotes.navButton).toBeVisible({ timeout: 10000 });
      await loveNotes.navButton.click();

      // Wait for API response
      await messagesPromise;

      // Verify page loaded (deterministic wait)
      await expect(
        loveNotes.messageInput.or(loveNotes.emptyState).or(loveNotes.loadingIndicator)
      ).toBeVisible({ timeout: 10000 });

      // If loading indicator visible, wait for it to disappear
      const loadingCount = await loveNotes.loadingIndicator.count();
      if (loadingCount > 0) {
        await expect(loveNotes.loadingIndicator).toBeHidden({ timeout: 10000 });
      }
    };

    await use(navigateToLoveNotes);
  },

  /**
   * Navigate to any app section
   */
  navigateToSection: async ({ page }, use) => {
    const navigateToSection = async (section: AppSection) => {
      const navId = SECTION_NAV_IDS[section];
      const navButton = page.getByTestId(navId);

      await expect(navButton).toBeVisible({ timeout: 10000 });
      await navButton.click();

      // Wait for navigation to complete
      await page.waitForLoadState('domcontentloaded');
    };

    await use(navigateToSection);
  },

  /**
   * Wait for app to be ready
   */
  waitForAppReady: async ({ page }, use) => {
    const waitForAppReady = async () => {
      // Wait for navigation to be visible (indicates auth complete)
      await page
        .locator('nav, [data-testid="bottom-navigation"]')
        .first()
        .waitFor({ state: 'visible', timeout: 20000 });

      // Wait for any loading indicators to disappear
      const loadingIndicator = page.getByTestId('app-loading');
      const loadingCount = await loadingIndicator.count();
      if (loadingCount > 0) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      }
    };

    await use(waitForAppReady);
  },

  /**
   * Clear app state (localStorage, IndexedDB)
   */
  clearAppState: async ({ page }, use) => {
    const clearAppState = async () => {
      await page.evaluate(async () => {
        // Clear localStorage
        localStorage.clear();

        // Clear IndexedDB
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      });
    };

    await use(clearAppState);
  },
});

// Re-export expect for convenience
export { expect };

/**
 * Helper to create a scoped test.describe with common setup.
 *
 * @example
 * ```typescript
 * import { describeLoveNotes } from '../support/fixtures/app-fixtures';
 *
 * describeLoveNotes('Send Message', () => {
 *   test('sends text message', async ({ loveNotes }) => {
 *     // navigateToLoveNotes already called in beforeEach
 *     await loveNotes.messageInput.fill('Hello!');
 *   });
 * });
 * ```
 */
export function describeLoveNotes(
  title: string,
  callback: () => void
): void {
  test.describe(title, () => {
    test.beforeEach(async ({ navigateToLoveNotes }) => {
      await navigateToLoveNotes();
    });

    callback();
  });
}

/**
 * Test options to skip network monitoring for error tests.
 *
 * @example
 * ```typescript
 * test('handles 500 error', { annotation: [skipNetworkMonitoringAnnotation] }, async ({ page }) => {
 *   // Test won't fail on 500 errors
 * });
 * ```
 */
export const skipNetworkMonitoringAnnotation = { type: 'skipNetworkMonitoring' } as const;
