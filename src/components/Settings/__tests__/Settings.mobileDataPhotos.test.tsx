/**
 * Settings: the Photos row. "Download photos over mobile data" is this
 * device's choice, now made on the Photos page; the top page's Preferences
 * group carries a row that reads the choice and opens the page, and only where
 * the browser reports its connection type.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backend = vi.hoisted(() => ({
  lookupOwnDisplayName: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  lookupOwnDisplayName: backend.lookupOwnDisplayName,
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../../api/authService', () => ({
  authService: { getUser: backend.getUser, signOut: backend.signOut },
}));
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

import {
  PHOTOS_OVER_MOBILE_DATA_KEY,
  getPhotosOverMobileData,
  setPhotosOverMobileData,
} from '../../../services/photoDownloadPreference';
import { useAppStore } from '../../../stores/useAppStore';
import { Settings } from '../Settings';
import { onPopState } from './settingsStackKit';

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}

async function renderSettings() {
  render(<Settings />);
  await waitFor(() =>
    expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie')
  );
}

describe('Settings: the Photos row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Jessie' });
    act(() => setPhotosOverMobileData(false));
    localStorage.removeItem(PHOTOS_OVER_MOBILE_DATA_KEY);
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

  it('shows "Photos, Wi-Fi only" in Preferences when the phone reports its connection', async () => {
    setConnection(Object.assign(new EventTarget(), { type: 'wifi' }));
    await renderSettings();

    const row = screen.getByRole('button', { name: 'Photos, Wi-Fi only' });
    expect(row).toBe(screen.getByTestId('settings-photos-row'));
    expect(row).toHaveTextContent('Wi-Fi only');
    const preferences = screen.getByRole('heading', { level: 2, name: 'Preferences' });
    expect(preferences.closest('section')).toContainElement(row);
  });

  it.each([
    ['no connection type', undefined],
    ['an unknown connection type', Object.assign(new EventTarget(), { type: 'unknown' })],
  ])('has no Photos row, and no Preferences group, with %s', async (_name, connection) => {
    setConnection(connection);
    await renderSettings();

    expect(screen.queryByTestId('settings-photos-row')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Preferences' })
    ).not.toBeInTheDocument();
  });

  it('reads the saved choice', async () => {
    setConnection(Object.assign(new EventTarget(), { type: 'cellular' }));
    act(() => setPhotosOverMobileData(true));
    await renderSettings();

    expect(screen.getByRole('button', { name: 'Photos, Any connection' })).toBeInTheDocument();
  });

  it('opens the Photos page, where a choice saved offline shows on the row after back', async () => {
    const user = userEvent.setup();
    setConnection(Object.assign(new EventTarget(), { type: 'wifi' }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.history.replaceState(null, '', '/');
    useAppStore.getState().setView('settings');
    await renderSettings();

    await user.click(screen.getByTestId('settings-photos-row'));

    expect(window.location.pathname).toBe('/settings/photos');
    expect(screen.getByRole('heading', { level: 1, name: 'Photos' })).toHaveFocus();
    expect(screen.queryByTestId('settings-sign-out')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Any connection' }));
    expect(getPhotosOverMobileData()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    const row = await screen.findByRole('button', { name: 'Photos, Any connection' });
    await waitFor(() => expect(row).toHaveFocus());
    expect(window.location.pathname).toBe('/settings');
  });

  it('sends a page this phone cannot use back to the top page', async () => {
    setConnection(undefined);
    window.history.replaceState(null, '', '/settings/photos');
    useAppStore.setState({ settingsPath: 'photos' });
    await renderSettings();

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/settings');
    expect(within(screen.getByTestId('settings-view')).queryByText('Wi-Fi only')).toBeNull();
  });
});
