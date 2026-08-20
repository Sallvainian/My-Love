/**
 * The persisted-blob adapter's contract, as distinct from what it strips
 *
 * `persistedEvents.test.ts` and `persistedMoods.test.ts` pin the OUTCOME of the
 * `STALE_PERSISTED_KEYS` walk (`src/stores/useAppStore.ts:74`, walked at
 * `:136-144`): which keys reach store state and which do not. This file pins
 * the three constraints the spec puts around that walk which no test asserts,
 * each of which can be violated while every existing test stays green.
 *
 * From `_bmad-output/implementation-artifacts/spec-dw-14-20-persisted-events-key-strip.md`:
 *
 * - Boundaries, Always: "When no stale key is present, `getItem` must still
 *   return the original `str` untouched."
 * - Boundaries, Never: "Do not add a second read pass, a second `JSON.parse`,
 *   or a second `JSON.stringify`."
 * - Residual risks: "`STALE_PERSISTED_KEYS` is a hand-maintained list with no
 *   compile-time link to `partialize`. Adding a key to it that `partialize`
 *   does persist would silently stop that key from rehydrating. The
 *   declaration comment warns, but nothing enforces it."
 * - Acceptance Criteria: "when the persisted blob is inspected, then `version`
 *   is still `0` and `partialize` is unmodified."
 *
 * Everything here reads the store's LIVE persist options
 * (`useAppStore.persist.getOptions()`) rather than importing the module-private
 * `STALE_PERSISTED_KEYS`. That is deliberate: a test that re-declared the list
 * would agree with itself forever. Deriving from `partialize` means the
 * invariant keeps holding as the allowlist grows.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'my-love-storage';

/** Shaped to pass `SettingsSchema` — the adapter drops `settings` when it does not. */
const PERSISTED_SETTINGS = {
  themeName: 'ocean',
  notificationTime: '09:00',
  relationship: { startDate: '2020-01-01', partnerName: 'A', anniversaries: [] },
  customization: { accentColor: '#ff8888', fontFamily: 'serif' },
  notifications: { enabled: true, time: '09:00' },
};

/**
 * `currentIndex: 7` is the sentinel the serialization counters match on.
 *
 * It has to be something no other blob in the process carries, because the
 * counters below filter every `JSON.stringify` call in the run down to the ones
 * that touched THIS blob.
 */
const SENTINEL_INDEX = 7;

function persistedBlob(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 0,
    state: {
      isOnboarded: true,
      settings: PERSISTED_SETTINGS,
      messageHistory: { shownMessages: [['2026-07-26', 3]], currentIndex: SENTINEL_INDEX },
      ...extra,
    },
  });
}

const PERSISTED_EVENT = {
  id: 'event-1',
  userId: 'user-A',
  label: 'PRIVATE-EVENT-LABEL',
  date: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: 'PRIVATE-EVENT-DESCRIPTION',
  icon: 'plane',
};

/** True for the parsed blob this file seeded, and for nothing else in the run. */
function isSeededBlob(value: unknown): boolean {
  const candidate = value as { state?: { messageHistory?: { currentIndex?: number } } } | undefined;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    candidate.state?.messageHistory?.currentIndex === SENTINEL_INDEX
  );
}

/**
 * Import the store with `raw` on disk, counting the re-serializations of it.
 *
 * The spy goes in before `resetModules`, because the adapter's `getItem` runs
 * synchronously while the module is evaluating — install it after and there is
 * nothing left to observe.
 */
async function importCountingSerializations(raw: string): Promise<number> {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, raw);

  const stringifySpy = vi.spyOn(JSON, 'stringify');

  vi.resetModules();
  await import('@/stores/useAppStore');

  const count = stringifySpy.mock.calls.filter(([value]) => isSeededBlob(value)).length;
  stringifySpy.mockRestore();
  return count;
}

/** The store's live persist options, read off the module rather than restated. */
async function persistOptions(): Promise<{
  version: number | undefined;
  name: string | undefined;
  partialize: ((state: unknown) => Record<string, unknown>) | undefined;
}> {
  localStorage.clear();
  vi.resetModules();
  const { useAppStore } = await import('@/stores/useAppStore');

  const withPersist = useAppStore as unknown as {
    persist: {
      getOptions: () => {
        version?: number;
        name?: string;
        partialize?: (state: unknown) => Record<string, unknown>;
      };
    };
  };
  const options = withPersist.persist.getOptions();

  return { version: options.version, name: options.name, partialize: options.partialize };
}

describe('persisted-blob adapter contract', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exactly one serialization, and only when something changed', () => {
    it('does not re-serialize a blob that carries no stale key', async () => {
      // The blob every installed build actually has. `getItem` ends
      // `return mutated ? JSON.stringify(data) : str`, so nothing here should
      // stringify it. Replacing that with an unconditional
      // `return JSON.stringify(data)` turns this red and turns NOTHING else in
      // the suite red — which is why the case exists.
      const serializations = await importCountingSerializations(persistedBlob());

      expect(serializations).toBe(0);
    });

    it('re-serializes a blob it stripped exactly once', async () => {
      // The other direction, so the case above cannot be satisfied by an
      // adapter that never serializes at all. A second `JSON.stringify` — a
      // separate pass for `events` on top of the one for `settings`, say —
      // shows up here as 2.
      const serializations = await importCountingSerializations(
        persistedBlob({ events: [PERSISTED_EVENT] })
      );

      expect(serializations).toBe(1);
    });
  });

  describe('the strip list and the write allowlist stay disjoint', () => {
    it('never persists a key the read side strips back out', async () => {
      // The residual risk the spec names: the two lists are hand-maintained and
      // nothing links them. A key in both would be written on every save and
      // deleted on every load, so it would silently stop round-tripping while
      // every existing test stayed green.
      //
      // Derived from the live `partialize` rather than from a restated
      // allowlist, so this keeps holding as that function grows.
      const { partialize } = await persistOptions();
      expect(partialize).toBeTypeOf('function');

      vi.resetModules();
      const { useAppStore } = await import('@/stores/useAppStore');

      // Non-empty on purpose: a `partialize` that emitted `moods` only when it
      // had entries would slip past a probe run against the empty defaults.
      useAppStore.setState({
        moods: [
          {
            id: 1,
            userId: 'user-A',
            mood: 'happy',
            moods: ['happy'],
            date: '2026-07-26',
            timestamp: '2026-07-26T06:00:00.000Z',
            synced: true,
          },
        ],
        events: [
          {
            id: 'event-1',
            userId: 'user-A',
            label: 'Anniversary',
            date: new Date('2026-09-12T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            description: null,
            icon: 'plane',
          },
        ],
      } as never);

      const written = Object.keys(partialize!(useAppStore.getState()));

      expect(written).not.toContain('moods');
      expect(written).not.toContain('events');
    });

    it('still writes every key the allowlist is there to write', async () => {
      // The counterweight: the assertion above is satisfied by a `partialize`
      // that returns `{}`. This one fails if the allowlist is emptied.
      const { partialize } = await persistOptions();

      vi.resetModules();
      const { useAppStore } = await import('@/stores/useAppStore');
      const written = Object.keys(partialize!(useAppStore.getState()));

      expect(written).toEqual(
        expect.arrayContaining(['settings', 'isOnboarded', 'messageHistory'])
      );
    });
  });

  describe('the persist identity the fixtures depend on', () => {
    it('keeps the storage key and version the strip was chosen to preserve', async () => {
      // The spec's Boundaries pick the strip over a version bump specifically to
      // keep `version: 0` (`useAppStore.ts:97`). Bumping it discards every blob
      // on every installed device, which is the outcome the whole read-side
      // strip exists to avoid — and until now nothing in the suite said so.
      const { version, name } = await persistOptions();

      expect(version).toBe(0);
      expect(name).toBe(STORAGE_KEY);
    });
  });
});
