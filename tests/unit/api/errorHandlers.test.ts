/**
 * Error Handlers Unit Tests
 *
 * Tests error detection, transformation, and retry logic
 * for Supabase API error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isOnline,
  handleSupabaseError,
  handleNetworkError,
  isPostgrestError,
  isSupabaseServiceError,
  logSupabaseError,
  retryWithBackoff,
  createOfflineMessage,
  SupabaseServiceError,
  DEFAULT_RETRY_CONFIG,
} from '../../../src/api/errorHandlers';
import type { PostgrestError } from '@supabase/supabase-js';

describe('isOnline', () => {
  it('should return true when navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isOnline()).toBe(true);
  });

  it('should return false when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isOnline()).toBe(false);
  });
});

describe('handleSupabaseError', () => {
  it('should transform PostgrestError into SupabaseServiceError', () => {
    const postgrestError: PostgrestError = {
      message: 'Test error',
      code: '23505',
      details: 'Duplicate key violation',
      hint: 'Use a different value',
    };

    const result = handleSupabaseError(postgrestError);

    expect(result).toBeInstanceOf(SupabaseServiceError);
    expect(result.message).toContain('This record already exists');
    expect(result.code).toBe('23505');
    expect(result.details).toBe('Duplicate key violation');
    expect(result.hint).toBe('Use a different value');
    expect(result.isNetworkError).toBe(false);
  });

  it('should include context in error message', () => {
    const postgrestError: PostgrestError = {
      message: 'Test error',
      code: '42501',
      details: '',
      hint: '',
    };

    const result = handleSupabaseError(postgrestError, 'TestService.testMethod');

    expect(result.message).toContain('[TestService.testMethod]');
    expect(result.message).toContain('Permission denied');
  });

  it('should handle unknown error codes', () => {
    const postgrestError: PostgrestError = {
      message: 'Unknown error',
      code: 'UNKNOWN',
      details: '',
      hint: '',
    };

    const result = handleSupabaseError(postgrestError);

    expect(result.message).toContain('Database error');
    expect(result.message).toContain('Unknown error');
  });

  it('should map common error codes to user-friendly messages', () => {
    const testCases: Array<{ code: string; expectedMessage: string }> = [
      { code: '23505', expectedMessage: 'This record already exists' },
      { code: '23503', expectedMessage: 'Referenced record not found' },
      { code: '23502', expectedMessage: 'Required field is missing' },
      { code: '42501', expectedMessage: 'Permission denied' },
      { code: '42P01', expectedMessage: 'Table not found' },
      { code: 'PGRST116', expectedMessage: 'No rows found' },
      { code: 'PGRST301', expectedMessage: 'Invalid request parameters' },
    ];

    testCases.forEach(({ code, expectedMessage }) => {
      const error: PostgrestError = {
        message: 'Test',
        code,
        details: '',
        hint: '',
      };
      const result = handleSupabaseError(error);
      expect(result.message).toContain(expectedMessage);
    });
  });
});

describe('handleNetworkError', () => {
  it('should transform generic Error into SupabaseServiceError', () => {
    const networkError = new Error('Network request failed');
    const result = handleNetworkError(networkError);

    expect(result).toBeInstanceOf(SupabaseServiceError);
    expect(result.message).toContain('Network error');
    expect(result.message).toContain('Network request failed');
    expect(result.isNetworkError).toBe(true);
    expect(result.code).toBe('NETWORK_ERROR');
  });

  it('should include context in error message', () => {
    const networkError = new Error('Connection timeout');
    const result = handleNetworkError(networkError, 'TestService.fetch');

    expect(result.message).toContain('[TestService.fetch]');
  });

  it('should handle unknown error types', () => {
    const result = handleNetworkError('string error');

    expect(result.message).toContain('Unknown network error');
    expect(result.isNetworkError).toBe(true);
  });

  it('should include helpful hint for offline message', () => {
    const result = handleNetworkError(new Error('Fetch failed'));

    expect(result.message).toContain('back online');
    expect(result.hint).toBe('Check your internet connection');
  });
});

describe('isPostgrestError', () => {
  it('should return true for valid PostgrestError', () => {
    const error: PostgrestError = {
      message: 'Test',
      code: '23505',
      details: 'Details',
      hint: 'Hint',
    };

    expect(isPostgrestError(error)).toBe(true);
  });

  it('should return false for generic Error', () => {
    const error = new Error('Test');
    expect(isPostgrestError(error)).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isPostgrestError('string')).toBe(false);
    expect(isPostgrestError(123)).toBe(false);
    expect(isPostgrestError(null)).toBe(false);
    expect(isPostgrestError(undefined)).toBe(false);
  });

  it('should return false for objects missing required fields', () => {
    expect(isPostgrestError({ message: 'Test' })).toBe(false);
    expect(isPostgrestError({ code: '23505' })).toBe(false);
  });
});

describe('isSupabaseServiceError', () => {
  it('should return true for SupabaseServiceError instances', () => {
    const error = new SupabaseServiceError('Test', '23505', '', '', false);
    expect(isSupabaseServiceError(error)).toBe(true);
  });

  it('should return false for generic Error', () => {
    const error = new Error('Test');
    expect(isSupabaseServiceError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isSupabaseServiceError('string')).toBe(false);
    expect(isSupabaseServiceError(null)).toBe(false);
  });
});

describe('logSupabaseError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should log PostgrestError with details', () => {
    const error: PostgrestError = {
      message: 'Test error',
      code: '23505',
      details: 'Duplicate key',
      hint: 'Use different value',
    };

    logSupabaseError('TestContext', error);

    expect(console.error).toHaveBeenCalledWith(
      '[Supabase] TestContext:',
      expect.objectContaining({
        code: '23505',
        message: 'Test error',
        details: 'Duplicate key',
        hint: 'Use different value',
      })
    );
  });

  it('should log SupabaseServiceError with network flag', () => {
    const error = new SupabaseServiceError(
      'Network error',
      'NETWORK_ERROR',
      '',
      '',
      true
    );

    logSupabaseError('TestContext', error);

    expect(console.error).toHaveBeenCalledWith(
      '[Supabase] TestContext:',
      expect.objectContaining({
        message: 'Network error',
        code: 'NETWORK_ERROR',
        isNetworkError: true,
      })
    );
  });

  it('should log generic Error with message', () => {
    const error = new Error('Generic error');

    logSupabaseError('TestContext', error);

    expect(console.error).toHaveBeenCalledWith(
      '[Supabase] TestContext:',
      'Generic error'
    );
  });

  it('should log unknown error types', () => {
    logSupabaseError('TestContext', 'string error');

    expect(console.error).toHaveBeenCalledWith(
      '[Supabase] TestContext:',
      'string error'
    );
  });
});

describe('retryWithBackoff', () => {
  it('should succeed on first attempt if operation succeeds', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts exceeded', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    await expect(retryWithBackoff(operation)).rejects.toThrow('Always fails');
    expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxAttempts);
  });

  it('should apply exponential backoff delays', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    await retryWithBackoff(operation, {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });
    const duration = Date.now() - startTime;

    // Should wait ~100ms + ~200ms = ~300ms (with some tolerance)
    expect(duration).toBeGreaterThanOrEqual(250);
    expect(duration).toBeLessThan(500);
  });

  it('should respect max delay cap', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    await retryWithBackoff(operation, {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 1500, // Cap delay at 1500ms
      backoffMultiplier: 10, // Would exceed cap without max
    });

    // Should cap delay at maxDelayMs
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should use custom retry config', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    const customConfig = {
      maxAttempts: 5,
      initialDelayMs: 50,
      maxDelayMs: 5000,
      backoffMultiplier: 3,
    };

    await expect(retryWithBackoff(operation, customConfig)).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(5);
  });
});

describe('createOfflineMessage', () => {
  it('should create user-friendly offline message', () => {
    const message = createOfflineMessage('Mood sync');

    expect(message).toContain("You're offline");
    expect(message).toContain('Mood sync');
    expect(message).toContain('sync automatically');
    expect(message).toContain('back online');
  });

  it('should handle different operation descriptions', () => {
    const operations = [
      'Sending poke',
      'Fetching moods',
      'Uploading photo',
    ];

    operations.forEach((op) => {
      const message = createOfflineMessage(op);
      expect(message).toContain(op);
    });
  });
});

describe('SupabaseServiceError class', () => {
  it('should create error with all properties', () => {
    const error = new SupabaseServiceError(
      'Test message',
      'TEST_CODE',
      'Test details',
      'Test hint',
      true
    );

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toBe('Test details');
    expect(error.hint).toBe('Test hint');
    expect(error.isNetworkError).toBe(true);
    expect(error.name).toBe('SupabaseServiceError');
  });

  it('should default isNetworkError to false', () => {
    const error = new SupabaseServiceError(
      'Test',
      'CODE',
      undefined,
      undefined
    );

    expect(error.isNetworkError).toBe(false);
  });

  it('should be instanceof Error', () => {
    const error = new SupabaseServiceError('Test', 'CODE', '', '', false);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SupabaseServiceError);
  });
});
