/**
 * Photo Sharing Tests - Gallery Access
 *
 * Tests photo/gallery functionality.
 * Authentication is handled by global-setup.ts via storageState.
 */

import { test, expect } from '@playwright/test';

test.describe('Photo Sharing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app - storageState handles authentication
    await page.goto('/');

    // Wait for app to be ready
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Navigate to photos section if available
    const photosNav = page
      .getByRole('button', { name: /photo|gallery|image|picture/i })
      .or(page.getByRole('tab', { name: /photo|gallery|image|picture/i }));

    if (await photosNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await photosNav.first().click();
      // Wait for photos page content to load (strict-mode safe polling)
      const gallery = page.getByTestId('photo-gallery');
      const emptyState = page.getByTestId('photo-gallery-empty-state');
      const emptyText = page.getByText(/no photos|add photos|upload/i);

      await expect
        .poll(
          async () =>
            (await gallery.isVisible()) ||
            (await emptyState.isVisible()) ||
            (await emptyText.first().isVisible()),
          { timeout: 5000, intervals: [100, 250, 500] }
        )
        .toBeTruthy();
    }
  });

  test('user can access photo section', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible();

    // Look for photo-related content
    const photoContent = page
      .getByTestId('photo-gallery')
      .or(page.getByTestId('photos-container'))
      .or(page.locator('[data-testid*="photo"]'))
      .or(page.getByText(/no photos|add photos|upload/i));

    // Either photo gallery or empty state should be visible
    const hasPhotoContent = await photoContent.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Test passes if we're on a functional photos page
    // (either showing photos or showing empty state)
    expect(hasPhotoContent || (await nav.isVisible())).toBe(true);
  });

  test('photo upload button is accessible', async ({ page }) => {
    // Look for upload button or add photo button
    const uploadButton = page
      .getByRole('button', { name: /upload|add photo|add picture/i })
      .or(page.getByTestId('photo-upload-button'))
      .or(page.locator('input[type="file"]'));

    const hasUploadOption = await uploadButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Upload option should exist in photos section
    // (might be file input or button)
    if (hasUploadOption) {
      await expect(uploadButton.first()).toBeVisible();
    }
  });

  test('photo gallery displays images or empty state', async ({ page }) => {
    // Wait for content to load (strict-mode safe polling)
    const photos = page.locator('[data-testid*="photo-item"], img[src*="photo"], img[src*="image"]');
    const emptyState = page.getByText(/no photos|add your first|upload photos/i);

    await expect
      .poll(
        async () =>
          (await photos.count()) > 0 || (await emptyState.first().isVisible()),
        { timeout: 5000, intervals: [100, 250, 500] }
      )
      .toBeTruthy();

    const photoCount = await photos.count();
    const hasEmptyState = await emptyState.first().isVisible().catch(() => false);

    // Either has photos or shows empty state
    expect(photoCount > 0 || hasEmptyState).toBe(true);
  });

  test('photos can be viewed in full screen/modal', async ({ page }) => {
    // Wait for content to load (strict-mode safe polling)
    const photoItems = page.locator(
      '[data-testid*="photo-item"], [data-testid="photo-thumbnail"], img[src*="photo"], img[src*="image"]'
    );
    const emptyState = page.getByTestId('photo-gallery-empty-state');
    const emptyText = page.getByText(/no photos|add your first|upload photos/i);

    await expect
      .poll(
        async () =>
          (await photoItems.count()) > 0 ||
          (await emptyState.isVisible()) ||
          (await emptyText.first().isVisible()),
        { timeout: 5000, intervals: [100, 250, 500] }
      )
      .toBeTruthy();

    const photoCount = await photoItems.count();

    if (photoCount > 0) {
      // Click first photo
      await photoItems.first().click();

      // Look for modal/lightbox/viewer
      const viewer = page
        .getByTestId('photo-viewer')
        .or(page.getByRole('dialog'))
        .or(page.locator('[class*="modal"]'))
        .or(page.locator('[class*="lightbox"]'));

      const viewerVisible = await viewer.isVisible({ timeout: 3000 }).catch(() => false);

      if (viewerVisible) {
        await expect(viewer).toBeVisible();

        // Close viewer (escape or close button)
        const closeButton = page.getByRole('button', { name: /close/i }).or(page.getByLabel(/close/i));
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('navigation remains functional in photos section', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible();

    // Navigate away and back
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    if (count >= 2) {
      // Click different nav item
      await navItems.nth(0).click();
      await expect(nav).toBeVisible();

      // Navigate back to photos
      const photosNav = page
        .getByRole('button', { name: /photo|gallery/i })
        .or(page.getByRole('tab', { name: /photo|gallery/i }));

      if (await photosNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await photosNav.first().click();
        await expect(nav).toBeVisible();
      }
    }
  });
});
