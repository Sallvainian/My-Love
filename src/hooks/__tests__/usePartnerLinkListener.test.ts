/**
 * usePartnerLinkListener: while the account is signed in, online and settled
 * unlinked, one subscriber on the shared mood channel waits for the
 * partner-linked broadcast and re-reads the partner and the requests. It holds
 * nothing once a partner is in the store, or while a partner load is deciding.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn() },
}));

const state = {
  userId: 'USER-A' as string | null,
  syncStatus: { isOnline: true },
  partner: null as { id: string } | null,
  isLoadingPartner: false,
  partnerLoadError: false,
  loadPartner: vi.fn(async () => {}),
  loadPendingRequests: vi.fn(async () => {}),
};

vi.mock('../../stores/useAppStore', () => {
  const useAppStore = (selector: (s: typeof state) => unknown) => selector(state);
  useAppStore.getState = () => state;
  return { useAppStore };
});

import { moodSyncService } from '../../api/moodSyncService';
import { usePartnerLinkListener } from '../usePartnerLinkListener';

const subscribe = vi.mocked(moodSyncService.subscribeMoodUpdates);

describe('usePartnerLinkListener', () => {
  let release: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    release = vi.fn<() => void>();
    subscribe.mockResolvedValue(release);
    Object.assign(state, {
      userId: 'USER-A',
      syncStatus: { isOnline: true },
      partner: null,
      isLoadingPartner: false,
      partnerLoadError: false,
    });
  });

  it('re-reads the partner and the requests when the partner-linked broadcast arrives', async () => {
    renderHook(() => usePartnerLinkListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onPartnerLinked = subscribe.mock.calls[0][2];
    expect(onPartnerLinked).toBeTypeOf('function');

    act(() => onPartnerLinked!());

    expect(state.loadPartner).toHaveBeenCalledTimes(1);
    expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('releases its subscriber once a partner is in the store', async () => {
    const { rerender } = renderHook(() => usePartnerLinkListener());
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(release).not.toHaveBeenCalled());

    state.partner = { id: 'PARTNER' };
    rerender();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a partner is in the store', { partner: { id: 'PARTNER' } }],
    ['a partner load is deciding', { isLoadingPartner: true }],
    ['the partner could not be determined', { partnerLoadError: true }],
    ['the device is offline', { syncStatus: { isOnline: false } }],
    ['nobody is signed in', { userId: null }],
  ])('opens nothing while %s', async (_label, overrides) => {
    Object.assign(state, overrides);

    renderHook(() => usePartnerLinkListener());
    await Promise.resolve();

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('releases a subscription that resolves after unmount', async () => {
    let resolve: (fn: () => void) => void = () => {};
    subscribe.mockReturnValue(new Promise((r) => (resolve = r)));

    const { unmount } = renderHook(() => usePartnerLinkListener());
    unmount();
    await act(async () => resolve(release));

    expect(release).toHaveBeenCalledTimes(1);
  });
});
