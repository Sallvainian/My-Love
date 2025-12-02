/**
 * Notes Slice
 *
 * Manages all Love Notes state and actions including:
 * - Notes array (chat messages)
 * - Loading and error states
 * - Pagination support (hasMore)
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - Notes loaded from Supabase (not persisted to localStorage)
 * - Will integrate with Supabase Realtime in Story 2.3
 *
 * Story 2.1: Foundation - UI and state management only
 */

import type { StateCreator } from 'zustand';
import type { LoveNote } from '../../types/models';
import { supabase } from '../../api/supabaseClient';
import { authService } from '../../api/authService';
import { getPartnerId } from '../../api/supabaseClient';

export interface NotesSlice {
  // State
  notes: LoveNote[];
  notesIsLoading: boolean;
  notesError: string | null;
  notesHasMore: boolean;

  // Actions
  fetchNotes: (limit?: number) => Promise<void>;
  fetchOlderNotes: (limit?: number) => Promise<void>;
  addNote: (note: LoveNote) => void;
  setNotes: (notes: LoveNote[]) => void;
  setNotesError: (error: string | null) => void;
  clearNotesError: () => void;
}

const NOTES_PAGE_SIZE = 50;

export const createNotesSlice: StateCreator<NotesSlice, [], [], NotesSlice> = (set, get) => ({
  // Initial state
  notes: [],
  notesIsLoading: false,
  notesError: null,
  notesHasMore: true,

  // Actions

  /**
   * Fetch notes for the conversation between current user and partner
   *
   * Query: Messages where user is sender OR recipient with partner
   * Order: By created_at DESC (newest first)
   * Pagination: LIMIT (default 50)
   */
  fetchNotes: async (limit = NOTES_PAGE_SIZE) => {
    try {
      set({ notesIsLoading: true, notesError: null });

      // Get authenticated user ID
      const userId = await authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get partner ID
      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Fetching notes for conversation:', { userId, partnerId, limit });
      }

      // Fetch messages for conversation between user and partner
      const { data, error } = await supabase
        .from('love_notes')
        .select('*')
        .or(
          `and(from_user_id.eq.${userId},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${userId})`
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Reverse to show oldest first in UI (chat order)
      const notesInChatOrder = (data || []).reverse() as LoveNote[];

      set({
        notes: notesInChatOrder,
        notesIsLoading: false,
        notesHasMore: (data?.length || 0) === limit,
      });

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Fetched notes:', notesInChatOrder.length);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
      console.error('[NotesSlice] Error fetching notes:', error);
      set({
        notesIsLoading: false,
        notesError: errorMessage,
      });
    }
  },

  /**
   * Fetch older notes for infinite scroll / pagination
   * Appends to beginning of notes array (older messages)
   */
  fetchOlderNotes: async (limit = NOTES_PAGE_SIZE) => {
    const { notes, notesIsLoading, notesHasMore } = get();

    // Don't fetch if already loading or no more to load
    if (notesIsLoading || !notesHasMore) {
      return;
    }

    try {
      set({ notesIsLoading: true });

      // Get authenticated user ID
      const userId = await authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get partner ID
      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      // Get the oldest message timestamp for pagination
      const oldestNote = notes[0];
      if (!oldestNote) {
        set({ notesIsLoading: false, notesHasMore: false });
        return;
      }

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Fetching older notes before:', oldestNote.created_at);
      }

      // Fetch messages older than the oldest we have
      const { data, error } = await supabase
        .from('love_notes')
        .select('*')
        .or(
          `and(from_user_id.eq.${userId},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${userId})`
        )
        .lt('created_at', oldestNote.created_at)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Reverse to maintain chat order (oldest first) and prepend to existing notes
      const olderNotes = (data || []).reverse() as LoveNote[];

      set({
        notes: [...olderNotes, ...notes],
        notesIsLoading: false,
        notesHasMore: (data?.length || 0) === limit,
      });

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Fetched older notes:', olderNotes.length);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch older notes';
      console.error('[NotesSlice] Error fetching older notes:', error);
      set({
        notesIsLoading: false,
        notesError: errorMessage,
      });
    }
  },

  /**
   * Add a single note to the list (for optimistic updates / realtime)
   */
  addNote: (note) => {
    set((state) => ({
      notes: [...state.notes, note],
    }));
  },

  /**
   * Set the entire notes array (for bulk updates)
   */
  setNotes: (notes) => {
    set({ notes });
  },

  /**
   * Set error state
   */
  setNotesError: (error) => {
    set({ notesError: error });
  },

  /**
   * Clear error state
   */
  clearNotesError: () => {
    set({ notesError: null });
  },
});
