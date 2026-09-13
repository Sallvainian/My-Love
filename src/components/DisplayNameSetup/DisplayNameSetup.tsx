/**
 * DisplayNameSetup Modal
 *
 * Prompts users to set their display name after a signup that carried no name.
 * This modal appears AFTER auth is complete to avoid broken accounts.
 *
 * Features:
 * - Modal overlay with form
 * - Display name validation (3-30 characters)
 * - Writes the name to the user's own `public.users` row
 *
 * The name is profile data, not auth identity. It used to be written to
 * `auth.updateUser({ data: { display_name } })` and mirrored into `public.users`
 * by `sync_user_profile()`, but that trigger re-ran its `ON CONFLICT DO UPDATE`
 * on every auth update and so reset the name on the next sign-in.
 * 20260912030000_profile_name_email_ownership.sql took `display_name` out of
 * that branch and granted `authenticated` UPDATE on (display_name, updated_at),
 * so the profile row is now the one place the name lives and a plain update is
 * the whole write. No metadata write, and no session refresh after it.
 *
 * @component
 */

import { useState, type FormEvent } from 'react';
import { getUser } from '../../api/auth/sessionService';
import { SEED_FALLBACK_NAME, supabase } from '../../api/supabaseClient';
import { logger } from '../../utils/logger';
import './DisplayNameSetup.css';

interface DisplayNameSetupProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when display name is set successfully */
  onComplete: () => void;
}

export const DisplayNameSetup: React.FC<DisplayNameSetupProps> = ({ isOpen, onComplete }) => {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateDisplayName = (name: string): boolean => {
    return name.length >= 3 && name.length <= 30;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (!validateDisplayName(displayName.trim())) {
      setError('Display name must be between 3 and 30 characters');
      return;
    }

    setIsLoading(true);

    try {
      const user = await getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Refuse exactly what the read side calls a seed.
      //
      // `lookupOwnDisplayName` classifies a stored name equal to the account's
      // email or to SEED_FALLBACK_NAME as "no name chosen", and it recomputes
      // that on EVERY read rather than recording an answer. So saving one of
      // these would succeed and then re-open this modal on every reload and
      // every TOKEN_REFRESHED, permanently — and since the modal is an early
      // return in App.tsx, a mid-session re-open unmounts the whole app tree.
      // The length check alone let both through: any email of 30 characters or
      // fewer passes it, and so does the literal 'Unknown'.
      //
      // Checked here rather than beside the length rule because it needs the
      // account email, which only `getUser()` above supplies. Still no write:
      // this returns before the update, and the outer `finally` clears the
      // loading flag.
      const trimmedName = displayName.trim();
      const accountEmail = user.email?.trim() ?? '';

      if (accountEmail !== '' && trimmedName.toLowerCase() === accountEmail.toLowerCase()) {
        setError('Please choose a name that is different from your email address');
        return;
      }

      if (trimmedName === SEED_FALLBACK_NAME) {
        setError(`"${SEED_FALLBACK_NAME}" is not a name — please choose another`);
        return;
      }

      // The profile row is the name's only home. A plain update, not an upsert:
      // the row already exists (sync_user_profile() creates it in the same
      // statement that creates the auth user), and an upsert would have to name
      // `id`, which `authenticated` no longer holds UPDATE on.
      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
          display_name: trimmedName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('id');

      if (updateError) {
        throw updateError;
      }

      // Fail closed. RLS makes a write the caller is not allowed to make a
      // zero-row update rather than an error, and so does a missing profile
      // row — and either way the name was not saved, so closing the modal would
      // drop the user into an app that still shows their email.
      if (!updated || updated.length === 0) {
        throw new Error('Could not find your profile to save the name to');
      }

      logger.debug('[DisplayNameSetup] Display name set successfully:', displayName.trim());

      onComplete();
    } catch (err) {
      console.error('[DisplayNameSetup] Error setting display name:', err);
      setError(err instanceof Error ? err.message : 'Failed to set display name');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="display-name-setup-overlay" data-testid="display-name-setup">
      <div className="display-name-setup-modal" data-testid="display-name-modal">
        <div className="modal-header">
          <h2 className="modal-title">Welcome! 👋</h2>
          <p className="modal-subtitle">What would you like to be called?</p>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && (
            <div
              className="error-message"
              data-testid="display-name-error"
              role="alert"
              aria-live="polite"
            >
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
            <label htmlFor="displayName" className="form-label">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              className="form-input"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              required
              minLength={3}
              maxLength={30}
              autoFocus
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
            />
            <p className="form-hint">3-30 characters</p>
          </div>

          <button
            type="submit"
            className="submit-button"
            data-testid="display-name-submit"
            disabled={isLoading || !displayName.trim()}
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
                Setting up...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
