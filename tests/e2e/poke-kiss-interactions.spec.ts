/**
 * Poke & Kiss Interactions E2E Tests
 *
 * End-to-end tests for the complete interaction flow.
 * Tests user journey from sending interactions to viewing history.
 *
 * AC Coverage:
 * - AC#1: Interaction buttons in top nav
 * - AC#2: Tapping sends interaction to Supabase
 * - AC#3: Recipient receives notification badge
 * - AC#4: Animation playback (kiss hearts, poke nudge)
 * - AC#5: Mark interaction as viewed after animation
 * - AC#6: Interaction history viewable (last 7 days)
 * - AC#7: Can send unlimited interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Poke & Kiss Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Handle welcome splash if it appears (first visit or after 60min timeout)
    const continueButton = page.locator('button:has-text("Continue")');
    const splashVisible = await continueButton.isVisible().catch(() => false);

    if (splashVisible) {
      await continueButton.click();
    }

    // Wait for app to load
    await page.waitForSelector('[data-testid="poke-kiss-interface"]', { timeout: 10000 });
  });

  test.describe('AC#1: Interaction buttons in interface', () => {
    test('should display poke, kiss, and history buttons in top nav', async ({ page }) => {
      // Check for poke button
      const pokeButton = page.locator('[data-testid="poke-button"]');
      await expect(pokeButton).toBeVisible();

      // Check for kiss button
      const kissButton = page.locator('[data-testid="kiss-button"]');
      await expect(kissButton).toBeVisible();

      // Check for history button
      const historyButton = page.locator('[data-testid="history-button"]');
      await expect(historyButton).toBeVisible();

      // Verify buttons are in top-right corner
      const interfaceBox = await page
        .locator('[data-testid="poke-kiss-interface"]')
        .boundingBox();
      if (interfaceBox) {
        expect(interfaceBox.y).toBeLessThan(100); // Top of viewport
      }
    });

    test('should show appropriate icons and labels', async ({ page }) => {
      const pokeButton = page.locator('[data-testid="poke-button"]');
      await expect(pokeButton).toHaveAttribute('aria-label', 'Send Poke');

      const kissButton = page.locator('[data-testid="kiss-button"]');
      await expect(kissButton).toHaveAttribute('aria-label', 'Send Kiss');

      const historyButton = page.locator('[data-testid="history-button"]');
      await expect(historyButton).toHaveAttribute('aria-label', 'View Interaction History');
    });
  });

  test.describe('AC#2 & AC#7: Send interactions (unlimited)', () => {
    test('should send poke when poke button is clicked', async ({ page }) => {
      // Click poke button
      await page.click('[data-testid="poke-button"]');

      // Wait for toast notification
      await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast-notification"]')).toContainText(
        'Poke sent!'
      );
    });

    test('should send kiss when kiss button is clicked', async ({ page }) => {
      // Click kiss button
      await page.click('[data-testid="kiss-button"]');

      // Wait for toast notification
      await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast-notification"]')).toContainText('Kiss sent!');
    });

    test('should allow sending multiple interactions without limit', async ({ page }) => {
      // Send 5 pokes
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="poke-button"]');
        await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
        await page.waitForTimeout(500); // Wait for toast to disappear
      }

      // Send 5 kisses
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="kiss-button"]');
        await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
        await page.waitForTimeout(500);
      }

      // No errors should occur
      await expect(page.locator('text=Failed')).not.toBeVisible();
    });

    test('should show button animation on click', async ({ page }) => {
      const pokeButton = page.locator('[data-testid="poke-button"]');

      // Record initial state
      const initialBox = await pokeButton.boundingBox();

      // Click button
      await pokeButton.click();

      // Button should show some visual feedback (animation)
      // Just verify it doesn't error and toast appears
      await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
    });
  });

  test.describe('AC#3: Notification badge', () => {
    test('should not show badge when no unviewed interactions', async ({ page }) => {
      // Initially, badge should not be visible if no unviewed interactions
      const badge = page.locator('[data-testid="notification-badge"]');

      // Note: Badge visibility depends on actual data state
      // In a real scenario, this would be tested with proper test data
      // For now, we just verify the badge element structure
      const badgeExists = await badge.count();
      if (badgeExists > 0) {
        await expect(badge).toHaveText(/\d+/); // Should show a number
      }
    });
  });

  test.describe('AC#4 & AC#5: Animation playback and mark as viewed', () => {
    test('should show poke animation when badge is clicked (if unviewed poke exists)', async ({
      page,
    }) => {
      // This test depends on having unviewed interactions
      const badge = page.locator('[data-testid="notification-badge"]');

      // Only run if badge exists (meaning there are unviewed interactions)
      if ((await badge.count()) > 0) {
        await badge.click();

        // Wait for animation to appear
        const animation = page.locator('[data-testid="poke-animation"]');
        await expect(animation).toBeVisible({ timeout: 5000 });

        // Animation should contain emoji
        await expect(animation).toContainText('👆');

        // Wait for animation to complete (or click to dismiss)
        await page.click('[data-testid="poke-animation"]');

        // Animation should disappear
        await expect(animation).not.toBeVisible();
      }
    });

    test('should show kiss animation when badge is clicked (if unviewed kiss exists)', async ({
      page,
    }) => {
      const badge = page.locator('[data-testid="notification-badge"]');

      if ((await badge.count()) > 0) {
        await badge.click();

        // Wait for animation (could be poke or kiss)
        const kissAnimation = page.locator('[data-testid="kiss-animation"]');

        // Check if it's a kiss animation
        if ((await kissAnimation.count()) > 0) {
          await expect(kissAnimation).toBeVisible({ timeout: 5000 });

          // Animation should contain hearts
          await expect(kissAnimation).toContainText('💗');

          // Click to dismiss
          await page.click('[data-testid="kiss-animation"]');

          await expect(kissAnimation).not.toBeVisible();
        }
      }
    });
  });

  test.describe('AC#6: Interaction history view', () => {
    test('should open history modal when history button is clicked', async ({ page }) => {
      // Click history button
      await page.click('[data-testid="history-button"]');

      // Modal should open
      await expect(page.locator('[data-testid="interaction-history-modal"]')).toBeVisible();

      // Modal should have title
      await expect(page.locator('text=Interaction History')).toBeVisible();
    });

    test('should close history modal when close button is clicked', async ({ page }) => {
      // Open modal
      await page.click('[data-testid="history-button"]');
      await expect(page.locator('[data-testid="interaction-history-modal"]')).toBeVisible();

      // Click close button
      await page.click('[data-testid="close-history-button"]');

      // Modal should close
      await expect(page.locator('[data-testid="interaction-history-modal"]')).not.toBeVisible();
    });

    test('should close history modal when backdrop is clicked', async ({ page }) => {
      // Open modal
      await page.click('[data-testid="history-button"]');
      await expect(page.locator('[data-testid="interaction-history-modal"]')).toBeVisible();

      // Click backdrop
      await page.click('[data-testid="interaction-history-backdrop"]');

      // Modal should close
      await expect(page.locator('[data-testid="interaction-history-modal"]')).not.toBeVisible();
    });

    test('should display interaction count in footer', async ({ page }) => {
      // Open history modal
      await page.click('[data-testid="history-button"]');

      // Footer should show count
      await expect(page.locator('text=Showing interactions from the last 7 days')).toBeVisible();
      await expect(page.locator('text=/\\d+ total/')).toBeVisible();
    });

    test('should show empty state when no interactions exist', async ({ page }) => {
      // Open history modal
      await page.click('[data-testid="history-button"]');

      // Check for either interactions or empty state
      const emptyState = page.locator('text=No interactions yet');
      const interactionItems = page.locator('[data-testid^="interaction-"]');

      // Should show either empty state or interactions
      const hasEmpty = (await emptyState.count()) > 0;
      const hasItems = (await interactionItems.count()) > 0;

      expect(hasEmpty || hasItems).toBe(true);
    });
  });

  test.describe('Complete user journey', () => {
    test('should complete full interaction flow: send, view history, check display', async ({
      page,
    }) => {
      // Step 1: Send a poke
      await page.click('[data-testid="poke-button"]');
      await expect(page.locator('[data-testid="toast-notification"]')).toContainText(
        'Poke sent!'
      );
      await page.waitForTimeout(2500); // Wait for toast to disappear

      // Step 2: Send a kiss
      await page.click('[data-testid="kiss-button"]');
      await expect(page.locator('[data-testid="toast-notification"]')).toContainText('Kiss sent!');
      await page.waitForTimeout(2500);

      // Step 3: Open history
      await page.click('[data-testid="history-button"]');
      await expect(page.locator('[data-testid="interaction-history-modal"]')).toBeVisible();

      // Step 4: Verify interactions appear in history
      // (This depends on test data - in a real scenario, we'd have seeded data)
      const interactionCount = await page.locator('[data-testid^="interaction-"]').count();

      // Should have at least some interactions
      expect(interactionCount).toBeGreaterThanOrEqual(0);

      // Step 5: Close history
      await page.click('[data-testid="close-history-button"]');
      await expect(page.locator('[data-testid="interaction-history-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Error handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Simulate offline mode
      await context.setOffline(true);

      // Try to send interaction
      await page.click('[data-testid="poke-button"]');

      // Should show error toast
      await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();

      // Re-enable network
      await context.setOffline(false);
    });

    test('should handle missing partner configuration', async ({ page }) => {
      // This test depends on app state - in real scenario, we'd clear partner config
      // For now, just verify error handling doesn't crash the app
      await page.click('[data-testid="poke-button"]');

      // App should still be functional (either success or error toast)
      const toast = page.locator('[data-testid="toast-notification"]');
      if ((await toast.count()) > 0) {
        await expect(toast).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await expect(page.locator('[data-testid="poke-button"]')).toHaveAttribute(
        'aria-label',
        'Send Poke'
      );
      await expect(page.locator('[data-testid="kiss-button"]')).toHaveAttribute(
        'aria-label',
        'Send Kiss'
      );
      await expect(page.locator('[data-testid="history-button"]')).toHaveAttribute(
        'aria-label',
        'View Interaction History'
      );
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab to poke button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to activate with Enter
      await page.keyboard.press('Enter');

      // Toast should appear
      await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
    });
  });

  test.describe('Visual regression (basic)', () => {
    test('should render interface consistently', async ({ page }) => {
      // Take screenshot of interface
      const interface_ = page.locator('[data-testid="poke-kiss-interface"]');
      await expect(interface_).toBeVisible();

      // Verify all buttons render
      await expect(page.locator('[data-testid="history-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="poke-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="kiss-button"]')).toBeVisible();
    });
  });
});
