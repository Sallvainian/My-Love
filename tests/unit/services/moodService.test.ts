import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { moodService } from '@/services/moodService';

describe('moodService', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000';

  beforeEach(async () => {
    // Clear all moods before each test by clearing the store
    try {
      await moodService.clear();
    } catch {
      // Ignore if db not initialized yet
    }
  });

  describe('create', () => {
    it('creates a mood entry with correct fields', async () => {
      const entry = await moodService.create(userId, ['happy']);
      expect(entry.userId).toBe(userId);
      expect(entry.mood).toBe('happy');
      expect(entry.moods).toEqual(['happy']);
      expect(entry.synced).toBe(false);
      expect(entry.id).toBeDefined();
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('stores multiple moods with first as primary', async () => {
      const entry = await moodService.create(userId, ['happy', 'grateful']);
      expect(entry.mood).toBe('happy');
      expect(entry.moods).toEqual(['happy', 'grateful']);
    });

    it('stores optional note', async () => {
      const entry = await moodService.create(userId, ['loved'], 'Feeling great');
      expect(entry.note).toBe('Feeling great');
    });

    it('stores empty note when not provided', async () => {
      const entry = await moodService.create(userId, ['happy']);
      expect(entry.note).toBe('');
    });

    it('throws validation error for invalid mood type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(moodService.create(userId, ['invalid-mood' as any])).rejects.toThrow();
    });

    it('throws validation error for note exceeding 200 chars', async () => {
      const longNote = 'a'.repeat(201);
      await expect(moodService.create(userId, ['happy'], longNote)).rejects.toThrow();
    });
  });

  describe('updateMood', () => {
    it('updates mood type and marks as unsynced', async () => {
      const created = await moodService.create(userId, ['happy']);
      const updated = await moodService.updateMood(created.id!, ['sad']);
      expect(updated.mood).toBe('sad');
      expect(updated.moods).toEqual(['sad']);
      expect(updated.synced).toBe(false);
    });

    it('updates note', async () => {
      const created = await moodService.create(userId, ['happy'], 'old note');
      const updated = await moodService.updateMood(created.id!, ['happy'], 'new note');
      expect(updated.note).toBe('new note');
    });

    it('throws if mood entry not found', async () => {
      await expect(moodService.updateMood(99999, ['happy'])).rejects.toThrow('not found');
    });

    it('throws validation error for invalid mood in update', async () => {
      const created = await moodService.create(userId, ['happy']);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(moodService.updateMood(created.id!, ['bad' as any])).rejects.toThrow();
    });
  });

  describe('getMoodForDate', () => {
    it('returns mood entry for matching date', async () => {
      await moodService.create(userId, ['happy']);
      const today = new Date();
      const result = await moodService.getMoodForDate(today);
      expect(result).not.toBeNull();
      expect(result!.mood).toBe('happy');
    });

    it('returns null for date with no entry', async () => {
      const longAgo = new Date(2020, 0, 1);
      const result = await moodService.getMoodForDate(longAgo);
      expect(result).toBeNull();
    });
  });

  describe('getMoodsInRange', () => {
    it('returns moods within date range', async () => {
      await moodService.create(userId, ['happy']);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await moodService.getMoodsInRange(yesterday, tomorrow);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for range with no moods', async () => {
      const start = new Date(2020, 0, 1);
      const end = new Date(2020, 0, 31);
      const result = await moodService.getMoodsInRange(start, end);
      expect(result).toEqual([]);
    });
  });

  describe('getUnsyncedMoods', () => {
    it('returns newly created moods (unsynced by default)', async () => {
      await moodService.create(userId, ['happy']);
      const unsynced = await moodService.getUnsyncedMoods();
      expect(unsynced.length).toBe(1);
      expect(unsynced[0].synced).toBe(false);
    });

    it('returns empty array when no moods exist', async () => {
      const result = await moodService.getUnsyncedMoods();
      expect(result).toEqual([]);
    });
  });

  describe('markAsSynced', () => {
    it('marks a mood entry as synced with supabaseId', async () => {
      const created = await moodService.create(userId, ['happy']);
      await moodService.markAsSynced(created.id!, 'supa-123');

      const fetched = await moodService.getMoodForDate(new Date());
      expect(fetched!.synced).toBe(true);
      expect(fetched!.supabaseId).toBe('supa-123');
    });

    it('throws if entry not found', async () => {
      await expect(moodService.markAsSynced(99999, 'supa-123')).rejects.toThrow();
    });
  });

  describe('getAll (inherited)', () => {
    it('returns all mood entries', async () => {
      await moodService.create(userId, ['happy']);
      const all = await moodService.getAll();
      expect(all.length).toBe(1);
      expect(all[0].mood).toBe('happy');
    });
  });
});
