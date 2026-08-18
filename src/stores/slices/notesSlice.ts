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

import { sendEphemeralBroadcast } from '../../api/ephemeralBroadcast';
import { getPartnerId, supabase } from '../../api/supabaseClient';
import { NOTES_CONFIG } from '../../config/images';
import { imageCompressionService } from '../../services/imageCompressionService';
import { deleteLoveNoteImage, uploadCompressedBlob } from '../../services/loveNoteImageService';
import type { LoveNote } from '../../types/models';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

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
  sendNote: (content: string, imageFile?: File) => Promise<void>;
  retryFailedMessage: (tempId: string) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;
  cleanupPreviewUrls: () => void;
  removeFailedMessage: (tempId: string) => void;
}

const { PAGE_SIZE: NOTES_PAGE_SIZE, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS } = NOTES_CONFIG;

/**
 * Helper: Revoke blob URLs from notes to prevent memory leaks
 * Only revokes URLs that start with 'blob:' (not server URLs)
 */
export function revokePreviewUrlsFromNotes(notes: LoveNote[]): void {
  notes.forEach((note) => {
    if (note.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(note.imagePreviewUrl);
    }
  });
}

/**
 * Helper: Best-effort delete of an image whose love_notes row insert failed.
 * Swallows delete errors — the note is already marked failed and the user-facing
 * error must not be masked by a storage cleanup failure.
 */
async function discardOrphanedImage(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteLoveNoteImage(storagePath);
    logger.debug('[NotesSlice] Deleted orphaned image after failed insert:', storagePath);
  } catch (deleteError) {
    console.warn('[NotesSlice] Failed to delete orphaned image:', storagePath, deleteError);
  }
}

/**
 * Helper: discard an uploaded image only once nothing is known to reference it.
 *
 * A failed insert does not mean nothing was written. The defining vector here is
 * the lost response -- the row commits and the reply never arrives -- and in
 * that case the committed note already points at this object, so deleting it
 * leaves a note whose image is permanently broken. The idempotency key is what
 * makes the difference observable: it identifies the row this attempt would
 * have written, whether or not the client got to see it.
 *
 * A lookup that fails counts as "keep". The insert most likely failed because
 * the network did, which is exactly when this check fails too, and the
 * asymmetry matters: an orphaned object costs storage quota, a wrong delete
 * costs the picture.
 */
async function discardUnreferencedImage(
  storagePath: string | null,
  fromUserId: string,
  idempotencyKey: string
): Promise<void> {
  if (!storagePath) return;

  const { data, error } = await supabase
    .from('love_notes')
    .select('image_url')
    .eq('from_user_id', fromUserId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    console.warn(
      '[NotesSlice] Keeping uploaded image: could not check whether a note references it',
      error
    );
    return;
  }

  if (data && (data as { image_url: string | null }).image_url === storagePath) {
    logger.debug('[NotesSlice] Keeping uploaded image: a stored note references it', storagePath);
    return;
  }

  await discardOrphanedImage(storagePath);
}

/**
 * Helper: send a note at most once, however many times this is called.
 *
 * A bare INSERT duplicated the note whenever the row committed but the response
 * was lost — the client saw a failure, offered Retry, and the retry inserted a
 * second identical row. `idempotency_key` is the composed message's `tempId`,
 * which survives retries, so the second attempt collides with the first.
 *
 * ON CONFLICT DO NOTHING (`ignoreDuplicates`), not merge-duplicates: a resend
 * must resolve to what is already stored rather than rewrite it, and
 * love_notes deliberately has no UPDATE policy — granting one to support a
 * merge would also let a user edit notes they had already sent.
 *
 * A conflict returns no row, so the stored one is read back; otherwise the
 * caller would leave its optimistic note stuck in the sending state.
 */
async function insertNoteOnce(payload: {
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
  idempotency_key: string;
}): Promise<{ data: LoveNote | null; error: unknown }> {
  const { data, error } = await supabase
    .from('love_notes')
    .upsert(payload, {
      onConflict: 'from_user_id,idempotency_key',
      ignoreDuplicates: true,
    })
    .select()
    .maybeSingle();

  if (error) return { data: null, error };
  if (data) return { data: data as LoveNote, error: null };

  const existing = await supabase
    .from('love_notes')
    .select()
    .eq('from_user_id', payload.from_user_id)
    .eq('idempotency_key', payload.idempotency_key)
    .single();

  return { data: (existing.data as LoveNote) ?? null, error: existing.error };
}

export const createNotesSlice: AppStateCreator<NotesSlice> = (set, get, _api) => ({
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
      // Cleanup existing preview URLs before fetching new notes
      const { notes: existingNotes } = get();
      revokePreviewUrlsFromNotes(existingNotes);

      set({ notesIsLoading: true, notesError: null });

      // Get authenticated user ID
      const userId = get().userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get partner ID
      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      logger.debug('[NotesSlice] Fetching notes for conversation:', { userId, partnerId, limit });

      // Fetch messages for conversation between user and partner
      const { data, error } = await supabase
        .from('love_notes_visible')
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

      // Identity guard: Sign Out sits on the same screen that fires this, and the
      // request goes out with a still-valid token — so it succeeds and its write
      // lands after clearAuth, putting the previous account's data back.
      if (get().userId !== userId) {
        set({ notesIsLoading: false });
        return;
      }

      set({
        notes: notesInChatOrder,
        notesIsLoading: false,
        notesHasMore: (data?.length || 0) === limit,
      });

      logger.debug('[NotesSlice] Fetched notes:', notesInChatOrder.length);
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
      const userId = get().userId;
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

      logger.debug('[NotesSlice] Fetching older notes before:', oldestNote.created_at);

      // Fetch messages older than the oldest we have
      const { data, error } = await supabase
        .from('love_notes_visible')
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

      // Identity guard, as in fetchNotes above — but this one is worse than the
      // plain case. `notes` was destructured before both awaits, so writing it
      // back restores the messages that were on screen at sign-out as well as
      // the page just fetched: the whole conversation, not one page of it.
      if (get().userId !== userId) {
        set({ notesIsLoading: false });
        return;
      }

      // Re-read rather than reusing the pre-await capture, so a note that
      // arrived over realtime while the page was in flight is not dropped.
      set({
        notes: [...olderNotes, ...get().notes],
        notesIsLoading: false,
        notesHasMore: (data?.length || 0) === limit,
      });

      logger.debug('[NotesSlice] Fetched older notes:', olderNotes.length);
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
        logger.debug('[NotesSlice] Duplicate message ignored:', note.id);
        return state; // No change
      }

      return {
        notes: [...state.notes, note],
      };
    });
  },

  /**
   * Set the entire notes array (for bulk updates)
   * Cleans up preview URLs from replaced notes to prevent memory leaks
   */
  setNotes: (notes) => {
    // Cleanup preview URLs from existing notes before replacing
    const { notes: existingNotes } = get();
    revokePreviewUrlsFromNotes(existingNotes);
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
   * Love Notes Images - Support optional image attachment
   */
  sendNote: async (content: string, imageFile?: File) => {
    try {
      // Check rate limiting
      const { recentTimestamps, now } = get().checkRateLimit();

      // Get authenticated user ID and partner ID
      const userId = get().userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const partnerId = await getPartnerId();
      if (!partnerId) {
        throw new Error('Partner not configured');
      }

      // Generate temporary ID for optimistic update
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // If image provided, validate and prepare preview
      let imagePreviewUrl: string | undefined;
      let imageBlob: Blob | undefined;

      if (imageFile) {
        // Validate image file
        const validation = imageCompressionService.validateImageFile(imageFile);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid image file');
        }
        // Create preview URL for optimistic display
        imagePreviewUrl = URL.createObjectURL(imageFile);
      }

      // Create optimistic note
      const optimisticNote: LoveNote = {
        id: tempId,
        tempId,
        from_user_id: userId,
        to_user_id: partnerId,
        content,
        created_at: new Date().toISOString(),
        sending: true,
        imageUploading: !!imageFile,
        imagePreviewUrl,
      };

      // Optimistic update - add note immediately
      set((state) => ({
        notes: [...state.notes, optimisticNote],
        sentMessageTimestamps: [...recentTimestamps, now],
      }));

      logger.debug('[NotesSlice] Sending note (optimistic):', {
        tempId,
        content,
        hasImage: !!imageFile,
      });

      // Handle image compression and upload if provided
      let storagePath: string | null = null;

      if (imageFile) {
        try {
          // Compress the image
          const compressionResult = await imageCompressionService.compressImage(imageFile);
          imageBlob = compressionResult.blob;

          // Cache the compressed blob for retry flows
          set((state) => ({
            notes: state.notes.map((note) =>
              note.tempId === tempId ? { ...note, imageBlob } : note
            ),
          }));

          // Upload to storage
          const uploadResult = await uploadCompressedBlob(imageBlob, userId);
          storagePath = uploadResult.storagePath;

          logger.debug('[NotesSlice] Image uploaded:', storagePath);
        } catch (imageError) {
          console.error('[NotesSlice] Image upload failed:', imageError);
          // Mark message as failed with image error
          set((state) => ({
            notes: state.notes.map((note) =>
              note.tempId === tempId
                ? { ...note, sending: false, imageUploading: false, error: true, imageBlob }
                : note
            ),
          }));
          return;
        }
      }

      // Background insert to Supabase, keyed so a retry cannot post twice
      const { data, error } = await insertNoteOnce({
        from_user_id: userId,
        to_user_id: partnerId,
        content,
        image_url: storagePath,
        idempotency_key: tempId,
      });

      if (error || !data) {
        // Not unconditional: the row may have committed and only the response
        // been lost, in which case the stored note points at this very object.
        await discardUnreferencedImage(storagePath, userId, tempId);

        // Mark message as failed (preserve imageBlob for retry)
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tempId === tempId
              ? { ...note, sending: false, imageUploading: false, error: true }
              : note
          ),
        }));

        logger.debug('[NotesSlice] Failed to send note:', error);

        return;
      }

      // Success - replace optimistic note with server response
      // Clean up preview URL
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      set((state) => ({
        notes: state.notes.map((note) =>
          note.tempId === tempId
            ? { ...data, sending: false, imageUploading: false, error: false }
            : note
        ),
      }));

      logger.debug('[NotesSlice] Note sent successfully:', data.id);

      // Story 2.3: Broadcast message to partner's channel for realtime delivery
      //
      // Queued per topic. Opening the channel inline here meant that a second
      // note sent before the first one's channel had finished closing was handed
      // that same channel back by supabase.channel(), its subscribe callback
      // never fired, and the note never reached the partner in realtime.
      try {
        await sendEphemeralBroadcast(`love-notes:${partnerId}`, 'new_message', { message: data });
        logger.debug('[NotesSlice] Broadcast sent to partner:', partnerId);
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
   * Love Notes Images - Retry uses cached imageBlob to avoid re-compression
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
            ? { ...note, sending: true, error: false, imageUploading: !!note.imageBlob }
            : note
        ),
      }));

      logger.debug('[NotesSlice] Retrying failed message:', tempId, {
        hasImage: !!failedNote.imageBlob,
      });

      // Get user ID for retry
      const userId = get().userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Handle image upload if cached blob exists (no re-compression needed)
      let storagePath: string | null = null;
      if (failedNote.imageBlob) {
        try {
          const uploadResult = await uploadCompressedBlob(failedNote.imageBlob, userId);
          storagePath = uploadResult.storagePath;

          logger.debug('[NotesSlice] Retry image uploaded:', storagePath);
        } catch (imageError) {
          console.error('[NotesSlice] Retry image upload failed:', imageError);
          set((state) => ({
            notes: state.notes.map((note) =>
              note.tempId === tempId
                ? { ...note, sending: false, imageUploading: false, error: true }
                : note
            ),
          }));
          return;
        }
      }

      // Attempt to send again under the SAME key as the original attempt, so
      // if that attempt actually committed this resolves to it instead of
      // adding a second copy.
      const { data, error } = await insertNoteOnce({
        from_user_id: userId,
        to_user_id: partnerId,
        content: failedNote.content,
        image_url: storagePath,
        idempotency_key: tempId,
      });

      if (error || !data) {
        // Not unconditional: the row may have committed and only the response
        // been lost, in which case the stored note points at this very object.
        await discardUnreferencedImage(storagePath, userId, tempId);

        // Mark as failed again
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tempId === tempId
              ? { ...note, sending: false, imageUploading: false, error: true }
              : note
          ),
        }));

        logger.debug('[NotesSlice] Retry failed:', error);

        return;
      }

      // The retry re-uploaded the image before it knew whether the note needed
      // resending, and the Edge Function mints a fresh storage path every time
      // -- it derives the name server-side and takes no idempotency key. So when
      // insertNoteOnce resolves to a row the first attempt had already
      // committed, that row still points at the ORIGINAL object and the one just
      // uploaded is referenced by nothing.
      //
      // Only the failure path used to clean up, which was right while a retry
      // inserted a second row pointing at the new object. Now that the resend
      // deduplicates, each retry of an image note would otherwise leave one
      // stranded object behind against the user's storage quota.
      if (storagePath && data.image_url !== storagePath) {
        await discardOrphanedImage(storagePath);
      }

      // Success - replace with server response and update rate limit timestamps
      // Clean up preview URL if exists
      if (failedNote.imagePreviewUrl) {
        URL.revokeObjectURL(failedNote.imagePreviewUrl);
      }

      set((state) => ({
        notes: state.notes.map((note) =>
          note.tempId === tempId
            ? { ...data, sending: false, imageUploading: false, error: false }
            : note
        ),
        sentMessageTimestamps: [...recentTimestamps, now],
      }));

      logger.debug('[NotesSlice] Retry successful:', data.id);
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

  /**
   * Remove a note from this user's own history.
   *
   * Not a delete. love_notes holds exactly one row per message and that row is
   * simultaneously the partner's copy, so it is never touched: the removal is a
   * row in love_note_removals, and love_notes_visible -- which both read paths
   * above select from -- anti-joins it. The partner reads the note unchanged.
   *
   * One-way by construction: love_note_removals has no DELETE policy and does
   * not grant the privilege, so there is nothing here to undo against.
   */
  removeNote: async (noteId: string) => {
    const userId = get().userId;
    if (!userId) {
      set({ notesError: 'User not authenticated' });
      return;
    }

    const target = get().notes.find((note) => note.id === noteId);
    if (!target) return;

    // An optimistic note's id IS its tempId (see sendNote), so there is no
    // server row to point at and note_id would reject the `temp-` string. A
    // failed send keeps that id too. The UI does not offer removal in either
    // state; this guards the store for callers that bypass it.
    if (target.tempId) {
      logger.debug('[NotesSlice] Refusing to remove a note with no server row:', noteId);
      return;
    }

    // Drop it before the round trip: the message has to leave the thread as
    // soon as the removal is confirmed, without a reload or a refetch.
    set({ notes: get().notes.filter((note) => note.id !== noteId), notesError: null });

    const { error } = await supabase.from('love_note_removals').upsert(
      { user_id: userId, note_id: noteId },
      { onConflict: 'user_id,note_id', ignoreDuplicates: true }
    );

    // Identity guard, as in fetchNotes above: Sign Out sits on the same screen
    // and the request goes out with a still-valid token, so it succeeds and its
    // write would land after clearAuth.
    if (get().userId !== userId) return;

    if (error) {
      console.error('[NotesSlice] Error removing note:', error);
      // Re-read rather than reusing a pre-await capture, so a note that arrived
      // over realtime while the request was in flight is not dropped by the
      // rollback.
      const current = get().notes;
      set({
        notes: current.some((note) => note.id === noteId)
          ? current
          : [...current, target].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        notesError: 'Failed to remove message',
      });
      return;
    }

    // MessageList early-returns its empty state before the virtualized list
    // whose onRowsRendered is the only caller of onLoadMore, so an emptied
    // window would strand the user on an empty thread with history behind it.
    if (get().notes.length === 0 && get().notesHasMore) {
      await get().fetchNotes();
    }
  },

  /**
   * Cleanup all preview URLs from notes
   * Call on component unmount to prevent memory leaks
   */
  cleanupPreviewUrls: () => {
    const { notes } = get();
    revokePreviewUrlsFromNotes(notes);

    const previewCount = notes.filter((n) => n.imagePreviewUrl?.startsWith('blob:')).length;
    if (previewCount > 0) {
      logger.debug('[NotesSlice] Cleaned up', previewCount, 'preview URLs');
    }
  },

  /**
   * Remove a failed message from the notes array
   * Cleans up any associated preview URLs
   */
  removeFailedMessage: (tempId: string) => {
    const { notes } = get();
    const failedNote = notes.find((n) => n.tempId === tempId);

    if (failedNote?.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(failedNote.imagePreviewUrl);
    }

    set((state) => ({
      notes: state.notes.filter((n) => n.tempId !== tempId),
    }));

    logger.debug('[NotesSlice] Removed failed message:', tempId);
  },
});
