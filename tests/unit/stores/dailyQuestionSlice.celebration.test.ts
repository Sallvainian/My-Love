/**
 * `claimStreakCelebration` on the composed `useAppStore`: the session guard and
 * the never-throws contract around `claimCelebration`. The claim's own rules
 * are in tests/unit/services/dailyCelebrated.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

import {
  DAILY_CELEBRATED_KIND,
  readCelebrated,
} from '../../../src/services/dailyCelebrated';
import * as celebrated from '../../../src/services/dailyCelebrated';
import { deleteAccountCopies, writeLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { coupleStreak } from './dailyQuestionFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
  await deleteAccountCopies(C);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('claimStreakCelebration', () => {
  it('first claim seeds the signed-in account and does not play', async () => {
    await expect(state().claimStreakCelebration(coupleStreak({ held: 3 }))).resolves.toEqual({
      play: false,
    });

    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 0 });
  });

  it('a higher held plays once, rolling up from the stored value', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual({
      play: true,
      previous: { held: 3, milestones: 0 },
      milestone: false,
    });
    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual({
      play: false,
    });
  });

  it('signed out: answers no play and touches nothing', async () => {
    state().clearAuth();
    const claim = vi.spyOn(celebrated, 'claimCelebration');

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual({
      play: false,
    });

    expect(claim).not.toHaveBeenCalled();
  });

  it('a sign-out during the claim: no play, and the stored value is not overwritten', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });
    const pending = state().claimStreakCelebration(coupleStreak({ held: 4 }));
    // `clearAuth` would delete the kind itself and hide an overwrite: bump the
    // session as a sign-out does and leave the copy to the claim's own guard.
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 });

    await expect(pending).resolves.toEqual({ play: false });
    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 0 });
  });

  it('an account switch during the claim: no play for the new account', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });
    const pending = state().claimStreakCelebration(coupleStreak({ held: 4 }));
    useAppStore.setState({ userId: C });

    await expect(pending).resolves.toEqual({ play: false });
    expect(await readCelebrated(C)).toBeNull();
  });

  it('a write failure is logged and answers no play, never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(celebrated, 'claimCelebration').mockRejectedValue(failure);

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual({
      play: false,
    });

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not record the streak celebration:',
      failure
    );
  });
});
