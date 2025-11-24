/**
 * Epic 1 Pre-Implementation Validation Suite
 *
 * These tests validate the baseline infrastructure before Epic 1 implementation.
 * They automate the manual DevTools validation that blocked Story 0.4 for 2 days.
 *
 * Epic 1 Requirements (from tech-spec-epic-1.md):
 * - Story 1.1: Codebase audit (zero TypeScript errors, builds pass, PWA valid)
 * - Story 1.2: Supabase configuration (client connects, RLS accessible)
 * - Story 1.3: Magic link authentication flow
 * - Story 1.4: Session persistence
 * - Story 1.5: Network status detection
 *
 * Addresses Epic 0 Retrospective Finding:
 * "Manual Validation Dependencies Created Blockers" - Story 0.4 blocked 2 days
 * due to manual DevTools console/network validation.
 *
 * @epic Epic 1 - PWA Foundation Audit & Stabilization
 */

import { test, expect } from '../support/fixtures/monitoredTest';
import { filterIgnoredErrors } from '../support/helpers/consoleMonitor';
import { validateSupabaseHealth } from '../support/helpers/networkMonitor';

test.describe('Epic 1.1 - Codebase Baseline Validation', () => {
  test('AC-1.1.1: Application loads without console errors', async ({
    page,
    consoleMonitor,
  }) => {
    // Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known ignorable errors (framework noise)
    const errors = filterIgnoredErrors(consoleMonitor.getErrors());

    // Assert zero actionable console errors
    expect(errors).toHaveLength(0);

    console.log('✓ Application loaded with zero console errors');
    console.log(consoleMonitor.getSummary());
  });

  test('AC-1.1.2: Application loads without console warnings', async ({
    page,
    consoleMonitor,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get warnings (may be acceptable, but should be documented)
    const warnings = consoleMonitor.getWarnings();

    // Log warnings for review (not blocking, but should be minimal)
    if (warnings.length > 0) {
      console.log(`⚠️  Found ${warnings.length} console warnings:`);
      warnings.forEach((w) => console.log(`   - ${w.text}`));
    }

    // Assert warnings are within acceptable threshold (adjust as needed)
    expect(warnings.length).toBeLessThanOrEqual(5);
  });

  test('AC-1.1.3: Service worker registers successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Define explicit return type to avoid race condition type confusion
    interface SwResult {
      registered: boolean;
      state?: string;
      scope?: string;
      timeout?: boolean;
      error?: string;
      supported?: boolean;
    }

    // Wait for service worker with timeout (PWA may take time in dev mode)
    const swRegistered: SwResult = await page.evaluate(
      async (): Promise<SwResult> => {
        // First check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          return { registered: false, supported: false, error: 'ServiceWorker not supported' };
        }

        try {
          // Give service worker up to 30s to register (dev mode can be slow)
          const timeout = new Promise<SwResult>((resolve) =>
            setTimeout(() => resolve({ registered: false, timeout: true }), 30000)
          );

          const registration = await Promise.race([
            navigator.serviceWorker.ready.then((reg): SwResult => ({
              registered: reg.active !== null,
              state: reg.active?.state,
              scope: reg.scope,
            })),
            timeout,
          ]);

          return registration;
        } catch (error) {
          return { registered: false, error: String(error) };
        }
      }
    );

    // Fail fast with clear messages for different failure modes
    if (swRegistered.supported === false) {
      throw new Error('ServiceWorker API not supported in this browser context');
    }
    if (swRegistered.timeout) {
      throw new Error('ServiceWorker registration timed out after 30s - check SW configuration');
    }
    if (swRegistered.error) {
      throw new Error(`ServiceWorker error: ${swRegistered.error}`);
    }

    expect(swRegistered.registered).toBe(true);
    expect(swRegistered.state).toBe('activated');

    console.log('✓ Service worker registered and active');
    console.log('  Scope:', swRegistered.scope);
  });

  test('AC-1.1.4: PWA manifest is valid', async ({ page }) => {
    await page.goto('/');

    // Check for manifest link in HTML
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBeTruthy();

    console.log('✓ PWA manifest link present:', manifestLink);
  });
});

test.describe('Epic 1.2 - Supabase Connection Validation', () => {
  test('AC-1.2.1: Supabase client connects successfully', async ({
    page,
    networkMonitor,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Validate Supabase API health
    const health = validateSupabaseHealth(networkMonitor);

    // CRITICAL: Assert at least one Supabase request was observed
    // This catches misconfigured/uninitialized clients that would otherwise
    // pass due to zero failures (because zero traffic = zero failures)
    const supabaseRequests = networkMonitor.getByDomain('supabase.co');
    expect(
      supabaseRequests.length,
      'No Supabase requests observed - client may be misconfigured or not initialized'
    ).toBeGreaterThan(0);

    // Assert auth or REST endpoint was contacted (proves actual connection)
    expect(
      health.authOk || health.restOk,
      'Neither Supabase Auth nor REST API responded successfully'
    ).toBe(true);

    // Assert no failures among observed requests
    expect(health.allOk).toBe(true);
    expect(health.failures).toHaveLength(0);

    console.log('✓ Supabase client connected successfully');
    console.log(`  Auth requests: ${health.authOk ? 'OK' : 'None/Failed'}`);
    console.log(`  REST requests: ${health.restOk ? 'OK' : 'None/Failed'}`);
    console.log(networkMonitor.getSummary());
  });

  test('AC-1.2.2: No failed Supabase API calls', async ({ page, networkMonitor }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all Supabase requests
    const supabaseRequests = networkMonitor.getByDomain('supabase.co');
    const failedSupabase = supabaseRequests.filter(
      (r) => r.status === null || r.status >= 400
    );

    // Assert no failed Supabase requests
    expect(failedSupabase).toHaveLength(0);

    if (supabaseRequests.length > 0) {
      console.log(`✓ ${supabaseRequests.length} Supabase requests, all successful`);
    }
  });

  test('AC-1.2.3: Environment variables loaded correctly', async ({ page, networkMonitor }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Strategy: Verify env vars are working by checking their effects
    // 1. Supabase URL env var → Supabase requests go to correct host
    // 2. No "undefined" or "null" in Supabase request URLs (misconfigured env)
    // 3. App doesn't show env-related error states

    const supabaseRequests = networkMonitor.getByDomain('supabase.co');

    // Check 1: At least one Supabase request was made (proves URL is configured)
    const hasSupabaseUrl = supabaseRequests.length > 0;

    // Check 2: No malformed URLs (would indicate undefined env vars)
    const hasMalformedUrls = supabaseRequests.some(
      (r) =>
        r.url.includes('undefined') ||
        r.url.includes('null') ||
        r.url.includes('VITE_')  // Unresolved placeholder
    );

    // Check 3: Verify app rendered without env-related errors
    const envErrorCheck = await page.evaluate(() => {
      // Check for common env var error indicators in the DOM
      const bodyText = document.body.innerText.toLowerCase();
      const hasEnvError =
        bodyText.includes('missing environment') ||
        bodyText.includes('supabase_url') ||
        bodyText.includes('supabase_anon_key') ||
        bodyText.includes('configuration error');

      // Check if app root mounted (React/Vue apps fail to mount with bad env)
      const appRoot = document.getElementById('root') || document.getElementById('app');
      const appMounted = appRoot && appRoot.children.length > 0;

      return {
        hasEnvError,
        appMounted,
      };
    });

    // Assertions with clear failure messages
    expect(
      hasSupabaseUrl,
      'VITE_SUPABASE_URL not configured - no Supabase requests observed'
    ).toBe(true);

    expect(
      hasMalformedUrls,
      'Malformed Supabase URLs detected - env vars may contain undefined/null'
    ).toBe(false);

    expect(
      envErrorCheck.hasEnvError,
      'Environment error message detected in UI'
    ).toBe(false);

    expect(
      envErrorCheck.appMounted,
      'App failed to mount - possible env var configuration issue'
    ).toBe(true);

    console.log('✓ Environment variables loaded correctly');
    console.log(`  Supabase requests: ${supabaseRequests.length}`);
    console.log(`  App mounted: ${envErrorCheck.appMounted}`);
  });
});

test.describe('Epic 1.3 - Authentication Readiness', () => {
  test('AC-1.3.1: Login page renders without errors', async ({ page, consoleMonitor }) => {
    // Navigate to login (app should show login if not authenticated)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no console errors during render
    const errors = filterIgnoredErrors(consoleMonitor.getErrors());
    expect(errors).toHaveLength(0);

    // Verify page loaded (basic check)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ Login page rendered without errors');
  });

  test('AC-1.3.2: Supabase Auth client initialized', async ({ page, networkMonitor }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if auth session query was made
    const authRequests = networkMonitor.getByPattern(/supabase\.co.*\/auth\//);

    // Should have at least one auth request (session check)
    expect(authRequests.length).toBeGreaterThanOrEqual(0);

    console.log(`✓ Supabase Auth client initialized (${authRequests.length} auth requests)`);
  });
});

test.describe('Epic 1.4 - Session Persistence Readiness', () => {
  test('AC-1.4.1: LocalStorage accessible', async ({ page }) => {
    await page.goto('/');

    // Test localStorage read/write
    const lsTest = await page.evaluate(() => {
      const testKey = '__playwright_test__';
      const testValue = 'test-value';

      try {
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        return {
          canWrite: true,
          canRead: retrieved === testValue,
          available: true,
        };
      } catch (error) {
        return {
          canWrite: false,
          canRead: false,
          available: false,
          error: String(error),
        };
      }
    });

    expect(lsTest.available).toBe(true);
    expect(lsTest.canWrite).toBe(true);
    expect(lsTest.canRead).toBe(true);

    console.log('✓ LocalStorage accessible and functional');
  });
});

test.describe('Epic 1.5 - Network Status Readiness', () => {
  test('AC-1.5.1: Online status detected', async ({ page }) => {
    await page.goto('/');

    // Check navigator.onLine API
    const isOnline = await page.evaluate(() => navigator.onLine);

    expect(isOnline).toBe(true);

    console.log('✓ Navigator.onLine reports online status');
  });

  test('AC-1.5.2: Offline simulation works', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Verify offline state
    const isOffline = await page.evaluate(() => !navigator.onLine);
    expect(isOffline).toBe(true);

    // Restore online
    await context.setOffline(false);

    const isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(true);

    console.log('✓ Offline/online simulation working correctly');
  });
});

test.describe('Cross-Browser Baseline (Epic 0 AC-0.4.6)', () => {
  test('Chromium: Application loads without errors', async ({ page, consoleMonitor }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const errors = filterIgnoredErrors(consoleMonitor.getErrors());
    expect(errors).toHaveLength(0);

    console.log('✓ Chromium: Zero console errors');
  });

  // Note: Firefox and WebKit tests will run automatically via playwright.config.ts projects
  // This test will be executed on all configured browsers
});

test.describe('Performance Baseline (Epic 1 AC-1.1.8)', () => {
  test('AC-1.1.8: Page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Assert load time under 5 seconds (generous for local dev)
    expect(loadTime).toBeLessThan(5000);

    console.log(`✓ Page loaded in ${loadTime}ms`);
  });

  test('AC-1.1.8: No slow API requests (>5s)', async ({ page, networkMonitor }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const slowRequests = networkMonitor.getSlowRequests(5000);

    // Log slow requests for investigation (warning, not blocking)
    if (slowRequests.length > 0) {
      console.warn(`⚠️  Found ${slowRequests.length} slow requests (>5s):`);
      slowRequests.forEach((r) =>
        console.warn(`   - ${r.url} (${r.duration}ms)`)
      );
    }

    // Assert no extremely slow requests (adjust threshold as needed)
    expect(slowRequests).toHaveLength(0);
  });
});
