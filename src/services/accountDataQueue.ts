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
 * Tasks run one at a time in call order, each holding the queue until it
 * settles or {@link QUEUE_STALL_MS} passes, whichever is first. A task must not call another queued
 * function, or it waits on itself forever; queued entry points are the leaf
 * writes (`storageService.toggleFavorite`, `customMessageService` create /
 * update / delete, the anniversary actions) and the two refreshes.
 *
 * @module services/accountDataQueue
 */

/**
 * How long one task may hold the queue. A stalled mobile socket can leave a
 * Supabase request pending indefinitely; past this bound the next task starts
 * anyway rather than every later write and refresh waiting until a reload.
 * The stalled task's own promise is unaffected — its caller still waits on it.
 */
export const QUEUE_STALL_MS = 20_000;

let tail: Promise<unknown> = Promise.resolve();

export function serializeAccountDataWrite<T>(task: () => Promise<T>): Promise<T> {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // The clock starts when the task starts, not when it is queued, so a task
  // waiting behind a stalled one still gets its full turn to itself.
  const start = (): Promise<T> => {
    const timer = setTimeout(release, QUEUE_STALL_MS);
    const result = (async () => task())();
    const done = () => {
      clearTimeout(timer);
      release();
    };
    result.then(done, done);
    return result;
  };
  const run = tail.then(start, start);
  tail = held;
  return run;
}
