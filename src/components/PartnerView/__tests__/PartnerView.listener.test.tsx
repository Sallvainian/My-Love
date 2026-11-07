/**
 * PartnerView with the real usePartnerStreakListener: only the registry's
 * `subscribePartnerEvents` is mocked, and its handlers are captured and fired.
 * SUBSCRIBED, partner_linked and daily_pick re-read; new_mood and dates_changed
 * are not this page's events and read nothing extra.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/moodSyncService', () => ({
  moodSyncService: { subscribePartnerEvents: vi.fn() },
}));
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
}));

import { moodSyncService } from '../../../api/moodSyncService';
import { PartnerView } from '../PartnerView';

const subscribe = vi.mocked(moodSyncService.subscribePartnerEvents);

function makeState() {
  return {
    userId: 'USER-A',
    authSessionVersion: 0,
    partner: null,
    isLoadingPartner: false,
    partnerLoadError: false,
    syncStatus: { isOnline: true },
    loadPartner: vi.fn(async () => {}),
    loadPendingRequests: vi.fn(async () => {}),
    sentRequests: [],
    receivedRequests: [],
    searchResult: null,
    isSearching: false,
    searchUsers: vi.fn(),
    clearSearch: vi.fn(),
    sendPartnerRequest: vi.fn(),
    acceptPartnerRequest: vi.fn(),
    declinePartnerRequest: vi.fn(),
    coupleStreak: null,
    coupleStreakLoading: false,
    coupleStreakError: null,
    loadCoupleStreak: vi.fn(async () => {}),
  };
}

let state = makeState();

/** Mount the page and return the handlers the listener registered. */
async function mount() {
  render(<PartnerView />);
  await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
  const handlers = subscribe.mock.calls[0][0];
  // The mount's own reads are not what is being counted.
  state.loadCoupleStreak.mockClear();
  state.loadPartner.mockClear();
  state.loadPendingRequests.mockClear();
  return handlers;
}

describe('PartnerView re-reading through the real listener', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    subscribe.mockResolvedValue(() => {});
    state = makeState();
  });

  it('SUBSCRIBED re-reads the streak only', async () => {
    const handlers = await mount();

    act(() => handlers.onStatus!('SUBSCRIBED'));

    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('partner_linked re-reads the streak, the partner and the pending requests', async () => {
    const handlers = await mount();

    act(() => handlers.partner_linked!({ event: 'partner_linked' }));

    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).toHaveBeenCalledTimes(1);
    expect(state.loadPendingRequests).toHaveBeenCalledTimes(1);
  });

  it('daily_pick re-reads the streak only', async () => {
    const handlers = await mount();

    act(() => handlers.daily_pick!({ event: 'daily_pick', day_id: 'DAY-1' }));

    expect(state.loadCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('new_mood and dates_changed read nothing extra', async () => {
    const handlers = await mount();

    act(() => {
      handlers.new_mood?.({ event: 'new_mood' } as never);
      handlers.dates_changed?.({ event: 'dates_changed' } as never);
    });

    expect(handlers.new_mood).toBeUndefined();
    expect(handlers.dates_changed).toBeUndefined();
    expect(state.loadCoupleStreak).not.toHaveBeenCalled();
    expect(state.loadPartner).not.toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });
});
