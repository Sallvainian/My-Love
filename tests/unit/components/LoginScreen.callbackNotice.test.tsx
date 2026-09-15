/**
 * DW-95 / DW-96: the login screen is the one surface that explains a callback
 * which ended here.
 *
 * `src/api/auth/actionService` is mocked so importing the component never
 * builds a Supabase client -- `actionService` imports `src/api/supabaseClient`,
 * whose module body reads `import.meta.env` and constructs the real thing. The
 * mock also gives the two handlers something to call, which is what lets the
 * suppression case exercise the real `handleSubmit` and `handleGoogleSignIn`
 * rather than a stand-in.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthCallbackOutcome } from '../../../src/api/supabaseClient';
import { LoginScreen } from '../../../src/components/LoginScreen/LoginScreen';

const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../../src/api/auth/actionService', () => ({
  signIn: actions.signIn,
  signInWithGoogle: actions.signInWithGoogle,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderLogin = (callbackOutcome: AuthCallbackOutcome) =>
  render(<LoginScreen callbackOutcome={callbackOutcome} />);

describe('LoginScreen callback notice', () => {
  it('names a cancelled sign-in as recoverable', () => {
    renderLogin('cancelled');

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice.textContent).toContain('cancelled');
    // Recoverable in tone: signing in again from this browser works.
    expect(notice.textContent).toContain('sign in again');
  });

  it('points a stranded code callback back at the browser it started in', () => {
    renderLogin('needs-original-browser');

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice.textContent).toContain('browser you started in');
  });

  it('gives the two outcomes distinct copy', () => {
    const { unmount } = renderLogin('cancelled');
    const cancelled = screen.getByTestId('login-notice').textContent;
    unmount();

    renderLogin('needs-original-browser');
    const stranded = screen.getByTestId('login-notice').textContent;

    expect(cancelled).toBeTruthy();
    expect(stranded).not.toBe(cancelled);
  });

  it('renders no notice region for an ordinary load', () => {
    renderLogin(null);

    expect(screen.queryByTestId('login-notice')).toBeNull();
    // The login screen itself is untouched by the absent outcome.
    expect(screen.getByTestId('login-screen')).toBeTruthy();
  });

  it('renders no notice region when the prop is not passed at all', () => {
    render(<LoginScreen />);

    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('clears the notice when a password sign-in attempt starts', () => {
    // Left unresolved on purpose: the notice must go the moment the attempt
    // starts, not when its result arrives.
    actions.signIn.mockReturnValue(new Promise(() => {}));
    renderLogin('cancelled');
    expect(screen.getByTestId('login-notice')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'someone@test.example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'a-password' },
    });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('clears the notice when a Google sign-in attempt starts', () => {
    actions.signInWithGoogle.mockReturnValue(new Promise(() => {}));
    renderLogin('needs-original-browser');
    expect(screen.getByTestId('login-notice')).toBeTruthy();

    fireEvent.click(screen.getByTestId('google-signin-button'));

    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('lets the attempt’s own feedback take the place of the notice', async () => {
    // A rejected attempt: the notice goes when the attempt starts and the error
    // banner is what the person reads instead. The two never stack.
    actions.signIn.mockResolvedValue({
      user: null,
      session: null,
      error: { message: 'Invalid login credentials' },
    });
    renderLogin('cancelled');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'someone@test.example.com' },
    });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'a-password' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByTestId('login-notice')).toBeNull();
  });
});
