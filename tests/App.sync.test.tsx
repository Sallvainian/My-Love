/**
 * Integration tests for App.tsx sync mechanisms
 *
 * Tests the periodic sync, immediate sync, and service worker listener
 * integration in the App component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import App from '../src/App';
import * as backgroundSyncModule from '../src/utils/backgroundSync';

// Mock authService before any imports
vi.mock('../src/api/authService', () => ({
  authService: {
    getSession: vi.fn().mockResolvedValue({
      user: { id: 'test-user-id' },
      access_token: 'test-token',
    }),
    onAuthStateChange: vi.fn((callback) => {
      // Call callback asynchronously to simulate real behavior
      Promise.resolve().then(() => {
        callback({
          user: { id: 'test-user-id' },
          access_token: 'test-token',
        });
      });
      return () => {}; // unsubscribe function
    }),
    signOut: vi.fn(),
  },
}));

// Mock useAppStore with configurable state
const mockSyncPendingMoods = vi.fn();
const mockUpdateSyncStatus = vi.fn();
const mockInitializeApp = vi.fn();
const mockSetView = vi.fn();

// Mutable mock state that can be reconfigured between tests
const mockSyncStatus = {
  isOnline: true,
  pendingMoods: 0,
  lastSync: null as Date | null,
};

vi.mock('../src/stores/useAppStore', () => ({
  useAppStore: () => ({
    settings: {
      partnerId: 'test-partner-id',
      partnerName: 'Test Partner',
      displayName: 'Test User',
      themeName: 'sunset', // Add themeName to prevent undefined theme errors in theme application logic
    },
    initializeApp: mockInitializeApp,
    isLoading: false,
    currentView: 'mood',
    setView: mockSetView,
    syncPendingMoods: mockSyncPendingMoods,
    updateSyncStatus: mockUpdateSyncStatus,
    syncStatus: mockSyncStatus,
  }),
}));

// Mock Supabase auth
vi.mock('../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id' },
            access_token: 'test-token',
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn((callback) => {
        callback('SIGNED_IN', {
          user: { id: 'test-user-id' },
          access_token: 'test-token',
        });
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }),
    },
  },
}));

// Mock backgroundSync module
vi.mock('../src/utils/backgroundSync');

describe('App sync mechanisms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset mock state to default (online)
    mockSyncStatus.isOnline = true;
    mockSyncStatus.pendingMoods = 0;
    mockSyncStatus.lastSync = null;

    // Setup default mock implementations
    mockSyncPendingMoods.mockResolvedValue(undefined);
    vi.mocked(backgroundSyncModule.setupServiceWorkerListener).mockReturnValue(() => {});
    vi.mocked(backgroundSyncModule.isServiceWorkerSupported).mockReturnValue(true);

    // Mock navigator.serviceWorker for service worker tests
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          sync: { register: vi.fn() },
        }),
        controller: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Immediate sync on mount', () => {
    it('should sync pending moods immediately when app mounts (online + authenticated)', async () => {
      render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Verify sync was called once on mount
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);
    });

    it('should not sync when offline on mount', async () => {
      // Configure mock state to simulate offline status
      mockSyncStatus.isOnline = false;
      mockSyncStatus.pendingMoods = 2;

      render(<App />);

      // Flush pending promises
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Sync should not be called when offline
      expect(mockSyncPendingMoods).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully on mount', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSyncPendingMoods.mockRejectedValueOnce(new Error('Sync failed'));

      render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Error should be logged but not thrown
      expect(consoleSpy).toHaveBeenCalledWith(
        '[App] Initial sync on mount failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Periodic sync (5-minute interval)', () => {
    it('should trigger sync every 5 minutes while online', async () => {
      render(<App />);

      // Flush pending promises for initial mount (small time to let effects run)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Wait for initial mount sync
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);

      // Advance time by 5 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Verify periodic sync was triggered
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(2);

      // Advance another 5 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Verify another periodic sync
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(3);
    });

    it('should not trigger periodic sync when offline', async () => {
      // Configure mock state to simulate offline status
      mockSyncStatus.isOnline = false;
      mockSyncStatus.pendingMoods = 2;

      render(<App />);

      // Flush all pending timers
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mockSyncPendingMoods).not.toHaveBeenCalled();

      // Advance 5 minutes - should not trigger sync when offline
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Sync should still not be called when offline
      expect(mockSyncPendingMoods).not.toHaveBeenCalled();
    });

    it('should cleanup interval on unmount', async () => {
      const { unmount } = render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);

      // Unmount component
      unmount();

      // Advance time by 5 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Sync should not be called again after unmount
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);
    });

    it('should handle periodic sync errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);

      // Make next sync fail
      mockSyncPendingMoods.mockRejectedValueOnce(new Error('Periodic sync failed'));

      // Advance 5 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[App] Periodic sync failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Service Worker listener setup', () => {
    it('should add message listener when service workers are supported', async () => {
      const addEventListenerSpy = vi.spyOn(navigator.serviceWorker, 'addEventListener');

      render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Verify message listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should skip service worker listener setup when service workers are not supported', async () => {
      // Mock isServiceWorkerSupported to return false
      vi.mocked(backgroundSyncModule.isServiceWorkerSupported).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(<App />);

      // Flush pending promises
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Verify console log was called indicating skip
      expect(consoleSpy).toHaveBeenCalledWith(
        '[App] Service Worker not supported, skipping background sync listener'
      );

      consoleSpy.mockRestore();
    });

    it('should remove message listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(navigator.serviceWorker, 'removeEventListener');

      const { unmount } = render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Unmount and verify cleanup was called
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('Sync mechanism coordination', () => {
    it('should coordinate mount sync and periodic sync independently', async () => {
      render(<App />);

      // 1. Initial mount sync - flush pending promises
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);

      // 2. First periodic sync (5 minutes)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(2);

      // 3. Second periodic sync (another 5 minutes)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      });

      // Mount sync + 2 periodic syncs
      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(3);
    });

    it('should update sync status when service worker completes background sync', async () => {
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      // Capture the message handler
      vi.spyOn(navigator.serviceWorker, 'addEventListener').mockImplementation(
        (event, handler) => {
          if (event === 'message') {
            messageHandler = handler as (event: MessageEvent) => void;
          }
        }
      );

      render(<App />);

      // Flush pending promises for initial mount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Simulate service worker completion message
      if (messageHandler) {
        await act(async () => {
          messageHandler!({
            data: {
              type: 'BACKGROUND_SYNC_COMPLETED',
              successCount: 2,
              failCount: 0,
            },
          } as MessageEvent);
        });
      }

      // updateSyncStatus should be called after receiving the message
      expect(mockUpdateSyncStatus).toHaveBeenCalled();
    });
  });
});
