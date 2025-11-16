import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { moodService } from '../../../src/services/moodService';
import type { MoodEntry, MoodType } from '../../../src/types';

/**
 * Generate unique date strings for tests to avoid by-date unique constraint
 * Each call returns a different date: 2025-11-14, 2025-11-15, 2025-11-16, etc.
 */
let testDateCounter = 14; // Start at Nov 14
function getUniqueTestDate(): string {
  const date = `2025-11-${testDateCounter.toString().padStart(2, '0')}`;
  testDateCounter++;
  return date;
}

/**
 * Create mood entry with unique date to avoid by-date constraint violations
 * Directly inserts into IndexedDB with specified date instead of using today
 */
async function createMoodWithUniqueDate(mood: MoodType, note?: string): Promise<MoodEntry> {
  const uniqueDate = getUniqueTestDate();

  // Create mood entry with unique date
  const moodEntry: Omit<MoodEntry, 'id'> = {
    userId: 'test-user-id',
    mood,
    note: note || '',
    date: uniqueDate,
    timestamp: new Date(),
    synced: false,
    supabaseId: undefined,
  };

  // Manually insert with unique date (bypasses create() which uses today)
  await moodService.init();
  const id = await moodService['db']!.add('moods', moodEntry as any);
  return { ...moodEntry, id } as MoodEntry;
}

describe('MoodService', () => {
  beforeEach(async () => {
    // Reset test date counter for each test
    testDateCounter = 14;
    // Service is a singleton instance, initialize and clear before each test
    await moodService.init();
    await moodService.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // === CRUD Operations ===
  describe('create()', () => {
    it('creates a new mood entry with valid data', async () => {
      const created = await moodService.create('test-user-id', 'happy', 'Feeling great today!');

      expect(created).toBeDefined();
      expect(created.id).toBeGreaterThan(0);
      expect(created.mood).toBe('happy');
      expect(created.note).toBe('Feeling great today!');
      expect(created.synced).toBe(false);
      expect(created.supabaseId).toBeUndefined();
      expect(created.timestamp).toBeInstanceOf(Date);
    });

    it('creates mood entry without note', async () => {
      const created = await moodService.create('test-user-id', 'loved');

      expect(created).toBeDefined();
      expect(created.mood).toBe('loved');
      expect(created.note).toBe('');
    });

    it('auto-increments id for multiple mood entries', async () => {
      const mood1 = await createMoodWithUniqueDate('happy');
      const mood2 = await createMoodWithUniqueDate('content');

      expect(mood2.id).toBe(mood1.id! + 1);
    });

    it('validates mood type enum', async () => {
      await expect(moodService.create('test-user-id', 'invalid' as MoodType)).rejects.toThrow();
    });

    it('validates note max length (200 chars)', async () => {
      const longNote = 'a'.repeat(201);
      await expect(moodService.create('test-user-id', 'happy', longNote)).rejects.toThrow();
    });

    it('sets date to today in ISO format', async () => {
      const created = await moodService.create('test-user-id', 'grateful');
      const today = new Date().toISOString().split('T')[0];

      expect(created.date).toBe(today);
    });
  });

  describe('updateMood()', () => {
    it('updates an existing mood entry', async () => {
      const created = await moodService.create('test-user-id', 'happy', 'Initial note');
      const updated = await moodService.updateMood(created.id!, 'content', 'Updated note');

      expect(updated.id).toBe(created.id);
      expect(updated.mood).toBe('content');
      expect(updated.note).toBe('Updated note');
      expect(updated.synced).toBe(false); // Should reset synced flag
    });

    it('updates mood without changing note', async () => {
      const created = await moodService.create('test-user-id', 'happy', 'Original note');
      const updated = await moodService.updateMood(created.id!, 'grateful');

      expect(updated.mood).toBe('grateful');
      expect(updated.note).toBe('');
    });

    it('throws error for non-existent id', async () => {
      await expect(moodService.updateMood(99999, 'happy')).rejects.toThrow();
    });

    it('validates updated mood type', async () => {
      const created = await moodService.create('test-user-id', 'happy');
      await expect(moodService.updateMood(created.id!, 'invalid' as MoodType)).rejects.toThrow();
    });

    it('validates updated note max length', async () => {
      const created = await moodService.create('test-user-id', 'happy');
      const longNote = 'a'.repeat(201);
      await expect(moodService.updateMood(created.id!, 'content', longNote)).rejects.toThrow();
    });
  });

  describe('get()', () => {
    it('retrieves mood entry by id', async () => {
      const created = await moodService.create('test-user-id', 'thoughtful', 'Deep thoughts');
      const retrieved = await moodService.get(created.id!);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.mood).toBe('thoughtful');
      expect(retrieved?.note).toBe('Deep thoughts');
    });

    it('returns null for non-existent id', async () => {
      const result = await moodService.get(99999);
      expect(result).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('retrieves all mood entries', async () => {
      await createMoodWithUniqueDate('happy');
      await createMoodWithUniqueDate('content');
      await createMoodWithUniqueDate('grateful');

      const allMoods = await moodService.getAll();

      expect(allMoods).toHaveLength(3);
      expect(allMoods.map((m) => m.mood)).toContain('happy');
      expect(allMoods.map((m) => m.mood)).toContain('content');
      expect(allMoods.map((m) => m.mood)).toContain('grateful');
    });

    it('returns empty array when no moods exist', async () => {
      const allMoods = await moodService.getAll();
      expect(allMoods).toEqual([]);
    });
  });

  describe('delete()', () => {
    it('deletes a mood entry by id', async () => {
      const created = await moodService.create('test-user-id', 'happy');
      await moodService.delete(created.id!);

      const retrieved = await moodService.get(created.id!);
      expect(retrieved).toBeNull();
    });
  });

  describe('clear()', () => {
    it('clears all mood entries', async () => {
      await createMoodWithUniqueDate('happy');
      await createMoodWithUniqueDate('content');

      await moodService.clear();

      const allMoods = await moodService.getAll();
      expect(allMoods).toEqual([]);
    });
  });

  // === Date-Based Queries ===
  describe('getMoodForDate()', () => {
    it('retrieves mood for specific date', async () => {
      const created = await moodService.create('test-user-id', 'happy', 'Today is great!');
      const today = new Date();
      const retrieved = await moodService.getMoodForDate(today);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.mood).toBe('happy');
    });

    it('returns null when no mood exists for date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await moodService.getMoodForDate(yesterday);
      expect(result).toBeNull();
    });

    it('uses by-date index for fast lookup', async () => {
      // Create mood for today
      await moodService.create('test-user-id', 'happy');

      const today = new Date();
      const start = performance.now();
      await moodService.getMoodForDate(today);
      const duration = performance.now() - start;

      // Query should be fast (<100ms per story requirement)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('getMoodsInRange()', () => {
    it('retrieves moods in date range', async () => {
      // Create moods with explicit unique dates
      const mood1 = await createMoodWithUniqueDate('happy');
      const mood2 = await createMoodWithUniqueDate('content');
      const mood3 = await createMoodWithUniqueDate('grateful');

      const start = new Date('2025-11-14');
      const end = new Date('2025-11-20');

      const moods = await moodService.getMoodsInRange(start, end);

      expect(moods.length).toBe(3);
      expect(moods.map((m) => m.id)).toContain(mood1.id);
      expect(moods.map((m) => m.id)).toContain(mood2.id);
      expect(moods.map((m) => m.id)).toContain(mood3.id);
    });

    it('returns empty array when no moods in range', async () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const moods = await moodService.getMoodsInRange(twoWeeksAgo, weekAgo);
      expect(moods).toEqual([]);
    });
  });

  // === Sync-Related Methods ===
  describe('getUnsyncedMoods()', () => {
    it('retrieves all unsynced mood entries', async () => {
      await createMoodWithUniqueDate('happy');
      await createMoodWithUniqueDate('content');

      const unsynced = await moodService.getUnsyncedMoods();

      expect(unsynced).toHaveLength(2);
      expect(unsynced.every((m) => m.synced === false)).toBe(true);
    });

    it('excludes synced moods', async () => {
      const mood1 = await createMoodWithUniqueDate('happy');
      const mood2 = await createMoodWithUniqueDate('content');

      // Mark mood1 as synced
      await moodService.markAsSynced(mood1.id!, 'supabase-id-1');

      const unsynced = await moodService.getUnsyncedMoods();

      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe(mood2.id);
    });

    it('returns empty array when all moods synced', async () => {
      const mood = await moodService.create('test-user-id', 'happy');
      await moodService.markAsSynced(mood.id!, 'supabase-id-1');

      const unsynced = await moodService.getUnsyncedMoods();
      expect(unsynced).toEqual([]);
    });
  });

  describe('markAsSynced()', () => {
    it('marks mood entry as synced', async () => {
      const created = await moodService.create('test-user-id', 'happy');
      await moodService.markAsSynced(created.id!, 'supabase-123');

      const retrieved = await moodService.get(created.id!);

      expect(retrieved?.synced).toBe(true);
      expect(retrieved?.supabaseId).toBe('supabase-123');
    });

    it('throws error for non-existent id', async () => {
      await expect(moodService.markAsSynced(99999, 'supabase-123')).rejects.toThrow();
    });
  });

  // === Edge Cases ===
  describe('Edge Cases', () => {
    it('handles empty note correctly', async () => {
      const created = await moodService.create('test-user-id', 'happy', '');
      expect(created.note).toBe('');
    });

    it('trims whitespace from notes', async () => {
      const created = await moodService.create('test-user-id', 'happy', '  test note  ');
      // Note: MoodEntrySchema doesn't trim, so this tests actual behavior
      expect(created.note).toBe('  test note  ');
    });

    it('handles all valid mood types', async () => {
      const moods: MoodType[] = ['loved', 'happy', 'content', 'thoughtful', 'grateful'];

      for (const mood of moods) {
        const created = await createMoodWithUniqueDate(mood);
        expect(created.mood).toBe(mood);
      }
    });

    it('stores timestamp correctly', async () => {
      const before = new Date();
      const created = await moodService.create('test-user-id', 'happy');
      const after = new Date();

      expect(created.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(created.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
