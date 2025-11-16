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

import { useState } from 'react';
import { authService } from '../../api/authService';
import { AnniversarySettings } from './AnniversarySettings';
import './Settings.css';

export const Settings: React.FC = () => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Get current user email on mount
  useState(() => {
    authService.getUser().then((user) => {
      setUserEmail(user?.email ?? null);
    });
  });

  const handleLogout = async () => {
    setError(null);
    setIsLoggingOut(true);

    try {
      await authService.signOut();

      if (import.meta.env.DEV) {
        console.log('[Settings] User signed out successfully');
      }

      // Session will be cleared by auth state listener in App.tsx
      // User will automatically be redirected to LoginScreen
    } catch (err) {
      console.error('[Settings] Logout failed:', err);
      setError('Failed to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="settings-container">
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

            <button onClick={handleLogout} disabled={isLoggingOut} className="logout-button">
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
    </div>
  );
};

export default Settings;
