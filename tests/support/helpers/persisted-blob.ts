/**
 * Persisted-blob seeding helpers
 *
 * The store persists to one localStorage key, `my-love-storage`
 * (`src/stores/useAppStore.ts:96`). Its storage adapter's `getItem` deletes
 * every key listed in `STALE_PERSISTED_KEYS` (`:74`) out of the parsed blob
 * before Zustand ever sees it (`:136-144`), so a blob still carrying `moods`
 * or `events` cannot rehydrate them into store state.
 *
 * Proving that in a real browser needs the blob on disk BEFORE the app's first
 * script runs. That is what `page.addInitScript` gives and `page.evaluate`
 * does not: by the time an evaluate lands, `useAppStore` has already imported
 * and hydrated, and seeding then would test nothing.
 *
 * ## Why a helper module and not a fixture
 *
 * Pure functions over a `Page`, matching `./scripture-cache.ts`, rather than a
 * `mergeTests` entry. A fixture shell earns its place when it owns a lifecycle;
 * this owns none. The auth fixture builds a fresh `browser.newContext()` per
 * test and closes it afterwards (`tests/support/fixtures/auth.ts`), and the
 * storage state that context loads carries only the Supabase auth token and
 * `lastWelcomeView` (`tests/support/auth/supabase-auth-provider.ts:146-157`) —
 * never `my-love-storage`. So nothing seeded here survives into the next test
 * for a teardown to clean up.
 *
 * `fixture-architecture.md`'s "pure function core, fixture shell, compose once"
 * is satisfied at the core layer; the shell is omitted deliberately rather than
 * overlooked.
 */
import type { Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { formatDateISO } from '../../../src/utils/dateUtils';

/** The single key the whole store persists under (`useAppStore.ts:96`). */
export const STORAGE_KEY = 'my-love-storage';

/**
 * The persist version the adapter expects.
 *
 * `useAppStore.ts:97` reads `version: 0, // State schema version (matches test
 * fixtures)`. A seeded blob has to carry the same number or Zustand runs its
 * migration path instead of the plain merge, and the strip under test would
 * never be the thing that decided the outcome.
 */
export const PERSIST_VERSION = 0;

/**
 * A settings object shaped to pass `SettingsSchema`.
 *
 * It has to pass: the adapter drops `settings` outright when the schema
 * rejects it (`useAppStore.ts:147-158`), which would make "the surrounding
 * keys survived the strip" unprovable — the key would be gone for an unrelated
 * reason. `themeName: 'ocean'` is deliberately NOT the app default (`'sunset'`,
 * `src/utils/themes.ts:67`), so a test can tell "the seeded settings were
 * applied" from "defaults were applied".
 */
export const SEEDED_SETTINGS = {
  themeName: 'ocean',
  notificationTime: '09:00',
  relationship: {
    startDate: '2020-01-01',
    partnerName: 'A',
    anniversaries: [],
  },
  customization: { accentColor: '#ff8888', fontFamily: 'serif' },
  notifications: { enabled: true, time: '09:00' },
} as const;

/** `--color-primary` for `SEEDED_SETTINGS.themeName` (`src/utils/themes.ts:22`). */
export const SEEDED_THEME_PRIMARY = '#14b8a6';

/** The keys `partialize` allows onto disk (`useAppStore.ts` `partialize`). */
export const PERSISTED_ALLOWLIST = ['isOnboarded', 'messageHistory', 'settings'] as const;

/**
 * `messageHistory` in its serialized form — `shownMessages` as entry pairs.
 *
 * Every field of the slice default is present, not just the two a strip test
 * cares about, because Zustand's merge is SHALLOW: the blob's `messageHistory`
 * replaces the default object outright rather than filling in around it. A
 * partial one therefore hands the app a `messageHistory` with fields missing,
 * and `src/components/DailyMessage/DailyMessage.tsx:59` reads
 * `messageHistory.favoriteIds.includes(currentMessage.id)` — which throws
 * `Cannot read properties of undefined (reading 'includes')` and takes Home
 * into the ErrorBoundary. Measured, not guessed: the first run of this spec
 * failed exactly that way on a seed missing `favoriteIds`.
 *
 * That matters for correctness of the test, not just for it passing. A test
 * whose seed crashes the app for its own reasons cannot tell a working strip
 * from a broken one — both end at the same error screen.
 *
 * Mirrors the defaults at `src/stores/slices/messagesSlice.ts:63-71`, with
 * `currentIndex` and `shownMessages` set to distinctive values so a test can
 * prove the seeded blob (rather than the default) is what survived.
 */
export const SEEDED_MESSAGE_HISTORY = {
  currentIndex: 7,
  shownMessages: [['2026-07-26', 3]] as Array<[string, number]>,
  maxHistoryDays: 30,
  favoriteIds: [] as number[],
  lastShownDate: '',
  lastMessageId: 0,
  viewedIds: [] as number[],
};

/**
 * An event as it comes back off disk.
 *
 * `date` and `createdAt` are STRINGS, which is the whole point: JSON has no
 * `Date`. `src/App.tsx:625` hands these straight to `getUpcomingEventCards`,
 * whose filter calls `getCalendarDaysDiff(event.date, now)` — and that
 * function's first statement is `date.getFullYear()`
 * (`src/components/RelationshipTimers/EventCountdown.tsx`). A rehydrated event
 * therefore throws a `TypeError` inside Home's render, on top of disclosing
 * the previous couple's dates. Both harms come from this one shape.
 */
export interface PersistedEventSeed {
  id: string;
  userId: string;
  label: string;
  date: string;
  createdAt: string;
  description: string;
  icon: 'ring' | 'plane' | 'calendar';
}

/**
 * A mood as it comes back off disk, dated today.
 *
 * Today matters: `MoodTracker`'s seeding block reads
 * `getMoodForDate(formatDateISO(new Date()))` and, on a hit, calls
 * `setNote(existingMood.note || '')`
 * (`src/components/MoodTracker/MoodTracker.tsx:165-181`). A mood dated any
 * other day never reaches that branch, so a test seeded with one would pass
 * whether or not the strip worked.
 */
export interface PersistedMoodSeed {
  id: number;
  userId: string;
  mood: string;
  moods: string[];
  note: string;
  date: string;
  timestamp: string;
  synced: boolean;
}

/**
 * A stale event, with a label and description no real row could produce.
 *
 * Unique per call rather than a fixed literal: every assertion built on these
 * is an ABSENCE assertion, and an absence assertion against a string that
 * could also come from a real row is one collision away from passing for the
 * wrong reason.
 */
export function stalePersistedEvent(
  overrides: Partial<PersistedEventSeed> = {}
): PersistedEventSeed {
  const nonce = faker.string.alphanumeric(8).toUpperCase();
  const future = new Date();
  future.setDate(future.getDate() + 21);

  return {
    id: `stale-event-${nonce}`,
    userId: `stale-user-${nonce}`,
    label: `STALE-EVENT-LABEL-${nonce}`,
    date: future.toISOString(),
    createdAt: new Date(2026, 0, 1).toISOString(),
    description: `STALE-EVENT-DESCRIPTION-${nonce}`,
    icon: 'plane',
    ...overrides,
  };
}

/** A stale mood dated today, with a note no real row could produce. */
export function stalePersistedMood(overrides: Partial<PersistedMoodSeed> = {}): PersistedMoodSeed {
  const nonce = faker.string.alphanumeric(8).toUpperCase();

  return {
    id: 1,
    userId: `stale-user-${nonce}`,
    mood: 'sad',
    moods: ['sad'],
    note: `STALE-MOOD-NOTE-${nonce}`,
    date: formatDateISO(new Date()),
    timestamp: new Date().toISOString(),
    synced: true,
    ...overrides,
  };
}

/**
 * The blob a real installed build would have written, plus whatever a case adds.
 *
 * The three allowlisted keys are always present so a test that asserts they
 * survived the strip has something to assert on, and so the blob is a
 * realistic one rather than a bare carrier for the stale key.
 */
export function makePersistedBlob(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: PERSIST_VERSION,
    state: {
      isOnboarded: true,
      settings: SEEDED_SETTINGS,
      messageHistory: SEEDED_MESSAGE_HISTORY,
      ...extra,
    },
  });
}

/**
 * Put the blob on disk before the app boots, for every navigation in the test.
 *
 * `addInitScript` and not `evaluate` — see the module docblock. `lastWelcomeView`
 * rides along because the welcome splash otherwise covers Home; the auth
 * provider already writes it into storage state
 * (`tests/support/auth/supabase-auth-provider.ts:154`), and setting it here too
 * keeps the seeding self-contained for a spec that runs without that provider.
 *
 * Note this re-runs on EVERY navigation in the test, re-seeding the stale key
 * each time. A test asserting the blob has been cleaned ON DISK must therefore
 * make exactly one navigation, or the assertion measures the re-seed.
 */
export async function seedPersistedBlob(
  page: Page,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const raw = makePersistedBlob(extra);

  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    },
    [STORAGE_KEY, raw] as [string, string]
  );
}

/** What the persisted blob looks like right now, or `null` if the key is gone. */
export interface StoredBlob {
  version: number | undefined;
  stateKeys: string[];
  isOnboarded: unknown;
  messageHistoryCurrentIndex: unknown;
}

/**
 * Read the stored blob back.
 *
 * Returns `null` for an absent key rather than throwing, so a caller can tell
 * "cleared as corrupt" from "rewritten without the stale keys" — the two
 * outcomes this change has to keep apart.
 */
export async function readStoredBlob(page: Page): Promise<StoredBlob | null> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      version?: number;
      state?: Record<string, unknown>;
    };
    const state = parsed.state ?? {};
    const messageHistory = state.messageHistory as { currentIndex?: unknown } | undefined;

    return {
      version: parsed.version,
      stateKeys: Object.keys(state),
      isOnboarded: state.isOnboarded,
      messageHistoryCurrentIndex: messageHistory?.currentIndex,
    };
  }, STORAGE_KEY);
}

/** The `data-testid` `EventCountdown` derives from a label (`EventCountdown.tsx:237`). */
export function eventCardTestId(label: string): string {
  return `event-countdown-${label.toLowerCase().replace(/\s+/g, '-')}`;
}
