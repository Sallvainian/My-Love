/**
 * A loader that resolves after the signed-in user changes must not write
 *
 * Sign Out sits in the bottom nav of the very screens that fire these loaders,
 * and the request goes out with a still-valid token — so it succeeds, and its
 * `set()` lands after `clearAuth` has already reset the store. Without a guard
 * that puts the previous account's chat, partner, photos and mood notes straight
 * back on screen for whoever signs in next.
 *
 * This file: the eventsSlice loaders and writes.
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
import type { CoupleEvent } from '../../../src/services/eventsService';
import {
  A,
  C,
  deferred,
  resetStoreSignedInAsA,
  storageQuota,
  switchToUserC,
} from './loaderIdentityGuardsFixture';

/**
 * A complete CoupleEvent, A's private one unless overridden. `createdAt` is
 * left out unless a case passes it, as the rows here always did.
 */
function coupleEvent(
  overrides: Partial<CoupleEvent> = {}
): Omit<CoupleEvent, 'createdAt'> & Partial<Pick<CoupleEvent, 'createdAt'>> {
  return {
    id: 'a-event',
    userId: A,
    label: 'A-PRIVATE-EVENT-LABEL',
    date: new Date(2026, 9, 31),
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

/**
 * C's event as a deliberately partial stub: the cases using it only check that
 * C's list is kept or replaced, and nothing sorts it.
 */
function cEventStub() {
  return { id: 'c-event', label: 'C-OWN-EVENT-LABEL' };
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
    const aEvent = coupleEvent({ createdAt: new Date(2026, 0, 1) });

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
      switchToUserC({ events: [cEventStub()] });

      pending.settle([{ id: 'a-event', label: 'A-PRIVATE-EVENT-LABEL' }]);
      await inFlight;

      expect(useAppStore.getState().events).toEqual([cEventStub()]);
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
        events: [cEventStub()],
        eventsError: null,
        eventsIsLoading: true,
      });
      pending.fail(new Error('A-REQUEST-FAILURE'));
      await inFlight;

      expect(useAppStore.getState().eventsIsLoading).toBe(true);
      // The error must not land on the account that did not make the request,
      // and C's own list must stay intact.
      expect(useAppStore.getState().eventsError).toBeNull();
      expect(useAppStore.getState().events).toEqual([cEventStub()]);
    });
  });

  // The three write actions set() after their await too, so each carries the
  // same guard. Without these describes, deleting any one of the three guards
  // leaves the whole suite green — the failure loaderIdentityGuardsFixture.ts's
  // header records.

  describe('addEvent', () => {
    it('does not drop the previous account\'s new event into this one\'s list', async () => {
      const pending = deferred<unknown>();
      createEvent.mockReturnValue(pending.promise);

      // C's row is a COMPLETE CoupleEvent on purpose. `sortByDate` reads
      // `.date.getTime()`, so a `{ id, label }` stub throws inside the set()
      // updater — which the catch swallows, making this test pass with the
      // guard deleted. Verified: with a stub it does not discriminate.
      const cOwnEvent = coupleEvent({
        id: 'c-event',
        userId: C,
        label: 'C-OWN-EVENT-LABEL',
        date: new Date(2026, 11, 25),
      });

      const inFlight = useAppStore.getState().addEvent({
        label: 'A-PRIVATE-EVENT-LABEL',
        eventDate: '2026-10-31',
      });
      switchToUserC({ events: [cOwnEvent] });

      pending.settle(coupleEvent());
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

      pending.settle(coupleEvent());
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
    it("an events load shows the account's events and stops loading", async () => {
      getEvents.mockResolvedValue([{ id: 'a-event', label: 'A-EVENT' }]);

      await useAppStore.getState().loadEvents();

      expect(useAppStore.getState().events).toEqual([{ id: 'a-event', label: 'A-EVENT' }]);
      expect(useAppStore.getState().eventsIsLoading).toBe(false);
    });
  });
});
