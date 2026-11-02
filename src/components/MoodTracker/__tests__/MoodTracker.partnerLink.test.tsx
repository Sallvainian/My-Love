/**
 * MoodTracker's partner mood card appears when a partner is linked while the
 * Mood screen is open. The partner id used to be looked up once on mount, so a
 * link made meanwhile (this device accepted, or the sender heard the
 * partner-linked broadcast) stayed invisible until a remount. It is also looked
 * up again when the user's session renews, which recovers a boot whose first
 * lookup failed on a stored session the SDK could not use.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupPartnerId = vi.fn();

type AuthListener = (event: string, session: { user: { id: string } } | null) => void;
let authListener: AuthListener | null = null;
const unsubscribe = vi.fn(() => {
  authListener = null;
});
const onAuthStateChange = vi.fn((listener: AuthListener) => {
  authListener = listener;
  return { data: { subscription: { unsubscribe } } };
});

const storeState = {
  addMoodEntry: vi.fn(),
  getMoodForDate: vi.fn(() => undefined),
  syncStatus: { pendingMoods: 0, isOnline: true, lastSyncAt: undefined, isSyncing: false },
  loadMoods: vi.fn(),
  syncPendingMoods: vi.fn(),
  updateSyncStatus: vi.fn(),
  moods: [],
  partner: null as { id: string } | null,
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'USER-A-ID' } }),
}));
vi.mock('../../../api/supabaseClient', () => ({
  lookupPartnerId: () => lookupPartnerId(),
  supabase: {
    from: vi.fn(),
    auth: { onAuthStateChange: (listener: AuthListener) => onAuthStateChange(listener) },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));
vi.mock('../../../utils/backgroundSync', () => ({ registerBackgroundSync: vi.fn() }));
vi.mock('../MoodHistoryTimeline', () => ({ MoodHistoryTimeline: () => null }));
vi.mock('../PartnerMoodDisplay', () => ({
  PartnerMoodDisplay: ({ partnerId }: { partnerId: string }) => (
    <div data-testid="partner-mood">{partnerId}</div>
  ),
}));
vi.mock('../../MoodHistory', () => ({ MoodHistoryCalendar: () => null }));

import { MoodTracker } from '../MoodTracker';

describe('MoodTracker partner card after a link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.partner = null;
    authListener = null;
  });

  /** Fires an auth event as auth-js would, then lets the deferred lookup run. */
  async function emit(event: string, userId: string) {
    await act(async () => {
      authListener!(event, { user: { id: userId } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('looks the partner up again when the store learns of one', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    const { rerender } = render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('partner-mood')).not.toBeInTheDocument();

    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    storeState.partner = { id: 'PARTNER' };
    await act(async () => rerender(<MoodTracker />));

    expect(await screen.findByTestId('partner-mood')).toHaveTextContent('PARTNER');
  });

  it('keeps a shown partner when a later lookup fails', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    const { rerender } = render(<MoodTracker />);
    expect(await screen.findByTestId('partner-mood')).toHaveTextContent('PARTNER');

    lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'network down' });
    storeState.partner = { id: 'PARTNER' };
    await act(async () => rerender(<MoodTracker />));
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('partner-mood')).toHaveTextContent('PARTNER');
  });

  it('mounts the card when a renewal lookup succeeds after the mount lookup failed', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'expired token' });
    render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('partner-mood')).not.toBeInTheDocument();

    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    await emit('TOKEN_REFRESHED', 'USER-A-ID');

    expect(await screen.findByTestId('partner-mood')).toHaveTextContent('PARTNER');
    expect(lookupPartnerId).toHaveBeenCalledTimes(2);
  });

  it('keeps a shown card when the renewal lookup fails', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    render(<MoodTracker />);
    expect(await screen.findByTestId('partner-mood')).toHaveTextContent('PARTNER');

    lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'network down' });
    await emit('TOKEN_REFRESHED', 'USER-A-ID');

    expect(lookupPartnerId).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('partner-mood')).toHaveTextContent('PARTNER');
  });

  it('removes the card when the renewal lookup says unlinked', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    render(<MoodTracker />);
    expect(await screen.findByTestId('partner-mood')).toHaveTextContent('PARTNER');

    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    await emit('TOKEN_REFRESHED', 'USER-A-ID');

    await waitFor(() => expect(screen.queryByTestId('partner-mood')).not.toBeInTheDocument());
  });

  it('ignores a renewal for another user and other events for this one', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));

    await emit('TOKEN_REFRESHED', 'USER-B-ID');
    await emit('SIGNED_IN', 'USER-A-ID');

    expect(lookupPartnerId).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount and cancels a lookup a renewal had scheduled', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    const { unmount } = render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));

    // The renewal's lookup is deferred to the next task; unmount before it runs.
    act(() => authListener!('TOKEN_REFRESHED', { user: { id: 'USER-A-ID' } }));
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(lookupPartnerId).toHaveBeenCalledTimes(1);
  });

  it('starts no lookup when a listener auth-js already collected fires after unmount', async () => {
    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    const { unmount } = render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));
    const listener = authListener!;

    unmount();
    act(() => listener('TOKEN_REFRESHED', { user: { id: 'USER-A-ID' } }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(lookupPartnerId).toHaveBeenCalledTimes(1);
  });

  it('lets the newer answer stand when an older lookup resolves last', async () => {
    let resolveMount!: (value: unknown) => void;
    lookupPartnerId.mockReturnValueOnce(new Promise((resolve) => (resolveMount = resolve)));
    render(<MoodTracker />);
    await waitFor(() => expect(lookupPartnerId).toHaveBeenCalledTimes(1));

    lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
    await emit('TOKEN_REFRESHED', 'USER-A-ID');
    expect(lookupPartnerId).toHaveBeenCalledTimes(2);

    await act(async () => resolveMount({ status: 'linked', partnerId: 'PARTNER' }));

    expect(screen.queryByTestId('partner-mood')).not.toBeInTheDocument();
  });
});
