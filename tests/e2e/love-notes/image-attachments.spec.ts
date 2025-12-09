/**
 * Love Notes Image Attachments E2E Tests
 *
 * Story TD-1.2 - Love Notes E2E Test Regeneration
 * Coverage: Image upload, preview, and display functionality
 *
 * Risks Mitigated:
 * - R-008: Image attachment upload fails silently (Score: 4)
 *
 * Quality Gates (TEA Standards):
 * - Network-first interception (route BEFORE navigate)
 * - Accessibility-first selectors
 * - Deterministic waits (no waitForTimeout)
 * - No error swallowing
 * - Guaranteed assertions (no conditional flow)
 *
 * @see docs/05-Epics-Stories/test-design-epic-2-love-notes.md
 */

import { test, expect } from './love-notes.setup';
import {
  LOVE_NOTES_SELECTORS,
  LOVE_NOTES_API_PATTERNS,
  createMockMessages,
} from './love-notes.setup';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test image path - using a test fixture image
const TEST_IMAGE_PATH = join(__dirname, '../../fixtures/test-image.jpg');
const TEST_PNG_PATH = join(__dirname, '../../fixtures/test-image.png');
const TEST_INVALID_FILE = join(__dirname, '../../fixtures/test-document.pdf');

test.describe('Image Attachments', () => {
  test.describe('P1 - Important Features', () => {
    test('image attachment button is visible', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Assert: Attach image button should be visible
      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });
    });

    test('shows image preview on file selection', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Click attach button and select file
      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      // Set up file chooser before clicking
      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;

      // Select a test image file
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Assert: Image preview should appear
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });
    });

    test('rejects invalid file types (non-image)', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Try to select an invalid file type
      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;

      // Attempt to select a PDF (should be rejected)
      await fileChooser.setFiles(TEST_INVALID_FILE);

      // Assert: Error should be displayed, no preview shown
      const errorIndicator = LOVE_NOTES_SELECTORS.errorIndicator(page);
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });
      await expect(errorIndicator).toContainText(/invalid|not supported|image only/i, {
        timeout: 5000,
      });

      // Assert: Preview should NOT appear
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeHidden({ timeout: 5000 });
    });

    test('accepts JPEG images', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate and select JPEG
      await navigateToLoveNotes();

      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Assert: Preview visible (JPEG accepted)
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });
    });

    test('accepts PNG images', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate and select PNG
      await navigateToLoveNotes();

      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_PNG_PATH);

      // Assert: Preview visible (PNG accepted)
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('P2 - Secondary Features', () => {
    test('can remove image before sending', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Act: Navigate and attach image
      await navigateToLoveNotes();

      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Verify preview is visible
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });

      // Click remove button
      const removeButton = LOVE_NOTES_SELECTORS.removeImageButton(page);
      await expect(removeButton).toBeVisible({ timeout: 5000 });
      await removeButton.click();

      // Assert: Preview should be hidden
      await expect(imagePreview).toBeHidden({ timeout: 5000 });
    });

    test('sends image with text message', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with storage upload BEFORE navigation
      const testMessage = `Image with text ${Date.now()}`;

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }

        if (method === 'POST') {
          const postData = route.request().postDataJSON();
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: `new-${Date.now()}`,
              ...postData,
              created_at: new Date().toISOString(),
            }),
          });
        }

        return route.continue();
      });

      // Mock storage upload
      await page.route(LOVE_NOTES_API_PATTERNS.storage, (route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            Key: `love-notes/test-image-${Date.now()}.jpg`,
            data: { path: 'love-notes/test-image.jpg' },
          }),
        });
      });

      // Act: Navigate and compose message with image
      await navigateToLoveNotes();

      // Attach image
      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Verify preview
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });

      // Add text
      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill(testMessage);

      // Send
      const sendPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('love_notes') &&
          resp.request().method() === 'POST' &&
          resp.status() >= 200 &&
          resp.status() < 400
      );

      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Message sent successfully
      const response = await sendPromise;
      expect(response.status()).toBe(201);

      // Assert: Input cleared, preview hidden
      await expect(input).toHaveValue('', { timeout: 5000 });
      await expect(imagePreview).toBeHidden({ timeout: 5000 });

      // Assert: Message appears in list
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
    });

    test('sends image without text message', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with storage upload BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }

        if (method === 'POST') {
          const postData = route.request().postDataJSON();
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: `new-${Date.now()}`,
              ...postData,
              image_url: 'https://example.com/test-image.jpg',
              created_at: new Date().toISOString(),
            }),
          });
        }

        return route.continue();
      });

      // Mock storage upload
      await page.route(LOVE_NOTES_API_PATTERNS.storage, (route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            Key: `love-notes/test-image-${Date.now()}.jpg`,
            data: { path: 'love-notes/test-image.jpg' },
          }),
        });
      });

      // Act: Navigate and attach image only (no text)
      await navigateToLoveNotes();

      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Verify preview
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });

      // DO NOT enter text - send image only
      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 5000 });
      await expect(input).toHaveValue('');

      // Send button should be enabled (image attached)
      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });

      // Set up response promise BEFORE clicking
      const sendPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('love_notes') &&
          resp.request().method() === 'POST' &&
          resp.status() >= 200 &&
          resp.status() < 400
      );

      await sendButton.click();

      // Assert: Message sent successfully
      const response = await sendPromise;
      expect(response.status()).toBe(201);

      // Assert: Preview hidden after send
      await expect(imagePreview).toBeHidden({ timeout: 5000 });
    });

    test('displays error on image upload failure', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with storage failure BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
        return route.continue();
      });

      // Mock storage upload failure
      await page.route(LOVE_NOTES_API_PATTERNS.storage, (route) => {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Upload failed' }),
        });
      });

      // Act: Navigate and try to send image
      await navigateToLoveNotes();

      const attachButton = LOVE_NOTES_SELECTORS.attachImageButton(page);
      await expect(attachButton).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(TEST_IMAGE_PATH);

      // Verify preview
      const imagePreview = LOVE_NOTES_SELECTORS.imagePreview(page);
      await expect(imagePreview).toBeVisible({ timeout: 10000 });

      // Try to send
      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Error indicator should appear
      const errorIndicator = LOVE_NOTES_SELECTORS.errorIndicator(page);
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });
      await expect(errorIndicator).toContainText(/failed|error|upload/i, { timeout: 5000 });
    });
  });
});
