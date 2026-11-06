/**
 * useDatesChangedListener: while the account is signed in, online and linked,
 * one subscriber on the shared mood channel waits for the partner's
 * dates-changed broadcast and re-reads the events and the anniversaries. It
 * holds nothing signed out, offline or unlinked, and lets go on unmount.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../api/moodSyncService', () => ({
  moodSyncService: { subscribePartnerEvents: vi.fn() },
}));

const state = {
  userId: 'USER-A' as string | null,
  authSessionVersion: 0,
  syncStatus: { isOnline: true },
  partner: { id: 'PARTNER-B' } as { id: string } | null,
  loadEvents: vi.fn(async () => ({ status: 'success' as const })),
  loadAnniversariesFromServer: vi.fn(async () => true),
};

vi.mock('../../stores/useAppStore', () => {
  const useAppStore = (selector: (s: typeof state) => unknown) => selector(state);
  useAppStore.getState = () => state;
  return { useAppStore };
});

import { moodSyncService } from '../../api/moodSyncService';
import { useDatesChangedListener } from '../useDatesChangedListener';

const subscribe = vi.mocked(moodSyncService.subscribePartnerEvents);

describe('useDatesChangedListener', () => {
  let release: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    release = vi.fn<() => void>();
    subscribe.mockResolvedValue(release);
    Object.assign(state, {
      userId: 'USER-A',
      authSessionVersion: 0,
      syncStatus: { isOnline: true },
      partner: { id: 'PARTNER-B' },
    });
  });

  it('re-reads the events and the anniversaries when the partner changes a date', async () => {
    renderHook(() => useDatesChangedListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onDatesChanged = subscribe.mock.calls[0][0].dates_changed;
    expect(onDatesChanged).toBeTypeOf('function');

    act(() => onDatesChanged!({ event: 'dates_changed' }));

    expect(state.loadEvents).toHaveBeenCalledTimes(1);
    expect(state.loadAnniversariesFromServer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['signed out', { userId: null }],
    ['offline', { syncStatus: { isOnline: false } }],
    ['unlinked', { partner: null }],
  ])('holds no subscriber %s', async (_name, overrides) => {
    Object.assign(state, overrides);
    renderHook(() => useDatesChangedListener());
    await act(async () => {});

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('lets go of the channel on unmount and ignores a late broadcast', async () => {
    const hook = renderHook(() => useDatesChangedListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onDatesChanged = subscribe.mock.calls[0][0].dates_changed;
    await act(async () => {});

    hook.unmount();
    act(() => onDatesChanged!({ event: 'dates_changed' }));

    expect(release).toHaveBeenCalledTimes(1);
    expect(state.loadEvents).not.toHaveBeenCalled();
  });
});

describe('useDatesChangedListener: what the broadcast cannot reach', () => {
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.clearAllMocks();
    subscribe.mockResolvedValue(vi.fn());
    Object.assign(state, {
      userId: 'USER-A',
      authSessionVersion: 0,
      syncStatus: { isOnline: true },
      partner: { id: 'PARTNER-B' },
    });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  const comeBack = () => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('re-reads both lists when the app comes back to the front, at most every 30 seconds', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000_000);
    const hook = renderHook(() => useDatesChangedListener());
    await act(async () => {});

    act(() => comeBack());
    expect(state.loadEvents).toHaveBeenCalledTimes(1);
    expect(state.loadAnniversariesFromServer).toHaveBeenCalledTimes(1);

    now.mockReturnValue(10_000_000 + 10_000);
    act(() => comeBack());
    expect(state.loadEvents).toHaveBeenCalledTimes(1);

    now.mockReturnValue(10_000_000 + 31_000);
    act(() => comeBack());
    expect(state.loadEvents).toHaveBeenCalledTimes(2);
    expect(state.loadAnniversariesFromServer).toHaveBeenCalledTimes(2);

    hook.unmount();
    now.mockRestore();
  });

  it('re-reads on a return to the front when not linked too, and not when signed out', async () => {
    Object.assign(state, { partner: null });
    const linkedOff = renderHook(() => useDatesChangedListener());
    await act(async () => {});
    act(() => comeBack());
    expect(state.loadEvents).toHaveBeenCalledTimes(1);
    linkedOff.unmount();

    vi.clearAllMocks();
    Object.assign(state, { userId: null });
    const signedOut = renderHook(() => useDatesChangedListener());
    await act(async () => {});
    act(() => comeBack());
    expect(state.loadEvents).not.toHaveBeenCalled();
    signedOut.unmount();
  });

  it('re-reads on a Realtime re-join, not on the first join', async () => {
    const hook = renderHook(() => useDatesChangedListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onStatus = subscribe.mock.calls[0][0].onStatus!;

    act(() => onStatus('SUBSCRIBED'));
    expect(state.loadEvents).not.toHaveBeenCalled();

    act(() => onStatus('CHANNEL_ERROR'));
    act(() => onStatus('SUBSCRIBED'));
    expect(state.loadEvents).toHaveBeenCalledTimes(1);
    expect(state.loadAnniversariesFromServer).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});
