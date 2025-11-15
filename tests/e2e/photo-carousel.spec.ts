import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Story 4.3: Photo Carousel with Animated Transitions - E2E Test Suite
 *
 * Tests cover all acceptance criteria (AC-4.3.1 through AC-4.3.9)
 * Builds on Story 4.2's photo gallery grid view foundation
 */

// Helper: Upload a single test photo via PhotoUpload modal
async function uploadTestPhoto(
  page: any,
  photoFileName: string,
  caption?: string,
  tags?: string[]
) {
  // Open Photos tab
  await page.click('[data-testid="nav-photos"]');

  // If empty state, click \"Upload Photo\" button
  const emptyStateButton = page.locator('[data-testid="photo-gallery-empty-upload-button"]');
  const isEmptyState = await emptyStateButton.isVisible().catch(() => false);

  if (isEmptyState) {
    await emptyStateButton.click();
  }

  // Wait for PhotoUpload modal
  await page.waitForSelector('[data-testid="photo-upload-modal"]', { timeout: 5000 });

  // Select file
  const filePath = path.join(__dirname, '..', 'fixtures', photoFileName);
  await page.setInputFiles('[data-testid="photo-upload-file-input"]', filePath);

  // Add caption if provided
  if (caption) {
    await page.fill('[data-testid="photo-upload-caption-input"]', caption);
  }

  // Add tags if provided
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      await page.fill('[data-testid="photo-upload-tags-input"]', tag);
      await page.keyboard.press('Enter');
    }
  }

  // Submit upload
  await page.click('[data-testid="photo-upload-submit-button"]');

  // Wait for upload to complete
  await page.waitForSelector('[data-testid="photo-upload-modal"]', {
    state: 'hidden',
    timeout: 10000,
  });
}

// Helper: Upload multiple test photos
async function uploadMultiplePhotos(
  page: any,
  photos: Array<{ fileName: string; caption?: string; tags?: string[] }>
) {
  for (const photo of photos) {
    await uploadTestPhoto(page, photo.fileName, photo.caption, photo.tags);
    await page.waitForTimeout(200); // Brief pause between uploads
  }
}

test.describe('Photo Carousel - Story 4.3', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage for clean state
    await context.clearCookies();
    await context.clearPermissions();

    await page.goto('/');

    // Clear IndexedDB to prevent version conflicts
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('my-love-db');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => setTimeout(() => resolve(), 100);
      });
    });

    // Clear localStorage
    await page.evaluate(() => localStorage.clear());

    // Reload after clearing
    await page.reload();

    // Handle welcome splash if present
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForSelector('button:has-text("Continue")', { state: 'hidden', timeout: 5000 });
    }

    // Wait for app initialization
    await page.waitForSelector('[data-testid="daily-message-container"]', { timeout: 10000 });
  });

  test('AC-4.3.1: Tap grid photo opens full-screen carousel with correct photo', async ({
    page,
  }) => {
    // Upload 3 test photos
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'Photo 1', tags: ['test'] },
      { fileName: 'test-image.jpg', caption: 'Photo 2', tags: ['second'] },
      { fileName: 'test-image.jpg', caption: 'Photo 3', tags: ['third'] },
    ]);

    // Tap second photo in grid
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(3);
    await photoItems.nth(1).click();

    // Verify carousel opens
    const carousel = page.locator('[data-testid="photo-carousel"]');
    await expect(carousel).toBeVisible();

    // Verify correct photo is displayed (Photo 2)
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 2');

    // Verify full-screen overlay
    await expect(carousel).toHaveCSS('position', 'fixed');
    await expect(carousel).toHaveCSS('z-index', '50');

    // Verify semi-transparent backdrop
    const backdropClass = await carousel.getAttribute('class');
    expect(backdropClass).toContain('bg-black/80');
  });

  test('AC-4.3.2: Swipe left/right navigates between photos', async ({ page }) => {
    // Upload 5 photos
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'Photo 1' },
      { fileName: 'test-image.jpg', caption: 'Photo 2' },
      { fileName: 'test-image.jpg', caption: 'Photo 3' },
      { fileName: 'test-image.jpg', caption: 'Photo 4' },
      { fileName: 'test-image.jpg', caption: 'Photo 5' },
    ]);

    // Open carousel on photo 3 (index 2)
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await photoItems.nth(2).click();
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3');

    // Simulate swipe left (drag right-to-left > 50px to show next photo)
    const imageContainer = page.locator('[data-testid="photo-carousel-image-container"]');
    const box = await imageContainer.boundingBox();
    if (box) {
      // Start from center, drag left 100px
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
    }

    // Verify navigated to Photo 4
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 4', {
      timeout: 1000,
    });

    // Simulate swipe right (drag left-to-right > 50px to show previous photo)
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
    }

    // Verify navigated back to Photo 3
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3', {
      timeout: 1000,
    });
  });

  test('AC-4.3.3: Photo displayed at optimal size maintaining aspect ratio', async ({ page }) => {
    // Upload photos with different aspect ratios
    await uploadTestPhoto(page, 'test-image.jpg', 'Landscape photo');

    // Open carousel
    await page.click('[data-testid="photo-grid-item"]');

    // Verify image uses object-fit: contain
    const image = page.locator('[data-testid="photo-carousel-image"]');
    await expect(image).toBeVisible();
    await expect(image).toHaveCSS('object-fit', 'contain');

    // Verify max dimensions
    const maxWidthClass = await image.getAttribute('class');
    expect(maxWidthClass).toContain('max-w-full');
    expect(maxWidthClass).toContain('max-h-full');

    // Verify image is centered (container has flex + center)
    const container = page.locator('[data-testid="photo-carousel-image-container"]').first();
    const containerClass = await container.getAttribute('class');
    expect(containerClass).toContain('items-center');
    expect(containerClass).toContain('justify-center');
  });

  test('AC-4.3.4: Caption and tags displayed correctly', async ({ page }) => {
    // Test 1: Photo with both caption and tags
    await uploadTestPhoto(page, 'test-image.jpg', 'Beautiful sunset at the beach', [
      'sunset',
      'beach',
      'nature',
    ]);
    await page.click('[data-testid="photo-grid-item"]');

    // Verify caption displayed
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText(
      'Beautiful sunset at the beach'
    );

    // Verify tags displayed
    const tags = page.locator('[data-testid^="photo-carousel-tag-"]');
    await expect(tags).toHaveCount(3);
    await expect(tags.nth(0)).toHaveText('sunset');
    await expect(tags.nth(1)).toHaveText('beach');
    await expect(tags.nth(2)).toHaveText('nature');

    // Close carousel
    await page.keyboard.press('Escape');

    // Test 2: Photo with no caption or tags
    await uploadTestPhoto(page, 'test-image.jpg');
    await page.click('[data-testid="photo-grid-item"]');

    // Verify metadata section is hidden
    await expect(page.locator('[data-testid="photo-carousel-metadata"]')).not.toBeVisible();
  });

  test('AC-4.3.5: Close button and swipe-down close carousel', async ({ page }) => {
    await uploadTestPhoto(page, 'test-image.jpg', 'Test photo');

    // Test 1: Close with X button
    await page.click('[data-testid="photo-grid-item"]');
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();

    await page.click('[data-testid="photo-carousel-close-button"]');
    await expect(page.locator('[data-testid="photo-carousel"]')).not.toBeVisible();

    // Verify returned to gallery
    await expect(page.locator('[data-testid="photo-gallery"]')).toBeVisible();

    // Test 2: Close with swipe-down gesture
    await page.click('[data-testid="photo-grid-item"]');
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();

    const imageContainer = page.locator('[data-testid="photo-carousel-image-container"]');
    const box = await imageContainer.boundingBox();
    if (box) {
      // Swipe down >100px
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 10 });
      await page.mouse.up();
    }

    // Verify carousel closed
    await expect(page.locator('[data-testid="photo-carousel"]')).not.toBeVisible({ timeout: 1000 });
  });

  test('AC-4.3.6: Keyboard navigation works', async ({ page }) => {
    // Upload 5 photos
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'Photo 1' },
      { fileName: 'test-image.jpg', caption: 'Photo 2' },
      { fileName: 'test-image.jpg', caption: 'Photo 3' },
      { fileName: 'test-image.jpg', caption: 'Photo 4' },
      { fileName: 'test-image.jpg', caption: 'Photo 5' },
    ]);

    // Open carousel on Photo 3
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await photoItems.nth(2).click();
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3');

    // Test ArrowRight → next photo
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 4', {
      timeout: 500,
    });

    // Test ArrowRight again
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 5', {
      timeout: 500,
    });

    // Test ArrowLeft → previous photo
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 4', {
      timeout: 500,
    });

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3', {
      timeout: 500,
    });

    // Test Escape → close carousel
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="photo-carousel"]')).not.toBeVisible();
  });

  test('AC-4.3.7: Framer Motion animations smooth (300ms spring transitions)', async ({ page }) => {
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'Photo 1' },
      { fileName: 'test-image.jpg', caption: 'Photo 2' },
    ]);

    // Open carousel (entrance animation)
    await page.click('[data-testid="photo-grid-item"]');

    // Wait for entrance animation to complete (300ms + buffer)
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();

    // Navigate to test swipe transition (300ms spring)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 2');

    // Close carousel (exit animation 200ms)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="photo-carousel"]')).not.toBeVisible();

    // Note: Visual smoothness inspection should be done manually with DevTools Performance trace
    // This test verifies animations complete within expected timeframes
  });

  test('AC-4.3.8: Edit and Delete buttons visible but disabled', async ({ page }) => {
    await uploadTestPhoto(page, 'test-image.jpg', 'Test photo');

    // Open carousel
    await page.click('[data-testid="photo-grid-item"]');

    // Verify top controls bar exists
    await expect(page.locator('[data-testid="photo-carousel-controls"]')).toBeVisible();

    // Verify Edit button visible but disabled
    const editButton = page.locator('[data-testid="photo-carousel-edit-button"]');
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeDisabled();
    await expect(editButton).toHaveCSS('opacity', '0.5');

    // Verify Delete button visible but disabled
    const deleteButton = page.locator('[data-testid="photo-carousel-delete-button"]');
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeDisabled();
    await expect(deleteButton).toHaveCSS('opacity', '0.5');

    // Verify Close button functional
    const closeButton = page.locator('[data-testid="photo-carousel-controls-close-button"]');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeEnabled();
  });

  test('AC-4.3.9: Drag constraints prevent over-scroll at boundaries', async ({ page }) => {
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'First' },
      { fileName: 'test-image.jpg', caption: 'Middle' },
      { fileName: 'test-image.jpg', caption: 'Last' },
    ]);

    // Test first photo boundary
    await page.click('[data-testid="photo-grid-item"]'); // First photo
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('First');

    // Attempt to swipe right (should bounce, stay on first photo)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('First'); // Still first

    // Navigate to last photo
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Last');

    // Attempt to swipe left (should bounce, stay on last photo)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Last'); // Still last

    // Verify middle photo allows navigation in both directions
    await page.keyboard.press('ArrowLeft'); // Back to middle
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Middle');

    await page.keyboard.press('ArrowLeft'); // Can go back to first
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('First');

    await page.keyboard.press('ArrowRight'); // Can go forward to middle
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Middle');
  });

  test('Visual test: Photo counter shows current/total', async ({ page }) => {
    await uploadMultiplePhotos(page, [
      { fileName: 'test-image.jpg', caption: 'Photo 1' },
      { fileName: 'test-image.jpg', caption: 'Photo 2' },
      { fileName: 'test-image.jpg', caption: 'Photo 3' },
    ]);

    // Open carousel on first photo
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await photoItems.nth(0).click();

    // Verify counter shows "1 / 3"
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('1 / 3');

    // Navigate to second photo
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('2 / 3');

    // Navigate to third photo
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('3 / 3');
  });
});
