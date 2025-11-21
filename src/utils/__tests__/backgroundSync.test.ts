/**
 * Unit tests for Background Sync utilities
 *
 * Tests the registerBackgroundSync, setupServiceWorkerListener, and
 * isBackgroundSyncSupported functions with proper mocking of Service Worker APIs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerBackgroundSync,
  setupServiceWorkerListener,
  isBackgroundSyncSupported,
} from '../backgroundSync';

// Mock Service Worker types
interface MockServiceWorkerRegistration {
  sync: {
    register: ReturnType<typeof vi.fn>;
  };
}

interface MockServiceWorker {
  ready: Promise<MockServiceWorkerRegistration>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

describe('backgroundSync utilities', () => {
  let originalNavigator: typeof navigator;
  let mockServiceWorker: MockServiceWorker;
  let mockRegistration: MockServiceWorkerRegistration;

  beforeEach(() => {
    // Save original navigator
    originalNavigator = global.navigator;

    // Create mock registration with sync manager
    mockRegistration = {
      sync: {
        register: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock service worker
    mockServiceWorker = {
      ready: Promise.resolve(mockRegistration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock navigator.serviceWorker
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    // Mock window.SyncManager
    Object.defineProperty(global, 'window', {
      value: {
        SyncManager: {},
      },
      writable: true,
      configurable: true,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('isBackgroundSyncSupported', () => {
    it('should return true when Service Worker and SyncManager are available', () => {
      expect(isBackgroundSyncSupported()).toBe(true);
    });

    it('should return false when Service Worker is not available', () => {
      const nav = global.navigator as any;
      delete nav.serviceWorker;

      expect(isBackgroundSyncSupported()).toBe(false);
    });

    it('should return false when SyncManager is not available', () => {
      const win = global.window as any;
      delete win.SyncManager;

      expect(isBackgroundSyncSupported()).toBe(false);
    });

    it('should return false when neither Service Worker nor SyncManager is available', () => {
      const nav = global.navigator as any;
      const win = global.window as any;
      delete nav.serviceWorker;
      delete win.SyncManager;

      expect(isBackgroundSyncSupported()).toBe(false);
    });
  });

  describe('registerBackgroundSync', () => {
    it('should register a sync tag successfully', async () => {
      const tag = 'sync-pending-moods';

      await registerBackgroundSync(tag);

      // Verify sync.register was called with the correct tag
      expect(mockRegistration.sync.register).toHaveBeenCalledWith(tag);
      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple sync tag registrations', async () => {
      await registerBackgroundSync('tag1');
      await registerBackgroundSync('tag2');

      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(2);
      expect(mockRegistration.sync.register).toHaveBeenNthCalledWith(1, 'tag1');
      expect(mockRegistration.sync.register).toHaveBeenNthCalledWith(2, 'tag2');
    });

    it('should not throw when Service Worker is not available', async () => {
      const nav = global.navigator as any;
      delete nav.serviceWorker;

      await expect(registerBackgroundSync('test-tag')).resolves.not.toThrow();
    });

    it('should not throw when SyncManager is not available', async () => {
      const win = global.window as any;
      delete win.SyncManager;

      await expect(registerBackgroundSync('test-tag')).resolves.not.toThrow();
    });

    it('should handle registration errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRegistration.sync.register.mockRejectedValueOnce(new Error('Registration failed'));

      await expect(registerBackgroundSync('error-tag')).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[BackgroundSync] Failed to register sync:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should wait for service worker to be ready', async () => {
      const delayedRegistration = {
        sync: {
          register: vi.fn().mockResolvedValue(undefined),
        },
      };

      mockServiceWorker.ready = new Promise((resolve) => {
        setTimeout(() => resolve(delayedRegistration), 100);
      });

      await registerBackgroundSync('delayed-tag');

      expect(delayedRegistration.sync.register).toHaveBeenCalledWith('delayed-tag');
    });
  });

  describe('setupServiceWorkerListener', () => {
    it('should setup message listener and call callback on BACKGROUND_SYNC_REQUEST', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);

      setupServiceWorkerListener(mockCallback);

      // Get the addEventListener call arguments
      const addEventListenerCalls = mockServiceWorker.addEventListener.mock.calls;
      expect(addEventListenerCalls).toHaveLength(1);
      expect(addEventListenerCalls[0][0]).toBe('message');

      // Get the registered handler
      const messageHandler = addEventListenerCalls[0][1] as (event: MessageEvent) => void;

      // Simulate a BACKGROUND_SYNC_REQUEST message
      const mockEvent = {
        data: {
          type: 'BACKGROUND_SYNC_REQUEST',
          tag: 'sync-pending-moods',
        },
      } as MessageEvent;

      messageHandler(mockEvent);

      // Wait for async callback
      await vi.waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });

    it('should not call callback for non-BACKGROUND_SYNC_REQUEST messages', () => {
      const mockCallback = vi.fn();

      setupServiceWorkerListener(mockCallback);

      const messageHandler = mockServiceWorker.addEventListener.mock.calls[0][1] as (
        event: MessageEvent
      ) => void;

      // Simulate a different message type
      const mockEvent = {
        data: {
          type: 'SKIP_WAITING',
        },
      } as MessageEvent;

      messageHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle messages with no data gracefully', () => {
      const mockCallback = vi.fn();

      setupServiceWorkerListener(mockCallback);

      const messageHandler = mockServiceWorker.addEventListener.mock.calls[0][1] as (
        event: MessageEvent
      ) => void;

      // Simulate a message with no data
      const mockEvent = {} as MessageEvent;

      messageHandler(mockEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should return cleanup function that removes listener', () => {
      const mockCallback = vi.fn();

      const cleanup = setupServiceWorkerListener(mockCallback);

      // Call cleanup
      cleanup();

      // Verify removeEventListener was called
      expect(mockServiceWorker.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should handle callback errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockCallback = vi.fn().mockRejectedValue(new Error('Sync failed'));

      setupServiceWorkerListener(mockCallback);

      const messageHandler = mockServiceWorker.addEventListener.mock.calls[0][1] as (
        event: MessageEvent
      ) => void;

      const mockEvent = {
        data: {
          type: 'BACKGROUND_SYNC_REQUEST',
        },
      } as MessageEvent;

      messageHandler(mockEvent);

      // Wait for async error handling
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[BackgroundSync] Sync request failed:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should setup multiple listeners independently', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      setupServiceWorkerListener(callback1);
      setupServiceWorkerListener(callback2);

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('should cleanup only the specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const cleanup1 = setupServiceWorkerListener(callback1);
      setupServiceWorkerListener(callback2);

      // Cleanup only first listener
      cleanup1();

      expect(mockServiceWorker.removeEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle concurrent sync registrations', async () => {
      const promises = [
        registerBackgroundSync('tag1'),
        registerBackgroundSync('tag2'),
        registerBackgroundSync('tag3'),
      ];

      await Promise.all(promises);

      expect(mockRegistration.sync.register).toHaveBeenCalledTimes(3);
    });

    it('should handle service worker registration timeout', async () => {
      mockServiceWorker.ready = new Promise(() => {
        // Never resolves - simulates timeout
      });

      const timeoutPromise = Promise.race([
        registerBackgroundSync('timeout-tag'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
      ]);

      const result = await timeoutPromise;
      expect(result).toBe('timeout');
    });

    it('should preserve message event data integrity', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      setupServiceWorkerListener(mockCallback);

      const messageHandler = mockServiceWorker.addEventListener.mock.calls[0][1] as (
        event: MessageEvent
      ) => void;

      const complexEvent = {
        data: {
          type: 'BACKGROUND_SYNC_REQUEST',
          tag: 'sync-pending-moods',
          timestamp: Date.now(),
          metadata: { attempt: 1, priority: 'high' },
        },
      } as MessageEvent;

      messageHandler(complexEvent);

      // Wait for async callback
      await vi.waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });
  });
});
