import { test, expect } from '../support/fixtures/baseFixture';
import { getLocalStorageItem } from '../support/helpers/pwaHelpers';

/**
 * Navigation and Theme Switching Test Suite
 *
 * Tests AC-2.2.5:
 * - Theme switching works across all 4 themes (sunset, ocean, lavender, rose)
 * - Theme selection persists across browser refresh
 * - Theme CSS variables update correctly on theme change
 * - Navigation state persists in LocalStorage
 *
 * Note: Theme selector UI component will be added in Epic 3.
 * These tests validate the underlying theme switching mechanism.
 *
 * Actual themes (from src/utils/themes.ts):
 * - sunset: Sunset Romance (#FF6B9D)
 * - ocean: Ocean Breeze (#14b8a6)
 * - lavender: Lavender Dreams (#a855f7)
 * - rose: Rose Garden (#e11d48)
 */

test.describe('Theme Switching', () => {
  test('should switch theme to Sunset Romance', async ({ cleanApp }) => {
    // Wait for app to initialize
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to sunset theme programmatically
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('sunset');
      }
    });

    // Wait for theme application
    await cleanApp.waitForTimeout(500);

    // Verify CSS variable updated
    const primaryColor = await cleanApp.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    // Sunset theme has primary color #FF6B9D
    expect(primaryColor.toLowerCase()).toBe('#ff6b9d');

    // Verify theme persisted in LocalStorage
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const settingsData = JSON.parse(storedSettings!);
    expect(settingsData.state.settings.themeName).toBe('sunset');

    console.log('✓ Theme switched to Sunset Romance');
  });

  test('should switch theme to Ocean Breeze', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to ocean theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('ocean');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify CSS variable (Ocean theme: #14b8a6)
    const primaryColor = await cleanApp.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    expect(primaryColor.toLowerCase()).toBe('#14b8a6');

    // Verify persistence
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(JSON.parse(storedSettings!).state.settings.themeName).toBe('ocean');

    console.log('✓ Theme switched to Ocean Breeze');
  });

  test('should switch theme to Lavender Dreams', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to lavender theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('lavender');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify CSS variable (Lavender theme: #a855f7)
    const primaryColor = await cleanApp.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    expect(primaryColor.toLowerCase()).toBe('#a855f7');

    // Verify persistence
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(JSON.parse(storedSettings!).state.settings.themeName).toBe('lavender');

    console.log('✓ Theme switched to Lavender Dreams');
  });

  test('should switch theme to Rose Garden', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to rose theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('rose');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify CSS variable (Rose theme: #e11d48)
    const primaryColor = await cleanApp.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    expect(primaryColor.toLowerCase()).toBe('#e11d48');

    // Verify persistence
    const storedSettings = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(JSON.parse(storedSettings!).state.settings.themeName).toBe('rose');

    console.log('✓ Theme switched to Rose Garden');
  });

  test('should persist theme across browser refresh', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to ocean theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('ocean');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify theme is ocean before refresh
    const beforeRefresh = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(JSON.parse(beforeRefresh!).state.settings.themeName).toBe('ocean');

    // Refresh page
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify theme still ocean after refresh
    const afterRefresh = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(JSON.parse(afterRefresh!).state.settings.themeName).toBe('ocean');

    // Verify CSS variables still applied
    const primaryColor = await cleanApp.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    });

    expect(primaryColor.toLowerCase()).toBe('#14b8a6'); // Ocean theme primary

    console.log('✓ Theme persists across browser refresh');
  });

  test('should update all CSS variables on theme change', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to lavender theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('lavender');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify all CSS variables updated
    const cssVars = await cleanApp.evaluate(() => {
      const root = document.documentElement;
      return {
        primary: getComputedStyle(root).getPropertyValue('--color-primary').trim(),
        secondary: getComputedStyle(root).getPropertyValue('--color-secondary').trim(),
        background: getComputedStyle(root).getPropertyValue('--color-background').trim(),
        text: getComputedStyle(root).getPropertyValue('--color-text').trim(),
        accent: getComputedStyle(root).getPropertyValue('--color-accent').trim(),
      };
    });

    // Lavender theme colors from themes.ts
    expect(cssVars.primary.toLowerCase()).toBe('#a855f7');
    expect(cssVars.secondary.toLowerCase()).toBe('#c084fc');
    expect(cssVars.background.toLowerCase()).toBe('#f3e5f5');
    expect(cssVars.text.toLowerCase()).toBe('#4a1f6f');
    expect(cssVars.accent.toLowerCase()).toBe('#d8b4fe');

    console.log('✓ All CSS variables update correctly on theme change');
  });

  test('should apply theme to body background', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Switch to sunset theme
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        store.getState().setTheme('sunset');
      }
    });

    await cleanApp.waitForTimeout(500);

    // Verify body background gradient applied
    const bodyBackground = await cleanApp.evaluate(() => {
      return getComputedStyle(document.body).background;
    });

    // Should contain gradient (exact format may vary by browser)
    expect(bodyBackground).toMatch(/gradient|linear/i);

    console.log('✓ Theme applies gradient to body background');
  });
});

test.describe('Theme Selector UI (Future Story)', () => {
  // Note: Theme selector UI component will be added in Epic 3
  // These tests are placeholders for when the theme picker is implemented

  test.skip('should switch theme via theme selector UI', async ({ cleanApp }) => {
    // This test will be enabled when theme selector UI is added
    // Expected flow:
    // 1. Open theme selector (button/modal/dropdown)
    // 2. Click on theme option
    // 3. Verify theme applied immediately
    // 4. Verify persistence

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Open theme selector
    // const themeButton = cleanApp.locator('button[aria-label="Change theme"]');
    // await themeButton.click();

    // Select ocean theme
    // const oceanOption = cleanApp.locator('button[data-theme="ocean"]');
    // await oceanOption.click();

    // Verify theme applied
    // const primaryColor = await cleanApp.evaluate(() => {
    //   return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    // });
    // expect(primaryColor.toLowerCase()).toBe('#14b8a6');

    console.log('✓ Theme switched via UI selector');
  });

  test.skip('should show visual preview of themes', async ({ cleanApp }) => {
    // This test will validate theme preview/showcase when UI is added
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Open theme selector
    // const themeButton = cleanApp.locator('button[aria-label="Change theme"]');
    // await themeButton.click();

    // Verify all 4 theme options shown
    // const themeOptions = cleanApp.locator('[data-theme]');
    // await expect(themeOptions).toHaveCount(4);

    // Each should have preview colors
    // for (const themeName of ['sunset', 'ocean', 'lavender', 'rose']) {
    //   const themePreview = cleanApp.locator(`[data-theme="${themeName}"]`);
    //   await expect(themePreview).toBeVisible();
    // }

    console.log('✓ Theme selector shows visual preview of all themes');
  });
});

test.describe('Navigation State (Future Story)', () => {
  // Note: Multi-page navigation will be added in Epic 3
  // Currently app is single-view (DailyMessage only)

  test.skip('should persist navigation state across refresh', async ({ cleanApp }) => {
    // This test will be enabled when multi-page navigation is added
    // Expected flow:
    // 1. Navigate to Favorites view
    // 2. Refresh page
    // 3. Verify still on Favorites view (navigation state persisted)

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Navigate to favorites
    // const favoritesButton = cleanApp.locator('button[aria-label="Favorites"]');
    // await favoritesButton.click();

    // Verify on favorites view
    // await expect(cleanApp.locator('h1:has-text("Favorites")')).toBeVisible();

    // Refresh
    // await cleanApp.reload();
    // await cleanApp.waitForLoadState('networkidle');

    // Verify still on favorites view
    // await expect(cleanApp.locator('h1:has-text("Favorites")')).toBeVisible();

    console.log('✓ Navigation state persists across refresh');
  });
});
