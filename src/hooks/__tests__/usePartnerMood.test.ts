import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moodSyncService, type SupabaseMoodRecord } from '../../api/moodSyncService';
import { usePartnerMood } from '../usePartnerMood';

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

  /** A partner's mood row; a fixed timestamp, since the hook never reads it. */
  const moodRecord = (overrides: Partial<SupabaseMoodRecord> = {}): SupabaseMoodRecord => ({
    id: '1',
    user_id: mockPartnerId,
    mood_type: 'happy',
    note: null,
    created_at: '2026-09-25T08:00:00.000Z',
    updated_at: '2026-09-25T08:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads partner mood on mount', async () => {
    const mockMood = moodRecord();

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

  it("listens for the partner's live mood updates once mounted", async () => {
    vi.mocked(moodSyncService.getLatestPartnerMood).mockResolvedValue(null);
    vi.mocked(moodSyncService.subscribeMoodUpdates).mockResolvedValue(() => {});

    renderHook(() => usePartnerMood(mockPartnerId));

    await waitFor(() => {
      expect(moodSyncService.subscribeMoodUpdates).toHaveBeenCalled();
    });
  });

  it('updates mood when broadcast received for partner', async () => {
    const initialMood = moodRecord();

    const updatedMood = moodRecord({ id: '2', mood_type: 'excited', note: 'Great news!' });

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
    broadcastCallback!(updatedMood);

    await waitFor(() => {
      expect(result.current.partnerMood).toEqual(updatedMood);
    });
  });

  it('does not update mood when broadcast is from different user', async () => {
    const initialMood = moodRecord();

    const otherUserMood = moodRecord({
      id: '2',
      user_id: 'different-user-123',
      mood_type: 'excited',
    });

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

    // Simulate broadcast from different user. The callback is synchronous,
    // so act has flushed any update it made by the time it returns.
    act(() => broadcastCallback!(otherUserMood));

    // Mood should NOT change
    expect(result.current.partnerMood).toEqual(initialMood);

    // Positive control: the same path does update for the partner's own mood
    const partnerMood2 = { ...otherUserMood, id: '3', user_id: mockPartnerId };
    act(() => broadcastCallback!(partnerMood2));
    expect(result.current.partnerMood).toEqual(partnerMood2);
  });

  it('stops receiving mood updates after unmount', async () => {
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

  it('reports a load error and no mood when the partner mood cannot be read', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(moodSyncService.getLatestPartnerMood).mockRejectedValue(new Error('Network failure'));
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

  it('reports disconnected with an error when live updates cannot start', async () => {
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
    statusCallback!('SUBSCRIBED');

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connected');
    });

    // Simulate connection error
    statusCallback!('CHANNEL_ERROR');

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });
});
