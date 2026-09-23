/**
 * PartnerMoodView on the kit: the connected view's matrix rows.
 *
 * Several moods -> newest in "Feeling right now", the rest as Recent moods
 * rows; one mood -> the current card alone; no moods -> the empty-state card;
 * offline -> "Offline" subtitle, disabled refresh, offline notice.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoodEntry } from '../../../types';

vi.mock('../../../api/supabaseClient', () => ({ supabase: {} }));
vi.mock('../../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn(async () => () => {}) },
}));
vi.mock('../../PokeKissInterface', () => ({
  PokeKissInterface: () => <div data-testid="poke-kiss-interface" />,
}));
vi.mock('../../../stores/useAppStore', () => ({ useAppStore: () => state }));

import { moodSyncService } from '../../../api/moodSyncService';
import { PartnerMoodView } from '../PartnerMoodView';

const PARTNER_NAME = 'Harper';

function mood(overrides: Partial<MoodEntry>): MoodEntry {
  return {
    userId: '00000000-0000-4000-8000-000000000002',
    mood: 'happy',
    moods: ['happy'],
    date: '2026-09-12',
    timestamp: new Date('2026-09-12T10:00:00.000Z'),
    synced: true,
    ...overrides,
  };
}

// Fixed past dates (2020-09-12 was a Saturday), far from any "Today"/"Yesterday".
const SEVERAL: MoodEntry[] = [
  mood({
    mood: 'loved',
    moods: ['loved', 'sad'],
    note: 'Thinking of you',
    date: '2020-09-12',
    supabaseId: 'm1',
  }),
  mood({ mood: 'happy', moods: ['happy'], date: '2020-09-11', supabaseId: 'm2' }),
  mood({ mood: 'tired', moods: ['tired'], date: '2020-09-10', supabaseId: 'm3' }),
];

/** Today's local YYYY-MM-DD, the form MoodEntry.date carries. */
function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    partnerMoods: [] as MoodEntry[],
    fetchPartnerMoods: vi.fn(async () => {}),
    syncStatus: { isOnline: true },
    partner: { id: 'partner', email: 'partner@example.test', displayName: PARTNER_NAME },
    isLoadingPartner: false,
    sentRequests: [],
    receivedRequests: [],
    searchResults: [],
    isSearching: false,
    loadPartner: vi.fn(),
    loadPendingRequests: vi.fn(),
    searchUsers: vi.fn(),
    clearSearch: vi.fn(),
    sendPartnerRequest: vi.fn(),
    acceptPartnerRequest: vi.fn(),
    declinePartnerRequest: vi.fn(),
    ...overrides,
  };
}

let state = makeState();

describe('PartnerMoodView on the kit', () => {
  beforeEach(() => {
    cleanup();
    state = makeState();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('puts the newest mood in the current card and the rest in Recent moods', async () => {
    state = makeState({ partnerMoods: SEVERAL });
    render(<PartnerMoodView />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Harper$/);

    const cards = screen.getAllByTestId('partner-mood-card');
    expect(cards).toHaveLength(3);

    const current = cards[0];
    expect(current).toHaveTextContent('Feeling right now');
    expect(current).toHaveTextContent('Loved');
    expect(current).toHaveTextContent('Sad');
    expect(current).toHaveTextContent('Thinking of you');

    const list = screen.getByTestId('partner-mood-list');
    expect(list).not.toContainElement(current);
    const rows = within(list).getAllByTestId('partner-mood-card');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Happy');
    expect(rows[1]).toHaveTextContent('Tired');
    expect(screen.getByText('Recent moods')).toBeInTheDocument();

    // Row dates are "Thu 19 Mar"; the current card's is "Friday 20 March".
    expect(rows[0]).toHaveTextContent(/^Happy.*Fri 11 Sep · /);
    expect(current).toHaveTextContent(/Saturday 12 September · /);

    // The action tiles sit between the current card and Recent moods.
    const tiles = screen.getByTestId('poke-kiss-interface');
    expect(current.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tiles.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(await screen.findByTestId('partner-mood-refresh-button')).toBeEnabled();
  });

  it('shows only the current card for a single mood', () => {
    state = makeState({ partnerMoods: [SEVERAL[0]] });
    render(<PartnerMoodView />);

    expect(screen.getAllByTestId('partner-mood-card')).toHaveLength(1);
    expect(screen.getByText('Feeling right now')).toBeInTheDocument();
    expect(screen.queryByTestId('partner-mood-list')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent moods')).not.toBeInTheDocument();
  });

  it('shows the empty-state card and no current card when there are no moods', async () => {
    render(<PartnerMoodView />);

    expect(await screen.findByTestId('partner-mood-empty-state')).toHaveTextContent(
      'No moods yet'
    );
    expect(screen.queryByTestId('partner-mood-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-mood-list')).not.toBeInTheDocument();
  });

  it('reads Offline, disables refresh and shows the offline notice when offline', () => {
    state = makeState({ syncStatus: { isOnline: false }, partnerMoods: SEVERAL });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('realtime-connection-status')).toHaveTextContent(/^Offline$/);
    expect(screen.getByTestId('partner-mood-refresh-button')).toBeDisabled();
    expect(screen.getByTestId('partner-mood-offline-notice')).toHaveTextContent(
      "You're offline. Partner moods will load when you reconnect."
    );
  });

  it('keeps emoji out of the view chrome', () => {
    state = makeState({ partnerMoods: SEVERAL });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('partner-mood-view').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });

  it('labels a mood logged today as Today', () => {
    state = makeState({ partnerMoods: [mood({ date: todayISO(), supabaseId: 'today' })] });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('partner-mood-card')).toHaveTextContent(/Today · /);
  });

  it('maps the realtime status to Connected / Reconnecting / Disconnected', async () => {
    state = makeState({ partnerMoods: SEVERAL });
    render(<PartnerMoodView />);

    const subscribe = vi.mocked(moodSyncService.subscribeMoodUpdates);
    await waitFor(() => expect(subscribe).toHaveBeenCalled());
    const onStatus = subscribe.mock.calls[0][1];
    expect(onStatus).toBeTypeOf('function');
    const status = screen.getByTestId('realtime-connection-status');

    act(() => onStatus!('SUBSCRIBED'));
    expect(status).toHaveTextContent(/^Connected$/);

    act(() => onStatus!('TIMED_OUT'));
    expect(status).toHaveTextContent(/^Reconnecting$/);

    act(() => onStatus!('CHANNEL_ERROR'));
    expect(status).toHaveTextContent(/^Disconnected$/);
  });
});
