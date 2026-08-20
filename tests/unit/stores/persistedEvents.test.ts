/**
 * Persisted state — events must never reach localStorage, nor come back out of it
 *
 * Events are couple-shared and Supabase-only. `partialize` in `useAppStore.ts`
 * is an allowlist of `settings`, `isOnboarded` and `messageHistory`, so the
 * events keys are excluded by omission — which is exactly the kind of guarantee
 * that erodes silently. Nothing errors if a later story adds `events` to that
 * list; the couple's dates simply start surviving on the device, and on a shared
 * browser the next account rehydrates them before any fetch can correct it. That
 * is the failure `moods` already had, recorded at `useAppStore.ts:185-189` and
 * pinned by `persistedMoods.test.ts`.
 *
 * `partialize` governs writes only. The read half is a separate guarantee, so it
 * gets separate cases: the storage adapter deletes `events` from the blob on the
 * way in, alongside `moods`, in the `STALE_PERSISTED_KEYS` walk — the list at
 * `useAppStore.ts:74`, the loop at `:136-144`. That is what defends a blob that
 * carries the key — hand-edited, downgraded from a future build, or written by
 * whatever change first widens `partialize` — without bumping the persist
 * version the E2E auth fixtures pin.
 *
 * `clearAuth()` resetting the in-memory keys is the third part of the same
 * guarantee and is covered by `signOutClearsAccountState.test.ts`. This file
 * covers the disk, in both directions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'my-love-storage';

/** One event in memory, shaped the way `eventsService` returns them. */
const IN_MEMORY_EVENT = {
  id: 'event-1',
  userId: 'user-A',
  label: 'PRIVATE-EVENT-LABEL',
  date: new Date(2026, 8, 12),
  createdAt: new Date(2026, 0, 1),
  description: 'PRIVATE-EVENT-DESCRIPTION',
  icon: 'plane' as const,
};

/**
 * The same event as it would come back off disk: JSON has no Date, so both
 * timestamps rehydrate as strings — which is why `EventCountdown` calling
 * `date.getFullYear()` on one of these would throw.
 */
const PERSISTED_EVENT = {
  id: 'event-1',
  userId: 'user-A',
  label: 'PRIVATE-EVENT-LABEL',
  date: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: 'PRIVATE-EVENT-DESCRIPTION',
  icon: 'plane',
};

/** A mood as it would come back off disk, for the both-keys-at-once case. */
const PERSISTED_MOOD = {
  id: 1,
  userId: 'user-A',
  mood: 'sad',
  moods: ['sad'],
  note: 'a private note',
  date: '2026-07-26',
  timestamp: '2026-07-26T06:00:00.000Z',
  synced: true,
};

/**
 * Settings shaped to pass `SettingsSchema` — the adapter drops the key outright
 * when it does not, which would hide whether the strip preserved it.
 */
const PERSISTED_SETTINGS = {
  themeName: 'ocean',
  notificationTime: '09:00',
  relationship: {
    startDate: '2020-01-01',
    partnerName: 'A',
    anniversaries: [],
  },
  customization: { accentColor: '#ff8888', fontFamily: 'serif' },
  notifications: { enabled: true, time: '09:00' },
};

/** A persisted blob shaped like the real one, plus whatever a case seeds into it. */
function persistedBlob(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 0,
    state: {
      isOnboarded: true,
      settings: PERSISTED_SETTINGS,
      messageHistory: { shownMessages: [['2026-07-26', 3]], currentIndex: 7 },
      ...extra,
    },
  });
}

/**
 * Seed the key and import the store fresh so its adapter runs on the way in.
 *
 * Assertions go against store state, not the raw key: the adapter mutates only
 * the copy it hands Zustand and never rewrites localStorage, so the seeded blob
 * is still on disk with its stale keys intact afterwards.
 */
async function hydrateFrom(raw: string) {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, raw);

  vi.resetModules();
  const { useAppStore } = await import('@/stores/useAppStore');
  return useAppStore;
}

describe('persisted events', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('does not write events into localStorage, and leaves the persist version alone', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');

    // Hydration alone does not rewrite the key, so drive a persist the way the
    // app would: put events in memory (loadEvents does this) and change a key
    // that IS persisted.
    useAppStore.setState({
      events: [IN_MEMORY_EVENT],
      eventsIsLoading: true,
      eventsError: 'a failure worth not persisting',
      isOnboarded: true,
    });

    const raw = localStorage.getItem(STORAGE_KEY) as string;
    const parsed = JSON.parse(raw);

    expect(parsed.state).not.toHaveProperty('events');
    expect(parsed.state).not.toHaveProperty('eventsIsLoading');
    expect(parsed.state).not.toHaveProperty('eventsError');

    // Not just absent by key — absent by content, so a rename cannot smuggle it.
    expect(raw).not.toContain('PRIVATE-EVENT-LABEL');
    expect(raw).not.toContain('PRIVATE-EVENT-DESCRIPTION');

    // The E2E auth fixtures pin `version: 0`; excluding events must not bump it.
    expect(parsed.version).toBe(0);

    // The write did happen — otherwise the assertions above prove nothing.
    expect(parsed.state.isOnboarded).toBe(true);
  });

  it('does not hydrate stored events into store state', async () => {
    const useAppStore = await hydrateFrom(persistedBlob({ events: [PERSISTED_EVENT] }));

    // The disclosure path: this array is what `EventCountdown` renders, and the
    // previous account's dates would be on screen before `loadEvents` resolves.
    expect(useAppStore.getState().events).toEqual([]);
  });

  it('leaves the surrounding persisted keys intact when it strips events', async () => {
    // Stripping one key must not look like corruption and blow away the rest —
    // the adapter clears the whole blob when validation fails.
    const useAppStore = await hydrateFrom(persistedBlob({ events: [PERSISTED_EVENT] }));
    const state = useAppStore.getState();

    expect(state.isOnboarded).toBe(true);
    expect(state.settings?.themeName).toBe('ocean');
    expect(state.messageHistory.currentIndex).toBe(7);
    expect(state.messageHistory.shownMessages.get('2026-07-26')).toBe(3);
  });

  it('clears both stale keys from one blob', async () => {
    const useAppStore = await hydrateFrom(
      persistedBlob({ moods: [PERSISTED_MOOD], events: [PERSISTED_EVENT] })
    );
    const state = useAppStore.getState();

    expect(state.events).toEqual([]);
    expect(state.moods).toEqual([]);
  });

  it('drops nothing from a blob that carries no stale keys', async () => {
    // The blob everyone actually has on disk: the strip must be a no-op on it.
    const useAppStore = await hydrateFrom(persistedBlob());
    const state = useAppStore.getState();

    expect(state.isOnboarded).toBe(true);
    expect(state.settings).toMatchObject(PERSISTED_SETTINGS);
    expect(state.messageHistory.currentIndex).toBe(7);
    expect(state.messageHistory.shownMessages.get('2026-07-26')).toBe(3);
  });

  // The three shapes the strip must never be reached by. Each one is rejected
  // earlier in `getItem` than the walk, so the guard the walk carries
  // (`if (data.state)`) is a second line rather than the only one — these pin
  // that a malformed blob still lands on defaults instead of throwing out of
  // module import, which would take the whole app down rather than one key.

  it('lands on defaults for a blob with no state object', async () => {
    const useAppStore = await hydrateFrom(JSON.stringify({ version: 0 }));

    expect(useAppStore.getState().events).toEqual([]);
    expect(useAppStore.getState().moods).toEqual([]);
    // Rejected as corrupt before the walk, so the key is cleared outright.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('lands on defaults for an unparseable blob', async () => {
    const useAppStore = await hydrateFrom('{ not json');

    expect(useAppStore.getState().events).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('lands on defaults when no blob is stored at all', async () => {
    localStorage.clear();
    vi.resetModules();
    const { useAppStore } = await import('@/stores/useAppStore');

    expect(useAppStore.getState().events).toEqual([]);
  });
});
