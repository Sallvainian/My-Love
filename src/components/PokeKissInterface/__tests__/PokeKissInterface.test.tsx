import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionSubscriptionStatus } from '../../../api/interactionService';

const storeMocks = vi.hoisted(() => ({
  sendPoke: vi.fn(),
  sendKiss: vi.fn(),
  getUnviewedInteractions: vi.fn(() => []),
  markInteractionViewed: vi.fn(),
  subscribeToInteractions: vi.fn(),
}));

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: () => ({
    ...storeMocks,
    unviewedCount: 0,
  }),
}));

vi.mock('../../../api/supabaseClient', () => ({
  getPartnerId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../InteractionHistory', () => ({
  InteractionHistory: () => null,
}));

import { PokeKissInterface } from '../PokeKissInterface';

describe('PokeKissInterface interaction subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

    fireEvent.click(screen.getByTestId('fab-main-button'));
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
