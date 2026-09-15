/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * WHY THESE TESTS SWITCH IDENTITY DIRECTLY INSTEAD OF CALLING clearAuth
 *
 * `clearAuth` resets the same fields the guards protect, so a test that drives
 * the transition through it passes whether or not the guard exists — every
 * assertion is satisfied by the reset alone. That is not hypothetical: an
 * earlier version of this file did exactly that, and the entire suite of 1050
 * tests passed with five of the guards deleted.
 * Event session tests also drive real auth actions: their stale outcomes and
 * post-reset settlements distinguish the ownership guard from the reset.
 *
 * `useAppStore.setState({ userId: 'USER-C-ID' })` models the other real
 * transition — `onAuthStateChange` resolving to a different user while a load
 * raised on the previous one is still open — and nothing about it clears the
 * fields under test. Each test seeds USER-C's own data first, so a guard that
 * fails to discard is caught by C's data being overwritten, and a guard that
 * fails to release its loading flag is caught separately.
 *
 * THE LOADING FLAG IS HALF THE GUARD. It is raised BEFORE the await, so an early
 * return that only skips the write leaves it true forever. `PartnerMoodView`
 * gates both of its branches on `isLoadingPartner`, and `ScriptureOverview`
 * renders nothing but a spinner while `isCheckingSession` is true — so a stranded
 * flag is a permanently blank tab, not a cosmetic wobble.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getPartner = vi.fn();
const getPendingRequests = vi.fn();
const searchUsers = vi.fn();
const fetchMoods = vi.fn();
const getAllForUser = vi.fn();
const getUnsyncedMoods = vi.fn();
const getPhotos = vi.fn();
const uploadPhotoService = vi.fn();
const deletePhotoService = vi.fn();
const updatePhotoService = vi.fn();
const getSignedUrl = vi.fn();
const checkStorageQuota = vi.fn();
const getEvents = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const getInteractionHistory = vi.fn();
const getAllStoredMessages = vi.fn();
const toggleStoredFavorite = vi.fn();
const customGetAllForUser = vi.fn();
const customCreate = vi.fn();
const customUpdateMessage = vi.fn();
const customDeleteForUser = vi.fn();
const customExportMessages = vi.fn();
const customImportMessages = vi.fn();
const getUserSessions = vi.fn();
const getCoupleStats = vi.fn();
const getSession = vi.fn();
const createSession = vi.fn();
const loveNotesQuery = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: () => loveNotesQuery(),
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: { fetchMoods: () => fetchMoods() },
}));

vi.mock('../../../src/api/partnerService', () => ({
  partnerService: {
    getPartner: () => getPartner(),
    getPendingRequests: () => getPendingRequests(),
    searchUsers: (query: string) => searchUsers(query),
  },
}));

vi.mock('../../../src/services/photoService', () => ({
  photoService: {
    getPhotos: () => getPhotos(),
    uploadPhoto: (
      input: unknown,
      onProgress?: (percent: number) => void,
      onCheckError?: (message: string) => void
    ) => uploadPhotoService(input, onProgress, onCheckError),
    deletePhoto: (photoId: string) => deletePhotoService(photoId),
    updatePhoto: (photoId: string, updates: unknown) => updatePhotoService(photoId, updates),
    getSignedUrl: (storagePath: string) => getSignedUrl(storagePath),
    checkStorageQuota: () => checkStorageQuota(),
  },
}));

vi.mock('../../../src/services/eventsService', () => ({
  eventsService: {
    getEventsPage: async () => ({
      events: await getEvents(),
      pagination: {
        todayISO: '2026-09-12',
        upcoming: { cursor: null, hasMore: false },
        past: { cursor: null, hasMore: false },
      },
    }),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    getInteractionHistory(userId: string, limit: number) {
      return getInteractionHistory(userId, limit);
    }
  },
}));

vi.mock('../../../src/services/storage', () => ({
  storageService: {
    // The one read the rotation pool comes from. The captured owner is passed
    // straight through, so a case can assert WHICH id the service was asked
    // for, not merely that the store was not written.
    getAllMessages: (userId: string | null) => getAllStoredMessages(userId),
    init: vi.fn(),
    addMessage: vi.fn(),
    addMessages: vi.fn(),
    // Same shape as getAllMessages above, and for the same reason: the
    // `messages` store is shared by every account on the device, so a case has
    // to be able to assert WHICH id the write was made for.
    toggleFavorite: (messageId: number, userId: string | null) =>
      toggleStoredFavorite(messageId, userId),
  },
}));

vi.mock('../../../src/services/customMessageService', () => ({
  customMessageService: {
    getAllForUser: (userId: string | null, filter?: unknown) => customGetAllForUser(userId, filter),
    create: (userId: string | null, input: unknown) => customCreate(userId, input),
    updateMessage: (userId: string | null, input: unknown) => customUpdateMessage(userId, input),
    deleteForUser: (userId: string | null, id: number) => customDeleteForUser(userId, id),
    exportMessages: (userId: string | null) => customExportMessages(userId),
    importMessages: (userId: string | null, data: unknown) => customImportMessages(userId, data),
  },
}));

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    getAllForUser: (userId: string) => getAllForUser(userId),
    getUnsyncedMoods: (userId: string) => getUnsyncedMoods(userId),
  },
}));

vi.mock('../../../src/services/scriptureReadingService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    scriptureReadingService: {
      getUserSessions: (userId: string) => getUserSessions(userId),
      getCoupleStats: () => getCoupleStats(),
      getSession: (sessionId: string, onRefresh: (s: unknown) => void) =>
        getSession(sessionId, onRefresh),
      createSession: (mode: string, partnerId?: string) => createSession(mode, partnerId),
    },
  };
});

import { useAppStore } from '../../../src/stores/useAppStore';
import {
  OWNER_STORAGE_KEY,
  VAULT_STORAGE_KEY,
  stashAnniversaries,
} from '../../../src/services/anniversaryVault';
// Type-only, so `vi.mock` above still replaces the runtime module. Annotating
// the photo fixtures against the real types is what makes a field rename on
// PhotoUploadInput/SupabasePhoto fail typecheck instead of silently leaving
// these guard tests asserting a shape production never produces.
import type {
  PhotoUploadInput,
  PhotoWithUrls,
  SupabasePhoto,
} from '../../../src/services/photoService';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

const PARTNER_A = { id: 'USER-B-ID', displayName: 'A-PARTNER-NAME', email: 'b@example.com' };
const PARTNER_C = { id: 'USER-D-ID', displayName: 'C-PARTNER-NAME', email: 'd@example.com' };

/** A promise this test resolves by hand, so the account switch can land mid-flight */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Nothing else attaches a handler until the loader does, and an unhandled
  // rejection between construction and that point fails the whole file.
  promise.catch(() => {});
  return { promise, settle, fail };
}

/**
 * The PostgREST builder is chainable and thenable — every method returns itself,
 * and awaiting it produces the query result.
 */
function loveNotesBuilder(result: Promise<{ data: unknown; error: unknown }>) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'or', 'order', 'limit', 'lt', 'eq', 'upsert']) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    result.then(onFulfilled, onRejected);
  return builder;
}

function note(id: string, content: string) {
  return {
    id,
    from_user_id: A,
    to_user_id: 'USER-B-ID',
    content,
    created_at: `2026-08-03T06:00:0${id.length}.000Z`,
  };
}

/**
 * Let every already-resolved promise in the chain settle before the switch.
 *
 * This uses a REAL `setTimeout`. If a shared `vi.useFakeTimers()` is ever added
 * to this file's `beforeEach`, every case that calls `flush()` hangs with no
 * diagnostic — advance the timers or swap this for a microtask drain first.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The minimum a PhotoUploadInput needs; nothing here reaches a real service. */
function uploadInput(): PhotoUploadInput {
  return {
    file: new Blob(['x'], { type: 'image/jpeg' }),
    filename: 'a.jpg',
    mimeType: 'image/jpeg' as const,
    width: 10,
    height: 10,
  };
}

/** A's photo row, carrying a string that must never appear in C's store. */
function aPhoto(): SupabasePhoto {
  return {
    id: 'a-photo-1',
    user_id: A,
    storage_path: `${A}/a-photo-1.jpeg`,
    filename: 'a.jpg',
    caption: 'A-PRIVATE-PHOTO',
    mime_type: 'image/jpeg',
    file_size: 1,
    width: 10,
    height: 10,
    created_at: '2026-09-01T00:00:00.000Z',
  };
}

/** What C already had on screen. */
function cPhoto(): PhotoWithUrls {
  return {
    id: 'c-photo',
    user_id: C,
    storage_path: `${C}/c-photo.jpeg`,
    filename: 'c.jpg',
    caption: 'C-OWN-CAPTION',
    mime_type: 'image/jpeg',
    file_size: 1,
    width: 10,
    height: 10,
    created_at: '2026-09-02T00:00:00.000Z',
    signedUrl: null,
    isOwn: true,
  };
}

/**
 * A's own gallery row, as `loadPhotos` repopulates it after A signs back in.
 *
 * The same-account-resignin cases seed THIS rather than C's row: `clearAuth()`
 * empties `photos` via `signedOutState()` (`authSlice.ts:92-96`), so a store
 * holding C's data after A has signed back in is a state no app path produces.
 * A's own re-loaded row is what is really on screen when the dead session's
 * continuation lands, and it is what that continuation would really corrupt.
 */
function aGalleryRow(): PhotoWithUrls {
  return { ...aPhoto(), signedUrl: null, isOwn: true };
}

/** Hand the store to USER-C mid-flight, seeding whatever C already had on screen. */
function switchToUserC(cOwnState: Record<string, unknown> = {}): void {
  useAppStore.setState({
    userId: C,
    isAuthenticated: true,
    ...cOwnState,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

describe('loader identity guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Start from an empty rotation pool. `setAuthUser` refills it whenever the
    // identity changes, and the store is a module singleton — so a pool left
    // behind by the previous test makes that reload fire during setup, against
    // whatever `mockReturnValue` the previous test left armed (`clearAllMocks`
    // clears calls, not implementations). Both a stray `getAllMessages` call
    // and a stray `messages` write then land inside the case under test.
    useAppStore.setState({ messages: [], currentMessage: null } as unknown as Parameters<
      typeof useAppStore.setState
    >[0]);
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(A);
    // AFTER the identity setup, not before: the anniversary vault is
    // localStorage-backed and outlives a test, and the `clearAuth()` above
    // re-stashes whichever id the PREVIOUS test left signed in. A stash sitting
    // under the id a case then signs in as sends `setAuthUser` down its
    // "restored anniversaries" exit instead of the plain one — a different
    // branch, which silently masks defects in the one under test.
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(OWNER_STORAGE_KEY);
    useAppStore.setState({ error: null });

    const { getPartnerId } = await import('../../../src/api/supabaseClient');
    vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');
    getUnsyncedMoods.mockResolvedValue([]);
    // Quiet by default: the custom-message cases each set what they need, and
    // several actions chain into loadMessages/loadCustomMessages afterwards.
    getAllStoredMessages.mockResolvedValue([]);
    customGetAllForUser.mockResolvedValue([]);
    // uploadPhoto awaits the quota twice; unless a case says otherwise it is
    // quiet, so neither the reject nor the warning branch is what is measured.
    checkStorageQuota.mockResolvedValue({ used: 0, quota: 1_000, percent: 0, warning: 'none' });
    getSignedUrl.mockResolvedValue('https://signed.example/a.jpg');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  // ==========================================================================
  // notesSlice — the largest private disclosure in the app
  // ==========================================================================

  describe('fetchNotes', () => {
    it('discards the conversation when the account changed mid-flight', async () => {
      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchNotes();
      switchToUserC({ notes: [note('c1', 'C-OWN-CHAT-BODY')] });

      pending.settle({ data: [note('a1', 'A-PRIVATE-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes).toEqual([note('c1', 'C-OWN-CHAT-BODY')]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CHAT-BODY');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchNotes();
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      switchToUserC();
      pending.settle({ data: [note('a1', 'A-PRIVATE-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });
  });

  describe('fetchOlderNotes', () => {
    it('restores neither the fetched page nor the messages that were on screen', async () => {
      // This one is worse than the plain case: `notes` is destructured before
      // both awaits, so an unguarded write puts the WHOLE pre-switch
      // conversation back, not just the page it went to fetch.
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      switchToUserC({ notes: [note('c1', 'C-OWN-CHAT-BODY')] });

      pending.settle({ data: [note('a0', 'A-OLDER-CHAT-BODY')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes).toEqual([note('c1', 'C-OWN-CHAT-BODY')]);
      const remaining = JSON.stringify(useAppStore.getState());
      expect(remaining, 'the fetched page came back').not.toContain('A-OLDER-CHAT-BODY');
      expect(remaining, 'the pre-switch conversation came back').not.toContain(
        'A-ONSCREEN-CHAT-BODY'
      );
    });

    it('still releases the spinner when it discards', async () => {
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      switchToUserC();
      pending.settle({ data: [], error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });

    it('keeps a note that arrived over realtime while the page was in flight', async () => {
      // The merge re-reads `notes` instead of reusing the pre-await capture.
      useAppStore.setState({
        notes: [note('a1', 'FIRST')],
        notesHasMore: true,
        notesIsLoading: false,
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().fetchOlderNotes();
      // Same account throughout — a realtime message simply lands mid-fetch.
      useAppStore.setState({
        notes: [note('a1', 'FIRST'), note('a2', 'ARRIVED-MID-FETCH')],
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      pending.settle({ data: [note('a0', 'OLDER')], error: null });
      await inFlight;

      expect(useAppStore.getState().notes.map((n) => n.content)).toEqual([
        'OLDER',
        'FIRST',
        'ARRIVED-MID-FETCH',
      ]);
    });
  });

  // ==========================================================================
  // moodSlice
  // ==========================================================================

  describe('removeNote', () => {
    it('still releases the spinner when it discards', async () => {
      // A single-note window with more history behind it. Removing the only
      // loaded note empties the window, which is the branch that raises the
      // spinner before the await so the refill does not flash an empty state.
      useAppStore.setState({
        notes: [note('a1', 'A-ONSCREEN-CHAT-BODY')],
        notesHasMore: true,
        notesIsLoading: false,
        notesPendingRemoval: [],
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      const pending = deferred<{ data: unknown; error: unknown }>();
      loveNotesQuery.mockReturnValue(loveNotesBuilder(pending.promise));

      const inFlight = useAppStore.getState().removeNote('a1');
      expect(useAppStore.getState().notesIsLoading).toBe(true);

      // setAuthUser switches accounts without passing through signedOutState(),
      // so nothing else will clear this flag — and with notes emptied,
      // MessageList renders its spinner branch and nothing else.
      switchToUserC();
      pending.settle({ data: null, error: null });
      await inFlight;

      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });
  });

  describe('loadMoods', () => {
    it("discards this user's own mood notes when the account changed", async () => {
      const pending = deferred<unknown[]>();
      getAllForUser.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadMoods();
      switchToUserC({ moods: [] });

      pending.settle([
        {
          id: 1,
          userId: A,
          mood: 'sad',
          moods: ['sad'],
          note: 'A-OWN-MOOD-NOTE',
          date: '2026-08-03',
          timestamp: new Date('2026-08-03T06:00:00.000Z'),
          synced: true,
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().moods).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-OWN-MOOD-NOTE');
    });
  });

  describe('fetchPartnerMoods', () => {
    it('discards the partner mood notes when the account changed', async () => {
      const { getPartnerId } = await import('../../../src/api/supabaseClient');
      vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');

      const pending = deferred<unknown[]>();
      fetchMoods.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().fetchPartnerMoods();
      switchToUserC({ partnerMoods: [] });

      pending.settle([
        {
          id: 'm1',
          user_id: 'USER-B-ID',
          mood_type: 'sad',
          mood_types: ['sad'],
          note: 'PARTNERS-PRIVATE-NOTE',
          created_at: '2026-08-03T06:00:00.000Z',
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().partnerMoods).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('PARTNERS-PRIVATE-NOTE');
    });
  });

  // ==========================================================================
  // messagesSlice — custom messages (CAP-8 / F8)
  //
  // The `messages` store in IndexedDB holds every account that has signed in on
  // this device. These actions read and write it, and the AdminPanel that
  // drives them has Sign Out one tap away in the bottom nav — so a continuation
  // raised by A lands in whatever store is on screen when it settles.
  //
  // The owner is passed INTO the service rather than read inside it, which is
  // what makes the pending-import case testable at all: the assertion is that
  // the row is stamped with the id captured at entry, not with whoever is
  // signed in when the write happens.
  // ==========================================================================

  /** A's own custom row, as IndexedDB hands it back. */
  function aCustomMessage() {
    return {
      id: 7,
      text: 'A-PRIVATE-CUSTOM-MESSAGE',
      category: 'custom' as const,
      isCustom: true,
      userId: A,
      active: true,
      createdAt: new Date('2026-08-03T06:00:00.000Z'),
      updatedAt: new Date('2026-08-03T06:00:00.000Z'),
      tags: [],
    };
  }

  /** What C already had on screen: a bundled daily row of their own session. */
  function cRotationPool() {
    return [
      {
        id: 1,
        text: 'C-ONSCREEN-DAILY',
        category: 'reason' as const,
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
  }

  function cCustomList() {
    return [
      {
        id: 99,
        text: 'C-OWN-CUSTOM-MESSAGE',
        category: 'custom' as const,
        isCustom: true,
        active: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ];
  }

  function exportFile() {
    return {
      version: '1.0' as const,
      exportDate: '2026-09-12T00:00:00.000Z',
      messageCount: 1,
      messages: [
        {
          text: 'A-IMPORTED-MESSAGE',
          category: 'custom' as const,
          active: true,
          tags: [],
          createdAt: '2026-08-03T06:00:00.000Z',
          updatedAt: '2026-08-03T06:00:00.000Z',
        },
      ],
    };
  }

  /** A File whose `text()` this test controls, so the read is a real await. */
  function importFile(settleText: Promise<string>): File {
    return { text: () => settleText } as unknown as File;
  }

  describe('loadMessages', () => {
    it('asks the service for the account that raised the read', async () => {
      getAllStoredMessages.mockResolvedValue([]);

      await useAppStore.getState().loadMessages();

      // The rotation pool is shared daily rows PLUS the caller's own custom
      // rows, so the read has to name an owner. Passing the live id instead of
      // the captured one is what this pins.
      expect(getAllStoredMessages).toHaveBeenCalledWith(A);
    });

    it('reselects a daily message when the current custom row was deleted', async () => {
      const own = aCustomMessage();
      const daily = cRotationPool()[0];
      useAppStore.setState({ messages: [own, daily], currentMessage: own });
      getAllStoredMessages.mockResolvedValueOnce([daily]);
      await useAppStore.getState().loadMessages();
      expect(useAppStore.getState().currentMessage).toEqual(daily);
      expect(useAppStore.getState().messages).toEqual([daily]);
    });

    it('discards the rotation pool when the account changed mid-flight', async () => {
      const pending = deferred<unknown[]>();
      getAllStoredMessages.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadMessages();
      switchToUserC({ messages: cRotationPool() });

      pending.settle([aCustomMessage()]);
      await inFlight;

      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      // A's own writing, one tap of Sign Out away from C's daily message card.
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });
  });

  describe('toggleFavorite', () => {
    it('names the account that raised the favorite when it reaches the store', async () => {
      toggleStoredFavorite.mockResolvedValueOnce(true);
      const own = aCustomMessage();
      useAppStore.setState({ currentMessage: { ...own, isFavorite: false }, messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      await useAppStore.getState().toggleFavorite(own.id);

      // The favorite is a write into a store shared by every account on the
      // device, so it has to name an owner. Passing `null` would still compile
      // and would still flip the row — on whoever's row shares that id.
      expect(toggleStoredFavorite).toHaveBeenCalledWith(own.id, A);
      // The seeded row is read back: the optimistic flip and the favourite
      // list are the rest of this action, and without these the whole `set()`
      // could be deleted with the case still green.
      expect(useAppStore.getState().messages).toEqual([{ ...own, isFavorite: true }]);
      expect(useAppStore.getState().messageHistory.favoriteIds).toContain(own.id);
      expect(useAppStore.getState().currentMessage?.isFavorite).toBe(true);
    });

    it('uses the committed boolean even when the UI starts stale', async () => {
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }], currentMessage: { ...own, isFavorite: false } });
      toggleStoredFavorite.mockResolvedValueOnce(false);
      await useAppStore.getState().toggleFavorite(own.id);
      expect(useAppStore.getState().messages[0].isFavorite).toBe(false);
      expect(useAppStore.getState().currentMessage?.isFavorite).toBe(false);
      expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(own.id);
    });

    it('discards the favorite write when the account changed mid-flight', async () => {
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      const pending = deferred<void>();
      toggleStoredFavorite.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().toggleFavorite(own.id);
      // Seed C with a known favoriteIds list. An unguarded `map` is a no-op
      // when C's pool does not share A's id, so favoriteIds is the leak.
      const cFavoriteIds = [42];
      switchToUserC({
        messages: cRotationPool(),
        messageHistory: {
          ...useAppStore.getState().messageHistory,
          favoriteIds: cFavoriteIds,
        },
      });

      pending.settle();
      await inFlight;

      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      expect(useAppStore.getState().messageHistory.favoriteIds).toEqual(cFavoriteIds);
    });

    it('discards the favorite write when the SAME account signs back in mid-flight', async () => {
      // `userId` is A again by the time the request lands, so an id-only
      // compare would let this through. `authSessionVersion` is the half
      // that distinguishes the dead session from the live one.
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      const pending = deferred<void>();
      toggleStoredFavorite.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().toggleFavorite(own.id);

      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      const knownFavoriteIds = [42];
      useAppStore.setState({
        messages: [{ ...own, isFavorite: false }],
        messageHistory: {
          ...useAppStore.getState().messageHistory,
          favoriteIds: knownFavoriteIds,
        },
      } as unknown as Parameters<typeof useAppStore.setState>[0]);

      pending.settle();
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().messages).toEqual([{ ...own, isFavorite: false }]);
      expect(useAppStore.getState().messageHistory.favoriteIds).toEqual(knownFavoriteIds);
    });

    it('swallows a service rejection and does not write the favorite', async () => {
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      const knownFavoriteIds = [...useAppStore.getState().messageHistory.favoriteIds];
      const failure = new Error('toggle-failed');
      toggleStoredFavorite.mockRejectedValueOnce(failure);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await expect(useAppStore.getState().toggleFavorite(own.id)).resolves.toBeUndefined();

        expect(useAppStore.getState().messages).toEqual([{ ...own, isFavorite: false }]);
        expect(useAppStore.getState().messageHistory.favoriteIds).toEqual(knownFavoriteIds);
        expect(log).toHaveBeenCalledWith('Error toggling favorite:', failure);
      } finally {
        log.mockRestore();
      }
    });
  });

  describe('setAuthUser refills the rotation pool', () => {
    /**
     * `discardAccountState` strips the outgoing account's custom rows from
     * `messages`, and nothing else puts the incoming account's back:
     * `initializeApp` runs once per page load behind a module flag and an
     * App-level ref that both survive sign-out, and `loadMessages()` is
     * otherwise reached only from the custom-message mutators. Without the
     * reload the new account rotates through the bundled daily messages alone
     * until they edit a custom message or reload the page.
     */
    function aPool() {
      return [cRotationPool()[0], aCustomMessage()];
    }

    it('reloads for the incoming account when one signs in over another', async () => {
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      useAppStore.getState().setAuthUser(C);
      await flush();

      // Read for C, not for the account that just left.
      expect(getAllStoredMessages).toHaveBeenLastCalledWith(C);
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
    });

    it('reloads on a sign-out followed by a different sign-in', async () => {
      // The common flow, and NOT the switched-account branch: onAuthStateChange
      // delivers SIGNED_OUT then SIGNED_IN, so the second call arrives with
      // `previous === null` and never reaches that branch at all.
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(C);
      await flush();

      expect(getAllStoredMessages).toHaveBeenLastCalledWith(C);
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
    });

    it('reloads on the exit that restores stashed anniversaries', async () => {
      // `setAuthUser` has a THIRD exit: a fresh sign-in whose anniversaries
      // were stashed at their last sign-out returns from its own `set()`,
      // before the plain one at the bottom. It is a real production path — it
      // is how a returning user gets their countdown dates back — and it needs
      // the reload exactly as much as the other two.
      stashAnniversaries(C, [{ id: 1, date: '2025-11-26', label: 'C-ANNIVERSARY' }]);
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(C);
      await flush();

      // It really did leave by that exit, not one of the others.
      expect(useAppStore.getState().settings!.relationship.anniversaries).toHaveLength(1);
      expect(getAllStoredMessages).toHaveBeenLastCalledWith(C);
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
    });

    it('does not re-read IndexedDB when the same user is re-notified', async () => {
      // TOKEN_REFRESHED, INITIAL_SESSION and USER_UPDATED all land here for the
      // account that is already signed in, and none of them changes the pool.
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      useAppStore.getState().setAuthUser(A);
      await flush();

      expect(getAllStoredMessages).not.toHaveBeenCalled();
    });

    it('does not race the cold-boot seed', async () => {
      // `messages` is not persisted, so it is empty until `initializeApp` seeds
      // the bundled rows. Firing here would read a still-empty store and could
      // land that empty array on top of the seed.
      useAppStore.setState({ messages: [] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      useAppStore.getState().setAuthUser(C);
      await flush();

      expect(getAllStoredMessages).not.toHaveBeenCalled();
    });

    it('repaints Home for the incoming account', async () => {
      // `discardAccountState` nulls a custom `currentMessage`, and nothing else
      // recomputes it in-session — `updateCurrentMessage` is called only from
      // `initializeApp`, which does not run again.
      useAppStore.setState({
        messages: aPool(),
        currentMessage: aCustomMessage(),
      } as unknown as Parameters<typeof useAppStore.setState>[0]);
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      useAppStore.getState().setAuthUser(C);
      expect(useAppStore.getState().currentMessage).toBeNull();

      await flush();

      expect(useAppStore.getState().currentMessage).toMatchObject({ text: 'C-ONSCREEN-DAILY' });
    });

    it('does not write a pool fetched for an account that has since been replaced', async () => {
      const pending = deferred<unknown[]>();
      const dPool = [
        {
          id: 3,
          text: 'D-OWN-DAILY',
          category: 'reason' as const,
          isCustom: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      // The two reloads must be distinguishable: D's own switch fires a reload
      // of its own, and with one shared mock result the stale write and the
      // legitimate one are byte-identical — the assertion could not tell them
      // apart, and would pass with the guard deleted.
      getAllStoredMessages.mockReturnValueOnce(pending.promise).mockResolvedValue(dPool);

      useAppStore.getState().setAuthUser(C);
      // A third identity arrives before C's read comes back.
      useAppStore.getState().setAuthUser('USER-D-ID');

      pending.settle([aCustomMessage()]);
      await flush();

      expect(useAppStore.getState().messages).toEqual(dPool);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });
  });

  describe('loadCustomMessages', () => {
    it('discards the AdminPanel list when the account changed mid-flight', async () => {
      const pending = deferred<unknown[]>();
      customGetAllForUser.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCustomMessages();
      switchToUserC({ customMessages: cCustomList(), customMessagesLoaded: true });

      pending.settle([aCustomMessage()]);
      await inFlight;

      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });

    it('does not claim C’s list is loaded on A’s behalf when it fails', async () => {
      // The catch path writes `customMessages: []` AND `customMessagesLoaded:
      // true`. Unguarded, A's failure both blanks C's list and tells the
      // AdminPanel effect there is nothing left to fetch — so C's own load
      // never fires and the panel stays empty for the whole session.
      const pending = deferred<unknown[]>();
      customGetAllForUser.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCustomMessages();
      switchToUserC({ customMessages: cCustomList(), customMessagesLoaded: false });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(useAppStore.getState().customMessagesLoaded).toBe(false);
    });
  });

  describe('createCustomMessage', () => {
    it('stamps the row with the account that asked, and leaves the new store alone', async () => {
      const pending = deferred<unknown>();
      customCreate.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().createCustomMessage({
        text: 'A-PRIVATE-CUSTOM-MESSAGE',
        category: 'custom',
      });
      switchToUserC({ customMessages: cCustomList() });

      pending.settle(aCustomMessage());
      await inFlight;

      // The row IS written, and it is A's — refusing the write would lose a
      // message the user really did save. It is C's store that is withheld.
      expect(customCreate).toHaveBeenCalledWith(A, expect.objectContaining({ category: 'custom' }));
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });

    it('does not reload the rotation pool under the new account', async () => {
      const pending = deferred<unknown>();
      customCreate.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .createCustomMessage({ text: 'A-PRIVATE-CUSTOM-MESSAGE', category: 'custom' });
      switchToUserC({ messages: cRotationPool() });

      pending.settle(aCustomMessage());
      await inFlight;

      // loadMessages() is the second write this action makes. Guarding only the
      // optimistic `set` above would still repaint C's Home from IndexedDB.
      expect(getAllStoredMessages).not.toHaveBeenCalled();
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
    });

    it('discards a continuation raised in a session that has since ended', async () => {
      // A → signed out → A again. `userId` is identical on both sides, so only
      // `authSessionVersion` distinguishes the dead session's write from a live
      // one. An id-only compare lets this through.
      const pending = deferred<unknown>();
      customCreate.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .createCustomMessage({ text: 'A-PRIVATE-CUSTOM-MESSAGE', category: 'custom' });

      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      useAppStore.setState({ customMessages: [] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle(aCustomMessage());
      await inFlight;

      expect(useAppStore.getState().customMessages).toEqual([]);
    });
  });

  describe('updateCustomMessage', () => {
    it('does not repaint the new account’s list with the edit', async () => {
      const pending = deferred<void>();
      customUpdateMessage.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .updateCustomMessage({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' });
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });

      pending.settle();
      await inFlight;

      expect(customUpdateMessage).toHaveBeenCalledWith(A, expect.objectContaining({ id: 7 }));
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(getAllStoredMessages).not.toHaveBeenCalled();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });
  });

  describe('deleteCustomMessage', () => {
    it('does not remove a row from the new account’s list', async () => {
      const pending = deferred<void>();
      customDeleteForUser.mockReturnValue(pending.promise);

      // C's own row happens to carry the same auto-increment id A's did — the
      // ids come from one shared IndexedDB keyspace, so this is not contrived.
      const inFlight = useAppStore.getState().deleteCustomMessage(99);
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });

      pending.settle();
      await inFlight;

      expect(customDeleteForUser).toHaveBeenCalledWith(A, 99);
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(getAllStoredMessages).not.toHaveBeenCalled();
    });
  });

  describe('exportCustomMessages', () => {
    it('does not put the previous account’s file into the new one’s downloads', async () => {
      // Guarded even though nothing here writes the store: the download IS the
      // disclosure, and it lands in whichever session is on screen.
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:http://localhost/export');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      try {
        const pending = deferred<unknown>();
        customExportMessages.mockReturnValue(pending.promise);

        const inFlight = useAppStore.getState().exportCustomMessages();
        switchToUserC();

        pending.settle({ ...exportFile(), messages: [{ text: 'A-PRIVATE-CUSTOM-MESSAGE' }] });
        await inFlight;

        expect(customExportMessages).toHaveBeenCalledWith(A);
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(click).not.toHaveBeenCalled();
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('importCustomMessages', () => {
    it('stamps the imported rows with A and never writes under C', async () => {
      const fileRead = deferred<string>();
      const importing = deferred<{ imported: number; skipped: number }>();
      customImportMessages.mockReturnValue(importing.promise);

      const inFlight = useAppStore.getState().importCustomMessages(importFile(fileRead.promise));

      // The switch lands while the FILE is still being read, BEFORE the service
      // is called at all. An owner read live at the call site would be C's, and
      // C would silently acquire a copy of every message in A's backup.
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });

      fileRead.settle(JSON.stringify(exportFile()));
      await flush();
      importing.settle({ imported: 1, skipped: 0 });

      // The caller still learns what happened to THEIR import…
      await expect(inFlight).resolves.toEqual({ imported: 1, skipped: 0 });
      // …the rows carry A's id, because it was captured before the switch…
      expect(customImportMessages).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ version: '1.0' })
      );
      // …and C's store is untouched, neither list nor rotation pool.
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      expect(customGetAllForUser).not.toHaveBeenCalled();
      expect(getAllStoredMessages).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // photosSlice
  // ==========================================================================

  describe('loadPhotos', () => {
    it('discards the gallery when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [{ id: 'c-photo', caption: 'C-OWN-CAPTION' }] });

      pending.settle([{ id: 'a-photo', caption: 'A-PHOTO-CAPTION' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([{ id: 'c-photo', caption: 'C-OWN-CAPTION' }]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PHOTO-CAPTION');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      // The catch path writes `error` — an app-wide banner — and blanks `photos`.
      const pending = deferred<unknown[]>();
      getPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [{ id: 'c-photo', caption: 'C-OWN-CAPTION' }], error: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([{ id: 'c-photo', caption: 'C-OWN-CAPTION' }]);
    });
  });

  // ==========================================================================
  // photosSlice — upload / delete / caption save (CAP-12)
  //
  // An upload spans four awaits and a progress callback, so the window here is
  // seconds wide rather than one round trip. Every case seeds C's own gallery
  // first: a guard that fails to discard is caught by C's row being replaced,
  // and a guard that fails to release `isUploading`/`uploadProgress` is caught
  // separately.
  //
  // Those two flags reach no mounted component today — the only consumer of
  // `usePhotos` is `src/components/photos/PhotoUploader.tsx`, which nothing
  // imports. They are asserted because `signedOutState()` resets them
  // (`authSlice.ts:92-96`) and a stale continuation would write them straight
  // back into the next session's store, and because `usePhotos` is a public
  // hook the next consumer will read them through.
  // ==========================================================================

  describe('uploadPhoto', () => {
    it("does not drop the previous account's photo into this one's gallery", async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      // C has started an upload of their own. That is what makes the flags
      // discriminate: A's success path sets isUploading false and progress 0,
      // so without the guard it blanks C's live upload UI.
      switchToUserC({ photos: [cPhoto()], isUploading: true, uploadProgress: 40 });

      pending.settle(aPhoto());
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-PHOTO');
      expect(useAppStore.getState().isUploading).toBe(true);
      expect(useAppStore.getState().uploadProgress).toBe(40);
    });

    it('does not insert the signed URL when the switch lands during signing', async () => {
      uploadPhotoService.mockResolvedValue(aPhoto());
      const signing = deferred<string>();
      getSignedUrl.mockReturnValue(signing.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      await flush();
      switchToUserC({ photos: [cPhoto()], isUploading: true, uploadProgress: 40 });

      signing.settle('https://signed.example/A-PRIVATE-SIGNED-URL');
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-SIGNED-URL');
      // The same write clears the flags, so C's own upload UI is the other
      // half of what this guard protects.
      expect(useAppStore.getState().isUploading).toBe(true);
      expect(useAppStore.getState().uploadProgress).toBe(40);
    });

    it('still reports the true outcome to its own caller', async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()] });

      pending.settle(aPhoto());

      // The upload really did happen and really did succeed. Only the shared
      // store is withheld; inventing a failure here would be a lie to A's
      // own component closure.
      await expect(inFlight).resolves.toEqual({ success: true });
    });

    it("does not paint the previous account's failure onto the new one", async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({
        photos: [cPhoto()],
        error: null,
        isUploading: true,
        uploadProgress: 40,
      });

      pending.fail(new Error('A-REQUEST-FAILURE'));

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'A-REQUEST-FAILURE',
      });
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().isUploading).toBe(true);
      expect(useAppStore.getState().uploadProgress).toBe(40);
    });

    it("does not move the new account's progress bar", async () => {
      let reportProgress: ((percent: number) => void) | undefined;
      const pending = deferred<unknown>();
      uploadPhotoService.mockImplementation(
        (_input: unknown, onProgress?: (percent: number) => void) => {
          reportProgress = onProgress;
          return pending.promise;
        }
      );

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      await flush();
      switchToUserC({ photos: [cPhoto()], uploadProgress: 0 });

      // Fired from inside the awaited call, which is why it is easy to miss.
      reportProgress?.(75);
      expect(useAppStore.getState().uploadProgress).toBe(0);

      pending.settle(aPhoto());
      await inFlight;
    });

    it("does not reject the new account's session over the previous one's quota", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValue(quota.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], error: null, isUploading: true, uploadProgress: 40 });

      quota.settle({ used: 97, quota: 100, percent: 97, warning: 'critical' });

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'Storage nearly full (97%) - delete photos to continue',
      });
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().isUploading).toBe(true);
      expect(useAppStore.getState().uploadProgress).toBe(40);
    });

    it("does not raise the pre-upload storage warning against the new account", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValueOnce(quota.promise);
      // Parked, so the assertions below run while THIS guard is the only one
      // the upload has reached. Letting the upload finish first would make the
      // flag assertions fail for the success guard too, and each guard has to
      // be provable on its own cases.
      const upload = deferred<unknown>();
      uploadPhotoService.mockReturnValue(upload.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({
        photos: [cPhoto()],
        storageWarning: null,
        isUploading: true,
        uploadProgress: 40,
      });

      // Between 80 and 95: A's account is filling up, C's is not.
      quota.settle({ used: 850, quota: 1_000, percent: 85, warning: 'approaching' });
      await flush();

      expect(useAppStore.getState().storageWarning).toBeNull();
      expect(useAppStore.getState().isUploading).toBe(true);
      expect(useAppStore.getState().uploadProgress).toBe(40);

      upload.settle(aPhoto());
      await inFlight;
    });

    it("does not raise the post-upload storage warning against the new account", async () => {
      // The switch has to land AFTER the insert to reach this write at all:
      // the success guard returns early otherwise, so a switch at call time
      // would leave this branch untested.
      const after = deferred<unknown>();
      checkStorageQuota
        .mockResolvedValueOnce({ used: 0, quota: 1_000, percent: 0, warning: 'none' })
        .mockReturnValueOnce(after.promise);
      uploadPhotoService.mockResolvedValue(aPhoto());

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      await flush();

      // A's photo is in A's gallery by now — that write was legitimate.
      expect(useAppStore.getState().photos).toHaveLength(1);
      switchToUserC({ photos: [cPhoto()], storageWarning: null });

      after.settle({ used: 850, quota: 1_000, percent: 85, warning: 'approaching' });
      await inFlight;

      expect(useAppStore.getState().storageWarning).toBeNull();
    });

    it('writes nothing at all when the upload completes after sign-out', async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      useAppStore.getState().clearAuth();

      pending.settle(aPhoto());
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([]);
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().isUploading).toBe(false);
      expect(useAppStore.getState().uploadProgress).toBe(0);
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      // The only row `switchToUserC` cannot express, and the one that
      // discriminates the authSessionVersion half of the guard: `userId` is A
      // again by the time the request lands, so an id-only compare passes.
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);

      pending.settle(aPhoto());
      await inFlight;

      // `signedOutState()` emptied the gallery and the new session has not
      // loaded yet, so an empty list is the real state here — and it still
      // discriminates: an id-only compare would insert A's photo into it.
      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().photos).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-PHOTO');
    });
  });

  describe('deletePhoto', () => {
    it("does not remove a row from the new account's gallery", async () => {
      // Deliberately the SAME id: partners share a gallery, so the id A is
      // deleting can legitimately be on screen for C too.
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);
      const shared = { ...cPhoto(), id: 'a-photo-1' };

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      switchToUserC({ photos: [shared] });

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([shared]);
    });

    it('writes nothing when the delete settles after sign-out', async () => {
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      useAppStore.getState().clearAuth();

      // A REJECTED delete, deliberately. On the success path signedOutState()
      // has already emptied `photos`, so filtering it is a no-op whether the
      // guard is there or not and the case would prove nothing. The rejection
      // writes `error`, which signedOutState() does NOT reset — so that is the
      // observable this row can actually hold.
      pending.settle(false);
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([]);
    });

    it("does not paint the previous account's delete failure onto the new one", async () => {
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      switchToUserC({ photos: [cPhoto()], error: null });

      pending.fail(new Error('A-DELETE-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      // The case that discriminates the authSessionVersion half of ownsDelete:
      // `userId` is A again by the time the response lands, so an id-only
      // compare lets a dead session's delete filter the live gallery.
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deletePhoto('a-photo-1');
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      // What A's own loadPhotos puts back on screen for the NEW session.
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
    });
  });

  describe('updatePhoto', () => {
    it("does not apply the previous account's caption to this one's gallery", async () => {
      const pending = deferred<boolean>();
      updatePhotoService.mockReturnValue(pending.promise);
      const shared = { ...cPhoto(), id: 'a-photo-1' };

      const inFlight = useAppStore
        .getState()
        .updatePhoto('a-photo-1', { caption: 'A-PRIVATE-CAPTION' });
      switchToUserC({ photos: [shared] });

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([shared]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CAPTION');
    });

    it('writes nothing when the caption save completes after sign-out', async () => {
      const pending = deferred<boolean>();
      updatePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().updatePhoto('a-photo-1', { caption: 'x' });
      useAppStore.getState().clearAuth();

      pending.settle(false);
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toEqual([]);
    });

    it("does not paint the previous account's rejected save onto the new one", async () => {
      const pending = deferred<boolean>();
      updatePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().updatePhoto('a-photo-1', { caption: 'x' });
      switchToUserC({ photos: [cPhoto()], error: null });

      // A rejected write returns false rather than throwing — the path that
      // writes 'Failed to save photo changes'.
      pending.settle(false);
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
    });

    it("does not paint the previous account's thrown save onto the new one", async () => {
      const pending = deferred<boolean>();
      updatePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().updatePhoto('a-photo-1', { caption: 'x' });
      switchToUserC({ photos: [cPhoto()], error: null });

      // The other half: photoService throwing reaches the catch, which is a
      // different write from the `!persisted` branch above.
      pending.fail(new Error('A-SAVE-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      // The case that discriminates the authSessionVersion half of ownsUpdate,
      // for the same reason as deletePhoto's row above.
      const pending = deferred<boolean>();
      updatePhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .updatePhoto('a-photo-1', { caption: 'A-STALE-CAPTION' });
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      // What A's own loadPhotos puts back on screen for the NEW session.
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle(true);
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-STALE-CAPTION');
    });
  });

  // ==========================================================================
  // interactionsSlice
  // ==========================================================================

  describe('loadInteractionHistory', () => {
    it('discards interactions and the unviewed badge when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getInteractionHistory.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadInteractionHistory();
      switchToUserC({ interactions: [], unviewedCount: 0 });

      pending.settle([
        {
          id: 'int-1',
          fromUserId: 'USER-B-ID',
          toUserId: A,
          type: 'poke',
          message: 'A-INTERACTION-MESSAGE',
          viewed: false,
          createdAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().interactions).toEqual([]);
      expect(useAppStore.getState().unviewedCount).toBe(0);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-INTERACTION-MESSAGE');
    });
  });

  // ==========================================================================
  // partnerSlice
  // ==========================================================================

  describe('loadPartner', () => {
    it('discards the partner when the account changed', async () => {
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      switchToUserC({ partner: PARTNER_C });

      pending.settle(PARTNER_A);
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PARTNER-NAME');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      switchToUserC();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      pending.settle(PARTNER_A);
      await inFlight;

      // Stuck true renders neither branch of the partner tab and wedges
      // ScriptureOverview on 'loading'.
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });

    it("does not blank the new account's partner when the old request fails", async () => {
      // The catch path writes `partner: null` unconditionally without its guard,
      // which erases a partner the new account had already loaded.
      const pending = deferred<typeof PARTNER_A>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      switchToUserC({ partner: PARTNER_C });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });
  });

  describe('loadPendingRequests', () => {
    it('discards third-party requests when the account changed', async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      switchToUserC({ sentRequests: [], receivedRequests: [] });

      pending.settle({
        sent: [{ id: 'req-1', toEmail: 'THIRD-PARTY-EMAIL' }],
        received: [],
      });
      await inFlight;

      expect(useAppStore.getState().sentRequests).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('THIRD-PARTY-EMAIL');
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      expect(useAppStore.getState().isLoadingRequests).toBe(true);

      switchToUserC();
      pending.settle({ sent: [], received: [] });
      await inFlight;

      expect(useAppStore.getState().isLoadingRequests).toBe(false);
    });

    it("does not blank the new account's requests when the old request fails", async () => {
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      switchToUserC({ sentRequests: [{ id: 'c-req', toEmail: 'C-OWN-PENDING-EMAIL' }] });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().sentRequests).toEqual([
        { id: 'c-req', toEmail: 'C-OWN-PENDING-EMAIL' },
      ]);
      expect(useAppStore.getState().isLoadingRequests).toBe(false);
    });
  });

  describe('searchUsers', () => {
    it('discards search hits — they name third parties — when the account changed', async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      switchToUserC({ searchResults: [] });

      pending.settle([{ id: 'USER-E-ID', displayName: 'SEARCH-HIT-DISPLAY-NAME' }]);
      await inFlight;

      expect(useAppStore.getState().searchResults).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('SEARCH-HIT-DISPLAY-NAME');
    });

    it('still releases isSearching when it discards', async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      expect(useAppStore.getState().isSearching).toBe(true);

      switchToUserC();
      pending.settle([]);
      await inFlight;

      // Stuck true suppresses both the results branch and the no-results branch
      // of PartnerMoodView's connect UI.
      expect(useAppStore.getState().isSearching).toBe(false);
    });

    it("does not clear the new account's search results when the old search fails", async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      switchToUserC({ searchResults: [{ id: 'USER-F-ID', displayName: 'C-OWN-SEARCH-HIT' }] });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().searchResults).toEqual([
        { id: 'USER-F-ID', displayName: 'C-OWN-SEARCH-HIT' },
      ]);
      expect(useAppStore.getState().isSearching).toBe(false);
    });
  });

  // ==========================================================================
  // scriptureReadingSlice — three loaders fire from ScriptureOverview's mount
  // effect, and Sign Out is in the bottom nav of that same screen
  // ==========================================================================

  describe('checkForActiveSession', () => {
    it("does not restore the previous account's unfinished session", async () => {
      const pending = deferred<unknown[]>();
      getUserSessions.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().checkForActiveSession();
      switchToUserC({ activeSession: null });

      pending.settle([
        {
          id: 'A-SESSION-ID',
          status: 'in_progress',
          mode: 'solo',
          startedAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);
      await inFlight;

      expect(useAppStore.getState().activeSession).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-SESSION-ID');
    });

    it('still releases isCheckingSession when it discards', async () => {
      const pending = deferred<unknown[]>();
      getUserSessions.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().checkForActiveSession();
      expect(useAppStore.getState().isCheckingSession).toBe(true);

      switchToUserC();
      pending.settle([]);
      await inFlight;

      // ScriptureOverview renders its checking branch while this is true and
      // suppresses the mode picker, so a stranded flag is a blank tab.
      expect(useAppStore.getState().isCheckingSession).toBe(false);
    });
  });

  describe('loadCoupleStats', () => {
    it("does not restore the previous pairing's aggregate stats", async () => {
      const pending = deferred<unknown>();
      getCoupleStats.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCoupleStats();
      switchToUserC({ coupleStats: null });

      pending.settle({ totalSessions: 42, currentStreak: 7, label: 'A-COUPLE-STATS' });
      await inFlight;

      expect(useAppStore.getState().coupleStats).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-COUPLE-STATS');
    });

    it('still releases isStatsLoading when it discards', async () => {
      const pending = deferred<unknown>();
      getCoupleStats.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCoupleStats();
      expect(useAppStore.getState().isStatsLoading).toBe(true);

      switchToUserC();
      pending.settle(null);
      await inFlight;

      expect(useAppStore.getState().isStatsLoading).toBe(false);
    });
  });

  describe('loadSession', () => {
    // Not always a user tap: ReadingContainer re-fires this when a partner
    // reconnects, and useScriptureBroadcast re-fires it on channel recovery, so
    // it can be in flight with nobody touching the screen.
    const A_SESSION = {
      id: 'A-SESSION-ID',
      mode: 'solo',
      currentPhase: 'reflection',
      currentStepIndex: 4,
      status: 'in_progress',
      version: 1,
      startedAt: new Date('2026-08-03T06:00:00.000Z'),
      reflection: 'A-REFLECTION-TEXT',
    };

    it("does not restore the previous account's session", async () => {
      const pending = deferred<unknown>();
      getSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadSession('A-SESSION-ID');
      switchToUserC({ session: null });

      pending.settle(A_SESSION);
      await inFlight;

      expect(useAppStore.getState().session).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-REFLECTION-TEXT');
    });

    it('still releases scriptureLoading when it discards', async () => {
      const pending = deferred<unknown>();
      getSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadSession('A-SESSION-ID');
      expect(useAppStore.getState().scriptureLoading).toBe(true);

      switchToUserC();
      pending.settle(A_SESSION);
      await inFlight;

      // Stuck true disables the mode cards on ScriptureOverview and makes
      // loadSession itself a no-op forever after (it early-returns on the flag).
      expect(useAppStore.getState().scriptureLoading).toBe(false);
    });

    it('stops the realtime refresh callback writing once the account changes', async () => {
      // The callback is handed to a live subscription, so it outlives the call
      // and can fire at any point afterwards.
      let onRefresh: ((session: unknown) => void) | undefined;
      getSession.mockImplementation((_id: string, cb: (session: unknown) => void) => {
        onRefresh = cb;
        return Promise.resolve(A_SESSION);
      });

      await useAppStore.getState().loadSession('A-SESSION-ID');
      expect(useAppStore.getState().session).toMatchObject({ id: 'A-SESSION-ID' });

      switchToUserC({ session: null });
      onRefresh?.({ ...A_SESSION, reflection: 'A-REFLECTION-PUSHED-AFTER-SWITCH' });

      expect(useAppStore.getState().session).toBeNull();
      expect(JSON.stringify(useAppStore.getState())).not.toContain(
        'A-REFLECTION-PUSHED-AFTER-SWITCH'
      );
    });
  });

  describe('createSession', () => {
    it("does not hand the new account a session it is not a participant in", async () => {
      const pending = deferred<unknown>();
      createSession.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().createSession('solo');
      switchToUserC({ session: null });

      pending.settle({
        id: 'A-CREATED-SESSION-ID',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      await inFlight;

      expect(useAppStore.getState().session).toBeNull();
      expect(useAppStore.getState().scriptureLoading).toBe(false);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-CREATED-SESSION-ID');
    });
  });

  describe('updateSyncStatus', () => {
    it("does not badge the new account with the previous one's pending count", async () => {
      const pending = deferred<unknown[]>();
      getUnsyncedMoods.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().updateSyncStatus();
      switchToUserC();

      pending.settle([{ id: 1 }, { id: 2 }, { id: 3 }]);
      await inFlight;

      expect(useAppStore.getState().syncStatus.pendingMoods).toBe(0);
    });
  });

  // ==========================================================================
  // eventsSlice
  // ==========================================================================

  describe('loadMoreEvents session ownership', () => {
    const pagination = {
      todayISO: '2026-09-12',
      upcoming: { cursor: null, hasMore: false },
      past: {
        cursor: { event_date: '2026-08-01', created_at: '2026-01-01T00:00:00.123456+00:00', id: 'edge' },
        hasMore: true,
      },
    };

    it.each(['success', 'failure'] as const)('discards old page %s after real same-user reauthentication', async (outcome) => {
      const pending = deferred<unknown[]>();
      getEvents.mockReturnValueOnce(pending.promise);
      useAppStore.setState({ eventsPagination: pagination });
      const page = useAppStore.getState().loadMoreEvents();
      expect(useAppStore.getState().eventsIsLoadingMore).toBe(true);
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      const reset = useAppStore.getState();
      expect(reset).toMatchObject({
        events: [], eventsPagination: null, eventsIsLoadingMore: false, eventsHistoryError: null,
      });
      if (outcome === 'success') pending.settle([{ id: 'previous-session' }]);
      else pending.fail(new Error('previous page failed'));
      expect(await page).toEqual({ status: 'stale' });
      expect(useAppStore.getState()).toBe(reset);
    });

    it.each(['success', 'failure'] as const)('cannot overwrite successor page state when old page %s settles', async (outcome) => {
      const previous = deferred<unknown[]>();
      getEvents.mockReturnValueOnce(previous.promise);
      useAppStore.setState({ eventsPagination: pagination });
      const oldPage = useAppStore.getState().loadMoreEvents();
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(C);
      useAppStore.setState({ eventsPagination: pagination });
      const current = deferred<unknown[]>();
      getEvents.mockReturnValueOnce(current.promise);
      const currentPage = useAppStore.getState().loadMoreEvents();
      const currentState = useAppStore.getState();
      if (outcome === 'success') previous.settle([{ id: 'previous-session' }]);
      else previous.fail(new Error('previous page failed'));
      expect(await oldPage).toEqual({ status: 'stale' });
      expect(useAppStore.getState()).toBe(currentState);
      expect(currentState.eventsIsLoadingMore).toBe(true);
      current.fail(new Error('current page failed'));
      expect(await currentPage).toEqual({ status: 'failure', error: 'current page failed' });
      expect(useAppStore.getState().eventsPagination).toBe(pagination);
      expect(useAppStore.getState().eventsHistoryError).toBe('current page failed');
    });

    it('resets metadata and continuation errors on a direct account switch', () => {
      useAppStore.setState({
        eventsPagination: pagination, eventsIsLoadingMore: true, eventsHistoryError: 'private history failure',
      });
      useAppStore.getState().setAuthUser(C);
      expect(useAppStore.getState()).toMatchObject({
        eventsPagination: null, eventsIsLoadingMore: false, eventsHistoryError: null,
      });
    });
  });

  describe('loadEvents', () => {
    const aEvent = {
      id: 'a-event',
      userId: A,
      label: 'A-PRIVATE-EVENT-LABEL',
      date: new Date(2026, 9, 31),
      createdAt: new Date(2026, 0, 1),
      description: null,
      icon: 'calendar',
    };

    it.each(['success', 'failure'])(
      'discards old-session %s after the same user signs back in without a successor load',
      async (outcome) => {
        const pending = deferred<unknown[]>();
        getEvents.mockReturnValue(pending.promise);
        const inFlight = useAppStore.getState().loadEvents();

        useAppStore.getState().clearAuth();
        useAppStore.getState().setAuthUser(A);
        const reset = useAppStore.getState();
        expect(reset).toMatchObject({ events: [], eventsIsLoading: false, eventsError: null });

        if (outcome === 'success') pending.settle([aEvent]);
        else pending.fail(new Error('PREVIOUS-SESSION-FAILURE'));

        expect(await inFlight).toEqual({ status: 'stale' });
        expect(useAppStore.getState()).toBe(reset);
        expect(getEvents).toHaveBeenCalledTimes(1);
      }
    );

    it.each(['success', 'failure'])(
      'leaves the new session spinner intact when old-session %s settles',
      async (outcome) => {
        const previous = deferred<unknown[]>();
        const current = deferred<unknown[]>();
        getEvents.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
        const oldLoad = useAppStore.getState().loadEvents();
        useAppStore.getState().clearAuth();
        useAppStore.getState().setAuthUser(A);
        const newLoad = useAppStore.getState().loadEvents();
        const loading = useAppStore.getState();

        if (outcome === 'success') previous.settle([aEvent]);
        else previous.fail(new Error('PREVIOUS-SESSION-FAILURE'));

        expect(await oldLoad).toEqual({ status: 'stale' });
        expect(useAppStore.getState()).toBe(loading);
        expect(loading).toMatchObject({ events: [], eventsIsLoading: true, eventsError: null });

        const currentEvent = { ...aEvent, id: 'current-event', label: 'CURRENT-SESSION-EVENT' };
        current.settle([currentEvent]);
        expect(await newLoad).toEqual({ status: 'success' });
        expect(useAppStore.getState()).toMatchObject({
          events: [currentEvent],
          eventsIsLoading: false,
          eventsError: null,
        });
      }
    );

    it.each(['success', 'failure'])(
      'preserves the new session failure after old-session %s settles',
      async (outcome) => {
        const previous = deferred<unknown[]>();
        getEvents.mockReturnValueOnce(previous.promise);
        const oldLoad = useAppStore.getState().loadEvents();
        useAppStore.getState().clearAuth();
        useAppStore.getState().setAuthUser(A);
        getEvents.mockRejectedValueOnce(new Error('CURRENT-SESSION-FAILURE'));

        expect(await useAppStore.getState().loadEvents()).toEqual({
          status: 'failure',
          error: 'CURRENT-SESSION-FAILURE',
        });
        const failed = useAppStore.getState();

        if (outcome === 'success') previous.settle([aEvent]);
        else previous.fail(new Error('PREVIOUS-SESSION-FAILURE'));

        expect(await oldLoad).toEqual({ status: 'stale' });
        expect(useAppStore.getState()).toBe(failed);
        expect(failed).toMatchObject({
          events: [],
          eventsIsLoading: false,
          eventsError: 'CURRENT-SESSION-FAILURE',
        });
      }
    );

    it.each(['success', 'failure'])(
      'allows current-session %s after a same-user auth refresh',
      async (outcome) => {
        const pending = deferred<unknown[]>();
        getEvents.mockReturnValue(pending.promise);
        const inFlight = useAppStore.getState().loadEvents();
        const version = useAppStore.getState().authSessionVersion;

        useAppStore.getState().setAuthUser(A, 'refreshed@example.com');
        expect(useAppStore.getState().authSessionVersion).toBe(version);
        if (outcome === 'success') pending.settle([aEvent]);
        else pending.fail(new Error('CURRENT-SESSION-FAILURE'));

        expect(await inFlight).toEqual(
          outcome === 'success'
            ? { status: 'success' }
            : { status: 'failure', error: 'CURRENT-SESSION-FAILURE' }
        );
        expect(useAppStore.getState().eventsIsLoading).toBe(false);
        expect(useAppStore.getState().events).toEqual(outcome === 'success' ? [aEvent] : []);
        expect(useAppStore.getState().eventsError).toBe(
          outcome === 'success' ? null : 'CURRENT-SESSION-FAILURE'
        );
        expect(getEvents).toHaveBeenCalledTimes(1);
      }
    );

    it('discards the couple’s events when the account changed', async () => {
      const pending = deferred<unknown[]>();
      getEvents.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadEvents();
      switchToUserC({ events: [{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle([{ id: 'a-event', label: 'A-PRIVATE-EVENT-LABEL' }]);
      await inFlight;

      expect(useAppStore.getState().events).toEqual([{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('leaves a successor account’s live spinner alone when it discards', async () => {
      // The real account transition resets eventsIsLoading via signedOutState()
      // (pinned by signOutClearsAccountState.test.ts), so the guard has nothing
      // to release. C is seeded mid-load: a stale resolution that wrote the
      // flag would clear C's own live spinner and flash an empty list while
      // C's request is still open.
      const pending = deferred<unknown[]>();
      getEvents.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadEvents();
      expect(useAppStore.getState().eventsIsLoading).toBe(true);

      switchToUserC({
        events: [{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }],
        eventsError: null,
        eventsIsLoading: true,
      });
      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsIsLoading).toBe(true);
      // The error must not land on the account that did not make the request,
      // and C's own list must stay intact.
      expect(useAppStore.getState().eventsError).toBeNull();
      expect(useAppStore.getState().events).toEqual([{ id: 'c-event', label: 'C-OWN-EVENT-LABEL' }]);
    });
  });

  // The three write actions set() after their await too, so each carries the
  // same guard. Without these describes, deleting any one of the three guards
  // leaves the whole suite green — the failure this file's header records.

  describe('addEvent', () => {
    it('does not drop the previous account\'s new event into this one\'s list', async () => {
      const pending = deferred<unknown>();
      createEvent.mockReturnValue(pending.promise);

      // C's row is a COMPLETE CoupleEvent on purpose. `sortByDate` reads
      // `.date.getTime()`, so a `{ id, label }` stub throws inside the set()
      // updater — which the catch swallows, making this test pass with the
      // guard deleted. Verified: with a stub it does not discriminate.
      const cOwnEvent = {
        id: 'c-event',
        userId: C,
        label: 'C-OWN-EVENT-LABEL',
        date: new Date(2026, 11, 25),
        description: null,
        icon: 'calendar',
      };

      const inFlight = useAppStore.getState().addEvent({
        label: 'A-PRIVATE-EVENT-LABEL',
        eventDate: '2026-10-31',
      });
      switchToUserC({ events: [cOwnEvent] });

      pending.settle({
        id: 'a-event',
        userId: A,
        label: 'A-PRIVATE-EVENT-LABEL',
        date: new Date(2026, 9, 31),
        description: null,
        icon: 'calendar',
      });
      await inFlight;

      expect(useAppStore.getState().events).toEqual([cOwnEvent]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      createEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().addEvent({
        label: 'x',
        eventDate: '2026-10-31',
      });
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  describe('editEvent', () => {
    it('does not apply the previous account\'s edit to this one\'s list', async () => {
      const pending = deferred<unknown>();
      updateEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().editEvent('a-event', { label: 'renamed' });
      switchToUserC({ events: [{ id: 'a-event', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle({
        id: 'a-event',
        userId: A,
        label: 'A-PRIVATE-EVENT-LABEL',
        date: new Date(2026, 9, 31),
        description: null,
        icon: 'calendar',
      });
      await inFlight;

      // Same id in both accounts: without the guard the map() would overwrite
      // C's row with A's, which is the leak in its most direct form.
      expect(useAppStore.getState().events).toEqual([
        { id: 'a-event', label: 'C-OWN-EVENT-LABEL' },
      ]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-EVENT-LABEL');
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      updateEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().editEvent('a-event', { label: 'x' });
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  describe('removeEvent', () => {
    it('does not delete this account\'s event because the previous one asked', async () => {
      const pending = deferred<unknown>();
      deleteEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().removeEvent('shared-id');
      switchToUserC({ events: [{ id: 'shared-id', label: 'C-OWN-EVENT-LABEL' }] });

      pending.settle(undefined);
      await inFlight;

      // The filter is by id alone, so an unguarded write would take C's row out
      // of C's list on A's behalf.
      expect(useAppStore.getState().events).toEqual([
        { id: 'shared-id', label: 'C-OWN-EVENT-LABEL' },
      ]);
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      const pending = deferred<unknown>();
      deleteEvent.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().removeEvent('a-event');
      switchToUserC({ events: [], eventsError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsError).toBeNull();
    });
  });

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it('loadPartner writes normally', async () => {
      getPartner.mockResolvedValue(PARTNER_A);

      await useAppStore.getState().loadPartner();

      expect(useAppStore.getState().partner).toEqual(PARTNER_A);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });

    it('fetchNotes writes normally', async () => {
      loveNotesQuery.mockReturnValue(
        loveNotesBuilder(Promise.resolve({ data: [note('a1', 'A-CHAT')], error: null }))
      );

      await useAppStore.getState().fetchNotes();

      expect(useAppStore.getState().notes).toEqual([note('a1', 'A-CHAT')]);
      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });

    it('loadMessages writes normally', async () => {
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      await useAppStore.getState().loadMessages();

      expect(useAppStore.getState().messages).toEqual(cRotationPool());
    });

    it('loadCustomMessages writes normally', async () => {
      customGetAllForUser.mockResolvedValue([aCustomMessage()]);

      await useAppStore.getState().loadCustomMessages();

      expect(useAppStore.getState().customMessages).toEqual([
        expect.objectContaining({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' }),
      ]);
      expect(useAppStore.getState().customMessagesLoaded).toBe(true);
    });

    it('createCustomMessage writes normally', async () => {
      customCreate.mockResolvedValue(aCustomMessage());

      await useAppStore
        .getState()
        .createCustomMessage({ text: 'A-PRIVATE-CUSTOM-MESSAGE', category: 'custom' });

      expect(useAppStore.getState().customMessages).toEqual([
        expect.objectContaining({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' }),
      ]);
      // And it still refreshes the rotation pool afterwards.
      expect(getAllStoredMessages).toHaveBeenCalledWith(A);
    });

    it('updateCustomMessage and deleteCustomMessage write normally', async () => {
      customGetAllForUser.mockResolvedValue([aCustomMessage()]);
      customUpdateMessage.mockResolvedValue(undefined);
      customDeleteForUser.mockResolvedValue(undefined);
      await useAppStore.getState().loadCustomMessages();

      await useAppStore.getState().updateCustomMessage({ id: 7, text: 'A-EDITED' });
      expect(useAppStore.getState().customMessages[0].text).toBe('A-EDITED');

      await useAppStore.getState().deleteCustomMessage(7);
      expect(useAppStore.getState().customMessages).toEqual([]);
    });

    it('exportCustomMessages still downloads the file', async () => {
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:http://localhost/export');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      try {
        customExportMessages.mockResolvedValue(exportFile());

        await useAppStore.getState().exportCustomMessages();

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('importCustomMessages writes normally', async () => {
      customImportMessages.mockResolvedValue({ imported: 1, skipped: 0 });
      customGetAllForUser.mockResolvedValue([aCustomMessage()]);

      await expect(
        useAppStore
          .getState()
          .importCustomMessages(importFile(Promise.resolve(JSON.stringify(exportFile()))))
      ).resolves.toEqual({ imported: 1, skipped: 0 });

      expect(useAppStore.getState().customMessages).toHaveLength(1);
      expect(getAllStoredMessages).toHaveBeenCalledWith(A);
    });

    it('loadCoupleStats writes normally', async () => {
      getCoupleStats.mockResolvedValue({ totalSessions: 3 });

      await useAppStore.getState().loadCoupleStats();

      expect(useAppStore.getState().coupleStats).toEqual({ totalSessions: 3 });
      expect(useAppStore.getState().isStatsLoading).toBe(false);
    });

    it('loadEvents writes normally', async () => {
      getEvents.mockResolvedValue([{ id: 'a-event', label: 'A-EVENT' }]);

      await useAppStore.getState().loadEvents();

      expect(useAppStore.getState().events).toEqual([{ id: 'a-event', label: 'A-EVENT' }]);
      expect(useAppStore.getState().eventsIsLoading).toBe(false);
    });

    it('uploadPhoto writes normally', async () => {
      uploadPhotoService.mockResolvedValue(aPhoto());
      getSignedUrl.mockResolvedValue('https://signed.example/a.jpg');

      await expect(useAppStore.getState().uploadPhoto(uploadInput())).resolves.toEqual({
        success: true,
      });

      expect(useAppStore.getState().photos).toEqual([
        { ...aPhoto(), signedUrl: 'https://signed.example/a.jpg', isOwn: true },
      ]);
      expect(useAppStore.getState().isUploading).toBe(false);
      expect(useAppStore.getState().uploadProgress).toBe(0);
    });

    it('uploadPhoto still reports progress', async () => {
      const seen: number[] = [];
      uploadPhotoService.mockImplementation(
        (_input: unknown, onProgress?: (percent: number) => void) => {
          onProgress?.(25);
          seen.push(useAppStore.getState().uploadProgress);
          onProgress?.(100);
          seen.push(useAppStore.getState().uploadProgress);
          return Promise.resolve(aPhoto());
        }
      );

      await useAppStore.getState().uploadPhoto(uploadInput());

      expect(seen).toEqual([25, 100]);
    });

    it('uploadPhoto still rejects on a full quota and releases the upload flags', async () => {
      checkStorageQuota.mockResolvedValueOnce({
        used: 97,
        quota: 100,
        percent: 97,
        warning: 'critical',
      });

      await expect(useAppStore.getState().uploadPhoto(uploadInput())).resolves.toEqual({
        success: false,
        error: 'Storage nearly full (97%) - delete photos to continue',
      });
      expect(useAppStore.getState().error).toBe(
        'Storage nearly full (97%) - delete photos to continue'
      );
      // `isUploading` is raised before the quota await, so this rejection is
      // the only thing that lowers it. Leave it set and the owner's Upload
      // button stays disabled behind a phantom progress bar.
      expect(useAppStore.getState().isUploading).toBe(false);
      expect(useAppStore.getState().uploadProgress).toBe(0);
    });

    // The two warning writes are split across two cases with DIFFERENT
    // percentages on purpose. One case with an every-call quota mock makes both
    // writes produce a byte-identical string, so either could be deleted with
    // the other still satisfying the assertion.
    it('uploadPhoto still warns when storage is already near the limit before the upload', async () => {
      checkStorageQuota
        .mockResolvedValueOnce({ used: 850, quota: 1_000, percent: 85, warning: 'approaching' })
        .mockResolvedValueOnce({ used: 860, quota: 1_000, percent: 86, warning: 'none' });
      uploadPhotoService.mockResolvedValue(aPhoto());

      await useAppStore.getState().uploadPhoto(uploadInput());

      expect(useAppStore.getState().storageWarning).toBe(
        'Storage 85% full - consider deleting old photos'
      );
    });

    it('uploadPhoto still warns when the upload itself pushes storage near the limit', async () => {
      // Below the threshold beforehand, so only the post-upload check can fire
      // — the branch that catches "this photo is what filled you up".
      checkStorageQuota
        .mockResolvedValueOnce({ used: 100, quota: 1_000, percent: 10, warning: 'none' })
        .mockResolvedValueOnce({ used: 870, quota: 1_000, percent: 87, warning: 'approaching' });
      uploadPhotoService.mockResolvedValue(aPhoto());

      await useAppStore.getState().uploadPhoto(uploadInput());

      expect(useAppStore.getState().storageWarning).toBe(
        'Storage 87% full - consider deleting old photos'
      );
    });

    it('uploadPhoto surfaces a failure and a retry then clears it', async () => {
      // One logical upload, retried — so both attempts carry the same
      // idempotencyKey, the shape PhotoUploadInput exists to express
      // (`photoService.ts:72-82`). Minting a fresh input per attempt would
      // encode the double-write this key was added to prevent.
      const retried = { ...uploadInput(), idempotencyKey: 'A-RETRY-KEY' };
      uploadPhotoService.mockRejectedValueOnce(new Error('network down'));

      await expect(useAppStore.getState().uploadPhoto(retried)).resolves.toEqual({
        success: false,
        error: 'network down',
      });
      expect(useAppStore.getState().error).toBe('network down');

      uploadPhotoService.mockResolvedValue(aPhoto());

      await expect(useAppStore.getState().uploadPhoto(retried)).resolves.toEqual({
        success: true,
      });
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photos).toHaveLength(1);
    });

    it('deletePhoto writes normally', async () => {
      useAppStore.setState({ photos: [{ ...aPhoto(), signedUrl: null, isOwn: true }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      deletePhotoService.mockResolvedValue(true);

      await useAppStore.getState().deletePhoto('a-photo-1');

      expect(useAppStore.getState().photos).toEqual([]);
    });

    it('deletePhoto surfaces a failure', async () => {
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      // A rejected delete returns false, which the action turns into a throw.
      deletePhotoService.mockResolvedValue(false);

      await useAppStore.getState().deletePhoto('a-photo-1');

      expect(useAppStore.getState().error).toBe('Failed to delete photo');
      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
    });

    it('updatePhoto surfaces a rejected save and a thrown one', async () => {
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      // `false` is the `!persisted` branch — a different write from the catch.
      updatePhotoService.mockResolvedValue(false);

      await useAppStore.getState().updatePhoto('a-photo-1', { caption: 'renamed' });

      expect(useAppStore.getState().error).toBe('Failed to save photo changes');
      expect(useAppStore.getState().photos[0].caption).toBe('A-PRIVATE-PHOTO');

      useAppStore.setState({ error: null });
      updatePhotoService.mockRejectedValue(new Error('save exploded'));

      await useAppStore.getState().updatePhoto('a-photo-1', { caption: 'renamed' });

      expect(useAppStore.getState().error).toBe('save exploded');
    });

    it('updatePhoto writes normally', async () => {
      useAppStore.setState({ photos: [{ ...aPhoto(), signedUrl: null, isOwn: true }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      updatePhotoService.mockResolvedValue(true);

      await useAppStore.getState().updatePhoto('a-photo-1', { caption: 'renamed' });

      expect(useAppStore.getState().photos[0].caption).toBe('renamed');
    });

    it('checkForActiveSession writes normally', async () => {
      getUserSessions.mockResolvedValue([
        {
          id: 'A-SESSION-ID',
          status: 'in_progress',
          mode: 'solo',
          startedAt: new Date('2026-08-03T06:00:00.000Z'),
        },
      ]);

      await useAppStore.getState().checkForActiveSession();

      expect(useAppStore.getState().activeSession).toMatchObject({ id: 'A-SESSION-ID' });
      expect(useAppStore.getState().isCheckingSession).toBe(false);
    });
  });
});
