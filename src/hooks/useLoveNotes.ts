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

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { LoveNote } from '../types/models';
import { supabase } from '../api/supabaseClient';
import { authService } from '../api/authService';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

  // Story 2.3: Real-time subscription for new messages
  // Subscribe to realtime updates for new messages
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addNote = useAppStore((state) => state.addNote);

  useEffect(() => {
    let subscriptionActive = true;

    const setupRealtimeSubscription = async () => {
      try {
        // Get current user ID
        const userId = await authService.getCurrentUserId();
        if (!userId) {
          if (import.meta.env.DEV) {
            console.log('[useLoveNotes] No user ID, skipping realtime subscription');
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[useLoveNotes] Setting up realtime subscription for user:', userId);
        }

        // Create channel for love notes
        const channel = supabase.channel('love-notes-realtime');

        // Subscribe to INSERT events on love_notes table
        // Filter for messages sent TO this user
        channel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'love_notes',
              filter: `to_user_id=eq.${userId}`,
            },
            (payload) => {
              if (!subscriptionActive) return;

              if (import.meta.env.DEV) {
                console.log('[useLoveNotes] New message received:', payload);
              }

              // Add new message to store
              const newNote = payload.new as LoveNote;
              addNote(newNote);

              // Trigger vibration feedback (AC-2.3.3)
              if (navigator.vibrate) {
                navigator.vibrate([30]);
              }
            }
          )
          .subscribe((status) => {
            if (import.meta.env.DEV) {
              console.log('[useLoveNotes] Subscription status:', status);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('[useLoveNotes] Error setting up realtime subscription:', error);
      }
    };

    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      subscriptionActive = false;
      if (channelRef.current) {
        if (import.meta.env.DEV) {
          console.log('[useLoveNotes] Unsubscribing from realtime channel');
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Empty dependency array - set up once on mount

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
