/**
 * MoodTracker must recount pending moods once auth has resolved
 *
 * `updateSyncStatus` counts nothing while `userId` is null — that scoping is
 * deliberate, because the unscoped read it replaced badged the PREVIOUS
 * account's pending moods on a shared device. But `authSlice` is not persisted,
 * so `userId` really is null on every cold start, and App.tsx's unconditional
 * call (`App.tsx:344`, an effect with stable store-selector deps) fires exactly
 * once, right there in that window.
 *
 * Every other trigger needs the network or a connectivity transition:
 * `App.tsx:324` is the `online` listener, `:336` the `offline` listener, `:356`
 * is gated on `isOnline && session`, and `:402` waits on the service worker
 * reporting a completed background sync.
 *
 * So the one state where the "(N pending sync)" badge is the user's only signal
 * that their moods have not left the device — offline — is exactly the state
 * where nothing recomputed it. This mount effect is the correction: MoodTracker
 * mounts post-auth.
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateSyncStatus = vi.fn();
const loadMoods = vi.fn();

const storeState = {
  addMoodEntry: vi.fn(),
  getMoodForDate: vi.fn(() => undefined),
  syncStatus: { pendingMoods: 0, isOnline: false, lastSyncAt: undefined, isSyncing: false },
  loadMoods,
  syncPendingMoods: vi.fn(),
  updateSyncStatus,
  moods: [],
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'USER-A-ID' } }),
}));

vi.mock('../../../api/supabaseClient', () => ({
  getPartnerId: vi.fn().mockResolvedValue(null),
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
}));

vi.mock('../../../utils/backgroundSync', () => ({
  registerBackgroundSync: vi.fn(),
}));

// The history views pull in react-window and their own data hooks, and none of
// that is what this file is about.
vi.mock('../MoodHistoryTimeline', () => ({
  MoodHistoryTimeline: () => <div data-testid="timeline" />,
}));
vi.mock('../PartnerMoodDisplay', () => ({
  PartnerMoodDisplay: () => <div data-testid="partner-mood" />,
}));
vi.mock('../../MoodHistory', () => ({
  MoodHistoryCalendar: () => <div data-testid="calendar" />,
}));

import { MoodTracker } from '../MoodTracker';

describe('MoodTracker pending-sync badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recounts pending moods on mount, where the signed-in user is known', () => {
    render(<MoodTracker />);

    // Without this the badge reads zero for the whole offline session, which is
    // a straight downgrade from the unscoped count it replaced.
    expect(updateSyncStatus).toHaveBeenCalled();
  });

  it('still loads moods on mount', () => {
    render(<MoodTracker />);

    expect(loadMoods).toHaveBeenCalled();
  });
});
