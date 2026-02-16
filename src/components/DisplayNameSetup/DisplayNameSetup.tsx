/**
 * DisplayNameSetup Modal
 *
 * Prompts users to set their display name after successful Google OAuth signup.
 * This modal appears AFTER auth is complete to avoid broken accounts.
 *
 * Features:
 * - Modal overlay with form
 * - Display name validation (3-30 characters)
 * - Updates Supabase Auth user_metadata
 * - Creates users table row if needed
 *
 * @component
 */

import { useState, type FormEvent } from 'react';
import { getUser } from '../../api/auth/sessionService';
import { supabase } from '../../api/supabaseClient';
import './DisplayNameSetup.css';

export interface DisplayNameSetupProps {
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

      // Update Supabase Auth user_metadata with display name
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      // Create users table row if it doesn't exist
      // This is idempotent - if row exists, it won't create duplicate
      const { error: upsertError } = await supabase.from('users').upsert(
        {
          id: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

      if (upsertError) {
        console.error('[DisplayNameSetup] Error creating user row:', upsertError);
        // Don't throw - this is not critical, user_metadata update is what matters
      }

      if (import.meta.env.DEV) {
        console.log('[DisplayNameSetup] Display name set successfully:', displayName.trim());
      }

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
    <div className="display-name-setup-overlay">
      <div className="display-name-setup-modal">
        <div className="modal-header">
          <h2 className="modal-title">Welcome! 👋</h2>
          <p className="modal-subtitle">What would you like to be called?</p>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message" role="alert" aria-live="polite">
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

export default DisplayNameSetup;
