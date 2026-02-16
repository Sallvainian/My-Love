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

type TestState = SettingsSlice & {
  __isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  messages: Message[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateCurrentMessage: () => void;
};

const buildTestStore = async () => {
  vi.resetModules();

  const { createSettingsSlice } = await import('../../../src/stores/slices/settingsSlice');
  const updateCurrentMessage = vi.fn();

  const store = create<TestState>()((set, get, api) => ({
    __isHydrated: true,
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
    ...createSettingsSlice(
      set as unknown as Parameters<typeof createSettingsSlice>[0],
      get as unknown as Parameters<typeof createSettingsSlice>[1],
      api as unknown as Parameters<typeof createSettingsSlice>[2]
    ),
  }));

  return { store, updateCurrentMessage };
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
    mockStorageService.getAllMessages.mockResolvedValueOnce([]).mockResolvedValueOnce(seededMessages);
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
    expect(store.getState().messages).toEqual(existingMessages);
    expect(updateCurrentMessage).toHaveBeenCalledTimes(1);
  });
});
