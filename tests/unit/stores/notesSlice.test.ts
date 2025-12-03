import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LoveNote } from '../../../src/types/models';
import { createNotesSlice, type NotesSlice } from '../../../src/stores/slices/notesSlice';

// Mock server-only
vi.mock('server-only', () => ({}));

// Mock Supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          lt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
  getPartnerId: vi.fn(() => Promise.resolve('partner-123')),
}));

// Mock authService
vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn(() => Promise.resolve('user-123')),
  },
}));

// Helper to create store for testing
const createTestStore = () => {
  let storeState: NotesSlice;
  const set = vi.fn((updater: any) => {
    if (typeof updater === 'function') {
      const newState = updater(storeState);
      Object.assign(storeState, newState);
    } else {
      Object.assign(storeState, updater);
    }
  });
  const get = vi.fn(() => storeState);
  storeState = createNotesSlice(set as any, get as any, {} as any);
  return { store: storeState, set, get };
};

describe('notesSlice - addNote (deduplication)', () => {
  it('should add a new note to the list', () => {
    const { store } = createTestStore();

    const note: LoveNote = {
      id: 'note-1',
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'Hello!',
      created_at: '2024-01-01T10:00:00Z',
    };

    store.addNote(note);

    expect(store.notes).toHaveLength(1);
    expect(store.notes[0]).toEqual(note);
  });

  it('should prevent duplicate notes with same ID', () => {
    const { store } = createTestStore();

    const note: LoveNote = {
      id: 'note-1',
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'Original message',
      created_at: '2024-01-01T10:00:00Z',
    };

    const duplicateNote: LoveNote = {
      id: 'note-1', // Same ID
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'Duplicate message with different content',
      created_at: '2024-01-01T10:01:00Z',
    };

    store.addNote(note);
    store.addNote(duplicateNote);

    // Should only have one note
    expect(store.notes).toHaveLength(1);
    // Should keep the original content
    expect(store.notes[0].content).toBe('Original message');
  });

  it('should allow multiple notes with different IDs', () => {
    const { store } = createTestStore();

    const note1: LoveNote = {
      id: 'note-1',
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'First message',
      created_at: '2024-01-01T10:00:00Z',
    };

    const note2: LoveNote = {
      id: 'note-2',
      from_user_id: 'user-2',
      to_user_id: 'user-1',
      content: 'Second message',
      created_at: '2024-01-01T10:01:00Z',
    };

    store.addNote(note1);
    store.addNote(note2);

    expect(store.notes).toHaveLength(2);
    expect(store.notes[0].id).toBe('note-1');
    expect(store.notes[1].id).toBe('note-2');
  });

  it('should handle rapid duplicate additions (race condition simulation)', () => {
    const { store } = createTestStore();

    const note: LoveNote = {
      id: 'note-race',
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'Race condition test',
      created_at: '2024-01-01T10:00:00Z',
    };

    // Simulate rapid additions (as might happen from realtime + optimistic updates)
    store.addNote(note);
    store.addNote(note);
    store.addNote(note);
    store.addNote(note);

    // Should still only have one note
    expect(store.notes).toHaveLength(1);
  });
});

describe('notesSlice - sendNote', () => {
  let store: NotesSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    set = vi.fn((updater) => {
      if (typeof updater === 'function') {
        const newState = updater(store);
        Object.assign(store, newState);
      } else {
        Object.assign(store, updater);
      }
    });
    get = vi.fn(() => store);
    store = createNotesSlice(set as any, get as any, {} as any);
  });

  describe('sendNote', () => {
    it('should immediately add optimistic note to state', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Mock successful insert
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'server-123',
                from_user_id: 'user-123',
                to_user_id: 'partner-123',
                content: 'Hello!',
                created_at: new Date().toISOString(),
              },
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      // Ensure store starts with empty notes
      store.notes = [];

      // Call sendNote
      await store.sendNote('Hello!');

      // Verify optimistic update was added (set is called twice: once for optimistic, once for success)
      expect(set).toHaveBeenCalled();

      // The first set call should add the optimistic note
      const firstCall = (set as any).mock.calls[0][0];
      const emptyStore = { ...store, notes: [] }; // Simulate empty starting state
      const optimisticState = firstCall(emptyStore);

      // Should have optimistic note after first call
      expect(optimisticState.notes).toHaveLength(1);
      expect(optimisticState.notes[0]).toMatchObject({
        content: 'Hello!',
        sending: true,
      });
      expect(optimisticState.notes[0]).toHaveProperty('tempId');
    });

    it('should replace optimistic note with server response on success', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      const serverNote = {
        id: 'server-123',
        from_user_id: 'user-123',
        to_user_id: 'partner-123',
        content: 'Hello!',
        created_at: '2025-12-02T10:00:00Z',
      };

      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: serverNote,
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      await store.sendNote('Hello!');

      // Verify insert was called
      expect(mockInsert).toHaveBeenCalledWith({
        from_user_id: 'user-123',
        to_user_id: 'partner-123',
        content: 'Hello!',
      });

      // Verify final state has server note (not optimistic)
      expect(store.notes).toHaveLength(1);
      expect(store.notes[0]).toMatchObject(serverNote);
      expect(store.notes[0].sending).toBe(false);
      expect(store.notes[0]).not.toHaveProperty('tempId');
    });

    it('should mark note with error flag on failure', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Network error' },
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      await store.sendNote('Hello!');

      // Verify note is marked with error
      expect(store.notes).toHaveLength(1);
      expect(store.notes[0]).toMatchObject({
        content: 'Hello!',
        sending: false,
        error: true,
      });
      expect(store.notes[0]).toHaveProperty('tempId');
    });

    it('should enforce rate limiting (10 messages per minute)', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Mock successful insert
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'server-123',
                from_user_id: 'user-123',
                to_user_id: 'partner-123',
                content: 'Test',
                created_at: new Date().toISOString(),
              },
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsert,
      });

      // Send 10 messages (should all succeed)
      for (let i = 0; i < 10; i++) {
        await store.sendNote(`Message ${i}`);
      }

      // 11th message should fail due to rate limit
      await expect(store.sendNote('Message 11')).rejects.toThrow('Rate limit exceeded');

      // Verify only 10 messages were sent
      expect(store.notes).toHaveLength(10);
    });
  });

  describe('retryFailedMessage', () => {
    it('should retry sending a failed message', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // First, create a failed message
      const mockInsertFail = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Network error' },
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsertFail,
      });

      await store.sendNote('Retry me');

      // Verify failed message exists
      expect(store.notes[0].error).toBe(true);
      const tempId = store.notes[0].tempId;

      // Now mock successful retry
      const mockInsertSuccess = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: 'server-123',
                from_user_id: 'user-123',
                to_user_id: 'partner-123',
                content: 'Retry me',
                created_at: new Date().toISOString(),
              },
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsertSuccess,
      });

      // Retry the message
      await store.retryFailedMessage(tempId!);

      // Verify message is now successful
      expect(store.notes[0].error).toBe(false);
      expect(store.notes[0].sending).toBe(false);
      expect(store.notes[0].id).toBe('server-123');
    });

    it('should handle retry failure gracefully', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Create a failed message
      const mockInsertFail = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Network error' },
            })
          ),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsertFail,
      });

      await store.sendNote('Retry fail');
      const tempId = store.notes[0].tempId;

      // Retry also fails
      await store.retryFailedMessage(tempId!);

      // Verify message still has error flag
      expect(store.notes[0].error).toBe(true);
    });

    it('should throw error if message not found', async () => {
      await expect(store.retryFailedMessage('nonexistent-id')).rejects.toThrow(
        'Message not found'
      );
    });
  });
});
