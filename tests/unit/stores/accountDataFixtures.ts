/**
 * Shared, mock-free helpers for the store test files that sign accounts in and
 * out (`accountDataSlices.test.ts`, `accountDataSlices.anniversaries.test.ts`,
 * `countdownMarks.test.ts`, `pushPreferencesCopy.test.ts` and others).
 * Each of those files keeps its own server fakes, `vi.mock`s and `beforeEach`.
 */
import { AccountDataError } from '../../../src/services/accountDataError';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { AppState } from '../../../src/stores/types';
import type { Anniversary } from '../../../src/types';

export type StoreState = Partial<AppState>;

export function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  promise.catch(() => {});
  return { promise, settle, fail };
}

export function setAnniversaries(list: Anniversary[]) {
  const settings = useAppStore.getState().settings!;
  useAppStore.setState({
    settings: { ...settings, relationship: { ...settings.relationship, anniversaries: list } },
  } as StoreState);
}

export const offline = () => new AccountDataError('offline', 'You are offline. Anniversaries need a connection to save.');

export { setOnline } from './navigatorFixtures';

/** A call-through `vi.fn`/`vi.spyOn`: only its recorded results are read. */
type CallThroughSpy = { mock: { results: { value: unknown }[] } };

/**
 * Waits for the deletes `deleteAccountData` (`authSlice.ts`) starts
 * fire-and-forget on every sign-out and account switch, so none of them logs
 * after the file ends, which Vitest reports as an `EnvironmentTeardownError`.
 * Pass the file's call-through spies on `deleteAccountCopies`,
 * `deleteAccountImages` and `moodService.deleteSyncedForUser`, plus
 * `cancelDateReminders` where it runs for real, and call it before
 * `vi.restoreAllMocks()`, which would drop a `vi.spyOn`'s results.
 */
export async function accountDeletesSettled(...spies: CallThroughSpy[]): Promise<void> {
  await Promise.allSettled(spies.flatMap((spy) => spy.mock.results.map((result) => result.value)));
}
