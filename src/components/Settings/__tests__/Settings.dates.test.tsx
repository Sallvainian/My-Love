/**
 * Settings > Dates: the top page's Dates row and the Dates list
 * (`/settings/dates`) with its groups, values, targets, `Load more` and Error
 * box.
 *
 * The real store and the real Settings stack are mounted; each case sets the
 * slices the page reads (events, couple settings, anniversaries, profile,
 * partner) with `useAppStore.setState`, and `loadEvents` / `loadMoreEvents`
 * are stubs on the store. Only the Supabase client and the profile read are
 * faked, as the other Settings page tests do.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';
import type { CoupleEvent, EventsPagination } from '../../../services/eventsService';
import type { CoupleSettings } from '../../../stores/slices/datesSlice';
import type { Anniversary } from '../../../types';

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../api/authService', () => ({ authService: { signOut: vi.fn() } }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../AnniversarySettings', () => ({ AnniversarySettings: () => null }));
vi.mock('../EventsSettings', () => ({ EventsSettings: () => null }));

import { offlineMessage } from '../../../services/accountDataError';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';
import { formatListDate } from '../settingsFields';
import { onPopState } from './settingsStackKit';

const PARTNER: PartnerInfo = {
  id: 'partner-1',
  email: 'harper@example.com',
  displayName: 'Harper',
  linkedSince: null,
  birthday: '1991-04-04',
};

type LinkedSettings = Extract<CoupleSettings, { status: 'linked' }>;

const LINKED: LinkedSettings = {
  status: 'linked',
  partnerId: 'partner-1',
  relationshipStart: '2022-02-03T12:00:00.000Z',
  weddingDate: '2024-06-15',
};

const pagination = (past: boolean, upcoming = false): EventsPagination => ({
  todayISO: '2026-11-03',
  upcoming: { hasMore: upcoming, cursor: null },
  past: { hasMore: past, cursor: null },
});

/** A local-calendar date `days` from today. */
function dayFromToday(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
}

function makeEvent(id: string, overrides: Partial<CoupleEvent> = {}): CoupleEvent {
  return {
    id,
    userId: selfId,
    label: `Event ${id}`,
    date: dayFromToday(10),
    createdAt: new Date(2026, 0, 1),
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

let accountCounter = 0;
let selfId = '';
const original = {
  loadEvents: useAppStore.getState().loadEvents,
  loadMoreEvents: useAppStore.getState().loadMoreEvents,
};
const loadEvents = vi.fn();
const loadMoreEvents = vi.fn();

/** Puts the slices the page reads in a state; anything left out stays at rest. */
function setDates(state: {
  events?: CoupleEvent[];
  eventsPagination?: EventsPagination | null;
  coupleSettings?: CoupleSettings | null;
  anniversaries?: Anniversary[];
  ownBirthday?: string | null | 'unloaded';
  partner?: PartnerInfo | null;
  partnerKnown?: boolean;
  partnerLoadError?: boolean;
}) {
  const { ownBirthday = null, anniversaries = [], ...rest } = state;
  // Settings re-reads the profile when it opens, so the read answers what the case set.
  backend.fetchOwnProfile.mockImplementation(() =>
    ownBirthday === 'unloaded'
      ? Promise.reject(new Error('profile unavailable'))
      : Promise.resolve({ displayName: 'Casey', birthday: ownBirthday })
  );
  act(() => {
    useAppStore.setState({
      events: [],
      eventsPagination: pagination(false),
      coupleSettings: LINKED,
      partner: PARTNER,
      partnerKnown: true,
      partnerLoadError: false,
      settings: { relationship: { anniversaries } },
      ownProfile: ownBirthday === 'unloaded' ? null : { displayName: 'Casey', birthday: ownBirthday },
      ...rest,
    });
  });
}

async function renderSettings() {
  window.history.replaceState(null, '', '/');
  useAppStore.getState().setView('settings');
  render(<Settings />);
  await waitFor(() => expect(backend.fetchOwnProfile).toHaveBeenCalled());
}

async function openDates(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('settings-dates-row'));
  expect(await screen.findByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
}

const sectionHeadings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const rowAt = (id: string) => screen.getByTestId(`settings-dates-${id}`);
const targetOf = (id: string) => rowAt(id).getAttribute('data-settings-target');

describe('Settings > Dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Casey', birthday: null });
    loadEvents.mockResolvedValue({ status: 'success' });
    loadMoreEvents.mockResolvedValue({ status: 'success' });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    accountCounter += 1;
    // A fresh account per case, so no earlier case's saved profile copy answers for this one.
    selfId = `user-self-${accountCounter}`;
    useAppStore.setState({
      userId: selfId,
      authSessionVersion: accountCounter,
      currentView: 'settings',
      settingsPath: '',
      loadEvents,
      loadMoreEvents,
      eventsIsLoading: false,
      eventsIsLoadingMore: false,
      syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true },
    });
    setDates({});
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({
      userId: null,
      ownProfile: null,
      currentView: 'home',
      settingsPath: '',
      partner: null,
      partnerKnown: false,
      partnerLoadError: false,
      coupleSettings: null,
      events: [],
      eventsPagination: null,
      eventsIsLoading: false,
      eventsIsLoadingMore: false,
      settings: null,
      loadEvents: original.loadEvents,
      loadMoreEvents: original.loadMoreEvents,
    });
  });

  describe('the top page', () => {
    it('puts Dates after Partner in the Partner group, with a label and a chevron and no value', async () => {
      await renderSettings();

      const group = screen.getByTestId('settings-partner-row').closest('section')!;
      const rows = within(group).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-partner-row',
        'settings-dates-row',
      ]);
      const row = screen.getByTestId('settings-dates-row');
      expect(row).toHaveTextContent(/^Dates$/);
      expect(row).toHaveAccessibleName('Dates');
      // The chevron is the row button's own last child; the tile's icon is inside a span.
      expect(row.lastElementChild?.tagName.toLowerCase()).toBe('svg');
    });

    it('adds no section heading', async () => {
      await renderSettings();

      expect(sectionHeadings()).not.toContain('Dates');
    });

    it('opens the large-title Dates list at /settings/dates', async () => {
      const user = userEvent.setup();
      await renderSettings();

      await openDates(user);

      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('stays on the Dates list after a reload', async () => {
      window.history.replaceState(null, '', '/settings/dates');
      useAppStore.setState({ settingsPath: 'dates' });
      render(<Settings />);

      expect(await screen.findByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('goes back one level to the top page', async () => {
      const user = userEvent.setup();
      await renderSettings();
      await openDates(user);

      await user.click(screen.getByRole('button', { name: 'Back' }));

      await waitFor(() => expect(window.location.pathname).toBe('/settings'));
      expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    });
  });

  describe('linked, everything set', () => {
    async function openFull(user: ReturnType<typeof userEvent.setup>) {
      setDates({
        // The store keeps events soonest first.
        events: [
          makeEvent('p-old', { label: 'Old trip', date: new Date(2022, 1, 3) }),
          makeEvent('p-new', { label: 'Recent', date: dayFromToday(-4) }),
          makeEvent('e-soon', { label: 'Dinner', icon: 'calendar', date: dayFromToday(3) }),
          makeEvent('e-ring', { label: 'Vows', icon: 'ring', date: dayFromToday(20) }),
          makeEvent('e-far', { label: 'Trip', icon: 'plane', date: dayFromToday(40) }),
        ],
        anniversaries: [
          { id: 1, date: '2020-09-09', label: 'First date', serverId: 'srv-1' },
          { id: 2, date: '2021-01-02', label: 'Moved in' },
        ],
        ownBirthday: '1990-04-04',
      });
      await renderSettings();
      await openDates(user);
    }

    it('shows Together, Birthdays, Events, Anniversaries and Past in that order', async () => {
      await openFull(userEvent.setup());

      expect(sectionHeadings()).toEqual(['Together', 'Birthdays', 'Events', 'Anniversaries', 'Past']);
    });

    it('shows Together since and Wedding with their dates and date pages', async () => {
      await openFull(userEvent.setup());

      const since = rowAt('together-since');
      expect(since).toHaveTextContent('Together since');
      expect(since).toHaveTextContent(formatListDate(new Date(LINKED.relationshipStart as string)));
      expect(targetOf('together-since')).toBe('dates/together-since');
      const wedding = rowAt('wedding');
      expect(wedding).toHaveTextContent('Wedding');
      expect(wedding).toHaveTextContent('15 Jun 2024');
      expect(targetOf('wedding')).toBe('dates/wedding');
    });

    it('shows You, then the partner by name, with a day and month', async () => {
      await openFull(userEvent.setup());

      const card = screen.getByTestId('settings-dates-birthdays');
      const rows = within(card).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-dates-birthday-self',
        'settings-dates-birthday-partner',
      ]);
      expect(rows[0]).toHaveAccessibleName('You, 4 Apr');
      expect(rows[1]).toHaveAccessibleName('Harper, 4 Apr');
      expect(targetOf('birthday-self')).toBe('dates/birthday');
      expect(targetOf('birthday-partner')).toBe('dates/partner-birthday');
    });

    it('lists upcoming events soonest first, each with its date, tile and event page', async () => {
      await openFull(userEvent.setup());

      const rows = within(screen.getByTestId('settings-dates-events')).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-dates-event-e-soon',
        'settings-dates-event-e-ring',
        'settings-dates-event-e-far',
      ]);
      expect(rows[0]).toHaveAccessibleName(`Dinner, ${formatListDate(dayFromToday(3))}`);
      expect(targetOf('event-e-soon')).toBe('dates/event/e-soon');
      expect(targetOf('event-e-far')).toBe('dates/event/e-far');
    });

    it('lists anniversaries in store order, keyed by server id or device id', async () => {
      await openFull(userEvent.setup());

      const rows = within(screen.getByTestId('settings-dates-anniversaries')).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-dates-anniversary-srv-1',
        'settings-dates-anniversary-2',
      ]);
      expect(rows[0]).toHaveAccessibleName('First date, 9 Sep');
      expect(rows[1]).toHaveAccessibleName('Moved in, 2 Jan');
      expect(targetOf('anniversary-srv-1')).toBe('dates/anniversary/srv-1');
      expect(targetOf('anniversary-2')).toBe('dates/anniversary/2');
    });

    it('lists past events newest first, with the year shown for another year', async () => {
      await openFull(userEvent.setup());

      const rows = within(screen.getByTestId('settings-dates-past')).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-dates-event-p-new',
        'settings-dates-event-p-old',
      ]);
      expect(rows[1]).toHaveAccessibleName('Old trip, 3 Feb 2022');
      expect(targetOf('event-p-old')).toBe('dates/event/p-old');
      expect(screen.queryByTestId('settings-dates-load-more')).not.toBeInTheDocument();
    });

    it('shows no + button and no screen-level Loading text', async () => {
      await openFull(userEvent.setup());

      expect(screen.queryByRole('button', { name: /add|new|\+/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('unset couple dates', () => {
    it('keeps the rows, reads Not set and targets the one-field date pages', async () => {
      const user = userEvent.setup();
      setDates({ coupleSettings: { ...LINKED, relationshipStart: null, weddingDate: null } });
      await renderSettings();
      await openDates(user);

      expect(rowAt('together-since')).toHaveAccessibleName('Together since, Not set');
      expect(rowAt('wedding')).toHaveAccessibleName('Wedding, Not set');
      expect(targetOf('together-since')).toBe('dates/together-since/date');
      expect(targetOf('wedding')).toBe('dates/wedding/date');
    });

    it('treats an unparsable Together since as no value, not Not set', async () => {
      const user = userEvent.setup();
      setDates({ coupleSettings: { ...LINKED, relationshipStart: 'garbage' } });
      await renderSettings();
      await openDates(user);

      expect(rowAt('together-since')).toHaveAccessibleName('Together since');
      expect(targetOf('together-since')).toBe('dates/together-since');
    });
  });

  describe('couple settings not loaded', () => {
    it('shows Together with empty values, never Loading, and the date pages as targets', async () => {
      const user = userEvent.setup();
      setDates({ coupleSettings: null });
      await renderSettings();
      await openDates(user);

      expect(screen.getByTestId('settings-dates-together')).toBeInTheDocument();
      expect(rowAt('together-since')).toHaveAccessibleName('Together since');
      expect(rowAt('wedding')).toHaveAccessibleName('Wedding');
      expect(rowAt('together-since')).not.toHaveTextContent('Not set');
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(targetOf('together-since')).toBe('dates/together-since');
      expect(targetOf('wedding')).toBe('dates/wedding');
    });

    it('shows no Together group with no partner either', async () => {
      const user = userEvent.setup();
      setDates({ coupleSettings: null, partner: null, partnerKnown: false });
      await renderSettings();
      await openDates(user);

      expect(screen.queryByTestId('settings-dates-together')).not.toBeInTheDocument();
    });
  });

  describe('unlinked', () => {
    async function openUnlinked(coupleSettings: { status: 'unlinked' } | null) {
      const user = userEvent.setup();
      setDates({
        coupleSettings,
        partner: null,
        partnerKnown: true,
        events: [
          makeEvent('mine', { userId: selfId, label: 'Mine' }),
          makeEvent('theirs', { userId: 'partner-1', label: 'Theirs' }),
          makeEvent('mine-past', { userId: selfId, label: 'Mine past', date: dayFromToday(-3) }),
          makeEvent('theirs-past', { userId: 'partner-1', label: 'Theirs past', date: dayFromToday(-2) }),
        ],
      });
      await renderSettings();
      await openDates(user);
    }

    it.each([
      ['unlinked couple settings', { status: 'unlinked' as const }],
      ['no couple settings and no partner', null],
    ])('has no Together group, no partner birthday and only own events (%s)', async (_name, couple) => {
      await openUnlinked(couple);

      expect(screen.queryByTestId('settings-dates-together')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-birthday-partner')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-dates-birthday-self')).toBeInTheDocument();
      expect(screen.getByTestId('settings-dates-event-mine')).toBeInTheDocument();
      expect(screen.getByTestId('settings-dates-event-mine-past')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-event-theirs')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-event-theirs-past')).not.toBeInTheDocument();
    });

    it('keeps the partner events while the unlinked answer is unconfirmed', async () => {
      const user = userEvent.setup();
      setDates({
        coupleSettings: { status: 'unlinked' },
        partner: null,
        partnerKnown: true,
        partnerLoadError: true,
        events: [makeEvent('theirs', { userId: 'partner-1' })],
      });
      await renderSettings();
      await openDates(user);

      expect(screen.getByTestId('settings-dates-event-theirs')).toBeInTheDocument();
    });
  });

  describe('birthdays', () => {
    it('leaves the You value empty while the profile has not loaded', async () => {
      const user = userEvent.setup();
      setDates({ ownBirthday: 'unloaded' });
      await renderSettings();
      await openDates(user);

      expect(rowAt('birthday-self')).toHaveAccessibleName('You');
    });

    it('reads Not set for an unset birthday, yours and the partner’s', async () => {
      const user = userEvent.setup();
      setDates({ ownBirthday: null, partner: { ...PARTNER, birthday: null } });
      await renderSettings();
      await openDates(user);

      expect(rowAt('birthday-self')).toHaveAccessibleName('You, Not set');
      expect(rowAt('birthday-partner')).toHaveAccessibleName('Harper, Not set');
    });
  });

  describe('empty groups', () => {
    it('hides Events, Anniversaries and Past, with their labels, when they have no rows', async () => {
      const user = userEvent.setup();
      setDates({});
      await renderSettings();
      await openDates(user);

      expect(sectionHeadings()).toEqual(['Together', 'Birthdays']);
      expect(screen.queryByTestId('settings-dates-events')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-anniversaries')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-past')).not.toBeInTheDocument();
    });

    it('counts an event dated today as upcoming, not past', async () => {
      const user = userEvent.setup();
      setDates({ events: [makeEvent('today', { date: dayFromToday(0) })] });
      await renderSettings();
      await openDates(user);

      expect(
        within(screen.getByTestId('settings-dates-events')).getByTestId('settings-dates-event-today')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-past')).not.toBeInTheDocument();
    });

    it('counts an event dated yesterday as past', async () => {
      const user = userEvent.setup();
      setDates({ events: [makeEvent('yesterday', { date: dayFromToday(-1) })] });
      await renderSettings();
      await openDates(user);

      expect(screen.queryByTestId('settings-dates-events')).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('settings-dates-past')).getByTestId('settings-dates-event-yesterday')
      ).toBeInTheDocument();
    });
  });

  describe('loading the events', () => {
    it('asks for the events when the page opens and on each connectivity change', async () => {
      const user = userEvent.setup();
      await renderSettings();
      await openDates(user);
      const opened = loadEvents.mock.calls.length;

      act(() => {
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } });
      });
      expect(loadEvents.mock.calls.length).toBeGreaterThan(opened);
      const offline = loadEvents.mock.calls.length;
      act(() => {
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true } });
      });
      expect(loadEvents.mock.calls.length).toBeGreaterThan(offline);
    });

    it('shows no error when the initial load fails, and keeps the rows', async () => {
      loadEvents.mockResolvedValue({ status: 'failure', error: 'Failed to load events' });
      const user = userEvent.setup();
      setDates({ events: [makeEvent('kept')] });
      await renderSettings();
      await openDates(user);

      expect(screen.getByTestId('settings-dates-event-kept')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-error')).not.toBeInTheDocument();
    });

    it('renders the rows from the store at once on a reload, before the load answers', async () => {
      loadEvents.mockReturnValue(new Promise(() => {}));
      setDates({ events: [makeEvent('cached')] });
      window.history.replaceState(null, '', '/settings/dates');
      useAppStore.setState({ settingsPath: 'dates' });
      render(<Settings />);

      expect(await screen.findByTestId('settings-dates-event-cached')).toBeInTheDocument();
    });
  });

  describe('Load more', () => {
    async function openWithMore(user: ReturnType<typeof userEvent.setup>) {
      setDates({
        events: [makeEvent('p-1', { label: 'Newer', date: dayFromToday(-5) })],
        eventsPagination: pagination(true),
      });
      await renderSettings();
      await openDates(user);
    }

    it('ends Past, which shows even with no past rows', async () => {
      const user = userEvent.setup();
      setDates({ events: [], eventsPagination: pagination(true) });
      await renderSettings();
      await openDates(user);

      const past = screen.getByTestId('settings-dates-past');
      const button = within(past).getByTestId('settings-dates-load-more');
      expect(button).toHaveTextContent(/^Load more$/);
      expect(button.querySelector('svg')).toBeNull();
      expect(sectionHeadings()).toContain('Past');
    });

    it('shows while only the upcoming window has more', async () => {
      const user = userEvent.setup();
      setDates({ events: [], eventsPagination: pagination(false, true) });
      await renderSettings();
      await openDates(user);

      expect(screen.getByTestId('settings-dates-load-more')).toBeInTheDocument();
    });

    it('is last in Past, after the loaded rows', async () => {
      const user = userEvent.setup();
      await openWithMore(user);

      const past = screen.getByTestId('settings-dates-past');
      const buttons = within(past).getAllByRole('button');
      expect(buttons.at(-1)).toBe(screen.getByTestId('settings-dates-load-more'));
      expect(buttons[0]).toBe(screen.getByTestId('settings-dates-event-p-1'));
    });

    it('appends older past events in place and stays on the Dates list', async () => {
      const user = userEvent.setup();
      loadMoreEvents.mockImplementation(async () => {
        act(() => {
          useAppStore.setState({
            events: [
              makeEvent('p-2', { label: 'Older', date: dayFromToday(-50) }),
              ...useAppStore.getState().events,
            ],
            eventsPagination: pagination(false),
          });
        });
        return { status: 'success' };
      });
      await openWithMore(user);

      await user.click(screen.getByTestId('settings-dates-load-more'));

      expect(loadMoreEvents).toHaveBeenCalledTimes(1);
      const rows = within(screen.getByTestId('settings-dates-past')).getAllByRole('button');
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'settings-dates-event-p-1',
        'settings-dates-event-p-2',
      ]);
      expect(screen.queryByTestId('settings-dates-load-more')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.getByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
      expect(screen.queryByTestId('settings-dates-error')).not.toBeInTheDocument();
    });

    it.each([
      ['a load is running', { eventsIsLoading: true }],
      ['a load-more is running', { eventsIsLoadingMore: true }],
    ])('is disabled while %s', async (_name, flag) => {
      const user = userEvent.setup();
      await openWithMore(user);

      act(() => {
        useAppStore.setState(flag);
      });

      expect(screen.getByTestId('settings-dates-load-more')).toBeDisabled();
    });

    it('keeps the rows and shows the failure in the Error box above the first group', async () => {
      const user = userEvent.setup();
      loadMoreEvents.mockResolvedValue({ status: 'failure', error: 'Failed to load events' });
      await openWithMore(user);

      await user.click(screen.getByTestId('settings-dates-load-more'));

      const box = await screen.findByTestId('settings-dates-error');
      expect(box).toHaveTextContent('Failed to load events');
      expect(box).toHaveAttribute('role', 'alert');
      expect(screen.getByTestId('settings-dates-event-p-1')).toBeInTheDocument();
      expect(screen.getByTestId('settings-dates-load-more')).toBeEnabled();
      expect(
        box.compareDocumentPosition(screen.getByTestId('settings-dates-together')) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('shows the offline message the action answers with', async () => {
      const user = userEvent.setup();
      loadMoreEvents.mockResolvedValue({
        status: 'failure',
        error: offlineMessage('Events', 'load'),
      });
      await openWithMore(user);

      await user.click(screen.getByTestId('settings-dates-load-more'));

      expect(await screen.findByTestId('settings-dates-error')).toHaveTextContent(
        offlineMessage('Events', 'load')
      );
    });

    it('clears the Error box on the next Load more', async () => {
      const user = userEvent.setup();
      let release!: () => void;
      loadMoreEvents.mockResolvedValueOnce({ status: 'failure', error: 'Failed to load events' });
      await openWithMore(user);
      await user.click(screen.getByTestId('settings-dates-load-more'));
      expect(await screen.findByTestId('settings-dates-error')).toBeInTheDocument();
      loadMoreEvents.mockReturnValueOnce(new Promise((resolve) => (release = () => resolve({ status: 'success' }))));

      await user.click(screen.getByTestId('settings-dates-load-more'));

      expect(screen.queryByTestId('settings-dates-error')).not.toBeInTheDocument();
      await act(async () => release());
    });

    it('does not keep the Error box after the page is left and opened again', async () => {
      const user = userEvent.setup();
      loadMoreEvents.mockResolvedValue({ status: 'failure', error: 'Failed to load events' });
      await openWithMore(user);
      await user.click(screen.getByTestId('settings-dates-load-more'));
      expect(await screen.findByTestId('settings-dates-error')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back' }));
      await waitFor(() => expect(window.location.pathname).toBe('/settings'));
      await openDates(user);

      expect(screen.queryByTestId('settings-dates-error')).not.toBeInTheDocument();
    });
  });
});
