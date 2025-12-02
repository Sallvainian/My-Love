/**
 * useLoveNotes Hook Tests
 *
 * Tests for the Love Notes custom hook that manages chat state.
 * Story 2.1: Hook for consuming Love Notes state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLoveNotes } from '../../../src/hooks/useLoveNotes';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { LoveNote } from '../../../src/types/models';

// Mock the store
vi.mock('../../../src/stores/useAppStore');

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
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
  },
}));

vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUser: vi.fn().mockResolvedValue(null),
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

  beforeEach(() => {
    vi.clearAllMocks();

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
      };
      return selector(state);
    });
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
});
