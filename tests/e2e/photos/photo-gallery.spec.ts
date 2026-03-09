/**
 * P0 E2E: Photo Gallery
 *
 * Critical path: Users must be able to view their photo gallery.
 * Covers gallery loading and photo display.
 *
 * Test IDs: 4.3-E2E-001, 4.3-E2E-002, 4.3-E2E-003
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Photo Gallery', () => {
  test('[P0] 4.3-E2E-001 should display photo gallery view', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User is authenticated and navigates to /photos
    const photosCall = interceptNetworkCall({
      url: '**/rest/v1/photos?**',
      fulfillResponse: { status: 200, body: [] },
    });

    await page.goto('/photos');
    await photosCall;

    // WHEN: Gallery loads
    // THEN: Photo gallery empty state is visible (no photos mocked)
    await expect(page.getByTestId('photo-gallery-empty-state')).toBeVisible();
  });

  test('[P0] 4.3-E2E-002 should display upload button', async ({ page, interceptNetworkCall }) => {
    // GIVEN: User is on photo gallery (empty state)
    const photosCall = interceptNetworkCall({
      url: '**/rest/v1/photos?**',
      fulfillResponse: { status: 200, body: [] },
    });

    await page.goto('/photos');
    await photosCall;

    await expect(page.getByTestId('photo-gallery-empty-state')).toBeVisible();

    // THEN: Upload button is visible in empty state
    await expect(page.getByTestId('photo-gallery-empty-upload-button')).toBeVisible();
  });

  test('[P0] 4.3-E2E-003 should open photo viewer when photo clicked', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User is on photo gallery with at least one photo
    const mockPhotos = [
      {
        id: 'test-photo-1',
        user_id: 'test-user',
        storage_path: 'photos/test.jpg',
        thumbnail_path: 'photos/test_thumb.jpg',
        filename: 'test.jpg',
        mime_type: 'image/jpeg',
        width: 800,
        height: 600,
        file_size: 100000,
        caption: 'Test photo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const photosCall = interceptNetworkCall({
      url: '**/rest/v1/photos?**',
      method: 'GET',
      fulfillResponse: {
        status: 200,
        body: mockPhotos,
      },
    });

    // Stub storage URLs so thumbnails resolve
    await page.route('**/storage/v1/object/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from('fake-image'),
      });
    });

    await page.goto('/photos');
    await photosCall;

    await expect(page.getByTestId('photo-gallery')).toBeVisible();

    // WHEN: User clicks a photo
    const photoItem = page.getByTestId('photo-gallery-grid').locator('img').first();
    await photoItem.click();

    // THEN: Photo viewer/carousel opens
    await expect(page.getByTestId('photo-viewer-overlay')).toBeVisible();
  });
});
