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
  sentMessageTimestamps: number[]; // For rate limiting

  // Actions
  fetchNotes: (limit?: number) => Promise<void>;
  fetchOlderNotes: (limit?: number) => Promise<void>;
  addNote: (note: LoveNote) => void;
  setNotes: (notes: LoveNote[]) => void;
  setNotesError: (error: string | null) => void;
  clearNotesError: () => void;
  checkRateLimit: () => { recentTimestamps: number[]; now: number };
  sendNote: (content: string) => Promise<void>;
  retryFailedMessage: (tempId: string) => Promise<void>;
}

const NOTES_PAGE_SIZE = 50;
const RATE_LIMIT_MAX_MESSAGES = 10;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

export const createNotesSlice: StateCreator<NotesSlice, [], [], NotesSlice> = (set, get) => ({
  // Initial state
  notes: [],
  notesIsLoading: false,
  notesError: null,
  notesHasMore: true,
  sentMessageTimestamps: [],

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
   * Includes deduplication check (Story 2.3 Task 2.3.3)
   */
  addNote: (note) => {
    set((state) => {
      // Deduplication: check if message already exists by ID
      const exists = state.notes.some((n) => n.id === note.id);
      if (exists) {
        if (import.meta.env.DEV) {
          console.log('[NotesSlice] Duplicate message ignored:', note.id);
        }
        return state; // No change
      }

      return {
        notes: [...state.notes, note],
      };
    });
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

  /**
   * Helper: Check rate limiting and return filtered timestamps
   * Throws error if rate limit exceeded
   */
  checkRateLimit: () => {
    const { sentMessageTimestamps } = get();
    const now = Date.now();
    const recentTimestamps = sentMessageTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      throw new Error('Rate limit exceeded: Maximum 10 messages per minute');
    }

    return { recentTimestamps, now };
  },

  /**
   * Send a new love note with optimistic updates
   * Story 2.2 - AC-2.2.2, AC-2.2.3
   */
  sendNote: async (content: string) => {
    try {
      // Check rate limiting
      const { recentTimestamps, now } = get().checkRateLimit();

      // Get authenticated user ID and partner ID
      const userId = await authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      // Generate temporary ID for optimistic update
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create optimistic note
      const optimisticNote: LoveNote = {
        id: tempId,
        tempId,
        from_user_id: userId,
        to_user_id: partnerId,
        content,
        created_at: new Date().toISOString(),
        sending: true,
      };

      // Optimistic update - add note immediately
      set((state) => ({
        notes: [...state.notes, optimisticNote],
        sentMessageTimestamps: [...recentTimestamps, now],
      }));

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Sending note (optimistic):', { tempId, content });
      }

      // Background insert to Supabase
      const { data, error } = await supabase
        .from('love_notes')
        .insert({
          from_user_id: userId,
          to_user_id: partnerId,
          content,
        })
        .select()
        .single();

      if (error) {
        // Mark message as failed
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tempId === tempId
              ? { ...note, sending: false, error: true }
              : note
          ),
        }));

        if (import.meta.env.DEV) {
          console.error('[NotesSlice] Failed to send note:', error);
        }

        return;
      }

      // Success - replace optimistic note with server response
      set((state) => ({
        notes: state.notes.map((note) =>
          note.tempId === tempId
            ? { ...data, sending: false, error: false }
            : note
        ),
      }));

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Note sent successfully:', data.id);
      }

      // Story 2.3: Broadcast message to partner's channel for realtime delivery
      try {
        const channel = supabase.channel(`love-notes:${partnerId}`);
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: { message: data },
        });

        if (import.meta.env.DEV) {
          console.log('[NotesSlice] Broadcast sent to partner:', partnerId);
        }
      } catch (broadcastError) {
        // Non-fatal - message is saved, just realtime failed
        console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send note';
      console.error('[NotesSlice] Error sending note:', error);

      // If it's a rate limit error, throw it up
      if (errorMessage.includes('Rate limit')) {
        throw error;
      }

      set({ notesError: errorMessage });
    }
  },

  /**
   * Retry sending a failed message
   * Story 2.2 - AC-2.2.4
   */
  retryFailedMessage: async (tempId: string) => {
    try {
      // Check rate limiting before retry
      const { recentTimestamps, now } = get().checkRateLimit();

      const { notes } = get();

      // Find the failed message
      const failedNote = notes.find((note) => note.tempId === tempId);
      if (!failedNote) {
        throw new Error('Message not found');
      }

      // Get partner ID
      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      // Mark as sending again
      set((state) => ({
        notes: state.notes.map((note) =>
          note.tempId === tempId
            ? { ...note, sending: true, error: false }
            : note
        ),
      }));

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Retrying failed message:', tempId);
      }

      // Get user ID for retry
      const userId = await authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Attempt to send again
      const { data, error } = await supabase
        .from('love_notes')
        .insert({
          from_user_id: userId,
          to_user_id: partnerId,
          content: failedNote.content,
        })
        .select()
        .single();

      if (error) {
        // Mark as failed again
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tempId === tempId
              ? { ...note, sending: false, error: true }
              : note
          ),
        }));

        if (import.meta.env.DEV) {
          console.error('[NotesSlice] Retry failed:', error);
        }

        return;
      }

      // Success - replace with server response and update rate limit timestamps
      set((state) => ({
        notes: state.notes.map((note) =>
          note.tempId === tempId
            ? { ...data, sending: false, error: false }
            : note
        ),
        sentMessageTimestamps: [...recentTimestamps, now],
      }));

      if (import.meta.env.DEV) {
        console.log('[NotesSlice] Retry successful:', data.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry message';
      console.error('[NotesSlice] Error retrying message:', error);

      // If it's a rate limit error, throw it up
      if (errorMessage.includes('Rate limit')) {
        throw error;
      }

      throw error;
    }
  },
});
