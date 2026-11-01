/**
 * PushSettings — "Push and reminders" (story 3.7): rendered only in the native
 * shell with both push plugins, six switches in a fixed order, a write per
 * toggle that goes through the store, and a notice when iOS has notifications
 * off. The preferences service and the Capacitor plugins are mocked; the store
 * is the real one.
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
vi.mock('../../../services/pushPreferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pushPreferencesService')>()),
  pushPreferencesService: service,
}));

import { AccountDataError } from '../../../services/accountDataError';
import {
  ALL_PUSH_PREFERENCES_ON,
  type PushPreferences,
} from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { PushSettings } from '../PushSettings';

const ROWS = [
  ['settings-push-love-notes', 'Love notes', 'When your partner sends a note.', 'loveNotes'],
  ['settings-push-moods', 'Moods', 'When your partner logs a mood.', 'moods'],
  ['settings-push-photos', 'Photos', 'When your partner adds a photo.', 'photos'],
  [
    'settings-push-pokes-and-kisses',
    'Pokes and kisses',
    'When your partner sends a poke or a kiss.',
    'pokesAndKisses',
  ],
  ['settings-push-dates', 'Dates', 'When your partner adds or changes a date.', 'dates'],
  [
    'settings-push-partner-requests',
    'Partner requests',
    'When someone asks to be your partner, or accepts your request.',
    'partnerRequests',
  ],
] as const;

const DENIED_NOTICE = 'Notifications are off for My Love. Turn them on in iOS Settings.';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/** Renders the section and waits for the loaded switches to enable the rows. */
async function renderLoaded(preferences: PushPreferences = ALL_PUSH_PREFERENCES_ON) {
  service.fetchPushPreferences.mockResolvedValue(preferences);
  render(<PushSettings />);
  await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  capacitor.isNativePlatform.mockReturnValue(true);
  capacitor.isPluginAvailable.mockReturnValue(true);
  push.checkPermissions.mockResolvedValue({ receive: 'granted' });
  setOnline(true);
  setVisibility('visible');
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('user-a');
});

afterEach(() => {
  cleanup();
  setOnline(true);
  setVisibility('visible');
  vi.restoreAllMocks();
});

describe('PushSettings: where it shows', () => {
  it('renders nothing and fetches nothing off the native platform', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { container } = render(<PushSettings />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('settings-push')).not.toBeInTheDocument();
    expect(service.fetchPushPreferences).not.toHaveBeenCalled();
    expect(push.checkPermissions).not.toHaveBeenCalled();
  });

  it.each(['PushNotifications', 'PushEnvironment'])(
    'renders nothing and fetches nothing when the %s plugin is missing',
    (missing) => {
      capacitor.isPluginAvailable.mockImplementation((name: string) => name !== missing);
      const { container } = render(<PushSettings />);

      expect(container).toBeEmptyDOMElement();
      expect(service.fetchPushPreferences).not.toHaveBeenCalled();
      expect(push.checkPermissions).not.toHaveBeenCalled();
    }
  );
});

describe('PushSettings: the rows', () => {
  it('is a labelled section with a Pushes group', async () => {
    await renderLoaded();

    const section = screen.getByTestId('settings-push');
    expect(section).toHaveAccessibleName('Push and reminders');
    expect(screen.getByRole('heading', { level: 2, name: 'Push and reminders' })).toBeInTheDocument();
    expect(within(section).getByRole('heading', { level: 3, name: 'Pushes' })).toBeInTheDocument();
  });

  it('lists the six switches in order with their labels and helpers', async () => {
    await renderLoaded();

    const switches = within(screen.getByTestId('settings-push')).getAllByRole('switch');
    expect(switches.map((row) => row.getAttribute('data-testid'))).toEqual(ROWS.map(([id]) => id));
    for (const [id, label, helper] of ROWS) {
      const row = screen.getByTestId(id);
      expect(row).toHaveAccessibleName(label);
      expect(row).toHaveAccessibleDescription(helper);
      expect(screen.getByTestId(`${id}-helper`).textContent).toBe(helper);
    }
  });

  it('never starts a label with "Notify me"', async () => {
    await renderLoaded();

    for (const [, label] of ROWS) expect(label).not.toMatch(/^Notify me/);
    for (const row of screen.getAllByRole('switch')) {
      expect(row.textContent ?? '').not.toMatch(/^Notify me/);
    }
  });

  it('shows the loaded state of each switch', async () => {
    await renderLoaded({ ...ALL_PUSH_PREFERENCES_ON, loveNotes: false, dates: false });

    expect(screen.getByTestId('settings-push-love-notes')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('settings-push-dates')).toHaveAttribute('aria-checked', 'false');
  });

  it('loads the switches once when the section opens', async () => {
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
    render(<PushSettings />);

    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();

    finish(ALL_PUSH_PREFERENCES_ON);
    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
  });
});

describe('PushSettings: toggling', () => {
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
    expect(screen.queryByTestId('settings-push-error')).not.toBeInTheDocument();
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

    await screen.findByTestId('settings-push-error');
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

    expect(screen.getByTestId('settings-push-error')).toHaveTextContent(
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

    const alert = await screen.findByTestId('settings-push-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Server said no.');
    expect(screen.getByTestId('settings-push-photos')).toHaveAttribute('aria-checked', 'true');
  });

  it('clears the error when the next toggle succeeds', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    service.savePushPreference.mockRejectedValueOnce(new AccountDataError('transport', 'Nope.'));
    await user.click(screen.getByTestId('settings-push-photos'));
    await screen.findByTestId('settings-push-error');

    service.savePushPreference.mockResolvedValueOnce({ ...ALL_PUSH_PREFERENCES_ON, photos: false });
    await user.click(screen.getByTestId('settings-push-photos'));

    await waitFor(() => expect(screen.queryByTestId('settings-push-error')).not.toBeInTheDocument());
  });
});

describe('PushSettings: opened offline', () => {
  it('says the settings need a connection to load, with the rows disabled', async () => {
    setOnline(false);
    render(<PushSettings />);

    expect(await screen.findByTestId('settings-push-offline')).toHaveTextContent(
      'You are offline. Push settings need a connection to load.'
    );
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
    expect(service.fetchPushPreferences).not.toHaveBeenCalled();
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
  });

  it('shows no offline line when online and loaded', async () => {
    await renderLoaded();

    expect(screen.queryByTestId('settings-push-offline')).not.toBeInTheDocument();
  });
});

describe('PushSettings: a failed load', () => {
  it('disables the rows that had loaded when a reload fails', async () => {
    await renderLoaded();
    service.fetchPushPreferences.mockRejectedValue(new Error('boom'));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByTestId('settings-push-load-error')).toBeInTheDocument();
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
  });

  it('disables the rows and says the settings could not be loaded', async () => {
    service.fetchPushPreferences.mockRejectedValue(new AccountDataError('transport', 'boom'));
    render(<PushSettings />);

    expect(await screen.findByTestId('settings-push-load-error')).toHaveTextContent(
      "Couldn't load your push settings."
    );
    for (const [id] of ROWS) expect(screen.getByTestId(id)).toBeDisabled();
    expect(console.error).toHaveBeenCalled();
  });

  it('reloads when the connection returns', async () => {
    service.fetchPushPreferences.mockRejectedValueOnce(new Error('boom'));
    render(<PushSettings />);
    await screen.findByTestId('settings-push-load-error');

    service.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());
    expect(screen.queryByTestId('settings-push-load-error')).not.toBeInTheDocument();
  });
});

describe('PushSettings: the iOS permission notice', () => {
  it('opens the section with the notice above usable rows when iOS says denied', async () => {
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
