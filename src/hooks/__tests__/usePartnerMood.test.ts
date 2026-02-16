import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePartnerMood } from '../usePartnerMood';
import { moodSyncService, type SupabaseMoodRecord } from '../../api/moodSyncService';

// Mock the supabaseClient to avoid initialization errors
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
  getPartnerId: vi.fn().mockResolvedValue('partner-123'),
}));

// Mock moodSyncService
vi.mock('../../api/moodSyncService');

describe('usePartnerMood', () => {
  const mockPartnerId = 'partner-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads partner mood on mount', async () => {
    const mockMood = {
      id: '1',
      user_id: mockPartnerId,
      mood_type: 'happy' as const,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(mockMood);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(() => {});

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.partnerMood).toEqual(mockMood);
  });

  it('returns null when partner has no moods', async () => {
    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(() => {});

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.partnerMood).toBeNull();
  });

  it('subscribes to partner mood updates via Broadcast', async () => {
    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(() => {});

    renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(moodSyncService.subscribeMoodUpdates).toHaveBeenCalled();
    });
  });

  it('updates mood when broadcast received for partner', async () => {
    const initialMood = {
      id: '1',
      user_id: mockPartnerId,
      mood_type: 'happy' as const,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedMood = {
      id: '2',
      user_id: mockPartnerId,
      mood_type: 'excited' as const,
      note: 'Great news!',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let broadcastCallback: ((mood: SupabaseMoodRecord) => void) | null = null;

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(initialMood);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockImplementation(
      async (callback: (mood: SupabaseMoodRecord) => void) => {
        broadcastCallback = callback;
        return () => {};
      }
    );

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.partnerMood).toEqual(initialMood);

    // Simulate broadcast received
    if (broadcastCallback !== null) {
      broadcastCallback(updatedMood);
    }

    await waitFor(() => {
      expect(result.current.partnerMood).toEqual(updatedMood);
    });
  });

  it('does not update mood when broadcast is from different user', async () => {
    const initialMood = {
      id: '1',
      user_id: mockPartnerId,
      mood_type: 'happy' as const,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const otherUserMood = {
      id: '2',
      user_id: 'different-user-123',
      mood_type: 'excited' as const,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let broadcastCallback: ((mood: SupabaseMoodRecord) => void) | null = null;

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(initialMood);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockImplementation(
      async (callback: (mood: SupabaseMoodRecord) => void) => {
        broadcastCallback = callback;
        return () => {};
      }
    );

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.partnerMood).toEqual(initialMood);

    // Simulate broadcast from different user
    if (broadcastCallback !== null) {
      broadcastCallback(otherUserMood);
    }

    // Wait a bit to ensure it doesn't update
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mood should NOT change
    expect(result.current.partnerMood).toEqual(initialMood);
  });

  it('unsubscribes on unmount', async () => {
    const unsubscribeMock = vi.fn();

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(unsubscribeMock);

    const { unmount } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(moodSyncService.subscribeMoodUpdates).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('sets error state when getLatestPartnerMood rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(moodSyncService.getLatestPartnerMood).mockRejectedValue(
      new Error('Network failure')
    );
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(() => {});

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Unable to load partner mood. Please try again later.');
    expect(result.current.partnerMood).toBeNull();

    consoleSpy.mockRestore();
  });

  it('sets disconnected status when subscribeMoodUpdates rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockRejectedValue(
      new Error('Subscription failed')
    );

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('disconnected');
    });

    expect(result.current.error).toBe('Unable to connect to real-time updates.');

    consoleSpy.mockRestore();
  });

  it('updates connection status based on subscription status', async () => {
    let statusCallback: ((status: string) => void) | null = null;

    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockImplementation(
      async (_: (mood: SupabaseMoodRecord) => void, onStatusChange?: (status: string) => void) => {
        if (onStatusChange) {
          statusCallback = onStatusChange;
        }
        return () => {};
      }
    );

    const { result } = renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connecting');
    });

    // Simulate subscription success
    if (statusCallback !== null) {
      statusCallback('SUBSCRIBED');
    }

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connected');
    });

    // Simulate connection error
    if (statusCallback !== null) {
      statusCallback('CHANNEL_ERROR');
    }

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });
});
