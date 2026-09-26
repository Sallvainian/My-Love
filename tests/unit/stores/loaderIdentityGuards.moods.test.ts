/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the moodSlice loaders (`loadMoods`, `fetchPartnerMoods`, `updateSyncStatus`).
 * Why these tests switch identity directly instead of calling clearAuth is
 * recorded in `loaderIdentityGuardsFixture.ts`.
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
  // moodSlice
  // ==========================================================================

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
});
