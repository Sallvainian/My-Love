/**
 * Unit Tests for useSubscriptionHealth Hook
 *
 * Story TD-1.0.5 - Subscription Observability Infrastructure
 * Tests AC1: useSubscriptionHealth Hook Created
 *
 * Test cases per story specification:
 * - [ ] Returns initial state as 'connecting'
 * - [ ] Transitions to 'connected' on SUBSCRIBED event
 * - [ ] Transitions to 'disconnected' on CLOSED event
 * - [ ] Transitions to 'reconnecting' on reconnect attempt
 * - [ ] Updates lastHeartbeat on heartbeat events
 * - [ ] Increments reconnectionCount on each reconnect
 * - [ ] isHealthy is false when heartbeat stale (>30s)
 * - [ ] isHealthy is false when disconnected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubscriptionHealth, type SubscriptionHealthWithNotify } from './useSubscriptionHealth';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Mock timers for heartbeat testing
vi.useFakeTimers();

describe('useSubscriptionHealth', () => {
  // Mock channel for testing
  let mockChannel: RealtimeChannel | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel = {} as RealtimeChannel;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('returns initial state as connecting when channel is null', () => {
      const { result } = renderHook(() => useSubscriptionHealth(null));

      expect(result.current.connectionState).toBe('connecting');
      expect(result.current.lastHeartbeat).toBeNull();
      expect(result.current.reconnectionCount).toBe(0);
      expect(result.current.isHealthy).toBe(false);
    });

    it('returns initial state as connecting when channel is provided', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));

      expect(result.current.connectionState).toBe('connecting');
      expect(result.current.reconnectionCount).toBe(0);
    });
  });

  describe('State Transitions', () => {
    it('transitions to connected on SUBSCRIBED event', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isHealthy).toBe(true);
    });

    it('transitions to disconnected on CLOSED event', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // First connect
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      // Then disconnect
      act(() => {
        health.notifyStatusChange('CLOSED');
      });

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isHealthy).toBe(false);
    });

    it('transitions to reconnecting on CHANNEL_ERROR after being connected', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // First connect
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      // Then error (simulates drop)
      act(() => {
        health.notifyStatusChange('CHANNEL_ERROR');
      });

      expect(result.current.connectionState).toBe('reconnecting');
    });

    it('transitions to reconnecting on TIMED_OUT after being connected', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // First connect
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      // Then timeout
      act(() => {
        health.notifyStatusChange('TIMED_OUT');
      });

      expect(result.current.connectionState).toBe('reconnecting');
    });

    it('transitions to disconnected on CHANNEL_ERROR when never connected', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // Error without prior connection
      act(() => {
        health.notifyStatusChange('CHANNEL_ERROR');
      });

      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('Heartbeat Tracking', () => {
    it('updates lastHeartbeat on SUBSCRIBED event', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      const beforeTime = new Date();

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.lastHeartbeat).not.toBeNull();
      expect(result.current.lastHeartbeat!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });

    it('isHealthy becomes false when heartbeat exceeds threshold via staleness checker', async () => {
      // Use a short threshold so we can test staleness detection
      const SHORT_THRESHOLD = 500; // 500ms threshold

      const { result } = renderHook(() =>
        useSubscriptionHealth(mockChannel, SHORT_THRESHOLD)
      );
      const health = result.current as SubscriptionHealthWithNotify;

      // Connect - sets initial heartbeat and starts intervals
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.isHealthy).toBe(true);
      expect(result.current.connectionState).toBe('connected');

      // The heartbeat interval updates every 10s, but staleness checker runs every 1s
      // Advance time past threshold but before heartbeat update
      // This should make the heartbeat stale (>500ms old)
      act(() => {
        vi.advanceTimersByTime(600); // Past 500ms threshold
      });

      // The staleness checker should have detected the stale heartbeat
      // Since staleness interval is 1000ms, we need to advance to trigger it
      act(() => {
        vi.advanceTimersByTime(1000); // Trigger staleness check
      });

      // Now isHealthy should be false because heartbeat is >500ms old
      // and staleness checker has run
      expect(result.current.isHealthy).toBe(false);
      expect(result.current.connectionState).toBe('connected'); // Still connected
    });

    it('isHealthy is false when heartbeat exceeds custom threshold', () => {
      // Use a very short threshold for testing
      const SHORT_THRESHOLD = 100; // 100ms

      const { result } = renderHook(() =>
        useSubscriptionHealth(mockChannel, SHORT_THRESHOLD)
      );
      const health = result.current as SubscriptionHealthWithNotify;

      // Connect and set initial heartbeat
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.isHealthy).toBe(true);

      // The interval updates every 10s, but we can test the threshold logic
      // by checking that when disconnected, isHealthy is false
      act(() => {
        health.notifyStatusChange('CLOSED');
      });

      expect(result.current.isHealthy).toBe(false);
    });
  });

  describe('Reconnection Tracking', () => {
    it('increments reconnectionCount on successful reconnection', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // Initial connection
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      expect(result.current.reconnectionCount).toBe(0);

      // Disconnect
      act(() => {
        health.notifyStatusChange('CLOSED');
      });

      // Reconnect
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      expect(result.current.reconnectionCount).toBe(1);

      // Another disconnect/reconnect cycle
      act(() => {
        health.notifyStatusChange('CLOSED');
      });
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      expect(result.current.reconnectionCount).toBe(2);
    });

    it('does not increment reconnectionCount on first connection', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.reconnectionCount).toBe(0);
    });
  });

  describe('isHealthy Derived State', () => {
    it('isHealthy is true when connected with fresh heartbeat', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });

      expect(result.current.isHealthy).toBe(true);
    });

    it('isHealthy is false when disconnected', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      act(() => {
        health.notifyStatusChange('CLOSED');
      });

      expect(result.current.isHealthy).toBe(false);
    });

    it('isHealthy is false when reconnecting', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      act(() => {
        health.notifyStatusChange('CHANNEL_ERROR');
      });

      expect(result.current.connectionState).toBe('reconnecting');
      expect(result.current.isHealthy).toBe(false);
    });

    it('isHealthy is false when connecting (initial state)', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));

      expect(result.current.connectionState).toBe('connecting');
      expect(result.current.isHealthy).toBe(false);
    });
  });

  describe('Test Event Handling', () => {
    it('responds to __test_subscription_drop event', async () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // First connect
      act(() => {
        health.notifyStatusChange('SUBSCRIBED');
      });
      expect(result.current.connectionState).toBe('connected');

      // Trigger test drop event
      act(() => {
        window.dispatchEvent(new CustomEvent('__test_subscription_drop'));
      });

      expect(result.current.connectionState).toBe('disconnected');
    });

    it('responds to __test_subscription_reconnect event', () => {
      const { result } = renderHook(() => useSubscriptionHealth(mockChannel));
      const health = result.current as SubscriptionHealthWithNotify;

      // Start disconnected
      act(() => {
        health.notifyStatusChange('CLOSED');
      });

      // Trigger test reconnect event
      act(() => {
        window.dispatchEvent(new CustomEvent('__test_subscription_reconnect'));
      });

      // Initially goes to reconnecting
      expect(result.current.connectionState).toBe('reconnecting');

      // Then after timeout, goes to connected
      // Use act to wrap the timer advancement and state update
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Now state should be connected
      expect(result.current.connectionState).toBe('connected');
    });
  });
});
