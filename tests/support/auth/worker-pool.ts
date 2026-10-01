/**
 * Worker Pool Identity
 *
 * Single source for the "which test users does this parallel worker own?"
 * mapping. The pool-size logic below previously existed as two byte-identical
 * copies — tests/support/fixtures/auth.ts and tests/support/auth/global-setup.ts —
 * and the seeding factory needed the same answer. Three copies that must agree
 * is three chances to disagree silently, so it lives here once.
 *
 * ## Which index this keys on, and why it matters
 *
 * Playwright exposes two per-worker numbers, and they are not interchangeable:
 *
 *   workerIndex   (env TEST_WORKER_INDEX)   — unique per worker *process*.
 *                                             A restarted worker gets a NEW one.
 *   parallelIndex (env TEST_PARALLEL_INDEX) — the slot, 0..workers-1.
 *                                             A restarted worker KEEPS its old one.
 *
 * Everything keys on parallelIndex: the browser's signed-in identity
 * (fixtures/auth.ts, from `workerInfo.parallelIndex`) and every seeding helper
 * (through getWorkerPairEmails(), from TEST_PARALLEL_INDEX). The two read the
 * same number in the same process, so a retried test signs in and seeds as the
 * same pair. Never mix the two indexes: a helper that followed workerIndex
 * while auth followed parallelIndex would seed another worker's pair on
 * exactly the runs that are already failing.
 *
 * workerIndex used to be the key, folded into the pool with a modulo. It grows
 * without bound, and not only on retries: Playwright starts a fresh worker
 * whenever the next file needs different worker-scoped options, and `trace`
 * and `video` are worker-scoped, so every `test.use({ trace: 'off' })` file
 * restarts one. A single run reached workerIndex 20 with no failure at all,
 * and once an index passes the pool size the modulo lands a new worker on a
 * pair a live worker is still using — two tests writing one couple's rows.
 * parallelIndex cannot do that: no two live workers ever hold the same slot.
 *
 * ## The pool must cover every slot
 *
 * Slots run 0..workers-1, so the pool needs at least `workers` pairs. Global
 * setup refuses to start a run whose worker count exceeds the pool, and
 * poolSlot() throws rather than wrapping an out-of-range slot, so a
 * misconfigured run fails loudly instead of quietly sharing accounts.
 */
import { cpus } from 'node:os';

export const MIN_AUTH_POOL_SIZE = 8;

/**
 * Number of worker user pairs the suite provisions and cycles through.
 *
 * Moved verbatim from the two former copies; behaviour is unchanged.
 */
export function getAuthPoolSize(): number {
  const cpuCount = cpus().length;
  const defaultAuthPoolSize = Number.isFinite(cpuCount)
    ? Math.max(MIN_AUTH_POOL_SIZE, cpuCount)
    : MIN_AUTH_POOL_SIZE;

  const raw = process.env.PLAYWRIGHT_AUTH_POOL_SIZE;
  if (!raw) return defaultAuthPoolSize;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultAuthPoolSize;

  return parsed;
}

/**
 * The pool pair a parallel slot owns: the slot itself. Throws when the slot is
 * outside the pool rather than wrapping, because wrapping is what put two live
 * workers on one pair.
 */
export function poolSlot(parallelIndex: number, poolSize: number): number {
  if (!Number.isInteger(parallelIndex) || parallelIndex < 0 || parallelIndex >= poolSize) {
    throw new Error(
      `Worker slot ${parallelIndex} is outside the auth pool of ${poolSize} pairs. ` +
        'Run with fewer workers or raise PLAYWRIGHT_AUTH_POOL_SIZE.'
    );
  }
  return parallelIndex;
}

export function getWorkerEmail(slot: number): string {
  return `testworker${slot}@test.example.com`;
}

export function getWorkerPartnerEmail(slot: number): string {
  return `testworker${slot}-partner@test.example.com`;
}

/**
 * This process's parallel slot, or null when there isn't one.
 *
 * Playwright sets TEST_PARALLEL_INDEX only inside worker processes
 * (playwright/lib/worker/workerProcessEntry.js). It is absent in globalSetup, in
 * reporters, and in any ad-hoc script that imports these helpers.
 *
 * Returns null in that case — NOT 0. Do not "simplify" this to `?? 0`:
 * slot 0 is a real worker's identity, so defaulting to it would make
 * global-setup or a hand-run script operate on slot 0's accounts while
 * that worker is mid-test. Callers must handle null as "no worker identity" and
 * fall back to whatever their non-worker-scoped behaviour was.
 */
export function resolveParallelIndexFromEnv(): number | null {
  const raw = process.env.TEST_PARALLEL_INDEX;
  if (raw === undefined || raw === '') return null;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * The email pair this worker owns, or null when not running inside a worker.
 *
 * Null means "no worker identity" — see resolveParallelIndexFromEnv(). Callers
 * must not substitute a default pair.
 */
export function getWorkerPairEmails(): { user1Email: string; user2Email: string } | null {
  const parallelIndex = resolveParallelIndexFromEnv();
  if (parallelIndex === null) return null;

  const index = poolSlot(parallelIndex, getAuthPoolSize());
  return {
    user1Email: getWorkerEmail(index),
    user2Email: getWorkerPartnerEmail(index),
  };
}
