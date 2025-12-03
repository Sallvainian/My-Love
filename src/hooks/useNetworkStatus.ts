/**
 * useNetworkStatus Hook
 *
 * Provides reactive network status detection throughout the application.
 *
 * Features:
 * - Tracks online/offline/connecting states
 * - Uses navigator.onLine for initial state
 * - Listens to window 'online'/'offline' events
 * - Includes brief "connecting" transitional state on reconnection
 *
 * Story 1.5: Task 1 - Network Status Detection (AC-1.5.1)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  /** True when browser reports network connection available */
  isOnline: boolean;
  /** True during brief transition from offline to online (debounce period) */
  isConnecting: boolean;
}

// Duration to show "connecting" state before confirming online (ms)
const CONNECTING_DEBOUNCE_MS = 1500;

/**
 * React hook for detecting network connectivity status
 *
 * @returns NetworkStatus object with isOnline and isConnecting states
 *
 * @example
 * ```tsx
 * const { isOnline, isConnecting } = useNetworkStatus();
 *
 * if (!isOnline) return <OfflineBanner />;
 * if (isConnecting) return <ConnectingIndicator />;
 * return <OnlineContent />;
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  // Initialize from navigator.onLine (fallback to true if unavailable)
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Track transitional "connecting" state
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Ref to track timeout for cleanup
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout helper
  const clearConnectingTimeout = useCallback(() => {
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
  }, []);

  // Handle transition to online
  const handleOnline = useCallback(() => {
    // Clear any existing timeout
    clearConnectingTimeout();

    // Enter "connecting" transitional state
    setIsConnecting(true);

    // After debounce period, confirm online status
    connectingTimeoutRef.current = setTimeout(() => {
      setIsOnline(true);
      setIsConnecting(false);

      if (import.meta.env.DEV) {
        console.log('[useNetworkStatus] Network status: ONLINE');
      }
    }, CONNECTING_DEBOUNCE_MS);
  }, [clearConnectingTimeout]);

  // Handle transition to offline
  const handleOffline = useCallback(() => {
    // Clear any pending "connecting" transition
    clearConnectingTimeout();

    // Immediately mark as offline
    setIsOnline(false);
    setIsConnecting(false);

    if (import.meta.env.DEV) {
      console.log('[useNetworkStatus] Network status: OFFLINE');
    }
  }, [clearConnectingTimeout]);

  useEffect(() => {
    // Add event listeners for network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state on mount (in case it changed during render)
    if (typeof navigator !== 'undefined') {
      const currentlyOnline = navigator.onLine;
      if (currentlyOnline !== isOnline) {
        setIsOnline(currentlyOnline);
      }
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearConnectingTimeout();
    };
  }, [handleOnline, handleOffline, clearConnectingTimeout, isOnline]);

  return { isOnline, isConnecting };
}

export default useNetworkStatus;
