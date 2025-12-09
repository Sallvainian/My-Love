/**
 * Love Notes E2E Test Setup and Fixtures
 *
 * Stories: TD-1.0.5 (Subscription Observability), TD-1.2 (Love Notes E2E Regeneration)
 *
 * Provides utilities for testing:
 * - Supabase Realtime subscription behavior
 * - Message sending with optimistic updates
 * - Message history pagination and scroll
 * - Image attachments
 *
 * Quality Gates (TEA Standards):
 * - Network-first interception (route BEFORE navigate)
 * - Accessibility-first selectors (getByRole > getByLabel > getByTestId)
 * - Deterministic waits (no waitForTimeout)
 * - No error swallowing (.catch(() => false))
 *
 * @see docs/04-Testing-QA/e2e-quality-standards.md
 */

import { test as base, expect, type Page } from '@playwright/test';
import type { ConnectionState } from '../../../src/hooks/useSubscriptionHealth';

/**
 * API endpoint patterns for network interception
 */
export const LOVE_NOTES_API_PATTERNS = {
  /** Main love_notes table endpoint */
  loveNotes: '**/rest/v1/love_notes**',
  /** Realtime channel endpoint */
  realtime: '**/realtime/**',
  /** Storage bucket for images */
  storage: '**/storage/v1/**',
  /** Combined matcher for any love notes request */
  any: (url: string) =>
    url.includes('love_notes') || url.includes('realtime') || url.includes('storage'),
};

/**
 * Selector patterns following accessibility-first hierarchy
 *
 * Priority: getByRole > getByLabel > getByTestId > getByText > locator
 */
export const LOVE_NOTES_SELECTORS = {
  // Navigation
  navLoveNotes: (page: Page) => page.getByTestId('nav-love-notes'),

  // Message input area
  messageInput: (page: Page) => page.getByRole('textbox', { name: /message|write|type/i }),
  sendButton: (page: Page) => page.getByRole('button', { name: /send/i }),
  characterCounter: (page: Page) => page.getByTestId('character-counter'),

  // Image attachment
  attachImageButton: (page: Page) => page.getByRole('button', { name: /attach|image|photo/i }),
  imagePreview: (page: Page) => page.getByTestId('image-preview'),
  removeImageButton: (page: Page) => page.getByRole('button', { name: /remove|cancel/i }),
  fileInput: (page: Page) => page.locator('input[type="file"]'),

  // Message list
  messageList: (page: Page) => page.getByTestId('message-list'),
  messageItem: (page: Page) => page.getByTestId('message-item'),
  loadingIndicator: (page: Page) => page.getByTestId('loading-indicator'),
  emptyState: (page: Page) => page.getByText(/no messages|start a conversation/i),

  // Message states
  sendingIndicator: (page: Page) => page.getByText(/sending/i),
  errorIndicator: (page: Page) => page.getByRole('alert'),

  // Timestamps
  timestamp: (page: Page) => page.getByTestId('message-timestamp'),
};

/**
 * Helper to generate mock message data
 */
export function createMockMessage(overrides: Partial<{
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at: string | null;
}> = {}) {
  const timestamp = new Date().toISOString();
  return {
    id: overrides.id ?? `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: overrides.content ?? `Test message at ${timestamp}`,
    sender_id: overrides.sender_id ?? process.env.VITE_TEST_USER_ID ?? 'test-user-id',
    recipient_id: overrides.recipient_id ?? process.env.VITE_TEST_PARTNER_ID ?? 'test-partner-id',
    created_at: overrides.created_at ?? timestamp,
    read_at: overrides.read_at ?? null,
  };
}

/**
 * Helper to generate multiple mock messages for pagination tests
 */
export function createMockMessages(
  count: number,
  baseOptions: Partial<{ sender_id: string; recipient_id: string }> = {}
) {
  const messages = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    messages.push(
      createMockMessage({
        ...baseOptions,
        content: `Test message ${i + 1} of ${count}`,
        created_at: new Date(baseTime - i * 60000).toISOString(), // 1 minute apart
      })
    );
  }

  return messages;
}

/**
 * Extended test with Love Notes fixtures
 */
export const test = base.extend<{
  navigateToLoveNotes: () => Promise<void>;
}>({
  /**
   * Navigate to Love Notes page with network-first pattern
   */
  navigateToLoveNotes: async ({ page }, use) => {
    const navigateToLoveNotes = async () => {
      // Step 1: Set up response listener BEFORE navigation
      const messagesPromise = page.waitForResponse(
        (resp) => resp.url().includes('love_notes') && resp.status() >= 200 && resp.status() < 400
      );

      // Step 2: Navigate to Love Notes section
      const navButton = LOVE_NOTES_SELECTORS.navLoveNotes(page);
      await expect(navButton).toBeVisible({ timeout: 10000 });
      await navButton.click();

      // Step 3: Wait for API response
      await messagesPromise;

      // Step 4: Verify page loaded (deterministic wait)
      await expect(
        LOVE_NOTES_SELECTORS.messageInput(page).or(LOVE_NOTES_SELECTORS.emptyState(page))
      ).toBeVisible({ timeout: 10000 });
    };

    await use(navigateToLoveNotes);
  },
});

export { expect };

/**
 * Subscription health state exposed via window.__subscriptionHealth
 */
interface WindowSubscriptionHealth {
  connectionState: ConnectionState;
  lastHeartbeat: Date | null;
  reconnectionCount: number;
  isHealthy: boolean;
}

/**
 * Extended window type for E2E testing
 */
declare global {
  interface Window {
    __subscriptionHealth?: WindowSubscriptionHealth;
  }
}

/**
 * Mock a subscription drop (disconnection)
 *
 * Triggers the __test_subscription_drop event which the useSubscriptionHealth
 * hook listens for and responds to by transitioning to 'disconnected' state.
 *
 * @param page - Playwright Page object
 *
 * @example
 * ```typescript
 * await mockSubscriptionDrop(page);
 * await expect(page.getByTestId('connection-status')).toHaveText('Disconnected');
 * ```
 */
export async function mockSubscriptionDrop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test_subscription_drop'));
  });
}

/**
 * Mock a subscription reconnection
 *
 * Triggers the __test_subscription_reconnect event which transitions
 * the subscription health state through 'reconnecting' -> 'connected'.
 *
 * @param page - Playwright Page object
 *
 * @example
 * ```typescript
 * await mockSubscriptionDrop(page);
 * await mockSubscriptionReconnect(page);
 * await expect(page.getByTestId('connection-status')).toHaveText('Connected');
 * ```
 */
export async function mockSubscriptionReconnect(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('__test_subscription_reconnect'));
  });
}

/**
 * Wait for a specific subscription state
 *
 * Deterministically waits for the subscription to reach a specific connection state.
 * Uses the window.__subscriptionHealth object exposed by useRealtimeMessages.
 *
 * @param page - Playwright Page object
 * @param state - Target connection state to wait for
 * @param timeout - Maximum wait time in milliseconds (default: 10000)
 *
 * @throws If timeout is reached before state is achieved
 *
 * @example
 * ```typescript
 * await waitForSubscriptionState(page, 'connected');
 * // Now safe to test message sending
 * ```
 */
export async function waitForSubscriptionState(
  page: Page,
  state: ConnectionState,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    (expectedState: ConnectionState) =>
      window.__subscriptionHealth?.connectionState === expectedState,
    state,
    { timeout }
  );
}

/**
 * Get the current subscription health state
 *
 * Returns the current subscription health from window.__subscriptionHealth.
 * Returns null if not available (e.g., subscription not initialized).
 *
 * @param page - Playwright Page object
 * @returns Current subscription health state or null
 *
 * @example
 * ```typescript
 * const health = await getSubscriptionHealth(page);
 * expect(health?.connectionState).toBe('connected');
 * expect(health?.isHealthy).toBe(true);
 * ```
 */
export async function getSubscriptionHealth(
  page: Page
): Promise<WindowSubscriptionHealth | null> {
  return await page.evaluate(() => {
    const health = window.__subscriptionHealth;
    if (!health) return null;

    // Serialize the health object (Date needs special handling)
    return {
      connectionState: health.connectionState,
      lastHeartbeat: health.lastHeartbeat ? health.lastHeartbeat.toISOString() : null,
      reconnectionCount: health.reconnectionCount,
      isHealthy: health.isHealthy,
    };
  }).then((result) => {
    if (!result) return null;
    return {
      ...result,
      lastHeartbeat: result.lastHeartbeat ? new Date(result.lastHeartbeat) : null,
    } as WindowSubscriptionHealth;
  });
}

/**
 * Assert that the subscription is healthy
 *
 * Checks that the subscription is connected and has a recent heartbeat.
 * Throws if the subscription is not healthy.
 *
 * @param page - Playwright Page object
 *
 * @throws If subscription is not healthy
 *
 * @example
 * ```typescript
 * await assertSubscriptionHealthy(page);
 * // Safe to send messages
 * ```
 */
export async function assertSubscriptionHealthy(page: Page): Promise<void> {
  const health = await getSubscriptionHealth(page);
  if (!health) {
    throw new Error('Subscription health not available - hook may not be initialized');
  }
  if (!health.isHealthy) {
    throw new Error(
      `Subscription is not healthy. State: ${health.connectionState}, ` +
        `Reconnections: ${health.reconnectionCount}`
    );
  }
}

/**
 * Wait for subscription to be healthy
 *
 * Waits for the subscription to be in a healthy state (connected with fresh heartbeat).
 *
 * @param page - Playwright Page object
 * @param timeout - Maximum wait time in milliseconds (default: 10000)
 *
 * @example
 * ```typescript
 * await waitForHealthySubscription(page);
 * // Now safe to proceed with realtime tests
 * ```
 */
export async function waitForHealthySubscription(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    () => window.__subscriptionHealth?.isHealthy === true,
    { timeout }
  );
}

/**
 * Get the reconnection count
 *
 * Returns the number of times the subscription has reconnected.
 * Useful for verifying reconnection behavior.
 *
 * @param page - Playwright Page object
 * @returns Number of reconnections
 *
 * @example
 * ```typescript
 * const before = await getReconnectionCount(page);
 * await mockSubscriptionDrop(page);
 * await mockSubscriptionReconnect(page);
 * const after = await getReconnectionCount(page);
 * expect(after).toBe(before + 1);
 * ```
 */
export async function getReconnectionCount(page: Page): Promise<number> {
  return await page.evaluate(
    () => window.__subscriptionHealth?.reconnectionCount ?? 0
  );
}

/**
 * Simulate a network interruption and recovery cycle
 *
 * Mocks a complete subscription drop and reconnection cycle.
 * Waits for each state transition to complete.
 *
 * @param page - Playwright Page object
 *
 * @example
 * ```typescript
 * await simulateNetworkInterruption(page);
 * // Subscription should now be reconnected
 * const health = await getSubscriptionHealth(page);
 * expect(health?.reconnectionCount).toBeGreaterThan(0);
 * ```
 */
export async function simulateNetworkInterruption(
  page: Page
): Promise<void> {
  // Drop the connection
  await mockSubscriptionDrop(page);
  await waitForSubscriptionState(page, 'disconnected');

  // State machine handles transition - no arbitrary delay needed
  await mockSubscriptionReconnect(page);

  // Wait for reconnection to complete (goes through 'reconnecting' -> 'connected')
  await waitForSubscriptionState(page, 'connected');
}

// Re-export ConnectionState type for test convenience
export type { ConnectionState };
