/**
 * The "Write tomorrow's question?" sheet in the Daily Question view
 * (WriteQuestionSheet.tsx, DailyQuestion.tsx) against the real store, with only
 * the API module mocked: one test per row of the story's matrix.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dailySnapshot,
  DAY_ID,
  waitingSnapshot,
  writerSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const submitDailyPickRequest = vi.fn();
const submitWrittenQuestionRequest = vi.fn();

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

// The partner-event subscription has its own test; here it is only mounted.
vi.mock('../../../hooks/useDailyPickListener', () => ({
  useDailyPickListener: () => {},
}));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  announceDailyPick: vi.fn(async () => {}),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
  submitWrittenQuestion: (...args: unknown[]) => submitWrittenQuestionRequest(...args),
}));

import { AccountDataError, offlineMessage } from '../../../services/accountDataError';
import * as declinedModule from '../../../services/dailyWriteDeclined';
import {
  DAILY_WRITE_DECLINED_KIND,
  readDeclinedWriteDays,
} from '../../../services/dailyWriteDeclined';
import { DAILY_DAYS_COPY_KIND } from '../../../services/dailyDaysCopy';
import { openMyLoveDB } from '../../../services/dbSchema';
import {
  deleteAccountCopies,
  readLocalCopy,
  writeLocalCopy,
} from '../../../services/localCopy';
import { enqueuePick } from '../../../services/pickQueue';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  submitDailyPickRequest.mockReset();
  submitWrittenQuestionRequest.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('USER-A-ID');
  useAppStore.setState({
    partner: { id: 'USER-B-ID', displayName: 'Jessie', email: 'b@example.com' },
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  const queueDb = await openMyLoveDB();
  await queueDb.clear('pick-queue');
  queueDb.close();
  await deleteAccountCopies('USER-A-ID');
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
});

describe("the write tomorrow's question sheet", () => {
  const sheet = () => screen.queryByTestId('daily-write-sheet');
  const writer = (overrides: Parameters<typeof writerSnapshot>[1] = {}) =>
    ok(writerSnapshot('this', overrides));
  const wrote = () => writerSnapshot('this', { write: { mine: true, done: true } });

  /** Render Daily and wait for the day to load. */
  async function open(answer = writer()) {
    fetchDailyDay.mockResolvedValue(answer);
    const view = render(<DailyQuestion />);
    await screen.findByTestId('daily-question');
    return view;
  }

  it('the writer with a confirmed pick: opens at once with the mock-up copy', async () => {
    await open();

    expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: "Write tomorrow's question?" })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("Write tomorrow's question?");
    expect(dialog).toHaveTextContent('Tomorrow');
    expect(dialog).toHaveTextContent("Jessie gets it tomorrow. You'll answer it too.");
    expect(screen.getByLabelText('This')).toBe(screen.getByTestId('daily-write-this'));
    expect(screen.getByLabelText('That')).toBe(screen.getByTestId('daily-write-that'));
    expect(screen.getByTestId('daily-write-rules')).toHaveTextContent(
      'Each option is 1 to 40 characters, and the two must be different.'
    );
    expect(screen.getByTestId('daily-write-send')).toHaveTextContent('Send for tomorrow');
    expect(screen.getByTestId('daily-write-decline')).toHaveTextContent(
      'No thanks, pick one for us'
    );
    expect(dialog).toHaveTextContent('Jessie will see');
  });

  /** The sheet's four lines that name the day the question goes to. */
  function dayWording() {
    return {
      eyebrow: screen.getByTestId('daily-write-eyebrow').textContent,
      title: within(screen.getByRole('dialog')).getByRole('heading').textContent,
      line: screen.getByTestId('daily-write-when').textContent,
      send: screen.getByTestId('daily-write-send').textContent,
    };
  }

  const TOMORROW_WORDING = {
    eyebrow: 'Tomorrow',
    title: "Write tomorrow's question?",
    line: "Jessie gets it tomorrow. You'll answer it too.",
    send: 'Send for tomorrow',
  };

  it.each([
    ['the day after the shown day', '2026-11-06'],
    ['missing (a snapshot saved before the server sent it)', undefined],
  ])('says tomorrow when write.target_day is %s', async (_label, targetDay) => {
    await open(writer({ write: { mine: true, done: false, target_day: targetDay } }));

    await screen.findByTestId('daily-write-sheet');
    expect(dayWording()).toEqual(TOMORROW_WORDING);
    expect(screen.getByRole('dialog')).toHaveAccessibleName("Write tomorrow's question?");
  });

  it('says tomorrow across a month end', async () => {
    vi.setSystemTime(new Date(2026, 10, 30, 12));
    await open(
      writer({ day: '2026-11-30', write: { mine: true, done: false, target_day: '2026-12-01' } })
    );

    await screen.findByTestId('daily-write-sheet');
    expect(dayWording()).toEqual(TOMORROW_WORDING);
  });

  it("names the target date's weekday when the question goes to a later date", async () => {
    // 2026-11-05 is a Thursday; tomorrow already has a day, so it goes to Saturday.
    await open(writer({ write: { mine: true, done: false, target_day: '2026-11-07' } }));

    await screen.findByTestId('daily-write-sheet');
    expect(dayWording()).toEqual({
      eyebrow: 'Saturday',
      title: "Write Saturday's question?",
      line: "Jessie gets it on Saturday. You'll answer it too.",
      send: 'Send for Saturday',
    });
    expect(screen.getByRole('dialog')).toHaveAccessibleName("Write Saturday's question?");
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/tomorrow/i);
  });

  it("opens right after the writer's own pick is confirmed", async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ write: { mine: true, done: false } })));
    submitDailyPickRequest.mockResolvedValue(writerSnapshot('that'));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-that'));
    expect(sheet()).toBeNull();
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
  });

  it('the partner (write.mine false) never sees it', async () => {
    await open(ok(waitingSnapshot('this')));

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a queued pick alone never opens it', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'this',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    await open(ok(dailySnapshot({ write: { mine: true, done: false } })));

    expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('opens once the drain merges the server snapshot of a queued pick', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'this',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    setOnline(false);
    await open(ok(dailySnapshot({ write: { mine: true, done: false } })));
    await screen.findByTestId('daily-pick-queued');
    expect(sheet()).toBeNull();

    submitDailyPickRequest.mockResolvedValue(writerSnapshot('this'));
    setOnline(true);
    await act(async () => {
      await useAppStore.getState().drainQueuedPicks();
    });

    expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
  });

  it('does not open when the turn is already done', async () => {
    await open(ok(wrote()));

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it("does not open on a day that is not the device's today", async () => {
    await open(writer({ day: '2026-11-04' }));

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('does not open for a day declined on this device', async () => {
    await writeLocalCopy('USER-A-ID', DAILY_WRITE_DECLINED_KIND, [DAY_ID]);
    await open();

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    await waitFor(() => expect(useAppStore.getState().dailyWriteDeclined).toEqual([DAY_ID]));
    expect(sheet()).toBeNull();
  });

  it('does not open on the invitation to link', async () => {
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    render(<DailyQuestion />);
    await screen.findByTestId('daily-invite');

    expect(sheet()).toBeNull();
  });

  it('a saved day with the turn open, written elsewhere: the sheet never shows', async () => {
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, { [DAY_ID]: writerSnapshot() });
    let answer: (value: unknown) => void = () => {};
    fetchDailyDay.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-question');
    // The saved day is up and its turn is open, but this mount's read is pending.
    expect(sheet()).toBeNull();

    await act(async () => answer(ok(wrote())));
    await screen.findByTestId('daily-waiting');
    expect(sheet()).toBeNull();
  });

  it('a later background load does not take the open sheet away', async () => {
    const user = userEvent.setup();
    await open();
    await user.type(await screen.findByTestId('daily-write-this'), 'Beach');

    await act(async () => {
      await useAppStore.getState().loadDailyDay();
    });

    expect(sheet()).toBeInTheDocument();
    expect(screen.getByTestId('daily-write-this')).toHaveValue('Beach');
  });

  it('starts on the panel, not a field, so no keyboard opens', async () => {
    await open();

    const panel = await screen.findByTestId('daily-write-panel');
    await waitFor(() => expect(panel).toHaveFocus());
    expect(screen.getByTestId('daily-write-this')).not.toHaveFocus();
  });

  it('the scrim and the panel clear all four safe-area insets', async () => {
    await open();

    const classes = `${(await screen.findByTestId('daily-write-sheet')).className} ${
      screen.getByTestId('daily-write-panel').className
    }`;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(classes).toContain(`env(safe-area-inset-${side})`);
    }
    expect(screen.getByTestId('daily-write-sheet').className).toContain('z-50');
    expect(screen.getByTestId('daily-write-panel').className).toContain('overflow-y-auto');
  });

  it('opens and closes with no animation', async () => {
    await open();

    const classes = `${(await screen.findByTestId('daily-write-sheet')).className} ${
      screen.getByTestId('daily-write-panel').className
    }`;
    expect(classes).not.toMatch(/animate-|transition/);
  });

  describe('closing it', () => {
    it('a tap on the scrim hides it for this mount, and it returns on the next', async () => {
      const user = userEvent.setup();
      const first = await open();
      await user.click(await screen.findByTestId('daily-write-sheet'));
      expect(sheet()).toBeNull();

      // A refresh of the same day does not bring it back while mounted.
      await act(async () => {
        await useAppStore.getState().loadDailyDay();
      });
      expect(sheet()).toBeNull();

      first.unmount();
      render(<DailyQuestion />);
      expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
      expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
    });

    it('a tap inside the panel does not close it', async () => {
      const user = userEvent.setup();
      await open();

      await user.click(await screen.findByTestId('daily-write-panel'));

      expect(sheet()).toBeInTheDocument();
    });

    it('Escape hides it for this mount', async () => {
      const user = userEvent.setup();
      const first = await open();
      await screen.findByTestId('daily-write-sheet');

      await user.keyboard('{Escape}');
      expect(sheet()).toBeNull();

      first.unmount();
      render(<DailyQuestion />);
      expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
    });

    it('writes nothing to the device when closed', async () => {
      const user = userEvent.setup();
      await open();
      await user.click(await screen.findByTestId('daily-write-sheet'));

      expect(await readDeclinedWriteDays('USER-A-ID')).toEqual([]);
    });
  });

  describe('the preview', () => {
    it('shows … for an empty field', async () => {
      await open();

      expect(await screen.findByTestId('daily-write-preview')).toHaveTextContent('… or …?');
    });

    it('follows the typing, trimmed, with the case kept as typed', async () => {
      const user = userEvent.setup();
      await open();

      await user.type(await screen.findByTestId('daily-write-this'), '  Beach DAY ');
      expect(screen.getByTestId('daily-write-preview')).toHaveTextContent('Beach DAY or …?');
      await user.type(screen.getByTestId('daily-write-that'), 'mountains');
      expect(screen.getByTestId('daily-write-preview')).toHaveTextContent(
        'Beach DAY or mountains?'
      );
    });
  });

  describe('Send for tomorrow', () => {
    it('is enabled with empty fields: the client does not pre-validate', async () => {
      await open();

      expect(await screen.findByTestId('daily-write-send')).toBeEnabled();
    });

    it('sends the raw texts once, and closes for good when write.done comes back', async () => {
      const user = userEvent.setup();
      const first = await open();
      submitWrittenQuestionRequest.mockResolvedValue(wrote());

      await user.type(await screen.findByTestId('daily-write-this'), ' Beach ');
      await user.type(screen.getByTestId('daily-write-that'), 'Mountains');
      await user.click(screen.getByTestId('daily-write-send'));

      expect(submitWrittenQuestionRequest).toHaveBeenCalledTimes(1);
      expect(submitWrittenQuestionRequest).toHaveBeenCalledWith(DAY_ID, ' Beach ', 'Mountains');
      await waitFor(() => expect(sheet()).toBeNull());
      expect(useAppStore.getState().dailyDay).toEqual(ok(wrote()));

      // Never again that day: the next mount reads write.done.
      first.unmount();
      fetchDailyDay.mockResolvedValue(ok(wrote()));
      render(<DailyQuestion />);
      await screen.findByTestId('daily-waiting');
      expect(sheet()).toBeNull();
    });

    it('a server refusal keeps the sheet open and shows the reason', async () => {
      const user = userEvent.setup();
      await open();
      submitWrittenQuestionRequest.mockRejectedValue(
        new AccountDataError('refused', 'The two options must differ')
      );

      await user.type(await screen.findByTestId('daily-write-this'), 'Tea');
      await user.type(screen.getByTestId('daily-write-that'), 'tea');
      await user.click(screen.getByTestId('daily-write-send'));

      const error = await screen.findByTestId('daily-write-error');
      expect(error).toHaveTextContent('The two options must differ');
      expect(error).toHaveAttribute('role', 'alert');
      expect(sheet()).toBeInTheDocument();
      expect(screen.getByTestId('daily-write-this')).toHaveValue('Tea');
      expect(screen.getByTestId('daily-write-send')).toBeEnabled();
      expect(await readDeclinedWriteDays('USER-A-ID')).toEqual([]);
    });

    it('offline: shows the offline sentence and keeps the sheet', async () => {
      const user = userEvent.setup();
      await open();
      submitWrittenQuestionRequest.mockRejectedValue(
        new AccountDataError('offline', offlineMessage("Tomorrow's question", 'send', 'needs'))
      );

      await user.click(await screen.findByTestId('daily-write-send'));

      expect(await screen.findByTestId('daily-write-error')).toHaveTextContent(
        "You are offline. Tomorrow's question needs a connection to send."
      );
      expect(sheet()).toBeInTheDocument();
    });

    it('a new Send clears the earlier reason', async () => {
      const user = userEvent.setup();
      await open();
      submitWrittenQuestionRequest.mockRejectedValueOnce(
        new AccountDataError('refused', 'The two options must differ')
      );
      await user.click(await screen.findByTestId('daily-write-send'));
      await screen.findByTestId('daily-write-error');

      let settle: (value: unknown) => void = () => {};
      submitWrittenQuestionRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));
      await user.click(screen.getByTestId('daily-write-send'));

      expect(screen.queryByTestId('daily-write-error')).toBeNull();
      await act(async () => settle(wrote()));
    });

    it('while sending, Send, No thanks and the fields are disabled', async () => {
      const user = userEvent.setup();
      await open();
      let settle: (value: unknown) => void = () => {};
      submitWrittenQuestionRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      await user.click(await screen.findByTestId('daily-write-send'));

      expect(screen.getByTestId('daily-write-send')).toBeDisabled();
      expect(screen.getByTestId('daily-write-decline')).toBeDisabled();
      expect(screen.getByTestId('daily-write-this')).toBeDisabled();
      await act(async () => settle(wrote()));
    });
  });

  describe('No thanks, pick one for us', () => {
    it('saves the day on this device, makes no request and closes', async () => {
      const user = userEvent.setup();
      const first = await open();

      await user.click(await screen.findByTestId('daily-write-decline'));

      await waitFor(() => expect(sheet()).toBeNull());
      expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
      expect(await readLocalCopy('USER-A-ID', DAILY_WRITE_DECLINED_KIND)).toEqual([DAY_ID]);

      // Not on the next mount, nor after a reload that reads the copy.
      first.unmount();
      useAppStore.setState({ dailyWriteDeclined: [], dailyDay: null });
      render(<DailyQuestion />);
      await screen.findByTestId('daily-waiting');
      await waitFor(() => expect(useAppStore.getState().dailyWriteDeclined).toEqual([DAY_ID]));
      expect(sheet()).toBeNull();
    });

    it('closes anyway when the write fails, and logs it', async () => {
      const user = userEvent.setup();
      const first = await open();
      vi.spyOn(declinedModule, 'addDeclinedWriteDay').mockRejectedValue(new Error('disk full'));

      await user.click(await screen.findByTestId('daily-write-decline'));

      await waitFor(() => expect(sheet()).toBeNull());
      expect(console.error).toHaveBeenCalledWith(
        "[DailyQuestion] Could not save that tomorrow's question was declined:",
        expect.objectContaining({ message: 'disk full' })
      );

      // Nothing was saved, so the next mount asks again.
      first.unmount();
      vi.mocked(declinedModule.addDeclinedWriteDay).mockRestore();
      render(<DailyQuestion />);
      expect(await screen.findByTestId('daily-write-sheet')).toBeInTheDocument();
    });
  });
});
