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
 *
 * Story 2.1: Foundation - UI hook for Love Notes chat
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { LoveNote } from '../types/models';

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
  /** Send a new love note (Story 2.2) */
  sendNote: (content: string) => Promise<void>;
  /** Retry sending a failed message (Story 2.2) */
  retryFailedMessage: (tempId: string) => Promise<void>;
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

  const sendNote = useCallback(async (content: string) => {
    await sendNoteAction(content);
  }, [sendNoteAction]);

  const retryFailedMessage = useCallback(async (tempId: string) => {
    await retryFailedMessageAction(tempId);
  }, [retryFailedMessageAction]);

  // Auto-fetch notes on mount
  useEffect(() => {
    if (autoFetch) {
      fetchNotes();
    }
  }, [autoFetch, fetchNotes]);

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
  };
}

export default useLoveNotes;
