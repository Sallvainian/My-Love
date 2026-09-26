/**
 * Rethrow the failures an api spec collected from its body and its cleanup.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * Playwright 1.63 lists each child of `AggregateError.errors` as its own entry
 * in `testInfo.errors`, after the aggregate. One failure is rethrown as-is, so
 * it is not listed twice; two or more are also named in the aggregate's
 * message, with the first as the `cause`, so a reporter that prints only the
 * top-level error still shows every one.
 */

function describeFailure(failure: unknown): string {
  if (failure instanceof Error) return `${failure.name}: ${failure.message}`;
  try {
    return JSON.stringify(failure) ?? String(failure);
  } catch {
    try {
      return String(failure);
    } catch {
      return '<unprintable rejection>';
    }
  }
}

export function throwCollected(failures: unknown[], message: string): void {
  if (failures.length === 0) return;
  if (failures.length === 1) throw failures[0];
  const details = failures
    .map((failure, index) => `(${index + 1}) ${describeFailure(failure)}`)
    .join('\n');
  throw new AggregateError(failures, `${message}:\n${details}`, { cause: failures[0] });
}
