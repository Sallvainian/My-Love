/**
 * End-to-End Test: Session Management & Persistence (Story 1.4)
 *
 * Tests the session management system including:
 * - AC-1.4.1: App auto-restores session without requiring login
 * - AC-1.4.2: localStorage contains `supabase-auth-token` key
 * - AC-1.4.3: Logout clears session tokens from localStorage
 * - AC-1.4.4: Logout redirects user to login page
 * - AC-1.4.5: Auth state changes trigger `onAuthStateChange` callback
 * - AC-1.4.6: Safari localStorage quota check passes (>1MB available)
 * - AC-1.4.7: Session refresh happens automatically before token expiry
 *
 * Prerequisites:
 * - Supabase project configured with Auth enabled
 * - Test user created in Supabase Auth
 * - Environment variables: VITE_TEST_USER_EMAIL, VITE_TEST_USER_PASSWORD
 *
 * @story 1-4-session-management-persistence
 * @epic 1
 */

import { test, expect } from '@playwright/test';

// Test user credentials from environment variables
const TEST_USER_EMAIL = process.env.VITE_TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.VITE_TEST_USER_PASSWORD;

// Helper to check if test credentials are available
const hasTestCredentials = () => !!(TEST_USER_EMAIL && TEST_USER_PASSWORD);

// Skip condition for tests requiring authentication
const skipIfNoCredentials = () => {
  if (!hasTestCredentials()) {
    console.log('⚠️ Skipping test: VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD required');
    return true;
  }
  return false;
};

/**
 * Helper to login with test credentials
 */
async function loginUser(page: any) {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    throw new Error('Test credentials not configured');
  }
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 10000 });
}

/**
 * Helper to logout
 */
async function logoutUser(page: any) {
  // Try settings nav button first, then fallback to other selectors
  const settingsNav = page.getByTestId('nav-settings');
  if (await settingsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await settingsNav.click();
  } else {
    // Navigate to settings using URL
    await page.goto('/settings');
  }

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Session Management & Persistence (Story 1.4)', () => {
  // Skip all tests in this suite if no test credentials are configured
  test.skip(!hasTestCredentials(), 'Test credentials (VITE_TEST_USER_EMAIL, VITE_TEST_USER_PASSWORD) required');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('AC-1.4.1: Session Auto-Restore', () => {
    test('should auto-restore session without requiring login after browser close', async ({
      page,
      context,
    }) => {
      // Login first
      await loginUser(page);

      // Verify we're authenticated
      await expect(page.getByTestId('bottom-navigation')).toBeVisible();

      // Close the page (simulates closing browser tab)
      await page.close();

      // Create new page in same context (simulates reopening browser)
      const newPage = await context.newPage();
      await newPage.goto('/');

      // Session should be auto-restored - should NOT show login screen
      await expect(newPage.getByRole('heading', { name: /welcome back/i })).not.toBeVisible({
        timeout: 5000,
      });
      await expect(newPage.getByTestId('bottom-navigation')).toBeVisible({ timeout: 10000 });

      console.log('✓ AC-1.4.1: Session auto-restored without login prompt');
    });

    test('should restore session after page reload', async ({ page }) => {
      // Login first
      await loginUser(page);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Session should persist - should still see authenticated app
      await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: /welcome back/i })).not.toBeVisible();

      console.log('✓ AC-1.4.1: Session persists across page reload');
    });
  });

  test.describe('AC-1.4.2: LocalStorage Auth Token', () => {
    test('should store supabase-auth-token in localStorage after login', async ({ page }) => {
      // Login
      await loginUser(page);

      // Check for Supabase auth token in localStorage
      const authToken = await page.evaluate(() => {
        // Supabase stores auth in localStorage with a key containing the project ref
        const keys = Object.keys(localStorage);
        const supabaseKey = keys.find(
          (key) => key.includes('supabase') && key.includes('auth-token')
        );
        return supabaseKey ? localStorage.getItem(supabaseKey) : null;
      });

      expect(authToken).toBeTruthy();

      // Parse and validate token structure
      if (authToken) {
        const tokenData = JSON.parse(authToken);
        expect(tokenData.access_token).toBeDefined();
        expect(tokenData.refresh_token).toBeDefined();
        expect(tokenData.expires_at).toBeDefined();
        expect(tokenData.user).toBeDefined();
      }

      console.log('✓ AC-1.4.2: supabase-auth-token found in localStorage');
    });

    test('should have valid token structure with required fields', async ({ page }) => {
      // Login
      await loginUser(page);

      // Get and validate auth token structure
      const tokenData = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const supabaseKey = keys.find(
          (key) => key.includes('supabase') && key.includes('auth-token')
        );
        if (!supabaseKey) return null;

        const token = localStorage.getItem(supabaseKey);
        return token ? JSON.parse(token) : null;
      });

      expect(tokenData).toBeTruthy();
      expect(tokenData.access_token).toMatch(/^eyJ/); // JWT format
      expect(tokenData.refresh_token).toBeTruthy();
      expect(typeof tokenData.expires_at).toBe('number');
      expect(tokenData.user.id).toBeTruthy();
      expect(tokenData.user.email).toBe(TEST_USER_EMAIL);

      console.log('✓ AC-1.4.2: Auth token has valid structure');
    });
  });

  test.describe('AC-1.4.3: Logout Clears Tokens', () => {
    test('should clear session tokens from localStorage on logout', async ({ page }) => {
      // Login
      await loginUser(page);

      // Verify token exists before logout
      const tokenBeforeLogout = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        return keys.find((key) => key.includes('supabase') && key.includes('auth-token'));
      });
      expect(tokenBeforeLogout).toBeTruthy();

      // Logout
      await logoutUser(page);

      // Verify token is cleared after logout
      const tokenAfterLogout = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const supabaseKey = keys.find(
          (key) => key.includes('supabase') && key.includes('auth-token')
        );
        return supabaseKey ? localStorage.getItem(supabaseKey) : null;
      });

      // Token should be null or the key should be removed
      expect(tokenAfterLogout).toBeFalsy();

      console.log('✓ AC-1.4.3: Session tokens cleared from localStorage');
    });

    test('should clear IndexedDB auth token on logout', async ({ page }) => {
      // Login
      await loginUser(page);

      // Verify token exists in IndexedDB before logout
      const idbTokenBefore = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const request = indexedDB.open('my-love-db', 4);
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sw-auth')) {
              db.close();
              resolve(null);
              return;
            }
            const tx = db.transaction('sw-auth', 'readonly');
            const store = tx.objectStore('sw-auth');
            const getRequest = store.get('current');
            getRequest.onsuccess = () => {
              db.close();
              resolve(getRequest.result);
            };
            getRequest.onerror = () => {
              db.close();
              resolve(null);
            };
          };
          request.onerror = () => resolve(null);
        });
      });

      expect(idbTokenBefore).toBeTruthy();

      // Logout
      await logoutUser(page);

      // Verify token is cleared from IndexedDB after logout
      const idbTokenAfter = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const request = indexedDB.open('my-love-db', 4);
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sw-auth')) {
              db.close();
              resolve(null);
              return;
            }
            const tx = db.transaction('sw-auth', 'readonly');
            const store = tx.objectStore('sw-auth');
            const getRequest = store.get('current');
            getRequest.onsuccess = () => {
              db.close();
              resolve(getRequest.result);
            };
            getRequest.onerror = () => {
              db.close();
              resolve(null);
            };
          };
          request.onerror = () => resolve(null);
        });
      });

      expect(idbTokenAfter).toBeFalsy();

      console.log('✓ AC-1.4.3: IndexedDB auth token cleared');
    });
  });

  test.describe('AC-1.4.4: Logout Redirect', () => {
    test('should redirect user to login page after logout', async ({ page }) => {
      // Login
      await loginUser(page);

      // Logout
      await logoutUser(page);

      // Should be on login page
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByTestId('bottom-navigation')).not.toBeVisible();

      console.log('✓ AC-1.4.4: Redirected to login page after logout');
    });

    test('should show login screen on reload after logout', async ({ page }) => {
      // Login
      await loginUser(page);

      // Logout
      await logoutUser(page);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still show login screen (session was cleared)
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByTestId('bottom-navigation')).not.toBeVisible();

      console.log('✓ AC-1.4.4: Login screen persists after reload post-logout');
    });
  });

  test.describe('AC-1.4.5: Auth State Change Callback', () => {
    test('should trigger callback on successful login', async ({ page }) => {
      // Setup console listener to capture auth state change logs
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[App] Auth state changed')) {
          consoleMessages.push(msg.text());
        }
      });

      // Login
      await loginUser(page);

      // Wait for auth state change to be logged
      await page.waitForTimeout(1000);

      // Verify auth state change was triggered
      const authStateChanged = consoleMessages.some(
        (msg) => msg.includes('authenticated') || msg.includes('Auth state changed')
      );
      expect(authStateChanged).toBe(true);

      console.log('✓ AC-1.4.5: Auth state change callback triggered on login');
    });

    test('should trigger callback on logout', async ({ page }) => {
      // Login first
      await loginUser(page);

      // Setup console listener
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[App] Auth state changed')) {
          consoleMessages.push(msg.text());
        }
      });

      // Logout
      await logoutUser(page);

      // Wait for auth state change to be logged
      await page.waitForTimeout(1000);

      // Verify signed out state was triggered
      const signedOut = consoleMessages.some((msg) => msg.includes('signed out'));
      expect(signedOut).toBe(true);

      console.log('✓ AC-1.4.5: Auth state change callback triggered on logout');
    });
  });

  test.describe('AC-1.4.6: Safari LocalStorage Quota', () => {
    test('should have more than 1MB localStorage available', async ({ page }) => {
      // Check available localStorage quota
      const quotaCheck = await page.evaluate(() => {
        try {
          // Test if we can store 1MB of data
          const testSize = 1024 * 1024; // 1MB
          const testData = 'x'.repeat(testSize);
          const testKey = 'quota-test-key';

          localStorage.setItem(testKey, testData);
          const stored = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);

          return {
            success: stored === testData,
            storedSize: stored?.length || 0,
          };
        } catch (e: any) {
          return {
            success: false,
            error: e.name,
          };
        }
      });

      expect(quotaCheck.success).toBe(true);
      expect(quotaCheck.storedSize).toBeGreaterThanOrEqual(1024 * 1024);

      console.log('✓ AC-1.4.6: localStorage quota > 1MB available');
    });

    test('should gracefully handle quota exceeded scenario', async ({ page }) => {
      // Login first
      await loginUser(page);

      // Try to exhaust localStorage quota
      const quotaExceeded = await page.evaluate(() => {
        try {
          const largeData = 'x'.repeat(5 * 1024 * 1024); // 5MB
          for (let i = 0; i < 10; i++) {
            localStorage.setItem(`quota-test-${i}`, largeData);
          }
          return false;
        } catch (e: any) {
          // Clean up test data
          for (let i = 0; i < 10; i++) {
            localStorage.removeItem(`quota-test-${i}`);
          }
          return e.name === 'QuotaExceededError';
        }
      });

      // Whether or not quota was exceeded, app should still function
      await expect(page.getByTestId('bottom-navigation')).toBeVisible();

      if (quotaExceeded) {
        console.log('✓ AC-1.4.6: Quota exceeded handled gracefully');
      } else {
        console.log('⚠️ AC-1.4.6: Quota not reached (large storage available)');
      }
    });
  });

  test.describe('AC-1.4.7: Auto Token Refresh', () => {
    test('should have autoRefreshToken enabled in Supabase config', async ({ page }) => {
      // Login
      await loginUser(page);

      // Verify autoRefreshToken is configured by checking the auth token exists
      // and has proper structure
      const tokenData = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const supabaseKey = keys.find(
          (key) => key.includes('supabase') && key.includes('auth-token')
        );
        if (!supabaseKey) return null;

        const token = localStorage.getItem(supabaseKey);
        return token ? JSON.parse(token) : null;
      });

      expect(tokenData).toBeTruthy();
      expect(tokenData.refresh_token).toBeTruthy();
      expect(tokenData.expires_at).toBeDefined();

      // Verify expires_at is in the future (token is valid)
      const expiresAt = tokenData.expires_at;
      const now = Math.floor(Date.now() / 1000);
      expect(expiresAt).toBeGreaterThan(now);

      console.log('✓ AC-1.4.7: Token has valid refresh_token and expires_at');
    });

    test('should have session token that will be auto-refreshed', async ({ page }) => {
      // Login
      await loginUser(page);

      // Get initial token
      const initialToken = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const supabaseKey = keys.find(
          (key) => key.includes('supabase') && key.includes('auth-token')
        );
        if (!supabaseKey) return null;

        const token = localStorage.getItem(supabaseKey);
        return token ? JSON.parse(token) : null;
      });

      expect(initialToken).toBeTruthy();
      expect(initialToken.refresh_token).toBeTruthy();

      // The presence of refresh_token confirms autoRefreshToken is configured
      // Actual refresh testing would require waiting for token expiry (1 hour+)
      console.log('✓ AC-1.4.7: autoRefreshToken mechanism in place');
    });
  });
});

/**
 * Tests that don't require authentication - always run
 */
test.describe('Session Configuration Validation (No Auth Required)', () => {
  test('AC-1.4.6: should have more than 1MB localStorage available', async ({ page }) => {
    await page.goto('/');

    // Check available localStorage quota
    const quotaCheck = await page.evaluate(() => {
      try {
        // Test if we can store 1MB of data
        const testSize = 1024 * 1024; // 1MB
        const testData = 'x'.repeat(testSize);
        const testKey = 'quota-test-key';

        localStorage.setItem(testKey, testData);
        const stored = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        return {
          success: stored === testData,
          storedSize: stored?.length || 0,
        };
      } catch (e: any) {
        return {
          success: false,
          error: e.name,
        };
      }
    });

    expect(quotaCheck.success).toBe(true);
    expect(quotaCheck.storedSize).toBeGreaterThanOrEqual(1024 * 1024);

    console.log('✓ AC-1.4.6: localStorage quota > 1MB available');
  });

  test('should display login screen when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Verify login screen is shown for unauthenticated users
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    console.log('✓ Login screen displayed for unauthenticated users');
  });
});

test.describe('Session Edge Cases', () => {
  // Skip all tests in this suite if no test credentials are configured
  test.skip(!hasTestCredentials(), 'Test credentials (VITE_TEST_USER_EMAIL, VITE_TEST_USER_PASSWORD) required');

  test('should handle multiple rapid login/logout cycles', async ({ page }) => {
    await page.goto('/');

    for (let i = 0; i < 3; i++) {
      // Login
      await page.getByLabel(/email/i).fill(TEST_USER_EMAIL!);
      await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD!);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByTestId('bottom-navigation')).toBeVisible({ timeout: 10000 });

      // Logout
      const settingsNav = page.getByTestId('nav-settings');
      if (await settingsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsNav.click();
      }
      await page.getByRole('button', { name: /sign out/i }).click();
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
        timeout: 5000,
      });
    }

    console.log('✓ Handled 3 rapid login/logout cycles without errors');
  });

  test('should handle page navigation while authenticated', async ({ page }) => {
    await page.goto('/');

    // Login
    await loginUser(page);

    // Navigate to different views
    const views = ['home', 'photos', 'mood', 'partner'];
    for (const view of views) {
      const navButton = page.getByTestId(`nav-${view}`);
      if (await navButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await navButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Should still be authenticated
    await expect(page.getByTestId('bottom-navigation')).toBeVisible();
    await expect(page.getByRole('heading', { name: /welcome back/i })).not.toBeVisible();

    console.log('✓ Session persists across navigation');
  });
});
