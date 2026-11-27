/**
 * Shared by the `dailyQuestionSlice.*.test.ts` files that drive `loadDailyDay`,
 * `refreshDailyDay` and `submitDailyPick` on the composed `useAppStore`. Each of
 * those files declares its own `vi.mock` blocks and `beforeEach`, because both
 * hoist per file; this holds what they share beyond that.
 */
import { useAppStore } from '../../../src/stores/useAppStore';
import type { dailySnapshot } from './dailyQuestionFixture';

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
