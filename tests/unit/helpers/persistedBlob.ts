/**
 * Persisted-blob builders for the Vitest store suites.
 *
 * Built on the e2e seeding helper (`tests/support/helpers/persisted-blob.ts`),
 * so both layers write the same envelope: the persist version,
 * `isOnboarded: true`, then `settings` and `messageHistory`, under `STORAGE_KEY`.
 *
 * `persistedBlob()` swaps in a settings object and a message history the
 * storage adapter has nothing to strip from. `SEEDED_SETTINGS` carries the
 * retired couple and notification keys and `SEEDED_MESSAGE_HISTORY` carries
 * `favoriteIds`, and each makes the adapter re-serialize the blob — which
 * `persistedBlobContract.test.ts`'s "no stale key, zero serializations" case
 * must not see. Those two e2e defaults stay as they are; e2e depends on them.
 */
import {
  makePersistedBlob,
  SEEDED_SETTINGS,
  STORAGE_KEY,
} from '../../support/helpers/persisted-blob';

export { SEEDED_SETTINGS, STORAGE_KEY };

/** Settings as the current build writes them, shaped to pass `SettingsSchema`. */
export const PERSISTED_SETTINGS = {
  relationship: { anniversaries: [] },
};

/**
 * The two `messageHistory` fields a strip test reads back. `currentIndex: 7` is
 * the sentinel that proves the seeded blob, not the slice default, survived.
 */
export const PERSISTED_MESSAGE_HISTORY = {
  shownMessages: [['2026-07-26', 3]] as Array<[string, number]>,
  currentIndex: 7,
};

/** An event as it comes back off disk: JSON has no Date, so both stamps are strings. */
export const PERSISTED_EVENT = {
  id: 'event-1',
  userId: 'user-A',
  label: 'PRIVATE-EVENT-LABEL',
  date: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: 'PRIVATE-EVENT-DESCRIPTION',
  icon: 'plane',
};

/** A mood as it comes back off disk. */
export const PERSISTED_MOOD = {
  id: 1,
  userId: 'user-A',
  mood: 'sad',
  moods: ['sad'],
  note: 'a private note',
  date: '2026-07-26',
  timestamp: '2026-07-26T06:00:00.000Z',
  synced: true,
};

/** A blob with nothing for the adapter to strip, plus whatever a case adds or replaces. */
export function persistedBlob(extra: Record<string, unknown> = {}): string {
  return makePersistedBlob({
    settings: PERSISTED_SETTINGS,
    messageHistory: PERSISTED_MESSAGE_HISTORY,
    ...extra,
  });
}
