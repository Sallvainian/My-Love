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
 * gates both of its branches on `isLoadingPartner` — so a stranded flag is a
 * permanently blank tab, not a cosmetic wobble.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const getPartner = vi.fn();
const getPendingRequests = vi.fn();
const searchUsers = vi.fn();
const fetchMoods = vi.fn();
const getAllForUser = vi.fn();
const getUnsyncedMoods = vi.fn();
const listAllPhotos = vi.fn();
const uploadPhotoService = vi.fn();
const deletePhotoService = vi.fn();
const checkStorageQuota = vi.fn();
const getEvents = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const getInteractionHistory = vi.fn();
const getAllStoredMessages = vi.fn();
const getStoredMessage = vi.fn();
const toggleStoredFavorite = vi.fn();
const customCreate = vi.fn();
const customUpdateMessage = vi.fn();
const customDeleteForUser = vi.fn();
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
  lookupPartnerId: vi.fn(),
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
    listAllPhotos: () => listAllPhotos(),
    uploadPhoto: (input: unknown, onCheckError?: (message: string) => void) =>
      uploadPhotoService(input, onCheckError),
    deletePhoto: (photoId: string) => deletePhotoService(photoId),
    checkStorageQuota: () => checkStorageQuota(),
  },
}));

// The background photo image fill is photoImageCache's own subject.
vi.mock('../../../src/services/photoImageCache', async (importOriginal) => ({
  deletePhotoImages: (
    await importOriginal<typeof import('../../../src/services/photoImageCache')>()
  ).deletePhotoImages,
  requestPhotoImageFill: vi.fn(async () => {}),
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
    // The bundled rows the rotation pool starts from. Shared by every account;
    // each account's own rows come from its message-data copy (readLocalCopy).
    getAllMessages: () => getAllStoredMessages(),
    getMessage: (id: number) => getStoredMessage(id),
    init: vi.fn(),
    addMessage: vi.fn(),
    addMessages: vi.fn(),
    bundledFavoriteIds: vi.fn(async () => []),
    // The server half of a favorite; a case asserts WHICH account it names.
    toggleFavorite: (userId: string | null, message: unknown, copy: unknown) =>
      toggleStoredFavorite(userId, message, copy),
  },
}));

// The server writes are faked; the copy transforms stay real.
vi.mock('../../../src/services/customMessageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/customMessageService')>();
  return {
    ...actual,
    customMessageService: {
      ...actual.customMessageService,
      createRemote: (userId: string | null, input: unknown, clientKey: string) =>
        customCreate(userId, input, clientKey),
      updateRemote: (row: unknown, input: unknown) => customUpdateMessage(row, input),
      deleteRemote: (row: unknown) => customDeleteForUser(row),
    },
  };
});

// The partner loader reads its saved copy before the server. Controlled here
// so a case can hold the copy read open across an account switch.
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();
vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  deleteAccountCopies: async () => {},
  registerLocalCopy: () => () => {},
  refreshLocalCopies: async () => {},
  refreshLocalCopy: async () => {},
}));

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    getAllForUser: (userId: string) => getAllForUser(userId),
    getUnsyncedMoods: (userId: string) => getUnsyncedMoods(userId),
  },
}));

import { useAppStore } from '../../../src/stores/useAppStore';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';
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
    // AFTER the identity setup: the device owner marker is localStorage-backed
    // and outlives a test, so a case starts with no recorded owner.
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    useAppStore.setState({ error: null });

    const { getPartnerId, lookupPartnerId } = await import('../../../src/api/supabaseClient');
    vi.mocked(getPartnerId).mockResolvedValue('USER-B-ID');
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'linked', partnerId: 'USER-B-ID' });
    getUnsyncedMoods.mockResolvedValue([]);
    // Quiet by default: the custom-message cases each set what they need, and
    // several actions chain into loadMessages/loadCustomMessages afterwards.
    getAllStoredMessages.mockResolvedValue([]);
    getStoredMessage.mockResolvedValue(undefined);
    // uploadPhoto awaits the quota twice; unless a case says otherwise it is
    // quiet, so neither the reject nor the warning branch is what is measured.
    checkStorageQuota.mockResolvedValue({ used: 0, quota: 1_000, percent: 0, warning: 'none' });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    readLocalCopy.mockResolvedValue(null);
    writeLocalCopy.mockResolvedValue(undefined);
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
  // Each account's custom messages and favorites are its message-data local
  // copy, and the AdminPanel that drives these actions has Sign Out one tap
  // away in the bottom nav — so a continuation raised by A lands in whatever
  // store is on screen when it settles.
  //
  // The owner is captured at entry and passed INTO every read, server write and
  // copy save, which is what makes these cases testable at all: the assertion
  // is that A's id is used, not whoever is signed in when the write lands.
  // ==========================================================================

  /** A's own custom row, as A's saved copy holds it. */
  function aCustomMessage() {
    return {
      id: 7,
      text: 'A-PRIVATE-CUSTOM-MESSAGE',
      category: 'custom' as const,
      isCustom: true,
      userId: A,
      serverId: 'srv-a-7',
      active: true,
      isFavorite: false,
      createdAt: new Date('2026-08-03T06:00:00.000Z'),
      updatedAt: new Date('2026-08-03T06:00:00.000Z'),
      tags: [],
    };
  }

  /** The server's copy of A's row, as a create or an edit answers. */
  function aRemote(text = 'A-PRIVATE-CUSTOM-MESSAGE') {
    return {
      serverId: 'srv-a-7',
      text,
      category: 'custom' as const,
      active: true,
      isFavorite: false,
      tags: [],
      createdAt: new Date('2026-08-03T06:00:00.000Z'),
      updatedAt: new Date('2026-08-03T06:00:00.000Z'),
    };
  }

  function aCopy() {
    return { custom: [aCustomMessage()], bundledFavoriteIds: [], nextCustomId: 8 };
  }

  /** Answer message-data reads from `copies` by account; every other kind is empty. */
  function savedMessageData(copies: Record<string, unknown>) {
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      kind === 'message-data' ? (copies[userId] ?? null) : null
    );
  }

  function messageDataWrites() {
    return writeLocalCopy.mock.calls.filter(([, kind]) => kind === 'message-data');
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
    it('reads the copy of the account that raised the read', async () => {
      getAllStoredMessages.mockResolvedValue([]);

      await useAppStore.getState().loadMessages();

      // The rotation pool is shared daily rows PLUS the caller's own custom
      // rows, so the read has to name an owner. Passing the live id instead of
      // the captured one is what this pins.
      expect(readLocalCopy).toHaveBeenCalledWith(A, 'message-data');
    });

    it('reselects a daily message when the current custom row was deleted', async () => {
      const own = aCustomMessage();
      const daily = cRotationPool()[0];
      useAppStore.setState({ messages: [own, daily], currentMessage: own });
      getAllStoredMessages.mockResolvedValueOnce([daily]);
      await useAppStore.getState().loadMessages();
      expect(useAppStore.getState().currentMessage).toEqual({ ...daily, isFavorite: false });
      expect(useAppStore.getState().messages).toEqual([{ ...daily, isFavorite: false }]);
    });

    it('discards the rotation pool when the account changed mid-flight', async () => {
      const pending = deferred<unknown[]>();
      getAllStoredMessages.mockReturnValue(pending.promise);
      savedMessageData({ [A]: aCopy() });

      const inFlight = useAppStore.getState().loadMessages();
      switchToUserC({ messages: cRotationPool() });

      pending.settle([]);
      await inFlight;

      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      // A's own writing, one tap of Sign Out away from C's daily message card.
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });
  });

  describe('toggleFavorite', () => {
    function toggled(isFavorite: boolean) {
      return {
        isFavorite,
        copy: { ...aCopy(), custom: [{ ...aCustomMessage(), isFavorite }] },
      };
    }

    it('names the account that raised the favorite, and saves its confirmed copy', async () => {
      savedMessageData({ [A]: aCopy() });
      toggleStoredFavorite.mockResolvedValueOnce(toggled(true));
      const own = aCustomMessage();
      useAppStore.setState({ currentMessage: { ...own, isFavorite: false }, messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      await useAppStore.getState().toggleFavorite(own.id);

      // The favorite is A's, read from A's copy and saved back into it.
      expect(toggleStoredFavorite).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ id: own.id, serverId: own.serverId }),
        aCopy()
      );
      expect(writeLocalCopy).toHaveBeenCalledWith(A, 'message-data', toggled(true).copy);
      // The seeded row is read back: the optimistic flip and the favourite
      // list are the rest of this action, and without these the whole `set()`
      // could be deleted with the case still green.
      expect(useAppStore.getState().messages).toEqual([{ ...own, isFavorite: true }]);
      expect(useAppStore.getState().messageHistory.favoriteIds).toContain(own.id);
      expect(useAppStore.getState().currentMessage?.isFavorite).toBe(true);
    });

    it('uses the committed boolean even when the UI starts stale', async () => {
      savedMessageData({ [A]: aCopy() });
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }], currentMessage: { ...own, isFavorite: false } });
      toggleStoredFavorite.mockResolvedValueOnce(toggled(false));
      await useAppStore.getState().toggleFavorite(own.id);
      expect(useAppStore.getState().messages[0].isFavorite).toBe(false);
      expect(useAppStore.getState().currentMessage?.isFavorite).toBe(false);
      expect(useAppStore.getState().messageHistory.favoriteIds).not.toContain(own.id);
    });

    it('discards the favorite write when the account changed mid-flight', async () => {
      savedMessageData({ [A]: aCopy() });
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      const pending = deferred<ReturnType<typeof toggled>>();
      toggleStoredFavorite.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().toggleFavorite(own.id);
      await vi.waitFor(() => expect(toggleStoredFavorite).toHaveBeenCalled());
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

      pending.settle(toggled(true));
      await inFlight;

      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      expect(useAppStore.getState().messageHistory.favoriteIds).toEqual(cFavoriteIds);
      expect(messageDataWrites()).toEqual([]);
    });

    it('discards the favorite write when the SAME account signs back in mid-flight', async () => {
      // `userId` is A again by the time the request lands, so an id-only
      // compare would let this through. `authSessionVersion` is the half
      // that distinguishes the dead session from the live one.
      savedMessageData({ [A]: aCopy() });
      const own = aCustomMessage();
      useAppStore.setState({ messages: [{ ...own, isFavorite: false }] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      const pending = deferred<ReturnType<typeof toggled>>();
      toggleStoredFavorite.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().toggleFavorite(own.id);
      await vi.waitFor(() => expect(toggleStoredFavorite).toHaveBeenCalled());

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

      pending.settle(toggled(true));
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().messages).toEqual([{ ...own, isFavorite: false }]);
      expect(useAppStore.getState().messageHistory.favoriteIds).toEqual(knownFavoriteIds);
      expect(messageDataWrites()).toEqual([]);
    });

    it('swallows a service rejection and does not write the favorite', async () => {
      savedMessageData({ [A]: aCopy() });
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
        expect(messageDataWrites()).toEqual([]);
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

    /** C's pool as the rotation sees it: C has no copy, so no favorites. */
    function cPool() {
      return cRotationPool().map((message) => ({ ...message, isFavorite: false }));
    }

    /**
     * Every rotation reload `setAuthUser` started. It starts them fire-and-forget,
     * but always synchronously, through the store's `loadMessages` -- so this
     * pass-through records each one's promise for the case to await, and an
     * empty list right after `setAuthUser` means no reload was asked for.
     */
    const realLoadMessages = useAppStore.getState().loadMessages;
    let reloads: Promise<void>[] = [];

    beforeEach(() => {
      reloads = [];
      useAppStore.setState({
        loadMessages: () => {
          const reload = realLoadMessages();
          reloads.push(reload);
          return reload;
        },
      });
    });

    afterEach(async () => {
      await Promise.allSettled(reloads);
      useAppStore.setState({ loadMessages: realLoadMessages });
    });

    it('reloads for the incoming account when one signs in over another', async () => {
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);
      getAllStoredMessages.mockResolvedValue(cRotationPool());

      useAppStore.getState().setAuthUser(C);
      expect(reloads).toHaveLength(1);
      await Promise.all(reloads);

      // Read for C, not for the account that just left.
      expect(readLocalCopy).toHaveBeenLastCalledWith(C, 'message-data');
      expect(useAppStore.getState().messages).toEqual(cPool());
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
      expect(reloads).toHaveLength(1);
      await Promise.all(reloads);

      expect(readLocalCopy).toHaveBeenLastCalledWith(C, 'message-data');
      expect(useAppStore.getState().messages).toEqual(cPool());
    });

    it('does not re-read IndexedDB when the same user is re-notified', async () => {
      // TOKEN_REFRESHED, INITIAL_SESSION and USER_UPDATED all land here for the
      // account that is already signed in, and none of them changes the pool.
      useAppStore.setState({ messages: aPool() } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      useAppStore.getState().setAuthUser(A);

      // A reload would have started inside that call.
      expect(reloads).toEqual([]);
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

      // A reload would have started inside that call.
      expect(reloads).toEqual([]);
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

      await Promise.all(reloads);

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
      // C's copy holds a row that must never reach D's screen.
      savedMessageData({ [C]: aCopy() });
      // The two reloads must be distinguishable: D's own switch fires a reload
      // of its own, and with one shared mock result the stale write and the
      // legitimate one are byte-identical — the assertion could not tell them
      // apart, and would pass with the guard deleted.
      getAllStoredMessages.mockReturnValueOnce(pending.promise).mockResolvedValue(dPool);

      useAppStore.getState().setAuthUser(C);
      // A third identity arrives before C's read comes back.
      useAppStore.getState().setAuthUser('USER-D-ID');

      pending.settle(cRotationPool());
      // Both reloads -- C's stale one and D's own -- have finished.
      expect(reloads).toHaveLength(2);
      await Promise.all(reloads);

      expect(useAppStore.getState().messages).toEqual(
        dPool.map((message) => ({ ...message, isFavorite: false }))
      );
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });
  });

  describe('loadCustomMessages', () => {
    it('discards the AdminPanel list when the account changed mid-flight', async () => {
      const pending = deferred<unknown>();
      readLocalCopy.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadCustomMessages();
      switchToUserC({ customMessages: cCustomList(), customMessagesLoaded: true });

      pending.settle(aCopy());
      await inFlight;

      expect(readLocalCopy).toHaveBeenCalledWith(A, 'message-data');
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });

    it('does not claim C’s list is loaded on A’s behalf when it fails', async () => {
      // The catch path writes `customMessages: []` AND `customMessagesLoaded:
      // true`. Unguarded, A's failure both blanks C's list and tells the
      // AdminPanel effect there is nothing left to fetch — so C's own load
      // never fires and the panel stays empty for the whole session.
      const pending = deferred<unknown>();
      readLocalCopy.mockReturnValue(pending.promise);

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

      pending.settle(aRemote());
      await inFlight;

      // The row IS written to the server, and it is A's — refusing the write
      // would lose a message the user really did save. It is C's store, and
      // either account's saved copy, that are withheld.
      expect(customCreate).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ category: 'custom' }),
        expect.any(String)
      );
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
      expect(messageDataWrites()).toEqual([]);
    });

    it('does not reload the rotation pool under the new account', async () => {
      const pending = deferred<unknown>();
      customCreate.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .createCustomMessage({ text: 'A-PRIVATE-CUSTOM-MESSAGE', category: 'custom' });
      await vi.waitFor(() => expect(customCreate).toHaveBeenCalled());
      switchToUserC({ messages: cRotationPool() });
      getAllStoredMessages.mockClear();

      pending.settle(aRemote());
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

      pending.settle(aRemote());
      await inFlight;

      expect(useAppStore.getState().customMessages).toEqual([]);
      expect(messageDataWrites()).toEqual([]);
    });
  });

  describe('updateCustomMessage', () => {
    it('does not repaint the new account’s list with the edit', async () => {
      savedMessageData({ [A]: aCopy() });
      const pending = deferred<unknown>();
      customUpdateMessage.mockReturnValue(pending.promise);

      const inFlight = useAppStore
        .getState()
        .updateCustomMessage({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' });
      await vi.waitFor(() => expect(customUpdateMessage).toHaveBeenCalled());
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });
      getAllStoredMessages.mockClear();

      pending.settle(aRemote());
      await inFlight;

      // The row edited is A's, found in A's copy.
      expect(customUpdateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7, userId: A, serverId: 'srv-a-7' }),
        expect.objectContaining({ id: 7 })
      );
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(getAllStoredMessages).not.toHaveBeenCalled();
      expect(messageDataWrites()).toEqual([]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-CUSTOM-MESSAGE');
    });

    it('sends nothing when the account changed before the queued edit started', async () => {
      savedMessageData({ [A]: aCopy() });

      const inFlight = useAppStore.getState().updateCustomMessage({ id: 7, text: 'X' });
      switchToUserC({ customMessages: cCustomList() });
      await inFlight;

      expect(customUpdateMessage).not.toHaveBeenCalled();
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
    });
  });

  describe('deleteCustomMessage', () => {
    it('does not remove a row from the new account’s list', async () => {
      // C's own row happens to carry the same local id A's did.
      savedMessageData({ [A]: { ...aCopy(), custom: [{ ...aCustomMessage(), id: 99 }] } });
      const pending = deferred<void>();
      customDeleteForUser.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().deleteCustomMessage(99);
      await vi.waitFor(() => expect(customDeleteForUser).toHaveBeenCalled());
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });
      getAllStoredMessages.mockClear();

      pending.settle();
      await inFlight;

      expect(customDeleteForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, userId: A })
      );
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(getAllStoredMessages).not.toHaveBeenCalled();
      expect(messageDataWrites()).toEqual([]);
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
        readLocalCopy.mockReturnValue(pending.promise);

        const inFlight = useAppStore.getState().exportCustomMessages();
        switchToUserC();

        pending.settle(aCopy());
        await inFlight;

        expect(readLocalCopy).toHaveBeenCalledWith(A, 'message-data');
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
      const creating = deferred<unknown>();
      customCreate.mockReturnValue(creating.promise);

      const inFlight = useAppStore.getState().importCustomMessages(importFile(fileRead.promise));

      // The switch lands while the FILE is still being read, BEFORE the service
      // is called at all. An owner read live at the call site would be C's, and
      // C would silently acquire a copy of every message in A's backup.
      switchToUserC({ customMessages: cCustomList(), messages: cRotationPool() });
      getAllStoredMessages.mockClear();

      fileRead.settle(JSON.stringify(exportFile()));
      await vi.waitFor(() => expect(customCreate).toHaveBeenCalled());
      creating.settle({ ...aRemote('A-IMPORTED-MESSAGE'), serverId: 'srv-imported' });

      // The caller still learns what happened to THEIR import…
      await expect(inFlight).resolves.toEqual({ imported: 1, skipped: 0 });
      // …the rows carry A's id, because it was captured before the switch…
      expect(customCreate).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ text: 'A-IMPORTED-MESSAGE' }),
        expect.any(String)
      );
      // …duplicates were judged against A's copy, never C's…
      expect(readLocalCopy).not.toHaveBeenCalledWith(C, 'message-data');
      // …and C's store is untouched, neither list nor rotation pool, nor either copy.
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      expect(messageDataWrites()).toEqual([]);
    });
  });

  // ==========================================================================
  // photosSlice
  // ==========================================================================

  describe('loadPhotos', () => {
    it('discards the gallery when the account changed', async () => {
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [cPhoto()] });

      pending.settle([{ ...aPhoto(), caption: 'A-PHOTO-CAPTION' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PHOTO-CAPTION');
      // Nor is A's list saved as anyone's copy.
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('does not paint the previous account\'s failure onto the new one', async () => {
      // The failure path writes `photosLoadError`, which the gallery renders.
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      switchToUserC({ photos: [cPhoto()], error: null, photosLoadError: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().photosLoadError).toBeNull();
      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
    });

    it('writes nothing when the SAME account signs back in mid-flight', async () => {
      const pending = deferred<unknown[]>();
      listAllPhotos.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPhotos();
      // The held read is really reached, so the guard below is what is measured.
      await vi.waitFor(() => expect(listAllPhotos).toHaveBeenCalled());
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);
      useAppStore.setState({ photos: [aGalleryRow()] } as unknown as Parameters<
        typeof useAppStore.setState
      >[0]);

      pending.settle([{ ...aPhoto(), id: 'dead-session-row', caption: 'DEAD-SESSION-ROW' }]);
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([aGalleryRow()]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // photosSlice — upload / delete (CAP-12)
  //
  // An upload spans four awaits, so the window here is seconds wide rather
  // than one round trip. Every case seeds C's own gallery first, so a guard
  // that fails to discard is caught by C's row being replaced; the failure and
  // quota cases also seed C's `error` / `storageWarning` as null, the keys
  // those stale writes would fill.
  // ==========================================================================

  describe('uploadPhoto', () => {
    it("does not drop the previous account's photo into this one's gallery", async () => {
      const pending = deferred<unknown>();
      uploadPhotoService.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()] });

      pending.settle(aPhoto());
      await inFlight;

      expect(useAppStore.getState().photos).toEqual([cPhoto()]);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PRIVATE-PHOTO');
      // Nor is it saved into anyone's `photos` copy.
      expect(writeLocalCopy).not.toHaveBeenCalled();
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
      switchToUserC({ photos: [cPhoto()], error: null });

      pending.fail(new Error('A-REQUEST-FAILURE'));

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'A-REQUEST-FAILURE',
      });
      expect(useAppStore.getState().error).toBeNull();
    });

    it("does not reject the new account's session over the previous one's quota", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValue(quota.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], error: null });

      quota.settle({ used: 97, quota: 100, percent: 97, warning: 'critical' });

      await expect(inFlight).resolves.toEqual({
        success: false,
        error: 'Storage nearly full (97%) - delete photos to continue',
      });
      expect(useAppStore.getState().error).toBeNull();
    });

    it("does not raise the pre-upload storage warning against the new account", async () => {
      const quota = deferred<unknown>();
      checkStorageQuota.mockReturnValueOnce(quota.promise);
      // Parked, so the assertion below runs while THIS guard is the only one
      // the upload has reached; each guard has to be provable on its own cases.
      const upload = deferred<unknown>();
      uploadPhotoService.mockReturnValue(upload.promise);

      const inFlight = useAppStore.getState().uploadPhoto(uploadInput());
      switchToUserC({ photos: [cPhoto()], storageWarning: null });

      // Between 80 and 95: A's account is filling up, C's is not.
      quota.settle({ used: 850, quota: 1_000, percent: 85, warning: 'approaching' });
      // The warning is written, or not, before the upload starts.
      await vi.waitFor(() => expect(uploadPhotoService).toHaveBeenCalled());

      expect(useAppStore.getState().storageWarning).toBeNull();

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
      // Parked on the post-upload quota read, past the insert.
      await vi.waitFor(() => expect(checkStorageQuota).toHaveBeenCalledTimes(2));

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
    /** Wait until the loader has reached the server read, past the copy read. */
    async function untilServerRead(): Promise<void> {
      await vi.waitFor(() => expect(getPartner).toHaveBeenCalled());
    }

    it('discards the partner when the account changed', async () => {
      const pending = deferred<unknown>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      await untilServerRead();
      switchToUserC({ partner: PARTNER_C });

      pending.settle({ status: 'linked', partner: PARTNER_A });
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(JSON.stringify(useAppStore.getState())).not.toContain('A-PARTNER-NAME');
      // Neither shown nor saved: not under C, and not under A after the switch.
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it("discards A's saved copy when the account changed during the copy read", async () => {
      const copy = deferred<unknown>();
      readLocalCopy.mockReturnValue(copy.promise);

      const inFlight = useAppStore.getState().loadPartner();
      switchToUserC({ partner: PARTNER_C });

      copy.settle({ status: 'linked', partner: PARTNER_A });
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
      expect(getPartner).not.toHaveBeenCalled();
    });

    it('still releases the spinner when it discards', async () => {
      const pending = deferred<unknown>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      await untilServerRead();
      switchToUserC();
      expect(useAppStore.getState().isLoadingPartner).toBe(true);

      pending.settle({ status: 'linked', partner: PARTNER_A });
      await inFlight;

      // Stuck true renders neither branch of the partner tab.
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
    });

    it("does not blank the new account's partner when the old request fails", async () => {
      // The error path must not write over what the new account already shows.
      const pending = deferred<unknown>();
      getPartner.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPartner();
      await untilServerRead();
      switchToUserC({ partner: PARTNER_C });

      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().partner).toEqual(PARTNER_C);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
      expect(useAppStore.getState().partnerLoadError).toBe(false);
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

    it('discards requests when the SAME account signs back in mid-flight', async () => {
      // `userId` is A again by the time the request lands, so only the
      // authSessionVersion half of the guard can tell the sessions apart.
      const pending = deferred<{ sent: unknown[]; received: unknown[] }>();
      getPendingRequests.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().loadPendingRequests();
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);

      pending.settle({
        sent: [{ id: 'req-1', toEmail: 'DEAD-SESSION-EMAIL' }],
        received: [],
      });
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().sentRequests).toEqual([]);
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

    it('discards search hits when the SAME account signs back in mid-flight', async () => {
      const pending = deferred<unknown[]>();
      searchUsers.mockReturnValue(pending.promise);

      const inFlight = useAppStore.getState().searchUsers('alex');
      useAppStore.getState().clearAuth();
      useAppStore.getState().setAuthUser(A);

      pending.settle([{ id: 'USER-E-ID', displayName: 'DEAD-SESSION-HIT' }]);
      await inFlight;

      expect(useAppStore.getState().userId).toBe(A);
      expect(useAppStore.getState().searchResults).toEqual([]);
      expect(useAppStore.getState().isSearching).toBe(false);
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

    it.each([
      [
        'success',
        (pending: ReturnType<typeof deferred<unknown[]>>) => pending.settle([aEvent]),
        { status: 'success' },
        [aEvent],
        null,
      ],
      [
        'failure',
        (pending: ReturnType<typeof deferred<unknown[]>>) => pending.fail(new Error('CURRENT-SESSION-FAILURE')),
        { status: 'failure', error: 'CURRENT-SESSION-FAILURE' },
        [],
        'CURRENT-SESSION-FAILURE',
      ],
    ] as const)(
      'allows current-session %s after a same-user auth refresh',
      async (_outcome, settle, expectedResult, expectedEvents, expectedError) => {
        const pending = deferred<unknown[]>();
        getEvents.mockReturnValue(pending.promise);
        const inFlight = useAppStore.getState().loadEvents();
        const version = useAppStore.getState().authSessionVersion;

        useAppStore.getState().setAuthUser(A, 'refreshed@example.com');
        expect(useAppStore.getState().authSessionVersion).toBe(version);
        settle(pending);

        expect(await inFlight).toEqual(expectedResult);
        expect(useAppStore.getState().eventsIsLoading).toBe(false);
        expect(useAppStore.getState().events).toEqual(expectedEvents);
        expect(useAppStore.getState().eventsError).toBe(expectedError);
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
      getPartner.mockResolvedValue({ status: 'linked', partner: PARTNER_A });

      await useAppStore.getState().loadPartner();

      expect(useAppStore.getState().partner).toEqual(PARTNER_A);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
      expect(writeLocalCopy).toHaveBeenCalledWith(A, 'partner', {
        status: 'linked',
        partner: PARTNER_A,
      });
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
      savedMessageData({ [A]: aCopy() });

      await useAppStore.getState().loadMessages();

      expect(useAppStore.getState().messages).toEqual([
        { ...cRotationPool()[0], isFavorite: false },
        aCustomMessage(),
      ]);
    });

    it('loadCustomMessages writes normally', async () => {
      savedMessageData({ [A]: aCopy() });

      await useAppStore.getState().loadCustomMessages();

      expect(useAppStore.getState().customMessages).toEqual([
        expect.objectContaining({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' }),
      ]);
      expect(useAppStore.getState().customMessagesLoaded).toBe(true);
    });

    it('createCustomMessage writes normally', async () => {
      customCreate.mockResolvedValue(aRemote());

      await useAppStore
        .getState()
        .createCustomMessage({ text: 'A-PRIVATE-CUSTOM-MESSAGE', category: 'custom' });

      expect(useAppStore.getState().customMessages).toEqual([
        expect.objectContaining({ text: 'A-PRIVATE-CUSTOM-MESSAGE' }),
      ]);
      // The confirmed row is saved in A's copy…
      expect(messageDataWrites()).toEqual([
        [A, 'message-data', expect.objectContaining({ custom: [expect.objectContaining({ serverId: 'srv-a-7' })] })],
      ]);
      // …and it still refreshes the rotation pool afterwards.
      expect(readLocalCopy).toHaveBeenLastCalledWith(A, 'message-data');
    });

    it('updateCustomMessage and deleteCustomMessage write normally', async () => {
      savedMessageData({ [A]: aCopy() });
      customUpdateMessage.mockResolvedValue(aRemote('A-EDITED'));
      customDeleteForUser.mockResolvedValue(undefined);
      await useAppStore.getState().loadCustomMessages();

      await useAppStore.getState().updateCustomMessage({ id: 7, text: 'A-EDITED' });
      expect(useAppStore.getState().customMessages[0].text).toBe('A-EDITED');

      await useAppStore.getState().deleteCustomMessage(7);
      expect(useAppStore.getState().customMessages).toEqual([]);
      expect(messageDataWrites()).toHaveLength(2);
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
        savedMessageData({ [A]: aCopy() });

        await useAppStore.getState().exportCustomMessages();

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('importCustomMessages writes normally', async () => {
      customCreate.mockResolvedValue({ ...aRemote('A-IMPORTED-MESSAGE'), serverId: 'srv-imported' });

      await expect(
        useAppStore
          .getState()
          .importCustomMessages(importFile(Promise.resolve(JSON.stringify(exportFile()))))
      ).resolves.toEqual({ imported: 1, skipped: 0 });

      expect(messageDataWrites()).toHaveLength(1);
      expect(readLocalCopy).toHaveBeenLastCalledWith(A, 'message-data');
    });

    it('loadEvents writes normally', async () => {
      getEvents.mockResolvedValue([{ id: 'a-event', label: 'A-EVENT' }]);

      await useAppStore.getState().loadEvents();

      expect(useAppStore.getState().events).toEqual([{ id: 'a-event', label: 'A-EVENT' }]);
      expect(useAppStore.getState().eventsIsLoading).toBe(false);
    });

    it('uploadPhoto writes normally', async () => {
      uploadPhotoService.mockResolvedValue(aPhoto());

      await expect(useAppStore.getState().uploadPhoto(uploadInput())).resolves.toEqual({
        success: true,
      });

      // No signed URL: the image is shown from the cache or downloaded by path.
      expect(useAppStore.getState().photos).toEqual([{ ...aPhoto(), signedUrl: null, isOwn: true }]);
    });

    it('uploadPhoto still rejects on a full quota', async () => {
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
  });
});
