/**
 * Shared, mock-free fixture for the `loaderIdentityGuards.*.test.ts` files.
 * Each test file keeps its own fakes, `vi.mock`s and `beforeEach`; this module
 * holds only the plain code they share.
 *
 * WHY THESE TESTS SWITCH IDENTITY DIRECTLY INSTEAD OF CALLING clearAuth
 *
 * `clearAuth` resets the same fields the guards protect, so a test that drives
 * the transition through it passes whether or not the guard exists — every
 * assertion is satisfied by the reset alone. That is not hypothetical: an
 * earlier version of these tests did exactly that, and the entire suite of 1050
 * tests passed with five of the guards deleted.
 * Event session tests also drive real auth actions: their stale outcomes and
 * post-reset settlements distinguish the ownership guard from the reset.
 *
 * `useAppStore.setState({ userId: 'USER-C-ID' })` models the other real
 * transition — `onAuthStateChange` resolving to a different user while a load
 * raised on the previous one is still open — and nothing about it clears the
 * fields under test. Each test seeds USER-C's own data first, so a guard that
 * fails to discard is caught by C's data being overwritten, and a guard that
 * fails to release its loading flag is caught separately.
 */
import { useAppStore } from '../../../src/stores/useAppStore';
import { ACCOUNT_OWNER_STORAGE_KEY } from '../../../src/stores/slices/authSlice';

export const A = 'USER-A-ID';
export const C = 'USER-C-ID';

/** A promise this test resolves by hand, so the account switch can land mid-flight */
export function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Nothing else attaches a handler until the loader does, and an unhandled
  // rejection between construction and that point fails the whole file.
  promise.catch(() => {});
  return { promise, settle, fail };
}

/**
 * A `checkStorageQuota` answer. The slice reads only `percent` and `warning`, so
 * `used`/`quota` follow from the percentage. `warning` is passed, never derived:
 * some cases pair a percentage with a warning it would not produce, on purpose.
 */
export function storageQuota(percent: number, warning: 'none' | 'approaching' | 'critical') {
  return { used: percent * 10, quota: 1_000, percent, warning };
}

/** Hand the store to USER-C mid-flight, seeding whatever C already had on screen. */
export function switchToUserC(cOwnState: Record<string, unknown> = {}): void {
  useAppStore.setState({
    userId: C,
    isAuthenticated: true,
    ...cOwnState,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

/**
 * The store half of every file's `beforeEach`: runs after `vi.clearAllMocks()`
 * and before the mocks are re-armed, which is the order that file relies on.
 */
export function resetStoreSignedInAsA(): void {
  // Start from an empty rotation pool. `setAuthUser` refills it whenever the
  // identity changes, and the store is a module singleton — so a pool left
  // behind by the previous test makes that reload fire during setup, against
  // whatever `mockReturnValue` the previous test left armed (`clearAllMocks`
  // clears calls, not implementations). Both a stray `getAllMessages` call
  // and a stray `messages` write then land inside the case under test.
  useAppStore.setState({ messages: [], currentMessage: null } as unknown as Parameters<
    typeof useAppStore.setState
  >[0]);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(A);
  // AFTER the identity setup: the device owner marker is localStorage-backed
  // and outlives a test, so a case starts with no recorded owner.
  localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
  useAppStore.setState({ error: null });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
}

/** A's own custom row, as A's saved copy holds it. */
export function aCustomMessage() {
  return {
    id: 7,
    text: 'A-PRIVATE-CUSTOM-MESSAGE',
    category: 'custom' as const,
    isCustom: true,
    userId: A,
    serverId: 'srv-a-7',
    active: true,
    isFavorite: false,
    createdAt: new Date('2026-08-03T06:00:00.000Z'),
    updatedAt: new Date('2026-08-03T06:00:00.000Z'),
    tags: [],
  };
}

export function aCopy() {
  return { custom: [aCustomMessage()], bundledFavoriteIds: [], nextCustomId: 8 };
}

/** What C already had on screen: a bundled daily row of their own session. */
export function cRotationPool() {
  return [
    {
      id: 1,
      text: 'C-ONSCREEN-DAILY',
      category: 'reason' as const,
      isCustom: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];
}
