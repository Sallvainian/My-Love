/**
 * One queue for every write to, and every refresh of, the account-data mirrors
 * (anniversaries, custom messages, favorites).
 *
 * A mirror refresh is "read the server, then replace the local copy". A write
 * is "write the server, then patch the local copy". Interleaved, a write that
 * lands between a refresh's read and its replace is erased from the mirror —
 * the server has it, the screen does not — until the next launch. The refresh
 * runs right after sign-in, which is exactly when a user taps the heart on
 * today's message, so the window is not theoretical.
 *
 * Tasks run strictly one at a time in call order: a task holds the queue until
 * it settles, and nothing ever starts beside it. A hung request cannot hold it
 * forever because every Supabase request a queued task makes is bounded
 * (`requestTimeout()` in `accountDataError.ts`, creates included — they are
 * retry-safe); releasing the queue on a timer instead would let the
 * stalled task finish later, beside its successor, and erase that write.
 *
 * A task must not call another queued function, or it waits on itself
 * forever; queued entry points are the leaf writes (the `messagesSlice`
 * favorite toggle and custom-message create / update / delete, the anniversary
 * actions) and the two refreshes.
 *
 * @module services/accountDataQueue
 */

let tail: Promise<unknown> = Promise.resolve();

export function serializeAccountDataWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => {});
  return run;
}
