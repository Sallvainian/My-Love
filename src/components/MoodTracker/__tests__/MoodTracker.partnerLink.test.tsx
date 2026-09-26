/**
 * MoodTracker's partner mood card appears when a partner is linked while the
 * Mood screen is open. The partner id used to be looked up once on mount, so a
 * link made meanwhile (this device accepted, or the sender heard the
 * partner-linked broadcast) stayed invisible until a remount.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupPartnerId = vi.fn();

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
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
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
  });

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
});
