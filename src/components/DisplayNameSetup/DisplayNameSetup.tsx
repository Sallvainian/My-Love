/**
 * DisplayNameSetup Modal
 *
 * Prompts users to set their display name after a signup that carried no name.
 * This modal appears AFTER auth is complete to avoid broken accounts.
 *
 * Features:
 * - Modal overlay with form
 * - Display name validation through `displayNameRefusal` (profileService.ts),
 *   the rule Settings' Name page uses too: 3-30 characters, not the account
 *   email, not `SEED_FALLBACK_NAME`
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

import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { getUser } from '../../api/auth/sessionService';
import { isOnline } from '../../api/errorHandlers';
import { supabase } from '../../api/supabaseClient';
import { offlineMessage } from '../../services/accountDataError';
import { displayNameRefusal, isDisplayNameLength } from '../../services/profileService';
import { logger } from '../../utils/logger';
import {
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  FAILURE_BOX,
  FIELD_LABEL,
  PRIMARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';

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

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (!isDisplayNameLength(displayName)) {
      setError(displayNameRefusal(displayName, null));
      return;
    }

    // Refused before `getUser()` or the update, so no request goes out and the
    // profile row is untouched.
    if (!isOnline()) {
      setError(offlineMessage('Name changes', 'save'));
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
      const refusal = displayNameRefusal(trimmedName, user.email);
      if (refusal) {
        setError(refusal);
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
    <div className={DIALOG_BACKDROP} data-testid="display-name-setup">
      {/* The dialog role and its name from the title on screen stay: the gate
          is a blocking surface, and `aria-modal` marks the scrim as the edge of
          what can be reached. No focus trap and no way out -- an account with
          no name is the state this modal exists to end. */}
      <div
        className={`${DIALOG_PANEL} max-w-md`}
        data-testid="display-name-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-modal-title"
      >
        <div className="mb-5">
          <h2 className={DIALOG_TITLE} id="display-name-modal-title">
            Welcome!
          </h2>
          <p className="mt-1 text-sm text-muted" data-testid="display-name-subtitle">
            What would you like to be called?
          </p>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit} data-testid="display-name-form">
          {error && (
            <div
              className={`${FAILURE_BOX} flex items-start gap-2`}
              data-testid="display-name-error"
              role="alert"
              aria-live="polite"
            >
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                data-testid="display-name-error-icon"
              />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="displayName" className={FIELD_LABEL}>
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              className={`${fieldClass(Boolean(error))} disabled:cursor-not-allowed disabled:opacity-60`}
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
            <p className="mt-1.5 text-[13px] text-muted" data-testid="display-name-hint">
              3-30 characters
            </p>
          </div>

          <button
            type="submit"
            className={`${PRIMARY_BUTTON} w-full`}
            data-testid="display-name-submit"
            disabled={isLoading || !displayName.trim()}
          >
            {isLoading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Setting up...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
