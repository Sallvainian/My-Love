/**
 * LoginScreen Component
 *
 * Email/password authentication screen for user login.
 * Replaces anonymous authentication with proper user authentication.
 *
 * Features:
 * - Email/password form with validation
 * - Error handling and display
 * - Loading states
 * - Accessible form controls
 *
 * @component
 */

import { CircleAlert, Heart, Info, LoaderCircle } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { signIn, signInWithGoogle } from '../../api/auth/actionService';
import type { AuthCallbackOutcome } from '../../api/supabaseClient';
import {
  FAILURE_BOX,
  NOTICE,
  PRIMARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';

/** Field label, per the Sign in artboard: 600 13px `ink`, 6px above its input. */
const LABEL = 'text-[13px] font-semibold text-ink';

/** Dims a field while the sign-in request is in flight. */
const FIELD_DISABLED = 'disabled:cursor-not-allowed disabled:opacity-60';

/**
 * The neutral 48px pill the artboard draws for Google: `card2` fill, `ink`
 * label, no multicolour logo (its brand hex has no kit token).
 */
const GOOGLE_BUTTON =
  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-card2 px-5 text-[15px] font-semibold text-ink transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';

interface LoginScreenProps {
  /** Callback when login is successful */
  onLoginSuccess?: () => void;
  /**
   * What the authentication callback this page load arrived with did, when it
   * left the person here with nothing to read (DW-95, DW-96).
   */
  callbackOutcome?: AuthCallbackOutcome;
}

/**
 * What each recoverable callback outcome says. Both are phrased as something
 * that still works from here, because both are: signing in again from this
 * browser is the whole of the recovery in either case.
 */
const CALLBACK_NOTICES: Record<Exclude<AuthCallbackOutcome, null>, string> = {
  cancelled: 'Sign-in was cancelled, so nothing changed. You can sign in again below.',
  // Deliberately does NOT say "cancelled": nobody cancelled anything. It also
  // does not promise that retrying works, because a provider-side failure
  // often repeats -- saying "try again" and having it fail identically is the
  // thing that sends people looking for a fault in their own account.
  'provider-error':
    'Sign-in could not be completed — the sign-in service reported a problem, so nothing changed. Please try again in a moment.',
  // No mention of a link: the usual way here is a Google return whose verifier
  // is gone -- a private window, cleared storage, a PWA handing OAuth to a
  // separate context -- where nothing was opened and there may be no other
  // browser left to finish in. Hence "or", and a recovery that works from here.
  'needs-original-browser':
    'Sign-in could not be finished here — this is not the browser you started in, or that sign-in is no longer stored. Just sign in again below.',
  // Names the cause, unlike 'provider-error' above, because here the cause is
  // knowable often enough to be useful and the person can act on it: a link
  // they followed twice, or one that sat too long. The recovery is the same
  // either way, which is what makes naming it safe when it is occasionally a
  // server fault instead.
  'code-expired':
    'That sign-in link has expired or was already used, so nothing changed. Just sign in again below.',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, callbackOutcome }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new sign-in attempt retires the notice: from that moment the attempt's
  // own feedback is what the person needs, and the callback that produced the
  // notice is over either way.
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const callbackNotice =
    !noticeDismissed && callbackOutcome ? CALLBACK_NOTICES[callbackOutcome] : null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6; // Supabase minimum password length
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNoticeDismissed(true);

    // Client-side validation. An empty field never gets here: both inputs are
    // required and the submit button is disabled until both are filled.
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn({ email, password });

      if (result.error) {
        // Map Supabase error messages to user-friendly messages
        if (result.error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (result.error.message.includes('Email not confirmed')) {
          setError('Please confirm your email before signing in.');
        } else {
          setError(result.error.message);
        }
      } else if (result.session) {
        // Success - call callback if provided
        onLoginSuccess?.();
      } else {
        // Neither an error nor a session. Unreachable through the installed
        // auth-js: `signInWithPassword` substitutes an
        // `AuthInvalidTokenResponseError` for exactly this shape before it can
        // reach a caller (`dist/module/GoTrueClient.js:960-962` — naming the
        // build because the CJS one is the same code at different offsets, and
        // `package.json`'s `module` field is what Vite resolves), and all four of its
        // return paths carry an error or a session.
        //
        // Guarded anyway because the contract this code is written against is
        // `AuthResult` (`src/api/auth/types.ts:8-12`), which declares both
        // fields nullable, and the SDK is pinned only by a caret range. The
        // cost of being wrong in the other direction is a sign-in button that
        // stops the spinner and says nothing at all, which reads as the app
        // being broken (DW-132).
        console.error('[LoginScreen] Sign-in resolved with neither a session nor an error');
        setError('Sign-in could not be completed. Please try again.');
      }
    } catch (err) {
      console.error('[LoginScreen] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNoticeDismissed(true);
    setIsGoogleLoading(true);

    try {
      const error = await signInWithGoogle();

      if (error) {
        setError('Failed to initiate Google sign-in. Please try again.');
        setIsGoogleLoading(false);
      }
      // Note: If successful, user will be redirected to Google
      // The loading state will persist until redirect completes
    } catch (err) {
      console.error('[LoginScreen] Google sign-in error:', err);
      setError('An unexpected error occurred with Google sign-in.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col justify-center bg-page px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      data-testid="login-screen"
    >
      <div className="mx-auto flex w-full max-w-100 flex-col gap-7">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="flex items-center justify-center gap-2.75">
            <Heart
              data-testid="login-heading-icon"
              className="h-6 w-6 shrink-0 fill-current text-accent"
              strokeWidth={0}
              aria-hidden="true"
            />
            <span
              className="font-lora text-[34px] leading-none font-semibold text-ink italic"
              data-testid="login-wordmark"
            >
              My Love
            </span>
          </h1>
          <p className="text-[15px] text-muted" data-testid="login-tagline">
            Welcome back — sign in to continue
          </p>
        </div>

        <div
          className="grid gap-3.5 rounded-[20px] border border-line bg-card p-5 shadow-card"
          data-testid="login-card"
        >
          {callbackNotice && (
            <div
              className={`${NOTICE} flex items-start gap-2 text-sm text-ink`}
              data-testid="login-notice"
              role="status"
              aria-live="polite"
            >
              <Info
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                data-testid="login-notice-icon"
              />
              <span>{callbackNotice}</span>
            </div>
          )}

          <form className="grid gap-3.5" onSubmit={handleSubmit} data-testid="login-form">
            {error && (
              <div
                className={`${FAILURE_BOX} flex items-start gap-2`}
                data-testid="login-error"
                role="alert"
                aria-live="polite"
              >
                <CircleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                  data-testid="login-error-icon"
                />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={LABEL}>
                Email
              </label>
              <input
                id="email"
                type="email"
                className={`${fieldClass(Boolean(error))} ${FIELD_DISABLED}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                required
                autoComplete="email"
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={LABEL}>
                Password
              </label>
              <input
                id="password"
                data-testid="password-input"
                type="password"
                className={`${fieldClass(Boolean(error))} ${FIELD_DISABLED}`}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                required
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className={`${PRIMARY_BUTTON} mt-4.5 w-full`}
              data-testid="submit-button"
              disabled={isLoading || isGoogleLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                    data-testid="submit-button-spinner"
                  />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div
            className="flex items-center gap-3 text-xs font-semibold tracking-[.08em] text-muted"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-line" />
            OR
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            className={GOOGLE_BUTTON}
            data-testid="google-signin-button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Redirecting to Google...
              </>
            ) : (
              'Continue with Google'
            )}
          </button>
        </div>

        <p className="text-center text-sm text-muted" data-testid="login-footer">
          Need an account?{' '}
          <button
            type="button"
            className="rounded font-semibold text-accent transition-opacity hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setError(
                'Sign-up functionality coming soon. Please contact your administrator for account creation.'
              );
            }}
            disabled={isLoading || isGoogleLoading}
          >
            Contact admin
          </button>
        </p>
      </div>
    </div>
  );
};
