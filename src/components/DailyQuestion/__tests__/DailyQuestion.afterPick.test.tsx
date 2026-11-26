/**
 * The nudge offer right after a pick (NudgeSheet.tsx, DailyQuestion.tsx)
 * against the real store, with only the API module mocked: one test per row of
 * the story's matrix, bar the reload (a remount is the closest a unit test gets).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coupleStreak,
  dailySnapshot,
  DAY_ID,
  nudgeSnapshot,
  revealSnapshot,
  waitingSnapshot,
  writerSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const fetchCoupleStreak = vi.fn();
const submitDailyPickRequest = vi.fn();
const sendDailyNudgeRequest = vi.fn();
const fetchDailyDayById = vi.fn();

// The partner-event subscription has its own test: keep the callback the view hands it.
const listener = vi.hoisted(() => ({ onPartnerPick: undefined as undefined | ((id: string) => void) }));

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../hooks/useDailyPickListener', () => ({
  useDailyPickListener: (onPartnerPick?: (id: string) => void) => {
    listener.onPartnerPick = onPartnerPick;
  },
}));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
  fetchDailyDayById: (...args: unknown[]) => fetchDailyDayById(...args),
  announceDailyPick: vi.fn(async () => {}),
  announceDailyNudge: vi.fn(async () => {}),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
  sendDailyNudge: (...args: unknown[]) => sendDailyNudgeRequest(...args),
}));

import { NUDGE_FAILED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { DAILY_CELEBRATED_KIND } from '../../../services/dailyCelebrated';
import { openMyLoveDB } from '../../../services/dbSchema';
import { deleteAccountCopies, writeLocalCopy } from '../../../services/localCopy';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);
const USER = 'USER-A-ID';
const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

type Snapshot = ReturnType<typeof dailySnapshot>;
const ok = (snapshot: Snapshot) => ({ status: 'ok' as const, snapshot });
const sheet = () => screen.queryByTestId('daily-nudge-sheet');

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  sendDailyNudgeRequest.mockReset();
  listener.onPartnerPick = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(USER);
  useAppStore.setState({
    partner: { id: 'USER-B-ID', displayName: 'Jessie', email: 'b@example.com' },
    coupleStreak: null,
    coupleStreakError: null,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  const queueDb = await openMyLoveDB();
  await queueDb.clear('pick-queue');
  queueDb.close();
  await deleteAccountCopies(USER);
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
});

/** Render Daily on an unpicked day, and pick `this` with the answer the server will give. */
async function pickWith(answer: Snapshot, day: Snapshot = dailySnapshot()) {
  const user = userEvent.setup();
  fetchDailyDay.mockResolvedValue(ok(day));
  submitDailyPickRequest.mockResolvedValue(answer);
  const view = render(<DailyQuestion />);
  await user.click(await screen.findByTestId('daily-option-this'));
  await user.click(screen.getByTestId('daily-send-pick'));
  return { user, view };
}

describe('the nudge offer after a pick', () => {
  it('first picker: the sheet shows once, with the question', async () => {
    await pickWith(nudgeSnapshot('after_pick', false));

    const dialog = await screen.findByTestId('daily-nudge-sheet');
    expect(dialog).toHaveAccessibleName('Do you want to nudge your partner?');
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
  });

  it('Nudge sends one nudge, closes the sheet and greys the waiting button', async () => {
    const { user } = await pickWith(nudgeSnapshot('after_pick', false));
    sendDailyNudgeRequest.mockResolvedValue(nudgeSnapshot('after_pick', true));

    await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

    await waitFor(() => expect(sheet()).toBeNull());
    expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
    expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID);
    expect(screen.getByTestId('daily-nudge')).toBeDisabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
  });

  it.each([
    ['Not now', async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByTestId('daily-nudge-sheet-dismiss'))],
    ['a scrim tap', async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByTestId('daily-nudge-sheet'))],
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
  ])('%s clears the offer, sends nothing and leaves the waiting button on', async (_l, close) => {
    const { user } = await pickWith(nudgeSnapshot('after_pick', false));
    await screen.findByTestId('daily-nudge-sheet');

    await close(user);

    expect(sheet()).toBeNull();
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    // A later re-read of the same day does not bring it back.
    await act(async () => {
      await useAppStore.getState().refreshDailyDay(DAY_ID);
    });
    expect(sheet()).toBeNull();
  });

  it("the writer's day: the write sheet only, and no nudge sheet after it closes", async () => {
    const { user } = await pickWith(
      { ...writerSnapshot('this'), nudge: { slot: 'after_pick', spent: false } },
      dailySnapshot({ write: { mine: true, done: false } })
    );

    await screen.findByTestId('daily-write-sheet');
    expect(sheet()).toBeNull();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
    expect(sheet()).toBeNull();
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
  });

  it('second picker: the reveal, no sheet', async () => {
    await pickWith(revealSnapshot('this', 'that'));

    expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it.each([
    ['a null slot', nudgeSnapshot(null, false)],
    ['a spent nudge', nudgeSnapshot('after_pick', true)],
    ['no nudge at all', waitingSnapshot('this')],
  ])('%s: no sheet', async (_label, answer) => {
    await pickWith(answer);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a queued pick: no sheet, now or after the drain', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    setOnline(false);
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
    expect(sheet()).toBeNull();
    expect(submitDailyPickRequest).not.toHaveBeenCalled();

    submitDailyPickRequest.mockResolvedValue(nudgeSnapshot('after_pick', false));
    setOnline(true);
    await act(async () => {
      await useAppStore.getState().drainQueuedPicks();
    });

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
  });

  it('a day that opens already picked with a free slot offers nothing', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a remount after the offer shows nothing', async () => {
    const { view } = await pickWith(nudgeSnapshot('after_pick', false));
    await screen.findByTestId('daily-nudge-sheet');

    view.unmount();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('an account switch hides the offer', async () => {
    await pickWith(nudgeSnapshot('after_pick', false));
    await screen.findByTestId('daily-nudge-sheet');

    await act(async () => {
      useAppStore.getState().clearAuth();
    });

    expect(sheet()).toBeNull();
  });

  describe('behind the overlays', () => {
    it('waits for the +1, then shows when it closes', async () => {
      await writeLocalCopy(USER, DAILY_CELEBRATED_KIND, { held: 1, milestones: 0 });
      fetchCoupleStreak.mockResolvedValue({ status: 'ok', streak: coupleStreak({ held: 2 }) });

      const { user } = await pickWith(nudgeSnapshot('after_pick', false));

      expect(await screen.findByTestId('daily-streak-up')).toBeInTheDocument();
      expect(sheet()).toBeNull();

      await user.click(screen.getByTestId('daily-streak-up-continue'));

      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });

    it('waits for the milestone screen too', async () => {
      await writeLocalCopy(USER, DAILY_CELEBRATED_KIND, { held: 24, milestones: 0 });
      fetchCoupleStreak.mockResolvedValue({
        status: 'ok',
        streak: coupleStreak({ held: 25, milestones: 1 }),
      });

      const { user } = await pickWith(nudgeSnapshot('after_pick', false));

      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      const milestone = await screen.findByTestId('daily-milestone');
      expect(milestone).toBeInTheDocument();
      expect(sheet()).toBeNull();

      await user.click(screen.getByTestId('daily-milestone-continue'));

      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });
  });

  describe("the partner's pick", () => {
    it('a daily_pick for that day closes the sheet and it does not return', async () => {
      await pickWith(nudgeSnapshot('after_pick', false));
      await screen.findByTestId('daily-nudge-sheet');

      act(() => listener.onPartnerPick?.(DAY_ID));

      expect(sheet()).toBeNull();
      // Even if a stale read shows the own pick alone again.
      await act(async () => {
        useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', false)) });
      });
      expect(sheet()).toBeNull();
    });

    it('a daily_pick for another day leaves the sheet', async () => {
      await pickWith(nudgeSnapshot('after_pick', false));
      await screen.findByTestId('daily-nudge-sheet');

      act(() => listener.onPartnerPick?.('00000000-0000-4000-8000-0000000000d2'));

      expect(sheet()).toBeInTheDocument();
    });

    it('a re-read to both closes the sheet', async () => {
      await pickWith(nudgeSnapshot('after_pick', false));
      await screen.findByTestId('daily-nudge-sheet');
      fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));

      await act(async () => {
        await useAppStore.getState().refreshDailyDay(DAY_ID);
      });

      expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
      expect(sheet()).toBeNull();
    });
  });

  describe('Nudge on the sheet fails', () => {
    it.each([
      ['a refusal', new AccountDataError('refused', NUDGE_FAILED_MESSAGE)],
      ['a network failure', new AccountDataError('transport', 'Failed to fetch')],
    ])('%s: the sheet stays with the fixed line and the day is re-read', async (_l, failure) => {
      const { user } = await pickWith(nudgeSnapshot('after_pick', false));
      sendDailyNudgeRequest.mockRejectedValue(failure);
      fetchDailyDayById.mockResolvedValue(nudgeSnapshot('after_pick', false));

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
        /^Your nudge could not be sent\.$/
      );
      expect(sheet()).toBeInTheDocument();
      await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
    });

    it('offline: the offline sentence on the sheet, and no re-read', async () => {
      const { user } = await pickWith(nudgeSnapshot('after_pick', false));
      await screen.findByTestId('daily-nudge-sheet');
      // The request layer refuses offline before any request, as in the waiting card's test.
      sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('offline', OFFLINE_SENTENCE));
      setOnline(false);

      await user.click(screen.getByTestId('daily-nudge-sheet-send'));

      expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
        OFFLINE_SENTENCE
      );
      expect(fetchDailyDayById).not.toHaveBeenCalled();
      expect(sheet()).toBeInTheDocument();
    });

    it('Nudge is disabled when a re-read leaves no open slot', async () => {
      await pickWith(nudgeSnapshot('after_pick', false));
      await screen.findByTestId('daily-nudge-sheet');

      await act(async () => {
        useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', true)) });
      });

      expect(screen.getByTestId('daily-nudge-sheet-send')).toBeDisabled();
      expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toBeEnabled();
    });
  });
});
