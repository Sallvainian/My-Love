/**
 * MessagesSlice Unit Tests
 *
 * Tests for message state management including:
 * - Loading messages from storage
 * - Adding new messages
 * - Toggling favorites
 * - Message navigation (previous/next)
 * - Custom message CRUD operations
 * - Export/import functionality
 * - Message rotation and history
 *
 * Anti-patterns avoided:
 * - No date-dependent flaky tests (dates are controlled)
 * - Proper mock isolation
 * - Testing actual behavior, not implementation
 * - Explicit assertions on specific values
 *
 * @module tests/unit/stores/messagesSlice.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStore } from 'zustand';
import type { MessagesSlice } from '../../../src/stores/slices/messagesSlice';
import { createMessagesSlice } from '../../../src/stores/slices/messagesSlice';
import type { Message, CustomMessage, Settings } from '../../../src/types';

// Mock storage service
const mockGetAllMessages = vi.fn();
const mockAddMessage = vi.fn();
const mockToggleFavorite = vi.fn();

vi.mock('../../../src/services/storage', () => ({
  storageService: {
    getAllMessages: () => mockGetAllMessages(),
    addMessage: (...args: unknown[]) => mockAddMessage(...args),
    toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
  },
}));

// Mock custom message service
const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdateMessage = vi.fn();
const mockDelete = vi.fn();
const mockExportMessages = vi.fn();
const mockImportMessages = vi.fn();

vi.mock('../../../src/services/customMessageService', () => ({
  customMessageService: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    updateMessage: (...args: unknown[]) => mockUpdateMessage(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    exportMessages: () => mockExportMessages(),
    importMessages: (...args: unknown[]) => mockImportMessages(...args),
  },
}));

// Mock message rotation utilities
const mockGetDailyMessage = vi.fn();
const mockFormatDate = vi.fn();
const mockGetAvailableHistoryDays = vi.fn();

vi.mock('../../../src/utils/messageRotation', () => ({
  getDailyMessage: (...args: unknown[]) => mockGetDailyMessage(...args),
  formatDate: (...args: unknown[]) => mockFormatDate(...args),
  getAvailableHistoryDays: (...args: unknown[]) => mockGetAvailableHistoryDays(...args),
}));

// Test data factories
function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    text: 'Test message',
    category: 'reasons',
    isFavorite: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createMockSettings(): Settings {
  return {
    relationship: {
      startDate: new Date('2023-01-01'),
      anniversaryDate: new Date('2023-06-15'),
      partner1Birthday: new Date('1990-05-10'),
      partner2Birthday: new Date('1992-08-20'),
    },
    theme: 'light',
    notifications: true,
  };
}

// Extended store type to include settings (cross-slice dependency)
type TestStoreState = MessagesSlice & { settings: Settings | null };

describe('MessagesSlice', () => {
  let store: ReturnType<typeof createStore<TestStoreState>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create store with settings (messagesSlice depends on settings)
    store = createStore<TestStoreState>()((set, get) => ({
      ...createMessagesSlice(set as never, get as never),
      settings: createMockSettings(),
    }));

    // Default mock implementations
    mockFormatDate.mockImplementation((date: Date) => date.toISOString().split('T')[0]);
    mockGetAvailableHistoryDays.mockReturnValue(30);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty messages array', () => {
      expect(store.getState().messages).toEqual([]);
    });

    it('should have null currentMessage', () => {
      expect(store.getState().currentMessage).toBeNull();
    });

    it('should have empty customMessages array', () => {
      expect(store.getState().customMessages).toEqual([]);
    });

    it('should have customMessagesLoaded as false', () => {
      expect(store.getState().customMessagesLoaded).toBe(false);
    });

    it('should have messageHistory with correct defaults', () => {
      const state = store.getState();
      expect(state.messageHistory.currentIndex).toBe(0);
      expect(state.messageHistory.maxHistoryDays).toBe(30);
      expect(state.messageHistory.shownMessages).toBeInstanceOf(Map);
    });
  });

  describe('loadMessages', () => {
    it('should load messages from storage service', async () => {
      const messages = [createMockMessage({ id: 1 }), createMockMessage({ id: 2 })];
      mockGetAllMessages.mockResolvedValue(messages);

      await store.getState().loadMessages();

      expect(mockGetAllMessages).toHaveBeenCalledTimes(1);
      expect(store.getState().messages).toEqual(messages);
    });

    it('should handle errors gracefully', async () => {
      mockGetAllMessages.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(store.getState().loadMessages()).resolves.not.toThrow();
    });
  });

  describe('addMessage', () => {
    it('should add message via storage service', async () => {
      mockAddMessage.mockResolvedValue(42);

      await store.getState().addMessage('New message text', 'reasons');

      expect(mockAddMessage).toHaveBeenCalledTimes(1);
      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'New message text',
          category: 'reasons',
          isCustom: true,
          isFavorite: false,
        })
      );
    });

    it('should add message to state with returned id', async () => {
      mockAddMessage.mockResolvedValue(123);

      await store.getState().addMessage('Test', 'compliments');

      const messages = store.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(123);
      expect(messages[0].text).toBe('Test');
      expect(messages[0].category).toBe('compliments');
    });

    it('should handle errors gracefully', async () => {
      mockAddMessage.mockRejectedValue(new Error('Add failed'));

      await expect(store.getState().addMessage('Test', 'reasons')).resolves.not.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    beforeEach(() => {
      const messages = [
        createMockMessage({ id: 1, isFavorite: false }),
        createMockMessage({ id: 2, isFavorite: true }),
      ];
      store.setState({ messages });
      mockToggleFavorite.mockResolvedValue(undefined);
    });

    it('should call storage service to toggle favorite', async () => {
      await store.getState().toggleFavorite(1);

      expect(mockToggleFavorite).toHaveBeenCalledWith(1);
    });

    it('should toggle isFavorite in state (false to true)', async () => {
      await store.getState().toggleFavorite(1);

      expect(store.getState().messages[0].isFavorite).toBe(true);
    });

    it('should toggle isFavorite in state (true to false)', async () => {
      await store.getState().toggleFavorite(2);

      expect(store.getState().messages[1].isFavorite).toBe(false);
    });

    it('should update favoriteIds in messageHistory', async () => {
      await store.getState().toggleFavorite(1);

      expect(store.getState().messageHistory.favoriteIds).toContain(1);
    });
  });

  describe('updateCurrentMessage', () => {
    beforeEach(() => {
      const messages = [
        createMockMessage({ id: 1, text: 'Message 1' }),
        createMockMessage({ id: 2, text: 'Message 2' }),
        createMockMessage({ id: 3, text: 'Message 3', isCustom: true, active: true }),
      ];
      store.setState({ messages });

      mockGetDailyMessage.mockReturnValue(messages[0]);
      mockFormatDate.mockReturnValue('2024-01-15');
    });

    it('should not update if no messages loaded', () => {
      store.setState({ messages: [] });

      store.getState().updateCurrentMessage();

      expect(store.getState().currentMessage).toBeNull();
    });

    it('should filter out inactive custom messages from rotation pool', () => {
      const messages = [
        createMockMessage({ id: 1 }),
        createMockMessage({ id: 2, isCustom: true, active: false }), // Should be excluded
        createMockMessage({ id: 3, isCustom: true, active: true }), // Should be included
      ];
      store.setState({ messages });

      store.getState().updateCurrentMessage();

      // getDailyMessage should receive filtered pool (2 messages, not 3)
      expect(mockGetDailyMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 3 }),
        ]),
        expect.any(Date)
      );
      expect(mockGetDailyMessage.mock.calls[0][0]).toHaveLength(2);
    });

    it('should set currentMessage from getDailyMessage result', () => {
      const expectedMessage = createMockMessage({ id: 5, text: 'Daily message' });
      mockGetDailyMessage.mockReturnValue(expectedMessage);
      store.setState({ messages: [expectedMessage] });

      store.getState().updateCurrentMessage();

      expect(store.getState().currentMessage).toEqual(expectedMessage);
    });

    it('should cache message in shownMessages map', () => {
      const message = createMockMessage({ id: 7 });
      mockGetDailyMessage.mockReturnValue(message);
      store.setState({ messages: [message] });

      store.getState().updateCurrentMessage();

      const shownMessages = store.getState().messageHistory.shownMessages;
      expect(shownMessages.get('2024-01-15')).toBe(7);
    });

    it('should reset currentIndex to 0 (today)', () => {
      store.setState({
        messageHistory: {
          ...store.getState().messageHistory,
          currentIndex: 5,
        },
      });
      const message = createMockMessage({ id: 1 });
      mockGetDailyMessage.mockReturnValue(message);
      store.setState({ messages: [message] });

      store.getState().updateCurrentMessage();

      expect(store.getState().messageHistory.currentIndex).toBe(0);
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      const messages = [
        createMockMessage({ id: 1, text: 'Today' }),
        createMockMessage({ id: 2, text: 'Yesterday' }),
        createMockMessage({ id: 3, text: '2 days ago' }),
      ];
      store.setState({
        messages,
        currentMessage: messages[0],
        messageHistory: {
          ...store.getState().messageHistory,
          currentIndex: 0,
          shownMessages: new Map([
            ['2024-01-15', 1],
            ['2024-01-14', 2],
            ['2024-01-13', 3],
          ]),
        },
      });
      mockGetAvailableHistoryDays.mockReturnValue(30);
    });

    describe('canNavigateBack', () => {
      it('should return false when settings is null', () => {
        store.setState({ settings: null });

        expect(store.getState().canNavigateBack()).toBe(false);
      });

      it('should return true when currentIndex < availableDays', () => {
        mockGetAvailableHistoryDays.mockReturnValue(10);
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 5 },
        });

        expect(store.getState().canNavigateBack()).toBe(true);
      });

      it('should return false when currentIndex >= availableDays', () => {
        mockGetAvailableHistoryDays.mockReturnValue(5);
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 5 },
        });

        expect(store.getState().canNavigateBack()).toBe(false);
      });
    });

    describe('canNavigateForward', () => {
      it('should return false when at today (currentIndex = 0)', () => {
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 0 },
        });

        expect(store.getState().canNavigateForward()).toBe(false);
      });

      it('should return true when not at today (currentIndex > 0)', () => {
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 3 },
        });

        expect(store.getState().canNavigateForward()).toBe(true);
      });
    });

    describe('navigateToPreviousMessage', () => {
      it('should not navigate when settings is null', () => {
        store.setState({ settings: null });
        const initialIndex = store.getState().messageHistory.currentIndex;

        store.getState().navigateToPreviousMessage();

        expect(store.getState().messageHistory.currentIndex).toBe(initialIndex);
      });

      it('should not navigate when at history limit', () => {
        mockGetAvailableHistoryDays.mockReturnValue(3);
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 3 },
        });

        store.getState().navigateToPreviousMessage();

        expect(store.getState().messageHistory.currentIndex).toBe(3);
      });

      it('should increment currentIndex when navigating back', () => {
        mockGetDailyMessage.mockReturnValue(createMockMessage({ id: 2 }));

        store.getState().navigateToPreviousMessage();

        expect(store.getState().messageHistory.currentIndex).toBe(1);
      });
    });

    describe('navigateToNextMessage', () => {
      beforeEach(() => {
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 2 },
        });
      });

      it('should not navigate when at today', () => {
        store.setState({
          messageHistory: { ...store.getState().messageHistory, currentIndex: 0 },
        });

        store.getState().navigateToNextMessage();

        expect(store.getState().messageHistory.currentIndex).toBe(0);
      });

      it('should decrement currentIndex when navigating forward', () => {
        store.getState().navigateToNextMessage();

        expect(store.getState().messageHistory.currentIndex).toBe(1);
      });
    });
  });

  describe('custom messages', () => {
    describe('loadCustomMessages', () => {
      it('should load custom messages from service', async () => {
        const dbMessages = [
          {
            id: 1,
            text: 'Custom 1',
            category: 'reasons' as const,
            isCustom: true,
            active: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            tags: ['tag1'],
          },
        ];
        mockGetAll.mockResolvedValue(dbMessages);

        await store.getState().loadCustomMessages();

        expect(mockGetAll).toHaveBeenCalledWith({ isCustom: true });
        expect(store.getState().customMessages).toHaveLength(1);
        expect(store.getState().customMessagesLoaded).toBe(true);
      });

      it('should convert Date objects to ISO strings', async () => {
        const dbMessages = [
          {
            id: 1,
            text: 'Test',
            category: 'reasons' as const,
            isCustom: true,
            active: true,
            createdAt: new Date('2024-01-15T10:30:00.000Z'),
            updatedAt: new Date('2024-01-16T12:00:00.000Z'),
            tags: [],
          },
        ];
        mockGetAll.mockResolvedValue(dbMessages);

        await store.getState().loadCustomMessages();

        const customMsg = store.getState().customMessages[0];
        expect(customMsg.createdAt).toBe('2024-01-15T10:30:00.000Z');
        expect(customMsg.updatedAt).toBe('2024-01-16T12:00:00.000Z');
      });

      it('should handle errors gracefully and set loaded flag', async () => {
        mockGetAll.mockRejectedValue(new Error('DB error'));

        await store.getState().loadCustomMessages();

        expect(store.getState().customMessages).toEqual([]);
        expect(store.getState().customMessagesLoaded).toBe(true);
      });
    });

    describe('createCustomMessage', () => {
      it('should create message via service', async () => {
        const input = { text: 'New custom', category: 'compliments' as const };
        const created = {
          id: 99,
          text: 'New custom',
          category: 'compliments',
          isCustom: true,
          active: true,
          createdAt: new Date(),
          tags: [],
        };
        mockCreate.mockResolvedValue(created);
        mockGetAllMessages.mockResolvedValue([]);

        await store.getState().createCustomMessage(input);

        expect(mockCreate).toHaveBeenCalledWith(input);
      });

      it('should add created message to customMessages state', async () => {
        const created = {
          id: 100,
          text: 'Created',
          category: 'reasons',
          isCustom: true,
          active: true,
          createdAt: new Date('2024-01-15'),
          tags: ['new'],
        };
        mockCreate.mockResolvedValue(created);
        mockGetAllMessages.mockResolvedValue([]);

        await store.getState().createCustomMessage({ text: 'Created', category: 'reasons' });

        const customMessages = store.getState().customMessages;
        expect(customMessages).toHaveLength(1);
        expect(customMessages[0].id).toBe(100);
        expect(customMessages[0].text).toBe('Created');
      });

      it('should reload main messages after creating', async () => {
        mockCreate.mockResolvedValue({
          id: 1,
          text: 'Test',
          category: 'reasons',
          isCustom: true,
          active: true,
          createdAt: new Date(),
          tags: [],
        });
        mockGetAllMessages.mockResolvedValue([]);

        await store.getState().createCustomMessage({ text: 'Test', category: 'reasons' });

        expect(mockGetAllMessages).toHaveBeenCalled();
      });

      it('should propagate errors', async () => {
        mockCreate.mockRejectedValue(new Error('Create failed'));

        await expect(
          store.getState().createCustomMessage({ text: 'Test', category: 'reasons' })
        ).rejects.toThrow('Create failed');
      });
    });

    describe('updateCustomMessage', () => {
      beforeEach(() => {
        store.setState({
          customMessages: [
            {
              id: 1,
              text: 'Original',
              category: 'reasons',
              isCustom: true,
              active: true,
              createdAt: '2024-01-01',
              tags: [],
            },
          ],
        });
        mockUpdateMessage.mockResolvedValue(undefined);
        mockGetAllMessages.mockResolvedValue([]);
      });

      it('should update message via service', async () => {
        const input = { id: 1, text: 'Updated text' };

        await store.getState().updateCustomMessage(input);

        expect(mockUpdateMessage).toHaveBeenCalledWith(input);
      });

      it('should update message in state', async () => {
        await store.getState().updateCustomMessage({ id: 1, text: 'Updated' });

        expect(store.getState().customMessages[0].text).toBe('Updated');
      });

      it('should update updatedAt timestamp', async () => {
        const beforeUpdate = new Date().toISOString();

        await store.getState().updateCustomMessage({ id: 1, active: false });

        const updatedAt = store.getState().customMessages[0].updatedAt;
        expect(updatedAt).toBeDefined();
        expect(new Date(updatedAt!).getTime()).toBeGreaterThanOrEqual(new Date(beforeUpdate).getTime());
      });
    });

    describe('deleteCustomMessage', () => {
      beforeEach(() => {
        store.setState({
          customMessages: [
            { id: 1, text: 'Keep', category: 'reasons', isCustom: true, active: true, createdAt: '', tags: [] },
            { id: 2, text: 'Delete', category: 'reasons', isCustom: true, active: true, createdAt: '', tags: [] },
          ],
        });
        mockDelete.mockResolvedValue(undefined);
        mockGetAllMessages.mockResolvedValue([]);
      });

      it('should delete message via service', async () => {
        await store.getState().deleteCustomMessage(2);

        expect(mockDelete).toHaveBeenCalledWith(2);
      });

      it('should remove message from state', async () => {
        await store.getState().deleteCustomMessage(2);

        const customMessages = store.getState().customMessages;
        expect(customMessages).toHaveLength(1);
        expect(customMessages[0].id).toBe(1);
      });
    });

    describe('getCustomMessages', () => {
      beforeEach(() => {
        const customMessages: CustomMessage[] = [
          { id: 1, text: 'Reason 1', category: 'reasons', isCustom: true, active: true, createdAt: '', tags: ['love'] },
          { id: 2, text: 'Compliment', category: 'compliments', isCustom: true, active: true, createdAt: '', tags: ['sweet'] },
          { id: 3, text: 'Inactive', category: 'reasons', isCustom: true, active: false, createdAt: '', tags: [] },
          { id: 4, text: 'Love note', category: 'reasons', isCustom: true, active: true, createdAt: '', tags: ['love', 'note'] },
        ];
        store.setState({ customMessages });
      });

      it('should return all messages when no filter', () => {
        const result = store.getState().getCustomMessages();

        expect(result).toHaveLength(4);
      });

      it('should filter by category', () => {
        const result = store.getState().getCustomMessages({ category: 'reasons' });

        expect(result).toHaveLength(3);
        expect(result.every((m) => m.category === 'reasons')).toBe(true);
      });

      it('should filter by active status', () => {
        const result = store.getState().getCustomMessages({ active: true });

        expect(result).toHaveLength(3);
        expect(result.every((m) => m.active === true)).toBe(true);
      });

      it('should filter by search term (case insensitive)', () => {
        // Search term searches in text field, "LOVE" matches "Love note" only
        const result = store.getState().getCustomMessages({ searchTerm: 'LOVE' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(4);
        expect(result[0].text).toBe('Love note');
      });

      it('should filter by search term matching partial text', () => {
        const result = store.getState().getCustomMessages({ searchTerm: 'Reason' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
      });

      it('should filter by tags', () => {
        const result = store.getState().getCustomMessages({ tags: ['love'] });

        expect(result).toHaveLength(2);
      });

      it('should combine multiple filters', () => {
        const result = store.getState().getCustomMessages({
          category: 'reasons',
          active: true,
          tags: ['love'],
        });

        expect(result).toHaveLength(2);
      });

      it('should ignore category "all"', () => {
        const result = store.getState().getCustomMessages({ category: 'all' as never });

        expect(result).toHaveLength(4);
      });
    });
  });

  describe('export/import', () => {
    describe('exportCustomMessages', () => {
      it('should call service exportMessages and trigger download', async () => {
        const exportData = {
          version: 1,
          exportedAt: '2024-01-15',
          messageCount: 5,
          messages: [],
        };
        mockExportMessages.mockResolvedValue(exportData);

        // Mock DOM APIs
        const mockCreateElement = vi.spyOn(document, 'createElement');
        const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
        const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);
        const mockClick = vi.fn();
        const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

        mockCreateElement.mockReturnValue({
          href: '',
          download: '',
          click: mockClick,
        } as unknown as HTMLAnchorElement);

        await store.getState().exportCustomMessages();

        expect(mockExportMessages).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalled();

        // Cleanup
        mockCreateElement.mockRestore();
        mockAppendChild.mockRestore();
        mockRemoveChild.mockRestore();
      });
    });

    describe('importCustomMessages', () => {
      it('should parse file and call service importMessages', async () => {
        const fileContent = JSON.stringify({
          version: 1,
          messages: [{ text: 'Imported', category: 'reasons' }],
        });
        const mockFile = new File([fileContent], 'test.json', { type: 'application/json' });

        mockImportMessages.mockResolvedValue({ imported: 1, skipped: 0 });
        mockGetAll.mockResolvedValue([]);
        mockGetAllMessages.mockResolvedValue([]);

        const result = await store.getState().importCustomMessages(mockFile);

        expect(mockImportMessages).toHaveBeenCalled();
        expect(result).toEqual({ imported: 1, skipped: 0 });
      });

      it('should reload custom messages and main messages after import', async () => {
        const fileContent = JSON.stringify({ version: 1, messages: [] });
        const mockFile = new File([fileContent], 'test.json');

        mockImportMessages.mockResolvedValue({ imported: 0, skipped: 0 });
        mockGetAll.mockResolvedValue([]);
        mockGetAllMessages.mockResolvedValue([]);

        await store.getState().importCustomMessages(mockFile);

        expect(mockGetAll).toHaveBeenCalled();
        expect(mockGetAllMessages).toHaveBeenCalled();
      });

      it('should propagate errors', async () => {
        const mockFile = new File(['invalid json'], 'test.json');

        await expect(store.getState().importCustomMessages(mockFile)).rejects.toThrow();
      });
    });
  });
});
