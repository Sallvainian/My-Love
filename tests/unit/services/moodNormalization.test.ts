import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, type MyLoveDBSchema } from '../../../src/services/dbSchema';
import { moodService } from '../../../src/services/moodService';
import { moodSyncFingerprint, moodSyncPayload } from '../../../src/services/moodSyncPayload';
import { createMoodSlice, type MoodSlice } from '../../../src/stores/slices/moodSlice';
import { getPendingMoods, markMoodSynced } from '../../../src/sw-db';
import type { MoodEntry } from '../../../src/types';
import { MOOD_TYPES, normalizeMoodEntry, normalizeMoodValues } from '../../../src/types/moods';
import { formatDateISO } from '../../../src/utils/dateUtils';
import { isValidationError } from '../../../src/validation/errorMessages';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const date = '2026-09-15';
const timestamp = new Date('2026-09-15T12:00:00.000Z');

function raw(mood: unknown, moods: unknown, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { userId: A, date, timestamp, synced: false, note: 'retained note', mood, moods, ...overrides } as MoodEntry;
}

async function seedRaw(entry: MoodEntry): Promise<MoodEntry> {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
  try {
    const id = await db.add('moods', entry);
    return { ...entry, id };
  } finally {
    db.close();
  }
}

beforeEach(async () => {
  await moodService.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});

afterEach(() => { vi.restoreAllMocks(); });

describe('canonical mood normalization', () => {
  it.each(MOOD_TYPES)('accepts the legacy scalar %s', (mood) => {
    expect(normalizeMoodValues(mood, undefined)).toEqual({ mood, moods: [mood] });
  });

  it.each([undefined, null, '', 'happy', 7, { 0: 'happy', length: 1 }, [], [null, 'bad', 7]])('falls back to a recognized scalar for malformed/empty arrays: %j', (moods) => {
    expect(normalizeMoodValues('sad', moods)).toEqual({ mood: 'sad', moods: ['sad'] });
  });

  it('filters individual invalid elements while retaining order, duplicates and a distinct valid primary', () => {
    expect(normalizeMoodValues('loved', ['sad', null, 'HAPPY', 'happy', 'sad', {}])).toEqual({ mood: 'loved', moods: ['sad', 'happy', 'sad'] });
    expect(normalizeMoodValues('unknown', ['tired', false, 'happy'])).toEqual({ mood: 'tired', moods: ['tired', 'happy'] });
  });

  it.each([null, undefined, '', 'Happy', 'unknown', 9, {}, ['happy']])('never invents a mood from an invalid scalar %j', (mood) => {
    expect(normalizeMoodValues(mood, [null, 'unknown'])).toBeNull();
  });

  it('returns independent display copies and equivalent fingerprints without changing raw data', () => {
    const source = raw('unknown', ['sad', null, 'sad']);
    const before = structuredClone(source);
    const display = normalizeMoodEntry(source)!;
    expect(display).not.toBe(source);
    expect(display.moods).not.toBe(source.moods);
    expect(moodSyncPayload(source, A)).toMatchObject({ mood_type: 'sad', mood_types: ['sad', 'sad'] });
    expect(moodSyncFingerprint(source)).toBe(moodSyncFingerprint(display));
    display.moods.push('happy');
    expect(source).toEqual(before);
  });

  it('rejects invalid mood content, notes and timestamps before upload', () => {
    for (const row of [raw('bad', [null]), raw('happy', [], { note: 5 as unknown as string }), raw('happy', [], { timestamp: new Date('bad') })]) {
      expect(() => moodSyncPayload(row, A)).toThrow();
      expect(() => moodSyncFingerprint(row)).toThrow();
    }
  });
});

describe('saved mood recovery', () => {
  it('normalizes scoped display reads while keeping raw invalid rows in both pending queues', async () => {
    const mixed = await seedRaw(raw('bad', ['sad', null, 'happy']));
    const hidden = await seedRaw(raw('bad', 'happy', { date: '2026-09-14' }));
    const other = await seedRaw(raw('loved', ['loved'], { userId: B }));
    expect((await moodService.getAllForUser(A)).map((row) => row.id)).toEqual([mixed.id]);
    expect(await moodService.getMoodForDate(new Date(2026, 8, 15), A)).toMatchObject({ mood: 'sad', moods: ['sad', 'happy'] });
    expect(await moodService.getMoodForDate(new Date(2026, 8, 14), A)).toBeNull();
    expect(await moodService.getMoodsInRange(new Date(2026, 8, 1), new Date(2026, 8, 30), A)).toHaveLength(1);
    expect((await moodService.getAllForUser(B)).map((row) => row.id)).toEqual([other.id]);
    expect(await moodService.get(mixed.id!)).toEqual(mixed);
    expect(await moodService.get(hidden.id!)).toEqual(hidden);
    expect((await moodService.getUnsyncedMoods(A)).map((row) => row.id)).toEqual([mixed.id, hidden.id]);
    expect((await getPendingMoods(A)).map((row) => row.id)).toEqual([mixed.id, hidden.id]);
  });

  it.each([undefined, '', '   '])('repairs hidden owner/date row while preserving its identity and note (%j)', async (replacement) => {
    const hidden = await seedRaw(raw('bad', [null], { supabaseId: 'existing-server-row' }));
    const other = await seedRaw(raw('sad', ['sad'], { userId: B }));
    const saved = await moodService.saveForDate(A, date, ['happy', 'happy'], replacement);
    expect(saved).toEqual({ ...hidden, mood: 'happy', moods: ['happy', 'happy'], synced: false });
    expect(await moodService.get(other.id!)).toEqual(other);
    expect(await moodService.getAllForUser(A)).toEqual([saved]);
    expect(await moodService.getAll()).toHaveLength(2);
    expect(await moodService.getUnsyncedMoods(A)).toEqual([saved]);
  });

  it('uses nonempty replacement notes for hidden rows and clears notes on normal visible edits', async () => {
    await seedRaw(raw('bad', []));
    const repaired = await moodService.saveForDate(A, date, ['happy'], 'replacement');
    expect(repaired.note).toBe('replacement');
    const edited = await moodService.saveForDate(A, date, ['sad'], undefined, true);
    expect(edited.note).toBe('');
    expect(edited.timestamp).toEqual(timestamp);
  });

  it('serializes concurrent saves on one owner/date and preserves UI validation errors', async () => {
    const saved = await Promise.all([
      moodService.saveForDate(A, date, ['happy']),
      moodService.saveForDate(A, date, ['sad']),
    ]);
    expect(saved[0].id).toBe(saved[1].id);
    expect(await moodService.getAll()).toHaveLength(1);
    expect(await moodService.getAllForUser(A)).toMatchObject([{ mood: 'sad' }]);
    await expect(moodService.saveForDate(A, date, [], undefined)).rejects.toSatisfy(isValidationError);
    await expect(moodService.saveForDate('', date, ['happy'])).rejects.toThrow();
    await expect(moodService.saveForDate(B, date, ['happy'], '', true)).rejects.toThrow('not found');
  });

  it.each(['foreground', 'worker'] as const)('%s records the server ID but leaves a newly corrupted row dirty', async (writer) => {
    const saved = await seedRaw(raw('happy', ['happy']));
    const sent = moodSyncFingerprint(saved);
    await moodService.update(saved.id!, { mood: 'unknown', moods: [null] } as unknown as Partial<MoodEntry>);
    const outcome = writer === 'foreground'
      ? await moodService.markAsSynced(saved.id!, 'server-row', sent)
      : await markMoodSynced(saved.id!, 'server-row', sent);
    expect(outcome).toBe('deferred');
    expect(await moodService.get(saved.id!)).toMatchObject({ supabaseId: 'server-row', synced: false, mood: 'unknown', moods: [null] });
    expect(await moodService.getAllForUser(A)).toEqual([]);
    expect(await getPendingMoods(A)).toHaveLength(1);
  });
});

type TestStore = MoodSlice & { userId: string | null; authSessionVersion: number };
function storeForA() {
  return create<TestStore>()((set, get, api) => ({
    userId: A, authSessionVersion: 1,
    ...createMoodSlice(set as never, get as never, api as never),
  }));
}

describe('mood store repair and session guards', () => {
  it('replaces a hidden same-day row and publishes it to the store', async () => {
    const hidden = await seedRaw(raw('bad', [], { date: formatDateISO(new Date()) }));
    const store = storeForA();
    await store.getState().loadMoods();
    expect(store.getState().moods).toEqual([]);
    expect(store.getState().syncStatus.pendingMoods).toBe(1);
    await store.getState().addMoodEntry(['happy']);
    expect(store.getState().moods).toMatchObject([{ id: hidden.id, note: 'retained note', mood: 'happy' }]);
    expect(await moodService.getAll()).toHaveLength(1);
  });

  it.each(['add-switch', 'add-relogin', 'update-switch', 'update-relogin'])('keeps a stale %s write on its captured owner’s disk only', async (scenario) => {
    const today = formatDateISO(new Date());
    const hidden = await seedRaw(raw('bad', [], { date: today }));
    const store = storeForA();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const realSave = moodService.saveForDate.bind(moodService);
    vi.spyOn(moodService, 'saveForDate').mockImplementation(async (...args) => {
      await gate;
      return realSave(...args);
    });
    const run = scenario.startsWith('add')
      ? store.getState().addMoodEntry(['happy'])
      : store.getState().updateMoodEntry(today, ['happy']);
    const incoming = raw('tired', ['tired'], { id: 777, userId: scenario.endsWith('switch') ? B : A });
    store.setState({ userId: incoming.userId, authSessionVersion: 2, moods: [incoming] });
    release();
    await run;
    expect(store.getState().moods).toEqual([incoming]);
    expect(store.getState().syncStatus.pendingMoods).toBe(0);
    expect(await moodService.get(hidden.id!)).toMatchObject({ userId: A, mood: 'happy' });
  });
});
