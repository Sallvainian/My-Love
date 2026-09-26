/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the rotation pool — `loadMessages`, `toggleFavorite`, and the
 * reload `setAuthUser` starts on an account switch.
 * Why these tests switch identity directly instead of calling clearAuth is
 * recorded in `loaderIdentityGuardsFixture.ts`.
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
import {
  A,
  C,
  aCopy,
  aCustomMessage,
  cRotationPool,
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

  /** Answer message-data reads from `copies` by account; every other kind is empty. */
  function savedMessageData(copies: Record<string, unknown>) {
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      kind === 'message-data' ? (copies[userId] ?? null) : null
    );
  }

  function messageDataWrites() {
    return writeLocalCopy.mock.calls.filter(([, kind]) => kind === 'message-data');
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

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it("a messages load shows the bundled pool plus the account's saved custom message", async () => {
      getAllStoredMessages.mockResolvedValue(cRotationPool());
      savedMessageData({ [A]: aCopy() });

      await useAppStore.getState().loadMessages();

      expect(useAppStore.getState().messages).toEqual([
        { ...cRotationPool()[0], isFavorite: false },
        aCustomMessage(),
      ]);
    });
  });
});
