/**
 * Settings > Dates > adding a date (`NewDatePages`, `DatesPage`): the `+`
 * button and the Kind chooser, and the New event and New anniversary Form
 * pages (`dates/new-event`, `dates/new-anniversary`) with Cancel and Add in the
 * Settings bar.
 *
 * The real store and the real Settings stack are mounted. Each case sets the
 * slices the pages read with `useAppStore.setState`; the two writes
 * (`addEvent`, `addAnniversary`) are stubs that move the store the way the real
 * ones do, so a case is about the page. Capacitor is mocked off.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';
import type { AnniversaryInput } from '../../../services/anniversariesService';
import type { CoupleEvent } from '../../../services/eventsService';
import type { CoupleSettings } from '../../../stores/slices/datesSlice';
import type { EventWriteResult, NewEventInput } from '../../../stores/slices/eventsSlice';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  isPluginAvailable: vi.fn((_name: string) => false),
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
import { Settings } from '../Settings';
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
  addEvent: useAppStore.getState().addEvent,
  addAnniversary: useAppStore.getState().addAnniversary,
  loadCountdownMarks: useAppStore.getState().loadCountdownMarks,
  loadPushPreferences: useAppStore.getState().loadPushPreferences,
};

const addEvent = vi.fn<(input: NewEventInput) => Promise<EventWriteResult>>();
const addAnniversary = vi.fn<(input: AnniversaryInput, clientKey?: string) => Promise<void>>();

let accountCounter = 0;
let eventCounter = 0;

/** A date comfortably in the future, as the `YYYY-MM-DD` a date input holds. */
const FUTURE = (() => {
  const now = new Date();
  const date = new Date(now.getFullYear() + 1, now.getMonth(), 15);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}-15`;
})();

/** A fresh load at `/settings/<path>`: no history state, so a page goes up by replacing it. */
function renderAt(path: string, strict = false) {
  window.history.replaceState(null, '', `/settings/${path}`);
  useAppStore.setState({ settingsPath: path, settingsPushedPath: null });
  render(
    strict ? (
      <StrictMode>
        <Settings />
      </StrictMode>
    ) : (
      <Settings />
    )
  );
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const addButton = () => screen.getByTestId('settings-form-add') as HTMLButtonElement;
const formError = () => screen.queryByTestId('settings-form-error');
const chooser = () => screen.queryByTestId('settings-kind-chooser');

/** Opens the Dates list (a fresh load) and taps `+`. */
async function openChooser(user: UserEvent) {
  renderAt('dates');
  await heading('Dates');
  await user.click(screen.getByTestId('settings-dates-add'));
  expect(await screen.findByTestId('settings-kind-chooser')).toBeInTheDocument();
}

/** The Dates list, then `+`, then a kind: the form is pushed in the mounted stack. */
async function openForm(user: UserEvent, kind: 'event' | 'anniversary', strict = false) {
  renderAt('dates', strict);
  await heading('Dates');
  await user.click(screen.getByTestId('settings-dates-add'));
  await user.click(await screen.findByTestId(`settings-kind-chooser-${kind}`));
  await heading(kind === 'event' ? 'New event' : 'New anniversary');
}

const field = (kind: 'event' | 'anniversary', name: 'name' | 'date' | 'note') =>
  screen.getByTestId(`settings-new-${kind}-${name}-field`) as HTMLInputElement | HTMLTextAreaElement;

function fill(
  kind: 'event' | 'anniversary',
  values: { name?: string; date?: string; note?: string }
) {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(field(kind, name as 'name' | 'date' | 'note'), { target: { value } });
  }
}

const storedEvents = () => useAppStore.getState().events;
const storedAnniversaries = () => useAppStore.getState().settings?.relationship.anniversaries ?? [];

describe('Settings > Dates > adding a date', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    capacitor.isNativePlatform.mockReturnValue(false);
    capacitor.isPluginAvailable.mockReturnValue(false);
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Casey', birthday: null });
    // The real actions move the store before they resolve; so do these.
    addEvent.mockImplementation(async (input) => {
      eventCounter += 1;
      const event: CoupleEvent = {
        id: `new-event-${eventCounter}`,
        userId: useAppStore.getState().userId!,
        label: input.label,
        date: parseEventDate(input.eventDate)!,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        description: input.description ?? null,
        icon: input.icon ?? 'calendar',
      };
      act(() => useAppStore.setState((state) => ({ events: [...state.events, event] })));
      return { success: true };
    });
    addAnniversary.mockImplementation(async (input) => {
      act(() =>
        useAppStore.setState((state) => {
          const current = state.settings?.relationship.anniversaries ?? [];
          return {
            settings: {
              relationship: {
                anniversaries: [
                  ...current,
                  {
                    id: current.length + 1,
                    serverId: `srv-${current.length + 1}`,
                    label: input.label,
                    date: input.date,
                    ...(input.description ? { description: input.description } : {}),
                  },
                ],
              },
            },
          };
        })
      );
    });
    setOnline(true);
    accountCounter += 1;
    useAppStore.setState({
      userId: `user-self-${accountCounter}`,
      authSessionVersion: accountCounter,
      currentView: 'settings',
      settingsPath: '',
      events: [],
      eventsIsLoading: false,
      eventsIsLoadingMore: false,
      eventsPagination: null,
      loadEvents: vi.fn().mockResolvedValue({ status: 'success' }),
      loadMoreEvents: vi.fn().mockResolvedValue({ status: 'success' }),
      addEvent,
      addAnniversary,
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
      settings: { relationship: { anniversaries: [] } },
    });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    setOnline(true);
    vi.restoreAllMocks();
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

  describe('the Kind chooser', () => {
    it('opens from the + button as an unnamed-by-title dialog with Event, Anniversary and Cancel', async () => {
      const user = userEvent.setup();
      await openChooser(user);

      const dialog = screen.getByRole('dialog', { name: 'Add a date' });
      expect(dialog).toBe(chooser());
      expect(screen.getByTestId('settings-dates-add')).toHaveAccessibleName('Add a date');
      expect(screen.getByTestId('settings-kind-chooser-event')).toHaveTextContent('Event');
      expect(screen.getByTestId('settings-kind-chooser-anniversary')).toHaveTextContent(
        'Anniversary'
      );
      expect(screen.getByTestId('settings-kind-chooser-cancel')).toHaveTextContent('Cancel');
      // No visible title: no heading inside the dialog.
      expect(dialog.querySelector('h1, h2, h3')).toBeNull();
    });

    it('closes on Cancel, Escape or the scrim without navigating', async () => {
      const user = userEvent.setup();
      const pushes = vi.spyOn(window.history, 'pushState');
      await openChooser(user);

      await user.click(screen.getByTestId('settings-kind-chooser-cancel'));
      await waitFor(() => expect(chooser()).not.toBeInTheDocument());

      await user.click(screen.getByTestId('settings-dates-add'));
      expect(await screen.findByTestId('settings-kind-chooser')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(chooser()).not.toBeInTheDocument());

      await user.click(screen.getByTestId('settings-dates-add'));
      await user.click(await screen.findByTestId('settings-kind-chooser'));
      await waitFor(() => expect(chooser()).not.toBeInTheDocument());

      expect(pushes).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.getByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
    });

    it.each([
      ['event', 'New event', '/settings/dates/new-event'],
      ['anniversary', 'New anniversary', '/settings/dates/new-anniversary'],
    ] as const)(
      'closes on %s and pushes its form page as one history entry',
      async (kind, title, route) => {
        const user = userEvent.setup();
        await openChooser(user);
        const before = window.history.length;

        await user.click(screen.getByTestId(`settings-kind-chooser-${kind}`));

        expect(await heading(title)).toBeInTheDocument();
        expect(chooser()).not.toBeInTheDocument();
        expect(window.location.pathname).toBe(route);
        expect(window.history.length).toBe(before + 1);
      }
    );

    it('is off the page before the form page is pushed, so the shell never pictures it', async () => {
      const user = userEvent.setup();
      await openChooser(user);
      const push = window.history.pushState.bind(window.history);
      const chooserAtPush: (Element | null)[] = [];
      vi.spyOn(window.history, 'pushState').mockImplementation((...args) => {
        chooserAtPush.push(document.querySelector('[data-testid="settings-kind-chooser"]'));
        push(...args);
      });

      await user.click(screen.getByTestId('settings-kind-chooser-anniversary'));

      expect(await heading('New anniversary')).toBeInTheDocument();
      expect(chooserAtPush).toEqual([null]);
    });
  });

  describe('the New event form', () => {
    it('opens with Name focused, an empty Date and Note, Calendar selected and Add disabled', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');

      expect(screen.getByTestId('settings-new-event-page')).toBeInTheDocument();
      // A small title: the bar's own title is drawn only for a large page.
      expect(screen.queryByTestId('settings-bar-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-cancel')).toHaveTextContent('Cancel');
      expect(screen.queryByTestId('settings-back')).not.toBeInTheDocument();
      expect(addButton()).toHaveTextContent('Add');
      expect(addButton()).toBeDisabled();

      expect(screen.getByLabelText('Name')).toBe(field('event', 'name'));
      expect(screen.getByLabelText('Date')).toBe(field('event', 'date'));
      expect(screen.getByLabelText('Note')).toBe(field('event', 'note'));
      expect(field('event', 'name')).toHaveFocus();
      expect(field('event', 'name')).toHaveAttribute('placeholder', 'e.g., Weekend trip');
      expect(field('event', 'note')).toHaveAttribute(
        'placeholder',
        'Add a note about this event...'
      );
      expect(field('event', 'note')).toHaveAttribute('rows', '3');
      expect(field('event', 'date').value).toBe('');

      const tiles = ['calendar', 'ring', 'plane'].map((icon) =>
        screen.getByTestId(`settings-new-event-icon-${icon}`)
      );
      expect(tiles.map((tile) => tile.textContent)).toEqual(['Calendar', 'Ring', 'Plane']);
      expect(tiles.map((tile) => tile.dataset.selected)).toEqual(['true', 'false', 'false']);
    });

    it('chooses an icon by tapping its tile', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');

      await user.click(screen.getByTestId('settings-new-event-icon-plane'));

      expect(screen.getByTestId('settings-new-event-icon-plane').dataset.selected).toBe('true');
      expect(screen.getByTestId('settings-new-event-icon-calendar').dataset.selected).toBe('false');
    });

    it('enables Add for a trimmed Name and a valid Date, and not for either alone', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');

      fill('event', { name: 'Trip' });
      expect(addButton()).toBeDisabled();
      fill('event', { name: '   ', date: FUTURE });
      expect(addButton()).toBeDisabled();
      fill('event', { name: 'Trip', date: '' });
      expect(addButton()).toBeDisabled();
      fill('event', { date: FUTURE });
      expect(addButton()).toBeEnabled();
    });

    it('counts the Name and Note in code points, trimmed, at 100 and 500', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');
      fill('event', { name: 'a', date: FUTURE });

      fill('event', { name: 'a'.repeat(100) });
      expect(addButton()).toBeEnabled();
      fill('event', { name: 'a'.repeat(101) });
      expect(addButton()).toBeDisabled();
      // Surrounding spaces do not count, and an astral character is one code point.
      fill('event', { name: `  ${'😀'.repeat(100)}  ` });
      expect(addButton()).toBeEnabled();
      fill('event', { name: '😀'.repeat(101) });
      expect(addButton()).toBeDisabled();

      fill('event', { name: 'a', note: 'n'.repeat(500) });
      expect(addButton()).toBeEnabled();
      fill('event', { note: 'n'.repeat(501) });
      expect(addButton()).toBeDisabled();
      fill('event', { note: `${'n'.repeat(500)}   ` });
      expect(addButton()).toBeEnabled();
    });

    it('writes once with the trimmed label, a null note and the icon, then returns to the Dates list', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');
      fill('event', { name: '  Weekend trip  ', date: FUTURE });
      await user.click(screen.getByTestId('settings-new-event-icon-ring'));

      await user.click(addButton());

      expect(addEvent).toHaveBeenCalledTimes(1);
      expect(addEvent).toHaveBeenCalledWith({
        label: 'Weekend trip',
        eventDate: FUTURE,
        description: null,
        icon: 'ring',
      });
      // Back on the Dates list, not on the new event's page.
      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.queryByTestId('settings-event-page')).not.toBeInTheDocument();
      const row = screen.getByTestId(`settings-dates-event-${storedEvents()[0].id}`);
      expect(row).toHaveTextContent('Weekend trip');
      expect(screen.getByTestId('settings-dates-events')).toContainElement(row);
    });

    it('sends a trimmed note', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE, note: '  Bring the camera \n' });

      await user.click(addButton());

      expect(addEvent).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Bring the camera' })
      );
    });

    it('disables Add and the fields while the write runs, and sends one write for a double tap', async () => {
      const user = userEvent.setup();
      const write = deferred<EventWriteResult>();
      addEvent.mockReturnValueOnce(write.promise);
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE });

      fireEvent.click(addButton());
      fireEvent.click(addButton());
      // A submit bypasses the disabled button: the in-flight guard holds anyway.
      fireEvent.submit(screen.getByTestId('settings-new-event-page').querySelector('form')!);

      expect(addButton()).toBeDisabled();
      expect(field('event', 'name')).toBeDisabled();
      expect(addEvent).toHaveBeenCalledTimes(1);

      await act(async () => write.settle({ success: true }));
      expect(await heading('Dates')).toBeInTheDocument();
      expect(addEvent).toHaveBeenCalledTimes(1);
    });

    it('refuses offline before any request, keeping every field', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE, note: 'Camera' });
      await user.click(screen.getByTestId('settings-new-event-icon-plane'));
      setOnline(false);

      await user.click(addButton());

      expect(addEvent).not.toHaveBeenCalled();
      expect(screen.getByTestId('settings-form-error')).toHaveTextContent(offlineMessage('Events'));
      expect(screen.getByRole('alert')).toBe(formError());
      expect(field('event', 'name').value).toBe('Trip');
      expect(field('event', 'date').value).toBe(FUTURE);
      expect(field('event', 'note').value).toBe('Camera');
      expect(screen.getByTestId('settings-new-event-icon-plane').dataset.selected).toBe('true');
      expect(addButton()).toBeEnabled();
      expect(window.location.pathname).toBe('/settings/dates/new-event');

      // Back online, the same Add goes through and clears the box.
      setOnline(true);
      await user.click(addButton());
      expect(addEvent).toHaveBeenCalledTimes(1);
      expect(await heading('Dates')).toBeInTheDocument();
    });

    it('shows a failure in the Error box, keeps the fields, re-enables Add and clears the box on the next Add', async () => {
      const user = userEvent.setup();
      addEvent.mockResolvedValueOnce({ success: false, code: 'transport', error: 'The server said no' });
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE, note: 'Camera' });

      await user.click(addButton());

      expect(await screen.findByTestId('settings-form-error')).toHaveTextContent(
        'The server said no'
      );
      expect(field('event', 'name').value).toBe('Trip');
      expect(field('event', 'note').value).toBe('Camera');
      expect(addButton()).toBeEnabled();
      expect(window.location.pathname).toBe('/settings/dates/new-event');

      const retry = deferred<EventWriteResult>();
      addEvent.mockReturnValueOnce(retry.promise);
      await user.click(addButton());
      expect(formError()).not.toBeInTheDocument();
      await act(async () => retry.settle({ success: true }));
      expect(await heading('Dates')).toBeInTheDocument();
      expect(addEvent).toHaveBeenCalledTimes(2);
    });

    it('shows the message of a throw from the write', async () => {
      const user = userEvent.setup();
      addEvent.mockRejectedValueOnce(new Error('Unexpected throw'));
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE });

      await user.click(addButton());

      expect(await screen.findByTestId('settings-form-error')).toHaveTextContent('Unexpected throw');
      expect(addButton()).toBeEnabled();
    });

    it('latches Add disabled after an invalid-response, with the message shown', async () => {
      const user = userEvent.setup();
      addEvent.mockResolvedValueOnce({
        success: false,
        code: 'invalid-response',
        error: 'Unreadable response',
      });
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE });

      await user.click(addButton());

      expect(await screen.findByTestId('settings-form-error')).toHaveTextContent(
        'Unreadable response'
      );
      expect(addButton()).toBeDisabled();
      // Editing a field does not unlatch it, and a submit does nothing.
      fill('event', { name: 'Trip 2' });
      expect(addButton()).toBeDisabled();
      fireEvent.submit(screen.getByTestId('settings-new-event-page').querySelector('form')!);
      expect(addEvent).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('settings-form-error')).toHaveTextContent('Unreadable response');
    });

    it('goes back without writing on Cancel', async () => {
      const user = userEvent.setup();
      await openForm(user, 'event');
      fill('event', { name: 'Trip', date: FUTURE });

      await user.click(screen.getByTestId('settings-cancel'));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(addEvent).not.toHaveBeenCalled();
      expect(storedEvents()).toEqual([]);
    });

    it.each([false, true])('shows the Dates list after a reload (strict: %s)', async (strict) => {
      renderAt('dates/new-event', strict);

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.queryByTestId('settings-new-event-page')).not.toBeInTheDocument();
    });
  });

  describe('the New anniversary form', () => {
    it('opens with Name focused, no icon and Add disabled', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');

      expect(screen.getByTestId('settings-new-anniversary-page')).toBeInTheDocument();
      expect(screen.getByTestId('settings-cancel')).toHaveTextContent('Cancel');
      expect(addButton()).toBeDisabled();
      expect(field('anniversary', 'name')).toHaveFocus();
      expect(field('anniversary', 'name')).toHaveAttribute(
        'placeholder',
        'e.g., First Date Anniversary'
      );
      expect(field('anniversary', 'note')).toHaveAttribute(
        'placeholder',
        'Add a note about this anniversary...'
      );
      expect(screen.getByLabelText('Name')).toBe(field('anniversary', 'name'));
      expect(screen.getByLabelText('Date')).toBe(field('anniversary', 'date'));
      expect(screen.getByLabelText('Note')).toBe(field('anniversary', 'note'));
      expect(screen.queryByText('Icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-new-event-icon-calendar')).not.toBeInTheDocument();
    });

    it('enables Add for a trimmed Name and a valid Date', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');

      fill('anniversary', { name: '   ', date: FUTURE });
      expect(addButton()).toBeDisabled();
      fill('anniversary', { name: 'First date', date: '' });
      expect(addButton()).toBeDisabled();
      fill('anniversary', { date: FUTURE });
      expect(addButton()).toBeEnabled();
    });

    it('writes once with the trimmed label and an undefined note, then returns to the Dates list', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');
      fill('anniversary', { name: '  First date ', date: '2022-04-04' });

      await user.click(addButton());

      expect(addAnniversary).toHaveBeenCalledTimes(1);
      expect(addAnniversary).toHaveBeenCalledWith(
        { label: 'First date', date: '2022-04-04', description: undefined },
        expect.any(String)
      );
      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.queryByTestId('settings-anniversary-page')).not.toBeInTheDocument();
      const row = screen.getByTestId(`settings-dates-anniversary-${storedAnniversaries()[0].serverId}`);
      expect(row).toHaveTextContent('First date');
      expect(screen.getByTestId('settings-dates-anniversaries')).toContainElement(row);
    });

    it('sends a trimmed note', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04', note: ' The cafe ' });

      await user.click(addButton());

      expect(addAnniversary).toHaveBeenCalledWith(
        { label: 'First date', date: '2022-04-04', description: 'The cafe' },
        expect.any(String)
      );
    });

    it('sends one write for a double tap', async () => {
      const user = userEvent.setup();
      const write = deferred<void>();
      addAnniversary.mockReturnValueOnce(write.promise);
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04' });

      fireEvent.click(addButton());
      fireEvent.click(addButton());
      fireEvent.submit(screen.getByTestId('settings-new-anniversary-page').querySelector('form')!);

      expect(addButton()).toBeDisabled();
      expect(addAnniversary).toHaveBeenCalledTimes(1);
      await act(async () => write.settle());
      expect(await heading('Dates')).toBeInTheDocument();
    });

    it('refuses offline before any request, keeping every field', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04', note: 'The cafe' });
      setOnline(false);

      await user.click(addButton());

      expect(addAnniversary).not.toHaveBeenCalled();
      expect(screen.getByTestId('settings-form-error')).toHaveTextContent(
        offlineMessage('Anniversaries')
      );
      expect(field('anniversary', 'name').value).toBe('First date');
      expect(field('anniversary', 'note').value).toBe('The cafe');
      expect(addButton()).toBeEnabled();
    });

    it('shows a failed add in the Error box, keeps the fields and re-enables Add', async () => {
      const user = userEvent.setup();
      addAnniversary.mockRejectedValueOnce(new Error('Could not reach the server'));
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04' });

      await user.click(addButton());

      expect(await screen.findByTestId('settings-form-error')).toHaveTextContent(
        'Could not reach the server'
      );
      expect(field('anniversary', 'name').value).toBe('First date');
      expect(addButton()).toBeEnabled();
      expect(window.location.pathname).toBe('/settings/dates/new-anniversary');

      await user.click(addButton());
      expect(await heading('Dates')).toBeInTheDocument();
    });

    it('retries the same payload with the same key, and a changed payload with a new one', async () => {
      const user = userEvent.setup();
      addAnniversary.mockRejectedValueOnce(new Error('lost'));
      addAnniversary.mockRejectedValueOnce(new Error('lost again'));
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04' });

      await user.click(addButton());
      await screen.findByTestId('settings-form-error');
      await user.click(addButton());
      await waitFor(() => expect(addAnniversary).toHaveBeenCalledTimes(2));
      await screen.findByText('lost again');
      fill('anniversary', { name: 'First date!' });
      await user.click(addButton());

      await waitFor(() => expect(addAnniversary).toHaveBeenCalledTimes(3));
      const keys = addAnniversary.mock.calls.map((call) => call[1]);
      // A lost response then a retry resolves to one row only if the key repeats.
      expect(keys[1]).toBe(keys[0]);
      expect(keys[2]).not.toBe(keys[0]);
    });

    it('goes back without writing on Cancel', async () => {
      const user = userEvent.setup();
      await openForm(user, 'anniversary');
      fill('anniversary', { name: 'First date', date: '2022-04-04' });

      await user.click(screen.getByTestId('settings-cancel'));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(addAnniversary).not.toHaveBeenCalled();
      expect(storedAnniversaries()).toEqual([]);
    });

    it.each([false, true])('shows the Dates list after a reload (strict: %s)', async (strict) => {
      renderAt('dates/new-anniversary', strict);

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(screen.queryByTestId('settings-new-anniversary-page')).not.toBeInTheDocument();
    });
  });

  describe('the top page', () => {
    it('has no Countdowns section, card or reminder list', async () => {
      // Where the old reminder list rendered: the native shell with the
      // local-notifications plugin.
      capacitor.isNativePlatform.mockReturnValue(true);
      capacitor.isPluginAvailable.mockReturnValue(true);
      renderAt('');

      expect(await heading('Settings')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Countdowns' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-countdowns-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-reminder-marks')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Countdowns');
    });
  });
});
