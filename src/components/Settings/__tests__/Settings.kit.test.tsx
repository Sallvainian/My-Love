/**
 * Settings on the style kit: the page's own behaviour that the restyle added
 * or re-shaped — the About replay row, the Log out row's in-flight and failed
 * states, the version line under the last card, and the section / group
 * headings that replaced the old inner titles. (The identity row's avatar
 * initial and the name row moved to the Profile page: `Settings.profile.test.tsx`.)
 *
 * The real EventsSettings and AnniversarySettings are mounted on the real
 * store (signed out, so neither loads anything) because the headings under
 * test are theirs.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pkg from '../../../../package.json';
import { clearSignOutNotice, getSignOutNotice } from '../../../services/signOutNotice';
import { useAppStore } from '../../../stores/useAppStore';

const backend = vi.hoisted(() => ({
  fetchOwnProfile: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
// The store's own profile, which Settings fills with `loadOwnProfile`, is read
// from here.
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
}));
vi.mock('../../../api/authService', () => ({
  authService: { signOut: backend.signOut },
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

import { Settings } from '../Settings';

let accountCounter = 0;

/**
 * Renders Settings and waits for the profile read to settle (an answer, or a
 * failed read offline), so no later state change lands outside the case.
 */
async function renderSettings(props: { onShowWelcome?: () => void } = {}) {
  render(<Settings {...props} />);
  await waitFor(() => {
    const { ownProfile, ownProfileLoadFailed } = useAppStore.getState();
    expect(ownProfile !== null || ownProfileLoadFailed).toBe(true);
  });
}

describe('Settings on the kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Jessie', birthday: null });
    // A fresh account and session per case, so no earlier case's saved copy decides the profile.
    accountCounter += 1;
    useAppStore.setState({
      userId: `user-${accountCounter}`,
      authSessionVersion: accountCounter,
      ownProfile: null,
      ownProfileLoadFailed: false,
    });
  });

  afterEach(() => {
    cleanup();
    clearSignOutNotice();
  });

  it('renders the group labels in order and one heading per countdown group', async () => {
    await renderSettings({ onShowWelcome: vi.fn() });

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    // No Preferences group: nothing in it exists without a connection type, and
    // a group with no rows is not drawn. The last card has no label.
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    ).toEqual(['Account', 'Partner', 'About', 'Countdowns']);
    expect(screen.getAllByRole('heading', { level: 3, name: 'Events' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 3, name: 'Anniversaries' })).toHaveLength(1);
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent(/Event Countdowns/);
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent(/Anniversary Countdowns/);
  });

  it('replays the welcome message from About when a handler is passed', async () => {
    const user = userEvent.setup();
    const onShowWelcome = vi.fn();
    await renderSettings({ onShowWelcome });

    const replay = screen.getByTestId('settings-replay-welcome');
    expect(replay).toHaveTextContent('Replay welcome message');
    await user.click(replay);
    expect(onShowWelcome).toHaveBeenCalledTimes(1);
  });

  it('shows the package.json version in the line under the last card', async () => {
    await renderSettings();

    const version = screen.getByTestId('settings-version');
    expect(version.textContent).toBe(`Version ${pkg.version} · made for the two of you`);
    // Directly under the sign-out card, not inside it.
    expect(screen.getByTestId('settings-sign-out-card')).not.toContainElement(version);
    expect(screen.getByTestId('settings-sign-out-card').nextElementSibling).toBe(version);
  });

  it('renders no replay row, and no About group, without a handler', async () => {
    await renderSettings();

    expect(
      screen.queryByRole('heading', { level: 2, name: 'About' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-replay-welcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Replay welcome message');
  });

  it('disables the Log out row and says so while the log-out is in flight', async () => {
    const user = userEvent.setup();
    let release: ((value: { otherDevicesSignedOut: boolean }) => void) | undefined;
    backend.signOut.mockImplementation(
      () => new Promise<{ otherDevicesSignedOut: boolean }>((resolve) => (release = resolve))
    );
    await renderSettings();

    const signOut = screen.getByTestId('settings-sign-out');
    expect(signOut).toHaveTextContent('Log out');
    await user.click(signOut);

    await waitFor(() => expect(signOut).toBeDisabled());
    expect(signOut).toHaveTextContent('Logging out…');
    // This device only: the everywhere row is the other scope.
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: false });
    expect(screen.getByTestId('settings-sign-out-everywhere')).toBeDisabled();

    await act(async () => {
      release?.({ otherDevicesSignedOut: true });
    });
  });

  it('shows a kit alert and re-enables the row when the log-out fails', async () => {
    const user = userEvent.setup();
    backend.signOut.mockRejectedValue(new Error('network down'));
    await renderSettings();

    const signOut = screen.getByTestId('settings-sign-out');
    await user.click(signOut);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to log out. Please try again.');
    expect(alert).toHaveClass('bg-dtint', 'text-danger');
    expect(signOut).toBeEnabled();
    expect(signOut).toHaveTextContent('Log out');
  });

  const CONFIRM_TEXT = "Log out on every device? You'll need to sign in again on each one.";
  const PARTIAL_NOTICE =
    "You're logged out on this device, but your other devices could not be logged out. Sign in again when you're online and try Log out of all devices once more.";

  async function openEverywhereDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('settings-sign-out-everywhere'));
    return screen.findByRole('dialog');
  }

  it('asks before logging out of all devices, and logs out nothing until confirmed', async () => {
    const user = userEvent.setup();
    await renderSettings();
    expect(screen.getByTestId('settings-sign-out-everywhere')).toHaveTextContent(
      'Log out of all devices'
    );

    const dialog = await openEverywhereDialog(user);

    expect(dialog).toHaveTextContent(CONFIRM_TEXT);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Log out everywhere' })).toBeInTheDocument();
    expect(backend.signOut).not.toHaveBeenCalled();
  });

  it('puts initial focus on Cancel', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const dialog = await openEverywhereDialog(user);

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    );
  });

  it('keeps focus where the person moved it when Settings re-renders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Settings />);
    await waitFor(() => expect(useAppStore.getState().ownProfile).not.toBeNull());

    const dialog = await openEverywhereDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Log out everywhere' });
    confirm.focus();
    rerender(<Settings />);

    expect(confirm).toHaveFocus();
  });

  it('closes on Cancel, Escape and the backdrop without logging out', async () => {
    const user = userEvent.setup();
    await renderSettings();

    let dialog = await openEverywhereDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openEverywhereDialog(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    dialog = await openEverywhereDialog(user);
    await user.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(backend.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-sign-out-everywhere')).toBeEnabled();
  });

  it('logs out of all devices on confirm, and says so while in flight', async () => {
    const user = userEvent.setup();
    let release: ((value: { otherDevicesSignedOut: boolean }) => void) | undefined;
    backend.signOut.mockImplementation(
      () => new Promise<{ otherDevicesSignedOut: boolean }>((resolve) => (release = resolve))
    );
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Log out everywhere' }));

    const everywhere = screen.getByTestId('settings-sign-out-everywhere');
    await waitFor(() => expect(everywhere).toBeDisabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(everywhere).toHaveTextContent('Logging out of all devices…');
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: true });
    const signOut = screen.getByTestId('settings-sign-out');
    expect(signOut).toBeDisabled();
    expect(signOut).toHaveTextContent('Log out');

    await act(async () => {
      release?.({ otherDevicesSignedOut: true });
    });
    expect(getSignOutNotice()).toBeNull();
  });

  it('logs out once when "Log out everywhere" is pressed twice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockReturnValue(new Promise(() => {}));
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Log out everywhere' });
    // Both presses land before React re-renders, as a double tap on the
    // exiting dialog does: the second still holds the old handler.
    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: true });
  });

  it('hands a partial log-out to the login screen as a notice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockResolvedValue({ otherDevicesSignedOut: false });
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Log out everywhere' }));

    await waitFor(() => expect(getSignOutNotice()).toBe(PARTIAL_NOTICE));
  });

  it('leaves the plain Log out row asking nothing and showing no notice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockResolvedValue({ otherDevicesSignedOut: true });
    await renderSettings();

    await user.click(screen.getByTestId('settings-sign-out'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: false });
    expect(getSignOutNotice()).toBeNull();
  });

  it('refuses to log out of all devices offline, before any dialog or request', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await renderSettings();

    await user.click(screen.getByTestId('settings-sign-out-everywhere'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'You are offline. Logging out of all devices needs a connection to go through.'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-sign-out-everywhere')).toBeEnabled();
  });
});
