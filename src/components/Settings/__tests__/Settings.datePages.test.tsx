/**
 * Settings > Dates > Together since, Wedding, Your birthday and the partner's
 * birthday (`DatePages`), the one-field Date pages under the first two and
 * under Your birthday, and the Remind me group (`RemindMe`).
 *
 * The real store and the real Settings stack are mounted. Each case sets the
 * slices the pages read with `useAppStore.setState`; the store actions that
 * write (`setRelationshipStart`, `setWeddingDate`, `setCountdownMark`) and the
 * loaders are stubs, so a case is about the page. Capacitor is mocked on for
 * the Remind me cases and off for the rest. The checks the old `Together`
 * section's tests made carry over: the past-only rule on a pinned clock, a
 * wedding saved on any date, cleared, and every refusal and error.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';
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

import { setOnline } from '../../../../tests/unit/stores/accountDataFixtures';
import { AccountDataError, offlineMessage } from '../../../services/accountDataError';
import { ALL_PUSH_PREFERENCES_ON } from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';
import { renderAt } from './settingsPageKit';
import { formatDayMonth, formatListDate, toLocalDateTime } from '../settingsFields';
import { onPopState } from './settingsStackKit';

const PARTNER: PartnerInfo = {
  id: 'partner-1',
  email: 'harper@example.com',
  displayName: 'Harper',
  linkedSince: null,
  birthday: '1991-04-04',
};

type LinkedSettings = Extract<CoupleSettings, { status: 'linked' }>;

const START = new Date(2022, 1, 3, 12, 0).toISOString();
const LINKED: LinkedSettings = {
  status: 'linked',
  partnerId: 'partner-1',
  relationshipStart: START,
  weddingDate: '2024-06-15',
};
const UNSET: LinkedSettings = { ...LINKED, relationshipStart: null, weddingDate: null };

const original = {
  loadEvents: useAppStore.getState().loadEvents,
  loadMoreEvents: useAppStore.getState().loadMoreEvents,
  setRelationshipStart: useAppStore.getState().setRelationshipStart,
  setWeddingDate: useAppStore.getState().setWeddingDate,
  setCountdownMark: useAppStore.getState().setCountdownMark,
  loadCountdownMarks: useAppStore.getState().loadCountdownMarks,
  loadPushPreferences: useAppStore.getState().loadPushPreferences,
};
const setRelationshipStart = vi.fn();
const setWeddingDate = vi.fn();
const setCountdownMark = vi.fn();

let accountCounter = 0;

/**
 * Puts the slices the pages read in a state; anything left out is the linked,
 * everything-set default.
 */
function setDates(state: {
  coupleSettings?: CoupleSettings | null;
  ownBirthday?: string | null | 'unloaded';
  ownProfileLoadFailed?: boolean;
  partner?: PartnerInfo | null;
  partnerKnown?: boolean;
  partnerLoadError?: boolean;
  remindersOff?: string[] | null;
  dateReminders?: boolean;
}) {
  const { ownBirthday = null, remindersOff = [], dateReminders = true, ...rest } = state;
  backend.fetchOwnProfile.mockImplementation(() =>
    ownBirthday === 'unloaded'
      ? Promise.reject(new Error('profile unavailable'))
      : Promise.resolve({ displayName: 'Casey', birthday: ownBirthday })
  );
  act(() => {
    useAppStore.setState({
      coupleSettings: LINKED,
      partner: PARTNER,
      partnerKnown: true,
      partnerLoadError: false,
      ownProfile:
        ownBirthday === 'unloaded' ? null : { displayName: 'Casey', birthday: ownBirthday },
      remindersOff,
      pushPreferences: { ...ALL_PUSH_PREFERENCES_ON, dateReminders },
      ...rest,
    });
  });
}

/** Opens `/settings/dates` and taps one of its rows, so the page is pushed in the mounted stack. */
async function openFromDates(user: UserEvent, rowTestId: string) {
  renderAt('dates');
  expect(await screen.findByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
  await user.click(screen.getByTestId(rowTestId));
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const dateRow = () => screen.getByTestId('settings-date-row');
const saveButton = () => screen.getByTestId('settings-field-save');
const remindMe = () => screen.getByTestId('settings-remind-me');
const footnote = () => screen.getByTestId('settings-remind-me-footnote');

describe('Settings > Dates > date pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    capacitor.isNativePlatform.mockReturnValue(false);
    capacitor.isPluginAvailable.mockReturnValue(true);
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Casey', birthday: null });
    setRelationshipStart.mockResolvedValue(undefined);
    setWeddingDate.mockResolvedValue(undefined);
    setCountdownMark.mockResolvedValue(undefined);
    setOnline(true);
    accountCounter += 1;
    // A fresh account per case, so no earlier case's saved copy answers for this one.
    useAppStore.setState({
      userId: `user-self-${accountCounter}`,
      authSessionVersion: accountCounter,
      currentView: 'settings',
      settingsPath: '',
      events: [],
      eventsIsLoading: false,
      eventsIsLoadingMore: false,
      loadEvents: vi.fn().mockResolvedValue({ status: 'success' }),
      loadMoreEvents: vi.fn().mockResolvedValue({ status: 'success' }),
      setRelationshipStart,
      setWeddingDate,
      setCountdownMark,
      loadCountdownMarks: vi.fn().mockResolvedValue(undefined),
      loadPushPreferences: vi.fn().mockResolvedValue(undefined),
      syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true },
    });
    setDates({});
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
      ownProfileLoadFailed: false,
      currentView: 'home',
      settingsPath: '',
      partner: null,
      partnerKnown: false,
      partnerLoadError: false,
      coupleSettings: null,
      remindersOff: null,
      pushPreferences: null,
      events: [],
      settings: null,
    });
  });

  describe('the top page', () => {
    it('has no Together section and no date or time field', async () => {
      window.history.replaceState(null, '', '/');
      render(<Settings />);
      await screen.findByRole('heading', { level: 1, name: 'Settings' });

      expect(
        screen.queryByRole('heading', { level: 2, name: 'Together' })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-together-since')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-wedding')).not.toBeInTheDocument();
      expect(document.querySelector('input[type="date"], input[type="time"]')).toBeNull();
    });
  });

  describe('opening a page from the Dates list', () => {
    it.each([
      ['settings-dates-together-since', 'Together since', '/settings/dates/together-since'],
      ['settings-dates-wedding', 'Wedding', '/settings/dates/wedding'],
      ['settings-dates-birthday-self', 'Your birthday', '/settings/dates/birthday'],
      ['settings-dates-birthday-partner', "Harper's birthday", '/settings/dates/partner-birthday'],
    ])('%s opens %s with the small title, and back returns to the Dates list', async (
      row,
      title,
      path
    ) => {
      const user = userEvent.setup();
      await openFromDates(user, row);

      expect(await heading(title)).toBeInTheDocument();
      expect(window.location.pathname).toBe(path);
      expect(screen.getByTestId('settings-title')).toHaveTextContent(title);
      // The bar's own title is drawn only for a large page, so a small one has none.
      expect(screen.queryByTestId('settings-bar-title')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('stays on the page after a reload', async () => {
      renderAt('dates/wedding');

      expect(await heading('Wedding')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/wedding');
    });
  });

  describe('Together since', () => {
    it('shows the Date row as the Dates list does, opening the Date page', async () => {
      renderAt('dates/together-since');
      await heading('Together since');

      const value = formatListDate(new Date(START), new Date());
      expect(dateRow()).toHaveAccessibleName(`Date, ${value}`);
      expect(dateRow()).toHaveTextContent(value);
      expect(dateRow()).toBeEnabled();
      expect(dateRow()).toHaveAttribute('data-settings-target', 'dates/together-since/date');
      expect(screen.getByTestId('settings-together-since-page')).toBeInTheDocument();
    });

    it('reads Not set for a loaded linked couple with no start', async () => {
      setDates({ coupleSettings: UNSET });
      renderAt('dates/together-since');
      await heading('Together since');

      expect(dateRow()).toHaveAccessibleName('Date, Not set');
    });

    it('leaves the Date row empty and disabled until the couple settings have loaded', async () => {
      setDates({ coupleSettings: null, partner: null, partnerKnown: false });
      renderAt('dates/together-since');
      await heading('Together since');

      expect(dateRow()).toBeDisabled();
      expect(dateRow()).toHaveAccessibleName('Date');
      expect(dateRow()).not.toHaveTextContent(/Not set|Loading/);
      expect(window.location.pathname).toBe('/settings/dates/together-since');
    });

    it('has no Clear', async () => {
      renderAt('dates/together-since');
      await heading('Together since');

      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('falls back to the Dates list when the couple is unlinked', async () => {
      setDates({ coupleSettings: { status: 'unlinked' } });
      renderAt('dates/together-since');

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('falls back when the couple is not loaded and the partner read says unlinked', async () => {
      setDates({
        coupleSettings: null,
        partner: null,
        partnerKnown: true,
        partnerLoadError: false,
      });
      renderAt('dates/together-since');

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('does not fall back after a failed partner read', async () => {
      setDates({ coupleSettings: null, partner: null, partnerKnown: true, partnerLoadError: true });
      renderAt('dates/together-since');
      await heading('Together since');

      expect(window.location.pathname).toBe('/settings/dates/together-since');
    });

    it('goes back once, however often the state changes', async () => {
      // Stubbed: a real back lands on whatever entry an earlier case left, whose
      // page may fall back on its own and count a second call.
      const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      window.history.replaceState(
        { view: 'settings', settingsPath: 'dates/together-since', inApp: true },
        '',
        '/settings/dates/together-since'
      );
      useAppStore.setState({ settingsPath: 'dates/together-since' });
      setDates({ coupleSettings: { status: 'unlinked' } });
      // StrictMode replays the effect, which the once-per-mount guard must survive.
      render(
        <StrictMode>
          <Settings />
        </StrictMode>
      );

      await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
      setDates({ coupleSettings: { status: 'unlinked' }, partnerKnown: false });
      expect(back).toHaveBeenCalledTimes(1);
    });

    describe('the Date page', () => {
      it('shows the page above after a reload', async () => {
        renderAt('dates/together-since/date');

        expect(await heading('Together since')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/together-since');
      });

      it('opens from the Date row with one datetime-local field, in local time', async () => {
        const user = userEvent.setup();
        await openFromDates(user, 'settings-dates-together-since');
        await heading('Together since');
        await user.click(dateRow());

        expect(await heading('Date')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/together-since/date');
        const field = screen.getByTestId('settings-together-since-field');
        expect(field).toHaveAttribute('type', 'datetime-local');
        expect(field).toHaveValue('2022-02-03T12:00');
        expect(field).toHaveAttribute('max', toLocalDateTime(new Date().toISOString()));
        expect(saveButton()).toBeDisabled();
        expect(document.querySelectorAll('input')).toHaveLength(1);
      });

      it('opens a loaded Not set straight from the Dates list, with an empty field', async () => {
        const user = userEvent.setup();
        setDates({ coupleSettings: UNSET });
        await openFromDates(user, 'settings-dates-together-since');

        expect(await heading('Date')).toBeInTheDocument();
        expect(screen.getByTestId('settings-together-since-field')).toHaveValue('');
        expect(saveButton()).toBeDisabled();
      });

      it('saves local date and time as one instant, goes back a level, row shows it', async () => {
        const user = userEvent.setup();
        setRelationshipStart.mockImplementation(async (iso: string) => {
          act(() => {
            useAppStore.setState({ coupleSettings: { ...LINKED, relationshipStart: iso } });
          });
        });
        await openFromDates(user, 'settings-dates-together-since');
        await heading('Together since');
        await user.click(dateRow());
        await heading('Date');

        fireEvent.change(screen.getByTestId('settings-together-since-field'), {
          target: { value: '2025-10-04T18:00' },
        });
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        await waitFor(() =>
          expect(setRelationshipStart).toHaveBeenCalledWith(
            new Date(2025, 9, 4, 18, 0).toISOString()
          )
        );
        expect(await heading('Together since')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/together-since');
        expect(dateRow()).toHaveTextContent(
          formatListDate(new Date(2025, 9, 4, 18, 0), new Date())
        );
      });

      it('keeps Save off for an empty or unchanged value', async () => {
        renderAt('dates/together-since');
        await heading('Together since');
        await userEvent.setup().click(dateRow());
        await heading('Date');

        fireEvent.change(screen.getByTestId('settings-together-since-field'), {
          target: { value: '' },
        });
        expect(saveButton()).toBeDisabled();
        fireEvent.change(screen.getByTestId('settings-together-since-field'), {
          target: { value: '2022-02-03T12:00' },
        });
        expect(saveButton()).toBeDisabled();
      });

      it('refuses offline before any request, in the Error box, keeping the field', async () => {
        const user = userEvent.setup();
        await openFromDates(user, 'settings-dates-together-since');
        await heading('Together since');
        await user.click(dateRow());
        await heading('Date');
        fireEvent.change(screen.getByTestId('settings-together-since-field'), {
          target: { value: '2025-10-04T18:00' },
        });
        setOnline(false);

        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          offlineMessage('Couple settings')
        );
        expect(setRelationshipStart).not.toHaveBeenCalled();
        expect(screen.getByTestId('settings-together-since-field')).toHaveValue('2025-10-04T18:00');
        expect(window.location.pathname).toBe('/settings/dates/together-since/date');
      });

      it("shows the service's message and stays when the save fails", async () => {
        const user = userEvent.setup();
        setRelationshipStart.mockRejectedValue(
          new AccountDataError('transport', 'Could not reach your account to save the start date.')
        );
        await openFromDates(user, 'settings-dates-together-since');
        await heading('Together since');
        await user.click(dateRow());
        await heading('Date');
        fireEvent.change(screen.getByTestId('settings-together-since-field'), {
          target: { value: '2025-10-04T18:00' },
        });

        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          'Could not reach your account to save the start date.'
        );
        expect(screen.getByTestId('settings-together-since-field')).toHaveValue('2025-10-04T18:00');
      });

      describe('"in the past", against a pinned clock', () => {
        // Only `Date` is faked, so Testing Library's waits keep their real timers.
        beforeEach(() => {
          vi.useFakeTimers({ toFake: ['Date'] });
          vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0, 0));
        });

        async function openDatePage(user: UserEvent) {
          await openFromDates(user, 'settings-dates-together-since');
          await heading('Together since');
          await user.click(dateRow());
          await heading('Date');
          return screen.getByTestId('settings-together-since-field');
        }

        it('keeps Save off for a start in the future, tomorrow and a minute from now', async () => {
          const user = userEvent.setup();
          const field = await openDatePage(user);

          fireEvent.change(field, { target: { value: '2026-09-26T09:00' } });
          expect(saveButton()).toBeDisabled();
          fireEvent.change(field, { target: { value: '2026-09-25T12:01' } });
          expect(saveButton()).toBeDisabled();
          expect(setRelationshipStart).not.toHaveBeenCalled();
        });

        it('accepts a start at exactly now', async () => {
          const user = userEvent.setup();
          const field = await openDatePage(user);

          fireEvent.change(field, { target: { value: '2026-09-25T12:00' } });
          expect(saveButton()).toBeEnabled();
          await user.click(saveButton());

          await waitFor(() =>
            expect(setRelationshipStart).toHaveBeenCalledWith(
              new Date(2026, 8, 25, 12, 0).toISOString()
            )
          );
        });
      });
    });
  });

  describe('Wedding', () => {
    it('shows the date, then a centered danger Clear alone in its own card', async () => {
      renderAt('dates/wedding');
      await heading('Wedding');

      const value = formatListDate(new Date(2024, 5, 15), new Date());
      expect(dateRow()).toHaveAccessibleName(`Date, ${value}`);
      expect(dateRow()).toHaveAttribute('data-settings-target', 'dates/wedding/date');
      const clear = screen.getByTestId('settings-wedding-clear');
      expect(clear).toHaveTextContent('Clear');
      expect(clear).toHaveClass('justify-center', 'text-danger');
      expect(clear.parentElement?.children).toHaveLength(1);
      expect(clear.parentElement).not.toBe(dateRow().parentElement);
    });

    it('reads Not set with no Clear while no date is set', async () => {
      setDates({ coupleSettings: UNSET });
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(dateRow()).toHaveAccessibleName('Date, Not set');
      expect(screen.queryByTestId('settings-wedding-clear')).not.toBeInTheDocument();
    });

    it('leaves the Date row empty and disabled until the couple loads, with no Clear', async () => {
      setDates({ coupleSettings: null, partner: null, partnerKnown: false });
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(dateRow()).toBeDisabled();
      expect(dateRow()).toHaveAccessibleName('Date');
      expect(screen.queryByTestId('settings-wedding-clear')).not.toBeInTheDocument();
    });

    it('falls back to the Dates list when the couple is unlinked', async () => {
      setDates({ coupleSettings: { status: 'unlinked' } });
      renderAt('dates/wedding');

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    describe('Clear', () => {
      /** The store's own write, so the Dates list reads what the page left. */
      function clearsTheStore() {
        setWeddingDate.mockImplementation(async (value: string | null) => {
          act(() => {
            useAppStore.setState({ coupleSettings: { ...LINKED, weddingDate: value } });
          });
        });
      }

      it('clears online, returns to the Dates list and its Wedding row reads Not set', async () => {
        const user = userEvent.setup();
        clearsTheStore();
        await openFromDates(user, 'settings-dates-wedding');
        await heading('Wedding');

        await user.click(screen.getByTestId('settings-wedding-clear'));

        await waitFor(() => expect(setWeddingDate).toHaveBeenCalledWith(null));
        expect(await heading('Dates')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates');
        expect(screen.getByTestId('settings-dates-wedding')).toHaveAccessibleName(
          'Wedding, Not set'
        );
      });

      it('is disabled while it runs', async () => {
        const user = userEvent.setup();
        let release: () => void = () => {};
        setWeddingDate.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
        renderAt('dates/wedding');
        await heading('Wedding');

        await user.click(screen.getByTestId('settings-wedding-clear'));

        expect(screen.getByTestId('settings-wedding-clear')).toBeDisabled();
        release();
        await waitFor(() => expect(window.location.pathname).toBe('/settings/dates'));
      });

      it('refuses offline before any request, in the page Error box', async () => {
        const user = userEvent.setup();
        renderAt('dates/wedding');
        await heading('Wedding');
        setOnline(false);

        await user.click(screen.getByTestId('settings-wedding-clear'));

        expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
          offlineMessage('Couple settings')
        );
        expect(setWeddingDate).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/settings/dates/wedding');
      });

      it('shows the failure and stays, with Clear usable again', async () => {
        const user = userEvent.setup();
        setWeddingDate.mockRejectedValue(
          new AccountDataError(
            'transport',
            'Could not reach your account to save the wedding date.'
          )
        );
        renderAt('dates/wedding');
        await heading('Wedding');

        await user.click(screen.getByTestId('settings-wedding-clear'));

        expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
          'Could not reach your account to save the wedding date.'
        );
        expect(window.location.pathname).toBe('/settings/dates/wedding');
        expect(screen.getByTestId('settings-wedding-clear')).toBeEnabled();
      });
    });

    describe('the Date page', () => {
      it('shows the page above after a reload', async () => {
        renderAt('dates/wedding/date');

        expect(await heading('Wedding')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/wedding');
      });

      it('opens a date field prefilled with the saved date, Save off', async () => {
        const user = userEvent.setup();
        await openFromDates(user, 'settings-dates-wedding');
        await heading('Wedding');
        await user.click(dateRow());

        expect(await heading('Date')).toBeInTheDocument();
        const field = screen.getByTestId('settings-wedding-field');
        expect(field).toHaveAttribute('type', 'date');
        expect(field).toHaveValue('2024-06-15');
        expect(saveButton()).toBeDisabled();
      });

      it('opens a loaded Not set from the list; saves any date, even a future one', async () => {
        const user = userEvent.setup();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0));
        setDates({ coupleSettings: UNSET });
        setWeddingDate.mockImplementation(async (value: string | null) => {
          act(() => {
            useAppStore.setState({ coupleSettings: { ...UNSET, weddingDate: value } });
          });
        });
        await openFromDates(user, 'settings-dates-wedding');
        expect(await heading('Date')).toBeInTheDocument();
        expect(screen.getByTestId('settings-wedding-field')).toHaveValue('');

        fireEvent.change(screen.getByTestId('settings-wedding-field'), {
          target: { value: '2027-06-19' },
        });
        await user.click(saveButton());

        await waitFor(() => expect(setWeddingDate).toHaveBeenCalledWith('2027-06-19'));
        // It was opened from the Dates list, so one level back is the list.
        expect(await heading('Dates')).toBeInTheDocument();
        expect(screen.getByTestId('settings-dates-wedding')).toHaveAccessibleName(
          'Wedding, 19 Jun 2027'
        );
      });

      it('keeps Save off for an empty value, and refuses offline with the field kept', async () => {
        const user = userEvent.setup();
        await openFromDates(user, 'settings-dates-wedding');
        await heading('Wedding');
        await user.click(dateRow());
        await heading('Date');

        fireEvent.change(screen.getByTestId('settings-wedding-field'), { target: { value: '' } });
        expect(saveButton()).toBeDisabled();

        fireEvent.change(screen.getByTestId('settings-wedding-field'), {
          target: { value: '2025-01-02' },
        });
        setOnline(false);
        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          offlineMessage('Couple settings')
        );
        expect(setWeddingDate).not.toHaveBeenCalled();
        expect(screen.getByTestId('settings-wedding-field')).toHaveValue('2025-01-02');
      });

      it("shows the service's message and stays when the save fails", async () => {
        const user = userEvent.setup();
        setWeddingDate.mockRejectedValue(
          new Error('Link a partner first to set your wedding date')
        );
        await openFromDates(user, 'settings-dates-wedding');
        await heading('Wedding');
        await user.click(dateRow());
        await heading('Date');
        fireEvent.change(screen.getByTestId('settings-wedding-field'), {
          target: { value: '2025-01-02' },
        });

        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          'Link a partner first to set your wedding date'
        );
        expect(window.location.pathname).toBe('/settings/dates/wedding/date');
      });
    });
  });

  describe('Your birthday', () => {
    it('shows the day and month, opening the birthday field', async () => {
      setDates({ ownBirthday: '1996-12-24' });
      renderAt('dates/birthday');
      await heading('Your birthday');

      expect(dateRow()).toHaveAccessibleName(`Date, ${formatDayMonth(new Date(1996, 11, 24))}`);
      expect(dateRow()).toHaveAttribute('data-settings-target', 'dates/birthday/date');
      expect(screen.getByTestId('settings-your-birthday-page')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-wedding-clear')).not.toBeInTheDocument();
    });

    it('reads Not set when the birthday is not set', async () => {
      renderAt('dates/birthday');
      await heading('Your birthday');

      expect(dateRow()).toHaveAccessibleName('Date, Not set');
      expect(dateRow()).toBeEnabled();
    });

    it('is empty and disabled while the profile is unknown, enabled after a failure', async () => {
      setDates({ ownBirthday: 'unloaded' });
      backend.fetchOwnProfile.mockReturnValue(new Promise(() => {}));
      renderAt('dates/birthday');
      await heading('Your birthday');

      expect(dateRow()).toBeDisabled();
      expect(dateRow()).toHaveAccessibleName('Date');

      act(() => {
        useAppStore.setState({ ownProfileLoadFailed: true });
      });
      expect(dateRow()).toBeEnabled();
      expect(dateRow()).toHaveAccessibleName('Date');
    });

    it('opens the birthday page titled Date, a past-only date field prefilled', async () => {
      const user = userEvent.setup();
      setDates({ ownBirthday: '1996-12-24' });
      await openFromDates(user, 'settings-dates-birthday-self');
      await heading('Your birthday');
      await user.click(dateRow());

      expect(await heading('Date')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/birthday/date');
      const field = screen.getByTestId('settings-birthday-field');
      expect(field).toHaveAttribute('type', 'date');
      expect(field).toHaveValue('1996-12-24');
      expect(field).toHaveAttribute('max');
      expect(saveButton()).toBeDisabled();
    });

    it('shows the page above after a reload of the Date page', async () => {
      renderAt('dates/birthday/date');

      expect(await heading('Your birthday')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/birthday');
    });

    it('is never absent: an unlinked couple keeps the page', async () => {
      setDates({ coupleSettings: { status: 'unlinked' }, partner: null });
      renderAt('dates/birthday');
      await heading('Your birthday');

      expect(window.location.pathname).toBe('/settings/dates/birthday');
    });
  });

  describe("the partner's birthday", () => {
    it("is titled with the partner's name, a read-only Date row, Footnote, no Remind", async () => {
      renderAt('dates/partner-birthday');
      await heading("Harper's birthday");

      const row = screen.getByTestId('settings-partner-birthday-date');
      expect(row).toHaveTextContent('Date');
      expect(row).toHaveTextContent(formatDayMonth(new Date(1991, 3, 4)));
      expect(row.tagName).not.toBe('BUTTON');
      expect(row.querySelector('svg')).toBeNull();
      expect(screen.queryByTestId('settings-date-row')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-partner-birthday-footnote')).toHaveTextContent(
        'Harper sets this in their Profile.'
      );
      expect(screen.queryByTestId('settings-remind-me')).not.toBeInTheDocument();
    });

    it('reads Not set when the partner has no birthday, with the same Footnote', async () => {
      setDates({ partner: { ...PARTNER, birthday: null } });
      renderAt('dates/partner-birthday');
      await heading("Harper's birthday");

      expect(screen.getByTestId('settings-partner-birthday-date')).toHaveTextContent('Not set');
      expect(screen.getByTestId('settings-partner-birthday-footnote')).toBeInTheDocument();
    });

    it('with the partner not known yet is titled Birthday with nothing under it', async () => {
      setDates({ partner: null, partnerKnown: false });
      renderAt('dates/partner-birthday');
      await heading('Birthday');

      expect(screen.getByTestId('settings-partner-birthday-page')).toBeEmptyDOMElement();
      expect(window.location.pathname).toBe('/settings/dates/partner-birthday');
    });

    it('with a failed partner read stays, as Birthday with nothing under it', async () => {
      setDates({ partner: null, partnerKnown: true, partnerLoadError: true });
      renderAt('dates/partner-birthday');
      await heading('Birthday');

      expect(screen.getByTestId('settings-partner-birthday-page')).toBeEmptyDOMElement();
      expect(window.location.pathname).toBe('/settings/dates/partner-birthday');
    });

    it('falls back to the Dates list when the partner is confirmed absent', async () => {
      setDates({ partner: null, partnerKnown: true, partnerLoadError: false });
      renderAt('dates/partner-birthday');

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });
  });

  describe('Remind me', () => {
    beforeEach(() => {
      capacitor.isNativePlatform.mockReturnValue(true);
    });

    it('is not drawn without the local-notifications plugin, and loads nothing', async () => {
      capacitor.isPluginAvailable.mockImplementation(
        (name: string) => name !== 'LocalNotifications'
      );
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(screen.queryByTestId('settings-remind-me')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-remind-me-footnote')).not.toBeInTheDocument();
      expect(useAppStore.getState().loadCountdownMarks).not.toHaveBeenCalled();
    });

    it('loads the marks and the push preferences when it opens', async () => {
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(useAppStore.getState().loadCountdownMarks).toHaveBeenCalled();
      expect(useAppStore.getState().loadPushPreferences).toHaveBeenCalled();
    });

    it.each([
      ['dates/together-since', 'Together since', 'relationship-start'],
      ['dates/wedding', 'Wedding', 'wedding'],
      ['dates/birthday', 'Your birthday', 'own-birthday'],
      ['dates/partner-birthday', "Harper's birthday", 'partner-birthday'],
    ])('on %s is on by default, and a tap turns its own key off', async (path, title, key) => {
      const user = userEvent.setup();
      renderAt(path);
      await heading(title);

      expect(remindMe()).toHaveAttribute('aria-checked', 'true');
      expect(remindMe()).toHaveAccessibleName('Remind me');
      expect(remindMe()).toBeEnabled();
      expect(footnote()).toHaveTextContent('A month and a week before.');

      await user.click(remindMe());
      expect(setCountdownMark).toHaveBeenCalledWith(key, false);
    });

    it('is off while its key is switched off, and a tap turns it back on', async () => {
      const user = userEvent.setup();
      setDates({ remindersOff: ['wedding', 'own-birthday'] });
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(remindMe()).toHaveAttribute('aria-checked', 'false');
      await user.click(remindMe());
      expect(setCountdownMark).toHaveBeenCalledWith('wedding', true);
    });

    it('is disabled while its save is in flight', async () => {
      const user = userEvent.setup();
      let release: () => void = () => {};
      setCountdownMark.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
      renderAt('dates/wedding');
      await heading('Wedding');

      await user.click(remindMe());
      expect(remindMe()).toBeDisabled();

      await act(async () => release());
      await waitFor(() => expect(remindMe()).toBeEnabled());
    });

    it('is disabled, showing the default on, until the switches have loaded', async () => {
      setDates({ remindersOff: null });
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(remindMe()).toBeDisabled();
      expect(remindMe()).toHaveAttribute('aria-checked', 'true');
    });

    it('is disabled with the Notifications Footnote while Date reminders is off', async () => {
      setDates({ remindersOff: [], dateReminders: false });
      renderAt('dates/wedding');
      await heading('Wedding');

      expect(remindMe()).toBeDisabled();
      expect(remindMe()).toHaveClass('disabled:opacity-60');
      expect(remindMe()).toHaveAttribute('aria-checked', 'true');
      expect(footnote()).toHaveTextContent(
        'Date reminders are off. Turn them on in Notifications.'
      );
    });

    it('refuses offline before any request, leaving the switch as it was', async () => {
      const user = userEvent.setup();
      renderAt('dates/wedding');
      await heading('Wedding');
      setOnline(false);

      await user.click(remindMe());

      expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
        offlineMessage('Reminders')
      );
      expect(setCountdownMark).not.toHaveBeenCalled();
      expect(remindMe()).toHaveAttribute('aria-checked', 'true');
    });

    it('shows a failed save in the page Error box, and the next tap clears it', async () => {
      const user = userEvent.setup();
      setCountdownMark.mockRejectedValueOnce(new Error('Could not reach the server.'));
      renderAt('dates/partner-birthday');
      await heading("Harper's birthday");

      await user.click(remindMe());
      expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
        'Could not reach the server.'
      );
      expect(remindMe()).toHaveAttribute('aria-checked', 'true');

      await user.click(remindMe());
      await waitFor(() =>
        expect(screen.queryByTestId('settings-date-error')).not.toBeInTheDocument()
      );
    });

    it('puts the Error box above the first card', async () => {
      const user = userEvent.setup();
      setCountdownMark.mockRejectedValueOnce(new Error('Could not reach the server.'));
      renderAt('dates/wedding');
      await heading('Wedding');

      await user.click(remindMe());

      const error = await screen.findByTestId('settings-date-error');
      expect(error).toHaveAttribute('role', 'alert');
      expect(screen.getByTestId('settings-wedding-page').firstElementChild).toBe(error);
    });
  });
});
