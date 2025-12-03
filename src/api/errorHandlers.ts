/**
 * Supabase Error Handling Utilities
 *
 * Provides error detection, transformation, and graceful degradation
 * for Supabase API failures and network issues.
 *
 * @module api/errorHandlers
 */

import { PostgrestError } from '@supabase/supabase-js';

/**
 * Custom error class for Supabase service errors
 * Provides structured error information for UI display
 */
export class SupabaseServiceError extends Error {
  public readonly code: string | undefined;
  public readonly details: string | undefined;
  public readonly hint: string | undefined;
  public readonly isNetworkError: boolean;

  constructor(
    message: string,
    code: string | undefined,
    details: string | undefined,
    hint: string | undefined,
    isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'SupabaseServiceError';
    this.code = code;
    this.details = details;
    this.hint = hint;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Check if the device is currently online
 * Uses navigator.onLine for network detection
 *
 * @returns true if device has network connection
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Transform PostgrestError into user-friendly SupabaseServiceError
 *
 * @param error - PostgrestError from Supabase SDK
 * @param context - Optional context string for debugging
 * @returns Transformed SupabaseServiceError
 */
export const handleSupabaseError = (
  error: PostgrestError,
  context?: string
): SupabaseServiceError => {
  const contextPrefix = context ? `[${context}] ` : '';

  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    '23505': 'This record already exists',
    '23503': 'Referenced record not found',
    '23502': 'Required field is missing',
    '42501': 'Permission denied - check Row Level Security policies',
    '42P01': 'Table not found - database schema may be out of sync',
    PGRST116: 'No rows found',
    PGRST301: 'Invalid request parameters',
  };

  const userMessage = errorMessages[error.code] || `Database error: ${error.message}`;

  return new SupabaseServiceError(
    `${contextPrefix}${userMessage}`,
    error.code,
    error.details,
    error.hint,
    false
  );
};

/**
 * Handle network errors (fetch failures, timeouts, etc.)
 *
 * @param error - Generic error object
 * @param context - Optional context string for debugging
 * @returns SupabaseServiceError with network error flag
 */
export const handleNetworkError = (error: unknown, context?: string): SupabaseServiceError => {
  const contextPrefix = context ? `[${context}] ` : '';
  const message = error instanceof Error ? error.message : 'Unknown network error';

  return new SupabaseServiceError(
    `${contextPrefix}Network error: ${message}. Your changes will be synced when you're back online.`,
    'NETWORK_ERROR',
    undefined,
    'Check your internet connection',
    true
  );
};

/**
 * Type guard to check if error is a PostgrestError
 *
 * @param error - Error object to check
 * @returns true if error is PostgrestError
 */
export const isPostgrestError = (error: unknown): error is PostgrestError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
};

/**
 * Type guard to check if error is SupabaseServiceError
 *
 * @param error - Error object to check
 * @returns true if error is SupabaseServiceError
 */
export const isSupabaseServiceError = (error: unknown): error is SupabaseServiceError => {
  return error instanceof SupabaseServiceError;
};

/**
 * Log Supabase error with context for debugging
 *
 * @param context - Context string (e.g., "MoodSyncService.syncMood")
 * @param error - Error object (PostgrestError or generic)
 */
export const logSupabaseError = (context: string, error: unknown): void => {
  // Check SupabaseServiceError FIRST (more specific - has isNetworkError)
  if (isSupabaseServiceError(error)) {
    console.error(`[Supabase] ${context}:`, {
      message: error.message,
      code: error.code,
      isNetworkError: error.isNetworkError,
    });
  } else if (isPostgrestError(error)) {
    console.error(`[Supabase] ${context}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else if (error instanceof Error) {
    console.error(`[Supabase] ${context}:`, error.message);
  } else {
    console.error(`[Supabase] ${context}:`, error);
  }
};

/**
 * Retry configuration for network operations
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 * Exponential backoff: 1s, 2s, 4s (max 3 attempts)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Execute async operation with exponential backoff retry
 *
 * @param operation - Async operation to retry
 * @param config - Retry configuration (optional)
 * @returns Result of successful operation
 * @throws Error after max attempts exceeded
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> => {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Log retry attempt
      console.warn(`[Supabase] Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`);

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff with max delay cap
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError || new Error('Operation failed after retries');
};

/**
 * Create a graceful error message for offline mode
 *
 * @param operation - Description of failed operation
 * @returns User-friendly offline message
 */
export const createOfflineMessage = (operation: string): string => {
  return `You're offline. ${operation} will sync automatically when you're back online.`;
};
