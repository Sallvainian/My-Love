import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionSubscriptionStatus } from '../../../api/interactionService';

const storeMocks = vi.hoisted(() => ({
  sendPoke: vi.fn(),
  sendKiss: vi.fn(),
  getUnviewedInteractions: vi.fn((): unknown[] => []),
  markInteractionViewed: vi.fn(),
  subscribeToInteractions: vi.fn(),
}));

const storeState = vi.hoisted(() => ({ unviewedCount: 0 }));

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({
    ...storeMocks,
    unviewedCount: storeState.unviewedCount,
  }),
}));

// Stands in for the sheet so a test can tell whether History opened.
vi.mock('../../InteractionHistory', () => ({
  InteractionHistory: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="interaction-history-modal" /> : null,
}));

import { NoPartnerError } from '../../../utils/interactionValidation';
import { PokeKissInterface } from '../PokeKissInterface';

describe('PokeKissInterface interaction subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    storeState.unviewedCount = 0;
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT'] as const)(
    'announces that incoming pokes and kisses may not arrive after %s',
    async (status) => {
      const unsubscribe = vi.fn();
      let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
      storeMocks.subscribeToInteractions.mockImplementation(
        (onStatusChange: (status: InteractionSubscriptionStatus) => void) => {
          reportStatus = onStatusChange;
          return Promise.resolve(unsubscribe);
        }
      );

      const { unmount } = render(<PokeKissInterface />);
      await waitFor(() => expect(reportStatus).toBeDefined());
      act(() => reportStatus?.(status));

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Connection lost. Incoming pokes and kisses may not arrive.'
        )
      );
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    }
  );

  it('shows no warning when healthy and clears a failure warning after recovery', async () => {
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    storeMocks.subscribeToInteractions.mockImplementation(
      (onStatusChange: (status: InteractionSubscriptionStatus) => void) => {
        reportStatus = onStatusChange;
        return Promise.resolve(vi.fn());
      }
    );

    render(<PokeKissInterface />);
    await waitFor(() => expect(reportStatus).toBeDefined());
    act(() => reportStatus?.('SUBSCRIBED'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => reportStatus?.('CHANNEL_ERROR'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => reportStatus?.('SUBSCRIBED'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the connection warning separate from transient action toasts', async () => {
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    storeMocks.subscribeToInteractions.mockImplementation(
      (onStatusChange: (status: InteractionSubscriptionStatus) => void) => {
        reportStatus = onStatusChange;
        return Promise.resolve(vi.fn());
      }
    );

    render(<PokeKissInterface />);
    await waitFor(() => expect(reportStatus).toBeDefined());
    act(() => reportStatus?.('TIMED_OUT'));

    fireEvent.click(screen.getByTestId('fart-button'));

    expect(screen.getByTestId('toast-notification')).toHaveTextContent('Fart sent!');
    expect(screen.getByTestId('toast-notification')).not.toHaveAttribute('role');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connection lost. Incoming pokes and kisses may not arrive.'
    );
  });

  it('ignores a late status and tears down once when subscription resolves after unmount', async () => {
    const unsubscribe = vi.fn();
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    let resolveSubscription: ((unsubscribe: () => void) => void) | undefined;
    const pendingSubscription = new Promise<() => void>((resolve) => {
      resolveSubscription = resolve;
    });
    storeMocks.subscribeToInteractions.mockImplementation(
      (onStatusChange: (status: InteractionSubscriptionStatus) => void) => {
        reportStatus = onStatusChange;
        return pendingSubscription;
      }
    );

    const { unmount } = render(<PokeKissInterface />);
    await waitFor(() => expect(reportStatus).toBeDefined());
    unmount();

    act(() => reportStatus?.('CHANNEL_ERROR'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      resolveSubscription?.(unsubscribe);
      await pendingSubscription;
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('PokeKissInterface sending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    storeState.unviewedCount = 0;
    storeMocks.subscribeToInteractions.mockResolvedValue(vi.fn());
  });

  it('asks the store to send, without naming a recipient', async () => {
    storeMocks.sendPoke.mockResolvedValue({ id: 'poke-1' });

    render(<PokeKissInterface />);
    fireEvent.click(screen.getByTestId('poke-button'));

    await waitFor(() =>
      expect(screen.getByTestId('toast-notification')).toHaveTextContent('Poke sent!')
    );
    // The recipient is derived from the authenticated relationship inside the
    // service (F4). A component that still passed one would be trusting a value
    // the database will not accept.
    expect(storeMocks.sendPoke).toHaveBeenCalledWith();
  });

  it.each([
    ['poke', 'sendPoke', 'poke-button'],
    ['kiss', 'sendKiss', 'kiss-button'],
  ] as const)(
    'reports a missing partner distinctly from a failed %s',
    async (_label, action, testId) => {
      storeMocks[action].mockRejectedValue(new NoPartnerError());

      render(<PokeKissInterface />);
      fireEvent.click(screen.getByTestId(testId));

      await waitFor(() =>
        expect(screen.getByTestId('toast-notification')).toHaveTextContent(
          'Error: Partner not configured'
        )
      );
    }
  );

  it('still reports a real send failure as a failure', async () => {
    storeMocks.sendKiss.mockRejectedValue(new Error('network went away'));

    render(<PokeKissInterface />);
    fireEvent.click(screen.getByTestId('kiss-button'));

    await waitFor(() =>
      expect(screen.getByTestId('toast-notification')).toHaveTextContent(
        'Failed to send kiss. Try again.'
      )
    );
  });
});

describe('PokeKissInterface on the kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    storeState.unviewedCount = 0;
    storeMocks.getUnviewedInteractions.mockReturnValue([]);
    storeMocks.subscribeToInteractions.mockResolvedValue(vi.fn());
  });

  it('renders the three action tiles and History without any click', () => {
    render(<PokeKissInterface />);

    expect(screen.getByText('Send a little something')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poke' })).toHaveAttribute('data-testid', 'poke-button');
    expect(screen.getByRole('button', { name: 'Kiss' })).toHaveAttribute('data-testid', 'kiss-button');
    expect(screen.getByRole('button', { name: 'Fart' })).toHaveAttribute('data-testid', 'fart-button');
    expect(screen.getByTestId('history-button')).toHaveTextContent('History');
    expect(screen.queryByTestId('fab-main-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('opens the history sheet from the History button', () => {
    render(<PokeKissInterface />);
    expect(screen.queryByTestId('interaction-history-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('history-button'));

    expect(screen.getByTestId('interaction-history-modal')).toBeInTheDocument();
  });

  it('plays the unviewed interaction from the badge without opening history', () => {
    storeState.unviewedCount = 2;
    storeMocks.getUnviewedInteractions.mockReturnValue([
      {
        id: 'interaction-1',
        type: 'poke',
        fromUserId: 'partner',
        toUserId: 'me',
        viewed: false,
        createdAt: new Date(),
      },
    ]);

    render(<PokeKissInterface />);
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toHaveTextContent('2');
    expect(badge).toHaveAttribute('aria-label', '2 unviewed interactions');
    expect(screen.getByTestId('history-button')).toContainElement(badge);

    fireEvent.click(badge);

    expect(screen.getByTestId('poke-animation')).toBeInTheDocument();
    expect(screen.getByTestId('poke-animation').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
    expect(screen.queryByTestId('interaction-history-modal')).not.toBeInTheDocument();
  });

  it('disables a tile in cooldown and shows the remaining m:ss under its label', () => {
    localStorage.setItem('lastPokeTime', String(Date.now() - 60_000));

    render(<PokeKissInterface />);

    expect(screen.getByTestId('poke-button')).toBeDisabled();
    expect(screen.getByTestId('poke-cooldown').textContent).toMatch(/^2[89]:\d{2}$/);
    expect(screen.getByTestId('kiss-button')).toBeEnabled();
    expect(screen.queryByTestId('kiss-cooldown')).not.toBeInTheDocument();
  });

  it('sends toasts with no emoji', async () => {
    storeMocks.sendPoke.mockResolvedValue({ id: 'poke-1' });
    storeMocks.sendKiss.mockResolvedValue({ id: 'kiss-1' });

    render(<PokeKissInterface />);
    const toast = () => screen.getByTestId('toast-notification');

    fireEvent.click(screen.getByTestId('poke-button'));
    await waitFor(() => expect(toast()).toHaveTextContent('Poke sent!'));
    expect(toast().textContent).toBe('Poke sent!');

    fireEvent.click(screen.getByTestId('kiss-button'));
    await waitFor(() => expect(toast()).toHaveTextContent('Kiss sent!'));
    expect(toast().textContent).toBe('Kiss sent!');

    fireEvent.click(screen.getByTestId('fart-button'));
    await waitFor(() => expect(toast()).toHaveTextContent('Fart sent!'));
    expect(toast().textContent).toBe('Fart sent!');
    expect(toast().textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(screen.getByTestId('fart-animation').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });
});
