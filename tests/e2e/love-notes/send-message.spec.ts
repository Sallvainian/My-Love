/**
 * Love Notes Send Message E2E Tests
 *
 * Story TD-1.2 - Love Notes E2E Test Regeneration
 * Coverage: Story 2-2 (Send Message with Optimistic Updates)
 *
 * Risks Mitigated:
 * - R-003: Optimistic update rollback fails (Score: 6)
 * - R-004: Message deduplication fails (Score: 6)
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
  createMockMessage,
} from './love-notes.setup';

test.describe('Send Message', () => {
  test.describe('P0 - Critical Path', () => {
    test('sends text message with optimistic update', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API responses BEFORE navigation
      const existingMessages = createMockMessages(3);
      const testMessage = `Test message ${Date.now()}`;

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
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

      // Act: Navigate and send message
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);

      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill(testMessage);

      // Set up response promise BEFORE clicking send
      const sendPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('love_notes') &&
          resp.request().method() === 'POST' &&
          resp.status() >= 200 &&
          resp.status() < 400
      );

      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Message appears immediately (optimistic update)
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });

      // Assert: API request completes successfully
      const response = await sendPromise;
      expect(response.status()).toBe(201);

      // Assert: Input cleared after send
      await expect(input).toHaveValue('', { timeout: 5000 });
    });

    test('message appears immediately before server confirmation (optimistic)', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with delayed response to observe optimistic update
      const existingMessages = createMockMessages(2);
      const testMessage = `Optimistic test ${Date.now()}`;

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }

        if (method === 'POST') {
          // Delay response to observe optimistic insert
          await new Promise((resolve) => setTimeout(resolve, 2000));
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

      // Act: Navigate and send message
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill(testMessage);

      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Message visible IMMEDIATELY (before server response)
      // This should pass within 500ms if optimistic update works
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 500 });

      // Assert: Sending indicator may be visible during delay
      const sendingIndicator = LOVE_NOTES_SELECTORS.sendingIndicator(page);
      await expect(sendingIndicator).toBeVisible({ timeout: 1000 });

      // Assert: After server confirms, sending indicator disappears
      await expect(sendingIndicator).toBeHidden({ timeout: 5000 });
    });

    test('optimistic update rolls back on server error', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with error response for POST
      const existingMessages = createMockMessages(2);
      const testMessage = `Rollback test ${Date.now()}`;

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }

        if (method === 'POST') {
          // Return error to trigger rollback
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        }

        return route.continue();
      });

      // Act: Navigate and attempt to send message
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill(testMessage);

      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Error indicator should appear
      const errorIndicator = LOVE_NOTES_SELECTORS.errorIndicator(page);
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });

      // Assert: Optimistic message should be removed after error
      // The temporary message with this content should not persist
      await expect(page.getByText(testMessage)).toBeHidden({ timeout: 10000 });
    });

    test('prevents duplicate messages on rapid send', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with tracking for duplicate detection
      const existingMessages = createMockMessages(1);
      const testMessage = `Dedup test ${Date.now()}`;
      const receivedRequests: string[] = [];

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        const method = route.request().method();

        if (method === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }

        if (method === 'POST') {
          const postData = route.request().postDataJSON();
          receivedRequests.push(postData.content);
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: `new-${Date.now()}-${Math.random()}`,
              ...postData,
              created_at: new Date().toISOString(),
            }),
          });
        }

        return route.continue();
      });

      // Act: Navigate and send message rapidly
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill(testMessage);

      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });

      // Click send button multiple times rapidly
      await sendButton.click();
      await sendButton.click();
      await sendButton.click();

      // Wait for all network activity to settle
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Assert: Only ONE message should appear in the UI
      const messageItems = page.getByText(testMessage);
      await expect(messageItems).toHaveCount(1, { timeout: 5000 });
    });
  });

  test.describe('P1 - Important Features', () => {
    test('validates empty message (cannot send)', async ({ page, navigateToLoveNotes }) => {
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

      // Assert: Send button should be disabled when input is empty
      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);

      await expect(input).toBeVisible({ timeout: 10000 });
      await expect(input).toHaveValue('');
      await expect(sendButton).toBeDisabled({ timeout: 5000 });
    });

    test('validates max message length (1000 characters)', async ({
      page,
      navigateToLoveNotes,
    }) => {
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

      // Act: Navigate and try to enter very long message
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });

      // Try to enter 1001 characters
      const longMessage = 'x'.repeat(1001);
      await input.fill(longMessage);

      // Assert: Input should be limited to 1000 characters
      const inputValue = await input.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(1000);
    });

    test('character counter shows progressive warning', async ({ page, navigateToLoveNotes }) => {
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

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      const counter = LOVE_NOTES_SELECTORS.characterCounter(page);

      await expect(input).toBeVisible({ timeout: 10000 });

      // Type 900 characters - should show warning
      await input.fill('x'.repeat(900));
      await expect(counter).toContainText('100', { timeout: 5000 }); // 100 remaining

      // Type 950 characters - should show stronger warning
      await input.fill('x'.repeat(950));
      await expect(counter).toContainText('50', { timeout: 5000 }); // 50 remaining

      // Type 1000 characters - should show max reached
      await input.fill('x'.repeat(1000));
      await expect(counter).toContainText('0', { timeout: 5000 }); // 0 remaining
    });

    test('Enter key sends message, Shift+Enter adds newline', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API BEFORE navigation
      const testMessage = `Enter key test ${Date.now()}`;

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

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });

      // Test Shift+Enter adds newline (doesn't send)
      await input.fill('Line 1');
      await input.press('Shift+Enter');
      await input.type('Line 2');

      const inputValue = await input.inputValue();
      expect(inputValue).toContain('\n');
      expect(inputValue).toBe('Line 1\nLine 2');

      // Clear and test Enter sends message
      await input.fill(testMessage);

      // Set up response promise BEFORE pressing Enter
      const sendPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('love_notes') &&
          resp.request().method() === 'POST' &&
          resp.status() >= 200 &&
          resp.status() < 400
      );

      await input.press('Enter');

      // Assert: Message sent
      const response = await sendPromise;
      expect(response.status()).toBe(201);

      // Assert: Input cleared
      await expect(input).toHaveValue('', { timeout: 5000 });
    });
  });

  test.describe('P2 - Secondary Features', () => {
    test('send button enables when text is entered', async ({ page, navigateToLoveNotes }) => {
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

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);

      await expect(input).toBeVisible({ timeout: 10000 });

      // Assert: Initially disabled
      await expect(sendButton).toBeDisabled({ timeout: 5000 });

      // Type text
      await input.fill('Hello');

      // Assert: Now enabled
      await expect(sendButton).toBeEnabled({ timeout: 5000 });

      // Clear text
      await input.fill('');

      // Assert: Disabled again
      await expect(sendButton).toBeDisabled({ timeout: 5000 });
    });

    test('displays error state on send failure', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API with error on POST
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
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Failed to send message' }),
          });
        }

        return route.continue();
      });

      // Act: Navigate and attempt to send
      await navigateToLoveNotes();

      const input = LOVE_NOTES_SELECTORS.messageInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });
      await input.fill('Error test message');

      const sendButton = LOVE_NOTES_SELECTORS.sendButton(page);
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Assert: Error state displayed
      const errorIndicator = LOVE_NOTES_SELECTORS.errorIndicator(page);
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });
      await expect(errorIndicator).toContainText(/failed|error/i, { timeout: 5000 });
    });
  });
});
