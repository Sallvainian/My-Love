/**
 * Unit tests for useNetworkStatus hook
 *
 * Tests the network status detection hook including:
 * - Initial online/offline state detection
 * - Online/offline event handling
 * - Connecting transitional state with debounce
 * - Cleanup on unmount
 *
 * Story 1.5: Task 1 - Network Status Detection Hook (AC-1.5.1)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus hook', () => {
  let originalNavigator: typeof navigator;
  let onlineListeners: Array<(event: Event) => void> = [];
  let offlineListeners: Array<(event: Event) => void> = [];
  let navigatorOnLine = true;

  // Helper to update navigator.onLine AND fire events
  const setNetworkState = (online: boolean) => {
    navigatorOnLine = online;
    Object.defineProperty(global.navigator, 'onLine', {
      value: navigatorOnLine,
      configurable: true,
    });
  };

  const fireOnlineEvent = () => {
    setNetworkState(true);
    onlineListeners.forEach((listener) => listener(new Event('online')));
  };

  const fireOfflineEvent = () => {
    setNetworkState(false);
    offlineListeners.forEach((listener) => listener(new Event('offline')));
  };

  beforeEach(() => {
    // Save original navigator
    originalNavigator = global.navigator;

    // Reset listener arrays
    onlineListeners = [];
    offlineListeners = [];

    // Reset navigator state to online
    navigatorOnLine = true;

    // Mock navigator.onLine - default to online
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        get onLine() {
          return navigatorOnLine;
        },
      },
      writable: true,
      configurable: true,
    });

    // Mock window event listeners
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'online' && typeof listener === 'function') {
        onlineListeners.push(listener);
      } else if (event === 'offline' && typeof listener === 'function') {
        offlineListeners.push(listener);
      }
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((event, listener) => {
      if (event === 'online' && typeof listener === 'function') {
        onlineListeners = onlineListeners.filter((l) => l !== listener);
      } else if (event === 'offline' && typeof listener === 'function') {
        offlineListeners = offlineListeners.filter((l) => l !== listener);
      }
    });

    // Use fake timers for debounce testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });

    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initial state detection', () => {
    it('should detect initial online state', () => {
      setNetworkState(true);

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should detect initial offline state', () => {
      setNetworkState(false);

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should default to online when navigator is undefined', () => {
      // Remove navigator temporarily
      const nav = global.navigator;
      // @ts-expect-error - intentionally setting to undefined for test
      delete global.navigator;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isConnecting).toBe(false);

      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: nav,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('event listener setup', () => {
    it('should add online and offline event listeners on mount', () => {
      renderHook(() => useNetworkStatus());

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useNetworkStatus());

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('offline event handling', () => {
    it('should immediately set isOnline to false on offline event', () => {
      setNetworkState(true);
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);

      // Simulate offline event (this also updates navigator.onLine)
      act(() => {
        fireOfflineEvent();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should clear connecting state when going offline', () => {
      setNetworkState(true);
      const { result } = renderHook(() => useNetworkStatus());

      // First go offline
      act(() => {
        fireOfflineEvent();
      });

      // Then start coming online (triggers connecting state)
      act(() => {
        fireOnlineEvent();
      });

      expect(result.current.isConnecting).toBe(true);

      // Go offline again before connecting completes
      act(() => {
        fireOfflineEvent();
      });

      // Should immediately be offline, not connecting
      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe('online event handling with connecting state', () => {
    it('should enter connecting state before confirming online', () => {
      setNetworkState(false);
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);

      // Simulate online event
      act(() => {
        fireOnlineEvent();
      });

      // Should be in connecting state
      expect(result.current.isConnecting).toBe(true);
      // isOnline transitions after debounce
    });

    it('should confirm online state after debounce period', () => {
      setNetworkState(false);
      const { result } = renderHook(() => useNetworkStatus());

      // Simulate online event
      act(() => {
        fireOnlineEvent();
      });

      expect(result.current.isConnecting).toBe(true);

      // Fast-forward past debounce period (1500ms) and run all timers
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should reset connecting state if offline event fires during debounce', () => {
      setNetworkState(false);
      const { result } = renderHook(() => useNetworkStatus());

      // Start reconnecting
      act(() => {
        fireOnlineEvent();
      });

      expect(result.current.isConnecting).toBe(true);

      // Go offline before debounce completes
      act(() => {
        fireOfflineEvent();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);

      // Fast-forward past debounce - should NOT become online
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe('rapid state changes', () => {
    it('should handle rapid online/offline toggling', () => {
      setNetworkState(true);
      const { result } = renderHook(() => useNetworkStatus());

      // Rapid toggling
      for (let i = 0; i < 5; i++) {
        act(() => {
          fireOfflineEvent();
        });
        act(() => {
          fireOnlineEvent();
        });
      }

      // Should end in connecting state (last action was online)
      expect(result.current.isConnecting).toBe(true);

      // Complete all pending timers
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle debounce cancellation on new online event', () => {
      setNetworkState(false);
      const { result } = renderHook(() => useNetworkStatus());

      // First online event
      act(() => {
        fireOnlineEvent();
      });

      expect(result.current.isConnecting).toBe(true);

      // Go offline (cancels pending timeout)
      act(() => {
        fireOfflineEvent();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);

      // Run remaining timers - should NOT change state
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clear timeout on unmount', () => {
      setNetworkState(false);
      const { result, unmount } = renderHook(() => useNetworkStatus());

      // Trigger online event
      act(() => {
        fireOnlineEvent();
      });

      expect(result.current.isConnecting).toBe(true);

      // Unmount before debounce completes
      unmount();

      // Advance past debounce - should not cause errors
      act(() => {
        vi.runAllTimers();
      });

      // Test passes if no errors thrown
    });
  });
});
