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

import { useState, type FormEvent } from 'react';
import { signIn, signInWithGoogle } from '../../api/auth/actionService';
import type { AuthCallbackOutcome } from '../../api/supabaseClient';
import './LoginScreen.css';

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNoticeDismissed(true);

    // Client-side validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

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
        // reach a caller (`GoTrueClient.js:960-962`), and all four of its
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
    <div className="login-screen" data-testid="login-screen">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        {callbackNotice && (
          <div className="login-notice" data-testid="login-notice" role="status" aria-live="polite">
            <svg
              className="notice-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>{callbackNotice}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error" data-testid="login-error" role="alert" aria-live="polite">
              <svg
                className="error-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              data-testid="password-input"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            data-testid="submit-button"
            disabled={isLoading || isGoogleLoading || !email || !password}
          >
            {isLoading ? (
              <span className="loading-spinner">
                <svg
                  className="spinner-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="spinner-track"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="spinner-head"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="oauth-divider">
          <span className="divider-line"></span>
          <span className="divider-text">OR</span>
          <span className="divider-line"></span>
        </div>

        <button
          type="button"
          className="google-signin-button"
          data-testid="google-signin-button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <span className="loading-spinner">
              <svg
                className="spinner-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="spinner-track"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="spinner-head"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Redirecting to Google...
            </span>
          ) : (
            <>
              <svg
                className="google-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="login-footer">
          <p className="footer-text">
            Don't have an account?{' '}
            <button
              type="button"
              className="signup-link"
              onClick={() => {
                setError(
                  'Sign-up functionality coming soon. Please contact your administrator for account creation.'
                );
              }}
              disabled={isLoading}
            >
              Contact Admin
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
