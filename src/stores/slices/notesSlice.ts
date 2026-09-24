/**
 * Notes Slice
 *
 * Manages all Love Notes state and actions including:
 * - Notes array (chat messages)
 * - Loading and error states
 * - Pagination support (hasMore)
 *
 * Cross-slice dependencies:
 * - authSlice: every async action captures `userId` + `authSessionVersion`
 *   before its first await and re-checks the pair before every post-await
 *   write. `userId` alone cannot tell a same-account re-sign-in from an
 *   uninterrupted session; `clearAuth` bumps the version on every sign-out.
 *
 * Persistence:
 * - Supabase holds the truth. The device keeps one per-account local copy,
 *   kind `love-notes` (`services/localCopy.ts`): the confirmed server rows the
 *   thread last showed, saved as plain data and read back through a shape
 *   guard; a copy that fails the guard is ignored whole. Pending, failed and
 *   optimistic notes, `imageBlob` and blob `imagePreviewUrl` never go in it.
 * - `fetchNotes` applies the saved copy first — before the partner lookup, and
 *   only into an empty list, until this session has a server answer or a
 *   confirmed change — then replaces state and copy with the server's list. A
 *   failed read changes nothing; an empty answer is saved as `[]`. A failed
 *   read (in `fetchNotes` or `fetchOlderNotes`) leaves `notesError` null
 *   whenever any notes are on screen — from the copy or from an earlier
 *   server answer — so no banner covers the thread; an empty thread, an
 *   unlinked account or a signed-out call still shows the error.
 * - `fetchNotes` is also the kind's refresher, so the thread refreshes on
 *   signed-in start and on reconnect, not only when the Notes screen mounts.
 * - Every confirmed change to the thread — an accepted Realtime note, a
 *   confirmed send or resend, a confirmed removal, an older page — rewrites the
 *   copy from the whole confirmed list. Sending still needs a connection.
 * - Note images are cached separately, per account and storage path, by
 *   `LoveNoteMessage` through `services/imageCache.ts`.
 * - NOT persisted to localStorage. Sign-out deletes the outgoing account's
 *   copies and cached images, and `signedOutState()` resets the state.
 */

import { CHECK_CONSTRAINT_MESSAGE, handleSupabaseError, isPostgrestError } from '../../api/errorHandlers';
import { sendEphemeralBroadcast } from '../../api/ephemeralBroadcast';
import { getPartnerId, lookupPartnerId, supabase } from '../../api/supabaseClient';
import { NOTES_CONFIG } from '../../config/images';
import { imageCompressionService } from '../../services/imageCompressionService';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
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
  /** Note ids whose removal has been applied locally but not yet committed */
  notesPendingRemoval: string[];

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

/** The error an unlinked account sees; a conclusive answer, not a failed read. */
const PARTNER_NOT_CONFIGURED = 'Partner not configured';

/** Local-copy kind for the love-notes thread the screen last showed. */
export const LOVE_NOTES_COPY_KIND = 'love-notes';

/** One saved note: a confirmed server row as plain, structured-cloneable data. */
interface SavedLoveNote {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  /** Storage path, or null for a text-only note. */
  image_url: string | null;
}

/** A confirmed server row: not optimistic, not sending, not failed. */
function isConfirmedNote(note: LoveNote): boolean {
  return !note.tempId && !note.sending && !note.error;
}

function toSavedNote(note: LoveNote): SavedLoveNote {
  return {
    id: note.id,
    from_user_id: note.from_user_id,
    to_user_id: note.to_user_id,
    content: note.content,
    created_at: note.created_at,
    image_url: note.image_url ?? null,
  };
}

function parseSavedNote(value: unknown): LoveNote | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.from_user_id !== 'string' ||
    typeof v.to_user_id !== 'string' ||
    typeof v.content !== 'string' ||
    typeof v.created_at !== 'string' ||
    (v.image_url !== null && typeof v.image_url !== 'string')
  ) {
    return null;
  }
  return {
    id: v.id,
    from_user_id: v.from_user_id,
    to_user_id: v.to_user_id,
    content: v.content,
    created_at: v.created_at,
    image_url: v.image_url,
  };
}

/**
 * A saved copy in a shape the thread can use. The copy is written only by this
 * slice, so one unreadable entry means the whole copy is suspect: ignored.
 */
function parseSavedNotes(value: unknown): LoveNote[] | null {
  if (!Array.isArray(value)) return null;
  const notes: LoveNote[] = [];
  for (const item of value) {
    const parsed = parseSavedNote(item);
    if (!parsed) return null;
    notes.push(parsed);
  }
  return notes;
}

/**
 * Replace the optimistic note `tempId` with its confirmed row. A refresh that
 * landed while the insert was in flight may already hold that row; then the
 * optimistic note is dropped rather than doubled.
 */
function confirmOptimisticNote(notes: LoveNote[], tempId: string, confirmed: LoveNote): LoveNote[] {
  const alreadyListed = notes.some((note) => note.id === confirmed.id && note.tempId !== tempId);
  if (alreadyListed) return notes.filter((note) => note.tempId !== tempId);
  return notes.map((note) =>
    note.tempId === tempId
      ? { ...confirmed, sending: false, imageUploading: false, error: false }
      : note
  );
}

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

export const createNotesSlice: AppStateCreator<NotesSlice> = (set, get, _api) => {
  /**
   * The auth lifetime whose thread already came from the server or a confirmed
   * change. The saved copy is applied only before that, so a copy read landing
   * late never replaces a newer answer. Per slice instance.
   */
  let notesFreshFor: { userId: string; authSessionVersion: number } | null = null;
  const isFresh = (userId: string, authSessionVersion: number) =>
    notesFreshFor?.userId === userId && notesFreshFor.authSessionVersion === authSessionVersion;
  const ownsSession = (userId: string, authSessionVersion: number) =>
    get().userId === userId && get().authSessionVersion === authSessionVersion;

  /**
   * After a server answer or confirmed change for `userId` in
   * `authSessionVersion` has been set into state: mark the session fresh and
   * save the thread's confirmed rows as the copy, under the captured `userId`.
   * Re-checks the identity first; a failed save is logged and changes nothing.
   */
  const saveNotesCopy = async (userId: string, authSessionVersion: number) => {
    if (!ownsSession(userId, authSessionVersion)) return;
    notesFreshFor = { userId, authSessionVersion };
    try {
      await writeLocalCopy(
        userId,
        LOVE_NOTES_COPY_KIND,
        get().notes.filter(isConfirmedNote).map(toSavedNote)
      );
    } catch (error) {
      console.error('[NotesSlice] Failed to save the love-notes copy:', error);
    }
  };

  // The kind's refresher for signed-in start, reconnect and on-demand refreshes.
  // Re-registering (a second store in tests) replaces it.
  registerLocalCopy(LOVE_NOTES_COPY_KIND, async () => {
    if (!get().userId) return;
    await get().fetchNotes();
  });

  return {
    // Initial state
    notes: [],
    notesIsLoading: false,
    notesError: null,
    notesHasMore: true,
    sentMessageTimestamps: [],
    notesPendingRemoval: [],

    // Actions

    /**
     * Fetch notes for the conversation between current user and partner
     *
     * Copy-first: the account's saved thread is shown at once (before the
     * partner lookup), then the server's newest page replaces state and copy.
     * Also the `love-notes` refresher (signed-in start, reconnect).
     *
     * Query: Messages where user is sender OR recipient with partner
     * Order: By created_at DESC (newest first)
     * Pagination: LIMIT (default 50)
     */
    fetchNotes: async (limit = NOTES_PAGE_SIZE) => {
      const { userId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === userId && get().authSessionVersion === requestedInSession;
      // Answers that are not a failed read: today's error stands whatever is shown.
      let conclusiveError = false;

      try {
        set({ notesIsLoading: true, notesError: null });

        if (!userId) {
          conclusiveError = true;
          throw new Error('User not authenticated');
        }

        // The server read goes out at once, alongside the copy read below, so
        // the copy adds no latency. It is marked handled now: it may reject
        // while the copy read is in flight, and is awaited below.
        const serverRequest = (async () => {
          // lookupPartnerId keeps "unlinked" apart from "the read failed":
          // offline the lookup fails, and that must keep the saved thread.
          const lookup = await lookupPartnerId();
          if (lookup.status === 'unlinked') {
            conclusiveError = true;
            throw new Error(PARTNER_NOT_CONFIGURED);
          }
          if (lookup.status === 'error') {
            throw new Error(lookup.reason || 'Failed to fetch notes');
          }
          const partnerId = lookup.partnerId;

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
          return (data || []) as LoveNote[];
        })();
        serverRequest.catch(() => {});

        if (!isFresh(userId, requestedInSession)) {
          // 1. The saved copy, at once — online or offline. Skipped once this
          // session has a server answer or a confirmed change, and never laid
          // over a thread already on screen. readLocalCopy answers null on
          // failure; a malformed copy parses to null and is ignored whole.
          const raw = await readLocalCopy<unknown>(userId, LOVE_NOTES_COPY_KIND);
          // Identity guard: Sign Out sits on the same screen that fires this.
          if (ownsRequest()) {
            const saved = parseSavedNotes(raw);
            if (raw !== null && raw !== undefined && !saved) {
              console.error('[NotesSlice] Ignoring a malformed love-notes copy');
            }
            if (saved && !isFresh(userId, requestedInSession) && get().notes.length === 0) {
              const pendingRemoval = get().notesPendingRemoval;
              set({
                notes: saved.filter((note) => !pendingRemoval.includes(note.id)),
                notesHasMore: saved.length >= NOTES_PAGE_SIZE,
              });
            }
          }
        }

        // 2. The server's page replaces state and copy.
        const rows = await serverRequest;

        // Identity guard: Sign Out sits on the same screen that fires this, and the
        // request goes out with a still-valid token — so it succeeds and its write
        // lands after clearAuth, putting the previous account's data back.
        if (!ownsRequest()) {
          set({ notesIsLoading: false });
          return;
        }

        // Reverse to show oldest first in UI (chat order)
        const pendingRemoval = get().notesPendingRemoval;
        const notesInChatOrder = rows.filter((note) => !pendingRemoval.includes(note.id)).reverse();

        // A note still sending, or failed and offered for retry, has no server
        // row yet: a refresh (reconnect, signed-in start) must not drop it.
        const current = get().notes;
        // Matched on the idempotency key: an optimistic note's id is its tempId,
        // while its committed row has a uuid id and carries the tempId as
        // `idempotency_key` (the view is `select *`).
        const unconfirmed = current.filter(
          (note) =>
            note.tempId &&
            !notesInChatOrder.some(
              (row) => (row as LoveNote & { idempotency_key?: string }).idempotency_key === note.tempId
            )
        );
        revokePreviewUrlsFromNotes(current.filter((note) => !unconfirmed.includes(note)));

        set({
          notes: [...notesInChatOrder, ...unconfirmed],
          notesIsLoading: false,
          notesHasMore: rows.length === limit,
        });
        await saveNotesCopy(userId, requestedInSession);

        logger.debug('[NotesSlice] Fetched notes:', notesInChatOrder.length);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
        console.error('[NotesSlice] Error fetching notes:', error);
        if (!ownsRequest()) {
          set({ notesIsLoading: false });
          return;
        }
        // A failed read changes nothing, and while any notes are on screen (from
        // the copy or an earlier server answer) no banner covers them. An empty
        // thread, an unlinked account or a signed-out call still shows the error.
        const keepThreadClear = !conclusiveError && get().notes.length > 0;
        set({
          notesIsLoading: false,
          notesError: keepThreadClear ? null : errorMessage,
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

      const { userId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === userId && get().authSessionVersion === requestedInSession;
      // Answers that are not a failed read: the error stands whatever is shown.
      let conclusiveError = false;

      try {
        set({ notesIsLoading: true });

        if (!userId) {
          conclusiveError = true;
          throw new Error('User not authenticated');
        }

        // Same split as fetchNotes: offline the lookup fails, which is a failed
        // read, not an unlinked account.
        const lookup = await lookupPartnerId();
        if (lookup.status === 'unlinked') {
          conclusiveError = true;
          throw new Error(PARTNER_NOT_CONFIGURED);
        }
        if (lookup.status === 'error') {
          throw new Error(lookup.reason || 'Failed to fetch older notes');
        }
        const partnerId = lookup.partnerId;

        // Get the oldest message timestamp for pagination
        const oldestNote = notes[0];
        if (!oldestNote) {
          if (!ownsRequest()) return;
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

        // Reverse to maintain chat order (oldest first) and prepend to existing notes.
        // Same in-flight guard as fetchNotes: this page may have been requested
        // before a removal committed and so still contain the removed note.
        const pendingOlderRemoval = get().notesPendingRemoval;
        const olderNotes = ((data || []) as LoveNote[])
          .filter((note) => !pendingOlderRemoval.includes(note.id))
          .reverse();

        // Identity guard, as in fetchNotes above — but this one is worse than the
        // plain case. `notes` was destructured before both awaits, so writing it
        // back restores the messages that were on screen at sign-out as well as
        // the page just fetched: the whole conversation, not one page of it.
        if (!ownsRequest()) {
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
        // The copy keeps the whole confirmed thread, older pages included.
        await saveNotesCopy(userId, requestedInSession);

        logger.debug('[NotesSlice] Fetched older notes:', olderNotes.length);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch older notes';
        console.error('[NotesSlice] Error fetching older notes:', error);
        if (!ownsRequest()) {
          set({ notesIsLoading: false });
          return;
        }
        // Same rule as fetchNotes: a failed read raises no banner over notes
        // already on screen.
        const keepThreadClear = !conclusiveError && get().notes.length > 0;
        set({
          notesIsLoading: false,
          notesError: keepThreadClear ? null : errorMessage,
        });
      }
    },

    /**
     * Add a single note to the list (for optimistic updates / realtime)
     * Includes deduplication check (Story 2.3 Task 2.3.3)
     */
    addNote: (note) => {
      // Captured now, synchronously: the copy is written for this session only.
      const { userId, authSessionVersion } = get();
      let added = false;
      set((state) => {
        // Deduplication: check if message already exists by ID
        const exists = state.notes.some((n) => n.id === note.id);
        if (exists) {
          logger.debug('[NotesSlice] Duplicate message ignored:', note.id);
          return state; // No change
        }

        added = true;
        return {
          notes: [...state.notes, note],
        };
      });

      // Rewrite the copy from the whole confirmed thread (an optimistic note is
      // filtered out there). Session guard as in every other copy write.
      if (added && userId) void saveNotesCopy(userId, authSessionVersion);
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
      const { userId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === userId && get().authSessionVersion === requestedInSession;

      try {
        // Check rate limiting
        const { recentTimestamps, now } = get().checkRateLimit();

        if (!userId) {
          throw new Error('User not authenticated');
        }

        const partnerId = await getPartnerId();
        if (!partnerId) {
          throw new Error('Partner not configured');
        }

        // The session that composed this note has ended: sending now would post
        // a note the signed-in session never showed as sending. Re-checked after
        // every await up to the insert, so a stale send never posts.
        if (!ownsRequest()) return;

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

            // Stop before uploading: signedOutState() dropped the optimistic note.
            if (!ownsRequest()) return;

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
            if (!ownsRequest()) return;
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

          // The session ended during the upload. No insert has run, so nothing
          // references the object just uploaded: remove it rather than post a
          // note the signed-in session never showed as sending.
          if (!ownsRequest()) {
            await discardOrphanedImage(storagePath);
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
          if (!ownsRequest()) return;
          if (isPostgrestError(error) && error.code === '23514') {
            set({ notesError: handleSupabaseError(error).message });
          }

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

        // The note is committed whatever happened to the session meanwhile. The
        // session check guards only the store write; the broadcast below still
        // goes out, because the partner is owed a note the database now holds.
        if (ownsRequest()) {
          if (get().notesError === CHECK_CONSTRAINT_MESSAGE) {
            set({ notesError: null });
          }

          set((state) => ({
            notes: confirmOptimisticNote(state.notes, tempId, data),
          }));
          // Not awaited: the partner broadcast below must not wait on IndexedDB.
          void saveNotesCopy(userId, requestedInSession);
        }

        logger.debug('[NotesSlice] Note sent successfully:', data.id);

        // A different account now holds the session: the private couple topic
        // authorizes the sender's partner link, which belongs to that account,
        // not to the one that wrote this note. Only the same account may send it.
        if (get().userId !== userId) return;

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

        if (!ownsRequest()) return;
        set({ notesError: errorMessage });
      }
    },

    /**
     * Retry sending a failed message
     * Story 2.2 - AC-2.2.4
     * Love Notes Images - Retry uses cached imageBlob to avoid re-compression
     */
    retryFailedMessage: async (tempId: string) => {
      const { userId: capturedUserId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === capturedUserId && get().authSessionVersion === requestedInSession;

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

        if (!ownsRequest()) return;

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
            if (!ownsRequest()) return;
            set((state) => ({
              notes: state.notes.map((note) =>
                note.tempId === tempId
                  ? { ...note, sending: false, imageUploading: false, error: true }
                  : note
              ),
            }));
            return;
          }

          // Same as sendNote: the session ended during the upload, so skip the
          // insert and remove the object nothing references yet.
          if (!ownsRequest()) {
            await discardOrphanedImage(storagePath);
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
          if (!ownsRequest()) return;
          if (isPostgrestError(error) && error.code === '23514') {
            set({ notesError: handleSupabaseError(error).message });
          }

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

        if (!ownsRequest()) return;
        if (get().notesError === CHECK_CONSTRAINT_MESSAGE) {
          set({ notesError: null });
        }

        set((state) => ({
          notes: confirmOptimisticNote(state.notes, tempId, data),
          sentMessageTimestamps: [...recentTimestamps, now],
        }));
        await saveNotesCopy(userId, requestedInSession);

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
      // Every path out of here either removes the note or throws. A resolved
      // promise is the confirmation dialog's success signal -- it closes on one --
      // so returning quietly would dismiss the dialog as though the message were
      // gone when nothing had been recorded.
      const { userId, authSessionVersion: requestedInSession } = get();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const target = get().notes.find((note) => note.id === noteId);
      if (!target) {
        // Reachable whenever the loaded window is replaced while the dialog is
        // open, which the refill below can itself do.
        throw new Error('That message is no longer loaded');
      }

      // An optimistic note's id IS its tempId (see sendNote), so there is no
      // server row to point at and note_id would reject the `temp-` string. A
      // failed send keeps that id too. The UI does not offer removal in either
      // state; this guards the store for callers that bypass it.
      if (target.tempId) {
        logger.debug('[NotesSlice] Refusing to remove a note with no server row:', noteId);
        throw new Error('That message has not finished sending');
      }

      // Drop it before the round trip: the message has to leave the thread as
      // soon as the removal is confirmed, without a reload or a refetch.
      const originalIndex = get().notes.findIndex((note) => note.id === noteId);
      const remaining = get().notes.filter((note) => note.id !== noteId);

      // If this empties the loaded window we go straight into a refill, and
      // MessageList paints its empty state on `!isLoading && notes.length === 0`.
      // Without holding the loading flag the user gets a "No messages to show"
      // flash for the width of the round trip.
      const willEmptyWindow = remaining.length === 0 && get().notesHasMore;

      set({
        notes: remaining,
        notesError: null,
        // A read already in flight -- the mount fetch in useLoveNotes, or a page
        // request -- was issued before this removal commits and will come back
        // with the note still in it. Both read paths drop anything listed here.
        notesPendingRemoval: [...get().notesPendingRemoval, noteId],
        notesIsLoading: willEmptyWindow ? true : get().notesIsLoading,
      });

      const forgetPending = () =>
        get().notesPendingRemoval.filter((id) => id !== noteId);

      const { error } = await supabase.from('love_note_removals').upsert(
        { user_id: userId, note_id: noteId },
        { onConflict: 'user_id,note_id', ignoreDuplicates: true }
      );

      // Identity guard, as in fetchNotes above: Sign Out sits on the same screen
      // and the request goes out with a still-valid token, so it succeeds and its
      // write would land after clearAuth.
      //
      // The flag is half the guard. It was raised before the await when this
      // removal would empty the window, so returning without releasing it strands
      // MessageList on its spinner branch -- notes.length is 0 in exactly that
      // case, so the tab renders nothing else. signedOutState() happens to clear
      // it on sign-out, but setAuthUser (authSlice.ts:145) switches accounts
      // without going through it.
      if (get().userId !== userId || get().authSessionVersion !== requestedInSession) {
        if (willEmptyWindow) set({ notesIsLoading: false });
        return;
      }

      if (error) {
        console.error('[NotesSlice] Error removing note:', error);
        // Re-read rather than reusing a pre-await capture, so a note that arrived
        // over realtime while the request was in flight is not dropped by the
        // rollback. Splice it back where it was rather than re-sorting: server
        // rows carry Postgres timestamptz ('...485294+00:00') while an optimistic
        // note from sendNote carries toISOString ('...485Z'), and the two do not
        // collate against each other -- a whole-second server row sorts after a
        // client note it actually precedes -- so re-sorting could reorder a note
        // that is still sending.
        const current = get().notes;
        let restored = current;
        if (!current.some((note) => note.id === noteId)) {
          restored = [...current];
          restored.splice(Math.min(Math.max(originalIndex, 0), restored.length), 0, target);
        }
        set({
          notes: restored,
          // The thrown error is the single owner of this failure. Also setting
          // notesError would show it twice -- once in the dialog's own alert and
          // once in the page banner at LoveNotes.tsx -- and the banner would
          // outlive the dialog the user then cancels out of.
          notesPendingRemoval: forgetPending(),
          notesIsLoading: willEmptyWindow ? false : get().notesIsLoading,
        });
        // Tell the caller. The confirmation dialog closes on a resolved promise,
        // so swallowing this would dismiss it exactly as on success and leave the
        // user watching the message reappear with no explanation.
        throw error instanceof Error ? error : new Error('Failed to remove message');
      }

      // The removal is confirmed: the copy no longer holds the note.
      await saveNotesCopy(userId, requestedInSession);

      // MessageList early-returns its empty state before the virtualized list
      // whose onRowsRendered is the only caller of onLoadMore, so an emptied
      // window would strand the user on an empty thread with history behind it.
      if (get().notes.length === 0 && get().notesHasMore) {
        await get().fetchNotes();
      } else if (willEmptyWindow) {
        set({ notesIsLoading: false });
      }

      // Deliberately NOT cleared on success. The marker exists for a read whose
      // SELECT was evaluated server-side before this removal committed, and such a
      // read can resolve after this action returns -- both read paths sample the
      // list only after their own await. Clearing here would drop the guard at
      // exactly the moment it is still load-bearing, letting a page that was
      // already in flight prepend the note the user just removed. Note ids are
      // uuids and are never reused, and signedOutState() resets the list, so
      // keeping it costs one string per removal for the session.
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
  };
};
