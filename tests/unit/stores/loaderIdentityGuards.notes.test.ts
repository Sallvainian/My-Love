/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the notesSlice loaders (`fetchNotes`, `fetchOlderNotes`, `removeNote`).
 * Why these tests switch identity directly instead of calling clearAuth is
 * recorded in `loaderIdentityGuardsFixture.ts`.
 *
 * THE LOADING FLAG IS HALF THE GUARD. It is raised BEFORE the await, so an early
 * return that only skips the write leaves it true forever. `PartnerMoodView`
 * gates both of its branches on `isLoadingPartner` — so a stranded flag is a
 * permanently blank tab, not a cosmetic wobble.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
import {
  A,
  deferred,
  resetStoreSignedInAsA,
  storageQuota,
  switchToUserC,
} from './loaderIdentityGuardsFixture';

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

describe('loader identity guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetStoreSignedInAsA();

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
    checkStorageQuota.mockResolvedValue(storageQuota(0, 'none'));
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

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it("a notes fetch shows the account's notes and stops loading", async () => {
      loveNotesQuery.mockReturnValue(
        loveNotesBuilder(Promise.resolve({ data: [note('a1', 'A-CHAT')], error: null }))
      );

      await useAppStore.getState().fetchNotes();

      expect(useAppStore.getState().notes).toEqual([note('a1', 'A-CHAT')]);
      expect(useAppStore.getState().notesIsLoading).toBe(false);
    });
  });
});
