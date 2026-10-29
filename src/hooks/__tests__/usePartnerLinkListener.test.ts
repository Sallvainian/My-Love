/**
 * usePartnerLinkListener: while the account is signed in, online and holds no
 * partner after its first partner load settled, one subscriber on the shared
 * mood channel waits for the partner-linked broadcast and re-reads the partner
 * and the requests. Each SUBSCRIBED asks the server whether a link was missed.
 * It holds nothing once a partner is in the store, before the first partner
 * load settles, or when the partner could not be determined.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn() },
}));

vi.mock('../../api/supabaseClient', () => ({
  resolvePartnerLookupForDelivery: vi.fn(),
}));

const state = {
  userId: 'USER-A' as string | null,
  authSessionVersion: 0,
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
import { resolvePartnerLookupForDelivery } from '../../api/supabaseClient';
import { usePartnerLinkListener } from '../usePartnerLinkListener';

const subscribe = vi.mocked(moodSyncService.subscribeMoodUpdates);
const lookup = vi.mocked(resolvePartnerLookupForDelivery);

/** Mount, then run the signed-in start's first partner load to an unlinked answer. */
function renderSettled() {
  state.isLoadingPartner = true;
  const hook = renderHook(() => usePartnerLinkListener());
  state.isLoadingPartner = false;
  hook.rerender();
  return hook;
}

describe('usePartnerLinkListener', () => {
  let release: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    release = vi.fn<() => void>();
    subscribe.mockResolvedValue(release);
    lookup.mockResolvedValue({ status: 'unlinked' });
    Object.assign(state, {
      userId: 'USER-A',
      authSessionVersion: 0,
      syncStatus: { isOnline: true },
      partner: null,
      isLoadingPartner: false,
      partnerLoadError: false,
    });
  });

  it('re-reads the partner and the requests when the partner-linked broadcast arrives', async () => {
    renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onPartnerLinked = subscribe.mock.calls[0][2];
    expect(onPartnerLinked).toBeTypeOf('function');

    act(() => onPartnerLinked!());

    expect(state.loadPartner).toHaveBeenCalledTimes(1);
    expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('re-reads the partner when a SUBSCRIBED finds the account linked', async () => {
    lookup.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const onStatusChange = subscribe.mock.calls[0][1];
    expect(onStatusChange).toBeTypeOf('function');

    await act(async () => onStatusChange!('SUBSCRIBED'));

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).toHaveBeenCalledTimes(1);
    expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['answers unlinked', { status: 'unlinked' as const }],
    ['fails', { status: 'error' as const, reason: 'boom' }],
  ])('leaves the partner alone when the SUBSCRIBED lookup %s', async (_label, answer) => {
    lookup.mockResolvedValue(answer);
    renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => subscribe.mock.calls[0][1]!('SUBSCRIBED'));

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('asks nothing on %s', async (status) => {
    lookup.mockResolvedValue({ status: 'linked', partnerId: 'PARTNER' });
    renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    await act(async () => subscribe.mock.calls[0][1]!(status));

    expect(lookup).not.toHaveBeenCalled();
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('keeps its subscriber through a later partner load', async () => {
    const { rerender } = renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    state.isLoadingPartner = true;
    rerender();
    state.isLoadingPartner = false;
    rerender();

    expect(release).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('releases its subscriber once a partner is in the store', async () => {
    const { rerender } = renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(release).not.toHaveBeenCalled());

    state.partner = { id: 'PARTNER' };
    rerender();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('opens nothing before the first partner load has started', async () => {
    renderHook(() => usePartnerLinkListener());
    await Promise.resolve();

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('waits for a new session to settle its own first partner load', async () => {
    const { rerender } = renderSettled();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    state.authSessionVersion = 1;
    rerender();

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(subscribe).toHaveBeenCalledTimes(1);
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

    const { unmount } = renderSettled();
    unmount();
    await act(async () => resolve(release));

    expect(release).toHaveBeenCalledTimes(1);
  });
});
