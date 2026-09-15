/**
 * Settings Component
 *
 * Application settings screen with logout and account management.
 *
 * Features:
 * - User account information display
 * - Logout functionality
 * - Settings sections (Anniversary, Account, etc.)
 *
 * @component
 */

import { useEffect, useState } from 'react';
import { authService } from '../../api/authService';
import { lookupOwnDisplayName, type OwnDisplayNameLookup } from '../../api/supabaseClient';
import { logger } from '../../utils/logger';
import { DisplayNameSetup } from '../DisplayNameSetup/DisplayNameSetup';
import { AnniversarySettings } from './AnniversarySettings';
import { EventsSettings } from './EventsSettings';
import './Settings.css';

export const Settings: React.FC = () => {
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
    <div className="settings-container" data-testid="settings-view">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      {error && (
        <div className="settings-error" role="alert">
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

      <div className="settings-content">
        {/* Account Section */}
        <section className="settings-section">
          <h2 className="section-title">Account</h2>
          <div className="section-content">
            {userEmail && (
              <div className="user-info">
                <svg
                  className="user-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="user-email">{userEmail}</p>
                  <p className="user-label">Signed in</p>
                </div>
              </div>
            )}

            <div className="display-name-row">
              <div className="display-name-text">
                <p className="display-name-value" data-testid="settings-display-name">
                  {displayNameLabel}
                </p>
                <p className="user-label">Display name</p>
              </div>
              {/* Enabled on a failed read too: the user may well know the name
                  they want, and the form's own refusals are what protect the
                  column. Disabled only while the first read is in flight, when
                  opening would pre-fill from an answer that has not arrived. */}
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                disabled={nameLookup === null}
                className="display-name-edit-button"
                data-testid="settings-display-name-edit"
              >
                Change
              </button>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="logout-button"
              data-testid="settings-sign-out"
            >
              {isLoggingOut ? (
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
                  Signing out...
                </span>
              ) : (
                <>
                  <svg
                    className="logout-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4.414l-4.293 4.293a1 1 0 01-1.414 0L4 7.414 5.414 6l3.293 3.293L13.586 6 15 7.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Sign Out
                </>
              )}
            </button>
          </div>
        </section>

        {/* Events Section — the couple-shared countdowns, above the
            device-local anniversaries below it. */}
        <section className="settings-section">
          <h2 className="section-title">Events</h2>
          <div className="section-content">
            <EventsSettings />
          </div>
        </section>

        {/* Anniversary Section */}
        <section className="settings-section">
          <h2 className="section-title">Anniversary</h2>
          <div className="section-content">
            <AnniversarySettings />
          </div>
        </section>

        {/* App Information */}
        <section className="settings-section">
          <h2 className="section-title">About</h2>
          <div className="section-content">
            <div className="app-info">
              <p className="app-name">My Love</p>
              <p className="app-version">Version 1.0.0</p>
              <p className="app-description">A personal connection app for you and your partner</p>
            </div>
          </div>
        </section>
      </div>

      {/* Mounted only while open, so `useState(initialName)` inside the form
          actually picks the current name up — kept mounted behind
          `isOpen={false}` it would hold the name it first saw forever. Outside
          `.settings-content` because `.settings-section` sets `overflow:
          hidden`. */}
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
