/**
 * InteractionsSlice Unit Tests
 *
 * Tests for poke/kiss interaction state management including:
 * - Sending poke/kiss interactions
 * - Marking interactions as viewed
 * - Getting unviewed interactions
 * - Getting interaction history with date filtering
 * - Loading interaction history from service
 * - Subscribing to real-time interaction updates
 * - Adding incoming interactions (duplicate prevention)
 *
 * Anti-patterns avoided:
 * - Proper mock isolation between tests
 * - Testing validation behavior
 * - Verifying optimistic UI updates
 * - Testing error propagation
 *
 * @module tests/unit/stores/interactionsSlice.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStore } from 'zustand';
import type { InteractionsSlice } from '../../../src/stores/slices/interactionsSlice';
import { createInteractionsSlice } from '../../../src/stores/slices/interactionsSlice';
import type { SupabaseInteractionRecord } from '../../../src/types';
import {
  createMockInteraction,
  createMockSupabaseInteractionRecord,
} from '../utils/testHelpers';

// Mock interactionService - functions defined outside vi.mock to be accessible in tests
const mockSendPoke = vi.fn();
const mockSendKiss = vi.fn();
const mockMarkAsViewed = vi.fn();
const mockGetInteractionHistory = vi.fn();
const mockSubscribeInteractions = vi.fn();

vi.mock('../../../src/api/interactionService', () => {
  // Class must be defined inside the factory function due to hoisting
  return {
    InteractionService: class {
      sendPoke(...args: unknown[]) {
        return mockSendPoke(...args);
      }
      sendKiss(...args: unknown[]) {
        return mockSendKiss(...args);
      }
      markAsViewed(...args: unknown[]) {
        return mockMarkAsViewed(...args);
      }
      getInteractionHistory(...args: unknown[]) {
        return mockGetInteractionHistory(...args);
      }
      subscribeInteractions(...args: unknown[]) {
        return mockSubscribeInteractions(...args);
      }
    },
  };
});

// Mock authService
const mockGetCurrentUserId = vi.fn();

vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserId: () => mockGetCurrentUserId(),
  },
}));

// Mock validation
const mockValidateInteraction = vi.fn();

vi.mock('../../../src/utils/interactionValidation', () => ({
  validateInteraction: (...args: unknown[]) => mockValidateInteraction(...args),
  INTERACTION_ERRORS: {
    INVALID_TYPE: 'Invalid interaction type',
    INVALID_PARTNER_ID: 'Invalid partner ID',
  },
}));

// Alias for backward compatibility with tests using createMockSupabaseRecord
const createMockSupabaseRecord = (
  overrides: Partial<SupabaseInteractionRecord> = {}
): SupabaseInteractionRecord =>
  createMockSupabaseInteractionRecord(overrides) as SupabaseInteractionRecord;

describe('InteractionsSlice', () => {
  let store: ReturnType<typeof createStore<InteractionsSlice>>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createStore<InteractionsSlice>()(createInteractionsSlice);

    // Default mock implementations
    mockValidateInteraction.mockReturnValue({ isValid: true });
    mockGetCurrentUserId.mockResolvedValue('user-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty interactions array', () => {
      expect(store.getState().interactions).toEqual([]);
    });

    it('should have unviewedCount of 0', () => {
      expect(store.getState().unviewedCount).toBe(0);
    });

    it('should have isSubscribed as false', () => {
      expect(store.getState().isSubscribed).toBe(false);
    });
  });

  describe('sendPoke', () => {
    const mockPokeRecord = createMockSupabaseRecord({ type: 'poke' });

    beforeEach(() => {
      mockSendPoke.mockResolvedValue(mockPokeRecord);
    });

    it('should validate interaction before sending', async () => {
      await store.getState().sendPoke('partner-456');

      expect(mockValidateInteraction).toHaveBeenCalledWith('partner-456', 'poke');
    });

    it('should throw error if validation fails', async () => {
      mockValidateInteraction.mockReturnValue({
        isValid: false,
        error: 'Invalid partner ID',
      });

      await expect(store.getState().sendPoke('invalid')).rejects.toThrow('Invalid partner ID');
      expect(mockSendPoke).not.toHaveBeenCalled();
    });

    it('should send poke via interactionService', async () => {
      await store.getState().sendPoke('partner-456');

      expect(mockSendPoke).toHaveBeenCalledTimes(1);
      expect(mockSendPoke).toHaveBeenCalledWith('partner-456');
    });

    it('should add interaction to state (optimistic UI)', async () => {
      await store.getState().sendPoke('partner-456');

      const state = store.getState();
      expect(state.interactions).toHaveLength(1);
      expect(state.interactions[0].type).toBe('poke');
      expect(state.interactions[0].id).toBe('interaction-uuid-1');
    });

    it('should return the poke record', async () => {
      const result = await store.getState().sendPoke('partner-456');

      expect(result).toEqual(mockPokeRecord);
    });

    it('should propagate errors from service', async () => {
      mockSendPoke.mockRejectedValue(new Error('Network error'));

      await expect(store.getState().sendPoke('partner-456')).rejects.toThrow('Network error');
    });
  });

  describe('sendKiss', () => {
    const mockKissRecord = createMockSupabaseRecord({ type: 'kiss' });

    beforeEach(() => {
      mockSendKiss.mockResolvedValue(mockKissRecord);
    });

    it('should validate interaction before sending', async () => {
      await store.getState().sendKiss('partner-456');

      expect(mockValidateInteraction).toHaveBeenCalledWith('partner-456', 'kiss');
    });

    it('should throw error if validation fails', async () => {
      mockValidateInteraction.mockReturnValue({
        isValid: false,
        error: 'Invalid interaction type',
      });

      await expect(store.getState().sendKiss('partner-456')).rejects.toThrow();
      expect(mockSendKiss).not.toHaveBeenCalled();
    });

    it('should send kiss via interactionService', async () => {
      await store.getState().sendKiss('partner-456');

      expect(mockSendKiss).toHaveBeenCalledTimes(1);
      expect(mockSendKiss).toHaveBeenCalledWith('partner-456');
    });

    it('should add kiss interaction to state', async () => {
      await store.getState().sendKiss('partner-456');

      const state = store.getState();
      expect(state.interactions).toHaveLength(1);
      expect(state.interactions[0].type).toBe('kiss');
    });
  });

  describe('markInteractionViewed', () => {
    beforeEach(() => {
      // Pre-populate with unviewed interaction
      const interaction = createMockInteraction({ id: 'int-1', viewed: false });
      store.setState({
        interactions: [interaction],
        unviewedCount: 1,
      });
      mockMarkAsViewed.mockResolvedValue(undefined);
    });

    it('should call service to mark as viewed', async () => {
      await store.getState().markInteractionViewed('int-1');

      expect(mockMarkAsViewed).toHaveBeenCalledTimes(1);
      expect(mockMarkAsViewed).toHaveBeenCalledWith('int-1');
    });

    it('should update interaction viewed status in state', async () => {
      await store.getState().markInteractionViewed('int-1');

      const state = store.getState();
      expect(state.interactions[0].viewed).toBe(true);
    });

    it('should decrement unviewedCount', async () => {
      await store.getState().markInteractionViewed('int-1');

      expect(store.getState().unviewedCount).toBe(0);
    });

    it('should not go below 0 for unviewedCount', async () => {
      store.setState({ unviewedCount: 0 });

      await store.getState().markInteractionViewed('int-1');

      expect(store.getState().unviewedCount).toBe(0);
    });

    it('should propagate errors from service', async () => {
      mockMarkAsViewed.mockRejectedValue(new Error('Update failed'));

      await expect(store.getState().markInteractionViewed('int-1')).rejects.toThrow('Update failed');
    });
  });

  describe('getUnviewedInteractions', () => {
    it('should return only unviewed interactions', () => {
      const viewed = createMockInteraction({ id: 'v1', viewed: true });
      const unviewed1 = createMockInteraction({ id: 'u1', viewed: false });
      const unviewed2 = createMockInteraction({ id: 'u2', viewed: false });

      store.setState({ interactions: [viewed, unviewed1, unviewed2] });

      const result = store.getState().getUnviewedInteractions();

      expect(result).toHaveLength(2);
      expect(result.every((i) => !i.viewed)).toBe(true);
      expect(result.map((i) => i.id)).toEqual(['u1', 'u2']);
    });

    it('should return empty array when all are viewed', () => {
      const viewed1 = createMockInteraction({ id: 'v1', viewed: true });
      const viewed2 = createMockInteraction({ id: 'v2', viewed: true });

      store.setState({ interactions: [viewed1, viewed2] });

      const result = store.getState().getUnviewedInteractions();

      expect(result).toEqual([]);
    });

    it('should return empty array when no interactions', () => {
      const result = store.getState().getUnviewedInteractions();

      expect(result).toEqual([]);
    });
  });

  describe('getInteractionHistory', () => {
    it('should filter interactions by date range (default 7 days)', () => {
      const now = new Date();
      const recent = createMockInteraction({
        id: 'recent',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });
      const old = createMockInteraction({
        id: 'old',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });

      store.setState({ interactions: [recent, old] });

      const result = store.getState().getInteractionHistory();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('recent');
    });

    it('should respect custom days parameter', () => {
      const now = new Date();
      const within3Days = createMockInteraction({
        id: 'within3',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      });
      const outside3Days = createMockInteraction({
        id: 'outside3',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      });

      store.setState({ interactions: [within3Days, outside3Days] });

      const result = store.getState().getInteractionHistory(3);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('within3');
    });

    it('should sort interactions by createdAt descending (newest first)', () => {
      const now = new Date();
      const older = createMockInteraction({
        id: 'older',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      });
      const newer = createMockInteraction({
        id: 'newer',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      });

      store.setState({ interactions: [older, newer] });

      const result = store.getState().getInteractionHistory();

      expect(result[0].id).toBe('newer');
      expect(result[1].id).toBe('older');
    });
  });

  describe('loadInteractionHistory', () => {
    it('should load interactions from service', async () => {
      const mockHistory = [
        createMockInteraction({ id: 'h1' }),
        createMockInteraction({ id: 'h2' }),
      ];
      mockGetInteractionHistory.mockResolvedValue(mockHistory);

      await store.getState().loadInteractionHistory();

      expect(mockGetInteractionHistory).toHaveBeenCalledTimes(1);
      expect(store.getState().interactions).toEqual(mockHistory);
    });

    it('should use default limit of 100', async () => {
      mockGetInteractionHistory.mockResolvedValue([]);

      await store.getState().loadInteractionHistory();

      expect(mockGetInteractionHistory).toHaveBeenCalledWith(100);
    });

    it('should use custom limit when provided', async () => {
      mockGetInteractionHistory.mockResolvedValue([]);

      await store.getState().loadInteractionHistory(50);

      expect(mockGetInteractionHistory).toHaveBeenCalledWith(50);
    });

    it('should calculate unviewedCount from loaded interactions', async () => {
      const mockHistory = [
        createMockInteraction({ id: 'h1', viewed: false }),
        createMockInteraction({ id: 'h2', viewed: true }),
        createMockInteraction({ id: 'h3', viewed: false }),
      ];
      mockGetInteractionHistory.mockResolvedValue(mockHistory);

      await store.getState().loadInteractionHistory();

      expect(store.getState().unviewedCount).toBe(2);
    });

    it('should not throw on error (graceful degradation)', async () => {
      mockGetInteractionHistory.mockRejectedValue(new Error('Network error'));

      await expect(store.getState().loadInteractionHistory()).resolves.not.toThrow();
    });
  });

  describe('subscribeToInteractions', () => {
    const mockUnsubscribe = vi.fn();

    beforeEach(() => {
      mockSubscribeInteractions.mockResolvedValue(mockUnsubscribe);
    });

    it('should throw error when not authenticated', async () => {
      mockGetCurrentUserId.mockResolvedValue(null);

      await expect(store.getState().subscribeToInteractions()).rejects.toThrow(
        'Cannot subscribe: User not authenticated'
      );
    });

    it('should subscribe via interactionService', async () => {
      await store.getState().subscribeToInteractions();

      expect(mockSubscribeInteractions).toHaveBeenCalledTimes(1);
      expect(mockSubscribeInteractions).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should set isSubscribed to true after subscribing', async () => {
      await store.getState().subscribeToInteractions();

      expect(store.getState().isSubscribed).toBe(true);
    });

    it('should return unsubscribe function', async () => {
      const unsubscribe = await store.getState().subscribeToInteractions();

      expect(typeof unsubscribe).toBe('function');
    });

    it('should set isSubscribed to false when unsubscribe is called', async () => {
      const unsubscribe = await store.getState().subscribeToInteractions();

      unsubscribe();

      expect(store.getState().isSubscribed).toBe(false);
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('addIncomingInteraction', () => {
    it('should add new interaction to beginning of array', () => {
      const existing = createMockInteraction({ id: 'existing' });
      store.setState({ interactions: [existing] });

      const incoming = createMockSupabaseRecord({ id: 'incoming', type: 'kiss' });
      store.getState().addIncomingInteraction(incoming);

      const state = store.getState();
      expect(state.interactions).toHaveLength(2);
      expect(state.interactions[0].id).toBe('incoming');
      expect(state.interactions[0].type).toBe('kiss');
    });

    it('should transform Supabase record to local Interaction format', () => {
      const incoming = createMockSupabaseRecord({
        id: 'transform-test',
        type: 'poke',
        from_user_id: 'sender-123',
        to_user_id: 'receiver-456',
        viewed: false,
        created_at: '2024-01-20T15:00:00.000Z',
      });

      store.getState().addIncomingInteraction(incoming);

      const added = store.getState().interactions[0];
      expect(added.id).toBe('transform-test');
      expect(added.type).toBe('poke');
      expect(added.fromUserId).toBe('sender-123');
      expect(added.toUserId).toBe('receiver-456');
      expect(added.viewed).toBe(false);
      expect(added.createdAt).toEqual(new Date('2024-01-20T15:00:00.000Z'));
    });

    it('should increment unviewedCount for unviewed incoming interaction', () => {
      store.setState({ unviewedCount: 2 });

      const incoming = createMockSupabaseRecord({ viewed: false });
      store.getState().addIncomingInteraction(incoming);

      expect(store.getState().unviewedCount).toBe(3);
    });

    it('should NOT increment unviewedCount for already viewed interaction', () => {
      store.setState({ unviewedCount: 2 });

      const incoming = createMockSupabaseRecord({ viewed: true });
      store.getState().addIncomingInteraction(incoming);

      expect(store.getState().unviewedCount).toBe(2);
    });

    it('should NOT add duplicate interaction (same id)', () => {
      const existing = createMockInteraction({ id: 'duplicate-id' });
      store.setState({ interactions: [existing], unviewedCount: 0 });

      const incoming = createMockSupabaseRecord({ id: 'duplicate-id' });
      store.getState().addIncomingInteraction(incoming);

      expect(store.getState().interactions).toHaveLength(1);
    });

    it('should NOT increment unviewedCount for duplicate', () => {
      const existing = createMockInteraction({ id: 'dup', viewed: true });
      store.setState({ interactions: [existing], unviewedCount: 1 });

      const incoming = createMockSupabaseRecord({ id: 'dup', viewed: false });
      store.getState().addIncomingInteraction(incoming);

      // Should remain unchanged
      expect(store.getState().unviewedCount).toBe(1);
    });
  });
});
