/**
 * useSessionPersistence Hook
 *
 * Manages auto-save, bookmark state (optimistic toggle + debounced server write),
 * and auto-retry on reconnect for the reading flow.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScriptureSession } from '../../../services/dbSchema';
import { useAutoSave } from '../../../hooks/useAutoSave';
import {
  scriptureReadingService,
  handleScriptureError,
  ScriptureErrorCode,
} from '../../../services/scriptureReadingService';
import type { PendingRetry } from '../../../stores/slices/scriptureReadingSlice';

interface UseSessionPersistenceParams {
  session: ScriptureSession | null;
  isOnline: boolean;
  pendingRetry: PendingRetry | null;
  saveSession: () => Promise<void>;
  retryFailedWrite: () => Promise<void>;
}

export function useSessionPersistence({
  session,
  isOnline,
  pendingRetry,
  saveSession,
  retryFailedWrite,
}: UseSessionPersistenceParams) {
  // Story 1.4: Wire useAutoSave
  useAutoSave({ session, saveSession });

  // Story 2.1: Bookmark state (optimistic toggle, per-step)
  const [bookmarkedSteps, setBookmarkedSteps] = useState<Set<number>>(new Set());

  // Story 2.1: Debounce ref for bookmark server write (300ms, last-write-wins)
  const bookmarkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup bookmark debounce on unmount
  useEffect(() => {
    return () => {
      if (bookmarkDebounceRef.current) clearTimeout(bookmarkDebounceRef.current);
    };
  }, []);

  // Track previous isOnline to detect offline → online transitions
  const prevIsOnlineRef = useRef(isOnline);
  const sessionId = session?.id;
  const sessionUserId = session?.userId;

  // Story 1.4: Auto-retry on reconnect (offline → online with pendingRetry)
  useEffect(() => {
    if (
      !prevIsOnlineRef.current &&
      isOnline &&
      pendingRetry &&
      pendingRetry.attempts < pendingRetry.maxAttempts
    ) {
      void retryFailedWrite();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, pendingRetry, retryFailedWrite]);

  // Story 2.1: Load bookmarks for current session on mount/session change
  useEffect(() => {
    if (!sessionId || !sessionUserId) return;
    let isActive = true;
    void (async () => {
      const bookmarks = await scriptureReadingService.getBookmarksBySession(sessionId);
      if (isActive) {
        const userBookmarks = bookmarks.filter((b) => b.userId === sessionUserId);
        setBookmarkedSteps(new Set(userBookmarks.map((b) => b.stepIndex)));
      }
    })();
    return () => {
      isActive = false;
    };
  }, [sessionId, sessionUserId]);

  // Story 2.1: Bookmark toggle handler (optimistic UI immediate, debounced server write)
  const handleBookmarkToggle = useCallback(() => {
    if (!session) return;
    const stepIndex = session.currentStepIndex;
    const sessionId = session.id;
    const userId = session.userId;

    // Optimistic toggle (instant per AC #1)
    setBookmarkedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });

    // Debounce server write (300ms, last-write-wins)
    if (bookmarkDebounceRef.current) {
      clearTimeout(bookmarkDebounceRef.current);
    }
    bookmarkDebounceRef.current = setTimeout(() => {
      bookmarkDebounceRef.current = null;
      void (async () => {
        try {
          await scriptureReadingService.toggleBookmark(sessionId, stepIndex, userId, false);
        } catch (error) {
          handleScriptureError({
            code: ScriptureErrorCode.SYNC_FAILED,
            message: 'Failed to toggle bookmark',
            details: error,
          });
          // Revert optimistic toggle on server failure
          setBookmarkedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(stepIndex)) {
              next.delete(stepIndex);
            } else {
              next.add(stepIndex);
            }
            return next;
          });
        }
      })();
    }, 300);
  }, [session]);

  return {
    bookmarkedSteps,
    handleBookmarkToggle,
  };
}
