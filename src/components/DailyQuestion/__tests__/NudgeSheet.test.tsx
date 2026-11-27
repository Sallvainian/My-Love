/**
 * The "Do you want to nudge your partner?" sheet (NudgeSheet.tsx) rendered
 * alone, with the store's `sendDailyNudge` action replaced. The action answers
 * `'sent'`, `'failed'` or `'unchecked'` (a lost answer whose re-read failed
 * too) or throws the offline error; the sheet's lines for each are the shared
 * `useNudgeSend` ones.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

import { NUDGE_FAILED_MESSAGE, NUDGE_UNCHECKED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { useAppStore } from '../../../stores/useAppStore';
import { NudgeSheet } from '../NudgeSheet';
import { nudgeFailureMessage, nudgeOutcomeMessage } from '../nudgeFailureMessage';

const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

const sendDailyNudge = vi.fn();
const original = useAppStore.getState().sendDailyNudge;
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  sendDailyNudge.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useAppStore.setState({ sendDailyNudge } as unknown as Parameters<typeof useAppStore.setState>[0]);
});

afterEach(() => {
  useAppStore.setState({ sendDailyNudge: original } as unknown as Parameters<
    typeof useAppStore.setState
  >[0]);
});

describe('NudgeSheet', () => {
  it('shows the question and the two buttons as a labelled modal dialog', () => {
    render(<NudgeSheet onClose={onClose} />);

    const dialog = screen.getByTestId('daily-nudge-sheet');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Do you want to nudge your partner?');
    expect(screen.getByRole('heading')).toHaveTextContent(/^Do you want to nudge your partner\?$/);
    expect(screen.getByTestId('daily-nudge-sheet-send')).toHaveTextContent('Nudge');
    expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toHaveTextContent('Not now');
    expect(screen.queryByTestId('daily-nudge-sheet-error')).toBeNull();
  });

  it('starts focus on the panel', async () => {
    render(<NudgeSheet onClose={onClose} />);

    await waitFor(() => expect(screen.getByTestId('daily-nudge-panel')).toHaveFocus());
  });

  it('Nudge sends one nudge from the prompt and closes the sheet when it ends as sent', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockResolvedValue('sent');
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sendDailyNudge).toHaveBeenCalledTimes(1);
    expect(sendDailyNudge).toHaveBeenCalledWith('prompt');
  });

  it('disables both buttons while the send, and the re-read after it, is in flight', async () => {
    const user = userEvent.setup();
    let settle: (outcome: string) => void = () => {};
    sendDailyNudge.mockReturnValue(new Promise<string>((resolve) => (settle = resolve)));
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    expect(screen.getByTestId('daily-nudge-sheet-send')).toBeDisabled();
    expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => settle('sent'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'a scrim tap',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByTestId('daily-nudge-sheet')),
    ],
  ])('%s during a send does not close the sheet, so a failure line shows', async (_label, dismiss) => {
    const user = userEvent.setup();
    let settle: (outcome: string) => void = () => {};
    sendDailyNudge.mockReturnValue(new Promise<string>((resolve) => (settle = resolve)));
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));
    // The tapped Nudge button is now disabled; put focus back in the panel, as
    // a Safari tap that never focused the button leaves it, so Escape reaches
    // the focus trap.
    act(() => screen.getByTestId('daily-nudge-panel').focus());
    await dismiss(user);

    expect(onClose).not.toHaveBeenCalled();
    await act(async () => settle('failed'));
    expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
      /^Your nudge could not be sent\.$/
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a refusal, or a re-read that found no nudge, shows the fixed line and keeps the sheet open with Nudge enabled', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockResolvedValue('failed');
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    const box = await screen.findByTestId('daily-nudge-sheet-error');
    expect(box).toHaveTextContent(/^Your nudge could not be sent\.$/);
    expect(box).toHaveAttribute('role', 'alert');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-nudge-sheet-send')).toBeEnabled();
    expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toBeEnabled();
  });

  it('a lost answer whose re-read failed too says it could not check, with Nudge enabled', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockResolvedValue('unchecked');
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
      /^We couldn't check if your nudge went through\. Try again\?$/
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-nudge-sheet-send')).toBeEnabled();
    expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toBeEnabled();
  });

  it('shows no failure line first while the answer is lost and being checked', async () => {
    const user = userEvent.setup();
    let settle: (outcome: string) => void = () => {};
    sendDailyNudge.mockReturnValue(new Promise<string>((resolve) => (settle = resolve)));
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    expect(screen.queryByTestId('daily-nudge-sheet-error')).toBeNull();
    await act(async () => settle('sent'));
  });

  it('an unexpected throw shows the fixed line, keeps the sheet open and logs it', async () => {
    const user = userEvent.setup();
    const failure = new Error('boom');
    sendDailyNudge.mockRejectedValue(failure);
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
      /^Your nudge could not be sent\.$/
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Could not send the nudge:', failure);
  });

  it('offline shows the error’s own sentence, with no log, and keeps the sheet open', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockRejectedValue(new AccountDataError('offline', OFFLINE_SENTENCE));
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
      OFFLINE_SENTENCE
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('the next tap clears the line first', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockResolvedValueOnce('unchecked');
    render(<NudgeSheet onClose={onClose} />);
    await user.click(screen.getByTestId('daily-nudge-sheet-send'));
    await screen.findByTestId('daily-nudge-sheet-error');

    sendDailyNudge.mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    await waitFor(() => expect(screen.queryByTestId('daily-nudge-sheet-error')).toBeNull());
  });

  it('a retry that ends as sent closes the sheet after a failure line', async () => {
    const user = userEvent.setup();
    sendDailyNudge.mockResolvedValueOnce('failed').mockResolvedValueOnce('sent');
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-send'));
    await screen.findByTestId('daily-nudge-sheet-error');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('daily-nudge-sheet-send'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sendDailyNudge).toHaveBeenCalledTimes(2);
  });

  it('Not now closes with nothing sent', async () => {
    const user = userEvent.setup();
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-sheet-dismiss'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sendDailyNudge).not.toHaveBeenCalled();
  });

  it('a scrim tap closes, a tap on the panel does not', async () => {
    const user = userEvent.setup();
    render(<NudgeSheet onClose={onClose} />);

    await user.click(screen.getByTestId('daily-nudge-panel'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('daily-nudge-sheet'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sendDailyNudge).not.toHaveBeenCalled();
  });

  it('Escape closes with nothing sent', async () => {
    const user = userEvent.setup();
    render(<NudgeSheet onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sendDailyNudge).not.toHaveBeenCalled();
  });

  it('the scrim and the panel clear all four safe-area insets and open with no animation', () => {
    render(<NudgeSheet onClose={onClose} />);

    const classes = `${screen.getByTestId('daily-nudge-sheet').className} ${
      screen.getByTestId('daily-nudge-panel').className
    }`;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(classes).toContain(`env(safe-area-inset-${side})`);
    }
    expect(classes).not.toMatch(/animate-|transition|duration-/);
  });
});

describe('nudgeFailureMessage', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('gives the offline error its own sentence, unlogged', () => {
    expect(nudgeFailureMessage(new AccountDataError('offline', OFFLINE_SENTENCE))).toBe(
      OFFLINE_SENTENCE
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([new AccountDataError('refused', 'DQ012'), new Error('x'), 'text'])(
    'gives anything else the fixed line, logged',
    (failure) => {
      expect(nudgeFailureMessage(failure)).toBe(NUDGE_FAILED_MESSAGE);
      expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Could not send the nudge:', failure);
    }
  );
});

describe('nudgeOutcomeMessage', () => {
  it('says could not be sent for a failed send and could not check for an unchecked one', () => {
    expect(nudgeOutcomeMessage('failed')).toBe(NUDGE_FAILED_MESSAGE);
    expect(nudgeOutcomeMessage('unchecked')).toBe(NUDGE_UNCHECKED_MESSAGE);
  });
});
