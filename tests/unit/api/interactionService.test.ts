import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionService } from '../../../src/api/interactionService';
import type { SupabaseInteractionRecord } from '../../../src/api/interactionService';

// Mock Supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(),
          })),
        })),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(),
          })),
          order: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
  getCurrentUserId: vi.fn(() => Promise.resolve('550e8400-e29b-41d4-a716-446655440001')),
}));

// Mock error handlers
vi.mock('../../../src/api/errorHandlers', () => ({
  isOnline: vi.fn(() => true),
  handleSupabaseError: vi.fn((error) => error),
  handleNetworkError: vi.fn((error) => error),
  logSupabaseError: vi.fn(),
  isPostgrestError: vi.fn(() => false),
}));

describe('InteractionService', () => {
  let interactionService: InteractionService;

  beforeEach(() => {
    interactionService = new InteractionService();
    vi.clearAllMocks();
  });

  describe('sendPoke', () => {
    it('should send a poke interaction successfully', async () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440002';
      const mockResponse: SupabaseInteractionRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'poke',
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: partnerId,
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      // Mock the supabase chain
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: mockResponse, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const result = await interactionService.sendPoke(partnerId);

      expect(result).toEqual(mockResponse);
      expect(result.type).toBe('poke');
      expect(result.to_user_id).toBe(partnerId);
      expect(result.viewed).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith({
        type: 'poke',
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: partnerId,
        viewed: false,
      });
    });

    it('should handle database errors when sending poke', async () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440002';
      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await expect(interactionService.sendPoke(partnerId)).rejects.toThrow();
    });

    it('should throw error when no data returned from insert', async () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440002';

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await expect(interactionService.sendPoke(partnerId)).rejects.toThrow(
        'No data returned from Supabase insert'
      );
    });
  });

  describe('sendKiss', () => {
    it('should send a kiss interaction successfully', async () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440002';
      const mockResponse: SupabaseInteractionRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'kiss',
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: partnerId,
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: mockResponse, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const result = await interactionService.sendKiss(partnerId);

      expect(result).toEqual(mockResponse);
      expect(result.type).toBe('kiss');
      expect(result.to_user_id).toBe(partnerId);
      expect(result.viewed).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith({
        type: 'kiss',
        from_user_id: '550e8400-e29b-41d4-a716-446655440001',
        to_user_id: partnerId,
        viewed: false,
      });
    });

    it('should handle database errors when sending kiss', async () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440002';
      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await expect(interactionService.sendKiss(partnerId)).rejects.toThrow();
    });
  });

  describe('subscribeInteractions', () => {
    let mockRemoveChannel: any;

    beforeEach(async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      mockRemoveChannel = supabase.removeChannel;
    });

    it('should set up Realtime subscription for incoming interactions', async () => {
      const mockCallback = vi.fn();
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      (supabase.channel as any).mockReturnValue(mockChannel);

      const unsubscribe = await interactionService.subscribeInteractions(mockCallback);

      expect(supabase.channel).toHaveBeenCalledWith('incoming-interactions');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: 'to_user_id=eq.550e8400-e29b-41d4-a716-446655440001',
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when new interaction is received', async () => {
      const mockCallback = vi.fn();
      const mockInteraction: SupabaseInteractionRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'poke',
        from_user_id: '550e8400-e29b-41d4-a716-446655440002',
        to_user_id: '550e8400-e29b-41d4-a716-446655440001',
        viewed: false,
        created_at: '2024-01-15T10:30:00.000Z',
      };

      let capturedCallback: ((payload: any) => void) | null = null;
      const mockChannel = {
        on: vi.fn((event, config, callback) => {
          capturedCallback = callback;
          return mockChannel;
        }),
        subscribe: vi.fn(),
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      (supabase.channel as any).mockReturnValue(mockChannel);

      await interactionService.subscribeInteractions(mockCallback);

      // Simulate receiving an interaction
      if (capturedCallback) {
        capturedCallback({ new: mockInteraction });
      }

      expect(mockCallback).toHaveBeenCalledWith(mockInteraction);
    });

    it('should unsubscribe from Realtime channel when unsubscribe is called', async () => {
      const mockCallback = vi.fn();
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      (supabase.channel as any).mockReturnValue(mockChannel);

      const unsubscribe = await interactionService.subscribeInteractions(mockCallback);

      // Verify unsubscribe function can be called without errors
      expect(() => unsubscribe()).not.toThrow();

      // Calling unsubscribe multiple times should be safe (idempotent)
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('getInteractionHistory', () => {
    it('should fetch interaction history successfully', async () => {
      const mockInteractions: SupabaseInteractionRecord[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'poke',
          from_user_id: '550e8400-e29b-41d4-a716-446655440001',
          to_user_id: '550e8400-e29b-41d4-a716-446655440002',
          viewed: true,
          created_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          type: 'kiss',
          from_user_id: '550e8400-e29b-41d4-a716-446655440002',
          to_user_id: '550e8400-e29b-41d4-a716-446655440001',
          viewed: false,
          created_at: '2024-01-14T10:30:00.000Z',
        },
      ];

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockRange = vi.fn().mockResolvedValue({ data: mockInteractions, error: null });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await interactionService.getInteractionHistory(50, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result[0].type).toBe('poke');
      expect(result[0].fromUserId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result[0].toUserId).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(result[0].viewed).toBe(true);
      expect(result[0].createdAt).toBeInstanceOf(Date);

      expect(mockOr).toHaveBeenCalledWith(
        'from_user_id.eq.550e8400-e29b-41d4-a716-446655440001,to_user_id.eq.550e8400-e29b-41d4-a716-446655440001'
      );
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockRange).toHaveBeenCalledWith(0, 49);
    });

    it('should return empty array when no interactions found', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await interactionService.getInteractionHistory();

      expect(result).toEqual([]);
    });

    it('should handle database errors when fetching history', async () => {
      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockRange = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await expect(interactionService.getInteractionHistory()).rejects.toThrow();
    });

    it('should use custom limit and offset parameters', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await interactionService.getInteractionHistory(20, 10);

      expect(mockRange).toHaveBeenCalledWith(10, 29);
    });
  });

  describe('getUnviewedInteractions', () => {
    it('should fetch unviewed interactions successfully', async () => {
      const mockInteractions: SupabaseInteractionRecord[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'poke',
          from_user_id: '550e8400-e29b-41d4-a716-446655440002',
          to_user_id: '550e8400-e29b-41d4-a716-446655440001',
          viewed: false,
          created_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          type: 'kiss',
          from_user_id: '550e8400-e29b-41d4-a716-446655440002',
          to_user_id: '550e8400-e29b-41d4-a716-446655440001',
          viewed: false,
          created_at: '2024-01-14T10:30:00.000Z',
        },
      ];

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockOrder = vi.fn().mockResolvedValue({ data: mockInteractions, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await interactionService.getUnviewedInteractions();

      expect(result).toHaveLength(2);
      expect(result[0].viewed).toBe(false);
      expect(result[1].viewed).toBe(false);

      expect(mockEq1).toHaveBeenCalledWith('to_user_id', '550e8400-e29b-41d4-a716-446655440001');
      expect(mockEq2).toHaveBeenCalledWith('viewed', false);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should return empty array when no unviewed interactions', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await interactionService.getUnviewedInteractions();

      expect(result).toEqual([]);
    });

    it('should handle database errors when fetching unviewed interactions', async () => {
      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await expect(interactionService.getUnviewedInteractions()).rejects.toThrow();
    });
  });

  describe('markAsViewed', () => {
    it('should mark interaction as viewed successfully', async () => {
      const interactionId = '550e8400-e29b-41d4-a716-446655440000';

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await expect(interactionService.markAsViewed(interactionId)).resolves.not.toThrow();

      expect(mockUpdate).toHaveBeenCalledWith({ viewed: true });
      expect(mockEq).toHaveBeenCalledWith('id', interactionId);
    });

    it('should handle database errors when marking as viewed', async () => {
      const interactionId = '550e8400-e29b-41d4-a716-446655440000';
      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockEq = vi.fn().mockResolvedValue({ error: mockError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      await expect(interactionService.markAsViewed(interactionId)).rejects.toThrow();
    });
  });

  describe('offline handling', () => {
    it('should throw network error when offline for sendPoke', async () => {
      const { isOnline } = await import('../../../src/api/errorHandlers');
      (isOnline as any).mockReturnValue(false);

      const partnerId = '550e8400-e29b-41d4-a716-446655440002';

      await expect(interactionService.sendPoke(partnerId)).rejects.toThrow();
    });

    it('should throw network error when offline for sendKiss', async () => {
      const { isOnline } = await import('../../../src/api/errorHandlers');
      (isOnline as any).mockReturnValue(false);

      const partnerId = '550e8400-e29b-41d4-a716-446655440002';

      await expect(interactionService.sendKiss(partnerId)).rejects.toThrow();
    });
  });
});
