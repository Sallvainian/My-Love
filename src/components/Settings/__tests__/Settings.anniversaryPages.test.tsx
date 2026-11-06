/**
 * Settings > Dates > an anniversary's own page (`AnniversaryPages`):
 * `dates/anniversary/<key>` and its three one-field pages (`…/name`, `…/date`,
 * `…/note`), the delete Confirmation dialog (`ConfirmDialog`) and the Remind me
 * group.
 *
 * The real store and the real Settings stack are mounted. Each case sets the
 * slices the pages read with `useAppStore.setState`; the store actions that
 * load and write (`loadAnniversariesFromServer`, `updateAnniversary`,
 * `removeAnniversary`, `setCountdownMark`) are stubs that move the store the
 * way the real ones do, so a case is about the page. Capacitor is mocked on
 * for the Remind me cases and off for the rest.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerInfo } from '../../../api/partnerService';
import type { AnniversaryInput } from '../../../services/anniversariesService';
import type { CoupleSettings } from '../../../stores/slices/datesSlice';
import type { Anniversary } from '../../../types';

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
import { ALL_PUSH_PREFERENCES_ON } from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { renderAt } from './settingsPageKit';
import { yearlyValue } from '../settingsFields';
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
  loadAnniversariesFromServer: useAppStore.getState().loadAnniversariesFromServer,
  updateAnniversary: useAppStore.getState().updateAnniversary,
  removeAnniversary: useAppStore.getState().removeAnniversary,
  setCountdownMark: useAppStore.getState().setCountdownMark,
  loadCountdownMarks: useAppStore.getState().loadCountdownMarks,
  loadPushPreferences: useAppStore.getState().loadPushPreferences,
};

const loadAnniversaries = vi.fn<() => Promise<boolean>>();
const updateAnniversary = vi.fn<(id: number, input: AnniversaryInput) => Promise<void>>();
const removeAnniversary = vi.fn<(id: number) => Promise<void>>();
const setCountdownMark = vi.fn();

let accountCounter = 0;

function makeAnniversary(overrides: Partial<Anniversary> = {}): Anniversary {
  return {
    id: 1,
    serverId: 'srv-1',
    label: 'First date',
    date: '2022-04-04',
    description: 'The cafe',
    ...overrides,
  };
}

function setAnniversaries(anniversaries: Anniversary[]) {
  act(() => useAppStore.setState({ settings: { relationship: { anniversaries } } }));
}

const storedAnniversaries = () => useAppStore.getState().settings?.relationship.anniversaries ?? [];

/** Opens `/settings/dates` and taps the anniversary's row, so the page is pushed in the mounted stack. */
async function openFromDates(user: UserEvent, key = 'srv-1') {
  renderAt('dates');
  expect(await screen.findByRole('heading', { level: 1, name: 'Dates' })).toBeInTheDocument();
  await user.click(screen.getByTestId(`settings-dates-anniversary-${key}`));
}

/** Opens the page from the Dates list, then one of its field rows. */
async function openField(user: UserEvent, field: 'name' | 'date' | 'note', title: string) {
  await openFromDates(user);
  await user.click(await screen.findByTestId(`settings-anniversary-${field}`));
  await heading(title);
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const saveButton = () => screen.getByTestId('settings-field-save');
const fieldError = () => screen.getByTestId('settings-field-error');
const pageError = () => screen.getByTestId('settings-date-error');
const remindMe = () => screen.queryByTestId('settings-remind-me');
const deleteRow = () => screen.getByTestId('settings-anniversary-delete');
const dialog = () => screen.queryByTestId('settings-anniversary-delete-confirmation');

/** The count of `replaceState` calls that rewrote the URL to `route`. */
const replacesTo = (spy: { mock: { calls: unknown[][] } }, route: string) =>
  spy.mock.calls.filter((call) => call[2] === route).length;

describe("Settings > Dates > an anniversary's page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    capacitor.isNativePlatform.mockReturnValue(false);
    capacitor.isPluginAvailable.mockReturnValue(true);
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Casey', birthday: null });
    loadAnniversaries.mockResolvedValue(true);
    // The real actions move the store before they resolve; so do these.
    updateAnniversary.mockImplementation(async (id, input) => {
      act(() =>
        useAppStore.setState((state) => ({
          settings: {
            relationship: {
              anniversaries: (state.settings?.relationship.anniversaries ?? []).map((a) =>
                a.id === id
                  ? {
                      id: a.id,
                      serverId: a.serverId,
                      label: input.label,
                      date: input.date,
                      ...(input.description ? { description: input.description } : {}),
                    }
                  : a
              ),
            },
          },
        }))
      );
    });
    removeAnniversary.mockImplementation(async (id) => {
      act(() =>
        useAppStore.setState((state) => ({
          settings: {
            relationship: {
              anniversaries: (state.settings?.relationship.anniversaries ?? []).filter(
                (a) => a.id !== id
              ),
            },
          },
        }))
      );
    });
    setCountdownMark.mockResolvedValue(undefined);
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
      loadAnniversariesFromServer: loadAnniversaries,
      updateAnniversary,
      removeAnniversary,
      setCountdownMark,
      loadCountdownMarks: vi.fn().mockResolvedValue(undefined),
      loadPushPreferences: vi.fn().mockResolvedValue(undefined),
      syncStatus: { ...useAppStore.getState().syncStatus, isOnline: true },
      coupleSettings: LINKED,
      partner: PARTNER,
      partnerKnown: true,
      partnerLoadError: false,
      ownProfile: { displayName: 'Casey', birthday: null },
      remindersOff: [],
      pushPreferences: { ...ALL_PUSH_PREFERENCES_ON },
      settings: { relationship: { anniversaries: [makeAnniversary()] } },
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
      remindersOff: null,
      pushPreferences: null,
      events: [],
      settings: null,
    });
  });

  describe('a held anniversary', () => {
    it('opens from its Dates row titled with the anniversary, lists Name, Date and Note, and back returns to the Dates list', async () => {
      const user = userEvent.setup();
      await openFromDates(user);

      expect(await heading('First date')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
      // A small title: the bar's own title is drawn only for a large page.
      expect(screen.queryByTestId('settings-bar-title')).not.toBeInTheDocument();
      expect(screen.getByTestId('settings-anniversary-page')).toBeInTheDocument();

      const rows = [
        ['settings-anniversary-name', 'Name, First date', 'name'],
        ['settings-anniversary-date', `Date, ${yearlyValue('2022-04-04')}`, 'date'],
        ['settings-anniversary-note', 'Note, The cafe', 'note'],
      ] as const;
      for (const [testId, name, field] of rows) {
        expect(screen.getByTestId(testId)).toHaveAccessibleName(name);
        expect(screen.getByTestId(testId)).toHaveAttribute(
          'data-settings-target',
          `dates/anniversary/srv-1/${field}`
        );
      }
      // An anniversary has no icon.
      expect(screen.queryByTestId('settings-anniversary-icon')).not.toBeInTheDocument();
      expect(screen.queryByText('Icon')).not.toBeInTheDocument();
      expect(deleteRow()).toHaveTextContent('Delete anniversary');
      // Delete sits alone in its own card.
      expect(deleteRow().parentElement?.children).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });

    it('keys an anniversary with no server id by its device id', async () => {
      setAnniversaries([makeAnniversary({ id: 7, serverId: undefined })]);
      renderAt('dates/anniversary/7');

      expect(await heading('First date')).toBeInTheDocument();
      expect(screen.getByTestId('settings-anniversary-name')).toHaveAttribute(
        'data-settings-target',
        'dates/anniversary/7/name'
      );
    });

    it('shows a Note row with no value when there is no note', async () => {
      setAnniversaries([makeAnniversary({ description: undefined })]);
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      expect(screen.getByTestId('settings-anniversary-note')).toHaveAccessibleName('Note');
      expect(screen.getByTestId('settings-anniversary-note')).toHaveTextContent(/^Note$/);
    });

    it('lets a long name and note truncate inside the card', async () => {
      const long = 'x'.repeat(300);
      setAnniversaries([makeAnniversary({ label: long, description: long })]);
      renderAt('dates/anniversary/srv-1');
      await heading(long);

      for (const testId of ['settings-anniversary-name', 'settings-anniversary-note']) {
        const value = screen.getByTestId(testId).querySelector('span.truncate:last-of-type');
        expect(value).toHaveClass('min-w-0', 'truncate', 'max-w-[60%]');
      }
    });

    it('stays on the page after a reload', async () => {
      renderAt('dates/anniversary/srv-1');

      expect(await heading('First date')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
    });

    it('sends no read for a held anniversary, and stays open when a load would drop it', async () => {
      loadAnniversaries.mockImplementation(async () => {
        setAnniversaries([]);
        return true;
      });
      renderAt('dates/anniversary/srv-1', true);

      expect(await heading('First date')).toBeInTheDocument();
      await act(async () => {});
      act(() =>
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } })
      );
      await act(async () => {});

      expect(loadAnniversaries).not.toHaveBeenCalled();
      expect(screen.getByTestId('settings-anniversary-page')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
    });
  });

  describe('Remind me', () => {
    beforeEach(() => {
      capacitor.isNativePlatform.mockReturnValue(true);
    });

    it("is the anniversary's own switch, on by default, and a tap writes it", async () => {
      const user = userEvent.setup();
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      // On by default (2026-11-05): a tap switches it off.
      expect(remindMe()).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('settings-remind-me-footnote')).toHaveTextContent(
        'A month and a week before.'
      );

      await user.click(remindMe()!);

      expect(setCountdownMark).toHaveBeenCalledWith('anniversary:srv-1', false);
    });

    it('shows on an anniversary whose date is long past, because it recurs', async () => {
      setAnniversaries([makeAnniversary({ date: '2001-01-01' })]);
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      expect(remindMe()).toBeInTheDocument();
    });

    it('is hidden while the anniversary has no server id', async () => {
      setAnniversaries([makeAnniversary({ id: 7, serverId: undefined })]);
      renderAt('dates/anniversary/7');
      await heading('First date');

      expect(remindMe()).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-remind-me-footnote')).not.toBeInTheDocument();
    });

    it('is not drawn without the local-notifications plugin', async () => {
      capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      expect(remindMe()).not.toBeInTheDocument();
    });

    it('is not drawn off the native shell', async () => {
      capacitor.isNativePlatform.mockReturnValue(false);
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      expect(remindMe()).not.toBeInTheDocument();
    });

    it('shows a failed save in the page Error box', async () => {
      const user = userEvent.setup();
      setCountdownMark.mockRejectedValue(new Error('Could not save your reminder.'));
      renderAt('dates/anniversary/srv-1');
      await heading('First date');

      await user.click(remindMe()!);

      expect(await screen.findByTestId('settings-date-error')).toHaveTextContent(
        'Could not save your reminder.'
      );
    });
  });

  describe('an anniversary the store does not hold', () => {
    beforeEach(() => {
      setAnniversaries([]);
    });

    it('is titled `Anniversary` with nothing under the bar until its own load answers', async () => {
      const load = deferred<boolean>();
      loadAnniversaries.mockReturnValue(load.promise);
      renderAt('dates/anniversary/srv-1');

      expect(await heading('Anniversary')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-anniversary-page')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');

      // The answer carries the anniversary: the page fills in, in place.
      setAnniversaries([makeAnniversary()]);
      await act(async () => load.settle(true));

      expect(await heading('First date')).toBeInTheDocument();
      expect(screen.getByTestId('settings-anniversary-page')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
    });

    it('falls back to the Dates list once, under StrictMode, when the load answers without it', async () => {
      const replace = vi.spyOn(window.history, 'replaceState');
      renderAt('dates/anniversary/srv-1', true);

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
    });

    it('never falls back on a load that did not answer', async () => {
      loadAnniversaries.mockResolvedValue(false);
      renderAt('dates/anniversary/srv-1');
      await heading('Anniversary');
      await act(async () => {});

      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
      expect(screen.queryByRole('heading', { level: 1, name: 'Dates' })).not.toBeInTheDocument();
    });

    it('asks again when the connection changes, and falls back only on its own answer', async () => {
      loadAnniversaries.mockResolvedValueOnce(false);
      renderAt('dates/anniversary/srv-1');
      await heading('Anniversary');
      expect(loadAnniversaries).toHaveBeenCalledTimes(1);

      loadAnniversaries.mockResolvedValue(true);
      act(() =>
        useAppStore.setState({ syncStatus: { ...useAppStore.getState().syncStatus, isOnline: false } })
      );

      expect(await heading('Dates')).toBeInTheDocument();
      expect(loadAnniversaries.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('renders no field on a field page for an unknown anniversary', async () => {
      renderAt('dates/anniversary/srv-1');
      await heading('Dates');

      act(() => useAppStore.getState().openSettingsPage('dates/anniversary/srv-1/name'));

      await heading('Name');
      expect(screen.queryByTestId('settings-field-save')).not.toBeInTheDocument();
      expect(document.querySelector('input, textarea')).toBeNull();
    });
  });

  describe('the one-field pages', () => {
    it.each([
      ['name', 'settings-anniversary-name-field'],
      ['date', 'settings-anniversary-date-field'],
      ['note', 'settings-anniversary-note-field'],
    ])('go up to the anniversary page on a reload (%s)', async (field, fieldTestId) => {
      renderAt(`dates/anniversary/srv-1/${field}`);

      expect(await heading('First date')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
      expect(screen.queryByTestId(fieldTestId)).not.toBeInTheDocument();
    });

    describe('Name', () => {
      it('starts on the saved name and enables Save only for a changed, non-empty name', async () => {
        const user = userEvent.setup();
        await openField(user, 'name', 'Name');

        const field = screen.getByTestId('settings-anniversary-name-field');
        expect(field).toHaveValue('First date');
        expect(field).toHaveFocus();
        expect(saveButton()).toBeDisabled();

        await user.clear(field);
        expect(saveButton()).toBeDisabled();
        await user.type(field, '   ');
        expect(saveButton()).toBeDisabled();

        fireEvent.change(field, { target: { value: '  First date  ' } });
        expect(saveButton()).toBeDisabled();
        // No new length limit: the table checks only that a label is not empty.
        fireEvent.change(field, { target: { value: 'x'.repeat(300) } });
        expect(saveButton()).toBeEnabled();
        fireEvent.change(field, { target: { value: 'Cafe night' } });
        expect(saveButton()).toBeEnabled();
      });

      it('saves the trimmed name with the whole input, returns to the page, and the title and Dates list show it', async () => {
        const user = userEvent.setup();
        await openField(user, 'name', 'Name');

        await user.clear(screen.getByTestId('settings-anniversary-name-field'));
        await user.type(screen.getByTestId('settings-anniversary-name-field'), '  Cafe night ');
        await user.click(saveButton());

        expect(updateAnniversary).toHaveBeenCalledWith(1, {
          label: 'Cafe night',
          date: '2022-04-04',
          description: 'The cafe',
        });
        expect(await heading('Cafe night')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
        expect(screen.getByTestId('settings-anniversary-name')).toHaveAccessibleName('Name, Cafe night');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(await heading('Dates')).toBeInTheDocument();
        expect(screen.getByTestId('settings-dates-anniversary-srv-1')).toHaveAccessibleName(
          expect.stringContaining('Cafe night')
        );
      });

      it('refuses offline before any request, keeping the typed value', async () => {
        const user = userEvent.setup();
        await openField(user, 'name', 'Name');
        await user.type(screen.getByTestId('settings-anniversary-name-field'), '!');
        setOnline(false);

        await user.click(saveButton());

        expect(fieldError()).toHaveTextContent(offlineMessage('Anniversaries'));
        expect(updateAnniversary).not.toHaveBeenCalled();
        expect(screen.getByTestId('settings-anniversary-name-field')).toHaveValue('First date!');
        expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1/name');
      });

      it("shows a thrown error's message and stays", async () => {
        const user = userEvent.setup();
        updateAnniversary.mockRejectedValue(new Error('The server said no.'));
        await openField(user, 'name', 'Name');
        await user.type(screen.getByTestId('settings-anniversary-name-field'), '!');

        await user.click(saveButton());

        expect(await screen.findByTestId('settings-field-error')).toHaveTextContent(
          'The server said no.'
        );
        expect(screen.getByTestId('settings-anniversary-name-field')).toHaveValue('First date!');
        expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1/name');
      });
    });

    describe('Date', () => {
      it('is a date field holding the saved date, saved with the whole input', async () => {
        const user = userEvent.setup();
        await openField(user, 'date', 'Date');

        const field = screen.getByTestId('settings-anniversary-date-field');
        expect(field).toHaveAttribute('type', 'date');
        expect(field).toHaveValue('2022-04-04');
        expect(saveButton()).toBeDisabled();

        fireEvent.change(field, { target: { value: '2021-12-25' } });
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        expect(updateAnniversary).toHaveBeenCalledWith(1, {
          label: 'First date',
          date: '2021-12-25',
          description: 'The cafe',
        });
        expect(await heading('First date')).toBeInTheDocument();
        expect(screen.getByTestId('settings-anniversary-date')).toHaveAccessibleName(
          `Date, ${yearlyValue('2021-12-25')}`
        );
      });

      it('refuses offline before any request', async () => {
        const user = userEvent.setup();
        await openField(user, 'date', 'Date');
        fireEvent.change(screen.getByTestId('settings-anniversary-date-field'), {
          target: { value: '2021-12-25' },
        });
        setOnline(false);

        await user.click(saveButton());

        expect(fieldError()).toHaveTextContent(offlineMessage('Anniversaries'));
        expect(updateAnniversary).not.toHaveBeenCalled();
      });
    });

    describe('Note', () => {
      it('allows an empty note, saved as no description', async () => {
        const user = userEvent.setup();
        await openField(user, 'note', 'Note');

        const field = screen.getByTestId('settings-anniversary-note-field');
        expect(field.tagName).toBe('TEXTAREA');
        expect(field).toHaveValue('The cafe');

        fireEvent.change(field, { target: { value: '' } });
        expect(saveButton()).toBeEnabled();
        await user.click(saveButton());

        expect(updateAnniversary).toHaveBeenCalledTimes(1);
        const [id, input] = updateAnniversary.mock.calls[0];
        expect(id).toBe(1);
        expect(input).toEqual({ label: 'First date', date: '2022-04-04' });
        expect(input.description).toBeUndefined();
        expect(await heading('First date')).toBeInTheDocument();
        expect(screen.getByTestId('settings-anniversary-note')).toHaveAccessibleName('Note');
        expect(storedAnniversaries()[0].description).toBeUndefined();
      });

      it('saves a new note trimmed', async () => {
        const user = userEvent.setup();
        await openField(user, 'note', 'Note');

        fireEvent.change(screen.getByTestId('settings-anniversary-note-field'), {
          target: { value: '  The other cafe  ' },
        });
        await user.click(saveButton());

        expect(updateAnniversary).toHaveBeenCalledWith(1, {
          label: 'First date',
          date: '2022-04-04',
          description: 'The other cafe',
        });
        expect(await screen.findByTestId('settings-anniversary-note')).toHaveAccessibleName(
          'Note, The other cafe'
        );
      });
    });
  });

  describe('an anniversary deleted elsewhere while its page is open', () => {
    it('goes back to the Dates list once it leaves the store', async () => {
      renderAt('dates/anniversary/srv-1');
      expect(await heading('First date')).toBeInTheDocument();

      // The partner deleted it and a re-read dropped it from the store.
      setAnniversaries([]);

      expect(await heading('Dates')).toBeInTheDocument();
      expect(window.location.pathname).toBe('/settings/dates');
    });
  });

  describe('Delete anniversary', () => {
    async function openAnniversary(strict = false) {
      renderAt('dates/anniversary/srv-1', strict);
      await heading('First date');
    }

    it('asks first, with Cancel focused, and Cancel closes it with no request', async () => {
      const user = userEvent.setup();
      await openAnniversary();

      await user.click(deleteRow());

      expect(dialog()).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Delete this anniversary?' })).toBeInTheDocument();
      expect(screen.getByTestId('settings-anniversary-delete-confirmation-cancel')).toHaveFocus();
      expect(screen.getByTestId('settings-anniversary-delete-confirmation-cancel')).toHaveTextContent(
        'Cancel'
      );
      expect(screen.getByTestId('settings-anniversary-delete-confirmation-confirm')).toHaveTextContent(
        'Delete'
      );

      await user.click(screen.getByTestId('settings-anniversary-delete-confirmation-cancel'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(removeAnniversary).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
      expect(storedAnniversaries()).toHaveLength(1);
    });

    it('closes on Escape and on a tap on the scrim, with no request', async () => {
      const user = userEvent.setup();
      await openAnniversary();

      await user.click(deleteRow());
      await user.keyboard('{Escape}');
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());

      await user.click(deleteRow());
      await user.click(dialog()!);
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());

      expect(removeAnniversary).not.toHaveBeenCalled();
    });

    it('removes the anniversary online, then lands on the Dates list exactly once under StrictMode', async () => {
      const user = userEvent.setup();
      const replace = vi.spyOn(window.history, 'replaceState');
      await openAnniversary(true);

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-anniversary-delete-confirmation-confirm'));

      expect(removeAnniversary).toHaveBeenCalledWith(1);
      expect(await heading('Dates')).toBeInTheDocument();
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(window.location.pathname).toBe('/settings/dates');
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
      expect(screen.queryByTestId('settings-dates-anniversary-srv-1')).not.toBeInTheDocument();
      // The page held its anniversary, so the delete started no read: the only
      // reads are the Dates list's own on arrival, run twice by StrictMode.
      expect(loadAnniversaries).toHaveBeenCalledTimes(2);
    });

    it('closes the dialog, disables the row while it runs, and re-enables it with the error on a failure', async () => {
      const user = userEvent.setup();
      const running = deferred<void>();
      removeAnniversary.mockReturnValue(running.promise);
      await openAnniversary();

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-anniversary-delete-confirmation-confirm'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(deleteRow()).toBeDisabled();

      await act(async () => running.fail(new Error('The server said no.')));

      expect(pageError()).toHaveTextContent('The server said no.');
      expect(deleteRow()).toBeEnabled();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
      expect(screen.getByTestId('settings-anniversary-page')).toBeInTheDocument();
    });

    it('refuses offline without opening the dialog or sending a request', async () => {
      const user = userEvent.setup();
      await openAnniversary();
      setOnline(false);

      await user.click(deleteRow());

      expect(dialog()).not.toBeInTheDocument();
      expect(pageError()).toHaveTextContent(offlineMessage('Anniversaries', 'delete'));
      expect(removeAnniversary).not.toHaveBeenCalled();
    });

    it('closes the dialog and refuses when the connection drops before Delete is confirmed', async () => {
      const user = userEvent.setup();
      await openAnniversary();
      await user.click(deleteRow());
      setOnline(false);

      await user.click(screen.getByTestId('settings-anniversary-delete-confirmation-confirm'));

      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      expect(pageError()).toHaveTextContent(offlineMessage('Anniversaries', 'delete'));
      expect(removeAnniversary).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/settings/dates/anniversary/srv-1');
    });

    it('goes back once even when the absence fallback and the delete both want to', async () => {
      const user = userEvent.setup();
      const replace = vi.spyOn(window.history, 'replaceState');
      // Opened with the anniversary absent, so the page's own load answers
      // `true` and arms the fallback; the anniversary then arrives and is deleted.
      setAnniversaries([]);
      const load = deferred<boolean>();
      loadAnniversaries.mockReturnValue(load.promise);
      renderAt('dates/anniversary/srv-1', true);
      await heading('Anniversary');
      setAnniversaries([makeAnniversary()]);
      await heading('First date');
      await act(async () => load.settle(true));

      await user.click(deleteRow());
      await user.click(screen.getByTestId('settings-anniversary-delete-confirmation-confirm'));

      expect(await heading('Dates')).toBeInTheDocument();
      expect(replacesTo(replace, '/settings/dates')).toBe(1);
    });
  });
});
