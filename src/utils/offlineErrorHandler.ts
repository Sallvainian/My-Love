/**
 * Offline Error Handling Utilities
 *
 * Provides utilities for detecting offline state, creating offline-aware errors,
 * and handling graceful degradation when network is unavailable.
 *
 * Story 1.5: Task 4 - Graceful Operation Failures (AC-1.5.3)
 *
 * Architecture Pattern (ADR 001 - Online-First):
 * - All operations require network connectivity
 * - Graceful degradation: show cached data, fail writes with retry prompt
 * - No offline queue for writes - fail immediately with retry option
 */

/**
 * Custom error class for offline operation failures
 *
 * Extends standard Error with additional properties for retry handling.
 *
 * @example
 * ```typescript
 * try {
 *   await saveMood();
 * } catch (error) {
 *   if (error instanceof OfflineError) {
 *     showOfflineRetryPrompt(error.operation);
 *   }
 * }
 * ```
 */
export class OfflineError extends Error {
  readonly name = 'OfflineError';
  readonly isRetryable = true;
  readonly operation: string;

  constructor(operation: string, message?: string) {
    const defaultMessage = "You're offline. Please check your connection and try again.";
    super(message || defaultMessage);
    this.operation = operation;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OfflineError);
    }
  }
}

/**
 * Type guard to check if an error is an OfflineError
 */
export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError || (error as OfflineError)?.name === 'OfflineError';
}

/**
 * Check if the device is currently online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Check if the device is currently offline
 */
export function isOffline(): boolean {
  return !isOnline();
}

/**
 * Standard offline error message for user display
 */
export const OFFLINE_ERROR_MESSAGE = "You're offline. Changes will sync when reconnected.";

/**
 * Standard offline error message with retry action
 */
export const OFFLINE_RETRY_MESSAGE = "You're offline. Please check your connection and try again.";

/**
 * Offline error handler result with user-friendly message and retry option
 */
export interface OfflineErrorResult {
  message: string;
  isOffline: boolean;
  canRetry: boolean;
  action?: {
    label: string;
    onRetry: () => void;
  };
}

/**
 * Create a standard offline error handler response
 *
 * @param onRetry - Callback function to retry the operation
 * @returns OfflineErrorResult with message and retry action
 *
 * @example
 * ```typescript
 * const errorResult = createOfflineErrorHandler(() => saveMood());
 * if (errorResult.isOffline) {
 *   showToast(errorResult.message, errorResult.action);
 * }
 * ```
 */
export function createOfflineErrorHandler(onRetry: () => void): OfflineErrorResult {
  return {
    message: OFFLINE_RETRY_MESSAGE,
    isOffline: true,
    canRetry: true,
    action: {
      label: 'Retry',
      onRetry,
    },
  };
}

/**
 * Execute an async operation with offline error handling
 *
 * Checks network status before execution and throws OfflineError if offline.
 * Does NOT automatically save to queue - follows online-first architecture.
 *
 * @param operation - Name of the operation for error messages
 * @param asyncFn - Async function to execute
 * @returns Result of the async function
 * @throws OfflineError if offline, or original error if operation fails
 *
 * @example
 * ```typescript
 * try {
 *   await withOfflineCheck('sync-mood', async () => {
 *     await syncMoodToSupabase(moodEntry);
 *   });
 * } catch (error) {
 *   if (isOfflineError(error)) {
 *     // Show offline retry prompt
 *   }
 * }
 * ```
 */
export async function withOfflineCheck<T>(
  operation: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  // Check network status before executing
  if (isOffline()) {
    if (import.meta.env.DEV) {
      console.log(`[OfflineErrorHandler] Operation "${operation}" blocked - device is offline`);
    }
    throw new OfflineError(operation);
  }

  // Execute the operation
  return asyncFn();
}

/**
 * Wrap an operation to handle offline errors gracefully
 *
 * Returns a result object instead of throwing, suitable for UI components.
 *
 * @param operation - Name of the operation
 * @param asyncFn - Async function to execute
 * @returns Object with success/offline/error status and data/message
 *
 * @example
 * ```typescript
 * const result = await safeOfflineOperation('save-mood', () => saveMood(data));
 * if (result.offline) {
 *   setOfflineMessage(result.message);
 *   setRetryAction(() => result.retry);
 * } else if (result.success) {
 *   showSuccess();
 * } else {
 *   showError(result.error);
 * }
 * ```
 */
export async function safeOfflineOperation<T>(
  _operation: string, // Reserved for future logging/tracking
  asyncFn: () => Promise<T>
): Promise<
  | { success: true; data: T; offline: false }
  | { success: false; offline: true; message: string; retry: () => Promise<T> }
  | { success: false; offline: false; error: Error; message: string }
> {
  // Check offline first
  if (isOffline()) {
    return {
      success: false,
      offline: true,
      message: OFFLINE_RETRY_MESSAGE,
      retry: asyncFn,
    };
  }

  try {
    const data = await asyncFn();
    return {
      success: true,
      data,
      offline: false,
    };
  } catch (error) {
    return {
      success: false,
      offline: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

export default {
  OfflineError,
  isOfflineError,
  isOnline,
  isOffline,
  createOfflineErrorHandler,
  withOfflineCheck,
  safeOfflineOperation,
  OFFLINE_ERROR_MESSAGE,
  OFFLINE_RETRY_MESSAGE,
};
