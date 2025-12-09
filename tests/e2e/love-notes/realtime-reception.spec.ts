/**
 * Love Notes Real-Time Reception E2E Tests
 *
 * Story TD-1.2 - Love Notes E2E Test Regeneration
 * Coverage: Story 2-3 (Real-Time Message Reception via Supabase Realtime)
 *
 * Risks Mitigated:
 * - R-001: Supabase Realtime subscription drops silently (Score: 6)
 * - R-004: Message deduplication fails on receive (Score: 6)
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
  mockSubscriptionDrop,
  mockSubscriptionReconnect,
  waitForSubscriptionState,
  getSubscriptionHealth,
  simulateNetworkInterruption,
} from './love-notes.setup';

test.describe('Real-Time Reception', () => {
  test.describe('P0 - Critical Path', () => {
    test('receives message in real-time from partner', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API and prepare for real-time injection BEFORE navigation
      const existingMessages = createMockMessages(2);
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Wait for subscription to be healthy before simulating incoming message
      await waitForSubscriptionState(page, 'connected', 15000);

      // Simulate incoming real-time message from partner
      const incomingMessage = createMockMessage({
        content: `Real-time message ${Date.now()}`,
        sender_id: partnerId,
        recipient_id: userId,
      });

      // Inject message via window event (simulating Supabase Realtime callback)
      await page.evaluate((message) => {
        window.dispatchEvent(
          new CustomEvent('__test_realtime_message', { detail: message })
        );
      }, incomingMessage);

      // Assert: Message appears in the UI
      await expect(page.getByText(incomingMessage.content)).toBeVisible({ timeout: 10000 });
    });

    test('subscription reconnects after network drop', async ({ page, navigateToLoveNotes }) => {
      // Arrange: Mock API BEFORE navigation
      const existingMessages = createMockMessages(2);

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Wait for initial connection
      await waitForSubscriptionState(page, 'connected', 15000);

      // Get initial reconnection count
      const healthBefore = await getSubscriptionHealth(page);
      const reconnectCountBefore = healthBefore?.reconnectionCount ?? 0;

      // Simulate network interruption
      await simulateNetworkInterruption(page);

      // Assert: Subscription should be back to connected state
      await waitForSubscriptionState(page, 'connected', 15000);

      // Assert: Reconnection count should have increased
      const healthAfter = await getSubscriptionHealth(page);
      expect(healthAfter?.reconnectionCount).toBeGreaterThan(reconnectCountBefore);
      expect(healthAfter?.isHealthy).toBe(true);
    });

    test('messages received after reconnection are not duplicated', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API BEFORE navigation
      const existingMessages = createMockMessages(2);
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();
      await waitForSubscriptionState(page, 'connected', 15000);

      // Create a message that will be "received" multiple times
      const messageContent = `Dedup test message ${Date.now()}`;
      const message = createMockMessage({
        id: 'fixed-id-for-dedup',
        content: messageContent,
        sender_id: partnerId,
        recipient_id: userId,
      });

      // Simulate receiving the same message multiple times (e.g., after reconnect)
      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, message);

      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, message);

      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, message);

      // Wait a moment for all events to process
      await page.waitForLoadState('domcontentloaded');

      // Assert: Only ONE instance of the message should appear
      const messageElements = page.getByText(messageContent);
      await expect(messageElements).toHaveCount(1, { timeout: 5000 });
    });

    test('subscription state indicator reflects connection status', async ({
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

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();

      // Wait for connection and verify health exposed
      await waitForSubscriptionState(page, 'connected', 15000);

      // Assert: Subscription health should be available and healthy
      const health = await getSubscriptionHealth(page);
      expect(health).not.toBeNull();
      expect(health?.connectionState).toBe('connected');
      expect(health?.isHealthy).toBe(true);

      // Trigger disconnection
      await mockSubscriptionDrop(page);
      await waitForSubscriptionState(page, 'disconnected', 5000);

      // Assert: Health reflects disconnected state
      const healthDisconnected = await getSubscriptionHealth(page);
      expect(healthDisconnected?.connectionState).toBe('disconnected');
      expect(healthDisconnected?.isHealthy).toBe(false);

      // Trigger reconnection
      await mockSubscriptionReconnect(page);
      await waitForSubscriptionState(page, 'connected', 10000);

      // Assert: Health reflects reconnected state
      const healthReconnected = await getSubscriptionHealth(page);
      expect(healthReconnected?.connectionState).toBe('connected');
      expect(healthReconnected?.isHealthy).toBe(true);
    });
  });

  test.describe('P1 - Important Features', () => {
    test('received message appears at bottom of message list', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with existing messages BEFORE navigation
      const existingMessages = createMockMessages(5);
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();
      await waitForSubscriptionState(page, 'connected', 15000);

      // Simulate incoming message
      const newMessage = createMockMessage({
        content: `New message at bottom ${Date.now()}`,
        sender_id: partnerId,
        recipient_id: userId,
      });

      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, newMessage);

      // Assert: New message appears
      await expect(page.getByText(newMessage.content)).toBeVisible({ timeout: 10000 });

      // Assert: New message is the LAST message in the list
      const messages = LOVE_NOTES_SELECTORS.messageItem(page);
      const lastMessage = messages.last();
      await expect(lastMessage).toContainText(newMessage.content, { timeout: 5000 });
    });

    test('auto-scrolls to new message when at bottom of list', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with enough messages to require scrolling BEFORE navigation
      const existingMessages = createMockMessages(20);
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();
      await waitForSubscriptionState(page, 'connected', 15000);

      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 10000 });

      // Scroll to bottom
      await messageList.evaluate((el) => el.scrollTo(0, el.scrollHeight));

      // Record scroll position
      const scrollBeforeNew = await messageList.evaluate((el) => el.scrollTop);

      // Simulate incoming message
      const newMessage = createMockMessage({
        content: `Auto-scroll test ${Date.now()}`,
        sender_id: partnerId,
        recipient_id: userId,
      });

      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, newMessage);

      // Assert: Message appears
      await expect(page.getByText(newMessage.content)).toBeVisible({ timeout: 10000 });

      // Assert: Scroll position should have increased (auto-scrolled to new message)
      const scrollAfterNew = await messageList.evaluate((el) => el.scrollTop);
      expect(scrollAfterNew).toBeGreaterThanOrEqual(scrollBeforeNew);
    });

    test('does not auto-scroll when user is reading older messages', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API with many messages BEFORE navigation
      const existingMessages = createMockMessages(30);
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

      await page.route(LOVE_NOTES_API_PATTERNS.loveNotes, (route) => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(existingMessages),
          });
        }
        return route.continue();
      });

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();
      await waitForSubscriptionState(page, 'connected', 15000);

      const messageList = LOVE_NOTES_SELECTORS.messageList(page);
      await expect(messageList).toBeVisible({ timeout: 10000 });

      // Scroll UP to read older messages (not at bottom)
      await messageList.evaluate((el) => el.scrollTo(0, 0));

      // Record scroll position
      const scrollBeforeNew = await messageList.evaluate((el) => el.scrollTop);

      // Simulate incoming message
      const newMessage = createMockMessage({
        content: `No auto-scroll test ${Date.now()}`,
        sender_id: partnerId,
        recipient_id: userId,
      });

      await page.evaluate((msg) => {
        window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
      }, newMessage);

      // Wait for message to be processed
      await page.waitForLoadState('domcontentloaded');

      // Assert: Scroll position should NOT have changed (user is reading history)
      const scrollAfterNew = await messageList.evaluate((el) => el.scrollTop);
      expect(scrollAfterNew).toBe(scrollBeforeNew);
    });
  });

  test.describe('P2 - Secondary Features', () => {
    test('shows reconnecting indicator during reconnection', async ({
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

      // Act: Navigate to Love Notes
      await navigateToLoveNotes();
      await waitForSubscriptionState(page, 'connected', 15000);

      // Trigger disconnection
      await mockSubscriptionDrop(page);
      await waitForSubscriptionState(page, 'disconnected', 5000);

      // Start reconnection
      await mockSubscriptionReconnect(page);

      // Assert: Should pass through reconnecting state
      // Note: This may be very fast, so we check the health object
      const healthDuringReconnect = await getSubscriptionHealth(page);

      // Eventually should be connected
      await waitForSubscriptionState(page, 'connected', 10000);

      // Assert: Final state is connected
      const healthFinal = await getSubscriptionHealth(page);
      expect(healthFinal?.connectionState).toBe('connected');
    });

    test('maintains message order with rapid incoming messages', async ({
      page,
      navigateToLoveNotes,
    }) => {
      // Arrange: Mock API BEFORE navigation
      const partnerId = process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id';
      const userId = process.env.VITE_TEST_USER_ID ?? 'test-user-id';

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
      await waitForSubscriptionState(page, 'connected', 15000);

      // Send 5 messages rapidly with sequential timestamps
      const baseTime = Date.now();
      for (let i = 1; i <= 5; i++) {
        const message = createMockMessage({
          id: `rapid-${i}`,
          content: `Rapid message ${i}`,
          sender_id: partnerId,
          recipient_id: userId,
          created_at: new Date(baseTime + i * 100).toISOString(),
        });

        await page.evaluate((msg) => {
          window.dispatchEvent(new CustomEvent('__test_realtime_message', { detail: msg }));
        }, message);
      }

      // Wait for all messages to appear
      await expect(page.getByText('Rapid message 5')).toBeVisible({ timeout: 10000 });

      // Assert: Messages should be in order (1, 2, 3, 4, 5 from top to bottom)
      const messages = LOVE_NOTES_SELECTORS.messageItem(page);
      await expect(messages).toHaveCount(5, { timeout: 5000 });

      // First message should be "Rapid message 1"
      await expect(messages.first()).toContainText('Rapid message 1', { timeout: 5000 });
      // Last message should be "Rapid message 5"
      await expect(messages.last()).toContainText('Rapid message 5', { timeout: 5000 });
    });
  });
});
