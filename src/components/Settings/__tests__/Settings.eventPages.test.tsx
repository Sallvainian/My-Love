/**
 * Settings > Dates > an event's own page (`EventPages`): `dates/event/<id>`
 * and its four one-field pages (`…/name`, `…/date`, `…/note`, `…/icon`), the
 * delete Confirmation dialog (`ConfirmDialog`) and the Remind me group.
 *
 * The real store and the real Settings stack are mounted. Each case sets the
 * slices the pages read with `useAppStore.setState`; the store actions that
 * load and write (`loadEvents`, `editEvent`, `removeEvent`, `setCountdownMark`)
 * are stubs that move the store the way the real ones do, so a case is about
 * the page. Capacitor is mocked on for the Remind me cases and off for the rest.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';
import type { CoupleEvent, EventUpdateInput } from '../../../services/eventsService';
import type { EventLoadResult, EventWriteResult } from '../../../stores/slices/eventsSlice';
import type { CoupleSettings } from '../../../stores/slices/datesSlice';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  isPluginAvailable: vi.fn((_name: string) => true),
}));
const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => ({}),
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: vi.fn(() => Promise.resolve({ notifications: [] })),
    cancel: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../../../api/supabaseClient', () => ({
  lookupPartnerId: vi.fn(),
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../api/authService', () => ({ authService: { signOut: vi.fn() } }));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deferred, setOnline } from '../../../../tests/unit/stores/accountDataFixtures';
import { offlineMessage } from '../../../services/accountDataError';
import { parseEventDate } from '../../../services/eventsService';
import { ALL_PUSH_PREFERENCES_ON } from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { formatDateISO } from '../../../utils/dateUtils';
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
const LINKED: Extract<CoupleSettings, { status: 'linked' }> = {
  status: 'linked',
  partnerId: 'partner-1',
  relationshipStart: null,
  weddingDate: null,
};

const original = {
  loadEvents: useAppStore.getState().loadEvents,
  loadMoreEvents: useAppStore.getState().loadMoreEvents,
  editEvent: useAppStore.getState().editEvent,
  removeEvent: useAppStore.getState().removeEvent,
  setCountdownMark: useAppStore.getState().setCountdownMark,
  loadCountdownMarks: useAppStore.getState().loadCountdownMarks,
  loadPushPreferences: useAppStore.getState().loadPushPreferences,
};

const loadEvents = vi.fn<() => Promise<EventLoadResult>>();
const editEvent = vi.fn<(id: string, updates: EventUpdateInput) => Promise<EventWriteResult>>();
const removeEvent = vi.fn<(id: string) => Promise<EventWriteResult>>();
const setCountdownMark = vi.fn();

let accountCounter = 0;
const USER = () => `user-self-${accountCounter}`;

/** A local date `offset` calendar days from today, at local midnight. */
function daysFromToday(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

function makeEvent(overrides: Partial<CoupleEvent> = {}): CoupleEvent {
  return {
    id: 'event-1',
    userId: USER(),
    label: 'Weekend trip',
    date: daysFromToday(10),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    description: 'Bring the camera',
    icon: 'plane',
    ...overrides,
  };
}

function setEvents(events: CoupleEvent[]) {
  act(() => useAppStore.setState({ events }));
}

/** A fresh load at `/settings/<path>`: no history state, so a page goes up by replacing it. */
function renderAt(path: string, strict = false) {
  window.history.replaceState(null, '', `/settings/${path}`);
  useAppStore.setState({ settingsPath: path });
  render(strict ? <StrictMode><Settings /></StrictMode> : <Settings />);
}

/** Opens `/settings/dates` and taps the event's row, so the page is pushed in the mounted stack. */
async function openFromDates(user: UserEvent, eventId = 'event-1') {
  renderAt('dates');
  expect(await screen.findByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
  await user.click(screen.getByTestId(`settings-dates-event-${eventId}`));
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const saveButton = () => screen.getByTestId('settings-field-save');
const fieldError = () => screen.getByTestId('settings-field-error');
const pageError = () => screen.getByTestId('settings-date-error');
const remindMe = () => screen.queryByTestId('settings-remind-me');
const deleteRow = () => screen.getByTestId('settings-event-delete');
const dialog = () => screen.queryByTestId('settings-event-delete-confirmation');

/** The count of `replaceState` calls that rewrote the URL to `route`. */
const replacesTo = (spy: { mock: { calls: unknown[][] } }, route: string) =>
  spy.mock.calls.filter((call) => call[2] === route).length;

describe('Settings > Dates > an event\'s page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    capacitor.isNativePlatform.mockReturnValue(false);
    capacitor.isPluginAvailable.mockReturnValue(true);
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Casey', birthday: null });
    loadEvents.mockResolvedValue({ status: 'success' });
    // The real actions move the store before they resolve; so do these.
    editEvent.mockImplementation(async (id, updates) => {
      act(() =>
        useAppStore.setState((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? {
                  ...event,
                  ...(updates.label !== undefined && { label: updates.label }),
                  ...(updates.eventDate !== undefined && {
                    date: parseEventDate(updates.eventDate)!,
                  }),
                  ...(updates.description !== undefined && { description: updates.description }),
                  ...(updates.icon !== undefined && { icon: updates.icon }),
                }
              : event
          ),
        }))
      );
      return { success: true };
    });
    removeEvent.mockImplementation(async (id) => {
      act(() =>
        useAppStore.setState((state) => ({ events: state.events.filter((event) => event.id !== id) }))
      );
      return { success: true };
    });
    setCountdownMark.mockResolvedValue(undefined);
    setOnline(true);
    accountCounter += 1;
    useAppStore.setState({
      userId: USER(),
      authSessionVersion: accountCounter,
      currentView: 'settings',
      settingsPath: '',
      eventsIsLoading: false,
      eventsIsLoadingMore: false,
      eventsPagination: null,
      loadEvents,
      loadMoreEvents: vi.fn().mockResolvedValue({ status: 'success' }),
      editEvent,
      removeEvent,
      setCountdownMark,
      loadCountdownMarks: vi.fn().mockResolvedValue(undefined),
      loadPushPreferences: vi.fn().mockResolvedValue(undefined),
      syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true },
      coupleSettings: LINKED,
      partner: PARTNER,
      partnerKnown: true,
      partnerLoadError: false,
      ownProfile: { displayName: 'Casey', birthday: null },
      countdownMarks: [],
      pushPreferences: { ...ALL_PUSH_PREFERENCES_ON },
      events: [makeEvent()],
    });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    setOnline(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
    useAppStore.setState({
      ...original,
      userId: null,
      ownProfile: null,
      currentView: 'home',
      settingsPath: '',
      partner: null,
      partnerKnown: false,
      coupleSettings: null,
      countdownMarks: null,
      pushPreferences: null,
      events: [],
      settings: null,
    });
  });

  describe('an own upcoming event', () => {
    it('opens from its Dates row titled with the event, lists its rows, and back returns to the Dates list', async () => {
      const user = userEvent.setup();
      await openFromDates(user);

      expect(await heading('Weekend trip')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
      // A small title: the bar's own title is drawn only for a large page.
      expect(screen.queryByTestId('settings-bar-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-event-page')).toBeInTheDocument();

      const date = formatListDate(daysFromToday(10), new Date());
      const rows = [
        ['settings-event-name', 'Name, Weekend trip', 'name'],
        ['settings-event-date', `Date, ${date}`, 'date'],
        ['settings-event-note', 'Note, Bring the camera', 'note'],
        ['settings-event-icon', 'Icon, Plane', 'icon'],
      ] as const;
      for (const [testId, name, field] of rows) {
        expect(screen.getByTestId(testId)).toHaveAccessibleName(name);
        expect(screen.getByTestId(testId)).toHaveAttribute(
          'data-settings-target',
          `dates/event/event-1/${field}`
        );
      }
      expect(deleteRow()).toHaveTextContent('Delete event');
      // Delete sits alone in its own card.
      expect(deleteRow().parentElement?.children).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('shows a Note row with no value when the event has no note', async () => {
      setEvents([makeEvent({ description: null })]);
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      expect(screen.getByTestId('settings-event-note')).toHaveAccessibleName('Note');
      expect(screen.getByTestId('settings-event-note')).toHaveTextContent(/^Note$/);
    });

    it('lets a long name and note truncate inside the card', async () => {
      const long = 'x'.repeat(300);
      setEvents([makeEvent({ label: long, description: long })]);
      renderAt('dates/event/event-1');
      await heading(long);

      for (const testId of ['settings-event-name', 'settings-event-note']) {
        const value = screen.getByTestId(testId).querySelector('span.truncate:last-of-type');
        expect(value).toHaveClass('min-w-0', 'truncate', 'max-w-[60%]');
      }
      // Other rows keep their whole value.
      expect(screen.getByTestId('settings-event-date').querySelector('.shrink-0.whitespace-nowrap')).not.toBeNull();
    });

    it('stays on the page after a reload', async () => {
      renderAt('dates/event/event-1');

      expect(await heading('Weekend trip')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
    });

    it('sends no events read for an event the store holds, and stays open when a load would drop it', async () => {
      // A load replaces the list with the server's first page; this one lacks the held event.
      loadEvents.mockImplementation(async () => {
        act(() => useAppStore.setState({ events: [] }));
        return { status: 'success' };
      });
      renderAt('dates/event/event-1', true);

      expect(await heading('Weekend trip')).toBeInTheDocument();
      await act(async () => {});
      act(() =>
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } })
      );
      await act(async () => {});

      expect(loadEvents).not.toHaveBeenCalled();
      expect(screen.getByTestId('settings-event-page')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
    });

    it('counts today as upcoming', async () => {
      capacitor.isNativePlatform.mockReturnValue(true);
      setEvents([makeEvent({ date: daysFromToday(0) })]);
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      expect(remindMe()).toBeInTheDocument();
    });
  });

  describe('an own past event', () => {
    it('has the same rows and Delete, and no Remind me', async () => {
      capacitor.isNativePlatform.mockReturnValue(true);
      setEvents([makeEvent({ date: daysFromToday(-1) })]);
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      for (const testId of [
        'settings-event-name',
        'settings-event-date',
        'settings-event-note',
        'settings-event-icon',
        'settings-event-delete',
      ]) {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      }
      expect(remindMe()).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-remind-me-footnote')).not.toBeInTheDocument();
    });
  });

  describe("a partner's event", () => {
    beforeEach(() => {
      setEvents([makeEvent({ userId: 'partner-1', description: 'Her pick\nsecond line' })]);
    });

    it('is read-only: Date, Note and Icon without chevrons, no Delete, no footnote', async () => {
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      const date = formatListDate(daysFromToday(10), new Date());
      expect(screen.getByTestId('settings-event-date-readonly')).toHaveTextContent(`Date${date}`);
      expect(screen.getByTestId('settings-event-note-readonly')).toHaveTextContent('Note');
      expect(screen.getByTestId('settings-event-note-readonly')).toHaveTextContent('Her pick');
      expect(screen.getByTestId('settings-event-icon-readonly')).toHaveTextContent('IconPlane');
      // Nothing to press but the bar's Back.
      expect(screen.getAllByRole('button').map((button) => button.textContent || button.ariaLabel)).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      expect(screen.queryByTestId('settings-event-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-event-delete')).not.toBeInTheDocument();
      expect(screen.queryByText(/added this/)).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-event-page').querySelector('svg')).toBeNull();
    });

    it('has Remind me while upcoming (the shell), and none once past', async () => {
      capacitor.isNativePlatform.mockReturnValue(true);
      renderAt('dates/event/event-1');
      await heading('Weekend trip');
      expect(remindMe()).toBeInTheDocument();

      cleanup();
      setEvents([makeEvent({ userId: 'partner-1', date: daysFromToday(-2) })]);
      renderAt('dates/event/event-1');
      await heading('Weekend trip');
      expect(remindMe()).not.toBeInTheDocument();
    });

    it.each(['name', 'date', 'note', 'icon'])('renders no field on its %s page', async (field) => {
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      // A reload on a field page shows its parent, so push within the mounted stack.
      act(() => useAppStore.getState().openSettingsPage(`dates/event/event-1/${field}`));

      await waitFor(() =>
        expect(window.location.pathname).toBe(`/settings/dates/event/event-1/${field}`)
      );
      expect(screen.queryByTestId('settings-field-save')).not.toBeInTheDocument();
      expect(document.querySelector('input, textarea')).toBeNull();
    });
  });

  describe('Remind me', () => {
    beforeEach(() => {
      capacitor.isNativePlatform.mockReturnValue(true);
    });

    it('is the event\'s own mark, and a tap writes it', async () => {
      const user = userEvent.setup();
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      expect(remindMe()).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('settings-remind-me-footnote')).toHaveTextContent(
        'A month and a week before.'
      );

      await user.click(remindMe()!);

      expect(setCountdownMark).toHaveBeenCalledWith('event:event-1', true);
    });

    it('is not drawn without the local-notifications plugin', async () => {
      capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      expect(remindMe()).not.toBeInTheDocument();
    });

    it('shows a failed save in the page Error box', async () => {
      const user = userEvent.setup();
      setCountdownMark.mockRejectedValue(new Error('Could not save your reminder.'));
      renderAt('dates/event/event-1');
      await heading('Weekend trip');

      await user.click(remindMe()!);

      expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
        'Could not save your reminder.'
      );
    });
  });

  describe('an event the store does not hold', () => {
    beforeEach(() => {
      setEvents([]);
    });

    it('is titled `Event` with nothing under the bar until its own load answers', async () => {
      const load = deferred<EventLoadResult>();
      loadEvents.mockReturnValue(load.promise);
      renderAt('dates/event/event-1');

      expect(await heading('Event')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-event-page')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');

      // The answer carries the event: the page fills in, in place.
      setEvents([makeEvent()]);
      await act(async () => load.settle({ status: 'success' }));

      expect(await heading('Weekend trip')).toBeInTheDocument();
      expect(screen.getByTestId('settings-event-page')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
    });

    it('falls back to the Dates list once, under StrictMode, when the load answers without it', async () => {
      const replace = vi.spyOn(window.history, 'replaceState');
      renderAt('dates/event/event-1', true);

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
    });

    it.each([
      ['failure', { status: 'failure', error: 'Could not load events' } as const],
      ['stale', { status: 'stale' } as const],
    ])('never falls back on a %s load', async (_name, result) => {
      loadEvents.mockResolvedValue(result);
      renderAt('dates/event/event-1');
      await heading('Event');
      await act(async () => {});

      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
      expect(screen.queryByRole('heading', { level: 1, name: 'Dates' })).not.toBeInTheDocument();
    });

    it('asks again when the connection changes, and falls back only on its own answer', async () => {
      loadEvents.mockResolvedValueOnce({ status: 'failure', error: 'offline' });
      renderAt('dates/event/event-1');
      await heading('Event');
      expect(loadEvents).toHaveBeenCalledTimes(1);

      loadEvents.mockResolvedValue({ status: 'success' });
      act(() =>
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } })
      );

      expect(await heading('Dates')).toBeInTheDocument();
      // The page asked again (the Dates list it fell back to asks too).
      expect(loadEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('renders no field on a field page for an unknown event', async () => {
      renderAt('dates/event/event-1');
      await heading('Dates');

      act(() => useAppStore.getState().openSettingsPage('dates/event/event-1/name'));

      await heading('Name');
      expect(screen.queryByTestId('settings-field-save')).not.toBeInTheDocument();
      expect(document.querySelector('input, textarea')).toBeNull();
    });
  });

  describe('the one-field pages', () => {
    it('go up to the event page on a reload', async () => {
      renderAt('dates/event/event-1/name');

      expect(await heading('Weekend trip')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
      expect(screen.queryByTestId('settings-event-name-field')).not.toBeInTheDocument();
    });

    describe('Name', () => {
      it('starts on the saved name and enables Save only for a changed, valid name of 1 to 100 code points', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-name'));

        expect(await heading('Name')).toBeInTheDocument();
        const field = screen.getByTestId('settings-event-name-field');
        expect(field).toHaveValue('Weekend trip');
        expect(field).toHaveFocus();
        expect(saveButton()).toBeDisabled();

        await user.clear(field);
        expect(saveButton()).toBeDisabled();
        await user.type(field, '   ');
        expect(saveButton()).toBeDisabled();

        // 100 code points of a 2-unit character pass; one more does not.
        fireEvent.change(field, { target: { value: '😀'.repeat(100) } });
        expect(saveButton()).toBeEnabled();
        fireEvent.change(field, { target: { value: '😀'.repeat(101) } });
        expect(saveButton()).toBeDisabled();

        fireEvent.change(field, { target: { value: '  Weekend trip  ' } });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(field, { target: { value: 'Cabin weekend' } });
        expect(saveButton()).toBeEnabled();
      });

      it('saves the trimmed name, returns to the event page, and the title and Dates list show it', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-name'));
        await heading('Name');

        await user.clear(screen.getByTestId('settings-event-name-field'));
        await user.type(screen.getByTestId('settings-event-name-field'), '  Cabin weekend ');
        await user.click(saveButton());

        expect(editEvent).toHaveBeenCalledWith('event-1', { label: 'Cabin weekend' });
        expect(await heading('Cabin weekend')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/event/event-1');
        expect(screen.getByTestId('settings-event-name')).toHaveAccessibleName('Name, Cabin weekend');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(await heading('Dates')).toBeInTheDocument();
        expect(screen.getByTestId('settings-dates-event-event-1')).toHaveAccessibleName(
          expect.stringContaining('Cabin weekend')
        );
      });

      it('refuses offline before any request, keeping the typed value', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-name'));
        await heading('Name');
        await user.type(screen.getByTestId('settings-event-name-field'), '!');
        setOnline(false);

        await user.click(saveButton());

        expect(fieldError()).toHaveTextContent(offlineMessage('Events'));
        expect(editEvent).not.toHaveBeenCalled();
        expect(screen.getByTestId('settings-event-name-field')).toHaveValue('Weekend trip!');
        expect(window.location.pathname).toBe('/settings/dates/event/event-1/name');
      });

      it('shows the result\'s error and stays on a failed write', async () => {
        const user = userEvent.setup();
        editEvent.mockResolvedValue({ success: false, code: 'transport', error: 'The server said no.' });
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-name'));
        await heading('Name');
        await user.type(screen.getByTestId('settings-event-name-field'), '!');

        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent('The server said no.');
        expect(screen.getByTestId('settings-event-name-field')).toHaveValue('Weekend trip!');
        expect(window.location.pathname).toBe('/settings/dates/event/event-1/name');
      });
    });

    describe('Date', () => {
      it('is a date field holding the saved date, saved as that day, past dates allowed', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-date'));
        await heading('Date');

        const field = screen.getByTestId('settings-event-date-field');
        expect(field).toHaveAttribute('type', 'date');
        expect(field).toHaveValue(formatDateISO(daysFromToday(10)));
        expect(saveButton()).toBeDisabled();

        const past = formatDateISO(daysFromToday(-30));
        fireEvent.change(field, { target: { value: past } });
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        expect(editEvent).toHaveBeenCalledWith('event-1', { eventDate: past });
        expect(await heading('Weekend trip')).toBeInTheDocument();
        expect(screen.getByTestId('settings-event-date')).toHaveAccessibleName(
          `Date, ${formatListDate(daysFromToday(-30), new Date())}`
        );
      });

      it('refuses offline before any request', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-date'));
        await heading('Date');
        fireEvent.change(screen.getByTestId('settings-event-date-field'), {
          target: { value: formatDateISO(daysFromToday(20)) },
        });
        setOnline(false);

        await user.click(saveButton());

        expect(fieldError()).toHaveTextContent(offlineMessage('Events'));
        expect(editEvent).not.toHaveBeenCalled();
      });
    });

    describe('Note', () => {
      it('allows an empty note, saved as null, and at most 500 code points', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-note'));
        await heading('Note');

        const field = screen.getByTestId('settings-event-note-field');
        expect(field.tagName).toBe('TEXTAREA');
        expect(field).toHaveValue('Bring the camera');

        fireEvent.change(field, { target: { value: '😀'.repeat(501) } });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(field, { target: { value: '😀'.repeat(500) } });
        expect(saveButton()).toBeEnabled();

        fireEvent.change(field, { target: { value: '' } });
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        expect(editEvent).toHaveBeenCalledWith('event-1', { description: null });
        expect(await heading('Weekend trip')).toBeInTheDocument();
        expect(screen.getByTestId('settings-event-note')).toHaveAccessibleName('Note');
      });

      it('saves a new note trimmed', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-note'));
        await heading('Note');

        fireEvent.change(screen.getByTestId('settings-event-note-field'), {
          target: { value: '  Pack warm  ' },
        });
        await user.click(saveButton());

        expect(editEvent).toHaveBeenCalledWith('event-1', { description: 'Pack warm' });
        expect(await screen.findByTestId('settings-event-note')).toHaveAccessibleName('Note, Pack warm');
      });
    });

    describe('Icon', () => {
      it('offers Calendar, Ring and Plane with the current one checked, and saves a different one', async () => {
        const user = userEvent.setup();
        await openFromDates(user);
        await user.click(await screen.findByTestId('settings-event-icon'));
        await heading('Icon');

        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(3);
        expect(screen.getByTestId('settings-event-icon-calendar')).toHaveTextContent('Calendar');
        expect(screen.getByTestId('settings-event-icon-ring')).toHaveTextContent('Ring');
        expect(screen.getByTestId('settings-event-icon-plane')).toHaveTextContent('Plane');
        expect(screen.getByRole('radio', { name: 'Plane' })).toBeChecked();
        expect(saveButton()).toBeDisabled();

        await user.click(screen.getByTestId('settings-event-icon-ring'));
        expect(screen.getByRole('radio', { name: 'Ring' })).toBeChecked();
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        expect(editEvent).toHaveBeenCalledWith('event-1', { icon: 'ring' });
        expect(await heading('Weekend trip')).toBeInTheDocument();
        expect(screen.getByTestId('settings-event-icon')).toHaveAccessibleName('Icon, Ring');
      });
    });
  });

  describe('Delete event', () => {
    async function openEvent(user: UserEvent, strict = false) {
      void user;
      renderAt('dates/event/event-1', strict);
      await heading('Weekend trip');
    }

    it('asks first, with Cancel focused, and Cancel closes it with no request', async () => {
      const user = userEvent.setup();
      await openEvent(user);

      await user.click(deleteRow());

      expect(dialog()).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Delete this event?' })).toBeInTheDocument();
      expect(screen.getByTestId('settings-event-delete-confirmation-cancel')).toHaveFocus();
      expect(screen.getByTestId('settings-event-delete-confirmation-confirm')).toHaveTextContent('Delete');

      await user.click(screen.getByTestId('settings-event-delete-confirmation-cancel'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(removeEvent).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
    });

    it('closes on Escape and on a tap on the scrim, with no request', async () => {
      const user = userEvent.setup();
      await openEvent(user);

      await user.click(deleteRow());
      await user.keyboard('{Escape}');
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());

      await user.click(deleteRow());
      await user.click(dialog()!);
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());

      expect(removeEvent).not.toHaveBeenCalled();
    });

    it('removes the event online, then lands on the Dates list exactly once under StrictMode', async () => {
      const user = userEvent.setup();
      const replace = vi.spyOn(window.history, 'replaceState');
      await openEvent(user, true);

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-event-delete-confirmation-confirm'));

      expect(removeEvent).toHaveBeenCalledWith('event-1');
      expect(await heading('Dates')).toBeInTheDocument();
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(window.location.pathname).toBe('/settings/dates');
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
      expect(screen.queryByTestId('settings-dates-event-event-1')).not.toBeInTheDocument();
    });

    it('closes the dialog, disables the row while it runs, and re-enables it with the error on a failure', async () => {
      const user = userEvent.setup();
      const running = deferred<EventWriteResult>();
      removeEvent.mockReturnValue(running.promise);
      await openEvent(user);

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-event-delete-confirmation-confirm'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(deleteRow()).toBeDisabled();

      await act(async () =>
        running.settle({ success: false, code: 'transport', error: 'The server said no.' })
      );

      expect(pageError()).toHaveTextContent('The server said no.');
      expect(deleteRow()).toBeEnabled();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
      expect(screen.getByTestId('settings-event-page')).toBeInTheDocument();
    });

    it('shows a thrown error the same way', async () => {
      const user = userEvent.setup();
      removeEvent.mockRejectedValue(new Error('Boom'));
      await openEvent(user);

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-event-delete-confirmation-confirm'));

      expect(await screen.findByTestId('settings-date-error')).toHaveTextContent('Boom');
      expect(deleteRow()).toBeEnabled();
    });

    it('refuses offline without opening the dialog or sending a request', async () => {
      const user = userEvent.setup();
      await openEvent(user);
      setOnline(false);

      await user.click(deleteRow());

      expect(dialog()).not.toBeInTheDocument();
      expect(pageError()).toHaveTextContent(offlineMessage('Events', 'delete'));
      expect(removeEvent).not.toHaveBeenCalled();
    });

    it('closes the dialog and refuses when the connection drops before Delete is confirmed', async () => {
      const user = userEvent.setup();
      await openEvent(user);
      await user.click(deleteRow());
      setOnline(false);

      await user.click(screen.getByTestId('settings-event-delete-confirmation-confirm'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(pageError()).toHaveTextContent(offlineMessage('Events', 'delete'));
      expect(removeEvent).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/dates/event/event-1');
    });

    it('goes back once even when the absence fallback and the delete both want to', async () => {
      const user = userEvent.setup();
      const replace = vi.spyOn(window.history, 'replaceState');
      // The load has answered with the event held, so the fallback is armed
      // when the delete takes the event out of the store.
      await openEvent(user, true);
      await act(async () => {});

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-event-delete-confirmation-confirm'));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
    });
  });
});
