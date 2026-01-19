/**
 * MoodSyncService Unit Tests
 *
 * Tests for mood synchronization service including:
 * - Syncing individual moods to Supabase
 * - Batch syncing pending moods with retry logic
 * - Fetching moods from Supabase
 * - Real-time subscription to partner mood updates
 * - Network status handling
 * - Error handling and retry logic
 *
 * Anti-patterns avoided:
 * - No use of real timers (vi.useFakeTimers for retry delays)
 * - No flaky network-dependent tests
 * - Explicit verification of retry behavior
 * - Proper cleanup of subscriptions
 *
 * @module tests/unit/api/moodSyncService.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { MoodEntry } from '../../../src/types';

// Mock dependencies BEFORE imports
const mockMoodApiCreate = vi.fn();
const mockMoodApiFetchByUser = vi.fn();

vi.mock('../../../src/api/moodApi', () => ({
  moodApi: {
    create: (...args: unknown[]) => mockMoodApiCreate(...args),
    fetchByUser: (...args: unknown[]) => mockMoodApiFetchByUser(...args),
  },
}));

const mockIsOnline = vi.fn();
const mockHandleNetworkError = vi.fn();

vi.mock('../../../src/api/errorHandlers', () => ({
  isOnline: () => mockIsOnline(),
  handleNetworkError: (...args: unknown[]) => mockHandleNetworkError(...args),
}));

const mockGetUnsyncedMoods = vi.fn();
const mockMarkAsSynced = vi.fn();

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    getUnsyncedMoods: () => mockGetUnsyncedMoods(),
    markAsSynced: (...args: unknown[]) => mockMarkAsSynced(...args),
  },
}));

const mockGetPartnerId = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();
const mockAuthGetSession = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    auth: {
      getSession: () => mockAuthGetSession(),
    },
  },
  getPartnerId: () => mockGetPartnerId(),
}));

// Import after mocks
import { MoodSyncService } from '../../../src/api/moodSyncService';

// Test data factory
function createMockMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: 'user-123',
    mood: 'happy',
    moods: ['happy'],
    note: 'Test note',
    date: '2024-01-15',
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    synced: false,
    ...overrides,
  };
}

function createMockSupabaseMood(id: string = 'supabase-mood-1') {
  return {
    id,
    user_id: 'user-123',
    mood_type: 'happy',
    mood_types: ['happy'],
    note: 'Test note',
    created_at: '2024-01-15T10:30:00.000Z',
    updated_at: '2024-01-15T10:30:00.000Z',
  };
}

describe('MoodSyncService', () => {
  let service: MoodSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    service = new MoodSyncService();

    // Default mock implementations
    mockIsOnline.mockReturnValue(true);
    mockGetPartnerId.mockResolvedValue('partner-456');
    mockHandleNetworkError.mockImplementation((error) => error);

    // Mock channel for broadcast (returns self for chaining)
    const mockChannelInstance = {
      subscribe: vi.fn().mockImplementation((callback) => {
        // Simulate successful subscription
        setTimeout(() => callback('SUBSCRIBED'), 0);
        return mockChannelInstance;
      }),
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn().mockReturnThis(),
    };
    mockChannel.mockReturnValue(mockChannelInstance);
    mockRemoveChannel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('syncMood', () => {
    it('should throw error when offline', async () => {
      mockIsOnline.mockReturnValue(false);
      const mood = createMockMoodEntry();

      await expect(service.syncMood(mood)).rejects.toThrow();

      expect(mockMoodApiCreate).not.toHaveBeenCalled();
    });

    it('should transform mood entry to Supabase format and create', async () => {
      const mood = createMockMoodEntry({
        userId: 'test-user-id',
        mood: 'grateful',
        moods: ['grateful', 'happy'],
        note: 'Multi-mood test',
        timestamp: new Date('2024-01-20T15:00:00.000Z'),
      });

      const mockSyncedMood = createMockSupabaseMood('synced-id');
      mockMoodApiCreate.mockResolvedValue(mockSyncedMood);

      await service.syncMood(mood);

      expect(mockMoodApiCreate).toHaveBeenCalledTimes(1);
      expect(mockMoodApiCreate).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        mood_type: 'grateful',
        mood_types: ['grateful', 'happy'],
        note: 'Multi-mood test',
        created_at: '2024-01-20T15:00:00.000Z',
      });
    });

    it('should use single mood as mood_types array when moods is empty', async () => {
      const mood = createMockMoodEntry({
        mood: 'content',
        moods: [],
      });

      mockMoodApiCreate.mockResolvedValue(createMockSupabaseMood());

      await service.syncMood(mood);

      expect(mockMoodApiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mood_type: 'content',
          mood_types: ['content'],
        })
      );
    });

    it('should handle null note correctly', async () => {
      const mood = createMockMoodEntry({ note: undefined });
      mockMoodApiCreate.mockResolvedValue(createMockSupabaseMood());

      await service.syncMood(mood);

      expect(mockMoodApiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          note: null,
        })
      );
    });

    it('should return synced mood from moodApi', async () => {
      const mood = createMockMoodEntry();
      const expectedSyncedMood = createMockSupabaseMood('returned-id');
      mockMoodApiCreate.mockResolvedValue(expectedSyncedMood);

      const result = await service.syncMood(mood);

      expect(result).toEqual(expectedSyncedMood);
      expect(result.id).toBe('returned-id');
    });
  });

  describe('syncPendingMoods', () => {
    it('should return early when offline with error message', async () => {
      mockIsOnline.mockReturnValue(false);

      const result = await service.syncPendingMoods();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toContain('Device is offline - cannot sync moods');
      expect(mockGetUnsyncedMoods).not.toHaveBeenCalled();
    });

    it('should return early when no pending moods', async () => {
      mockGetUnsyncedMoods.mockResolvedValue([]);

      const result = await service.syncPendingMoods();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should sync all pending moods and mark as synced', async () => {
      const pendingMoods = [createMockMoodEntry({ id: 1 }), createMockMoodEntry({ id: 2 })];

      mockGetUnsyncedMoods.mockResolvedValue(pendingMoods);
      mockMoodApiCreate.mockResolvedValueOnce(createMockSupabaseMood('synced-1'));
      mockMoodApiCreate.mockResolvedValueOnce(createMockSupabaseMood('synced-2'));

      const result = await service.syncPendingMoods();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockMarkAsSynced).toHaveBeenCalledTimes(2);
      expect(mockMarkAsSynced).toHaveBeenCalledWith(1, 'synced-1');
      expect(mockMarkAsSynced).toHaveBeenCalledWith(2, 'synced-2');
    });

    it('should track failed syncs separately', async () => {
      const pendingMoods = [
        createMockMoodEntry({ id: 1 }),
        createMockMoodEntry({ id: 2 }),
        createMockMoodEntry({ id: 3 }),
      ];

      mockGetUnsyncedMoods.mockResolvedValue(pendingMoods);

      // First succeeds, second fails after retries, third succeeds
      mockMoodApiCreate
        .mockResolvedValueOnce(createMockSupabaseMood('synced-1'))
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'))
        .mockRejectedValueOnce(new Error('Network error 4')) // All retries exhausted
        .mockResolvedValueOnce(createMockSupabaseMood('synced-3'));

      // Run all timers to process retries
      const resultPromise = service.syncPendingMoods();

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Mood 2');
    });

    it('should retry failed syncs with exponential backoff', async () => {
      const pendingMoods = [createMockMoodEntry({ id: 1 })];
      mockGetUnsyncedMoods.mockResolvedValue(pendingMoods);

      // Fail first 2 attempts, succeed on 3rd
      mockMoodApiCreate
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce(createMockSupabaseMood('finally-synced'));

      const resultPromise = service.syncPendingMoods();

      // First attempt happens immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockMoodApiCreate).toHaveBeenCalledTimes(1);

      // Wait 1000ms for first retry
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockMoodApiCreate).toHaveBeenCalledTimes(2);

      // Wait 2000ms for second retry
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockMoodApiCreate).toHaveBeenCalledTimes(3);

      const result = await resultPromise;

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should fail mood after max retries (4 total attempts)', async () => {
      const pendingMoods = [createMockMoodEntry({ id: 1 })];
      mockGetUnsyncedMoods.mockResolvedValue(pendingMoods);

      // Fail all 4 attempts
      mockMoodApiCreate.mockRejectedValue(new Error('Persistent failure'));

      const resultPromise = service.syncPendingMoods();

      // Run through all retries
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(mockMoodApiCreate).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('fetchMoods', () => {
    it('should fetch moods from moodApi with correct arguments', async () => {
      const mockMoods = [createMockSupabaseMood('mood-1'), createMockSupabaseMood('mood-2')];
      mockMoodApiFetchByUser.mockResolvedValue(mockMoods);

      const result = await service.fetchMoods('partner-456', 25);

      expect(mockMoodApiFetchByUser).toHaveBeenCalledWith('partner-456', 25);
      expect(result).toEqual(mockMoods);
    });

    it('should use default limit of 50 if not specified', async () => {
      mockMoodApiFetchByUser.mockResolvedValue([]);

      await service.fetchMoods('user-123');

      expect(mockMoodApiFetchByUser).toHaveBeenCalledWith('user-123', 50);
    });
  });

  describe('getLatestPartnerMood', () => {
    it('should return latest mood when available', async () => {
      const latestMood = createMockSupabaseMood('latest');
      mockMoodApiFetchByUser.mockResolvedValue([latestMood]);

      const result = await service.getLatestPartnerMood('partner-456');

      expect(mockMoodApiFetchByUser).toHaveBeenCalledWith('partner-456', 1);
      expect(result).toEqual(latestMood);
    });

    it('should return null when no moods exist', async () => {
      mockMoodApiFetchByUser.mockResolvedValue([]);

      const result = await service.getLatestPartnerMood('partner-456');

      expect(result).toBeNull();
    });

    it('should return null on error (graceful degradation)', async () => {
      mockMoodApiFetchByUser.mockRejectedValue(new Error('Network error'));

      const result = await service.getLatestPartnerMood('partner-456');

      expect(result).toBeNull();
    });
  });

  describe('subscribeMoodUpdates', () => {
    it('should return empty unsubscribe function when not authenticated', async () => {
      mockAuthGetSession.mockResolvedValue({
        data: { session: null },
      });

      const unsubscribe = await service.subscribeMoodUpdates(vi.fn());

      expect(typeof unsubscribe).toBe('function');
      // Should not throw when called
      unsubscribe();
    });

    it('should create channel with current user ID', async () => {
      mockAuthGetSession.mockResolvedValue({
        data: { session: { user: { id: 'current-user-123' } } },
      });

      const mockChannelInstance = {
        subscribe: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
      };
      mockChannel.mockReturnValue(mockChannelInstance);

      await service.subscribeMoodUpdates(vi.fn());

      expect(mockChannel).toHaveBeenCalledWith('mood-updates:current-user-123', expect.any(Object));
    });

    it('should set up broadcast listener for new_mood events', async () => {
      mockAuthGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      const mockOn = vi.fn().mockReturnThis();
      const mockSubscribe = vi.fn().mockReturnThis();
      const mockChannelInstance = {
        on: mockOn,
        subscribe: mockSubscribe,
      };
      mockChannel.mockReturnValue(mockChannelInstance);

      await service.subscribeMoodUpdates(vi.fn());

      expect(mockOn).toHaveBeenCalledWith('broadcast', { event: 'new_mood' }, expect.any(Function));
    });

    it('should call callback with transformed mood on broadcast event', async () => {
      mockAuthGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      let broadcastHandler: ((payload: unknown) => void) | null = null;
      const mockOn = vi.fn().mockImplementation((type, filter, handler) => {
        if (filter.event === 'new_mood') {
          broadcastHandler = handler;
        }
        return { subscribe: vi.fn().mockReturnThis() };
      });

      mockChannel.mockReturnValue({
        on: mockOn,
        subscribe: vi.fn().mockReturnThis(),
      });

      const callback = vi.fn();
      await service.subscribeMoodUpdates(callback);

      // Simulate receiving a broadcast
      const broadcastPayload = {
        payload: {
          id: 'broadcast-mood-id',
          user_id: 'partner-456',
          mood_type: 'loved',
          note: 'Partner note',
          created_at: '2024-01-15T12:00:00.000Z',
        },
      };

      broadcastHandler!(broadcastPayload);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'broadcast-mood-id',
          user_id: 'partner-456',
          mood_type: 'loved',
        })
      );
    });

    it('should return working unsubscribe function', async () => {
      mockAuthGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      const mockChannelInstance = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      mockChannel.mockReturnValue(mockChannelInstance);

      const unsubscribe = await service.subscribeMoodUpdates(vi.fn());

      // Call unsubscribe
      unsubscribe();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
    });
  });
});
