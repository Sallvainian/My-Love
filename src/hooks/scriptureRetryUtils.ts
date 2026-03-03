/**
 * Shared retry utilities for scripture realtime hooks.
 *
 * Both useScriptureBroadcast and useScripturePresence use the same bounded
 * retry with exponential backoff pattern, matching useRealtimeMessages.
 */

import type { Dispatch, SetStateAction } from 'react';

export const SCRIPTURE_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * Schedules a bounded retry with exponential backoff.
 * Returns false if max retries exceeded (caller handles "give up").
 * Stores the timer ID in retryTimerRef so callers can cancel on unmount.
 */
export function scheduleRetry(
  retryCountRef: { current: number },
  setRetryCount: Dispatch<SetStateAction<number>>,
  retryTimerRef: { current: ReturnType<typeof setTimeout> | null },
  config: typeof SCRIPTURE_RETRY_CONFIG = SCRIPTURE_RETRY_CONFIG
): boolean {
  if (retryCountRef.current >= config.maxRetries) return false;
  const delay = Math.min(
    config.baseDelay * Math.pow(2, retryCountRef.current),
    config.maxDelay
  );
  retryCountRef.current++;
  retryTimerRef.current = setTimeout(() => setRetryCount((c) => c + 1), delay);
  return true;
}
