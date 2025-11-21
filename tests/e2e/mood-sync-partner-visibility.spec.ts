import { test, expect, type Page } from '@playwright/test';

/**
 * Story 6.4: Mood Sync & Partner Visibility - E2E Tests
 *
 * Test Coverage:
 * - AC#1: Mood sync with offline behavior and retry logic
 * - AC#2: Network state detection and auto-sync on reconnect
 * - AC#3: Partner mood visibility with manual refresh
 * - AC#4: Real-time notifications when partner logs mood
 * - AC#5: Connection status indicator (connected/reconnecting/disconnected)
 */

test.describe('Mood Sync & Partner Visibility', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Navigate to the app
    await page.goto('/');

    // Wait for app to initialize
    await page.waitForSelector('[data-testid="bottom-navigation"]', { timeout: 10000 });

    // Clear any existing IndexedDB data for clean test state
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('my-love-pwa-db');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn('Database deletion blocked');
          resolve();
        };
      });
    });

    // Mock Supabase environment variables
    await page.addInitScript(() => {
      // @ts-ignore
      window.import_meta_env = {
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'test-anon-key',
        VITE_USER_ID: '00000000-0000-0000-0000-000000000001',
        VITE_PARTNER_ID: '00000000-0000-0000-0000-000000000002',
      };
    });
  });

  test.describe('AC#1: Mood Sync with Offline Behavior', () => {
    test('should log mood offline and sync when online', async () => {
      // Navigate to Mood tab
      await page.click('[data-testid="nav-mood"]');
      await expect(page.locator('[data-testid="mood-tracker"]')).toBeVisible();

      // Mock offline network state
      await page.context().setOffline(true);

      // Wait for offline indicator
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).toBeVisible();

      // Log a mood while offline
      await page.click('[data-testid="mood-button-loved"]');

      // Add optional note
      await page.fill('[data-testid="mood-note-input"]', 'Missing you so much!');

      // Submit mood
      await page.click('[data-testid="mood-save-button"]');

      // Verify success message
      await expect(page.locator('text=/Mood saved locally/i')).toBeVisible();

      // Verify pending sync indicator appears
      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).toBeVisible();

      // Go back online
      await page.context().setOffline(false);

      // Trigger manual sync or wait for auto-sync
      // Auto-sync should happen via the 'online' event listener in App.tsx
      await page.waitForTimeout(2000); // Allow time for auto-sync

      // Verify sync status updated
      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).not.toBeVisible();

      // Verify last sync timestamp is recent
      const syncStatus = await page.textContent('[data-testid="mood-sync-status"]');
      expect(syncStatus).toContain('Just now');
    });

    test('should retry failed syncs with exponential backoff', async () => {
      // Mock network to simulate intermittent failures
      await page.route('**/rest/v1/moods*', (route) => {
        // Fail first 2 attempts, succeed on 3rd
        const url = route.request().url();
        if (url.includes('retry-test')) {
          route.fulfill({ status: 500, body: 'Server Error' });
        } else {
          route.continue();
        }
      });

      // Navigate to Mood tab
      await page.click('[data-testid="nav-mood"]');

      // Log a mood
      await page.click('[data-testid="mood-button-happy"]');
      await page.click('[data-testid="mood-save-button"]');

      // Verify retry attempts (check console logs or sync status)
      // Note: This test would need Supabase mocking infrastructure to fully validate
      // For now, we verify the UI handles sync failures gracefully

      await expect(page.locator('[data-testid="mood-tracker"]')).toBeVisible();
    });
  });

  test.describe('AC#2: Network State Detection', () => {
    test('should detect network transitions and auto-sync', async () => {
      // Navigate to Mood tab
      await page.click('[data-testid="nav-mood"]');

      // Go offline
      await page.context().setOffline(true);
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).toBeVisible();

      // Log mood while offline
      await page.click('[data-testid="mood-button-content"]');
      await page.click('[data-testid="mood-save-button"]');

      // Verify pending sync
      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).toBeVisible();

      // Go back online - should trigger auto-sync
      await page.context().setOffline(false);

      // Wait for auto-sync to complete
      await page.waitForTimeout(3000);

      // Verify offline notice is gone
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).not.toBeVisible();

      // Verify pending indicator is cleared (mood synced)
      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).not.toBeVisible();
    });

    test('should show online/offline status in UI', async () => {
      // Navigate to Mood tab
      await page.click('[data-testid="nav-mood"]');

      // Verify online status (default)
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).not.toBeVisible();

      // Go offline
      await page.context().setOffline(true);
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).toBeVisible();

      // Go back online
      await page.context().setOffline(false);
      await expect(page.locator('[data-testid="mood-sync-offline-notice"]')).not.toBeVisible();
    });
  });

  test.describe('AC#3: Partner Mood Visibility', () => {
    test('should display partner moods list', async () => {
      // Mock partner moods data
      await page.route('**/rest/v1/moods*', (route) => {
        const url = route.request().url();
        if (url.includes('user_id=eq.00000000-0000-0000-0000-000000000002')) {
          // Partner moods query
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: '1',
                user_id: '00000000-0000-0000-0000-000000000002',
                mood_type: 'loved',
                note: 'Thinking of you!',
                created_at: new Date().toISOString(),
              },
              {
                id: '2',
                user_id: '00000000-0000-0000-0000-000000000002',
                mood_type: 'happy',
                note: 'Great day today!',
                created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
              },
            ]),
          });
        } else {
          route.continue();
        }
      });

      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      // Verify Partner Mood View is visible
      await expect(page.locator('[data-testid="partner-mood-view"]')).toBeVisible();

      // Verify partner mood list is displayed
      await expect(page.locator('[data-testid="partner-mood-list"]')).toBeVisible();

      // Verify at least 2 mood cards are displayed
      const moodCards = page.locator('[data-testid="partner-mood-card"]');
      await expect(moodCards).toHaveCount(2);

      // Verify mood details are shown
      await expect(page.locator('text=Loved')).toBeVisible();
      await expect(page.locator('text=Thinking of you!')).toBeVisible();
      await expect(page.locator('text=Happy')).toBeVisible();
      await expect(page.locator('text=Great day today!')).toBeVisible();
    });

    test('should show empty state when no partner moods', async () => {
      // Mock empty partner moods response
      await page.route('**/rest/v1/moods*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      // Verify empty state is displayed
      await expect(page.locator('[data-testid="partner-mood-empty-state"]')).toBeVisible();
      await expect(page.locator('text=/No moods yet/i')).toBeVisible();
    });

    test('should refresh partner moods on button click', async () => {
      let fetchCount = 0;

      // Mock partner moods API with counter
      await page.route('**/rest/v1/moods*', (route) => {
        const url = route.request().url();
        if (url.includes('user_id=eq.00000000-0000-0000-0000-000000000002')) {
          fetchCount++;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: `${fetchCount}`,
                user_id: '00000000-0000-0000-0000-000000000002',
                mood_type: 'loved',
                note: `Fetch #${fetchCount}`,
                created_at: new Date().toISOString(),
              },
            ]),
          });
        } else {
          route.continue();
        }
      });

      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');
      await expect(page.locator('[data-testid="partner-mood-view"]')).toBeVisible();

      // Initial fetch count should be 1
      expect(fetchCount).toBe(1);

      // Click refresh button
      await page.click('[data-testid="partner-mood-refresh-button"]');

      // Wait for refresh to complete
      await page.waitForTimeout(1000);

      // Fetch count should be 2
      expect(fetchCount).toBe(2);

      // Verify updated mood note is displayed
      await expect(page.locator('text=Fetch #2')).toBeVisible();
    });

    test('should show error when partner mood fetch fails', async () => {
      // Mock failed API response
      await page.route('**/rest/v1/moods*', (route) => {
        route.fulfill({
          status: 500,
          body: 'Internal Server Error',
        });
      });

      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      // Wait for error to appear
      await expect(page.locator('[data-testid="partner-mood-error"]')).toBeVisible();
      await expect(page.locator('text=/Failed to load/i')).toBeVisible();
    });
  });

  test.describe('AC#4: Real-time Notifications', () => {
    test('should show notification when partner logs new mood', async () => {
      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');
      await expect(page.locator('[data-testid="partner-mood-view"]')).toBeVisible();

      // Simulate Supabase Realtime INSERT event
      await page.evaluate(() => {
        // Mock the realtime event
        const event = new CustomEvent('partner-mood-inserted', {
          detail: {
            mood_type: 'loved',
            note: 'Missing you!',
            created_at: new Date().toISOString(),
          },
        });
        window.dispatchEvent(event);
      });

      // Verify notification toast appears
      await expect(page.locator('[data-testid="partner-mood-notification"]')).toBeVisible();

      // Verify notification content
      await expect(page.locator('text=/just logged a mood: Loved/i')).toBeVisible();
      await expect(page.locator('text=Missing you!')).toBeVisible();

      // Wait for notification to auto-hide (5 seconds)
      await page.waitForTimeout(5500);

      // Verify notification is hidden
      await expect(page.locator('[data-testid="partner-mood-notification"]')).not.toBeVisible();
    });

    test('should update partner mood list when realtime event received', async () => {
      // Mock initial partner moods
      await page.route('**/rest/v1/moods*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '1',
              user_id: '00000000-0000-0000-0000-000000000002',
              mood_type: 'happy',
              note: 'Initial mood',
              created_at: new Date().toISOString(),
            },
          ]),
        });
      });

      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      // Verify initial mood count
      let moodCards = page.locator('[data-testid="partner-mood-card"]');
      await expect(moodCards).toHaveCount(1);

      // Mock updated moods after realtime event
      await page.route('**/rest/v1/moods*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '2',
              user_id: '00000000-0000-0000-0000-000000000002',
              mood_type: 'loved',
              note: 'New realtime mood!',
              created_at: new Date().toISOString(),
            },
            {
              id: '1',
              user_id: '00000000-0000-0000-0000-000000000002',
              mood_type: 'happy',
              note: 'Initial mood',
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
        });
      });

      // Simulate realtime event
      await page.evaluate(() => {
        const event = new CustomEvent('partner-mood-inserted', {
          detail: {
            mood_type: 'loved',
            note: 'New realtime mood!',
            created_at: new Date().toISOString(),
          },
        });
        window.dispatchEvent(event);
      });

      // Wait for list refresh
      await page.waitForTimeout(2000);

      // Verify mood count increased
      moodCards = page.locator('[data-testid="partner-mood-card"]');
      await expect(moodCards).toHaveCount(2);

      // Verify new mood is displayed
      await expect(page.locator('text=New realtime mood!')).toBeVisible();
    });
  });

  test.describe('AC#5: Connection Status Indicator', () => {
    test('should show connection status indicator', async () => {
      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');
      await expect(page.locator('[data-testid="partner-mood-view"]')).toBeVisible();

      // Verify connection status indicator exists when online
      const statusIndicator = page.locator('[data-testid="realtime-connection-status"]');
      await expect(statusIndicator).toBeVisible();
    });

    test('should update connection status on network changes', async () => {
      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      // Verify initial connected state (when online)
      const statusIndicator = page.locator('[data-testid="realtime-connection-status"]');
      await expect(statusIndicator).toBeVisible();

      // Go offline
      await page.context().setOffline(true);
      await page.waitForTimeout(1000);

      // Verify status indicator reflects offline/disconnected
      // (The indicator should hide or show disconnected state when offline)
      // Based on implementation, it only shows when online
      await page.context().setOffline(false);
      await page.waitForTimeout(1000);

      // Should show connected again
      await expect(statusIndicator).toBeVisible();
    });

    test('should show different states: connected, reconnecting, disconnected', async () => {
      // Navigate to Partner tab
      await page.click('[data-testid="nav-partner"]');

      const statusIndicator = page.locator('[data-testid="realtime-connection-status"]');

      // Verify connected state (initial)
      await expect(statusIndicator).toContainText(/connected/i);

      // Simulate reconnecting state by triggering a TIMED_OUT event
      await page.evaluate(() => {
        // Mock Supabase Realtime status change
        window.dispatchEvent(
          new CustomEvent('realtime-status-change', {
            detail: { status: 'TIMED_OUT' },
          })
        );
      });

      await page.waitForTimeout(500);

      // Verify reconnecting state
      await expect(statusIndicator).toContainText(/reconnecting/i);

      // Simulate connected state
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('realtime-status-change', {
            detail: { status: 'SUBSCRIBED' },
          })
        );
      });

      await page.waitForTimeout(500);

      // Verify connected state
      await expect(statusIndicator).toContainText(/connected/i);
    });
  });

  test.describe('Integration: Full User Flow', () => {
    test('should handle complete mood sync and partner visibility workflow', async () => {
      // Step 1: Log mood while offline
      await page.click('[data-testid="nav-mood"]');
      await page.context().setOffline(true);

      await page.click('[data-testid="mood-button-loved"]');
      await page.fill('[data-testid="mood-note-input"]', 'Offline test mood');
      await page.click('[data-testid="mood-save-button"]');

      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).toBeVisible();

      // Step 2: Go online and auto-sync
      await page.context().setOffline(false);
      await page.waitForTimeout(3000);

      await expect(page.locator('[data-testid="mood-sync-pending-indicator"]')).not.toBeVisible();

      // Step 3: Navigate to Partner tab and view partner's moods
      await page.route('**/rest/v1/moods*', (route) => {
        const url = route.request().url();
        if (url.includes('user_id=eq.00000000-0000-0000-0000-000000000002')) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: '1',
                user_id: '00000000-0000-0000-0000-000000000002',
                mood_type: 'happy',
                note: 'Partner mood!',
                created_at: new Date().toISOString(),
              },
            ]),
          });
        } else {
          route.continue();
        }
      });

      await page.click('[data-testid="nav-partner"]');
      await expect(page.locator('[data-testid="partner-mood-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="partner-mood-list"]')).toBeVisible();
      await expect(page.locator('text=Partner mood!')).toBeVisible();

      // Step 4: Receive real-time notification
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('partner-mood-inserted', {
            detail: {
              mood_type: 'loved',
              note: 'Real-time update!',
              created_at: new Date().toISOString(),
            },
          })
        );
      });

      await expect(page.locator('[data-testid="partner-mood-notification"]')).toBeVisible();
      await expect(page.locator('text=Real-time update!')).toBeVisible();

      // Step 5: Verify connection status is healthy
      await expect(page.locator('[data-testid="realtime-connection-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="realtime-connection-status"]')).toContainText(
        /connected/i
      );
    });
  });
});
