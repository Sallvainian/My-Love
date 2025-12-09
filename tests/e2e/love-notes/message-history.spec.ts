/**
 * Love Notes Message History E2E Tests
 *
 * Story TD-1.2 - Love Notes E2E Test Regeneration
 * Coverage: Story 2-4 (Message History Pagination & Scroll Performance)
 *
 * Risks Mitigated:
 * - R-002: Scroll position jumps during pagination (Score: 6)
 * - R-006: Message history pagination loading jank (Score: 4)
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

test.describe('Message History', () => {
  test.describe('P0 - Critical Path', () => {
    test('displays messages in chronological order with most recent at bottom', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with ordered messages BEFORE navigation
      const mockMessages = createMockMessages(5);
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Assert: Messages visible in correct order
      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 10000 });

      const messages = LOVE_NOTES_SELECTORS.messageItem(page);
      await expect(messages).toHaveCount(5, { timeout: 10000 });

      // First message in DOM should be oldest (message 5)
      await expect(messages.first()).toContainText('Test message 5 of 5');
      // Last message in DOM should be newest (message 1)
      await expect(messages.last()).toContainText('Test message 1 of 5');
    });

    test('scroll position preserved when loading older messages', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock paginated API response BEFORE navigation
      const page1Messages = createMockMessages(20); // Initial load
      const page2Messages = createMockMessages(20).map((m, i) => ({
        ...m,
        content: `Older message ${i + 1} of 20`,
        created_at: new Date(Date.now() - (i + 21) * 60000).toISOString(),
      }));

      let requestCount = 0;
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          requestCount++;
          const messages = requestCount === 1 ? page1Messages : page2Messages;
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(messages),
          });
        }
        return route.continue();
      });

      // Act: Navigate and get initial scroll position
      await navigateToLoveNotes();

      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 10000 });

      // Record scroll position before triggering pagination
      const initialScrollTop = await messageList.evaluate((el) => el.scrollTop);

      // Scroll to top to trigger pagination
      await messageList.evaluate((el) => el.scrollTo(0, 0));

      // Wait for pagination request
      await page.waitForResponse(
        (resp) => resp.url().includes('love_notes') && resp.status() === 200
      );

      // Assert: Scroll position should be adjusted to maintain view of current messages
      // The scroll position should NOT be 0 after loading older messages
      const finalScrollTop = await messageList.evaluate((el) => el.scrollTop);

      // Scroll position should be greater than 0 (compensated for new content)
      expect(finalScrollTop).toBeGreaterThan(0);
    });

    test('virtualized list maintains reasonable DOM node count with many messages', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with large message set BEFORE navigation
      const mockMessages = createMockMessages(100);
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 10000 });

      // Assert: DOM should not render all 100 messages at once (virtualization)
      // With virtualization, expect ~10-30 DOM nodes, not 100
      const renderedMessageCount = await LOVE_NOTES_SELECTORS.messageItem(page).count();

      // Virtualized list should render significantly fewer nodes than total messages
      // Allow some buffer but expect < 50 for 100 messages
      expect(renderedMessageCount).toBeLessThan(50);
    });
  });

  test.describe('P1 - Important Features', () => {
    test('displays partner messages on left, user messages on right', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock messages from both sender and partner BEFORE navigation
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';

      const mockMessages = [
        { id: '1', content: 'From partner', sender_id: partnerId, recipient_id: userId, created_at: new Date(Date.now() - 2000).toISOString(), read_at: null },
        { id: '2', content: 'From user', sender_id: userId, recipient_id: partnerId, created_at: new Date(Date.now() - 1000).toISOString(), read_at: null },
      ];

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Assert: Check message alignment via data attributes or CSS
      const partnerMessage = page.getByText('From partner');
      const userMessage = page.getByText('From user');

      await expect(partnerMessage).toBeVisible({ timeout: 10000 });
      await expect(userMessage).toBeVisible({ timeout: 10000 });

      // Partner messages should have left alignment indicator
      await expect(partnerMessage.locator('..').or(partnerMessage)).toHaveAttribute(
        'data-alignment',
        'left',
        { timeout: 5000 }
      );

      // User messages should have right alignment indicator
      await expect(userMessage.locator('..').or(userMessage)).toHaveAttribute(
        'data-alignment',
        'right',
        { timeout: 5000 }
      );
    });

    test('displays timestamps in friendly format', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock messages with specific timestamps BEFORE navigation
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const mockMessages = [
        { id: '1', content: 'Message from today', sender_id: 'user', recipient_id: 'partner', created_at: now.toISOString(), read_at: null },
        { id: '2', content: 'Message from yesterday', sender_id: 'user', recipient_id: 'partner', created_at: yesterday.toISOString(), read_at: null },
        { id: '3', content: 'Message from last week', sender_id: 'user', recipient_id: 'partner', created_at: lastWeek.toISOString(), read_at: null },
      ];

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Assert: Timestamps should be in friendly format
      const timestamps = LOVE_NOTES_SELECTORS.timestamp(page);
      await expect(timestamps).toHaveCount(3, { timeout: 10000 });

      // Today's message should show time (e.g., "2:30 PM")
      await expect(timestamps.nth(2)).toContainText(/\d{1,2}:\d{2}/, { timeout: 5000 });

      // Yesterday's message should show "Yesterday"
      await expect(timestamps.nth(1)).toContainText(/yesterday/i, { timeout: 5000 });

      // Older message should show date (e.g., "Dec 1")
      await expect(timestamps.first()).toContainText(/[A-Z][a-z]{2} \d{1,2}|\//, { timeout: 5000 });
    });

    test('displays empty state when no messages exist', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock empty API response BEFORE navigation
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

      // Assert: Empty state should be visible
      const emptyState = LOVE_NOTES_SELECTORS.emptyState(page);
      await expect(emptyState).toBeVisible({ timeout: 10000 });
    });

    test('displays loading indicator during initial fetch', async ({ page }) => {
      // Arrange: Set up delayed API response BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, async (route) => {
        if (route.request().method() === 'GET') {
          // Delay response to observe loading state
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockMessages(5)),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes (don't wait for fixture completion)
      const navButton = LOVE_NOTES_SELECTORS.navLoveNotes(page);
      await expect(navButton).toBeVisible({ timeout: 10000 });
      await navButton.click();

      // Assert: Loading indicator should be visible during fetch
      const loadingIndicator = LOVE_NOTES_SELECTORS.loadingIndicator(page);
      await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

      // Wait for messages to load
      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 15000 });

      // Loading indicator should disappear
      await expect(loadingIndicator).toBeHidden({ timeout: 5000 });
    });
  });

  test.describe('P2 - Secondary Features', () => {
    test('handles API error gracefully', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API error BEFORE navigation
      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        }
        return route.continue();
      });

      // Act: Attempt navigation (will fail gracefully)
      const navButton = LOVE_NOTES_SELECTORS.navLoveNotes(page);
      await expect(navButton).toBeVisible({ timeout: 10000 });
      await navButton.click();

      // Assert: Error state should be displayed
      const errorIndicator = LOVE_NOTES_SELECTORS.errorIndicator(page);
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });
    });
  });
});
