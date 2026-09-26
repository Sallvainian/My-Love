/**
 * Shared, mock-free helpers for the accountDataSlices test files
 * (`accountDataSlices.test.ts` and `accountDataSlices.anniversaries.test.ts`).
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

export function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}
