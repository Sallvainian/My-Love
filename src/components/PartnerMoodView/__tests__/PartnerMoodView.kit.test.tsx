/**
 * PartnerMoodView on the kit: the connected view's matrix rows.
 *
 * Several moods -> newest in "Feeling right now", the rest as Recent moods
 * rows; one mood -> the current card alone; no moods -> the empty-state card;
 * offline -> "Offline" subtitle, disabled refresh; the offline notice only when
 * no moods are listed (a saved copy is shown without it).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const PARTNER_DISPLAY_NAME = 'Gracie';

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
    partner: { id: 'partner', email: 'partner@example.test', displayName: PARTNER_DISPLAY_NAME },
    isLoadingPartner: false,
    partnerLoadError: false,
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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Gracie$/);

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

  it('reads Offline, disables refresh and shows the offline notice when offline with no moods', async () => {
    let finishRead: () => void = () => {};
    state = makeState({
      syncStatus: { isOnline: false },
      fetchPartnerMoods: vi.fn(() => new Promise<void>((resolve) => (finishRead = resolve))),
    });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('realtime-connection-status')).toHaveTextContent(/^Offline$/);
    expect(screen.getByTestId('partner-mood-refresh-button')).toBeDisabled();
    // Not while the saved copy is still being read: it may fill the list.
    expect(screen.queryByTestId('partner-mood-offline-notice')).not.toBeInTheDocument();
    await act(async () => finishRead());
    expect(await screen.findByTestId('partner-mood-offline-notice')).toHaveTextContent(
      "You're offline. Partner moods will load when you reconnect."
    );
    expect(await screen.findByTestId('partner-mood-empty-state')).toBeInTheDocument();
  });

  it('offline with saved moods lists them without the offline notice or empty state', async () => {
    state = makeState({ syncStatus: { isOnline: false }, partnerMoods: SEVERAL });
    render(<PartnerMoodView />);

    // The saved copy is read offline too.
    await waitFor(() => expect(state.fetchPartnerMoods).toHaveBeenCalledWith(30));
    expect(screen.getByTestId('realtime-connection-status')).toHaveTextContent(/^Offline$/);
    expect(screen.getByTestId('partner-mood-refresh-button')).toBeDisabled();
    expect(screen.getAllByTestId('partner-mood-card').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('partner-mood-offline-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-mood-empty-state')).not.toBeInTheDocument();
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

  it('shows a load error, never the Connect UI, when the partner could not be determined', () => {
    // A failed read with no saved copy is not "unlinked".
    state = makeState({ partner: null, partnerLoadError: true });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('partner-load-error')).toHaveTextContent("Couldn't load your partner");
    expect(screen.queryByText('Connect with Your Partner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-search-card')).not.toBeInTheDocument();
  });

  it('shows the Connect UI when the server says there is no partner', () => {
    state = makeState({ partner: null, partnerLoadError: false });
    render(<PartnerMoodView />);

    expect(screen.getByText('Connect with Your Partner')).toBeInTheDocument();
    expect(screen.queryByTestId('partner-load-error')).not.toBeInTheDocument();
  });

  it('loads the partner offline too, but pending requests only online', () => {
    state = makeState({ syncStatus: { isOnline: false } });
    render(<PartnerMoodView />);

    expect(state.loadPartner).toHaveBeenCalled();
    expect(state.loadPendingRequests).not.toHaveBeenCalled();
  });

  it('online error card offers a retry that loads the partner again', () => {
    state = makeState({ partner: null, partnerLoadError: true });
    render(<PartnerMoodView />);
    expect(state.loadPartner).toHaveBeenCalledTimes(1); // the mount load

    fireEvent.click(screen.getByTestId('partner-load-retry'));

    expect(state.loadPartner).toHaveBeenCalledTimes(2);
  });

  it('offline error card has no retry button', () => {
    state = makeState({ partner: null, partnerLoadError: true, syncStatus: { isOnline: false } });
    render(<PartnerMoodView />);

    expect(screen.getByTestId('partner-load-error')).toHaveTextContent("You're offline");
    expect(screen.queryByTestId('partner-load-retry')).not.toBeInTheDocument();
  });

  // CAP-10: the pop-up names the partner from their own display name, never a
  // hard-coded one. 'Robin' is not any name the app ever shipped with.
  it.each([
    ['their display name', 'Robin', 'Robin just logged a mood'],
    ['"Your partner" without one', '', 'Your partner just logged a mood'],
  ])('names the partner in the realtime pop-up with %s', async (_label, displayName, expected) => {
    state = makeState({
      partnerMoods: SEVERAL,
      partner: { id: 'partner', email: 'partner@example.test', displayName },
    });
    render(<PartnerMoodView />);

    const subscribe = vi.mocked(moodSyncService.subscribeMoodUpdates);
    await waitFor(() => expect(subscribe).toHaveBeenCalled());
    const onMood = subscribe.mock.calls[0][0];
    act(() =>
      onMood({ mood_type: 'happy', note: null } as unknown as Parameters<typeof onMood>[0])
    );

    const popup = screen.getByTestId('partner-mood-notification');
    expect(popup).toHaveTextContent(expected);
    expect(popup).not.toHaveTextContent(PARTNER_DISPLAY_NAME);
  });
});
