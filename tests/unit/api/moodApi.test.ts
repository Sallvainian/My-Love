import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoodApi, ApiValidationError } from '../../../src/api/moodApi';
import type { MoodInsert } from '../../../src/api/validation/supabaseSchemas';

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
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(),
            })),
          })),
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

// Mock error handlers
vi.mock('../../../src/api/errorHandlers', () => ({
  isOnline: vi.fn(() => true),
  handleSupabaseError: vi.fn((error) => error),
  handleNetworkError: vi.fn((error) => error),
  logSupabaseError: vi.fn(),
  isPostgrestError: vi.fn(() => false),
}));

describe('MoodApi', () => {
  let moodApi: MoodApi;

  beforeEach(() => {
    moodApi = new MoodApi();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a mood and validate response', async () => {
      const mockMoodInsert: MoodInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        note: 'Great day!',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const mockResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        note: 'Great day!',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      // Mock the supabase chain
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: mockResponse, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      const result = await moodApi.create(mockMoodInsert);

      expect(result).toEqual(mockResponse);
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.mood_type).toBe('happy');
    });

    it('should throw ApiValidationError for invalid response data', async () => {
      const mockMoodInsert: MoodInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      // Invalid response (missing required fields)
      const invalidResponse = {
        id: 'invalid-uuid', // Invalid UUID
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        note: null,
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: invalidResponse, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await expect(moodApi.create(mockMoodInsert)).rejects.toThrow(ApiValidationError);
    });

    it('should handle database errors', async () => {
      const mockMoodInsert: MoodInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      const mockError = new Error('Database error');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      await expect(moodApi.create(mockMoodInsert)).rejects.toThrow();
    });
  });

  describe('fetchByUser', () => {
    it('should fetch moods and validate response array', async () => {
      const mockMoods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'happy',
          note: 'Mood 1',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'content',
          note: null,
          created_at: '2024-01-16T10:30:00.000Z',
          updated_at: '2024-01-16T10:30:00.000Z',
        },
      ];

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockLimit = vi.fn().mockResolvedValue({ data: mockMoods, error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await moodApi.fetchByUser('550e8400-e29b-41d4-a716-446655440001', 10);

      expect(result).toEqual(mockMoods);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no moods found', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await moodApi.fetchByUser('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toEqual([]);
    });

    it('should throw ApiValidationError for invalid mood in array', async () => {
      const invalidMoods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'happy',
          note: 'Valid mood',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
        {
          id: 'invalid-uuid',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'invalid-type', // Invalid mood type
          note: 'Invalid mood',
          created_at: '2024-01-16T10:30:00.000Z',
          updated_at: '2024-01-16T10:30:00.000Z',
        },
      ];

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockLimit = vi.fn().mockResolvedValue({ data: invalidMoods, error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await expect(moodApi.fetchByUser('550e8400-e29b-41d4-a716-446655440001')).rejects.toThrow(
        ApiValidationError
      );
    });
  });

  describe('fetchByDateRange', () => {
    it('should fetch moods by date range and validate response', async () => {
      const mockMoods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '550e8400-e29b-41d4-a716-446655440001',
          mood_type: 'grateful',
          note: 'In range',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
      ];

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockOrder = vi.fn().mockResolvedValue({ data: mockMoods, error: null });
      const mockLte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte });
      const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await moodApi.fetchByDateRange(
        '550e8400-e29b-41d4-a716-446655440001',
        '2024-01-01T00:00:00.000Z',
        '2024-01-31T23:59:59.000Z'
      );

      expect(result).toEqual(mockMoods);
      expect(result).toHaveLength(1);
    });
  });

  describe('fetchById', () => {
    it('should fetch mood by ID and validate response', async () => {
      const mockMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'thoughtful',
        note: 'Test note',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z',
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: mockMood, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await moodApi.fetchById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockMood);
    });

    it('should return null when mood not found', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await moodApi.fetchById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update mood and validate response', async () => {
      const mockUpdatedMood = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'loved',
        note: 'Updated note',
        created_at: '2024-01-15T10:30:00.000Z',
        updated_at: '2024-01-15T11:00:00.000Z',
      };

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockSingle = vi.fn().mockResolvedValue({ data: mockUpdatedMood, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      const result = await moodApi.update('550e8400-e29b-41d4-a716-446655440000', {
        note: 'Updated note',
      });

      expect(result).toEqual(mockUpdatedMood);
      expect(result.note).toBe('Updated note');
    });
  });

  describe('delete', () => {
    it('should delete mood successfully', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ delete: mockDelete });

      await expect(moodApi.delete('550e8400-e29b-41d4-a716-446655440000')).resolves.not.toThrow();
    });

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed');

      const { supabase } = await import('../../../src/api/supabaseClient');
      const mockEq = vi.fn().mockResolvedValue({ error: mockError });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ delete: mockDelete });

      await expect(moodApi.delete('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow();
    });
  });

  describe('offline handling', () => {
    it('should throw network error when offline', async () => {
      const { isOnline } = await import('../../../src/api/errorHandlers');
      (isOnline as any).mockReturnValue(false);

      const mockMoodInsert: MoodInsert = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        mood_type: 'happy',
        created_at: '2024-01-15T10:30:00.000Z',
      };

      await expect(moodApi.create(mockMoodInsert)).rejects.toThrow();
      await expect(moodApi.fetchByUser('550e8400-e29b-41d4-a716-446655440001')).rejects.toThrow();
      await expect(moodApi.fetchById('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow();
      await expect(
        moodApi.update('550e8400-e29b-41d4-a716-446655440000', { note: 'test' })
      ).rejects.toThrow();
      await expect(moodApi.delete('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow();
    });
  });
});
