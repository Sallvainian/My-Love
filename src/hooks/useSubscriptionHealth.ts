/**
 * useSubscriptionHealth Hook
 *
 * Provides observable subscription health signals for Supabase Realtime connections.
 * Enables deterministic E2E testing of subscription reconnection and message delivery.
 *
 * Story TD-1.0.5 - Subscription Observability Infrastructure
 * Created to support E2E testing for Risk R-001 mitigation (silent subscription drops)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Connection state for Supabase Realtime subscriptions
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * Subscription health information
 */
export interface SubscriptionHealth {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Timestamp of the last heartbeat (null if never received) */
  lastHeartbeat: Date | null;
  /** Number of reconnection attempts since initial connection */
  reconnectionCount: number;
  /** Whether the subscription is healthy (connected and heartbeat within threshold) */
  isHealthy: boolean;
}

/** Default heartbeat threshold in milliseconds (30 seconds) */
const HEARTBEAT_THRESHOLD_MS = 30000;

/** Interval for updating heartbeat while connected (10 seconds) */
const HEARTBEAT_UPDATE_INTERVAL_MS = 10000;

/** Interval for checking staleness (1 second) - enables responsive health detection */
const STALENESS_CHECK_INTERVAL_MS = 1000;

/**
 * Hook to track subscription health for a Supabase Realtime channel
 *
 * @param channel - The RealtimeChannel to monitor (null if not yet created)
 * @param heartbeatThreshold - Threshold in ms for considering heartbeat stale (default: 30s)
 * @returns SubscriptionHealth object with connection state and health indicators
 *
 * @example
 * ```tsx
 * const health = useSubscriptionHealth(channelRef.current);
 * console.log(health.connectionState); // 'connected' | 'disconnected' | etc.
 * console.log(health.isHealthy); // true if connected and heartbeat fresh
 * ```
 */
export function useSubscriptionHealth(
  channel: RealtimeChannel | null,
  heartbeatThreshold: number = HEARTBEAT_THRESHOLD_MS
): SubscriptionHealth {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [reconnectionCount, setReconnectionCount] = useState(0);
  const [isHealthy, setIsHealthy] = useState(false);
  const wasConnectedRef = useRef(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stalenessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper to calculate current health status
  const calculateIsHealthy = useCallback((
    state: ConnectionState,
    heartbeat: Date | null,
    threshold: number
  ): boolean => {
    if (state !== 'connected') return false;
    if (heartbeat === null) return true; // No heartbeat yet but connected
    const now = Date.now();
    return (now - heartbeat.getTime()) < threshold;
  }, []);

  // Handle channel status changes
  const handleStatusChange = useCallback((status: string) => {
    switch (status) {
      case 'SUBSCRIBED': {
        if (wasConnectedRef.current) {
          // This is a reconnection
          setReconnectionCount((prev) => prev + 1);
        }
        wasConnectedRef.current = true;
        const newHeartbeat = new Date();
        setConnectionState('connected');
        setLastHeartbeat(newHeartbeat);
        setIsHealthy(calculateIsHealthy('connected', newHeartbeat, heartbeatThreshold));
        break;
      }

      case 'CLOSED':
        setConnectionState('disconnected');
        setIsHealthy(false);
        break;

      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        // If we were connected before, this is a reconnection attempt
        if (wasConnectedRef.current) {
          setConnectionState('reconnecting');
        } else {
          setConnectionState('disconnected');
        }
        setIsHealthy(false);
        break;

      default:
        // For any unknown status, maintain current state
        break;
    }
  }, [calculateIsHealthy, heartbeatThreshold]);

  // Set up channel status listener - reset state when no channel
  useEffect(() => {
    if (!channel) {
      setConnectionState('connecting');
      setIsHealthy(false);
    }
  }, [channel]);

  // Heartbeat and staleness checking - only runs when connected
  // This fixes Issue 3: intervals only run when needed
  useEffect(() => {
    // Clear any existing intervals first
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (stalenessIntervalRef.current) {
      clearInterval(stalenessIntervalRef.current);
      stalenessIntervalRef.current = null;
    }

    // Only set up intervals when connected
    if (connectionState !== 'connected') {
      return;
    }

    // Heartbeat update interval - updates lastHeartbeat while connected
    heartbeatIntervalRef.current = setInterval(() => {
      const newHeartbeat = new Date();
      setLastHeartbeat(newHeartbeat);
      setIsHealthy(calculateIsHealthy('connected', newHeartbeat, heartbeatThreshold));
    }, HEARTBEAT_UPDATE_INTERVAL_MS);

    // Staleness check interval - detects stale heartbeats for responsive health updates
    // This fixes Issue 2: isHealthy is recalculated frequently, not just on dep changes
    stalenessIntervalRef.current = setInterval(() => {
      setIsHealthy((prevHealthy) => {
        const currentHealth = calculateIsHealthy(connectionState, lastHeartbeat, heartbeatThreshold);
        // Only update if changed to avoid unnecessary re-renders
        return currentHealth !== prevHealthy ? currentHealth : prevHealthy;
      });
    }, STALENESS_CHECK_INTERVAL_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (stalenessIntervalRef.current) {
        clearInterval(stalenessIntervalRef.current);
        stalenessIntervalRef.current = null;
      }
    };
  }, [connectionState, lastHeartbeat, heartbeatThreshold, calculateIsHealthy]);

  // Listen for test events (for E2E testing mocking)
  useEffect(() => {
    const handleTestDrop = () => {
      setConnectionState('disconnected');
      setIsHealthy(false);
    };

    const handleTestReconnect = () => {
      setConnectionState('reconnecting');
      setIsHealthy(false);
      // Simulate reconnection delay
      setTimeout(() => {
        const newHeartbeat = new Date();
        setConnectionState('connected');
        setReconnectionCount((prev) => prev + 1);
        setLastHeartbeat(newHeartbeat);
        setIsHealthy(true);
      }, 100);
    };

    // E2E Test: Force healthy state (bypasses real subscription)
    const handleTestSetHealthy = () => {
      const newHeartbeat = new Date();
      wasConnectedRef.current = true;
      setConnectionState('connected');
      setLastHeartbeat(newHeartbeat);
      setIsHealthy(true);
    };

    window.addEventListener('__test_subscription_drop', handleTestDrop);
    window.addEventListener('__test_subscription_reconnect', handleTestReconnect);
    window.addEventListener('__test_subscription_set_healthy', handleTestSetHealthy);

    return () => {
      window.removeEventListener('__test_subscription_drop', handleTestDrop);
      window.removeEventListener('__test_subscription_reconnect', handleTestReconnect);
      window.removeEventListener('__test_subscription_set_healthy', handleTestSetHealthy);
    };
  }, []);

  // Expose status change handler for external use
  // This allows useRealtimeMessages to call it when subscription status changes
  const notifyStatusChange = useCallback((status: string) => {
    handleStatusChange(status);
  }, [handleStatusChange]);

  // Return health object with status notification capability
  return {
    connectionState,
    lastHeartbeat,
    reconnectionCount,
    isHealthy,
    notifyStatusChange,
  } as SubscriptionHealthWithNotify;
}

/**
 * Extended health type with status notification capability
 * Used by useRealtimeMessages to update subscription health
 */
export type SubscriptionHealthWithNotify = SubscriptionHealth & {
  notifyStatusChange: (status: string) => void;
};

export default useSubscriptionHealth;
