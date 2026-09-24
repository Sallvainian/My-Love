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
 *   The refresher keeps the older pages its page joins onto; the mount
 *   fetch replaces the thread with the newest page.
 * - Every confirmed change to the thread — an accepted Realtime note, a
 *   confirmed send or resend, a confirmed removal, an older page — rewrites the
 *   copy from the whole confirmed list.
 *
 * Sending:
 * - Every text-only note goes into the per-account send queue
 *   (`services/noteQueue.ts`) before it is sent, online or offline, and shows
 *   at once as a `queued` note. `drainQueuedNotes` sends the queue in order,
 *   one note at a time, under `withSyncLock(NOTE_QUEUE_LOCK)`, reusing each
 *   note's `tempId` as `idempotency_key`. It runs after each enqueue, and from
 *   `App.tsx` on start, on the `online` event and on the 5-minute interval.
 *   A pass that stops on a transient failure while online is retried after
 *   5 s, 10 s, 20 s, 40 s, then every 60 s, one timer at a time, until a pass
 *   completes; a change of account or session cancels the timer.
 *   A drain that finds the lock held waits for its holder, then passes again.
 *   After each pass, a queued note on screen whose row has left the queue
 *   (another tab of the account sent it) is confirmed from its stored row, and
 *   one whose row another tab marked rejected is shown failed, with Retry.
 * - Each queued note is sent with its row's `createdAt` as `written_at`, so a
 *   note delivered late still shows when it was written. `created_at` stays
 *   the server's delivery time and alone orders and pages the thread.
 * - The recipient is fixed at enqueue: the loaded `partner`, else a
 *   `lookupPartnerId()` that must answer `linked`. A queued note is never sent
 *   after a fresh partner lookup.
 * - A server rejection (a SQLSTATE code) marks the queued note failed and the
 *   drain moves on; any other failure leaves it pending and ends the run.
 *   Retry clears the mark and drains; removing a failed note deletes its row.
 * - `fetchNotes` shows the account's queued notes before its server read, so
 *   they survive a reload offline. They never go in the local copy.
 * - A note with a picture keeps the direct send path and needs a connection;
 *   offline it is refused before anything is shown or uploaded. A confirmed
 *   send or resend of any note is broadcast to the partner.
 * - Note images are cached separately, per account and storage path, by
 *   `LoveNoteMessage` through `services/imageCache.ts`. A confirmed
 *   `removeNote` deletes that note's cached image.
 * - NOT persisted to localStorage. Sign-out deletes the outgoing account's
 *   copies and cached images, and `signedOutState()` resets the state. Its
 *   queued notes stay, and send when that account signs back in.
 */

import { CHECK_CONSTRAINT_MESSAGE, handleSupabaseError, isPostgrestError } from '../../api/errorHandlers';
import { sendEphemeralBroadcast } from '../../api/ephemeralBroadcast';
import { getPartnerId, lookupPartnerId, supabase } from '../../api/supabaseClient';
import { NOTES_CONFIG } from '../../config/images';
import { offlineMessage } from '../../services/accountDataError';
import { deleteCachedImages } from '../../services/imageCache';
import { imageCompressionService } from '../../services/imageCompressionService';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import { deleteLoveNoteImage, uploadCompressedBlob } from '../../services/loveNoteImageService';
import {
  enqueueNote,
  listQueuedNotes,
  removeQueuedNote,
  setQueuedNoteFailed,
  type QueuedNote,
} from '../../services/noteQueue';
import { NOTE_QUEUE_LOCK, waitForSyncLock, withSyncLock } from '../../services/syncLock';
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
  fetchNotes: (limit?: number, options?: { keepOlder?: boolean }) => Promise<void>;
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
  /** Throws unless the note is still failed and no Retry is in flight. */
  removeFailedMessage: (tempId: string) => void;
  /** Send the signed-in account's queued notes, oldest first. Never throws. */
  drainQueuedNotes: () => Promise<void>;
}

const { PAGE_SIZE: NOTES_PAGE_SIZE, RATE_LIMIT_MAX_MESSAGES, RATE_LIMIT_WINDOW_MS } = NOTES_CONFIG;

/** The error an unlinked account sees; a conclusive answer, not a failed read. */
const PARTNER_NOT_CONFIGURED = 'Partner not configured';

/** The refusal for a note with a picture while the device is offline. */
export const IMAGE_NOTE_NEEDS_CONNECTION = offlineMessage('Notes with a picture', 'send');

/** The refusal for a thread load while the device is offline. */
const NOTES_LOAD_NEEDS_CONNECTION = offlineMessage('Love notes', 'load');

/** The refusal for a text note that has no loaded partner while offline. */
const NOTES_SEND_NEEDS_CONNECTION = offlineMessage('Love notes', 'send');

/** The refusal for removing a note while the device is offline. */
const NOTES_REMOVE_NEEDS_CONNECTION = offlineMessage('Love notes', 'remove');

/**
 * Thrown out of `sendNote` rather than shown as `notesError`: the composer
 * catches it, keeps what was typed and shows its own error.
 */
class NoteNotAcceptedError extends Error {}

/**
 * The note was refused up front because the device is offline. The slice has
 * already put the reason in `notesError`, so the composer keeps what was
 * typed and shows nothing of its own — one message per failure.
 */
export class NoteRefusedOfflineError extends NoteNotAcceptedError {}

/** What one drain pass ended on (see `drainOnce`). */
type DrainPassOutcome = 'done' | 'transient' | 'stale';

/**
 * After a pass stops on a transient failure while online, the drain runs
 * again after 5 s, 10 s, 20 s and 40 s, then every 60 s, until a pass
 * completes. Offline, the `online` event triggers it instead.
 */
const NOTE_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000];
const NOTE_RETRY_MAX_DELAY_MS = 60_000;

/** `navigator.onLine` says the device is offline for certain. */
function knownOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * SQLSTATEs that say "try again later", not "never": connection exceptions
 * (08), transaction rollbacks such as serialization failure or deadlock (40),
 * insufficient resources (53), operator intervention including statement
 * timeout 57014 (57), and lock not available (55P03).
 */
const TRANSIENT_SQLSTATE_CLASSES = ['08', '40', '53', '57'];
const TRANSIENT_SQLSTATES = ['55P03'];

/**
 * The server looked at the insert and refused it for good: a Postgrest error
 * whose code is a SQLSTATE (CHECK, RLS, …) outside the transient classes. A
 * `PGRST…` code, an empty code (a fetch that never reached the server), a
 * transient SQLSTATE or anything else is not a rejection.
 */
function isServerRejection(error: unknown): boolean {
  if (!isPostgrestError(error)) return false;
  const code: unknown = error.code;
  if (typeof code !== 'string' || code.startsWith('PGRST') || !/^[0-9A-Z]{5}$/.test(code)) {
    return false;
  }
  return !TRANSIENT_SQLSTATE_CLASSES.includes(code.slice(0, 2)) && !TRANSIENT_SQLSTATES.includes(code);
}

/** A queued row as an unconfirmed note in the thread. */
function queuedToNote(row: QueuedNote): LoveNote {
  return {
    id: row.id,
    tempId: row.id,
    from_user_id: row.userId,
    to_user_id: row.toUserId,
    content: row.content,
    created_at: row.createdAt,
    sending: false,
    error: row.failed,
    queued: true,
  };
}

/** The key a note was composed with: its tempId, or a committed row's idempotency_key. */
function composedKey(note: LoveNote): string | undefined {
  return note.tempId ?? (note as LoveNote & { idempotency_key?: string }).idempotency_key;
}

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
  /**
   * When the sender wrote it, or null. Absent from a copy saved before the
   * column existed, which still parses.
   */
  written_at?: string | null;
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
    written_at: note.written_at ?? null,
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
    (v.image_url !== null && typeof v.image_url !== 'string') ||
    (v.written_at !== undefined && v.written_at !== null && typeof v.written_at !== 'string')
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
    ...(typeof v.written_at === 'string' ? { written_at: v.written_at } : null),
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
  /** Composition time of a queued note; the server NULLs an impossible one. */
  written_at?: string;
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

export const createNotesSlice: AppStateCreator<NotesSlice> = (set, get, api) => {
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

  /**
   * Which load last raised `notesIsLoading`. A load that drops its own answer
   * clears the flag only while it still holds it, so it never hides the
   * spinner of a load started after it. Per slice instance.
   */
  let notesLoadTicket = 0;

  /**
   * Retries in flight, by tempId. A retry keeps its note marked failed until
   * its first await returns (the queue row's reset, or the partner lookup), so
   * the note's own flags cannot tell `removeFailedMessage` that a resend is
   * already under way. Counted, so two taps of Retry release it only when
   * both are done. Per slice instance.
   */
  const retriesInFlight = new Map<string, number>();

  /**
   * Bumped whenever the thread's oldest note changes by anything but a removal:
   * a fetch or copy that replaces the thread, or an older page prepended. An
   * older page requested below one oldest note lands only while that is still
   * the generation, so it never leaves a hole or doubles a page. A removal
   * keeps it, because the page still joins onto the notes after the one
   * removed. Per slice instance.
   */
  let notesThreadGen = 0;

  /**
   * The auth lifetime whose `notesHasMore` was last set by a server read, not
   * guessed from the saved copy's length. Only a server answer is kept when a
   * refresh keeps older pages. Per slice instance.
   */
  let hasMoreFromServerFor: { userId: string; authSessionVersion: number } | null = null;
  const hasMoreFromServer = (userId: string, authSessionVersion: number) =>
    hasMoreFromServerFor?.userId === userId &&
    hasMoreFromServerFor.authSessionVersion === authSessionVersion;

  // The kind's refresher for signed-in start, reconnect and on-demand refreshes.
  // It keeps the older pages the user scrolled back through; a reconnect must
  // not cut the thread back to its newest page. Re-registering (a second store
  // in tests) replaces it.
  registerLocalCopy(LOVE_NOTES_COPY_KIND, async () => {
    if (!get().userId) return;
    await get().fetchNotes(NOTES_PAGE_SIZE, { keepOlder: true });
  });

  /** Patch the note composed as `tempId`, if it is in the thread. */
  const patchNote = (tempId: string, patch: Partial<LoveNote>) => {
    set((state) => ({
      notes: state.notes.map((note) => (note.tempId === tempId ? { ...note, ...patch } : note)),
    }));
  };

  /**
   * No drain is sending from this tab (offline, a pass just ended, or another
   * context holds the queue): every queued note on screen is waiting, not
   * sending.
   */
  const settleWaitingNotes = () => {
    if (!get().notes.some((note) => note.queued && note.sending)) return;
    set((state) => ({
      notes: state.notes.map((note) =>
        note.queued && note.sending ? { ...note, sending: false } : note
      ),
    }));
  };

  /**
   * Another tab of the same account drains the same queue, so it may send a
   * queued note this tab shows and delete its row; nothing tells this tab (the
   * broadcast goes to the partner only). A queued note on screen whose row has
   * left the queue is looked up by its key and confirmed if stored. A row that
   * is gone but was never stored, an unreadable queue or a failed lookup
   * leaves the note as it is. Runs after this tab's own pass, so no drain here
   * is sending one of these notes meanwhile.
   *
   * The other tab may instead have had the note rejected: its row is still
   * queued, marked `failed`. The note is then marked failed here too, as
   * `drainOnce` marks its own rejections, so it offers Retry. No banner: the
   * row does not record why it was refused, and `drainOnce` raises one only
   * for a CHECK violation (in the tab that saw the code).
   */
  const confirmNotesSentElsewhere = async () => {
    const { userId, authSessionVersion } = get();
    if (!userId) return;
    const onScreen = get().notes.filter(
      (note) => note.queued && note.tempId && note.from_user_id === userId
    );
    if (onScreen.length === 0) return;
    // Read after the notes: a row is enqueued before its note is shown.
    const queuedRows = await listQueuedNotes(userId);
    const queuedKeys = new Set(queuedRows.map((row) => row.id));

    // Before any lookup below awaits, so a Retry pressed meanwhile (which
    // clears the row's mark first) is not overwritten by this older read.
    const rejectedKeys = new Set(queuedRows.filter((row) => row.failed).map((row) => row.id));
    const rejectedOnScreen = (note: LoveNote) =>
      note.queued === true && !note.error && !!note.tempId && rejectedKeys.has(note.tempId);
    if (rejectedKeys.size > 0 && ownsSession(userId, authSessionVersion)) {
      if (get().notes.some(rejectedOnScreen)) {
        set((state) => ({
          notes: state.notes.map((note) =>
            rejectedOnScreen(note) ? { ...note, sending: false, error: true } : note
          ),
        }));
        logger.debug('[NotesSlice] Queued note was rejected in another tab');
      }
    }

    for (const note of onScreen) {
      const tempId = note.tempId!;
      if (queuedKeys.has(tempId)) continue;
      if (!ownsSession(userId, authSessionVersion)) return;
      try {
        const { data, error } = await supabase
          .from('love_notes')
          .select()
          .eq('from_user_id', userId)
          .eq('idempotency_key', tempId)
          .maybeSingle();
        if (error || !data) continue;
        if (!ownsSession(userId, authSessionVersion)) return;
        set((state) => ({ notes: confirmOptimisticNote(state.notes, tempId, data as LoveNote) }));
        void saveNotesCopy(userId, authSessionVersion);
        logger.debug('[NotesSlice] Queued note was sent by another tab:', (data as LoveNote).id);
      } catch (error) {
        logger.debug('[NotesSlice] Could not look up a queued note:', error);
      }
    }
  };

  /**
   * One pass over the signed-in account's queue, holding NOTE_QUEUE_LOCK.
   * Sends the oldest pending row, then re-reads the queue, so a note enqueued
   * during the run is still sent. Each row is tried at most once per pass.
   * Answers `done` when every pending row was tried and none failed
   * transiently, `transient` when it stopped on a transient failure, and
   * `stale` when there is no session or it ended during the pass.
   */
  const drainOnce = async (): Promise<DrainPassOutcome> => {
    const { userId, authSessionVersion } = get();
    if (!userId) return 'stale';
    const owns = () => ownsSession(userId, authSessionVersion);
    const tried = new Set<string>();
    // A CHECK banner this pass raised stays up while later notes send: it
    // belongs to a note still showing Retry.
    let raisedCheckBanner = false;

    for (;;) {
      const next = (await listQueuedNotes(userId)).find(
        (row) => !row.failed && !tried.has(row.id)
      );
      if (!next) return 'done';
      // Re-checked before the insert: a stale session sends nothing.
      if (!owns()) return 'stale';
      tried.add(next.id);
      patchNote(next.id, { sending: true, error: false });

      let result: { data: LoveNote | null; error: unknown };
      try {
        result = await insertNoteOnce({
          from_user_id: userId,
          to_user_id: next.toUserId,
          content: next.content,
          image_url: null,
          idempotency_key: next.id,
          // When it was written, so a note sent late still shows that time.
          written_at: next.createdAt,
        });
      } catch (error) {
        result = { data: null, error };
      }
      const { data, error } = result;

      if (data) {
        // The note is committed whatever happened to the session meanwhile.
        try {
          await removeQueuedNote(next.id);
        } catch (removeError) {
          // The next drain resolves the same key to the stored row.
          console.error('[NotesSlice] Failed to remove a sent note from the queue:', removeError);
        }
        if (owns()) {
          // Only a note the thread showed goes into the copy: a drain before
          // the thread is loaded must not write [] over the saved copy.
          const wasShown = get().notes.some((note) => note.tempId === next.id);
          if (!raisedCheckBanner && get().notesError === CHECK_CONSTRAINT_MESSAGE) {
            set({ notesError: null });
          }
          set((state) => ({ notes: confirmOptimisticNote(state.notes, next.id, data) }));
          if (wasShown) void saveNotesCopy(userId, authSessionVersion);
        }
        logger.debug('[NotesSlice] Queued note sent:', data.id);

        // Same rule as sendNote: only the same account may broadcast it.
        if (get().userId === userId) {
          try {
            await sendEphemeralBroadcast(`love-notes:${next.toUserId}`, 'new_message', {
              message: data,
            });
          } catch (broadcastError) {
            console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
          }
        }
        continue;
      }

      if (isServerRejection(error)) {
        // Only a Retry sends it again; the rows after it still go.
        try {
          await setQueuedNoteFailed(next.id, true);
        } catch (markError) {
          console.error('[NotesSlice] Failed to mark a queued note failed:', markError);
        }
        if (!owns()) return 'stale';
        if (isPostgrestError(error) && error.code === '23514') {
          set({ notesError: handleSupabaseError(error).message });
          raisedCheckBanner = true;
        }
        patchNote(next.id, { sending: false, error: true });
        logger.debug('[NotesSlice] Queued note rejected:', error);
        continue;
      }

      // Anything else (offline, timeout, expired token): keep the row pending
      // and stop; order is kept, and the next trigger retries it.
      if (!owns()) return 'stale';
      patchNote(next.id, { sending: false });
      logger.debug('[NotesSlice] Queued note not sent; retrying later:', error);
      return 'transient';
    }
  };

  /**
   * The retry after a pass stops on a transient failure while online, so a
   * note does not wait for the `online` event or the 5-minute interval. One
   * timer at a time; `retryAttempt` picks its delay from NOTE_RETRY_DELAYS_MS
   * and resets on a completed pass. `retryFor` is the session it was set for:
   * any change of account or session cancels it (the subscription below), and
   * a timer that fires anyway re-checks the session before draining.
   */
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;
  let retryFor: { userId: string; authSessionVersion: number } | null = null;

  const cancelDrainRetry = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    retryFor = null;
    retryAttempt = 0;
  };

  const scheduleDrainRetry = (userId: string, authSessionVersion: number) => {
    if (retryTimer !== null) return;
    const delay = NOTE_RETRY_DELAYS_MS[retryAttempt] ?? NOTE_RETRY_MAX_DELAY_MS;
    retryAttempt += 1;
    retryFor = { userId, authSessionVersion };
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!ownsSession(userId, authSessionVersion)) return;
      void get().drainQueuedNotes();
    }, delay);
    logger.debug('[NotesSlice] Queued notes retry in', delay, 'ms');
  };

  // Sign-out (`discardAccountState`) and an account switch both change the
  // identity in one set(); the pending retry belongs to the old one.
  api.subscribe((state) => {
    if (
      retryFor &&
      (state.userId !== retryFor.userId || state.authSessionVersion !== retryFor.authSessionVersion)
    ) {
      cancelDrainRetry();
    }
  });

  /**
   * The drain running in this tab, if any. A drain asked for while one runs
   * joins it and makes it pass over the queue once more, so a note enqueued
   * just as the run was finishing is not left for the next trigger.
   */
  let drainInFlight: Promise<void> | null = null;
  let drainRequested = false;
  /** True while the drain waits for another tab to let go of the queue. */
  let waitingForLock = false;

  /**
   * The queue is sent in `createdAt` order, and two notes composed within one
   * millisecond would tie (then sort by their random tempId). Each queued note
   * gets a time strictly after the previous one's. Per slice instance.
   */
  let lastQueuedAt = 0;
  const nextQueuedAt = () => {
    lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
    return new Date(lastQueuedAt).toISOString();
  };

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
     * Also the `love-notes` refresher (signed-in start, reconnect), which
     * passes `keepOlder`: when the page joins onto the thread on screen, the
     * older pages before it are kept rather than replaced.
     *
     * Query: Messages where user is sender OR recipient with partner
     * Order: By created_at DESC (newest first)
     * Pagination: LIMIT (default 50)
     */
    fetchNotes: async (limit = NOTES_PAGE_SIZE, options) => {
      const { userId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === userId && get().authSessionVersion === requestedInSession;
      // Answers that are not a failed read: today's error stands whatever is shown.
      let conclusiveError = false;

      try {
        set({ notesIsLoading: true, notesError: null });
        notesLoadTicket += 1;

        if (!userId) {
          conclusiveError = true;
          throw new Error('User not authenticated');
        }

        // The server read goes out at once, alongside the copy read below, so
        // the copy adds no latency. It is marked handled now: it may reject
        // while the copy read is in flight, and is awaited below.
        const serverRequest = (async () => {
          // Known offline: no request goes out. The saved thread still shows,
          // and the reason shows only over an empty thread (keepThreadClear).
          if (knownOffline()) throw new Error(NOTES_LOAD_NEEDS_CONNECTION);
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
              // A guess from the copy's length, not a server answer.
              hasMoreFromServerFor = null;
              notesThreadGen += 1;
            }
          }
        }

        // 1b. The account's queued notes, before the server answers, so they
        // show after a reload even offline. listQueuedNotes answers [] on
        // failure. A note already on screen, or already confirmed there (a
        // drain may have just sent it), is not added twice.
        const queuedRows = await listQueuedNotes(userId);
        if (queuedRows.length > 0 && ownsRequest()) {
          const onScreen = get().notes;
          const shownKeys = new Set(onScreen.map(composedKey).filter(Boolean));
          const additions = queuedRows.filter((row) => !shownKeys.has(row.id)).map(queuedToNote);
          if (additions.length > 0) {
            set({ notes: [...onScreen, ...additions] });
            if (onScreen.length === 0) notesThreadGen += 1;
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

        // A refresh keeps the older pages on screen when its page joins onto
        // them. Matched by id, not created_at: an optimistic note carries
        // toISOString ('...Z') and a server row '+00:00', which do not collate.
        // A short page is the whole thread; a full page that overlaps nothing
        // means more than a page arrived, so the thread is replaced.
        let olderKept: LoveNote[] = [];
        if (options?.keepOlder && rows.length === limit) {
          const pageIds = new Set(rows.map((note) => note.id));
          const firstOverlap = current.findIndex((note) => pageIds.has(note.id));
          if (firstOverlap > 0) {
            olderKept = current
              .slice(0, firstOverlap)
              .filter((note) => isConfirmedNote(note) && !pendingRemoval.includes(note.id));
          }
        }
        revokePreviewUrlsFromNotes(
          current.filter((note) => !unconfirmed.includes(note) && !olderKept.includes(note))
        );

        // With older rows kept, the page says nothing about what lies below
        // them: a server answer from an earlier read stands, but the copy's
        // guess does not, so the list may ask once more. One empty page ends it.
        let hasMore = rows.length === limit;
        if (olderKept.length > 0) {
          hasMore = hasMoreFromServer(userId, requestedInSession) ? get().notesHasMore : true;
        }
        const notes = [...olderKept, ...notesInChatOrder, ...unconfirmed];
        if (notes[0]?.id !== current[0]?.id) notesThreadGen += 1;

        set({ notes, notesIsLoading: false, notesHasMore: hasMore });
        hasMoreFromServerFor = { userId, authSessionVersion: requestedInSession };
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

      // Known offline: no lookup, no query and no per-scroll error — the
      // app-wide offline indicator says why. `notesHasMore` stands, so the
      // next scroll once back online loads the older page.
      if (knownOffline()) return;

      const { userId, authSessionVersion: requestedInSession } = get();
      const ownsRequest = () =>
        get().userId === userId && get().authSessionVersion === requestedInSession;
      // Answers that are not a failed read: the error stands whatever is shown.
      let conclusiveError = false;

      try {
        set({ notesIsLoading: true });
        const loadTicket = ++notesLoadTicket;
        // Taken with `notes` above, before any await: the page joins onto them.
        const threadGen = notesThreadGen;

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

        // The page joins onto the note it was requested below. A refresh that
        // replaced the thread, or an earlier page from the same cursor, has
        // moved the oldest note since: prepending would leave a hole or a
        // doubled page, so drop it. A removal does not count; the page still
        // joins onto what is left. The flag goes down only if no load has
        // raised it since this one; that load owns it now.
        if (notesThreadGen !== threadGen) {
          if (notesLoadTicket === loadTicket) set({ notesIsLoading: false });
          return;
        }

        // Re-read rather than reusing the pre-await capture, so a note that
        // arrived over realtime while the page was in flight is not dropped.
        set({
          notes: [...olderNotes, ...get().notes],
          notesIsLoading: false,
          notesHasMore: (data?.length || 0) === limit,
        });
        if (olderNotes.length > 0) notesThreadGen += 1;
        hasMoreFromServerFor = { userId, authSessionVersion: requestedInSession };
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
      // A replaced thread: an older page in flight no longer joins onto it.
      notesThreadGen += 1;
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

        // Text goes through the queue, online or offline: one send path, one
        // order. An online note sent directly would overtake queued ones.
        if (!imageFile) {
          // The recipient is fixed now, so the drain never needs a network
          // lookup. The loaded partner works offline; failing that, only a
          // conclusive `linked` answer will do.
          let toUserId = get().partner?.id ?? null;
          if (!toUserId) {
            // Offline the lookup can only fail: refused before it goes out,
            // and thrown so the composer keeps the text.
            if (knownOffline()) {
              set({ notesError: NOTES_SEND_NEEDS_CONNECTION });
              throw new NoteRefusedOfflineError(NOTES_SEND_NEEDS_CONNECTION);
            }
            const lookup = await lookupPartnerId();
            if (lookup.status === 'unlinked') throw new Error(PARTNER_NOT_CONFIGURED);
            if (lookup.status === 'error') throw new Error(lookup.reason || 'Failed to send note');
            toUserId = lookup.partnerId;
            if (!ownsRequest()) return;
          }

          const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const createdAt = nextQueuedAt();
          try {
            await enqueueNote({ id: tempId, userId, toUserId, content, createdAt, failed: false });
          } catch (queueError) {
            console.error('[NotesSlice] Failed to queue note:', queueError);
            throw new NoteNotAcceptedError('Failed to save the note');
          }

          // The row stays queued for its owner, who sends it on signing back in.
          if (!ownsRequest()) return;

          set((state) => ({
            notes: [
              ...state.notes,
              {
                id: tempId,
                tempId,
                from_user_id: userId,
                to_user_id: toUserId,
                content,
                created_at: createdAt,
                // Online it looks as it always has; offline it is waiting.
                sending: !knownOffline(),
                queued: true,
              },
            ],
            sentMessageTimestamps: [...recentTimestamps, now],
          }));
          logger.debug('[NotesSlice] Note queued:', tempId);

          void get().drainQueuedNotes();
          return;
        }

        // A picture needs a connection: refused before anything is shown or
        // uploaded, and thrown so the composer keeps the picture and text.
        if (knownOffline()) {
          set({ notesError: IMAGE_NOTE_NEEDS_CONNECTION });
          throw new NoteRefusedOfflineError(IMAGE_NOTE_NEEDS_CONNECTION);
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
        // Not accepted (a failed enqueue, an offline picture): the composer
        // keeps the text and shows its own error.
        if (error instanceof NoteNotAcceptedError) {
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

      retriesInFlight.set(tempId, (retriesInFlight.get(tempId) ?? 0) + 1);
      try {
        // Check rate limiting before retry
        const { recentTimestamps, now } = get().checkRateLimit();

        const { notes } = get();

        // Find the failed message
        const failedNote = notes.find((note) => note.tempId === tempId);
        if (!failedNote) {
          throw new Error('Message not found');
        }

        // A queued note goes back through the drain under the same key, to the
        // recipient fixed when it was composed.
        if (failedNote.queued) {
          if (!capturedUserId) throw new Error('User not authenticated');
          const found = await setQueuedNoteFailed(tempId, false);
          if (!found) {
            // Its row is gone (removed elsewhere): queue it again as composed.
            await enqueueNote({
              id: tempId,
              userId: capturedUserId,
              toUserId: failedNote.to_user_id,
              content: failedNote.content,
              createdAt: failedNote.created_at,
              failed: false,
            });
          }
          if (!ownsRequest()) return;
          set((state) => ({
            notes: state.notes.map((note) =>
              note.tempId === tempId ? { ...note, sending: !knownOffline(), error: false } : note
            ),
            sentMessageTimestamps: [...recentTimestamps, now],
          }));
          await get().drainQueuedNotes();
          return;
        }

        // Past the queue, only a note with a picture is left, and it needs a
        // connection: refused before the partner lookup or any change, so it
        // stays failed. Not thrown — the Retry button has no catch.
        if (knownOffline()) {
          set({ notesError: IMAGE_NOTE_NEEDS_CONNECTION });
          return;
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

        // The note is committed whatever happened to the session meanwhile:
        // the session check guards only the store write, as in sendNote.
        if (ownsRequest()) {
          if (get().notesError === CHECK_CONSTRAINT_MESSAGE) {
            set({ notesError: null });
          }

          set((state) => ({
            notes: confirmOptimisticNote(state.notes, tempId, data),
            sentMessageTimestamps: [...recentTimestamps, now],
          }));
          await saveNotesCopy(userId, requestedInSession);
        }

        logger.debug('[NotesSlice] Retry successful:', data.id);

        // A resend reaches the partner live too, as a first send does. Only
        // the same account may send it (see sendNote).
        if (get().userId !== userId) return;
        try {
          await sendEphemeralBroadcast(`love-notes:${partnerId}`, 'new_message', { message: data });
          logger.debug('[NotesSlice] Resend broadcast to partner:', partnerId);
        } catch (broadcastError) {
          console.warn('[NotesSlice] Broadcast failed (non-fatal):', broadcastError);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to retry message';
        console.error('[NotesSlice] Error retrying message:', error);

        // If it's a rate limit error, throw it up
        if (errorMessage.includes('Rate limit')) {
          throw error;
        }

        throw error;
      } finally {
        const remaining = (retriesInFlight.get(tempId) ?? 1) - 1;
        if (remaining > 0) retriesInFlight.set(tempId, remaining);
        else retriesInFlight.delete(tempId);
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
      // failed send keeps that id too. The UI offers no removal while a note
      // sends, and deletes a failed one with removeFailedMessage instead; this
      // guards the store for callers that bypass it.
      if (target.tempId) {
        logger.debug('[NotesSlice] Refusing to remove a note with no server row:', noteId);
        throw new Error('That message has not finished sending');
      }

      // Known offline: refused before the optimistic removal or the request, so
      // the note never leaves the list. Thrown, so the dialog shows the reason.
      if (knownOffline()) {
        throw new Error(NOTES_REMOVE_NEEDS_CONNECTION);
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
      // This removal owns the flag now: a dropped older page must not lower it.
      if (willEmptyWindow) notesLoadTicket += 1;

      const forgetPending = () =>
        get().notesPendingRemoval.filter((id) => id !== noteId);

      // Captured now: the cached image is keyed by the note's storage path.
      const imagePath = target.image_url ?? null;

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

      // The removal is confirmed, so its image leaves this account's cache too.
      // Logged, never thrown: the removal itself has already succeeded.
      if (imagePath) {
        deleteCachedImages(userId, [imagePath]).catch((cacheError: unknown) => {
          console.error('[NotesSlice] Failed to drop a removed note’s cached image:', cacheError);
        });
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
     *
     * Throws, with a message written for a person, unless the note is loaded,
     * still failed, and not being resent: a delete confirmed while a Retry is
     * in flight would drop the note and its queue row as the resend lands.
     */
    removeFailedMessage: (tempId: string) => {
      const { notes } = get();
      const failedNote = notes.find((n) => n.tempId === tempId);

      if (!failedNote) {
        throw new Error('That message is no longer loaded');
      }
      if (!failedNote.error || failedNote.sending || retriesInFlight.has(tempId)) {
        throw new Error('That message is sending again');
      }

      if (failedNote?.imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(failedNote.imagePreviewUrl);
      }

      set((state) => ({
        notes: state.notes.filter((n) => n.tempId !== tempId),
      }));

      // A queued note leaves the queue too, or a reload would bring it back.
      if (failedNote?.queued) {
        removeQueuedNote(tempId).catch((error: unknown) => {
          console.error('[NotesSlice] Failed to remove a note from the queue:', error);
        });
      }

      logger.debug('[NotesSlice] Removed failed message:', tempId);
    },

    /**
     * Send the signed-in account's queued notes, oldest first (see
     * `drainOnce`). Called after each enqueue and by `App.tsx` on start, on
     * the `online` event and on the 5-minute interval, and by its own
     * backoff timer after a transient failure while online. Skipped while the
     * device is known to be offline. Never throws.
     */
    drainQueuedNotes: () => {
      if (drainInFlight) {
        drainRequested = true;
        // Nothing sends from this tab while it waits for another, so a note
        // just composed or retried waits too.
        if (waitingForLock) settleWaitingNotes();
        return drainInFlight;
      }
      const run = (async () => {
        // Yield first, so `drainInFlight` is set before this can finish.
        await Promise.resolve();
        // What the last pass that ran ended on; decides the retry below.
        let outcome: DrainPassOutcome | 'offline' | null = null;
        try {
          do {
            drainRequested = false;
            if (knownOffline()) {
              settleWaitingNotes();
              outcome = 'offline';
              break;
            }
            // Whatever the pass did (sent, stopped on a transient failure,
            // found the queue unreadable, or lost the lock to another tab),
            // nothing is sending from this tab once it ends.
            const pass = await withSyncLock(NOTE_QUEUE_LOCK, drainOnce);
            settleWaitingNotes();
            if (pass.ran) outcome = pass.result;
            if (!pass.ran) {
              // Another context holds the queue and may send this tab's notes.
              // Once it lets go, pass again: that sends what it left and
              // confirms what it sent.
              waitingForLock = true;
              try {
                await waitForSyncLock(NOTE_QUEUE_LOCK);
              } finally {
                waitingForLock = false;
              }
              drainRequested = true;
            } else {
              await confirmNotesSentElsewhere();
            }
          } while (drainRequested);

          // A transient stop while online retries on a backoff; a completed
          // pass resets it. Known offline, the `online` event drains instead.
          const { userId, authSessionVersion } = get();
          if (outcome === 'done' || outcome === 'offline') {
            cancelDrainRetry();
          } else if (outcome === 'transient' && userId && !knownOffline()) {
            scheduleDrainRetry(userId, authSessionVersion);
          }
        } catch (error) {
          console.error('[NotesSlice] Note queue drain failed:', error);
        } finally {
          drainInFlight = null;
        }
      })();
      drainInFlight = run;
      return run;
    },
  };
};
