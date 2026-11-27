/**
 * Shared by the `dailyQuestionSlice.*.test.ts` files that drive `loadDailyDay`,
 * `refreshDailyDay` and `submitDailyPick` on the composed `useAppStore`. Each of
 * those files declares its own `vi.mock` blocks and the `vi.fn` constants their
 * factories read, because both hoist per file; the setup and teardown hooks are
 * registered here by `useDailySliceHooks`.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { dailySnapshot } from './dailyQuestionFixture';
import { A } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
export const SAME_DAY = new Date(2026, 10, 5, 12);
/** One minute past local midnight: the device's date is no longer the fixture's day. */
export const NEXT_DAY = new Date(2026, 10, 6, 0, 1);

export function state() {
  return useAppStore.getState();
}

export const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({
  status: 'ok' as const,
  snapshot,
});

type Mock = ReturnType<typeof vi.fn>;

/**
 * Registers the `beforeEach` and `afterEach` every Daily slice file shares, on the suite
 * that is being collected when it is called: call it once at the top level of the file.
 * Takes the file's own mocks, which its `vi.mock` factories forward to.
 */
export function useDailySliceHooks(mocks: {
  fetchDailyDay: Mock;
  fetchDailyDayById: Mock;
  submitDailyPickRequest: Mock;
  announceDailyPick: Mock;
}) {
  const realLoadCoupleStreak = useAppStore.getState().loadCoupleStreak;
  const loadCoupleStreak = vi.fn(async () => {});

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.fetchDailyDay.mockReset();
    mocks.fetchDailyDayById.mockReset();
    mocks.submitDailyPickRequest.mockReset();
    mocks.announceDailyPick.mockReset();
    mocks.announceDailyPick.mockResolvedValue(undefined);
    // The streak read has its own tests; here only whether a pick asks for it.
    useAppStore.setState({ loadCoupleStreak });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setOnline(true);
    // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SAME_DAY);
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
  });

  afterEach(() => {
    useAppStore.setState({ loadCoupleStreak: realLoadCoupleStreak });
    vi.useRealTimers();
    setOnline(true);
    vi.restoreAllMocks();
  });

  return { loadCoupleStreak };
}
