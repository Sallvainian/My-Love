import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { moodService } from '@/services/moodService';
import { moodSyncFingerprint } from '@/services/moodSyncPayload';

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

  afterEach(() => {
    vi.useRealTimers();
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

    it('[A: edit after failed first sync] leaves timestamp untouched', async () => {
      // `timestamp` is sent as created_at and (user_id, created_at) is the row's
      // identity. Moving it on edit would let an edit of a never-synced mood
      // insert a second row instead of resolving to the orphaned one.
      //
      // Moving the clock between the two calls is load-bearing: they otherwise
      // run in the same millisecond, so `new Date()` on both sides yields an
      // equal value and this assertion holds even with the regression present.
      //
      // Only `Date` is faked. Faking the timer functions too hangs
      // fake-indexeddb, which drives its request callbacks off real setTimeout,
      // and every later test in this file times out.
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-07-26T06:00:00.000Z'));
        const created = await moodService.create(userId, ['happy'], 'first');
        vi.setSystemTime(new Date('2026-07-26T06:00:05.000Z'));
        const updated = await moodService.updateMood(created.id!, ['sad'], 'edited');

        expect(updated.timestamp.getTime()).toBe(created.timestamp.getTime());
        expect(updated.note).toBe('edited');
        expect(updated.synced).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getMoodForDate', () => {
    it('returns mood entry for matching date', async () => {
      await moodService.create(userId, ['happy']);
      const today = new Date();
      const result = await moodService.getMoodForDate(today, userId);
      expect(result).not.toBeNull();
      expect(result!.mood).toBe('happy');
    });

    it('returns null for date with no entry', async () => {
      const longAgo = new Date(2020, 0, 1);
      const result = await moodService.getMoodForDate(longAgo, userId);
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

      const result = await moodService.getMoodsInRange(yesterday, tomorrow, userId);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for range with no moods', async () => {
      const start = new Date(2020, 0, 1);
      const end = new Date(2020, 0, 31);
      const result = await moodService.getMoodsInRange(start, end, userId);
      expect(result).toEqual([]);
    });
  });

  describe('getUnsyncedMoods', () => {
    it('returns newly created moods (unsynced by default)', async () => {
      await moodService.create(userId, ['happy']);
      const unsynced = await moodService.getUnsyncedMoods(userId);
      expect(unsynced.length).toBe(1);
      expect(unsynced[0].synced).toBe(false);
    });

    it('returns empty array when no moods exist', async () => {
      const result = await moodService.getUnsyncedMoods(userId);
      expect(result).toEqual([]);
    });
  });

  describe('markAsSynced', () => {
    it('marks a mood entry as synced with supabaseId', async () => {
      const created = await moodService.create(userId, ['happy']);
      const outcome = await moodService.markAsSynced(
        created.id!,
        'supa-123',
        moodSyncFingerprint(created)
      );

      expect(outcome).toBe('cleared');
      const fetched = await moodService.getMoodForDate(new Date(), userId);
      expect(fetched!.synced).toBe(true);
      expect(fetched!.supabaseId).toBe('supa-123');
    });

    it('reports a vanished entry instead of throwing', async () => {
      // A record deleted while its write was in flight is not a failure: the
      // row is on the server and nothing local references it. Throwing would
      // fail the batch into a retry that can never succeed.
      await expect(moodService.markAsSynced(99999, 'supa-123', 'any')).resolves.toBe('missing');
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
  describe('multi-account isolation on one device', () => {
    // The moods store is shared by every account that has signed in on this
    // browser profile. Its index was unique on `date` alone, so the store was
    // physically unable to hold two people's entries for the same day: the
    // second write collided with the first user's row. These drive two users
    // through one store, which nothing in the suite previously did.
    const partnerId = '223e4567-e89b-42d3-a456-426614174111';

    it('lets two accounts each log a mood on the same day', async () => {
      const mine = await moodService.create(userId, ['happy'], 'my note');
      const theirs = await moodService.create(partnerId, ['sad'], 'their note');

      expect(mine.id).not.toBe(theirs.id);
      expect(await moodService.getAll()).toHaveLength(2);
    });

    it('still allows only one mood per day per account', async () => {
      // Uniqueness was not dropped, only moved to the pair. A second entry for
      // the same person on the same day must still be rejected.
      await moodService.create(userId, ['happy']);

      await expect(moodService.create(userId, ['sad'])).rejects.toThrow();
    });

    it('getAllForUser returns only the caller\'s entries', async () => {
      await moodService.create(userId, ['happy'], 'mine');
      await moodService.create(partnerId, ['sad'], 'theirs');

      const mine = await moodService.getAllForUser(userId);

      expect(mine).toHaveLength(1);
      expect(mine[0].note).toBe('mine');
      expect(mine[0].userId).toBe(userId);
    });

    it('getMoodForDate does not return the other account\'s note', async () => {
      // This is the disclosure path: MoodTracker pre-fills the returned note
      // straight into the textarea on mount.
      await moodService.create(partnerId, ['sad'], 'their private note');

      const mine = await moodService.getMoodForDate(new Date(), userId);

      expect(mine).toBeNull();
    });

    it('getMoodsInRange stays inside the caller\'s slice of the index', async () => {
      await moodService.create(userId, ['happy'], 'mine');
      await moodService.create(partnerId, ['sad'], 'theirs');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mine = await moodService.getMoodsInRange(yesterday, tomorrow, userId);

      expect(mine).toHaveLength(1);
      expect(mine[0].userId).toBe(userId);
    });

    it('getUnsyncedMoods scoped to a user leaves the other account queued', async () => {
      // The other account's entry is still unsynced and must stay that way --
      // scoping the read must not drop it, or their offline mood is stranded.
      await moodService.create(userId, ['happy']);
      await moodService.create(partnerId, ['sad']);

      expect(await moodService.getUnsyncedMoods(userId)).toHaveLength(1);
      expect(await moodService.getUnsyncedMoods(partnerId)).toHaveLength(1);
    });
  });
});
