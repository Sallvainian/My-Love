import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { SettingsSlice } from '../../../src/stores/slices/settingsSlice';
import { projectMessageFavorites } from '../../../src/services/messageFavorites';
import type { Message } from '../../../src/types';

const mockStorageService = {
  init: vi.fn(),
  getAllMessages: vi.fn(),
  addMessages: vi.fn(),
};

const mockLoadDefaultMessages = vi.fn();
const mockReadMessageData = vi.fn();

vi.mock('../../../src/services/storage', () => ({
  storageService: mockStorageService,
}));

vi.mock('../../../src/data/defaultMessagesLoader', () => ({
  loadDefaultMessages: mockLoadDefaultMessages,
}));

// The account's own custom messages and favorites: its message-data copy.
vi.mock('../../../src/services/customMessageService', () => ({
  readMessageData: mockReadMessageData,
}));

const SIGNED_IN_USER = 'USER-A-ID';
const USER_C = 'USER-C-ID';

type TestState = SettingsSlice & {
  __isHydrated: boolean;
  userId: string | null;
  authSessionVersion: number;
  isLoading: boolean;
  error: string | null;
  messages: Message[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateCurrentMessage: () => void;
  loadMessages: () => Promise<void>;
};

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

/** A bundled daily message unless `overrides` say otherwise. */
function message(id: number, text: string, overrides: Partial<Message> = {}): Message {
  return { id, text, category: 'reason', isCustom: false, createdAt: new Date(), ...overrides };
}

function aOutgoingPool(): Message[] {
  return [message(7, 'A-OUTGOING-CUSTOM', { category: 'custom', isCustom: true })];
}

function cIncomingPool(): Message[] {
  return [message(1, 'C-INCOMING-DAILY')];
}

function sharedDailyPool(): Message[] {
  return [message(1, 'SHARED-DAILY')];
}

const buildTestStore = async () => {
  vi.resetModules();

  const { createSettingsSlice } = await import('../../../src/stores/slices/settingsSlice');
  const updateCurrentMessage = vi.fn();
  const loadMessagesRequestedBy: Array<string | null> = [];
  /**
   * Every `loadMessages` run, as the promise its caller got. The handoff chains
   * its completion onto that promise before a test can, so awaiting the run
   * resumes the test only after the handoff has acted on it.
   */
  const loadMessagesRuns: Array<Promise<void>> = [];

  const store = create<TestState>()((set, get, api) => ({
    __isHydrated: true,
    // `initializeApp` reads this to scope its message load. Without it the
    // slice's `get().userId` is undefined and every assertion below passes
    // whether the argument is the signed-in user or a hardcoded null — which
    // would empty every user's rotation pool of their own custom rows.
    userId: SIGNED_IN_USER,
    authSessionVersion: 1,
    isLoading: false,
    error: null,
    messages: [],
    setLoading: (loading) => {
      set({ isLoading: loading });
    },
    setError: (error) => {
      set({ error });
    },
    updateCurrentMessage,
    /**
     * Faithful to `messagesSlice.loadMessages`, including the try/catch.
     *
     * The catch is not decoration. Production swallows its own read failure
     * (`src/stores/slices/messagesSlice.ts:104-107`), which is precisely why
     * `initializeApp`'s handoff chain attaches a `.catch()` for
     * `updateCurrentMessage` instead: nothing else in that chain can reject.
     * A double that rethrows here would give the chain a rejection route
     * production does not have, and the case asserting that `.catch()` would
     * then be green for the wrong reason (DW-137).
     */
    loadMessages: () => {
      const run = (async () => {
        const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
        loadMessagesRequestedBy.push(requestedBy);
        try {
          // Same reads as production: the shared bundled rows, plus the copy of
          // the account that raised the load.
          const [bundled, copy] = await Promise.all([
            mockStorageService.getAllMessages(),
            requestedBy ? mockReadMessageData(requestedBy) : Promise.resolve(null),
          ]);
          if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) {
            return;
          }
          set({ messages: projectMessageFavorites(bundled, copy) });
        } catch (error) {
          console.error('[MessagesSlice] Failed to load messages:', error);
        }
      })();
      loadMessagesRuns.push(run);
      return run;
    },
    ...createSettingsSlice(
      set as unknown as Parameters<typeof createSettingsSlice>[0],
      get as unknown as Parameters<typeof createSettingsSlice>[1],
      api as unknown as Parameters<typeof createSettingsSlice>[2]
    ),
  }));

  /**
   * Resolves once the most recent `loadMessages` run, and the handoff chained on
   * it, are done. Throws when no run was recorded, rather than resuming at once.
   */
  const lastLoadSettled = () => {
    const run = loadMessagesRuns.at(-1);
    if (!run) throw new Error('lastLoadSettled: no loadMessages run was recorded');
    return run;
  };

  return { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled };
};

/** The pool as the rotation sees it: no copy, so no favorites. */
function unfavorited(pool: Message[]): Message[] {
  return pool.map((message) => ({ ...message, isFavorite: false }));
}

describe('createSettingsSlice initializeApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadMessageData.mockResolvedValue(null);
  });

  /** Initializes against an empty IndexedDB, so the bundled defaults are seeded and re-read. */
  async function initializeEmptyDb() {
    const seededMessages = [message(1, 'Seeded', { category: 'memory' })];

    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(seededMessages);
    mockStorageService.addMessages.mockResolvedValue(undefined);
    mockLoadDefaultMessages.mockResolvedValue([{ text: 'Seeded', category: 'memory' }]);

    const { store, updateCurrentMessage } = await buildTestStore();
    await store.getState().initializeApp();
    return { store, updateCurrentMessage, seededMessages };
  }

  it('seeds the bundled defaults when IndexedDB has no messages', async () => {
    await initializeEmptyDb();

    expect(mockLoadDefaultMessages).toHaveBeenCalledTimes(1);
    expect(mockStorageService.addMessages).toHaveBeenCalledTimes(1);
    expect(mockStorageService.addMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Seeded',
          category: 'memory',
          isCustom: false,
          createdAt: expect.any(Date),
        }),
      ])
    );
  });

  it("re-reads the shared bundled rows after seeding and reads the account's rows from its copy", async () => {
    await initializeEmptyDb();

    expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(2);
    // Both reads — the "is this database seeded?" check and the re-read for
    // auto-generated ids — are of the shared bundled rows; the signed-in
    // account's own rows come from its copy.
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(1);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2);
    expect(mockReadMessageData).toHaveBeenCalledWith(SIGNED_IN_USER);
  });

  it('publishes the seeded pool and picks a current message', async () => {
    const { store, updateCurrentMessage, seededMessages } = await initializeEmptyDb();

    expect(store.getState().messages).toEqual(unfavorited(seededMessages));
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('skips default message loader when IndexedDB already contains messages', async () => {
    const existingMessages = [message(42, 'Already stored')];

    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockResolvedValue(existingMessages);

    const { store, updateCurrentMessage } = await buildTestStore();
    await store.getState().initializeApp();

    expect(mockLoadDefaultMessages).not.toHaveBeenCalled();
    expect(mockStorageService.addMessages).not.toHaveBeenCalled();
    expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1);
    expect(store.getState().messages).toEqual(unfavorited(existingMessages));
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('adds the signed-in account’s saved custom messages and favorites to the pool', async () => {
    const bundled = message(42, 'Daily');
    const custom = message(400, 'Mine', {
      category: 'custom', isCustom: true, userId: SIGNED_IN_USER,
      serverId: 'srv-mine', active: true, isFavorite: true,
    });
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockResolvedValue([bundled]);
    mockReadMessageData.mockResolvedValue({ custom: [custom], bundledFavoriteIds: [42], nextCustomId: 401 });

    const { store } = await buildTestStore();
    await store.getState().initializeApp();

    expect(store.getState().messages).toEqual([{ ...bundled, isFavorite: true }, custom]);
    expect((store.getState() as unknown as { messageHistory?: { favoriteIds: number[] } }).messageHistory?.favoriteIds)
      .toEqual([42, 400]);
  });

  /**
   * Starts initialization on a seeded database and switches to C while the
   * first read is held. Stops at `await inFlight`, with the handoff read under
   * C still pending.
   */
  async function switchToCDuringSeededInit() {
    const initRead = deferred<Message[]>();
    const handoffRead = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockReturnValueOnce(initRead.promise)
      .mockReturnValueOnce(handoffRead.promise);

    const { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled } =
      await buildTestStore();
    const inFlight = store.getState().initializeApp();
    // Parked on the held read, so the switch lands mid-flight.
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1));

    store.setState({
      userId: USER_C,
      authSessionVersion: store.getState().authSessionVersion + 1,
    });
    initRead.settle(aOutgoingPool());
    await inFlight;
    return { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled, handoffRead };
  }

  it('withholds the stale pool when the account changes mid-flight (seeded)', async () => {
    const { store, updateCurrentMessage } = await switchToCDuringSeededInit();

    // Stale `set({ messages })` did not land — cold-boot `messages` is still
    // empty, and the outgoing account's rows are not on screen.
    expect(store.getState().messages).toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).not.toHaveBeenCalled();
    expect(store.getState().isLoading).toBe(false);
  });

  it("hands off a re-read under C and never reads the outgoing account's copy (seeded)", async () => {
    const { loadMessagesRequestedBy } = await switchToCDuringSeededInit();

    // Handoff was issued under C, but its write has not landed yet.
    expect(loadMessagesRequestedBy).toEqual([USER_C]);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(1);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2);
    // The handoff reads C's copy; the outgoing account's is never read once
    // the session has moved on.
    expect(mockReadMessageData).toHaveBeenCalledWith(USER_C);
    expect(mockReadMessageData).not.toHaveBeenCalledWith(SIGNED_IN_USER);
  });

  it("publishes C's pool once the handoff read lands (seeded)", async () => {
    const { store, updateCurrentMessage, lastLoadSettled, handoffRead } =
      await switchToCDuringSeededInit();

    const incoming = cIncomingPool();
    handoffRead.settle(incoming);
    await lastLoadSettled();

    expect(store.getState().messages).toEqual(unfavorited(incoming));
    expect(store.getState().messages).not.toEqual([]);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('latches initialization after the handoff, so a second initializeApp reads nothing (seeded)', async () => {
    const { store, lastLoadSettled, handoffRead } = await switchToCDuringSeededInit();
    handoffRead.settle(cIncomingPool());
    await lastLoadSettled();

    // The handoff, not a re-init, recovered the pool: `isInitialized` latches.
    mockStorageService.getAllMessages.mockClear();
    await store.getState().initializeApp();
    expect(mockStorageService.getAllMessages).not.toHaveBeenCalled();
  });

  it('still seeds the shared defaults, withholds the re-read, and hands off when the empty-DB branch is stale', async () => {
    const secondRead = deferred<Message[]>();
    const handoffRead = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(secondRead.promise)
      .mockReturnValueOnce(handoffRead.promise);
    mockStorageService.addMessages.mockResolvedValue(undefined);
    mockLoadDefaultMessages.mockResolvedValue([{ text: 'Seeded', category: 'memory' }]);

    const { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled } =
      await buildTestStore();
    const inFlight = store.getState().initializeApp();

    // First read returned `[]`, so the seeding branch is in flight on the
    // re-read. Switching now is what makes a deleted guard on THAT `set()` fail.
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(2));
    expect(mockStorageService.addMessages).toHaveBeenCalledTimes(1);

    store.setState({
      userId: USER_C,
      authSessionVersion: store.getState().authSessionVersion + 1,
    });
    secondRead.settle(aOutgoingPool());
    await inFlight;

    expect(store.getState().messages).toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).not.toHaveBeenCalled();
    expect(store.getState().isLoading).toBe(false);
    expect(loadMessagesRequestedBy).toEqual([USER_C]);

    const incoming = cIncomingPool();
    handoffRead.settle(incoming);
    await lastLoadSettled();

    expect(store.getState().messages).toEqual(unfavorited(incoming));
    expect(store.getState().messages).not.toEqual([]);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('hands off a shared-daily pool when sign-out lands mid-flight', async () => {
    const initRead = deferred<Message[]>();
    const handoffRead = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockReturnValueOnce(initRead.promise)
      .mockReturnValueOnce(handoffRead.promise);

    const { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled } =
      await buildTestStore();
    const inFlight = store.getState().initializeApp();
    // Parked on the held read, so the sign-out lands mid-flight.
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1));

    store.setState({
      userId: null,
      authSessionVersion: store.getState().authSessionVersion + 1,
    });
    initRead.settle(aOutgoingPool());
    await inFlight;

    expect(store.getState().messages).toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).not.toHaveBeenCalled();
    expect(store.getState().isLoading).toBe(false);
    expect(loadMessagesRequestedBy).toEqual([null]);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2);
    // Signed out, the handoff reads no account's copy at all.
    expect(mockReadMessageData).not.toHaveBeenCalled();

    const shared = sharedDailyPool();
    handoffRead.settle(shared);
    await lastLoadSettled();

    expect(store.getState().messages).toEqual(unfavorited(shared));
    expect(store.getState().messages).not.toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });
  it('rejects a version-only stale initialization and hands off to the new session', async () => {
    const pending = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(sharedDailyPool());
    const { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled } =
      await buildTestStore();
    const run = store.getState().initializeApp();
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1));
    store.setState({ authSessionVersion: 2 });
    pending.settle(aOutgoingPool());
    await run;
    await lastLoadSettled();
    expect(store.getState().messages.map((row) => row.text)).toEqual(['SHARED-DAILY']);
    expect(loadMessagesRequestedBy).toEqual([SIGNED_IN_USER]);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('withholds the handoff completion when a second version-only change lands', async () => {
    const pending = deferred<Message[]>();
    const handoff = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockReturnValueOnce(pending.promise).mockReturnValueOnce(handoff.promise);
    const { store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled } =
      await buildTestStore();
    const run = store.getState().initializeApp();
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1));
    store.setState({ authSessionVersion: 2 });
    pending.settle(aOutgoingPool());
    await run;
    store.setState({ authSessionVersion: 3 });
    handoff.settle(sharedDailyPool());
    // The handoff checks the session as soon as its load settles.
    await lastLoadSettled();
    expect(loadMessagesRequestedBy).toEqual([SIGNED_IN_USER]);
    expect(updateCurrentMessage).not.toHaveBeenCalled();
  });

  it('handles a thrown handoff completion without an unhandled rejection', async () => {
    const pending = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(sharedDailyPool());
    const { store, updateCurrentMessage } = await buildTestStore();
    const failure = new Error('rotation failed');
    updateCurrentMessage.mockImplementation(() => { throw failure; });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = store.getState().initializeApp();
    await vi.waitFor(() => expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1));
    store.setState({ authSessionVersion: 2 });
    pending.settle(aOutgoingPool());
    await run;
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('[App Init] Failed to reload the rotation pool:', failure)
    );
    expect(store.getState().isLoading).toBe(false);
    log.mockRestore();
  });

});
