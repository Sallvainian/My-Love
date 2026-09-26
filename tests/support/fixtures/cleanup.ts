/**
 * `cleanup` — teardown a test registers as it creates things.
 *
 * On a test timeout Playwright abandons the test body (it races the body
 * against the timeout and moves on), then runs `afterEach` hooks and fixture
 * teardown. So cleanup written in the body — a `finally`, or a delete after a
 * `catch` — is never awaited on a timeout: it may run late, against a
 * torn-down page, or not at all.
 *
 * Fixture teardown is not guaranteed either. By default a test-scoped fixture
 * is torn down in the same after-hooks time slot as the failure screenshots
 * and every `afterEach` hook, and Playwright skips the teardown of a fixture
 * whose slot is already spent. So `cleanup` is registered with a slot of its
 * own (`CLEANUP_TIMEOUT_MS`, see `merged-fixtures.ts`), and each deferred
 * function gets at most `DEFERRED_FN_TIMEOUT_MS` of it, so one that hangs is
 * reported under its label and the rest still run.
 *
 * Call `cleanup.defer(label, fn)` right after creating the thing `fn` undoes,
 * and before the next setup step, so a seed that fails half-way is still
 * undone. At teardown the deferred functions run last-in-first-out, every one
 * of them runs even when an earlier one throws or hangs, and the failures are
 * thrown together (see `throwCollected`). A function deferred while teardown
 * is running — by a timed-out body that is still going — runs too.
 *
 * `merged-fixtures.ts` declares `cleanup` as depending on `page`, `apiRequest`
 * and `supabaseAdmin`, so Playwright tears it down before them whatever order
 * a test lists its fixtures in: the deferred functions can still use them.
 *
 * Which page `error-context.md` shows: Playwright snapshots the first page of
 * the first browser context closed after the failure was recorded, and skips a
 * context that has no pages. A deferred close therefore decides the snapshot.
 * Close a second context with `closeContext`, which closes its pages first so
 * it never claims the snapshot, and stop the test's own page by closing
 * `page.context()` rather than `page`, so the snapshot is the test's own page.
 */
import type { BrowserContext } from '@playwright/test';
import { throwCollected } from '../helpers/collected-failures';

/** The `cleanup` fixture's own teardown budget. */
export const CLEANUP_TIMEOUT_MS = 60_000;

/**
 * The most one deferred function may take before it is reported as hung and
 * the next one starts. Above the ~10s a context close can legitimately spend
 * on a failed test's screenshot and page snapshot (5s each).
 */
export const DEFERRED_FN_TIMEOUT_MS = 15_000;

export type Deferred = { label: string; fn: () => Promise<unknown> | unknown };

export type Cleanup = {
  /** Undo something at teardown, even when the test body times out. */
  defer: (label: string, fn: Deferred['fn']) => void;
};

/** Settle with `fn`, or reject once `timeoutMs` passes; `fn` is not cancelled. */
async function withinLimit(fn: Deferred['fn'], timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`did not finish within ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    await Promise.race([(async () => fn())(), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `deferred` newest first, draining it, so a function pushed while this
 * runs is run too. Throw every failure, each tagged with its label.
 */
export async function runDeferred(
  deferred: Deferred[],
  timeoutMs = DEFERRED_FN_TIMEOUT_MS
): Promise<void> {
  const failures: unknown[] = [];
  while (deferred.length > 0) {
    const { label, fn } = deferred.pop()!;
    try {
      await withinLimit(fn, timeoutMs);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(new Error(`Cleanup "${label}" failed: ${reason}`, { cause: error }));
    }
  }
  throwCollected(failures, `${failures.length} cleanups failed`);
}

/** The `cleanup` fixture body. `merged-fixtures.ts` registers it with its dependencies. */
export async function provideCleanup(use: (cleanup: Cleanup) => Promise<void>): Promise<void> {
  const deferred: Deferred[] = [];
  await use({ defer: (label, fn) => void deferred.push({ label, fn }) });
  await runDeferred(deferred);
}

/**
 * Close a context the test opened itself, pages first, so the close never
 * takes `error-context.md`'s page snapshot from the test's own page.
 */
export async function closeContext(context: BrowserContext): Promise<void> {
  for (const page of context.pages()) await page.close();
  await context.close();
}
