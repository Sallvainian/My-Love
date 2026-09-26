/**
 * Settings on the style kit: the page's own behaviour that the restyle added
 * or re-shaped — the About replay row, the Sign out row's in-flight and failed
 * states, the identity row and its avatar initial, the display-name row's
 * loading state and accessible name, and the section / group headings that
 * replaced the old inner titles.
 *
 * The real EventsSettings and AnniversarySettings are mounted on the real
 * store (signed out, so neither loads anything) because the headings under
 * test are theirs.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pkg from '../../../../package.json';

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

import { Settings } from '../Settings';

async function renderSettings(props: { onShowWelcome?: () => void } = {}) {
  render(<Settings {...props} />);
  await waitFor(() =>
    expect(screen.getByTestId('settings-display-name').textContent).toBe('Jessie')
  );
}

describe('Settings on the kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.getUser.mockResolvedValue({ id: 'user-a', email: 'person@example.com' });
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Jessie' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the four section labels and one heading per countdown group', async () => {
    await renderSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    ).toEqual(['Account', 'Countdowns', 'Photos', 'About']);
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

  it('shows the package.json version in the About row', async () => {
    await renderSettings();

    expect(screen.getByTestId('settings-version').textContent).toBe(
      `Version ${pkg.version} · made for the two of you`
    );
  });

  it('renders no replay row without a handler', async () => {
    await renderSettings();

    expect(screen.queryByTestId('settings-replay-welcome')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Replay welcome message');
  });

  it('disables the Sign out row and says so while the sign-out is in flight', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    backend.signOut.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    );
    await renderSettings();

    const signOut = screen.getByTestId('settings-sign-out');
    expect(signOut).toHaveTextContent('Sign out');
    await user.click(signOut);

    await waitFor(() => expect(signOut).toBeDisabled());
    expect(signOut).toHaveTextContent('Signing out…');

    await act(async () => {
      release?.();
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

  it('disables the display-name row and says Loading... while the first read is in flight', async () => {
    backend.lookupOwnDisplayName.mockReturnValue(new Promise(() => {}));
    render(<Settings />);

    expect(screen.getByTestId('settings-display-name-edit')).toBeDisabled();
    expect(screen.getByTestId('settings-display-name').textContent).toBe('Loading...');
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
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'unset' });
    render(<Settings />);
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('Not set yet')
    );

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('P');
  });

  it('shows a whole emoji, not half a surrogate pair, for an emoji-led name', async () => {
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: '💖 Jessie' });
    render(<Settings />);
    await waitFor(() =>
      expect(screen.getByTestId('settings-display-name').textContent).toBe('💖 Jessie')
    );

    expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com');
    expect(screen.getByTestId('settings-avatar').textContent).toBe('💖');
  });

  it('shows a whole multi-code-point emoji for a name led by a skin-tone emoji', async () => {
    backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: '👍🏽 Jessie' });
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
