/**
 * Shared fixtures for the dbSchema unit tests (`dbSchema.*.test.ts`): the
 * database reset, the legacy row shapes the upgrade seeds write, and a hang
 * guard for opens that must settle.
 *
 * @see src/services/dbSchema.ts
 */
import { DB_NAME } from '../../../src/services/dbSchema';

/**
 * Delete the database and wait for it — deleteDatabase is a request, not a call.
 * A blocked delete means a connection leaked from an earlier case; failing here
 * names it, where resolving would only move the hang to the next open.
 */
export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error(`deleteDatabase(${DB_NAME}) is blocked: a connection leaked from an earlier case`));
  });
}

/** A bundled `messages` row as every pre-v15 version wrote it. */
export function legacyMessage(text: string) {
  return { text, category: 'reason', isCustom: false, createdAt: new Date('2026-01-01T00:00:00.000Z') };
}

/** A `moods` row as the pre-v12 versions wrote it, stamped at the start of its day. */
export function legacyMood(note: string, { date = '2026-09-01', synced = true }: { date?: string; synced?: boolean } = {}) {
  return {
    userId: 'USER-A',
    date,
    mood: 'happy',
    note,
    timestamp: new Date(`${date}T00:00:00.000Z`),
    synced,
  };
}

/** The service worker's single `sw-auth` token row. */
export function swAuthRow(accessToken: string, userId = 'USER-A') {
  return { id: 'current', accessToken, refreshToken: 'r', expiresAt: 1, userId };
}

/**
 * Fail loudly on a hang instead of waiting out the runner's own timeout,
 * which reports only "test timed out" and names no operation.
 */
export async function withinTimeout<T>(work: Promise<T>, label: string, ms = 2000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} never settled (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([work, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
