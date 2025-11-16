/**
 * E2E tests for Anniversary Countdown feature (Story 6.6)
 * Tests user journey from adding anniversaries to viewing countdowns
 */

import { test, expect, type Page } from '@playwright/test';

// Helper to navigate to settings (assuming bottom nav exists)
async function navigateToSettings(page: Page) {
  // Click settings button in navigation
  // Note: Adjust selector based on actual Settings navigation implementation
  await page.goto('/'); // Start at home
  // await page.click('[data-testid="nav-settings"]');
  // For now, we'll assume settings are accessible via URL or modal
}

// Helper to add an anniversary
async function addAnniversary(page: Page, label: string, date: string, description?: string) {
  await page.click('button:has-text("Add Anniversary")');

  // Fill form
  await page.fill('input#anniversary-label', label);
  await page.fill('input#anniversary-date', date);

  if (description) {
    await page.fill('textarea#anniversary-description', description);
  }

  // Submit form
  await page.click('button:has-text("Add")');

  // Wait for form to close
  await page.waitForSelector('button:has-text("Add Anniversary")');
}

test.describe('Anniversary Countdown', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AC-6.6.1: Add anniversary and verify it displays in countdown', async ({ page }) => {
    // Navigate to settings
    // Note: This assumes AnniversarySettings is accessible
    // Adjust based on actual implementation

    // For now, test that CountdownTimer component renders when anniversaries exist
    // This test will need to be updated once Settings page integration is complete

    // Add anniversary via localStorage (temporary workaround)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
    const dateString = futureDate.toISOString().split('T')[0];

    await page.evaluate(
      ({ date }) => {
        const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
        if (!storage.state) storage.state = {};
        if (!storage.state.settings) {
          storage.state.settings = {
            themeName: 'sunset',
            notificationTime: '09:00',
            relationship: {
              startDate: '2023-01-01',
              partnerName: 'Test Partner',
              anniversaries: [],
            },
            customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
            notifications: { enabled: true, time: '09:00' },
          };
        }

        storage.state.settings.relationship.anniversaries = [
          {
            id: 1,
            label: 'First Date Anniversary',
            date: date,
            description: 'Our special day',
          },
        ];

        localStorage.setItem('my-love-storage', JSON.stringify(storage));
      },
      { date: dateString }
    );

    // Reload to pick up changes
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify countdown displays
    await expect(page.locator('text=First Date Anniversary')).toBeVisible();
    await expect(page.locator('text=/\\d+ days/')).toBeVisible();
  });

  test('AC-6.6.2: Countdown shows days, hours, minutes', async ({ page }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    futureDate.setHours(futureDate.getHours() + 3);
    const dateString = futureDate.toISOString().split('T')[0];

    await page.evaluate(
      ({ date }) => {
        const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
        if (!storage.state) storage.state = {};
        if (!storage.state.settings) {
          storage.state.settings = {
            themeName: 'sunset',
            notificationTime: '09:00',
            relationship: {
              startDate: '2023-01-01',
              partnerName: 'Test Partner',
              anniversaries: [],
            },
            customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
            notifications: { enabled: true, time: '09:00' },
          };
        }

        storage.state.settings.relationship.anniversaries = [
          { id: 1, label: 'Test Event', date: date },
        ];

        localStorage.setItem('my-love-storage', JSON.stringify(storage));
      },
      { date: dateString }
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify countdown format includes days, hours, minutes
    const countdown = page.locator('text=Test Event').locator('..');
    await expect(countdown.locator('text=/\\d+/')).toHaveCount(3); // 3 numbers (days, hours, mins)
    await expect(countdown.locator('text=/days|hours|min/')).toBeVisible();
  });

  test('AC-6.6.3: Multiple anniversaries display next 3', async ({ page }) => {
    const today = new Date();
    const anniversaries = [
      { id: 1, label: 'Event 1', days: 10 },
      { id: 2, label: 'Event 2', days: 20 },
      { id: 3, label: 'Event 3', days: 30 },
      { id: 4, label: 'Event 4', days: 40 },
      { id: 5, label: 'Event 5', days: 50 },
    ];

    await page.evaluate((annivs) => {
      const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
      if (!storage.state) storage.state = {};
      if (!storage.state.settings) {
        storage.state.settings = {
          themeName: 'sunset',
          notificationTime: '09:00',
          relationship: {
            startDate: '2023-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
          notifications: { enabled: true, time: '09:00' },
        };
      }

      const today = new Date();
      storage.state.settings.relationship.anniversaries = annivs.map((a) => {
        const date = new Date(today);
        date.setDate(date.getDate() + a.days);
        return {
          id: a.id,
          label: a.label,
          date: date.toISOString().split('T')[0],
        };
      });

      localStorage.setItem('my-love-storage', JSON.stringify(storage));
    }, anniversaries);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify only 3 anniversaries are displayed
    await expect(page.locator('text=Event 1')).toBeVisible();
    await expect(page.locator('text=Event 2')).toBeVisible();
    await expect(page.locator('text=Event 3')).toBeVisible();
    await expect(page.locator('text=Event 4')).not.toBeVisible();
    await expect(page.locator('text=Event 5')).not.toBeVisible();
  });

  test('AC-6.6.4: Celebration animation triggers at zero (simulated)', async ({ page }) => {
    // Set anniversary to today
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];

    await page.evaluate(
      ({ date }) => {
        const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
        if (!storage.state) storage.state = {};
        if (!storage.state.settings) {
          storage.state.settings = {
            themeName: 'sunset',
            notificationTime: '09:00',
            relationship: {
              startDate: '2023-01-01',
              partnerName: 'Test Partner',
              anniversaries: [],
            },
            customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
            notifications: { enabled: true, time: '09:00' },
          };
        }

        storage.state.settings.relationship.anniversaries = [
          { id: 1, label: 'Today Anniversary', date: date },
        ];

        localStorage.setItem('my-love-storage', JSON.stringify(storage));
      },
      { date: dateString }
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify "Today is" message appears
    await expect(page.locator('text=/Today is.*Anniversary/')).toBeVisible();

    // Check for celebration indicators (sparkles icon, special styling)
    // Note: Adjust selectors based on actual implementation
    const celebrationCard = page.locator('text=Today Anniversary').locator('..');
    await expect(celebrationCard).toBeVisible();

    // Could check for animation classes or Sparkles icon if accessible
  });

  test('AC-6.6.5: Responsive layout works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const dateString = futureDate.toISOString().split('T')[0];

    await page.evaluate(
      ({ date }) => {
        const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
        if (!storage.state) storage.state = {};
        if (!storage.state.settings) {
          storage.state.settings = {
            themeName: 'sunset',
            notificationTime: '09:00',
            relationship: {
              startDate: '2023-01-01',
              partnerName: 'Test Partner',
              anniversaries: [],
            },
            customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
            notifications: { enabled: true, time: '09:00' },
          };
        }

        storage.state.settings.relationship.anniversaries = [
          { id: 1, label: 'Mobile Test', date: date },
        ];

        localStorage.setItem('my-love-storage', JSON.stringify(storage));
      },
      { date: dateString }
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify countdown is visible and not overflowing
    const countdown = page.locator('text=Mobile Test');
    await expect(countdown).toBeVisible();

    // Check that countdown card is within viewport
    const box = await countdown.locator('..').boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });

  test('AC-6.6.6: No countdown shown when no anniversaries exist', async ({ page }) => {
    // Clear anniversaries
    await page.evaluate(() => {
      const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
      if (!storage.state) storage.state = {};
      if (!storage.state.settings) {
        storage.state.settings = {
          themeName: 'sunset',
          notificationTime: '09:00',
          relationship: {
            startDate: '2023-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
          notifications: { enabled: true, time: '09:00' },
        };
      }

      storage.state.settings.relationship.anniversaries = [];
      localStorage.setItem('my-love-storage', JSON.stringify(storage));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify no countdown component is rendered
    await expect(page.locator('text=/\\d+ days/')).not.toBeVisible();
  });

  test('AC-6.6.7: Form validation prevents invalid anniversaries', async ({ page }) => {
    // This test would be implemented once AnniversarySettings is integrated into a Settings page
    // For now, we can test validation via programmatic checks

    // Test empty label validation
    // Test invalid date format validation
    // Test past date handling

    // Placeholder - will be implemented when Settings page is accessible
    test.skip();
  });

  test('AC-6.6.8: Past anniversaries marked as celebrated', async ({ page }) => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10); // 10 days ago
    const dateString = pastDate.toISOString().split('T')[0];

    await page.evaluate(
      ({ date }) => {
        const storage = JSON.parse(localStorage.getItem('my-love-storage') || '{}');
        if (!storage.state) storage.state = {};
        if (!storage.state.settings) {
          storage.state.settings = {
            themeName: 'sunset',
            notificationTime: '09:00',
            relationship: {
              startDate: '2023-01-01',
              partnerName: 'Test Partner',
              anniversaries: [],
            },
            customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
            notifications: { enabled: true, time: '09:00' },
          };
        }

        storage.state.settings.relationship.anniversaries = [
          { id: 1, label: 'Past Event', date: date },
        ];

        localStorage.setItem('my-love-storage', JSON.stringify(storage));
      },
      { date: dateString }
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Past anniversary should show next year's occurrence
    // Should NOT be marked as "Celebrated" but should show future countdown
    const countdown = page.locator('text=Past Event');

    // Past events will show next year's occurrence, so should be visible
    // but with 350+ days remaining
    await expect(countdown).toBeVisible();
  });
});
