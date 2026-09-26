/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the interactionsSlice and partnerSlice loaders.
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

const PARTNER_A = { id: 'USER-B-ID', displayName: 'A-PARTNER-NAME', email: 'b@example.com' };
const PARTNER_C = { id: 'USER-D-ID', displayName: 'C-PARTNER-NAME', email: 'd@example.com' };

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

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it("a partner load shows the linked partner and saves it to the account's partner copy", async () => {
      getPartner.mockResolvedValue({ status: 'linked', partner: PARTNER_A });

      await useAppStore.getState().loadPartner();

      expect(useAppStore.getState().partner).toEqual(PARTNER_A);
      expect(useAppStore.getState().isLoadingPartner).toBe(false);
      expect(writeLocalCopy).toHaveBeenCalledWith(A, 'partner', {
        status: 'linked',
        partner: PARTNER_A,
      });
    });
  });
});
