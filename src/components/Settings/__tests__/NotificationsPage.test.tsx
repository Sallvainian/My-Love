/**
 * NotificationsPage — Settings > Notifications (story 6, from the section of
 * story 3.7 and the Date reminders switch of story 4.3): five push switches
 * without helper lines, the Reminders group with the Date reminders switch and
 * its Footnote, a write per toggle that goes through the store, one Error box,
 * and a notice when iOS has notifications off; plus the top page's
 * `NotificationsRow` and `notificationsSummary`. Whether the page exists at all
 * (`hasNativePush()`) is `Settings`' to decide and is tested in
 * `Settings.notifications.test.tsx`. The preferences service and the Capacitor
 * plugins are mocked; the store is the real one.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));
const push = vi.hoisted(() => ({
  checkPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
}));
const service = vi.hoisted(() => ({
  fetchPushPreferences: vi.fn(),
  savePushPreference: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => ({}),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push }));
// Sign-out (beforeEach's clearAuth) cancels the date reminders through this plugin.
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: vi.fn(() => Promise.resolve({ notifications: [] })),
    cancel: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));
vi.mock('../../../services/countdownMarksService', () => ({
  countdownMarksService: {
    fetchCountdownMarks: vi.fn(() => Promise.resolve([])),
    setCountdownMark: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../../services/pushPreferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pushPreferencesService')>()),
  pushPreferencesService: service,
}));

import { AccountDataError } from '../../../services/accountDataError';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import { deleteAccountCopies, writeLocalCopy } from '../../../services/localCopy';
import {
  ALL_PUSH_PREFERENCES_ON,
  type PushPreferences,
} from '../../../services/pushPreferencesService';
import { PUSH_PREFERENCES_COPY_KIND } from '../../../stores/slices/notificationsSlice';
import { useAppStore } from '../../../stores/useAppStore';
import { NotificationsPage, NotificationsRow } from '../NotificationsPage';
import { notificationsSummary, resetPushPermissionForTests } from '../notificationsStatus';
import { setOnline } from '../../../../tests/unit/stores/accountDataFixtures';

const ROWS = [
  ['settings-push-love-notes', 'Love notes', 'loveNotes'],
  ['settings-push-moods', 'Moods', 'moods'],
  ['settings-push-photos', 'Photos', 'photos'],
  ['settings-push-pokes-and-kisses', 'Pokes and kisses', 'pokesAndKisses'],
  ['settings-push-dates', 'Dates', 'dates'],
  ['settings-push-partner-requests', 'Partner requests', 'partnerRequests'],
] as const;

const REMINDERS_SWITCH = 'settings-reminders-switch';
const REMINDERS_OFF = { ...ALL_PUSH_PREFERENCES_ON, dateReminders: false };
const REMINDERS_FOOTNOTE = 'At 9:00 the day before, and on the day for birthdays and anniversaries.';

const DENIED_NOTICE = 'Notifications are off for My Love. Turn them on in iOS Settings.';

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/**
 * Renders the page and waits for the loaded switches to enable the rows,
 * and for the load's copy write (story 4.3) to leave the account-data queue,
 * which a click would otherwise wait behind.
 */
async function renderLoaded(preferences: PushPreferences = ALL_PUSH_PREFERENCES_ON) {
  service.fetchPushPreferences.mockResolvedValue(preferences);
  render(<NotificationsPage />);
  await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
  await serializeAccountDataWrite(async () => {});
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetPushPermissionForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  capacitor.isNativePlatform.mockReturnValue(true);
  capacitor.isPluginAvailable.mockReturnValue(true);
  push.checkPermissions.mockResolvedValue({ receive: 'granted' });
  setOnline(true);
  setVisibility('visible');
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('user-a');
  // After the identity setup: clearAuth's copy deletion is fire-and-forget, and
  // a successful load writes the account's copy into the shared fake database.
  await deleteAccountCopies('user-a');
});

afterEach(() => {
  cleanup();
  setOnline(true);
  setVisibility('visible');
  vi.restoreAllMocks();
});

describe('NotificationsPage: the groups', () => {
  it('has a Notify me about group of six switches, then a Reminders group with Date reminders', async () => {
    await renderLoaded();

    const page = screen.getByTestId('settings-notifications');
    expect(within(page).getByRole('heading', { level: 2, name: 'Notify me about' })).toBeInTheDocument();
    expect(within(page).getByRole('heading', { level: 2, name: 'Reminders' })).toBeInTheDocument();
    expect(within(page).queryByRole('heading', { name: 'Push and reminders' })).not.toBeInTheDocument();
    expect(within(page).queryByRole('heading', { name: 'Pushes' })).not.toBeInTheDocument();
    const switches = within(page).getAllByRole('switch');
    expect(switches.map((row) => row.getAttribute('data-testid'))).toEqual([
      ...ROWS.map(([id]) => id),
      REMINDERS_SWITCH,
    ]);
    const notifyGroup = screen.getByRole('region', { name: 'Notify me about' });
    expect(within(notifyGroup).getAllByRole('switch')).toHaveLength(6);
    const remindersGroup = screen.getByRole('region', { name: 'Reminders' });
    expect(within(remindersGroup).getAllByRole('switch')).toEqual([screen.getByTestId(REMINDERS_SWITCH)]);
  });

  it('labels the switches and has no helper line on any of them', async () => {
    await renderLoaded();

    for (const [id, label] of ROWS) {
      const row = screen.getByTestId(id);
      expect(row).toHaveAccessibleName(label);
      expect(row).not.toHaveAttribute('aria-describedby');
      expect(screen.queryByTestId(`${id}-helper`)).not.toBeInTheDocument();
    }
    const reminders = screen.getByTestId(REMINDERS_SWITCH);
    expect(reminders).toHaveAccessibleName('Date reminders');
    expect(reminders).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByTestId(`${REMINDERS_SWITCH}-helper`)).not.toBeInTheDocument();
    expect(reminders.querySelector('svg')).toBeInTheDocument();
  });

  it('puts the Footnote under the Reminders card', async () => {
    await renderLoaded();

    const footnote = screen.getByTestId('settings-reminders-footnote');
    expect(footnote.textContent).toBe(REMINDERS_FOOTNOTE);
    expect(
      screen.getByTestId(REMINDERS_SWITCH).compareDocumentPosition(footnote) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Reminders' })).toContainElement(footnote);
  });

  it('has no Reminders group, Footnote or Date reminders switch without the local-notifications plugin', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
    await renderLoaded();

    expect(screen.queryByRole('heading', { name: 'Reminders' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(REMINDERS_SWITCH)).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-reminders-footnote')).not.toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(6);
  });
});

describe('NotificationsPage: the rows', () => {
  it('never starts a label with "Notify me"', async () => {
    await renderLoaded();

    for (const [, label] of ROWS) expect(label).not.toMatch(/^Notify me/);
    for (const row of screen.getAllByRole('switch')) {
      expect(row.textContent ?? '').not.toMatch(/^Notify me/);
    }
  });

  it('shows the loaded state of each switch', async () => {
    await renderLoaded({ ...ALL_PUSH_PREFERENCES_ON, loveNotes: false, photos: false });

    expect(screen.getByTestId('settings-push-love-notes')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('settings-push-photos')).toHaveAttribute('aria-checked', 'false');
  });

  it('loads the switches once when the page opens', async () => {
    await renderLoaded();

    expect(service.fetchPushPreferences).toHaveBeenCalledExactlyOnceWith('user-a');
  });

  it('keeps the rows disabled until the switches have loaded', async () => {
    // Settled at the end: the account-data queue is serial, so a read left
    // pending would hold every later test's read.
    let finish!: (value: PushPreferences) => void;
    service.fetchPushPreferences.mockReturnValue(
      new Promise<PushPreferences>((resolve) => {
        finish = resolve;
      })
    );
    render(<NotificationsPage />);

    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
    expect(screen.getByTestId(REMINDERS_SWITCH)).toBeDisabled();

    finish(ALL_PUSH_PREFERENCES_ON);
    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
  });
});

describe('NotificationsPage: toggling', () => {
  it('sends the toggled switch to the store and shows the saved state', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockResolvedValue({ ...ALL_PUSH_PREFERENCES_ON, pokesAndKisses: false });

    await user.click(screen.getByTestId('settings-push-pokes-and-kisses'));

    expect(service.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'pokesAndKisses', false);
    await waitFor(() =>
      expect(screen.getByTestId('settings-push-pokes-and-kisses')).toHaveAttribute('aria-checked', 'false')
    );
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('settings-notifications-error')).not.toBeInTheDocument();
  });

  it('disables a row while its own save is in flight, and only that row', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    let finish!: (value: PushPreferences) => void;
    service.savePushPreference.mockReturnValue(
      new Promise<PushPreferences>((resolve) => {
        finish = resolve;
      })
    );

    await user.click(screen.getByTestId('settings-push-moods'));

    await waitFor(() => expect(screen.getByTestId('settings-push-moods')).toBeDisabled());
    expect(screen.getByTestId('settings-push-photos')).toBeEnabled();
    await user.click(screen.getByTestId('settings-push-moods'));
    expect(service.savePushPreference).toHaveBeenCalledTimes(1);

    finish({ ...ALL_PUSH_PREFERENCES_ON, moods: false });
    await waitFor(() => expect(screen.getByTestId('settings-push-moods')).toBeEnabled());
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'false');
  });

  it('enables the row again after a failed save', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockRejectedValue(new AccountDataError('transport', 'Nope.'));

    await user.click(screen.getByTestId('settings-push-moods'));

    await screen.findByTestId('settings-notifications-error');
    expect(screen.getByTestId('settings-push-moods')).toBeEnabled();
  });

  it('turns a switch back on', async () => {
    const user = userEvent.setup();
    await renderLoaded({ ...ALL_PUSH_PREFERENCES_ON, loveNotes: false });
    service.savePushPreference.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);

    await user.click(screen.getByTestId('settings-push-love-notes'));

    expect(service.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'loveNotes', true);
    await waitFor(() =>
      expect(screen.getByTestId('settings-push-love-notes')).toHaveAttribute('aria-checked', 'true')
    );
  });

  it('offline: says so, sends nothing and changes nothing', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    setOnline(false);

    await user.click(screen.getByTestId('settings-push-moods'));

    expect(screen.getByTestId('settings-notifications-error')).toHaveTextContent(
      'You are offline. Push settings need a connection to save.'
    );
    expect(service.savePushPreference).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'true');
  });

  it('a failed save keeps the old state and shows the error', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockRejectedValue(new AccountDataError('transport', 'Server said no.'));

    await user.click(screen.getByTestId('settings-push-photos'));

    const alert = await screen.findByTestId('settings-notifications-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Server said no.');
    expect(screen.getByTestId('settings-push-photos')).toHaveAttribute('aria-checked', 'true');
  });

  it('clears the error when the next toggle succeeds', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockRejectedValueOnce(new AccountDataError('transport', 'Nope.'));
    await user.click(screen.getByTestId('settings-push-photos'));
    await screen.findByTestId('settings-notifications-error');

    service.savePushPreference.mockResolvedValueOnce({ ...ALL_PUSH_PREFERENCES_ON, photos: false });
    await user.click(screen.getByTestId('settings-push-photos'));

    await waitFor(() => expect(screen.queryByTestId('settings-notifications-error')).not.toBeInTheDocument());
  });
});

describe('NotificationsPage: opened offline', () => {
  it('says the settings need a connection to load, with the rows disabled', async () => {
    setOnline(false);
    render(<NotificationsPage />);

    expect(await screen.findByTestId('settings-push-offline')).toHaveTextContent(
      'You are offline. Push settings need a connection to load.'
    );
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
    expect(service.fetchPushPreferences).not.toHaveBeenCalled();
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
  });

  it('shows the saved copy with the rows enabled and no offline line', async () => {
    await writeLocalCopy('user-a', PUSH_PREFERENCES_COPY_KIND, {
      ...ALL_PUSH_PREFERENCES_ON,
      loveNotes: false,
      dateReminders: false,
    });
    setOnline(false);
    render(<NotificationsPage />);

    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
    expect(screen.getByTestId('settings-push-love-notes')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('settings-reminders-switch')).toBeEnabled();
    expect(screen.getByTestId('settings-reminders-switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('settings-push-offline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
    expect(service.fetchPushPreferences).not.toHaveBeenCalled();
  });

  it('shows no offline line when online and loaded', async () => {
    await renderLoaded();

    expect(screen.queryByTestId('settings-push-offline')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage: a failed load', () => {
  it('keeps the rows that had loaded enabled when a reload fails', async () => {
    await renderLoaded();
    const failure = new Error('boom');
    service.fetchPushPreferences.mockRejectedValue(failure);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('[Settings] Failed to load the push settings:', failure)
    );
    await serializeAccountDataWrite(async () => {});
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeEnabled();
  });

  it('shows the saved copy, with no load-error line, when the read fails', async () => {
    await writeLocalCopy('user-a', PUSH_PREFERENCES_COPY_KIND, {
      ...ALL_PUSH_PREFERENCES_ON,
      loveNotes: false,
    });
    const failure = new Error('boom');
    service.fetchPushPreferences.mockRejectedValue(failure);
    render(<NotificationsPage />);

    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('[Settings] Failed to load the push settings:', failure)
    );
    await serializeAccountDataWrite(async () => {});
    expect(screen.getByTestId('settings-push-love-notes')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeEnabled();
  });

  it('disables the rows and says the settings could not be loaded', async () => {
    const failure = new AccountDataError('transport', 'boom');
    service.fetchPushPreferences.mockRejectedValue(failure);
    render(<NotificationsPage />);

    expect(await screen.findByTestId('settings-push-load-error')).toHaveTextContent(
      "Couldn't load your push settings."
    );
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
    expect(console.error).toHaveBeenCalledWith(
      '[Settings] Failed to load the push settings:',
      failure
    );
  });

  it('reloads when the connection returns', async () => {
    service.fetchPushPreferences.mockRejectedValueOnce(new Error('boom'));
    render(<NotificationsPage />);
    await screen.findByTestId('settings-push-load-error');

    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage: the iOS permission notice', () => {
  it('opens the page with the notice above usable rows when iOS says denied', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    await renderLoaded();

    const notice = await screen.findByTestId('settings-push-permission-off');
    expect(notice.textContent).toBe(DENIED_NOTICE);
    const card = screen.getByTestId('settings-push-love-notes');
    expect(notice.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card).toBeEnabled();
  });

  it.each(['granted', 'prompt', 'prompt-with-rationale'])('shows no notice when iOS says %s', async (receive) => {
    push.checkPermissions.mockResolvedValue({ receive });
    await renderLoaded();
    await waitFor(() => expect(push.checkPermissions).toHaveBeenCalled());

    expect(screen.queryByTestId('settings-push-permission-off')).not.toBeInTheDocument();
  });

  it('checks again when the app is shown, and drops the notice once allowed', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    await renderLoaded();
    await screen.findByTestId('settings-push-permission-off');

    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() =>
      expect(screen.queryByTestId('settings-push-permission-off')).not.toBeInTheDocument()
    );
  });

  it('does not check while the app is hidden', async () => {
    await renderLoaded();
    await waitFor(() => expect(push.checkPermissions).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(push.checkPermissions).toHaveBeenCalledTimes(1);
  });

  it('shows the notice when it turns denied in iOS Settings while the app is away', async () => {
    await renderLoaded();
    await waitFor(() => expect(push.checkPermissions).toHaveBeenCalledTimes(1));

    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByTestId('settings-push-permission-off')).toBeInTheDocument();
  });
});

describe('NotificationsPage: the Date reminders switch', () => {
  it('is on by default: before the switches load it reads as on, but is disabled', async () => {
    let finish!: (value: PushPreferences) => void;
    service.fetchPushPreferences.mockReturnValue(
      new Promise<PushPreferences>((resolve) => {
        finish = resolve;
      })
    );
    render(<NotificationsPage />);

    expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(REMINDERS_SWITCH)).toBeDisabled();

    finish(ALL_PUSH_PREFERENCES_ON);
    await waitFor(() => expect(screen.getByTestId(REMINDERS_SWITCH)).toBeEnabled());
  });

  it('is on and enabled once the push switches have loaded', async () => {
    await renderLoaded();

    expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(REMINDERS_SWITCH)).toBeEnabled();
  });

  it('shows off when the saved row has it off', async () => {
    await renderLoaded(REMINDERS_OFF);

    expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'false');
  });

  it('turns off through the store, sending only that switch', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockResolvedValue(REMINDERS_OFF);

    await user.click(screen.getByTestId(REMINDERS_SWITCH));

    await waitFor(() =>
      expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'false')
    );
    expect(service.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'dateReminders', false);
    expect(useAppStore.getState().pushPreferences).toEqual(REMINDERS_OFF);
    expect(screen.queryByTestId('settings-notifications-error')).not.toBeInTheDocument();
  });

  it('turns on again from off', async () => {
    const user = userEvent.setup();
    await renderLoaded(REMINDERS_OFF);
    service.savePushPreference.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);

    await user.click(screen.getByTestId(REMINDERS_SWITCH));

    await waitFor(() =>
      expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'true')
    );
    expect(service.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'dateReminders', true);
  });

  it('is disabled while its save is in flight, and the push switches stay usable', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    let finish!: (value: PushPreferences) => void;
    service.savePushPreference.mockReturnValue(
      new Promise<PushPreferences>((resolve) => {
        finish = resolve;
      })
    );

    await user.click(screen.getByTestId(REMINDERS_SWITCH));

    expect(screen.getByTestId(REMINDERS_SWITCH)).toBeDisabled();
    expect(screen.getByTestId('settings-push-moods')).toBeEnabled();

    finish(REMINDERS_OFF);
    await waitFor(() => expect(screen.getByTestId(REMINDERS_SWITCH)).toBeEnabled());
  });

  it('refuses a toggle offline with the offline message and sends nothing', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    setOnline(false);

    await user.click(screen.getByTestId(REMINDERS_SWITCH));

    expect(await screen.findByTestId('settings-notifications-error')).toHaveTextContent(
      'You are offline. Reminders need a connection to save.'
    );
    expect(service.savePushPreference).not.toHaveBeenCalled();
    expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the error and keeps state when the save fails', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const failure = new AccountDataError('transport', 'Server said no');
    service.savePushPreference.mockRejectedValue(failure);

    await user.click(screen.getByTestId(REMINDERS_SWITCH));

    expect(await screen.findByTestId('settings-notifications-error')).toHaveTextContent('Server said no');
    expect(screen.getByTestId(REMINDERS_SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(REMINDERS_SWITCH)).toBeEnabled();
    expect(useAppStore.getState().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
    expect(console.error).toHaveBeenCalledWith(
      '[NotificationsPage] Could not save the date reminders switch:',
      failure
    );
  });

  it('shares one Error box with the push switches, cleared at the next tap of any switch', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockRejectedValueOnce(new AccountDataError('transport', 'Nope.'));
    await user.click(screen.getByTestId(REMINDERS_SWITCH));
    expect(await screen.findAllByTestId('settings-notifications-error')).toHaveLength(1);

    service.savePushPreference.mockResolvedValueOnce({ ...ALL_PUSH_PREFERENCES_ON, moods: false });
    await user.click(screen.getByTestId('settings-push-moods'));

    await waitFor(() =>
      expect(screen.queryByTestId('settings-notifications-error')).not.toBeInTheDocument()
    );
  });

  it('puts the Error box above the Notice and the groups', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    const user = userEvent.setup();
    await renderLoaded();
    await screen.findByTestId('settings-push-permission-off');
    service.savePushPreference.mockRejectedValue(new AccountDataError('transport', 'Nope.'));

    await user.click(screen.getByTestId('settings-push-moods'));

    const box = await screen.findByTestId('settings-notifications-error');
    expect(box).toHaveAttribute('role', 'alert');
    expect(
      box.compareDocumentPosition(screen.getByTestId('settings-push-permission-off')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      box.compareDocumentPosition(screen.getByTestId('settings-push-love-notes')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('notificationsSummary', () => {
  const allOff: PushPreferences = {
    loveNotes: false,
    moods: false,
    photos: false,
    pokesAndKisses: false,
    partnerRequests: false,
    dates: false,
    dateReminders: false,
  };

  it.each([
    ['all seven on, permission granted', ALL_PUSH_PREFERENCES_ON, 'granted', true, 'On'],
    ['one push switch off', { ...ALL_PUSH_PREFERENCES_ON, moods: false }, 'granted', true, 'Some'],
    ['only Date reminders off', REMINDERS_OFF, 'granted', true, 'Some'],
    ['all seven off', allOff, 'granted', true, 'Off'],
    ['permission denied with every switch on', ALL_PUSH_PREFERENCES_ON, 'denied', true, 'Off'],
    ['permission denied before the switches load', null, 'denied', true, 'Off'],
    ['permission prompt, all on', ALL_PUSH_PREFERENCES_ON, 'prompt', true, 'On'],
    ['permission unavailable, all on', ALL_PUSH_PREFERENCES_ON, 'unavailable', true, 'On'],
    ['the switches not loaded', null, 'granted', true, undefined],
    ['the permission not read yet', ALL_PUSH_PREFERENCES_ON, null, true, undefined],
    ['neither known', null, null, true, undefined],
    ['no reminders plugin, Date reminders off, six on', REMINDERS_OFF, 'granted', false, 'On'],
    ['no reminders plugin, one push switch off', { ...allOff, loveNotes: true }, 'granted', false, 'Some'],
    ['no reminders plugin, six off, Date reminders on', { ...allOff, dateReminders: true }, 'granted', false, 'Off'],
  ] as const)('%s', (_name, preferences, permission, withReminders, expected) => {
    expect(notificationsSummary(preferences, permission, withReminders)).toBe(expected);
  });
});

describe('NotificationsRow', () => {
  it('reads On with every switch on and the permission granted, and opens the notifications page', async () => {
    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    render(<NotificationsRow />);

    const row = await screen.findByRole('button', { name: 'Notifications, On' });
    expect(row).toBe(screen.getByTestId('settings-notifications-row'));
    expect(row).toHaveAttribute('data-settings-target', 'notifications');
    expect(row).toHaveTextContent('On');
  });

  it('shows no value, and never "Loading...", until the switches and the permission are known', async () => {
    let finish!: (value: PushPreferences) => void;
    service.fetchPushPreferences.mockReturnValue(
      new Promise<PushPreferences>((resolve) => {
        finish = resolve;
      })
    );
    render(<NotificationsRow />);

    const row = screen.getByTestId('settings-notifications-row');
    expect(row).toHaveAccessibleName('Notifications');
    expect(row.textContent).toBe('Notifications');

    finish(ALL_PUSH_PREFERENCES_ON);
    await screen.findByRole('button', { name: 'Notifications, On' });
  });

  it('follows a switch saved on the page, without a reload', async () => {
    const user = userEvent.setup();
    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    render(
      <>
        <NotificationsRow />
        <NotificationsPage />
      </>
    );
    await screen.findByRole('button', { name: 'Notifications, On' });
    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
    await serializeAccountDataWrite(async () => {});
    service.savePushPreference.mockResolvedValue({ ...ALL_PUSH_PREFERENCES_ON, loveNotes: false });

    await user.click(screen.getByTestId('settings-push-love-notes'));

    expect(await screen.findByRole('button', { name: 'Notifications, Some' })).toBeInTheDocument();
  });

  it('reads Off when iOS has the permission denied, and recomputes when it is allowed', async () => {
    push.checkPermissions.mockResolvedValue({ receive: 'denied' });
    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    render(<NotificationsRow />);
    await screen.findByRole('button', { name: 'Notifications, Off' });

    push.checkPermissions.mockResolvedValue({ receive: 'granted' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByRole('button', { name: 'Notifications, On' })).toBeInTheDocument();
  });

  it('leaves Date reminders out of the value without the local-notifications plugin', async () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
    service.fetchPushPreferences.mockResolvedValue(REMINDERS_OFF);
    render(<NotificationsRow />);

    expect(await screen.findByRole('button', { name: 'Notifications, On' })).toBeInTheDocument();
  });

  it('loads the switches once on mount', async () => {
    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    render(<NotificationsRow />);
    await screen.findByRole('button', { name: 'Notifications, On' });

    expect(service.fetchPushPreferences).toHaveBeenCalledExactlyOnceWith('user-a');
  });
});
