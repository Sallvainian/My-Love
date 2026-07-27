/**
 * moodSyncService — duplicate-mood spec coverage (Goal A)
 *
 * Drives the real moodApi against an in-memory moods table that enforces the
 * (user_id, created_at) unique key, so "how many rows exist afterwards" is an
 * observable outcome rather than an assertion about call shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeMoodsBackend, fakeUuid } from './fakeMoodsBackend';

const backend = new FakeMoodsBackend();

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => backend.client().from(table),
  },
  getPartnerId: vi.fn(),
}));

vi.mock('@/services/moodService', () => ({
  moodService: {
    getUnsyncedMoods: vi.fn(),
    markAsSynced: vi.fn(),
  },
}));

import { moodSyncService } from '@/api/moodSyncService';
import { getPartnerId } from '@/api/supabaseClient';
import { moodSyncFingerprint } from '@/services/moodSyncPayload';
import { moodService } from '@/services/moodService';
import type { MoodEntry } from '@/types';

const mockedMoodService = vi.mocked(moodService);
const mockedGetPartnerId = vi.mocked(getPartnerId);

const USER_ID = fakeUuid(910001);
const LOG_TIME = '2026-01-26T23:52:29.297Z';

function pendingMood(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: USER_ID,
    mood: 'happy',
    moods: ['happy'],
    note: 'original',
    date: '2026-01-26',
    timestamp: new Date(LOG_TIME),
    synced: false,
    ...overrides,
  };
}

/** Run syncPendingMoods to completion, driving the retry backoff timers */
async function runSync(): Promise<{
  synced: number;
  failed: number;
  deferred: number;
  errors: string[];
}> {
  const pending = moodSyncService.syncPendingMoods();
  await vi.advanceTimersByTimeAsync(30_000);
  return pending;
}

describe('moodSyncService.syncPendingMoods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    backend.reset();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockedGetPartnerId.mockResolvedValue(null);
    mockedMoodService.markAsSynced.mockResolvedValue('cleared');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[A: first sync of a new mood] writes one row and binds its id to the record', async () => {
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);

    const result = await runSync();

    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(backend.rows).toHaveLength(1);
    expect(mockedMoodService.markAsSynced).toHaveBeenCalledWith(1, backend.rows[0].id, moodSyncFingerprint(pendingMood()));
  });

  it('[A: retry after partial success] the retry resolves to the committed row, not a second one', async () => {
    // Vector 1: the insert commits, the response fails validation, so
    // markAsSynced never runs and the retry re-sends the identical record.
    backend.corruptNextWriteResponse = true;
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);

    const result = await runSync();

    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(backend.rows).toHaveLength(1);
    expect(mockedMoodService.markAsSynced).toHaveBeenCalledTimes(1);
    expect(mockedMoodService.markAsSynced).toHaveBeenCalledWith(1, backend.rows[0].id, moodSyncFingerprint(pendingMood()));
  });

  it('[A: two writers race] a row another writer already committed is adopted, not duplicated', async () => {
    // Vector 2: the service worker (or a second tab) got there first. The main
    // thread cannot see that, so it syncs the same record from scratch.
    const alreadyWritten = backend.seed({ user_id: USER_ID, created_at: LOG_TIME });
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);

    const result = await runSync();

    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(backend.rows).toHaveLength(1);
    expect(mockedMoodService.markAsSynced).toHaveBeenCalledWith(1, alreadyWritten.id, moodSyncFingerprint(pendingMood()));
  });

  it('[A: edit an already-synced mood] PATCHes the existing row and leaves created_at alone', async () => {
    const existing = backend.seed({ user_id: USER_ID, created_at: LOG_TIME, note: 'original' });
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([
      pendingMood({ supabaseId: existing.id, note: 'edited', mood: 'sad', moods: ['sad'] }),
    ]);

    const result = await runSync();

    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(backend.rows).toHaveLength(1);
    expect(backend.rows[0]).toMatchObject({
      id: existing.id,
      created_at: LOG_TIME,
      note: 'edited',
      mood_type: 'sad',
    });
    expect(backend.operations.map((operation) => operation.op)).toEqual(['update']);
  });

  it('[A: edit after failed first sync] the edit collides with the orphaned row and adopts it', async () => {
    // Vector 3: the first sync wrote a row but never bound its id, so the local
    // record still has supabaseId undefined. The edit must not insert again —
    // which only works because updateMood leaves `timestamp` alone.
    const orphaned = backend.seed({ user_id: USER_ID, created_at: LOG_TIME, note: 'original' });
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([
      pendingMood({ supabaseId: undefined, note: 'edited' }),
    ]);

    const result = await runSync();

    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(backend.rows).toHaveLength(1);
    expect(backend.rows[0].id).toBe(orphaned.id);
    expect(backend.rows[0].note).toBe('edited');
    expect(backend.rows[0].created_at).toBe(LOG_TIME);
    expect(mockedMoodService.markAsSynced).toHaveBeenCalledWith(
      1,
      orphaned.id,
      moodSyncFingerprint(pendingMood({ note: 'edited' }))
    );
  });

  it('[deferred] counts a mid-flight edit as deferred, not synced', async () => {
    // The counter this produces is what moodSlice keys its second pass on.
    // Without a test, dropping the branch so a deferral falls through to
    // result.synced++ leaves every other test green while the edit is stranded.
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);
    mockedMoodService.markAsSynced.mockResolvedValue('deferred');

    const result = await runSync();

    expect(result).toMatchObject({ synced: 0, failed: 0, deferred: 1 });
  });

  it('[missing] a record deleted mid-sync is neither synced nor failed', async () => {
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);
    mockedMoodService.markAsSynced.mockResolvedValue('missing');

    const result = await runSync();

    // Counting it as synced would report an upload for a record that no longer
    // exists locally; counting it as failed would retry forever.
    expect(result).toMatchObject({ synced: 0, failed: 0, deferred: 0 });
  });

  it('[A: offline] attempts no write, keeps the record pending and does not throw', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    mockedMoodService.getUnsyncedMoods.mockResolvedValue([pendingMood()]);

    const result = await runSync();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toContain('Device is offline - cannot sync moods');
    expect(backend.rows).toHaveLength(0);
    expect(backend.operations).toHaveLength(0);
    expect(mockedMoodService.markAsSynced).not.toHaveBeenCalled();
  });
});
