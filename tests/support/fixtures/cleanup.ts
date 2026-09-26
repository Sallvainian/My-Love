/**
 * `cleanup` — teardown a test registers as it creates things.
 *
 * On a test timeout Playwright abandons the test body (it races the body
 * against the timeout and moves on), then runs `afterEach` hooks and fixture
 * teardown in a fresh time slot. So cleanup written in the body — a `finally`,
 * or a delete after a `catch` — is never awaited on a timeout: it may run late,
 * against a torn-down page, or not at all. A fixture's teardown always runs.
 *
 * Call `cleanup.defer(label, fn)` right after creating the thing `fn` undoes,
 * and before the next setup step, so a seed that fails half-way is still
 * undone. At teardown the deferred functions run last-in-first-out, every one
 * of them runs even when an earlier one throws, and the failures are thrown
 * together (see `throwCollected`).
 *
 * List `cleanup` LAST in the test's fixtures. Playwright sets fixtures up in
 * the order a test names them and tears them down in reverse, so listed last
 * it is torn down first, while `page`, `apiRequest` and the rest are still
 * open for the deferred functions to use.
 */
import { test as base } from '@playwright/test';
import { throwCollected } from '../helpers/collected-failures';

type Deferred = { label: string; fn: () => Promise<unknown> | unknown };

export type Cleanup = {
  /** Undo something at teardown, even when the test body times out. */
  defer: (label: string, fn: Deferred['fn']) => void;
};

/** Run `deferred` newest first; throw every failure, each tagged with its label. */
export async function runDeferred(deferred: readonly Deferred[]): Promise<void> {
  const failures: unknown[] = [];
  for (const { label, fn } of [...deferred].reverse()) {
    try {
      await fn();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(new Error(`Cleanup "${label}" failed: ${reason}`, { cause: error }));
    }
  }
  throwCollected(failures, `${failures.length} cleanups failed`);
}

export const test = base.extend<{ cleanup: Cleanup }>({
  cleanup: async ({}, use) => {
    const deferred: Deferred[] = [];
    await use({ defer: (label, fn) => void deferred.push({ label, fn }) });
    await runDeferred(deferred);
  },
});
