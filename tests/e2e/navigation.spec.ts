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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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

    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

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

test.describe('Story 4.5: Photo Gallery Navigation Integration', () => {
  // AC-4.5.1: Top Navigation Bar with Home and Photos tabs
  test('AC-4.5.1: should display top navigation with Home and Photos tabs', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify top navigation bar visible
    const topNav = cleanApp.getByTestId('top-navigation');
    await expect(topNav).toBeVisible();

    // Verify Home tab
    const homeTab = cleanApp.getByTestId('nav-home-tab');
    await expect(homeTab).toBeVisible();
    await expect(homeTab).toHaveAttribute('aria-label', 'Navigate to Home');

    // Verify Photos tab
    const photosTab = cleanApp.getByTestId('nav-photos-tab');
    await expect(photosTab).toBeVisible();
    await expect(photosTab).toHaveAttribute('aria-label', /Navigate to Photos/);

    console.log('✓ AC-4.5.1: Top navigation bar with tabs displayed');
  });

  // AC-4.5.2: Active tab highlighting
  test('AC-4.5.2: should highlight active tab correctly', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    const homeTab = cleanApp.getByTestId('nav-home-tab');
    const photosTab = cleanApp.getByTestId('nav-photos-tab');

    // Home should be active initially
    await expect(homeTab).toHaveAttribute('aria-current', 'page');
    await expect(homeTab).toHaveClass(/text-blue-600/);

    // Navigate to Photos
    await photosTab.click();
    await cleanApp.waitForURL('/photos');

    // Photos should be active now
    await expect(photosTab).toHaveAttribute('aria-current', 'page');
    await expect(photosTab).toHaveClass(/text-blue-600/);
    await expect(homeTab).toHaveClass(/text-gray-500/);

    console.log('✓ AC-4.5.2: Active tab highlighting works correctly');
  });

  // AC-4.5.3: Smooth transitions between views
  test('AC-4.5.3: should transition smoothly between Home and Photos', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Photos
    await cleanApp.getByTestId('nav-photos-tab').click();
    await expect(cleanApp).toHaveURL('/photos');

    // Verify PhotoGallery visible (empty state since no photos uploaded)
    const photoGallery = cleanApp.getByTestId('photo-gallery-empty-state');
    await expect(photoGallery).toBeVisible();

    // Navigate back to Home
    await cleanApp.getByTestId('nav-home-tab').click();
    await expect(cleanApp).toHaveURL('/');

    // Verify DailyMessage visible
    const dailyMessage = cleanApp.getByTestId('daily-message');
    await expect(dailyMessage).toBeVisible();

    console.log('✓ AC-4.5.3: Smooth view transitions without reload');
  });

  // AC-4.5.4: Photo count badge (optional)
  test('AC-4.5.4: should display photo count badge if photos exist', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    const badge = cleanApp.getByTestId('photo-count-badge');
    const badgeVisible = await badge.isVisible().catch(() => false);

    if (badgeVisible) {
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/^\d+\+?$/); // Number or "99+"
      console.log(`✓ AC-4.5.4: Photo count badge displays: ${badgeText}`);
    } else {
      console.log('✓ AC-4.5.4: No photos, badge hidden (correct)');
    }
  });

  // AC-4.5.5: Deep linking support
  test('AC-4.5.5: should support deep linking to /photos', async ({ cleanApp }) => {
    // Navigate directly to /photos URL
    await cleanApp.goto('/photos');
    await cleanApp.waitForLoadState('networkidle');

    // Wait for PhotoGallery to finish loading (it shows loading state first, then empty state)
    await cleanApp.waitForTimeout(2000); // Give time for async loading to complete

    // Verify PhotoGallery loads (empty state since no photos)
    const photoGallery = cleanApp.getByTestId('photo-gallery-empty-state');
    await expect(photoGallery).toBeVisible({ timeout: 10000 });

    // Verify Photos tab active
    const photosTab = cleanApp.getByTestId('nav-photos-tab');
    await expect(photosTab).toHaveAttribute('aria-current', 'page');

    console.log('✓ AC-4.5.5: Deep linking to /photos works');
  });

  test('AC-4.5.5: should support deep linking to / (home)', async ({ cleanApp }) => {
    // cleanApp fixture already handles splash screen, so we can directly verify DailyMessage
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Verify Home tab active
    const homeTab = cleanApp.getByTestId('nav-home-tab');
    await expect(homeTab).toHaveAttribute('aria-current', 'page');

    console.log('✓ AC-4.5.5: Deep linking to / works');
  });

  // AC-4.5.6: Browser back/forward buttons
  test('AC-4.5.6: should support browser back button', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Photos
    await cleanApp.getByTestId('nav-photos-tab').click();
    await expect(cleanApp).toHaveURL('/photos');

    // Verify Photos view loaded (empty state) - wait longer for async loading
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    // Click browser back
    await cleanApp.goBack();
    await cleanApp.waitForTimeout(500); // Wait for navigation
    await expect(cleanApp).toHaveURL('/');

    // Verify Home tab active and DailyMessage visible
    const homeTab = cleanApp.getByTestId('nav-home-tab');
    await expect(homeTab).toHaveAttribute('aria-current', 'page');
    await expect(cleanApp.getByTestId('daily-message')).toBeVisible({ timeout: 10000 });

    console.log('✓ AC-4.5.6: Browser back button works');
  });

  test('AC-4.5.6: should support browser forward button', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate to Photos
    await cleanApp.getByTestId('nav-photos-tab').click();
    await expect(cleanApp).toHaveURL('/photos');

    // Verify Photos view loaded (empty state)
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    // Go back
    await cleanApp.goBack();
    await cleanApp.waitForTimeout(500);
    await expect(cleanApp).toHaveURL('/');

    // Go forward
    await cleanApp.goForward();
    await cleanApp.waitForTimeout(500);
    await expect(cleanApp).toHaveURL('/photos');

    // Verify Photos tab active and photo gallery visible
    const photosTab = cleanApp.getByTestId('nav-photos-tab');
    await expect(photosTab).toHaveAttribute('aria-current', 'page');
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    console.log('✓ AC-4.5.6: Browser forward button works');
  });

  test('AC-4.5.6: should handle multiple back navigations', async ({ cleanApp }) => {
    await expect(cleanApp.getByTestId('message-card')).toBeVisible({ timeout: 10000 });

    // Navigate: Home → Photos → Home → Photos
    await cleanApp.getByTestId('nav-photos-tab').click();
    await cleanApp.waitForTimeout(500);
    await expect(cleanApp).toHaveURL('/photos');
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    await cleanApp.getByTestId('nav-home-tab').click();
    await cleanApp.waitForTimeout(500);
    await expect(cleanApp).toHaveURL('/');
    await expect(cleanApp.getByTestId('daily-message')).toBeVisible({ timeout: 10000 });

    await cleanApp.getByTestId('nav-photos-tab').click();
    await cleanApp.waitForTimeout(500);
    await expect(cleanApp).toHaveURL('/photos');
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    // Back through history
    await cleanApp.goBack(); // Photos → Home
    await cleanApp.waitForTimeout(500); // Wait for state transition
    await expect(cleanApp).toHaveURL('/');
    await expect(cleanApp.getByTestId('daily-message')).toBeVisible({ timeout: 10000 });

    await cleanApp.goBack(); // Home → Photos (previous)
    await cleanApp.waitForTimeout(500); // Wait for state transition
    await expect(cleanApp).toHaveURL('/photos');
    await expect(cleanApp.getByTestId('photo-gallery-empty-state')).toBeVisible({ timeout: 10000 });

    await cleanApp.goBack(); // Photos → Home (initial)
    await cleanApp.waitForTimeout(500); // Wait for state transition
    await expect(cleanApp).toHaveURL('/');
    await expect(cleanApp.getByTestId('daily-message')).toBeVisible({ timeout: 10000 });

    console.log('✓ AC-4.5.6: Multiple back navigations work correctly');
  });
});
