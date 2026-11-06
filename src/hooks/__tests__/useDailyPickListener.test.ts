/**
 * useDailyPickListener — one subscriber on the shared partner channel while
 * the account is signed in and online. A `daily_pick` re-reads the named day;
 * every SUBSCRIBED re-reads today's, because a broadcast is never replayed.
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
  loadDailyDay: vi.fn(async () => {}),
  refreshDailyDay: vi.fn(async (_dayId: string) => {}),
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import { moodSyncService } from '../../api/moodSyncService';
import { useDailyPickListener } from '../useDailyPickListener';

const subscribe = vi.mocked(moodSyncService.subscribePartnerEvents);
const DAY_ID = '00000000-0000-4000-8000-0000000000d1';

describe('useDailyPickListener', () => {
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

  it('holds one subscriber, with a handler for daily_pick and for the status', async () => {
    renderHook(() => useDailyPickListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    const handlers = subscribe.mock.calls[0][0];
    expect(handlers.daily_pick).toBeTypeOf('function');
    expect(handlers.onStatus).toBeTypeOf('function');
    expect(handlers.new_mood).toBeUndefined();
    expect(handlers.partner_linked).toBeUndefined();
  });

  it('re-reads the named day when a daily_pick arrives', async () => {
    renderHook(() => useDailyPickListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    act(() => subscribe.mock.calls[0][0].daily_pick!({ event: 'daily_pick', day_id: DAY_ID }));

    expect(state.refreshDailyDay).toHaveBeenCalledTimes(1);
    expect(state.refreshDailyDay).toHaveBeenCalledWith(DAY_ID);
    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('re-reads today on every SUBSCRIBED, and on nothing else', async () => {
    renderHook(() => useDailyPickListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onStatus = subscribe.mock.calls[0][0].onStatus!;

    act(() => onStatus('SUBSCRIBED'));
    act(() => onStatus('SUBSCRIBED'));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);

    for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) act(() => onStatus(status));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
    expect(state.refreshDailyDay).not.toHaveBeenCalled();
  });

  it('releases the subscriber on unmount', async () => {
    const { unmount } = renderHook(() => useDailyPickListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(release).not.toHaveBeenCalled());

    unmount();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ignores events that arrive after unmount', async () => {
    const { unmount } = renderHook(() => useDailyPickListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const handlers = subscribe.mock.calls[0][0];

    unmount();
    act(() => handlers.daily_pick!({ event: 'daily_pick', day_id: DAY_ID }));
    act(() => handlers.onStatus!('SUBSCRIBED'));

    expect(state.refreshDailyDay).not.toHaveBeenCalled();
    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('releases a subscription that resolves after unmount', async () => {
    let resolve: (fn: () => void) => void = () => {};
    subscribe.mockReturnValue(new Promise((r) => (resolve = r)));

    const { unmount } = renderHook(() => useDailyPickListener());
    unmount();
    await act(async () => resolve(release));

    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the device is offline', { syncStatus: { isOnline: false } }],
    ['nobody is signed in', { userId: null }],
  ])('opens nothing while %s', async (_label, overrides) => {
    Object.assign(state, overrides);

    renderHook(() => useDailyPickListener());
    await Promise.resolve();

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('opens when the device comes back online, and releases when it goes offline', async () => {
    state.syncStatus = { isOnline: false };
    const { rerender } = renderHook(() => useDailyPickListener());
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
    const { rerender } = renderHook(() => useDailyPickListener());
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

    renderHook(() => useDailyPickListener());

    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useDailyPickListener] Could not listen for a partner pick:',
        failure
      )
    );
    consoleSpy.mockRestore();
  });
});
