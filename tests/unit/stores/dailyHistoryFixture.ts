/**
 * Shared setup for the `dailyHistorySlice*.test.ts` files: the account ids, the
 * day factories and `installDailyHistoryHooks`, the `beforeEach`/`afterEach` pair
 * every one of them runs. Each file keeps its own `vi.mock`s and its
 * `fetchDailyHistory` mock, which it hands to `installDailyHistoryHooks`.
 */
import { afterEach, beforeEach, vi, type Mock } from 'vitest';

import { cancelDateReminders } from '../../../src/services/dateReminders';
import { deleteAccountImages } from '../../../src/services/imageCache';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { moodService } from '../../../src/services/moodService';
import { useAppStore } from '../../../src/stores/useAppStore';
import { accountDeletesSettled, setOnline } from './accountDataFixtures';
import { revealSnapshot } from './dailyQuestionFixture';

export const A = 'USER-A-ID';
export const C = 'USER-C-ID';

export function state() {
  return useAppStore.getState();
}

export const day = (id: string, date: string) => ({ ...revealSnapshot('this', 'that'), day_id: id, day: date });
export const PAGE = [day('d2', '2026-11-05'), day('d1', '2026-11-04')];

/** `count` consecutive days, newest `2026-10-<newest>` down, ids `p<n>`. */
export const run = (count: number, newest = 31) =>
  Array.from({ length: count }, (_, i) =>
    day(`p${newest - i}`, `2026-10-${String(newest - i).padStart(2, '0')}`)
  );

/** `count` days older than every `run`: `2026-09-30` down, ids `o<n>`. */
export const older = (count: number) =>
  Array.from({ length: count }, (_, i) => day(`o${i}`, `2026-09-${String(30 - i).padStart(2, '0')}`));

/** `count` consecutive days, `start` (`YYYY-MM-DD`) and the ones before it, newest first, ids `<prefix><n>`. */
export const daysFrom = (start: string, count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i);
    return day(`${prefix}${i}`, date.toISOString().slice(0, 10));
  });

/**
 * Registers the file's `beforeEach` and `afterEach`. Call it at the top level of a
 * test file whose `vi.mock`s replace the localCopy, imageCache and dateReminders
 * deletes with call-through spies, as the three `dailyHistorySlice` files do.
 */
export function installDailyHistoryHooks(fetchDailyHistory: Mock) {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDailyHistory.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(moodService, 'deleteSyncedForUser');
    setOnline(true);
    state().clearAuth();
    state().setAuthUser(A);
    // The slice keeps `historyFromCopy` and its generation in closure variables that
    // sign-out does not reset; a test must not inherit them from an earlier one.
    state().resetDailyHistoryForNewPair();
  });

  afterEach(async () => {
    // Lets the sign-out deletes a test started finish before the file can end.
    await accountDeletesSettled(
      vi.mocked(deleteAccountCopies),
      vi.mocked(deleteAccountImages),
      vi.mocked(moodService.deleteSyncedForUser),
      vi.mocked(cancelDateReminders)
    );
    vi.restoreAllMocks();
  });
}
