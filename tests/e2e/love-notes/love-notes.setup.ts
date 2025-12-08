/**
 * Love Notes E2E Test Setup and Fixtures
 *
 * Story TD-1.0.5 - Subscription Observability Infrastructure
 * Provides utilities for testing Supabase Realtime subscription behavior.
 *
 * AC4 Implementation: Test fixtures support mocking subscription states.
 */

import { Page } from '@playwright/test';
import type { ConnectionState } from '../../../src/hooks/useSubscriptionHealth';

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
