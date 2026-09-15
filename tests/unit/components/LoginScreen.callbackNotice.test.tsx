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

  it('explains a sign-in link that has expired or been used already', () => {
    renderLogin('code-expired');

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice.textContent).toContain('expired or was already used');
    // Recoverable from here, with no instruction to go anywhere else -- the
    // distinction from 'needs-original-browser', which is the outcome this one
    // would otherwise be confused with.
    expect(notice.textContent).toContain('sign in again below');
    expect(notice.textContent).not.toContain('browser you started in');
  });

  it('separates a provider-side failure from a cancellation', () => {
    renderLogin('provider-error');

    const notice = screen.getByTestId('login-notice');
    expect(notice).toHaveAttribute('role', 'status');
    // Nobody cancelled anything, and the copy must not say they did. This
    // outcome shipped with no render coverage at all; only the classifier that
    // produces it was tested.
    expect(notice.textContent).not.toContain('cancelled');
    expect(notice.textContent).toContain('sign-in service reported a problem');
  });

  it('gives every outcome distinct copy', () => {
    // All four, not a pair. Each exists to tell the person something different
    // about what went wrong, so any two sharing wording means one of them is
    // not doing its job -- and the copy is the entire feature.
    const outcomes = [
      'cancelled',
      'provider-error',
      'needs-original-browser',
      'code-expired',
    ] as const;

    const copy = outcomes.map((outcome) => {
      const { unmount } = renderLogin(outcome);
      const text = screen.getByTestId('login-notice').textContent;
      unmount();
      expect(text, `${outcome} must render a notice`).toBeTruthy();
      return text;
    });

    expect(new Set(copy).size).toBe(outcomes.length);
  });

  it('says something when a sign-in resolves with neither a session nor an error', async () => {
    // Driven at OUR contract, not the SDK's. `AuthResult`
    // (src/api/auth/types.ts:8-12) declares both fields nullable, and this is
    // what `LoginScreen` does when handed that shape. The installed auth-js
    // cannot produce it -- `GoTrueClient.js:960-962` substitutes an
    // `AuthInvalidTokenResponseError` first -- so mocking the SDK into this
    // state would be asserting against an impossible world. Stubbing the
    // boundary the component actually calls is the honest version (DW-132).
    actions.signIn.mockResolvedValue({ user: null, session: null, error: null });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<LoginScreen callbackOutcome={null} />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'someone@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByTestId('login-screen').querySelector('form') as HTMLFormElement);

    // The failure mode this guards is a button that stops its spinner and
    // leaves the screen exactly as it was, which reads as the app being broken.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /sign-in could not be completed/i
    );
    errorLog.mockRestore();
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
