/**
 * `claimStreakCelebration` and `claimStreakMilestone` on the composed
 * `useAppStore`: the session guard and the never-throws contract around
 * `claimCelebration` and `claimMilestone`. The claims' own rules are in tests/unit/services/dailyCelebrated.test.ts.
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
  NO_CELEBRATION,
  readCelebrated,
} from '../../../src/services/dailyCelebrated';
import * as celebrated from '../../../src/services/dailyCelebrated';
import { lookupPartnerId } from '../../../src/api/supabaseClient';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { coupleStreak } from './dailyQuestionFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';
const PARTNER = 'PARTNER-P-ID';
const NEW_PARTNER = 'PARTNER-Q-ID';

const withPartner = (id: string) =>
  useAppStore.setState({
    partner: { id, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
    partnerKnown: true,
  });

function state() {
  return useAppStore.getState();
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state().clearAuth();
  state().setAuthUser(A);
  withPartner(PARTNER);
  await deleteAccountCopies(A);
  await deleteAccountCopies(C);
});

afterEach(() => {
  useAppStore.setState({ partner: null, partnerKnown: false });
  vi.restoreAllMocks();
});

describe('claimStreakCelebration', () => {
  it('first claim seeds the signed-in account and does not play', async () => {
    await expect(state().claimStreakCelebration(coupleStreak({ held: 3 }))).resolves.toEqual(NO_CELEBRATION);

    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 0 });
  });

  it("tags what it writes with the store's partner", async () => {
    await state().claimStreakCelebration(coupleStreak({ held: 3 }));

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 3,
      milestones: 0,
      partner_id: PARTNER,
    });
  });

  it("a new pair's lower held total plays nothing and re-seeds the value", async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 40, milestones: 1, partner_id: PARTNER });
    withPartner(NEW_PARTNER);

    await expect(state().claimStreakCelebration(coupleStreak({ held: 2 }))).resolves.toEqual(
      NO_CELEBRATION
    );
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 2,
      milestones: 0,
      partner_id: NEW_PARTNER,
    });

    await expect(state().claimStreakCelebration(coupleStreak({ held: 3 }))).resolves.toMatchObject({
      play: true,
    });
  });

  it('no known partner: nothing is claimed or written', async () => {
    useAppStore.setState({ partner: null, partnerKnown: true });
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'unlinked' });
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0, partner_id: PARTNER });

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual(
      NO_CELEBRATION
    );

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 3,
      milestones: 0,
      partner_id: PARTNER,
    });
  });

  it('a partner change during the claim: no play, and the value is not overwritten', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0, partner_id: PARTNER });
    const pending = state().claimStreakCelebration(coupleStreak({ held: 4 }));
    withPartner(NEW_PARTNER);

    await expect(pending).resolves.toEqual(NO_CELEBRATION);
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 3,
      milestones: 0,
      partner_id: PARTNER,
    });
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
      previous: { held: 4, milestones: 0 },
      milestone: false,
    });
  });

  it('signed out: answers no play and touches nothing', async () => {
    state().clearAuth();
    const claim = vi.spyOn(celebrated, 'claimCelebration');

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual(NO_CELEBRATION);

    expect(claim).not.toHaveBeenCalled();
  });

  it('a sign-out during the claim: no play, and the stored value is not overwritten', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });
    const pending = state().claimStreakCelebration(coupleStreak({ held: 4 }));
    // `clearAuth` would delete the kind itself and hide an overwrite: bump the
    // session as a sign-out does and leave the copy to the claim's own guard.
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 });

    await expect(pending).resolves.toEqual(NO_CELEBRATION);
    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 0 });
  });

  it('an account switch during the claim: no play for the new account', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });
    const pending = state().claimStreakCelebration(coupleStreak({ held: 4 }));
    useAppStore.setState({ userId: C });

    await expect(pending).resolves.toEqual(NO_CELEBRATION);
    expect(await readCelebrated(C)).toBeNull();
  });

  it('a write failure is logged and answers no play, never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(celebrated, 'claimCelebration').mockRejectedValue(failure);

    await expect(state().claimStreakCelebration(coupleStreak({ held: 4 }))).resolves.toEqual(NO_CELEBRATION);

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not record the streak celebration:',
      failure
    );
  });
});

describe('claimStreakMilestone', () => {
  const owed = { held: 25, milestones: 0 };
  const reached = coupleStreak({ held: 25, milestones: 1 });
  const canShow = () => true;

  it('answers true once per milestone and stores it as shown', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, owed);

    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(true);
    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(false);

    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 1 });
  });

  it("tags the stored milestone with the store's partner", async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, owed);

    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(true);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 25,
      milestones: 1,
      partner_id: PARTNER,
    });
  });

  it("a value tagged with another partner: answers false, and the new pair's value is untouched", async () => {
    const old = { held: 25, milestones: 0, partner_id: PARTNER };
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, old);
    withPartner(NEW_PARTNER);

    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(false);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual(old);
  });

  it('signed out: answers false and touches nothing', async () => {
    state().clearAuth();
    const claim = vi.spyOn(celebrated, 'claimMilestone');

    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(false);

    expect(claim).not.toHaveBeenCalled();
  });

  it('a view that can no longer show it: answers false, and the milestone stays owed', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, owed);

    await expect(state().claimStreakMilestone(reached, () => false)).resolves.toBe(false);

    expect(await readCelebrated(A)).toEqual(owed);
  });

  it('a sign-out during the claim: answers false, and the stored value is not overwritten', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, owed);
    const pending = state().claimStreakMilestone(reached, canShow);
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 });

    await expect(pending).resolves.toBe(false);
    expect(await readCelebrated(A)).toEqual(owed);
  });

  it('a write failure is logged and answers false, never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(celebrated, 'claimMilestone').mockRejectedValue(failure);

    await expect(state().claimStreakMilestone(reached, canShow)).resolves.toBe(false);

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not record the milestone as shown:',
      failure
    );
  });
});
