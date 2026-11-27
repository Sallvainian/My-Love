/**
 * Setup the DailyQuestion view's test files share. Each file keeps its own
 * `vi.mock` calls (Vitest hoists those per file) and loads the mocks from
 * `dailyQuestionViewMocks.ts`; this holds the instants, the partner, and the
 * store, queue and clock reset around them.
 */
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { NEXT_DAY, SAME_DAY, ok } from './dailyQuestionSliceFixture';
import { setOnline } from './navigatorFixtures';

// The fixture's instants and the `ok` answer are the slice tests' own, re-exported here.
export { NEXT_DAY, SAME_DAY, ok };

/** The sentence a `DQ002` refusal is stored with (`submitDailyPick`). */
export const CLOCK_REFUSAL =
  "Your phone's clock looks wrong, so this pick couldn't be sent. Check Settings → General → Date & Time, then pick again.";

export function setPartner(displayName: string | null) {
  useAppStore.setState({
    partner: displayName === null ? null : { id: 'USER-B-ID', displayName, email: 'b@example.com' },
    // `loadPartner` sets `partnerKnown` with a set partner: that state without it is never reached.
    // A null partner is not confirmed unlinked here, so `partnerKnown` stays false (not yet loaded).
    partnerKnown: displayName !== null,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

export const realNavigatePartner = useAppStore.getState().navigatePartner;

/** The part of a file's `beforeEach` that follows its own mock resets. */
export async function resetDailyQuestionView() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('USER-A-ID');
  setPartner('Jessie');
  // A day saved by an earlier test must not be shown first in this one, nor a
  // pick it left in the queue.
  const queueDb = await openMyLoveDB();
  await queueDb.clear('pick-queue');
  queueDb.close();
  await deleteAccountCopies('USER-A-ID');
  await deleteAccountCopies('USER-C-ID');
  useAppStore.setState({ coupleStreak: null, coupleStreakError: null });
}

/** A file's `afterEach`. */
export function restoreDailyQuestionView() {
  vi.useRealTimers();
  setOnline(true);
  useAppStore.setState({ navigatePartner: realNavigatePartner });
}
