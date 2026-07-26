/**
 * Cross-context mutual exclusion for sync batches.
 *
 * The mood sync guard has always been `syncStatus.isSyncing` in the Zustand
 * store. `partialize` does not persist it, so it is in-memory and per-context:
 * a second tab has its own copy and the service worker cannot see it at all.
 * Two writers therefore sync the same record concurrently, the last write wins
 * on the server, and each writer independently concludes its own write is the
 * current one and clears the dirty flag — losing the other's edit silently.
 *
 * The Web Locks API is the only primitive available in BOTH a page and a
 * service worker that is same-origin, cross-tab, and released automatically
 * when its holder dies. `isSyncing` stays as-is for UI state; this is layered
 * alongside it for correctness.
 *
 * @module services/syncLock
 */

/**
 * Web Locks are scoped per origin, so this prefix only separates this app's
 * locks from anything else running on the same origin — it does NOT separate
 * users. Two accounts on one browser profile share this lock, which is the
 * behaviour we want: they also share the one IndexedDB the batch writes to.
 */
export const MOOD_SYNC_LOCK = 'my-love:mood-sync';

/**
 * Outcome of a guarded section.
 *
 * `ran: false` means another context held the lock and the caller did nothing —
 * distinct from running and producing no result, which callers must not
 * conflate when reporting sync counts.
 */
export type SyncLockOutcome<T> = { ran: true; result: T } | { ran: false };

/**
 * Run `fn` only if no other context is already holding `name`.
 *
 * Deliberately non-blocking (`ifAvailable`). Queueing instead would park an
 * edit's immediate sync behind an in-flight retry chain, which backs off
 * 1s/2s/4s — a visible UI stall on a path the user expects to be instant.
 * Skipping is safe: the deferred record stays dirty and the next sync trigger
 * picks it up.
 *
 * Falls back to running unguarded where `navigator.locks` is unavailable, so an
 * older browser degrades to the previous behaviour rather than losing sync.
 */
export async function withSyncLock<T>(
  name: string,
  fn: () => Promise<T>
): Promise<SyncLockOutcome<T>> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;

  if (!locks) {
    return { ran: true, result: await fn() };
  }

  return locks.request(name, { ifAvailable: true }, async (lock) => {
    // A null lock means it was already held; do not touch any flags.
    if (!lock) {
      return { ran: false };
    }
    return { ran: true, result: await fn() };
  });
}
