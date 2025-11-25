/**
 * Photo Sharing Tests - Upload and View
 *
 * Tests the photo gallery functionality.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Photo Sharing', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Handle onboarding if needed
    await page.waitForTimeout(2000);
    const displayNameInput = page.getByLabel(/display name/i);
    if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await displayNameInput.fill('TestUser');
      await page.getByRole('button', { name: /continue|save|submit/i }).click();
      await page.waitForTimeout(1000);
    }

    // Handle welcome/intro screen if needed
    const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
    if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
    }

    // Wait for app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('user can view photo gallery', async ({ page }) => {
    // Navigate to photos
    const photosTab = page.getByRole('tab', { name: /photo/i }).or(
      page.getByRole('button', { name: /photo|gallery/i })
    );
    if (await photosTab.isVisible()) {
      await photosTab.click();
    }

    // Gallery should be visible (may be empty but the section exists)
    const gallery = page.locator(
      '[data-testid="photo-gallery"], [data-testid="gallery"], ' +
      '[role="grid"], .gallery'
    );
    await expect(gallery.first()).toBeVisible({ timeout: 5000 });
  });

  test('user can access upload interface', async ({ page }) => {
    // Navigate to photos
    const photosTab = page.getByRole('tab', { name: /photo/i }).or(
      page.getByRole('button', { name: /photo|gallery/i })
    );
    if (await photosTab.isVisible()) {
      await photosTab.click();
    }

    // Find upload button
    const uploadButton = page.getByRole('button', { name: /upload|add/i }).or(
      page.locator('[data-testid="upload-button"], [data-testid="add-photo"]')
    );

    await expect(uploadButton.first()).toBeVisible({ timeout: 5000 });

    // Click upload button
    await uploadButton.first().click();

    // Should show file input or upload modal
    const fileInput = page.locator('input[type="file"]');
    const uploadModal = page.locator('[data-testid="upload-modal"], [role="dialog"]');

    // Either file input should be available or modal should open
    await expect(fileInput.or(uploadModal).first()).toBeVisible({ timeout: 5000 });
  });
});
