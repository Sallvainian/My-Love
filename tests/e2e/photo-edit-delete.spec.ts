import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Story 4.4: Photo Edit & Delete Functionality - E2E Test Suite
 *
 * Tests cover all acceptance criteria (AC-4.4.1 through AC-4.4.7)
 * Builds on Story 4.3's photo carousel foundation
 */

// Helper: Upload a single test photo via PhotoUpload modal
async function uploadTestPhoto(page: any, photoFileName: string, caption?: string, tags?: string) {
  // Open Photos tab if not already there
  const photosTab = page.locator('[data-testid="nav-photos"]');
  await photosTab.click({ timeout: 5000 });

  // Click "Upload Photo" button (either empty state or FAB)
  const emptyStateButton = page.locator('[data-testid="photo-gallery-empty-upload-button"]');
  const isEmptyState = await emptyStateButton.isVisible().catch(() => false);

  if (isEmptyState) {
    await emptyStateButton.click();
  } else {
    // Click FAB if grid has photos
    await page.click('[data-testid="photo-gallery-upload-fab"]', { timeout: 5000 });
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
  if (tags) {
    await page.fill('[data-testid="photo-upload-tags-input"]', tags);
  }

  // Submit upload
  await page.click('[data-testid="photo-upload-submit-button"]');

  // Wait for upload to complete
  await page.waitForSelector('[data-testid="photo-upload-modal"]', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(300); // Brief pause for IndexedDB write
}

// Helper: Open carousel by clicking a photo in the gallery
async function openCarousel(page: any, photoIndex: number = 0) {
  // Wait for gallery grid to be visible
  await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });

  // Click photo at specified index
  const photo = page.locator(`[data-testid="photo-gallery-item"]`).nth(photoIndex);
  await photo.click();

  // Wait for carousel to open
  await page.waitForSelector('[data-testid="photo-carousel"]', { timeout: 5000 });
}

test.describe('Photo Edit & Delete - Story 4.4', () => {
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

    // Reload to ensure fresh IndexedDB
    await page.reload();

    // Handle welcome splash if present
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
      await page.waitForSelector('button:has-text("Continue")', { state: 'hidden', timeout: 5000 });
    }

    // Wait for app initialization (home view with daily message)
    await page.waitForSelector('[data-testid="daily-message-container"]', { timeout: 10000 });
  });

  test('AC-4.4.1: Edit button opens edit modal with current photo data', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Beach sunset together', 'beach, sunset, memories');

    // Open carousel
    await openCarousel(page, 0);

    // Click Edit button
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Verify PhotoEditModal opens
    const editModal = page.locator('[data-testid="photo-edit-modal"]');
    await expect(editModal).toBeVisible();

    // Verify photo preview is visible
    const photoPreview = page.locator('[data-testid="photo-edit-modal-preview"]');
    await expect(photoPreview).toBeVisible();

    // Verify caption field is pre-populated
    const captionInput = page.locator('[data-testid="photo-edit-modal-caption-input"]');
    await expect(captionInput).toHaveValue('Beach sunset together');

    // Verify tags field is pre-populated
    const tagsInput = page.locator('[data-testid="photo-edit-modal-tags-input"]');
    await expect(tagsInput).toHaveValue('beach, sunset, memories');
  });

  test('AC-4.4.2: Edit modal shows all form fields and controls', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Test caption', 'tag1, tag2');

    // Open carousel and edit modal
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Verify all form elements are visible
    await expect(page.locator('[data-testid="photo-edit-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-caption-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-tags-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-save-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-cancel-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-edit-modal-close-button"]')).toBeVisible();

    // Verify Save button is initially disabled (no changes)
    const saveButton = page.locator('[data-testid="photo-edit-modal-save-button"]');
    await expect(saveButton).toBeDisabled();
  });

  test('AC-4.4.3: Save updates IndexedDB and refreshes carousel', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Original caption', 'original, tags');

    // Open carousel and edit modal
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Edit caption
    const captionInput = page.locator('[data-testid="photo-edit-modal-caption-input"]');
    await captionInput.fill('Updated caption with new text');

    // Edit tags
    const tagsInput = page.locator('[data-testid="photo-edit-modal-tags-input"]');
    await tagsInput.fill('updated, new, tags');

    // Save button should now be enabled
    const saveButton = page.locator('[data-testid="photo-edit-modal-save-button"]');
    await expect(saveButton).toBeEnabled();

    // Click Save
    await saveButton.click();

    // Modal should close
    await page.waitForSelector('[data-testid="photo-edit-modal"]', { state: 'hidden', timeout: 5000 });

    // Verify carousel shows updated caption
    const carouselCaption = page.locator('[data-testid="photo-carousel-caption"]');
    await expect(carouselCaption).toHaveText('Updated caption with new text');

    // Verify tags are updated
    await expect(page.locator('[data-testid="photo-carousel-tag-0"]')).toHaveText('updated');
    await expect(page.locator('[data-testid="photo-carousel-tag-1"]')).toHaveText('new');
    await expect(page.locator('[data-testid="photo-carousel-tag-2"]')).toHaveText('tags');

    // Close carousel and verify grid also shows updated data
    await page.click('[data-testid="photo-carousel-controls-close-button"]');
    await page.waitForSelector('[data-testid="photo-carousel"]', { state: 'hidden' });

    // Reopen carousel to verify persistence
    await openCarousel(page, 0);
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Updated caption with new text');
  });

  test('AC-4.4.3: Cancel button closes modal without saving', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Original caption', 'original');

    // Open carousel and edit modal
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Make changes
    await page.fill('[data-testid="photo-edit-modal-caption-input"]', 'Changed caption');
    await page.fill('[data-testid="photo-edit-modal-tags-input"]', 'changed');

    // Click Cancel
    await page.click('[data-testid="photo-edit-modal-cancel-button"]');

    // Modal should close
    await page.waitForSelector('[data-testid="photo-edit-modal"]', { state: 'hidden' });

    // Verify carousel still shows original caption
    const carouselCaption = page.locator('[data-testid="photo-carousel-caption"]');
    await expect(carouselCaption).toHaveText('Original caption');
  });

  test('AC-4.4.4: Delete button shows confirmation dialog', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Test caption', 'test');

    // Open carousel
    await openCarousel(page, 0);

    // Click Delete button
    await page.click('[data-testid="photo-carousel-delete-button"]');

    // Verify PhotoDeleteConfirmation dialog opens
    const deleteDialog = page.locator('[data-testid="photo-delete-confirmation"]');
    await expect(deleteDialog).toBeVisible();

    // Verify warning message
    await expect(deleteDialog.locator('text=Delete this photo?')).toBeVisible();
    await expect(deleteDialog.locator('text=This action cannot be undone.')).toBeVisible();

    // Verify Cancel and Delete buttons
    await expect(page.locator('[data-testid="photo-delete-confirmation-cancel-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-delete-confirmation-delete-button"]')).toBeVisible();
  });

  test('AC-4.4.5: Cancel delete closes dialog without action', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Test caption', 'test');

    // Open carousel and delete dialog
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-delete-button"]');

    // Click Cancel
    await page.click('[data-testid="photo-delete-confirmation-cancel-button"]');

    // Dialog should close
    await page.waitForSelector('[data-testid="photo-delete-confirmation"]', { state: 'hidden' });

    // Carousel should still be open with photo visible
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-carousel-image"]')).toBeVisible();

    // Close carousel and verify photo still exists in grid
    await page.click('[data-testid="photo-carousel-controls-close-button"]');
    await page.waitForSelector('[data-testid="photo-gallery-grid"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="photo-gallery-item"]').first()).toBeVisible();
  });

  test('AC-4.4.5, AC-4.4.6: Confirm delete removes photo from IndexedDB and grid', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Test caption', 'test');

    // Verify photo appears in grid
    await expect(page.locator('[data-testid="photo-gallery-item"]').first()).toBeVisible();

    // Open carousel and delete dialog
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-delete-button"]');

    // Click Delete (red button)
    await page.click('[data-testid="photo-delete-confirmation-delete-button"]');

    // Dialog should close
    await page.waitForSelector('[data-testid="photo-delete-confirmation"]', { state: 'hidden', timeout: 5000 });

    // Carousel should close (since it was the only photo)
    await page.waitForSelector('[data-testid="photo-carousel"]', { state: 'hidden', timeout: 5000 });

    // Verify empty state is shown
    await expect(page.locator('[data-testid="photo-gallery-empty-state"]')).toBeVisible({ timeout: 5000 });
  });

  test('AC-4.4.7: Carousel navigates to next photo after delete', async ({ page }) => {
    // Upload 3 test photos
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 1', 'first');
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 2', 'second');
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 3', 'third');

    // Open carousel on middle photo (Photo 2)
    await openCarousel(page, 1);

    // Verify we're viewing Photo 2
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 2');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('2 / 3');

    // Delete Photo 2
    await page.click('[data-testid="photo-carousel-delete-button"]');
    await page.click('[data-testid="photo-delete-confirmation-delete-button"]');

    // Dialog should close
    await page.waitForSelector('[data-testid="photo-delete-confirmation"]', { state: 'hidden', timeout: 5000 });

    // Carousel should navigate to Photo 3 (which is now at index 1 after Photo 2 is deleted)
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('2 / 2');
  });

  test('AC-4.4.7: Carousel navigates to previous photo when deleting last photo', async ({ page }) => {
    // Upload 3 test photos
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 1', 'first');
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 2', 'second');
    await uploadTestPhoto(page, 'test-photo.jpg', 'Photo 3', 'third');

    // Open carousel on last photo (Photo 3)
    await openCarousel(page, 2);

    // Verify we're viewing Photo 3
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 3');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('3 / 3');

    // Delete Photo 3
    await page.click('[data-testid="photo-carousel-delete-button"]');
    await page.click('[data-testid="photo-delete-confirmation-delete-button"]');

    // Carousel should navigate to Photo 2 (previous photo)
    await expect(page.locator('[data-testid="photo-carousel"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-carousel-caption"]')).toHaveText('Photo 2');
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('2 / 2');
  });

  test('AC-4.4.7: Carousel closes when last photo is deleted', async ({ page }) => {
    // Upload a single photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Only photo', 'test');

    // Open carousel
    await openCarousel(page, 0);

    // Verify counter shows 1 / 1
    await expect(page.locator('[data-testid="photo-carousel-counter"]')).toHaveText('1 / 1');

    // Delete the only photo
    await page.click('[data-testid="photo-carousel-delete-button"]');
    await page.click('[data-testid="photo-delete-confirmation-delete-button"]');

    // Carousel should close
    await page.waitForSelector('[data-testid="photo-carousel"]', { state: 'hidden', timeout: 5000 });

    // Gallery should show empty state
    await expect(page.locator('[data-testid="photo-gallery-empty-state"]')).toBeVisible();
  });

  test('Form validation: Caption length limit (500 chars)', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Short caption', 'test');

    // Open carousel and edit modal
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Try to enter more than 500 characters
    const longCaption = 'a'.repeat(501);
    await page.fill('[data-testid="photo-edit-modal-caption-input"]', longCaption);

    // Verify error message appears
    await expect(page.locator('text=/Caption is too long/')).toBeVisible();

    // Save button should be disabled
    const saveButton = page.locator('[data-testid="photo-edit-modal-save-button"]');
    await expect(saveButton).toBeDisabled();
  });

  test('Form validation: Tags limit (max 10 tags)', async ({ page }) => {
    // Upload a test photo
    await uploadTestPhoto(page, 'test-photo.jpg', 'Test caption', 'test');

    // Open carousel and edit modal
    await openCarousel(page, 0);
    await page.click('[data-testid="photo-carousel-edit-button"]');

    // Try to enter more than 10 tags
    const tooManyTags = Array.from({ length: 11 }, (_, i) => `tag${i + 1}`).join(', ');
    await page.fill('[data-testid="photo-edit-modal-tags-input"]', tooManyTags);

    // Wait for validation
    await page.waitForTimeout(500);

    // Verify error message appears
    await expect(page.locator('text=/Too many tags/')).toBeVisible();

    // Save button should be disabled
    const saveButton = page.locator('[data-testid="photo-edit-modal-save-button"]');
    await expect(saveButton).toBeDisabled();
  });
});
