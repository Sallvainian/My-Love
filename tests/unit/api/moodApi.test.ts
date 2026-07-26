/**
 * moodApi — duplicate-mood spec coverage
 *
 * Goal A: writes must be idempotent on (user_id, created_at).
 * Goal B: getMoodHistory pagination must be deterministic across page
 *         boundaries that land on a created_at tie.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeMoodsBackend, fakeUuid } from './fakeMoodsBackend';

const backend = new FakeMoodsBackend();

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => backend.client().from(table),
  },
  getPartnerId: vi.fn(),
}));

import { moodApi } from '@/api/moodApi';
import type { MoodInsert } from '@/api/validation/supabaseSchemas';

const USER_ID = fakeUuid(900001);
const OTHER_USER_ID = fakeUuid(900002);
const LOG_TIME = '2026-01-26T23:52:29.297Z';

function moodInsert(overrides: Partial<MoodInsert> = {}): MoodInsert {
  return {
    user_id: USER_ID,
    mood_type: 'happy',
    mood_types: ['happy'],
    note: null,
    created_at: LOG_TIME,
    ...overrides,
  };
}

describe('moodApi', () => {
  beforeEach(() => {
    backend.reset();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  describe('create — Goal A idempotency', () => {
    it('[A: first sync of a new mood] writes exactly one row and returns it', async () => {
      const created = await moodApi.create(moodInsert());

      expect(backend.rows).toHaveLength(1);
      expect(created.id).toBe(backend.rows[0].id);
      expect(created.created_at).toBe(LOG_TIME);
    });

    it('[A: first sync of a new mood] resolves conflicts on user_id,created_at', async () => {
      await moodApi.create(moodInsert());

      expect(backend.operations[0]).toMatchObject({
        op: 'upsert',
        onConflict: 'user_id,created_at',
      });
    });

    it('[A: retry after partial success] a re-sent mood resolves to the committed row', async () => {
      // Vector 1: the row commits, the response path throws, so markAsSynced
      // never runs and the retry re-sends the identical key.
      backend.corruptNextWriteResponse = true;
      await expect(moodApi.create(moodInsert())).rejects.toThrow(
        'Invalid mood data received from server'
      );
      expect(backend.rows).toHaveLength(1);

      const retried = await moodApi.create(moodInsert());

      expect(backend.rows).toHaveLength(1);
      expect(retried.id).toBe(backend.rows[0].id);
    });

    it('[A: two writers race] concurrent writes of the same key resolve to one row', async () => {
      const [first, second] = await Promise.all([
        moodApi.create(moodInsert()),
        moodApi.create(moodInsert()),
      ]);

      expect(backend.rows).toHaveLength(1);
      expect(first.id).toBe(second.id);
    });

    it('[A: two writers race] different users with the same created_at stay separate', async () => {
      await moodApi.create(moodInsert());
      await moodApi.create(moodInsert({ user_id: OTHER_USER_ID }));

      expect(backend.rows).toHaveLength(2);
    });

    it('[A: two genuine moods] a second log at a different time gets its own row', async () => {
      await moodApi.create(moodInsert());
      await moodApi.create(moodInsert({ created_at: '2026-01-26T23:55:00.000Z' }));

      expect(backend.rows).toHaveLength(2);
    });
  });

  describe('update — Goal A edit path', () => {
    it('[A: edit an already-synced mood] PATCHes in place and preserves created_at', async () => {
      const seeded = backend.seed({ user_id: USER_ID, created_at: LOG_TIME, note: 'first' });

      const updated = await moodApi.update(seeded.id, { note: 'edited' });

      expect(backend.rows).toHaveLength(1);
      expect(updated.id).toBe(seeded.id);
      expect(updated.note).toBe('edited');
      expect(backend.rows[0].created_at).toBe(LOG_TIME);
    });
  });

  describe('getMoodHistory — Goal B pagination', () => {
    /** 60 rows, newest first, with a created_at tie straddling the page boundary */
    function seedTiedHistory(): string[] {
      const base = Date.parse('2026-02-01T12:00:00.000Z');
      const ids: string[] = [];

      for (let i = 0; i < 60; i++) {
        // Rows 49 and 50 share a created_at: sorted newest-first they land at
        // indexes 49 and 50, i.e. either side of the 50-row page boundary.
        const offsetIndex = i === 50 ? 49 : i;
        const row = backend.seed({
          user_id: USER_ID,
          created_at: new Date(base - offsetIndex * 60_000).toISOString(),
        });
        ids.push(row.id);
      }

      return ids;
    }

    it('[B: tied created_at across a page boundary] orders by created_at then id', async () => {
      seedTiedHistory();

      await moodApi.getMoodHistory(USER_ID, 0, 50);

      expect(backend.operations[0].orders).toEqual([
        { column: 'created_at', ascending: false },
        { column: 'id', ascending: false },
      ]);
    });

    it('[B: tied created_at across a page boundary] each row appears on exactly one page', async () => {
      const seededIds = seedTiedHistory();

      const pageOne = await moodApi.getMoodHistory(USER_ID, 0, 50);
      const pageTwo = await moodApi.getMoodHistory(USER_ID, 50, 50);

      const returnedIds = [...pageOne, ...pageTwo].map((mood) => mood.id);

      expect(pageOne).toHaveLength(50);
      expect(pageTwo).toHaveLength(10);
      // No row duplicated across the boundary...
      expect(new Set(returnedIds).size).toBe(60);
      // ...and none skipped.
      expect([...returnedIds].sort()).toEqual([...seededIds].sort());
    });
  });
});
