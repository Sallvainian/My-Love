/**
 * useDatesChangedListener: while the account is signed in, online and linked,
 * one subscriber on the shared mood channel waits for the partner's
 * dates-changed broadcast and re-reads the events and the anniversaries. It
 * holds nothing signed out, offline or unlinked, and lets go on unmount.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn() },
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

const subscribe = vi.mocked(moodSyncService.subscribeMoodUpdates);

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
    const onDatesChanged = subscribe.mock.calls[0][3];
    expect(onDatesChanged).toBeTypeOf('function');

    act(() => onDatesChanged!());

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
    const onDatesChanged = subscribe.mock.calls[0][3];
    await act(async () => {});

    hook.unmount();
    act(() => onDatesChanged!());

    expect(release).toHaveBeenCalledTimes(1);
    expect(state.loadEvents).not.toHaveBeenCalled();
  });
});
