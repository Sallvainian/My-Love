/**
 * Shared store builder and fixtures for the `moodSlice*.test.ts` files. Each
 * test file keeps its own `vi.mock`s and hooks; this module only builds on the
 * modules those mocks replace.
 */
import type { MoodEntry } from '@/types';
import type { moodSyncService } from '@/api/moodSyncService';

// Import Zustand store factory
import { createMoodSlice, type MoodSlice } from '@/stores/slices/moodSlice';

/** Create a standalone store-like object from the slice */
export function createTestStore(extraState: Record<string, unknown> = {}) {
  const stateRef = { current: null as (MoodSlice & Record<string, unknown>) | null };

  const get = () => stateRef.current!;
  const set = (
    updater:
      | Partial<MoodSlice & Record<string, unknown>>
      | ((s: MoodSlice & Record<string, unknown>) => Partial<MoodSlice & Record<string, unknown>>)
  ) => {
    const update = typeof updater === 'function' ? updater(stateRef.current!) : updater;
    stateRef.current = { ...stateRef.current!, ...update };
  };
  const api = {} as never;

  const state = createMoodSlice(set as never, get as never, api);
  stateRef.current = { ...state, ...extraState };
  return { get, set };
}

// Pinned by each moodSlice test file's beforeEach (noon EDT): the slice keys
// new moods by today's local date, so a fixture dated TODAY is the slice's
// today whenever this runs. Only `Date` is faked; `vi.waitFor` keeps its real timers.
export const NOW = new Date('2026-09-15T16:00:00.000Z');
export const TODAY = '2026-09-15';

export function makeMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: 'user-123',
    mood: 'happy',
    moods: ['happy'],
    note: '',
    date: TODAY,
    timestamp: NOW,
    synced: false,
    ...overrides,
  };
}

export type SyncBatch = Awaited<ReturnType<typeof moodSyncService.syncPendingMoods>>;

/** A `moodSyncService.syncPendingMoods` batch result; every count defaults to 0. */
export function syncResult(counts: Partial<SyncBatch> = {}): SyncBatch {
  return { synced: 0, failed: 0, deferred: 0, errors: [], ...counts };
}
