/**
 * Settings on the style kit: the page's own behaviour that the restyle added
 * or re-shaped — the About replay row, the Sign out row's in-flight and failed
 * states, the version line under the last card, the identity row and its avatar
 * initial, the display-name row's loading state and accessible name, and the
 * section / group headings that replaced the old inner titles.
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
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../api/supabaseClient', () => ({
  SEED_FALLBACK_NAME: 'Unknown',
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
// The name row reads the store's own profile, which `loadOwnProfile` fills
// from this read.
vi.mock('../../../services/profileService', () => ({
  profileService: { fetchOwnProfile: backend.fetchOwnProfile, saveBirthday: vi.fn() },
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

import { Settings } from '../Settings';

let accountCounter = 0;

/**
 * Renders Settings and waits for the name row to finish its read. Offline the
 * read has no server answer, so the row settles on `settledAs` instead.
 */
async function renderSettings(
  props: { onShowWelcome?: () => void } = {},
  settledAs = 'Jessie'
) {
  render(<Settings {...props} />);
  await waitFor(() =>
    expect(screen.getByTestId('settings-display-name').textContent).toBe(settledAs)
  );
}

describe('Settings on the kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.fetchOwnProfile.mockResolvedValue({ displayName: 'Jessie', birthday: null });
    // A fresh account and session per case, so no earlier case's saved copy decides the name.
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
    ).toEqual(['About', 'Account', 'Countdowns']);
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

  it('disables the Sign out row and says so while the sign-out is in flight', async () => {
    const user = userEvent.setup();
    let release: ((value: { otherDevicesSignedOut: boolean }) => void) | undefined;
    backend.signOut.mockImplementation(
      () => new Promise<{ otherDevicesSignedOut: boolean }>((resolve) => (release = resolve))
    );
    await renderSettings();

    const signOut = screen.getByTestId('settings-sign-out');
    expect(signOut).toHaveTextContent('Sign out');
    await user.click(signOut);

    await waitFor(() => expect(signOut).toBeDisabled());
    expect(signOut).toHaveTextContent('Signing out…');
    // This device only: the everywhere row is the other scope.
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: false });
    expect(screen.getByTestId('settings-sign-out-everywhere')).toBeDisabled();

    await act(async () => {
      release?.({ otherDevicesSignedOut: true });
    });
  });

  it('shows a kit alert and re-enables the row when the sign-out fails', async () => {
    const user = userEvent.setup();
    backend.signOut.mockRejectedValue(new Error('network down'));
    await renderSettings();

    const signOut = screen.getByTestId('settings-sign-out');
    await user.click(signOut);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to sign out. Please try again.');
    expect(alert).toHaveClass('bg-dtint', 'text-danger');
    expect(signOut).toBeEnabled();
    expect(signOut).toHaveTextContent('Sign out');
  });

  const CONFIRM_TEXT = "Sign out on every device? You'll need to sign in again on each one.";
  const PARTIAL_NOTICE =
    "You're signed out on this device, but your other devices could not be signed out. Sign in again when you're online and try Sign out of all devices once more.";

  async function openEverywhereDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('settings-sign-out-everywhere'));
    return screen.findByRole('dialog');
  }

  it('asks before signing out of all devices, and signs out nothing until confirmed', async () => {
    const user = userEvent.setup();
    await renderSettings();
    expect(screen.getByTestId('settings-sign-out-everywhere')).toHaveTextContent(
      'Sign out of all devices'
    );

    const dialog = await openEverywhereDialog(user);

    expect(dialog).toHaveTextContent(CONFIRM_TEXT);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
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
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie')
    );

    const dialog = await openEverywhereDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Sign out everywhere' });
    confirm.focus();
    rerender(<Settings />);

    expect(confirm).toHaveFocus();
  });

  it('closes on Cancel, Escape and the backdrop without signing out', async () => {
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

  it('signs out of all devices on confirm, and says so while in flight', async () => {
    const user = userEvent.setup();
    let release: ((value: { otherDevicesSignedOut: boolean }) => void) | undefined;
    backend.signOut.mockImplementation(
      () => new Promise<{ otherDevicesSignedOut: boolean }>((resolve) => (release = resolve))
    );
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));

    const everywhere = screen.getByTestId('settings-sign-out-everywhere');
    await waitFor(() => expect(everywhere).toBeDisabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(everywhere).toHaveTextContent('Signing out of all devices…');
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: true });
    const signOut = screen.getByTestId('settings-sign-out');
    expect(signOut).toBeDisabled();
    expect(signOut).toHaveTextContent('Sign out');

    await act(async () => {
      release?.({ otherDevicesSignedOut: true });
    });
    expect(getSignOutNotice()).toBeNull();
  });

  it('signs out once when "Sign out everywhere" is pressed twice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockReturnValue(new Promise(() => {}));
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    const confirm = within(dialog).getByRole('button', { name: 'Sign out everywhere' });
    // Both presses land before React re-renders, as a double tap on the
    // exiting dialog does: the second still holds the old handler.
    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: true });
  });

  it('hands a partial sign-out to the login screen as a notice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockResolvedValue({ otherDevicesSignedOut: false });
    await renderSettings();

    const dialog = await openEverywhereDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));

    await waitFor(() => expect(getSignOutNotice()).toBe(PARTIAL_NOTICE));
  });

  it('leaves the plain Sign out row asking nothing and showing no notice', async () => {
    const user = userEvent.setup();
    backend.signOut.mockResolvedValue({ otherDevicesSignedOut: true });
    await renderSettings();

    await user.click(screen.getByTestId('settings-sign-out'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.signOut).toHaveBeenCalledExactlyOnceWith({ everywhere: false });
    expect(getSignOutNotice()).toBeNull();
  });

  it('refuses to sign out of all devices offline, before any dialog or request', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await renderSettings({}, "Couldn't load your name");

    await user.click(screen.getByTestId('settings-sign-out-everywhere'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'You are offline. Signing out of all devices needs a connection to go through.'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-sign-out-everywhere')).toBeEnabled();
  });

  it('disables the display-name row and says Loading... while the first read is in flight', async () => {
    // Released before the case ends: the read runs in the shared account-data
    // queue, and one left pending would hold every later case's read behind it.
    let releaseRead: () => void = () => {};
    backend.fetchOwnProfile.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseRead = () => resolve({ displayName: 'Jessie', birthday: null });
      })
    );
    render(<Settings />);

    expect(screen.getByTestId('settings-display-name-edit')).toBeDisabled();
    expect(screen.getByTestId('settings-display-name').textContent).toBe('Loading...');

    releaseRead();
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie')
    );
  });

  it('renders no identity row when the user has no email', async () => {
    backend.getUser.mockResolvedValue({ id: 'user-a' });
    await renderSettings();
    // Let the user read settle, so the absence below is its answer.
    await act(async () => {
      await backend.getUser.mock.results[0]?.value;
    });

    expect(screen.queryByTestId('settings-identity')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Signed in');
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent('person@example.com');
  });

  it('renders the identity row with the display name initial when there is an email', async () => {
    await renderSettings();

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-identity')).toHaveTextContent('Signed in');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('J');
  });

  it('takes the avatar initial from the email when no display name is set', async () => {
    backend.fetchOwnProfile.mockResolvedValue({ displayName: null, birthday: null });
    render(<Settings />);
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('Not set yet')
    );

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('P');
  });

  it('shows a whole emoji, not half a surrogate pair, for an emoji-led name', async () => {
    backend.fetchOwnProfile.mockResolvedValue({ displayName: '💖 Jessie', birthday: null });
    render(<Settings />);
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('💖 Jessie')
    );

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('💖');
  });

  it('shows a whole multi-code-point emoji for a name led by a skin-tone emoji', async () => {
    backend.fetchOwnProfile.mockResolvedValue({ displayName: '👍🏽 Jessie', birthday: null });
    render(<Settings />);
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('👍🏽 Jessie')
    );

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('👍🏽');
  });

  it('keeps the "Change" verb in the display-name row\'s accessible name', async () => {
    await renderSettings();

    expect(screen.getByRole('button', { name: /^Change Display name/ })).toBe(
      screen.getByTestId('settings-display-name-edit')
    );
  });
});
