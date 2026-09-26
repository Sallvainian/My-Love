/**
 * Rethrow the failures an api spec collected from its body and its cleanup.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * Playwright's report keeps an error's message, stack and cause, never
 * `AggregateError.errors`, so a bare `new AggregateError(failures, summary)`
 * shows only the summary and hides every assertion it wraps. One failure is
 * therefore rethrown as-is; two or more are named in the message, with the
 * first as the `cause`.
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
