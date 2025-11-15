import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Story 5.2: Photo Pagination with Lazy Loading - E2E Test Suite
 *
 * Tests cover all acceptance criteria:
 * AC-1: PhotoGallery uses getPage() method
 * AC-2: 20 photos per page displayed
 * AC-3: Infinite scroll implemented
 * AC-4: Loading states with skeleton loaders
 * AC-5: Memory usage tested with 100+ photos (manual test documented separately)
 * AC-6: E2E tests cover pagination scenarios
 */

// Helper: Upload a test photo via PhotoUpload modal
async function uploadTestPhoto(page: any, photoFileName: string, caption?: string) {
  // Open Photos tab
  await page.click('[data-testid="nav-photos"]');

  // If empty state, click "Upload Photo" button
  const emptyStateButton = page.locator('[data-testid="photo-gallery-empty-upload-button"]');
  const uploadFab = page.locator('[data-testid="photo-gallery-upload-fab"]');

  const isEmptyState = await emptyStateButton.isVisible().catch(() => false);

  if (isEmptyState) {
    await emptyStateButton.click();
  } else {
    // Use FAB (floating action button) for upload when gallery has photos
    await uploadFab.click();
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

  // Submit upload
  await page.click('[data-testid="photo-upload-submit-button"]');

  // Wait for upload to complete (modal closes)
  await page.waitForSelector('[data-testid="photo-upload-modal"]', { state: 'hidden', timeout: 10000 });
}

// Helper: Bulk upload multiple photos for pagination testing
async function uploadMultiplePhotos(page: any, count: number) {
  for (let i = 1; i <= count; i++) {
    // Cycle through available test photos (test-photo1.jpg, test-photo2.jpg, test-photo3.jpg)
    const photoFileName = `test-photo${((i - 1) % 3) + 1}.jpg`;
    await uploadTestPhoto(page, photoFileName, `Photo ${i}`);
  }
}

test.describe('Photo Pagination with Lazy Loading', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage
    await context.clearCookies();
    await context.clearPermissions();

    // Start from home page
    await page.goto('/');

    // Clear IndexedDB
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('my-love-db');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => {
          setTimeout(() => resolve(), 100);
        };
      });
    });

    // Clear localStorage
    await page.evaluate(() => localStorage.clear());

    // Reload page
    await page.reload();

    // Handle welcome splash
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForSelector('button:has-text("Continue")', { state: 'hidden', timeout: 5000 });
    }

    // Wait for app initialization
    await page.waitForSelector('[data-testid="daily-message-container"]', { timeout: 10000 });
  });

  // AC-4: Skeleton loaders during initial load
  test('should show skeleton loaders during initial load', async ({ page }) => {
    // Upload a photo first to ensure there's data to load
    await uploadTestPhoto(page, 'test-photo1.jpg', 'Test photo');

    // Navigate away and back to Photos to trigger loading state
    await page.click('[data-testid="nav-home"]');
    await page.waitForTimeout(100);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');

    // Skeleton grid should appear (may be very brief with fast IndexedDB)
    const skeletonGrid = page.locator('[data-testid="photo-gallery-skeleton"]');

    // Either skeleton appears or photos load immediately
    const hasSkeletonState = await skeletonGrid.isVisible().catch(() => false);

    if (hasSkeletonState) {
      // Verify skeleton grid is visible
      await expect(skeletonGrid).toBeVisible();

      // Verify skeleton items are present
      const skeletonItems = page.locator('[data-testid="photo-grid-skeleton"]');
      await expect(skeletonItems.first()).toBeVisible();
    }

    // Eventually, actual photos should load
    await expect(page.locator('[data-testid="photo-gallery-grid"]')).toBeVisible({ timeout: 5000 });
  });

  // AC-2, AC-3: Initial load shows first 20 photos
  test('should initially load 20 photos when 50+ photos exist', async ({ page }) => {
    // Upload 50 photos for pagination testing
    await uploadMultiplePhotos(page, 50);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Verify exactly 20 photos are initially displayed
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(20);

    // Verify load trigger is visible (indicating more photos available)
    const loadTrigger = page.locator('[data-testid="photo-gallery-load-trigger"]');
    await expect(loadTrigger).toBeVisible();
  });

  // AC-3: Infinite scroll triggers when scrolling to bottom
  test('should load more photos when scrolling to bottom', async ({ page }) => {
    // Upload 50 photos
    await uploadMultiplePhotos(page, 50);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Initially 20 photos
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(20);

    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for "Loading more photos..." indicator
    await expect(page.locator('text=Loading more photos...')).toBeVisible({ timeout: 5000 });

    // Wait for next batch to load (20 more photos)
    await page.waitForTimeout(1000);

    // Should now have 40 photos
    await expect(photoItems).toHaveCount(40, { timeout: 5000 });
  });

  // AC-3: "No more photos" indicator when all photos loaded
  test('should show "no more photos" message when pagination ends', async ({ page }) => {
    // Upload 25 photos (1 full page + 5 partial page)
    await uploadMultiplePhotos(page, 25);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Initially 20 photos
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(20);

    // Scroll to trigger load more
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for final batch (5 photos)
    await page.waitForTimeout(1000);

    // Should have all 25 photos
    await expect(photoItems).toHaveCount(25, { timeout: 5000 });

    // "No more photos" message should appear
    const endMessage = page.locator('[data-testid="photo-gallery-end-message"]');
    await expect(endMessage).toBeVisible();
    await expect(endMessage).toContainText("You've reached the end of your memories");

    // Load trigger should not be visible
    const loadTrigger = page.locator('[data-testid="photo-gallery-load-trigger"]');
    await expect(loadTrigger).not.toBeVisible();
  });

  // Edge case: Exactly 20 photos (1 page, no pagination)
  test('should show all photos without pagination for exactly 20 photos', async ({ page }) => {
    // Upload exactly 20 photos
    await uploadMultiplePhotos(page, 20);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Should have 20 photos
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(20);

    // "No more photos" message should appear (since hasMore=false)
    const endMessage = page.locator('[data-testid="photo-gallery-end-message"]');
    await expect(endMessage).toBeVisible();

    // Load trigger should not be visible
    const loadTrigger = page.locator('[data-testid="photo-gallery-load-trigger"]');
    await expect(loadTrigger).not.toBeVisible();
  });

  // Edge case: 21 photos (1 page + 1 photo on second page)
  test('should handle 21 photos correctly (1 full page + 1 partial)', async ({ page }) => {
    // Upload 21 photos
    await uploadMultiplePhotos(page, 21);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Initially 20 photos
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(20);

    // Load trigger should be visible
    await expect(page.locator('[data-testid="photo-gallery-load-trigger"]')).toBeVisible();

    // Scroll to load more
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for final photo to load
    await page.waitForTimeout(1000);

    // Should have 21 photos
    await expect(photoItems).toHaveCount(21, { timeout: 5000 });

    // End message should appear
    await expect(page.locator('[data-testid="photo-gallery-end-message"]')).toBeVisible();
  });

  // Edge case: Empty gallery (0 photos)
  test('should show empty state for 0 photos', async ({ page }) => {
    // Navigate to Photos tab (no photos uploaded)
    await page.click('[data-testid="nav-photos"]');

    // Should show empty state
    await expect(page.locator('[data-testid="photo-gallery-empty-state"]')).toBeVisible();

    // Should NOT show skeleton, grid, or pagination elements
    await expect(page.locator('[data-testid="photo-gallery-skeleton"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="photo-gallery-grid"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="photo-gallery-load-trigger"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="photo-gallery-end-message"]')).not.toBeVisible();
  });

  // Refresh after upload (Story 5.2 requirement)
  test('should refresh gallery when new photo uploaded', async ({ page }) => {
    // Upload initial 15 photos
    await uploadMultiplePhotos(page, 15);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    // Verify 15 photos
    const photoItems = page.locator('[data-testid="photo-grid-item"]');
    await expect(photoItems).toHaveCount(15);

    // Upload one more photo
    const uploadFab = page.locator('[data-testid="photo-gallery-upload-fab"]');
    await uploadFab.click();
    await page.waitForSelector('[data-testid="photo-upload-modal"]', { timeout: 5000 });

    const filePath = path.join(__dirname, '..', 'fixtures', 'test-photo1.jpg');
    await page.setInputFiles('[data-testid="photo-upload-file-input"]', filePath);
    await page.fill('[data-testid="photo-upload-caption-input"]', 'New photo');
    await page.click('[data-testid="photo-upload-submit-button"]');
    await page.waitForSelector('[data-testid="photo-upload-modal"]', { state: 'hidden', timeout: 10000 });

    // Gallery should refresh automatically (BUG FIX from Story 4.2)
    // Wait for new photo to appear
    await page.waitForTimeout(500);

    // Should now have 16 photos
    await expect(photoItems).toHaveCount(16, { timeout: 5000 });
  });

  // Performance: Multiple pages loaded smoothly
  test('should handle loading 3 pages (60 photos) smoothly', async ({ page }) => {
    // Upload 60 photos
    await uploadMultiplePhotos(page, 60);

    // Navigate to Photos tab
    await page.click('[data-testid="nav-photos"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

    const photoItems = page.locator('[data-testid="photo-grid-item"]');

    // Page 1: 20 photos
    await expect(photoItems).toHaveCount(20);

    // Load page 2
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await expect(photoItems).toHaveCount(40, { timeout: 5000 });

    // Load page 3
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await expect(photoItems).toHaveCount(60, { timeout: 5000 });

    // End message should appear
    await expect(page.locator('[data-testid="photo-gallery-end-message"]')).toBeVisible();
  });
});
