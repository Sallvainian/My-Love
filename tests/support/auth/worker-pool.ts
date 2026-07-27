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
 * They diverge the moment a worker restarts, which is exactly what `retries`
 * causes: a failing test is retried in a fresh worker process. Since
 * fixtures/auth.ts keys the browser's logged-in identity on workerIndex,
 * anything that seeds data for "this worker" must key on workerIndex too.
 * Keying seeding on parallelIndex would authenticate a retried test as one user
 * while seeding its data for another — a failure that appears only on retries,
 * i.e. only when a test is already unstable.
 *
 * ## Known, accepted limitation: index wrap
 *
 * workerIndex grows without bound while the pool is fixed, so
 * normalizeWorkerIndex() wraps. This is deliberately unguarded. Auth and
 * seeding apply the same normalization to the same index, so they wrap together
 * and never disagree with each other; only cross-worker *uniqueness* degrades,
 * and that requires poolSize-or-more worker restarts while an early worker is
 * still running. If you are debugging two workers that appear to share
 * accounts, this is the mechanism — but check for a genuine duplicate index
 * first.
 */
import { cpus } from 'os';

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

/** Fold an unbounded workerIndex into a pool slot. See "index wrap" above. */
export function normalizeWorkerIndex(workerIndex: number, poolSize: number): number {
  return ((workerIndex % poolSize) + poolSize) % poolSize;
}

export function getWorkerEmail(workerIndex: number): string {
  return `testworker${workerIndex}@test.example.com`;
}

export function getWorkerPartnerEmail(workerIndex: number): string {
  return `testworker${workerIndex}-partner@test.example.com`;
}

/**
 * This process's worker index, or null when there isn't one.
 *
 * Playwright sets TEST_WORKER_INDEX only inside worker processes
 * (playwright/lib/worker/workerMain.js). It is absent in globalSetup, in
 * reporters, and in any ad-hoc script that imports these helpers.
 *
 * Returns null in that case — NOT 0. Do not "simplify" this to `?? 0`:
 * index 0 is a real worker's identity, so defaulting to it would make
 * global-setup or a hand-run script operate on worker 0's accounts while
 * worker 0 is mid-test. Callers must handle null as "no worker identity" and
 * fall back to whatever their non-worker-scoped behaviour was.
 */
export function resolveWorkerIndexFromEnv(): number | null {
  const raw = process.env.TEST_WORKER_INDEX;
  if (raw === undefined || raw === '') return null;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * The email pair this worker owns, or null when not running inside a worker.
 *
 * Null means "no worker identity" — see resolveWorkerIndexFromEnv(). Callers
 * must not substitute a default pair.
 */
export function getWorkerPairEmails(): { user1Email: string; user2Email: string } | null {
  const workerIndex = resolveWorkerIndexFromEnv();
  if (workerIndex === null) return null;

  const index = normalizeWorkerIndex(workerIndex, getAuthPoolSize());
  return {
    user1Email: getWorkerEmail(index),
    user2Email: getWorkerPartnerEmail(index),
  };
}
