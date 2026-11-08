/**
 * usePartnerStreakListener — one subscriber on the shared partner channel while
 * the account is signed in and online. A `daily_pick` re-reads the streak and
 * the past questions; a `partner_linked` re-reads the streak, the partner and
 * the pending requests (not the history: a new partner id re-runs the page's
 * load effect); every SUBSCRIBED re-reads the streak and the past questions,
 * because a broadcast is never replayed.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('../../api/moodSyncService', () => ({
  moodSyncService: { subscribePartnerEvents: vi.fn() },
}));

const state = {
  userId: 'USER-A' as string | null,
  authSessionVersion: 0,
  syncStatus: { isOnline: true },
  loadCoupleStreak: vi.fn(async () => {}),
  loadDailyHistory: vi.fn(async () => {}),
  loadPartner: vi.fn(async () => {}),
  loadPendingRequests: vi.fn(async () => {}),
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import { moodSyncService } from '../../api/moodSyncService';
import { usePartnerStreakListener } from '../usePartnerStreakListener';

const subscribe = vi.mocked(moodSyncService.subscribePartnerEvents);
const DAY_ID = '00000000-0000-4000-8000-0000000000d1';

describe('usePartnerStreakListener', () => {
  let release: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    release = vi.fn<() => void>();
    subscribe.mockResolvedValue(release);
    Object.assign(state, {
      userId: 'USER-A',
      authSessionVersion: 0,
      syncStatus: { isOnline: true },
    });
  });

  it('holds one subscriber, with a handler for daily_pick, partner_linked and the status only', async () => {
    renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    const handlers = subscribe.mock.calls[0][0];
    expect(handlers.daily_pick).toBeTypeOf('function');
    expect(handlers.partner_linked).toBeTypeOf('function');
    expect(handlers.onStatus).toBeTypeOf('function');
    expect(handlers.new_mood).toBeUndefined();
    expect(handlers.dates_changed).toBeUndefined();
  });

  it('re-reads the streak and the past questions when a daily_pick arrives', async () => {
    renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => subscribe.mock.calls[0][0].daily_pick!({ event: 'daily_pick', day_id: DAY_ID }));

    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.loadDailyHistory).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('re-reads the streak, the partner and the requests when a partner_linked arrives', async () => {
    renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => subscribe.mock.calls[0][0].partner_linked!({ event: 'partner_linked' }));

    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).toHaveBeenCalledTimes(1);
    expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
    expect(state.loadDailyHistory).not.toHaveBeenCalled();
  });

  it('re-reads the streak and the past questions on every SUBSCRIBED, and on no other status', async () => {
    renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onStatus = subscribe.mock.calls[0][0].onStatus!;

    act(() => onStatus('SUBSCRIBED'));
    act(() => onStatus('SUBSCRIBED'));
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state.loadDailyHistory).toHaveBeenCalledTimes(2);

    for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) act(() => onStatus(status));
    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state.loadDailyHistory).toHaveBeenCalledTimes(2);
    expect(state.loadPartner).not.toHaveBeenCalled();
  });

  it('releases the subscriber on unmount', async () => {
    const { unmount } = renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(release).not.toHaveBeenCalled());

    unmount();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ignores events that arrive after unmount', async () => {
    const { unmount } = renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const handlers = subscribe.mock.calls[0][0];

    unmount();
    act(() => handlers.daily_pick!({ event: 'daily_pick', day_id: DAY_ID }));
    act(() => handlers.partner_linked!({ event: 'partner_linked' }));
    act(() => handlers.onStatus!('SUBSCRIBED'));

    expect(state.loadCoupleStreak).not.toHaveBeenCalled();
    expect(state.loadDailyHistory).not.toHaveBeenCalled();
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('releases a subscription that resolves after unmount', async () => {
    let resolve: (fn: () => void) => void = () => {};
    subscribe.mockReturnValue(new Promise((r) => (resolve = r)));

    const { unmount } = renderHook(() => usePartnerStreakListener());
    unmount();
    await act(async () => resolve(release));

    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the device is offline', { syncStatus: { isOnline: false } }],
    ['nobody is signed in', { userId: null }],
  ])('opens nothing while %s', async (_label, overrides) => {
    Object.assign(state, overrides);

    renderHook(() => usePartnerStreakListener());
    await Promise.resolve();

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('opens when the device comes back online, and releases when it goes offline', async () => {
    state.syncStatus = { isOnline: false };
    const { rerender } = renderHook(() => usePartnerStreakListener());
    await Promise.resolve();
    expect(subscribe).not.toHaveBeenCalled();

    state.syncStatus = { isOnline: true };
    rerender();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    state.syncStatus = { isOnline: false };
    rerender();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes for a new session: the topic belongs to the signed-in user', async () => {
    const { rerender } = renderHook(() => usePartnerStreakListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    state.authSessionVersion = 1;
    rerender();

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));
  });

  it('logs a failed subscribe and holds nothing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('no channel');
    subscribe.mockRejectedValue(failure);

    renderHook(() => usePartnerStreakListener());

    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith(
        '[usePartnerStreakListener] Could not listen for the streak:',
        failure
      )
    );
    consoleSpy.mockRestore();
  });
});
