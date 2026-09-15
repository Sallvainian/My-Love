import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { SettingsSlice } from '../../../src/stores/slices/settingsSlice';
import type { Message } from '../../../src/types';

const mockStorageService = {
  init: vi.fn(),
  getAllMessages: vi.fn(),
  addMessages: vi.fn(),
};

const mockLoadDefaultMessages = vi.fn();

vi.mock('../../../src/services/storage', () => ({
  storageService: mockStorageService,
}));

vi.mock('../../../src/data/defaultMessagesLoader', () => ({
  loadDefaultMessages: mockLoadDefaultMessages,
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

function aOutgoingPool(): Message[] {
  return [
    {
      id: 7,
      text: 'A-OUTGOING-CUSTOM',
      category: 'custom',
      isCustom: true,
      createdAt: new Date(),
    },
  ];
}

function cIncomingPool(): Message[] {
  return [
    {
      id: 1,
      text: 'C-INCOMING-DAILY',
      category: 'reason',
      isCustom: false,
      createdAt: new Date(),
    },
  ];
}

function sharedDailyPool(): Message[] {
  return [
    {
      id: 1,
      text: 'SHARED-DAILY',
      category: 'reason',
      isCustom: false,
      createdAt: new Date(),
    },
  ];
}

const buildTestStore = async () => {
  vi.resetModules();

  const { createSettingsSlice } = await import('../../../src/stores/slices/settingsSlice');
  const updateCurrentMessage = vi.fn();
  const loadMessagesRequestedBy: Array<string | null> = [];

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
    loadMessages: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      loadMessagesRequestedBy.push(requestedBy);
      const messages = await mockStorageService.getAllMessages(requestedBy);
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) {
        return;
      }
      set({ messages });
    },
    ...createSettingsSlice(
      set as unknown as Parameters<typeof createSettingsSlice>[0],
      get as unknown as Parameters<typeof createSettingsSlice>[1],
      api as unknown as Parameters<typeof createSettingsSlice>[2]
    ),
  }));

  return { store, updateCurrentMessage, loadMessagesRequestedBy };
};

describe('createSettingsSlice initializeApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads default messages only when IndexedDB has no messages', async () => {
    const seededMessages: Message[] = [
      {
        id: 1,
        text: 'Seeded',
        category: 'memory',
        isCustom: false,
        createdAt: new Date(),
      },
    ];

    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(seededMessages);
    mockStorageService.addMessages.mockResolvedValue(undefined);
    mockLoadDefaultMessages.mockResolvedValue([{ text: 'Seeded', category: 'memory' }]);

    const { store, updateCurrentMessage } = await buildTestStore();
    await store.getState().initializeApp();

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
    expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(2);
    // Both reads — the "is this database seeded?" check and the re-read for
    // auto-generated ids — are scoped to the signed-in account.
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(1, SIGNED_IN_USER);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2, SIGNED_IN_USER);
    expect(store.getState().messages).toEqual(seededMessages);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('skips default message loader when IndexedDB already contains messages', async () => {
    const existingMessages: Message[] = [
      {
        id: 42,
        text: 'Already stored',
        category: 'reason',
        isCustom: false,
        createdAt: new Date(),
      },
    ];

    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages.mockResolvedValue(existingMessages);

    const { store, updateCurrentMessage } = await buildTestStore();
    await store.getState().initializeApp();

    expect(mockLoadDefaultMessages).not.toHaveBeenCalled();
    expect(mockStorageService.addMessages).not.toHaveBeenCalled();
    expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(1);
    expect(mockStorageService.getAllMessages).toHaveBeenCalledWith(SIGNED_IN_USER);
    expect(store.getState().messages).toEqual(existingMessages);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });

  it('withholds the stale pool and re-reads under C when the account changes mid-flight (seeded)', async () => {
    const initRead = deferred<Message[]>();
    const handoffRead = deferred<Message[]>();
    mockStorageService.init.mockResolvedValue(undefined);
    mockStorageService.getAllMessages
      .mockReturnValueOnce(initRead.promise)
      .mockReturnValueOnce(handoffRead.promise);

    const { store, updateCurrentMessage, loadMessagesRequestedBy } = await buildTestStore();
    const inFlight = store.getState().initializeApp();
    await flush();

    store.setState({
      userId: USER_C,
      authSessionVersion: store.getState().authSessionVersion + 1,
    });
    initRead.settle(aOutgoingPool());
    await inFlight;

    // Stale `set({ messages })` did not land — cold-boot `messages` is still
    // empty, and the outgoing account's rows are not on screen.
    expect(store.getState().messages).toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).not.toHaveBeenCalled();
    expect(store.getState().isLoading).toBe(false);
    // Handoff was issued under C, but its write has not landed yet.
    expect(loadMessagesRequestedBy).toEqual([USER_C]);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(1, SIGNED_IN_USER);
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2, USER_C);

    const incoming = cIncomingPool();
    handoffRead.settle(incoming);
    await flush();

    expect(store.getState().messages).toEqual(incoming);
    expect(store.getState().messages).not.toEqual([]);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);

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

    const { store, updateCurrentMessage, loadMessagesRequestedBy } = await buildTestStore();
    const inFlight = store.getState().initializeApp();
    await flush();

    // First read returned `[]`, so the seeding branch is in flight on the
    // re-read. Switching now is what makes a deleted guard on THAT `set()` fail.
    expect(mockStorageService.addMessages).toHaveBeenCalledTimes(1);
    expect(mockStorageService.getAllMessages).toHaveBeenCalledTimes(2);

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
    await flush();

    expect(store.getState().messages).toEqual(incoming);
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

    const { store, updateCurrentMessage, loadMessagesRequestedBy } = await buildTestStore();
    const inFlight = store.getState().initializeApp();
    await flush();

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
    expect(mockStorageService.getAllMessages).toHaveBeenNthCalledWith(2, null);

    const shared = sharedDailyPool();
    handoffRead.settle(shared);
    await flush();

    expect(store.getState().messages).toEqual(shared);
    expect(store.getState().messages).not.toEqual([]);
    expect(JSON.stringify(store.getState().messages)).not.toContain('A-OUTGOING-CUSTOM');
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });
});
