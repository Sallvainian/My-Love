/**
 * useLoveNotes Hook
 *
 * Custom hook for components to consume Love Notes state from the store.
 * Handles initial fetch, loading states, and exposes actions.
 *
 * Features:
 * - Auto-fetch notes on mount
 * - Pagination support (fetchOlderNotes)
 * - Current user and partner ID access
 * - Real-time subscription for instant message updates (Story 2.3)
 *
 * Story 2.1: Foundation - UI hook for Love Notes chat
 * Story 2.3: Real-time message reception
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { LoveNote } from '../types/models';
import { useRealtimeMessages } from './useRealtimeMessages';

/**
 * Return type for useLoveNotes hook
 */
export interface UseLoveNotesResult {
  /** Array of love notes in chat order (oldest first) */
  notes: LoveNote[];
  /** Whether notes are currently being fetched */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether there are more notes to load */
  hasMore: boolean;
  /** Fetch initial notes (refreshes the list) */
  fetchNotes: () => Promise<void>;
  /** Fetch older notes for pagination */
  fetchOlderNotes: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
  /** Send a new love note with optional image (Story 2.2 + Images) */
  sendNote: (content: string, imageFile?: File) => Promise<void>;
  /** Retry sending a failed message (Story 2.2) */
  retryFailedMessage: (tempId: string) => Promise<void>;
  /** Remove a failed message from the list */
  removeFailedMessage: (tempId: string) => void;
}

/**
 * Custom hook for Love Notes functionality
 *
 * Provides access to notes state and actions from the store.
 * Automatically fetches notes on component mount.
 *
 * @param autoFetch - Whether to automatically fetch notes on mount (default: true)
 * @returns UseLoveNotesResult object with state and actions
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const { notes, isLoading, error, fetchOlderNotes, hasMore } = useLoveNotes();
 *
 *   if (isLoading && notes.length === 0) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return (
 *     <div>
 *       {notes.map(note => <LoveNoteMessage key={note.id} note={note} />)}
 *       {hasMore && <button onClick={fetchOlderNotes}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLoveNotes(autoFetch = true): UseLoveNotesResult {
  // Select state from store
  const notes = useAppStore((state) => state.notes);
  const isLoading = useAppStore((state) => state.notesIsLoading);
  const error = useAppStore((state) => state.notesError);
  const hasMore = useAppStore((state) => state.notesHasMore);

  // Get actions from store
  const fetchNotesAction = useAppStore((state) => state.fetchNotes);
  const fetchOlderNotesAction = useAppStore((state) => state.fetchOlderNotes);
  const clearNotesError = useAppStore((state) => state.clearNotesError);
  const sendNoteAction = useAppStore((state) => state.sendNote);
  const retryFailedMessageAction = useAppStore((state) => state.retryFailedMessage);
  const removeFailedMessageAction = useAppStore((state) => state.removeFailedMessage);
  const cleanupPreviewUrls = useAppStore((state) => state.cleanupPreviewUrls);

  // Memoize fetch functions
  const fetchNotes = useCallback(async () => {
    await fetchNotesAction();
  }, [fetchNotesAction]);

  const fetchOlderNotes = useCallback(async () => {
    await fetchOlderNotesAction();
  }, [fetchOlderNotesAction]);

  const clearError = useCallback(() => {
    clearNotesError();
  }, [clearNotesError]);

  const sendNote = useCallback(async (content: string, imageFile?: File) => {
    await sendNoteAction(content, imageFile);
  }, [sendNoteAction]);

  const retryFailedMessage = useCallback(async (tempId: string) => {
    await retryFailedMessageAction(tempId);
  }, [retryFailedMessageAction]);

  const removeFailedMessage = useCallback((tempId: string) => {
    removeFailedMessageAction(tempId);
  }, [removeFailedMessageAction]);

  // Auto-fetch notes on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNotes();
    }
  }, [autoFetch, fetchNotes]);

  // Cleanup preview URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanupPreviewUrls();
    };
  }, [cleanupPreviewUrls]);

  // Story 2.3: Real-time subscription via dedicated hook
  // Using Broadcast API per useRealtimeMessages implementation
  useRealtimeMessages({ enabled: autoFetch });

  return {
    notes,
    isLoading,
    error,
    hasMore,
    fetchNotes,
    fetchOlderNotes,
    clearError,
    sendNote,
    retryFailedMessage,
    removeFailedMessage,
  };
}

export default useLoveNotes;
