/**
 * Settings: the Notifications row (story 6). In a shell with the push plugins
 * (`hasNativePush()`) the Preferences group opens with a Notifications row,
 * before Photos, whose value is On / Off / Some; tapping it slides in
 * `/settings/notifications`, and back returns with focus on the row. Where
 * `hasNativePush()` is false (the website, an older shell) there is no row, the
 * path falls back to the top page and `push_preferences` is never read.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  fetchPushPreferences: vi.fn(),
  savePushPreference: vi.fn(),
  hasNativePush: vi.fn(() => true),
  getPushPermission: vi.fn(() => Promise.resolve('granted')),
}));

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: backend.getUser, signOut: backend.signOut },
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../services/pushPreferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pushPreferencesService')>()),
  pushPreferencesService: {
    fetchPushPreferences: backend.fetchPushPreferences,
    savePushPreference: backend.savePushPreference,
  },
}));
vi.mock('../../../services/pushNotifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pushNotifications')>()),
  hasNativePush: backend.hasNativePush,
  getPushPermission: backend.getPushPermission,
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

vi.mock('motion/react', () => ({
  m: {
    div: ({ children, ...props }: MotionDivProps) => {
      const { initial: _i, animate: _a, exit: _e, ...rest } = props as Record<string, unknown>;
      return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { ALL_PUSH_PREFERENCES_ON } from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { resetPushPermissionForTests } from '../notificationsStatus';
import { Settings } from '../Settings';
import { onPopState } from './settingsStackKit';

let accountCounter = 0;

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}

/** Renders Settings and waits for the name row to finish its read. */
async function renderSettings() {
  render(<Settings />);
  await waitFor(() => expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie'));
}

describe('Settings: the Notifications row', () => {
  beforeEach(() => {
    resetPushPermissionForTests();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.hasNativePush.mockReturnValue(true);
    backend.getPushPermission.mockResolvedValue('granted');
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Jessie', birthday: null });
    backend.fetchPushPreferences.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    // A fresh account and session per case, so no earlier case's saved copy decides a value.
    accountCounter += 1;
    useAppStore.setState({
      userId: `notifications-user-${accountCounter}`,
      authSessionVersion: 1000 + accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
      pushPreferences: null,
      pushPreferencesLoadFailed: false,
    });
    setConnection(Object.assign(new EventTarget(), { type: 'wifi' }));
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'settings', settingsPath: '' });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    setConnection(undefined);
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '' });
  });

  it('shows "Notifications, On" in Preferences, before Photos', async () => {
    await renderSettings();

    const row = await screen.findByRole('button', { name: 'Notifications, On' });
    expect(row).toBe(screen.getByTestId('settings-notifications-row'));
    expect(row).toHaveTextContent('On');
    const preferences = screen.getByRole('heading', { level: 2, name: 'Preferences' });
    const group = preferences.closest('section')!;
    expect(group).toContainElement(row);
    const rows = within(group).getAllByRole('button');
    expect(rows.map((button) => button.getAttribute('data-testid'))).toEqual([
      'settings-notifications-row',
      'settings-photos-row',
    ]);
  });

  it('keeps the Preferences group with only the Notifications row where Photos is hidden', async () => {
    setConnection(undefined);
    await renderSettings();

    await screen.findByRole('button', { name: 'Notifications, On' });
    expect(screen.queryByTestId('settings-photos-row')).not.toBeInTheDocument();
  });

  it('reads Some when one switch is off', async () => {
    backend.fetchPushPreferences.mockResolvedValue({ ...ALL_PUSH_PREFERENCES_ON, moods: false });
    await renderSettings();

    expect(await screen.findByRole('button', { name: 'Notifications, Some' })).toBeInTheDocument();
  });

  it('has no per-date reminder list and no switch on the top page where the reminders plugin is missing', async () => {
    await renderSettings();

    await screen.findByRole('button', { name: 'Notifications, On' });
    expect(screen.queryByTestId('settings-reminder-marks')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('opens the Notifications page, and back returns to the top page with focus on the row', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('settings');
    await renderSettings();
    await screen.findByRole('button', { name: 'Notifications, On' });

    await user.click(screen.getByTestId('settings-notifications-row'));

    expect(window.location.pathname).toBe('/settings/notifications');
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toHaveFocus();
    expect(screen.getByTestId('settings-push-love-notes')).toBeInTheDocument();
    expect(screen.getByTestId('settings-push-partner-requests')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-sign-out')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('settings-push-love-notes')).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Back' }));

    const row = await screen.findByRole('button', { name: 'Notifications, On' });
    await waitFor(() => expect(row).toHaveFocus());
    expect(window.location.pathname).toBe('/settings');
  });

  it('shows a switch saved on the page in the row on return, without a reload', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('settings');
    await renderSettings();
    await screen.findByRole('button', { name: 'Notifications, On' });
    await user.click(screen.getByTestId('settings-notifications-row'));
    await waitFor(() => expect(screen.getByTestId('settings-push-moods')).toBeEnabled());
    backend.savePushPreference.mockResolvedValue({ ...ALL_PUSH_PREFERENCES_ON, moods: false });

    await user.click(screen.getByTestId('settings-push-moods'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-push-moods')).toHaveAttribute('aria-checked', 'false')
    );
    // The row's own re-read on return stays pending, so `Some` can only come from the store.
    // Settled at the end: the account-data queue is serial, so a read left pending would hold
    // every later test's read.
    let finish!: (value: typeof ALL_PUSH_PREFERENCES_ON) => void;
    backend.fetchPushPreferences.mockReturnValue(
      new Promise<typeof ALL_PUSH_PREFERENCES_ON>((resolve) => {
        finish = resolve;
      })
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('button', { name: 'Notifications, Some' })).toBeInTheDocument();
    finish({ ...ALL_PUSH_PREFERENCES_ON, moods: false });
  });

  it('reads Off when iOS has the permission denied', async () => {
    backend.getPushPermission.mockResolvedValue('denied');
    await renderSettings();

    expect(await screen.findByRole('button', { name: 'Notifications, Off' })).toBeInTheDocument();
  });

  it('opens straight onto the page on a fresh load of its path', async () => {
    window.history.replaceState(null, '', '/settings/notifications');
    useAppStore.setState({ settingsPath: 'notifications' });
    await act(async () => {
      render(<Settings />);
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings/notifications');
  });
});

describe('Settings: without the push plugins', () => {
  beforeEach(() => {
    resetPushPermissionForTests();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.hasNativePush.mockReturnValue(false);
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Jessie', birthday: null });
    accountCounter += 1;
    useAppStore.setState({
      userId: `notifications-user-${accountCounter}`,
      authSessionVersion: 2000 + accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
      pushPreferences: null,
      pushPreferencesLoadFailed: false,
    });
    setConnection(Object.assign(new EventTarget(), { type: 'wifi' }));
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'settings', settingsPath: '' });
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('popstate', onPopState);
    setConnection(undefined);
    window.history.replaceState(null, '', '/');
    useAppStore.setState({ currentView: 'home', settingsPath: '' });
  });

  it('has no Notifications row, and reads nothing', async () => {
    await renderSettings();

    expect(screen.queryByTestId('settings-notifications-row')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
    // Photos is still there, so the absence is not an unloaded group.
    expect(screen.getByTestId('settings-photos-row')).toBeInTheDocument();
    expect(backend.fetchPushPreferences).not.toHaveBeenCalled();
    expect(backend.getPushPermission).not.toHaveBeenCalled();
  });

  it('sends /settings/notifications back to the top page, with no push read', async () => {
    window.history.replaceState(null, '', '/settings/notifications');
    useAppStore.setState({ settingsPath: 'notifications' });
    await renderSettings();

    expect(screen.queryByTestId('settings-notifications')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings');
    expect(backend.fetchPushPreferences).not.toHaveBeenCalled();
    expect(backend.getPushPermission).not.toHaveBeenCalled();
  });
});
