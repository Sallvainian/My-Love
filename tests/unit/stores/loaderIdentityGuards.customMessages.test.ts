/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the AdminPanel custom-message actions — load, create, update,
 * delete, export and import.
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

  /** Answer message-data reads from `copies` by account; every other kind is empty. */
  function savedMessageData(copies: Record<string, unknown>) {
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      kind === 'message-data' ? (copies[userId] ?? null) : null
    );
  }

  function messageDataWrites() {
    return writeLocalCopy.mock.calls.filter(([, kind]) => kind === 'message-data');
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
    /**
     * Starts A's import, switches to C while the file is still being read, and
     * lets the server create land. Returns the import, which may still be settling.
     */
    async function importAcrossSwitchToC() {
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
      return { inFlight };
    }

    it('still reports the import result to the caller after a switch to C', async () => {
      const { inFlight } = await importAcrossSwitchToC();

      await expect(inFlight).resolves.toEqual({ imported: 1, skipped: 0 });
    });

    it('stamps the imported rows with A, captured before the switch', async () => {
      const { inFlight } = await importAcrossSwitchToC();
      await inFlight;

      expect(customCreate).toHaveBeenCalledWith(
        A,
        expect.objectContaining({ text: 'A-IMPORTED-MESSAGE' }),
        expect.any(String)
      );
    });

    it("judges duplicates against A's copy, never C's", async () => {
      const { inFlight } = await importAcrossSwitchToC();
      await inFlight;

      expect(readLocalCopy).not.toHaveBeenCalledWith(C, 'message-data');
    });

    it("leaves C's lists and saved copy untouched", async () => {
      const { inFlight } = await importAcrossSwitchToC();
      await inFlight;

      // Neither list nor rotation pool, nor either copy.
      expect(useAppStore.getState().customMessages).toEqual(cCustomList());
      expect(useAppStore.getState().messages).toEqual(cRotationPool());
      expect(messageDataWrites()).toEqual([]);
    });
  });

  // ==========================================================================
  // The ordinary path the guards wrap
  // ==========================================================================

  describe('when the identity has not changed', () => {
    it("a custom-messages load lists the account's saved custom message and marks the list loaded", async () => {
      savedMessageData({ [A]: aCopy() });

      await useAppStore.getState().loadCustomMessages();

      expect(useAppStore.getState().customMessages).toEqual([
        expect.objectContaining({ id: 7, text: 'A-PRIVATE-CUSTOM-MESSAGE' }),
      ]);
      expect(useAppStore.getState().customMessagesLoaded).toBe(true);
    });

    it("a created custom message is listed, saved to the account's copy, and the rotation pool re-read", async () => {
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

    /** Lists A's saved custom message (id 7) from A's copy. */
    async function loadACustomMessage() {
      savedMessageData({ [A]: aCopy() });
      await useAppStore.getState().loadCustomMessages();
    }

    it("an edited custom message shows its new text and is saved to the account's copy", async () => {
      customUpdateMessage.mockResolvedValue(aRemote('A-EDITED'));
      await loadACustomMessage();

      await useAppStore.getState().updateCustomMessage({ id: 7, text: 'A-EDITED' });
      expect(useAppStore.getState().customMessages[0].text).toBe('A-EDITED');
      expect(messageDataWrites()).toHaveLength(1);
    });

    it("a deleted custom message leaves the list and the account's copy is saved", async () => {
      customDeleteForUser.mockResolvedValue(undefined);
      await loadACustomMessage();
      expect(useAppStore.getState().customMessages).toHaveLength(1);

      await useAppStore.getState().deleteCustomMessage(7);
      expect(useAppStore.getState().customMessages).toEqual([]);
      expect(messageDataWrites()).toHaveLength(1);
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

    it("an import reports one imported row, saves it to the account's copy and re-reads the rotation pool", async () => {
      customCreate.mockResolvedValue({ ...aRemote('A-IMPORTED-MESSAGE'), serverId: 'srv-imported' });

      await expect(
        useAppStore
          .getState()
          .importCustomMessages(importFile(Promise.resolve(JSON.stringify(exportFile()))))
      ).resolves.toEqual({ imported: 1, skipped: 0 });

      expect(messageDataWrites()).toHaveLength(1);
      expect(readLocalCopy).toHaveBeenLastCalledWith(A, 'message-data');
    });
  });
});
