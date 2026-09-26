/**
 * Polling through playwright-utils' `recurse`, in the shape of `expect.poll`.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * `await expect.poll(read, { message, timeout }).toX(y)` becomes
 * `await recurseUntil(read, (v) => { expect(v, message).toX(y); }, { timeout })`,
 * and `.not` carries over. The helper covers three gaps in a bare `recurse`:
 *
 * - `recurse` throws when its last reading is falsy (0, false, null, ''), so
 *   the reading is boxed and a falsy value can satisfy the check.
 * - `recurse` never awaits its predicate, so an async check would pass at once
 *   on its truthy promise, and a boolean check has no assertion to re-run for
 *   the diff below; the check must assert with `expect` and return nothing,
 *   and any other return value (a boolean, a promise) is refused.
 * - `recurse` times out with a generic message, so on timeout the check runs
 *   once more on the last reading and the failure shows the assertion's diff.
 *
 * A failed `expect(` inside the check is a retry. Any other throw, from the
 * check or from `read`, fails at once, as it does in `expect.poll`, and is
 * rethrown unwrapped so the report shows the original error.
 */
import {
  recurse,
  RecurseCommandError,
  RecursePredicateError,
  RecurseTimeoutError,
} from '@seontechnologies/playwright-utils/recurse';

/** Matches `expect.timeout` in `playwright.config.ts`, the budget `expect.poll` had. */
export const POLL = { timeout: 15_000, interval: 100 };

export async function recurseUntil<T>(
  read: () => Promise<T>,
  check: (value: T) => void,
  options: { timeout?: number; interval?: number; log?: string } = {}
): Promise<T> {
  let last: { value: T } | undefined;
  try {
    const boxed = await recurse(
      async () => (last = { value: await read() }),
      ({ value }) => {
        const returned: unknown = check(value);
        if (returned === undefined) return;
        // A refused async check must not also surface as an unhandled rejection.
        if (returned instanceof Promise) returned.catch(() => {});
        // No `expect(` in this message: recurse would read it as a retry.
        throw new Error(
          'recurseUntil: the check must assert with expect and return nothing, ' +
            `but it returned ${returned instanceof Promise ? 'a promise' : String(returned)}`
        );
      },
      { ...POLL, ...options }
    );
    return boxed.value;
  } catch (error) {
    // Report the assertion's own diff rather than recurse's generic timeout.
    if (error instanceof RecurseTimeoutError && last) check(last.value);
    const wrapped = error instanceof RecurseCommandError || error instanceof RecursePredicateError;
    if (wrapped && error.originalError) throw error.originalError;
    throw error;
  }
}
