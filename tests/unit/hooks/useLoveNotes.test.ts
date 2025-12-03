/**
 * useLoveNotes Hook Tests
 *
 * Tests for the Love Notes custom hook that manages chat state.
 * Story 2.1: Hook for consuming Love Notes state
 * Story 2.3: Real-time subscription tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLoveNotes } from '../../../src/hooks/useLoveNotes';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { LoveNote } from '../../../src/types/models';

// Use vi.hoisted to define mocks before they're used in vi.mock factories
const {
  mockUnsubscribe,
  mockSubscribe,
  mockOn,
  mockChannel,
  mockChannelFn,
  mockRemoveChannel,
  mockGetCurrentUserId,
} = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const mockSubscribe = vi.fn((callback: any) => {
    if (callback) {
      callback('SUBSCRIBED');
    }
    return mockUnsubscribe;
  });
  const mockOn = vi.fn();
  const mockChannel = {
    on: mockOn,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  };
  const mockChannelFn = vi.fn(() => mockChannel);
  const mockRemoveChannel = vi.fn();
  const mockGetCurrentUserId = vi.fn();

  return {
    mockUnsubscribe,
    mockSubscribe,
    mockOn,
    mockChannel,
    mockChannelFn,
    mockRemoveChannel,
    mockGetCurrentUserId,
  };
});

// Mock the store
vi.mock('../../../src/stores/useAppStore');

// Mock photoService to avoid importing supabaseClient
vi.mock('../../../src/services/photoService', () => ({
  photoService: {
    getPhotos: vi.fn().mockResolvedValue([]),
    uploadPhoto: vi.fn().mockResolvedValue(null),
    deletePhoto: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn().mockResolvedValue('mock-url'),
    checkStorageQuota: vi.fn().mockResolvedValue({ used: 0, quota: 1024, percent: 0, warning: 'none' }),
  },
}));

// Mock moodSyncService to avoid importing supabaseClient
vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: {
    getLatestPartnerMood: vi.fn().mockResolvedValue(null),
    fetchMoods: vi.fn().mockResolvedValue([]),
    subscribeToPartnerMood: vi.fn(),
  },
}));

// Mock Supabase client before any imports that use it
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: mockChannelFn,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue(null),
    getCurrentUserId: mockGetCurrentUserId,
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
}));

describe('useLoveNotes', () => {
  const mockNotes: LoveNote[] = [
    {
      id: 'note-1',
      from_user_id: 'user-1',
      to_user_id: 'user-2',
      content: 'Hello!',
      created_at: '2025-11-29T14:00:00Z',
    },
    {
      id: 'note-2',
      from_user_id: 'user-2',
      to_user_id: 'user-1',
      content: 'Hi there!',
      created_at: '2025-11-29T14:05:00Z',
    },
  ];

  const mockFetchNotes = vi.fn();
  const mockFetchOlderNotes = vi.fn();
  const mockClearNotesError = vi.fn();
  const mockAddNote = vi.fn();
  const mockSendNote = vi.fn();
  const mockRetryFailedMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockReturnValue(mockChannel);
    mockGetCurrentUserId.mockResolvedValue('test-user-id');

    // Setup default mock implementation
    (useAppStore as any).mockImplementation((selector: any) => {
      const state = {
        notes: mockNotes,
        notesIsLoading: false,
        notesError: null,
        notesHasMore: true,
        fetchNotes: mockFetchNotes,
        fetchOlderNotes: mockFetchOlderNotes,
        clearNotesError: mockClearNotesError,
        addNote: mockAddNote,
        sendNote: mockSendNote,
        retryFailedMessage: mockRetryFailedMessage,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state from store', () => {
      const { result } = renderHook(() => useLoveNotes(false)); // Skip auto-fetch

      expect(result.current.notes).toEqual(mockNotes);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.hasMore).toBe(true);
    });

    it('provides fetchNotes action', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      expect(typeof result.current.fetchNotes).toBe('function');
    });

    it('provides fetchOlderNotes action', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      expect(typeof result.current.fetchOlderNotes).toBe('function');
    });

    it('provides clearError action', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('auto-fetch behavior', () => {
    it('fetches notes on mount when autoFetch is true', async () => {
      renderHook(() => useLoveNotes(true));

      await waitFor(() => {
        expect(mockFetchNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('does not fetch notes on mount when autoFetch is false', () => {
      renderHook(() => useLoveNotes(false));

      expect(mockFetchNotes).not.toHaveBeenCalled();
    });

    it('fetches notes on mount when autoFetch is not provided (defaults to true)', async () => {
      renderHook(() => useLoveNotes());

      await waitFor(() => {
        expect(mockFetchNotes).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('loading state', () => {
    it('reflects loading state from store', () => {
      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          notes: [],
          notesIsLoading: true,
          notesError: null,
          notesHasMore: false,
          fetchNotes: mockFetchNotes,
          fetchOlderNotes: mockFetchOlderNotes,
          clearNotesError: mockClearNotesError,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLoveNotes(false));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.notes).toEqual([]);
    });
  });

  describe('error state', () => {
    it('reflects error state from store', () => {
      const errorMessage = 'Failed to fetch notes';

      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          notes: [],
          notesIsLoading: false,
          notesError: errorMessage,
          notesHasMore: false,
          fetchNotes: mockFetchNotes,
          fetchOlderNotes: mockFetchOlderNotes,
          clearNotesError: mockClearNotesError,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLoveNotes(false));

      expect(result.current.error).toBe(errorMessage);
    });

    it('calls clearNotesError when clearError is invoked', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      result.current.clearError();

      expect(mockClearNotesError).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('calls fetchNotes action from store', async () => {
      const { result } = renderHook(() => useLoveNotes(false));

      await result.current.fetchNotes();

      expect(mockFetchNotes).toHaveBeenCalledTimes(1);
    });

    it('calls fetchOlderNotes action from store', async () => {
      const { result } = renderHook(() => useLoveNotes(false));

      await result.current.fetchOlderNotes();

      expect(mockFetchOlderNotes).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasMore pagination flag', () => {
    it('reflects hasMore state from store when true', () => {
      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          notes: mockNotes,
          notesIsLoading: false,
          notesError: null,
          notesHasMore: true,
          fetchNotes: mockFetchNotes,
          fetchOlderNotes: mockFetchOlderNotes,
          clearNotesError: mockClearNotesError,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLoveNotes(false));

      expect(result.current.hasMore).toBe(true);
    });

    it('reflects hasMore state from store when false', () => {
      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          notes: mockNotes,
          notesIsLoading: false,
          notesError: null,
          notesHasMore: false,
          fetchNotes: mockFetchNotes,
          fetchOlderNotes: mockFetchOlderNotes,
          clearNotesError: mockClearNotesError,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useLoveNotes(false));

      expect(result.current.hasMore).toBe(false);
    });
  });

  // Story 2.3: Real-time subscription integration
  // Note: Detailed realtime tests are in useRealtimeMessages.test.ts
  // useLoveNotes delegates to useRealtimeMessages hook
  describe('real-time subscription (Story 2.3)', () => {
    it('enables realtime subscription when autoFetch is true', () => {
      // useLoveNotes(true) calls useRealtimeMessages({ enabled: true })
      // The actual subscription behavior is tested in useRealtimeMessages.test.ts
      const { result } = renderHook(() => useLoveNotes(true));

      // Hook should return without errors
      expect(result.current.notes).toBeDefined();
    });

    it('respects autoFetch parameter for realtime subscription', () => {
      // useLoveNotes(false) would call useRealtimeMessages({ enabled: false })
      const { result } = renderHook(() => useLoveNotes(false));

      // Hook should return without errors even with autoFetch=false
      expect(result.current.notes).toBeDefined();
    });
  });

  // Story 2.2: Message sending tests
  describe('message sending (Story 2.2)', () => {
    it('provides sendNote action', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      expect(typeof result.current.sendNote).toBe('function');
    });

    it('calls sendNote action from store', async () => {
      const { result } = renderHook(() => useLoveNotes(false));

      await result.current.sendNote('Hello!');

      expect(mockSendNote).toHaveBeenCalledWith('Hello!');
    });

    it('provides retryFailedMessage action', () => {
      const { result } = renderHook(() => useLoveNotes(false));

      expect(typeof result.current.retryFailedMessage).toBe('function');
    });

    it('calls retryFailedMessage action from store', async () => {
      const { result } = renderHook(() => useLoveNotes(false));

      await result.current.retryFailedMessage('temp-123');

      expect(mockRetryFailedMessage).toHaveBeenCalledWith('temp-123');
    });
  });
});
