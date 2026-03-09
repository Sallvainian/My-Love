import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OfflineError,
  isOfflineError,
  isOnline,
  isOffline,
  createOfflineErrorHandler,
  withOfflineCheck,
  safeOfflineOperation,
  OFFLINE_ERROR_MESSAGE,
  OFFLINE_RETRY_MESSAGE,
} from '@/utils/offlineErrorHandler';

describe('OfflineError', () => {
  it('creates an error with default message', () => {
    const err = new OfflineError('save-mood');
    expect(err.message).toBe("You're offline. Please check your connection and try again.");
    expect(err.operation).toBe('save-mood');
    expect(err.isRetryable).toBe(true);
    expect(err.name).toBe('OfflineError');
  });

  it('creates an error with custom message', () => {
    const err = new OfflineError('sync', 'Custom offline message');
    expect(err.message).toBe('Custom offline message');
    expect(err.operation).toBe('sync');
  });

  it('is an instance of Error', () => {
    const err = new OfflineError('test');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('isOfflineError', () => {
  it('returns true for OfflineError instance', () => {
    expect(isOfflineError(new OfflineError('test'))).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isOfflineError(new Error('nope'))).toBe(false);
  });

  it('returns true for duck-typed object with name OfflineError', () => {
    const fake = { name: 'OfflineError', message: 'fake', operation: 'x', isRetryable: true };
    expect(isOfflineError(fake)).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
  });
});

describe('isOnline / isOffline', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'onLine', original);
    }
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isOnline()).toBe(true);
    expect(isOffline()).toBe(false);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isOnline()).toBe(false);
    expect(isOffline()).toBe(true);
  });
});

describe('createOfflineErrorHandler', () => {
  it('returns a result with retry action', () => {
    const retry = vi.fn();
    const result = createOfflineErrorHandler(retry);
    expect(result.isOffline).toBe(true);
    expect(result.canRetry).toBe(true);
    expect(result.message).toBe(OFFLINE_RETRY_MESSAGE);
    expect(result.action?.label).toBe('Retry');
    result.action?.onRetry();
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('withOfflineCheck', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'onLine', original);
    }
  });

  it('executes the function when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const result = await withOfflineCheck('test', async () => 42);
    expect(result).toBe(42);
  });

  it('throws OfflineError when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await expect(withOfflineCheck('save', async () => 42)).rejects.toThrow(OfflineError);
  });

  it('includes operation name in thrown error', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      await withOfflineCheck('sync-data', async () => 42);
    } catch (err) {
      expect((err as OfflineError).operation).toBe('sync-data');
    }
  });

  it('propagates errors from the wrapped function', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await expect(
      withOfflineCheck('test', async () => {
        throw new Error('inner error');
      })
    ).rejects.toThrow('inner error');
  });
});

describe('safeOfflineOperation', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, 'onLine', original);
    }
  });

  it('returns success with data when online and operation succeeds', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const result = await safeOfflineOperation('test', async () => 'data');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('data');
      expect(result.offline).toBe(false);
    }
  });

  it('returns offline result when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const fn = vi.fn().mockResolvedValue('data');
    const result = await safeOfflineOperation('test', fn);
    expect(result.success).toBe(false);
    if (!result.success && result.offline) {
      expect(result.message).toBe(OFFLINE_RETRY_MESSAGE);
      expect(typeof result.retry).toBe('function');
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns error result when operation fails while online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const result = await safeOfflineOperation('test', async () => {
      throw new Error('boom');
    });
    expect(result.success).toBe(false);
    if (!result.success && !result.offline) {
      expect(result.error.message).toBe('boom');
      expect(result.message).toBe('boom');
    }
  });

  it('wraps non-Error throws in Error', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const result = await safeOfflineOperation('test', async () => {
      throw 'string error';
    });
    if (!result.success && !result.offline) {
      expect(result.error).toBeInstanceOf(Error);
      // safeOfflineOperation uses `error instanceof Error ? error.message : 'An error occurred'`
      // Since thrown string is not an Error instance, message is the generic fallback
      expect(result.message).toBe('An error occurred');
    }
  });
});

describe('constants', () => {
  it('OFFLINE_ERROR_MESSAGE is defined', () => {
    expect(OFFLINE_ERROR_MESSAGE).toBeTruthy();
  });

  it('OFFLINE_RETRY_MESSAGE is defined', () => {
    expect(OFFLINE_RETRY_MESSAGE).toBeTruthy();
  });
});
