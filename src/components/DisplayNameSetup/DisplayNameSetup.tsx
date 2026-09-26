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

import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type SubmitEvent } from 'react';
import { getUser } from '../../api/auth/sessionService';
import { isOnline } from '../../api/errorHandlers';
import { SEED_FALLBACK_NAME, supabase } from '../../api/supabaseClient';
import { offlineMessage } from '../../services/accountDataError';
import { logger } from '../../utils/logger';
import {
  DIALOG_BACKDROP,
  DIALOG_PANEL,
  DIALOG_TITLE,
  FAILURE_BOX,
  FIELD_LABEL,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';

interface DisplayNameSetupProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when display name is set successfully */
  onComplete: () => void;
  /**
   * Name to pre-fill the field with, for the Settings edit route.
   *
   * Read once, by `useState`'s initialiser -- so the caller has to mount this
   * component freshly per open rather than keep it mounted behind
   * `isOpen={false}`, or a later change to this prop is ignored. Settings does
   * exactly that; App's signup gate passes nothing and gets today's empty field.
   */
  initialName?: string;
  /**
   * Supplied only by a surface the user can back out of. Its presence IS what
   * renders the Cancel control: the signup gate deliberately has no way out,
   * because an account with no name is the state this modal exists to end.
   */
  onCancel?: () => void;
  /**
   * Which copy to wear. 'setup' is the first-run welcome; 'edit' is the same
   * form, with the same refusals, reached from Settings by someone who already
   * has a name.
   */
  mode?: 'setup' | 'edit';
}

export const DisplayNameSetup: React.FC<DisplayNameSetupProps> = ({
  isOpen,
  onComplete,
  initialName = '',
  onCancel,
  mode = 'setup',
}) => {
  const [displayName, setDisplayName] = useState(initialName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateDisplayName = (name: string): boolean => {
    return name.length >= 3 && name.length <= 30;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
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

  // Escape closes, but ONLY where there is somewhere to close to. The signup
  // gate supplies no `onCancel` and so gets no key handler at all: an account
  // with no name is the state this modal exists to end, and a dismissable gate
  // would drop the user into an app still showing their email.
  //
  // Bound to the document rather than the overlay because nothing here traps
  // focus (deliberately — see the dialog role below), so the key event can be
  // raised from outside this subtree.
  //
  // Carries the same `isLoading` guard the Cancel button does, because closing
  // is what `onCancel` means and the button is `disabled={isLoading}` for a
  // reason: the parent unmounts this form on cancel, but the in-flight write is
  // not cancelled with it. Without the guard, Escape during a save lets the
  // write land anyway while the UI backs out, and a FAILED write sets its error
  // on an unmounted component, so the user is told nothing.
  useEffect(() => {
    if (!isOpen || !onCancel || isLoading) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel, isLoading]);

  if (!isOpen) {
    return null;
  }

  const isEdit = mode === 'edit';

  const submitButton = (
    <button
      type="submit"
      className={onCancel ? PRIMARY_BUTTON : `${PRIMARY_BUTTON} w-full`}
      data-testid="display-name-submit"
      disabled={isLoading || !displayName.trim()}
    >
      {isLoading ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {isEdit ? 'Saving...' : 'Setting up...'}
        </>
      ) : isEdit ? (
        'Save name'
      ) : (
        'Continue'
      )}
    </button>
  );

  return (
    <div className={DIALOG_BACKDROP} data-testid="display-name-setup">
      {/* Opened by choice over a live Settings page, so it has to announce
          itself as a dialog and name itself from the title already on screen.
          `aria-modal` is what tells a screen reader to stop at the scrim rather
          than read Change and Sign Out behind it. No focus trap: one would be a
          larger change than this needs, and without it Escape is bound to the
          document so the key still reaches us. */}
      <div
        className={`${DIALOG_PANEL} max-w-md`}
        data-testid="display-name-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-modal-title"
      >
        <div className="mb-5">
          <h2 className={DIALOG_TITLE} id="display-name-modal-title">
            {isEdit ? 'Change your name' : 'Welcome!'}
          </h2>
          <p className="mt-1 text-sm text-muted" data-testid="display-name-subtitle">
            {isEdit
              ? 'This is the name your partner sees on your notes.'
              : 'What would you like to be called?'}
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

          {/* Cancel first in the DOM so Tab reaches it before the primary
              action, and rendered only when there is somewhere to cancel TO.
              Without `onCancel` (the signup gate) the submit button renders
              bare, full width, with no actions row. */}
          {onCancel ? (
            <div className="flex gap-3">
              <button
                type="button"
                className={SECONDARY_BUTTON}
                data-testid="display-name-cancel"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              {submitButton}
            </div>
          ) : (
            submitButton
          )}
        </form>
      </div>
    </div>
  );
};
