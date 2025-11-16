import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { realtimeService, RealtimeService } from '../../../src/services/realtimeService';
import { supabase } from '../../../src/api/supabaseClient';

// Mock Supabase
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('RealtimeService', () => {
  let mockChannel: any;

  beforeEach(() => {
    // Reset service state
    realtimeService.unsubscribeAll();

    // Create mock channel
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      }),
    };

    (supabase.channel as any).mockReturnValue(mockChannel);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeMoodChanges()', () => {
    it('creates Realtime subscription for user moods', () => {
      const onMoodChange = vi.fn();
      const userId = 'test-user-id';

      const channelId = realtimeService.subscribeMoodChanges(userId, onMoodChange);

      expect(channelId).toBe('moods:test-user-id');
      expect(supabase.channel).toHaveBeenCalledWith('moods:test-user-id');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(realtimeService.getActiveSubscriptions()).toBe(1);
    });

    it('calls onMoodChange callback when mood is updated', () => {
      const onMoodChange = vi.fn();
      const userId = 'test-user-id';

      // Capture the 'on' callback
      let postgresChangeHandler: any;
      mockChannel.on.mockImplementation((event: string, config: any, handler: any) => {
        postgresChangeHandler = handler;
        return mockChannel;
      });

      realtimeService.subscribeMoodChanges(userId, onMoodChange);

      // Simulate Supabase mood change event
      const mockPayload = {
        new: {
          id: 'mood-id',
          user_id: 'test-user-id',
          mood_type: 'happy',
          note: 'Feeling great!',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      postgresChangeHandler(mockPayload);

      expect(onMoodChange).toHaveBeenCalledWith(mockPayload.new);
    });

    it('handles subscription errors with error callback', () => {
      const onMoodChange = vi.fn();
      const onError = vi.fn();

      // Mock subscription error
      mockChannel.subscribe.mockImplementation((callback) => {
        callback('CHANNEL_ERROR', { message: 'Connection failed' });
        return mockChannel;
      });

      realtimeService.subscribeMoodChanges('test-user-id', onMoodChange, onError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Connection failed'),
        })
      );
    });

    it('handles subscription timeout', () => {
      const onMoodChange = vi.fn();
      const onError = vi.fn();

      mockChannel.subscribe.mockImplementation((callback) => {
        callback('TIMED_OUT');
        return mockChannel;
      });

      realtimeService.subscribeMoodChanges('test-user-id', onMoodChange, onError);

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('timed out'),
        })
      );
    });

    it('prevents duplicate subscriptions', () => {
      const onMoodChange = vi.fn();

      const channelId1 = realtimeService.subscribeMoodChanges('test-user-id', onMoodChange);
      const channelId2 = realtimeService.subscribeMoodChanges('test-user-id', onMoodChange);

      expect(channelId1).toBe(channelId2);
      expect(supabase.channel).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('unsubscribe()', () => {
    it('removes subscription by channel ID', async () => {
      const onMoodChange = vi.fn();
      const channelId = realtimeService.subscribeMoodChanges('test-user-id', onMoodChange);

      await realtimeService.unsubscribe(channelId);

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
      expect(realtimeService.getActiveSubscriptions()).toBe(0);
    });

    it('handles unsubscribe for non-existent channel gracefully', async () => {
      await expect(realtimeService.unsubscribe('non-existent')).resolves.not.toThrow();
    });
  });

  describe('unsubscribeAll()', () => {
    it('removes all active subscriptions', async () => {
      const onMoodChange = vi.fn();

      realtimeService.subscribeMoodChanges('user-1', onMoodChange);
      realtimeService.subscribeMoodChanges('user-2', onMoodChange);

      expect(realtimeService.getActiveSubscriptions()).toBe(2);

      await realtimeService.unsubscribeAll();

      expect(realtimeService.getActiveSubscriptions()).toBe(0);
    });
  });

  describe('setErrorHandler()', () => {
    it('uses global error handler when no local handler provided', () => {
      const globalErrorHandler = vi.fn();
      realtimeService.setErrorHandler(globalErrorHandler);

      const onMoodChange = vi.fn();

      mockChannel.subscribe.mockImplementation((callback) => {
        callback('CHANNEL_ERROR', { message: 'Network error' });
        return mockChannel;
      });

      realtimeService.subscribeMoodChanges('test-user-id', onMoodChange); // No local error handler

      expect(globalErrorHandler).toHaveBeenCalled();
    });
  });
});
