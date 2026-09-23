/**
 * Settings Component
 *
 * Application settings screen on the style kit: account (identity and display
 * name), the couple's countdowns (events and anniversaries), about (with the
 * welcome-message replay) and sign out.
 *
 * @component
 */

import {
  AlertCircle,
  ChevronRight,
  Info,
  Loader2,
  LogOut,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { authService } from '../../api/authService';
import { lookupOwnDisplayName, type OwnDisplayNameLookup } from '../../api/supabaseClient';
import { logger } from '../../utils/logger';
import { DisplayNameSetup } from '../DisplayNameSetup/DisplayNameSetup';
import {
  CARD,
  DIVIDER,
  GROUP_ROW as ROW,
  GROUP_TILE as TILE,
  SECTION_LABEL,
} from '../shared/kitClasses';
import { AnniversarySettings } from './AnniversarySettings';
import { EventsSettings } from './EventsSettings';

const ROW_BUTTON = `${ROW} w-full rounded-[14px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`;

interface SettingsProps {
  /** Replays the welcome splash; the About row is not rendered without it. */
  onShowWelcome?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onShowWelcome }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  /** `null` while the read is in flight; the lookup's own three answers after. */
  const [nameLookup, setNameLookup] = useState<OwnDisplayNameLookup | null>(null);
  /** Bumped to re-run the read after a save, which is the whole re-read. */
  const [nameReadToken, setNameReadToken] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);

  // Get current user email on mount
  useState(() => {
    authService.getUser().then((user) => {
      setUserEmail(user?.email ?? null);
    });
  });

  // The name is read here rather than taken from a store because nothing keeps
  // it: `lookupOwnDisplayName` recomputes the seed classification on every read
  // and no slice caches the answer. A cancelled flag rather than an AbortSignal
  // — the lookup has no abort to offer, so what is guarded is the `set`, not
  // the request.
  useEffect(() => {
    let cancelled = false;

    // No `setNameLookup(null)` here: a synchronous setState in an effect body is
    // a lint error (react-hooks/set-state-in-effect). The one caller that needs
    // the row back in its in-flight state — `onComplete`, so the Change control
    // is disabled across the re-read — clears it from the event handler instead.
    void lookupOwnDisplayName().then((result) => {
      if (cancelled) return;

      if (result.status === 'error') {
        // Not surfaced in the page-level error banner: that one is for actions
        // the user just took, and a failed name read still leaves every other
        // setting usable. The row says so itself and editing stays open.
        console.error('[Settings] Could not read the profile display name:', result.reason);
      }

      setNameLookup(result);
    });

    return () => {
      cancelled = true;
    };
  }, [nameReadToken]);

  // Only a successfully-read name pre-fills the field. 'unset' has no name to
  // offer and 'error' does not know one — offering a guess there would invite
  // the user to save it back over whatever is really stored.
  const editPrefill = nameLookup?.status === 'chosen' ? nameLookup.displayName : '';

  const displayNameLabel = (() => {
    switch (nameLookup?.status) {
      case 'chosen':
        return nameLookup.displayName;
      case 'unset':
        return 'Not set yet';
      case 'error':
        return "Couldn't load your name";
      default:
        return 'Loading...';
    }
  })();

  // The avatar's letter: the chosen display name's, else the email's.
  const avatarSource =
    (nameLookup?.status === 'chosen' && nameLookup.displayName.trim()) || userEmail;
  // First grapheme, not `charAt(0)` or the first code point: a flag, skin-tone
  // or ZWJ emoji spans several code points and would otherwise render in part.
  const [firstGrapheme] = avatarSource
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(avatarSource.trim())
    : [];
  const avatarInitial = firstGrapheme?.segment.toUpperCase() ?? '';

  const handleLogout = async () => {
    setError(null);
    setIsLoggingOut(true);

    try {
      await authService.signOut();

      logger.debug('[Settings] User signed out successfully');

      // Session will be cleared by auth state listener in App.tsx
      // User will automatically be redirected to LoginScreen
    } catch (err) {
      console.error('[Settings] Logout failed:', err);
      setError('Failed to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 pt-3 pb-6"
      data-testid="settings-view"
    >
      <header className="px-1 pt-1">
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold text-ink">Settings</h1>
      </header>

      {error && (
        <div
          className="flex items-center gap-2 rounded-[14px] bg-dtint px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Account */}
      <section className="flex flex-col gap-2" aria-labelledby="settings-account-label">
        <h2 id="settings-account-label" className={SECTION_LABEL}>
          Account
        </h2>
        <div className={CARD}>
          {userEmail && (
            <>
              <div className={ROW}>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-base font-semibold text-white"
                  aria-hidden="true"
                  data-testid="settings-avatar"
                >
                  {avatarInitial}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[15px] font-medium break-words text-ink">{userEmail}</p>
                  <p className="text-[13px] text-muted">Signed in</p>
                </div>
              </div>
              <div className={DIVIDER} aria-hidden="true" />
            </>
          )}

          {/* Enabled on a failed read too: the user may well know the name
              they want, and the form's own refusals are what protect the
              column. Disabled only while the first read is in flight, when
              opening would pre-fill from an answer that has not arrived. */}
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            disabled={nameLookup === null}
            className={`${ROW_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="settings-display-name-edit"
          >
            <span className={TILE} aria-hidden="true">
              <Pencil className="h-[17px] w-[17px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/* "Change " keeps the verb the old Change button carried in
                  the row's accessible name. */}
              <span className="text-[15px] font-medium text-ink">
                <span className="sr-only">Change </span>Display name
              </span>
              <span className="text-[13px] break-words text-muted" data-testid="settings-display-name">
                {displayNameLabel}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Countdowns — the couple-shared events above the anniversaries. */}
      <section className="flex flex-col gap-2" aria-labelledby="settings-countdowns-label">
        <h2 id="settings-countdowns-label" className={SECTION_LABEL}>
          Countdowns
        </h2>
        <div className={CARD}>
          <EventsSettings />
          <div className={DIVIDER} aria-hidden="true" />
          <AnniversarySettings />
        </div>
      </section>

      {/* About */}
      <section className="flex flex-col gap-2" aria-labelledby="settings-about-label">
        <h2 id="settings-about-label" className={SECTION_LABEL}>
          About
        </h2>
        <div className={CARD}>
          <div className={ROW}>
            <span className={TILE} aria-hidden="true">
              <Info className="h-[17px] w-[17px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[15px] font-medium text-ink">My Love</p>
              <p className="text-[13px] text-muted">Version {__APP_VERSION__} · made for the two of you</p>
            </div>
          </div>
          {onShowWelcome && (
            <>
              <div className={DIVIDER} aria-hidden="true" />
              <button
                type="button"
                onClick={onShowWelcome}
                className={ROW_BUTTON}
                data-testid="settings-replay-welcome"
              >
                <span className={TILE} aria-hidden="true">
                  <RotateCcw className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">
                  Replay welcome message
                </span>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </section>

      {/* Sign out — its own quiet card, not a red block. */}
      <div className={CARD}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`${ROW_BUTTON} text-[15px] font-medium text-danger disabled:cursor-not-allowed disabled:opacity-60`}
          data-testid="settings-sign-out"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dtint"
            aria-hidden="true"
          >
            {isLoggingOut ? (
              <Loader2 className="h-[17px] w-[17px] animate-spin" />
            ) : (
              <LogOut className="h-[17px] w-[17px]" />
            )}
          </span>
          {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* Mounted only while open, so `useState(initialName)` inside the form
          actually picks the current name up — kept mounted behind
          `isOpen={false}` it would hold the name it first saw forever. Outside
          every card, so no card's layout can clip or contain the overlay. */}
      {isEditingName && (
        <DisplayNameSetup
          isOpen
          mode="edit"
          initialName={editPrefill}
          onCancel={() => setIsEditingName(false)}
          onComplete={() => {
            setIsEditingName(false);
            // Back to the in-flight state FIRST, so `disabled={nameLookup === null}`
            // covers the re-read too. Left holding the pre-save answer, the
            // Change control stays live across that window and reopening the
            // form there prefills `editPrefill` from the OLD name — which the
            // next save then writes back over the name just stored.
            //
            // Cleared here rather than in the effect body, where a synchronous
            // setState is a lint error (react-hooks/set-state-in-effect): this
            // is an event handler, so the same call is fine.
            setNameLookup(null);
            // Re-read rather than trust the submitted string: the row is what
            // the rest of the app renders from, and the read applies the seed
            // rule the write side only refuses.
            setNameReadToken((token) => token + 1);
          }}
        />
      )}
    </div>
  );
};
