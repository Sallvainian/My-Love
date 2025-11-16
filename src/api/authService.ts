/**
 * Authentication Service
 *
 * Handles user authentication using Supabase Auth with email/password.
 * Replaces the anonymous authentication pattern from Story 6.1.
 *
 * @module api/authService
 */

import { supabase } from './supabaseClient';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}

/**
 * Sign in with email and password
 *
 * @param credentials - User email and password
 * @returns Auth result with user, session, and any errors
 *
 * @example
 * ```typescript
 * const result = await authService.signIn({
 *   email: 'user@example.com',
 *   password: 'securepassword123'
 * });
 *
 * if (result.error) {
 *   console.error('Login failed:', result.error.message);
 * } else {
 *   console.log('Logged in as:', result.user?.email);
 * }
 * ```
 */
export const signIn = async (credentials: AuthCredentials): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.error('[AuthService] Sign-in failed:', error.message);
      return { user: null, session: null, error };
    }

    if (import.meta.env.DEV) {
      console.log('[AuthService] Sign-in successful:', data.user?.email);
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error('[AuthService] Unexpected error during sign-in:', err);
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
};

/**
 * Sign up a new user with email and password
 *
 * @param credentials - User email and password
 * @returns Auth result with user, session, and any errors
 *
 * @example
 * ```typescript
 * const result = await authService.signUp({
 *   email: 'newuser@example.com',
 *   password: 'securepassword123'
 * });
 *
 * if (result.error) {
 *   console.error('Sign-up failed:', result.error.message);
 * } else {
 *   console.log('Account created for:', result.user?.email);
 * }
 * ```
 */
export const signUp = async (credentials: AuthCredentials): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.error('[AuthService] Sign-up failed:', error.message);
      return { user: null, session: null, error };
    }

    if (import.meta.env.DEV) {
      console.log('[AuthService] Sign-up successful:', data.user?.email);
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error('[AuthService] Unexpected error during sign-up:', err);
    return {
      user: null,
      session: null,
      error: err as AuthError,
    };
  }
};

/**
 * Sign out the current user
 *
 * Clears the authentication session and removes stored tokens.
 *
 * @example
 * ```typescript
 * await authService.signOut();
 * console.log('User signed out');
 * ```
 */
export const signOut = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AuthService] Sign-out failed:', error.message);
      throw error;
    }

    if (import.meta.env.DEV) {
      console.log('[AuthService] Sign-out successful');
    }
  } catch (err) {
    console.error('[AuthService] Unexpected error during sign-out:', err);
    throw err;
  }
};

/**
 * Get the current authenticated session
 *
 * Returns the current session if user is authenticated, null otherwise.
 * Session includes user info and JWT tokens.
 *
 * @returns Current session or null if not authenticated
 *
 * @example
 * ```typescript
 * const session = await authService.getSession();
 * if (session) {
 *   console.log('User ID:', session.user.id);
 *   console.log('Email:', session.user.email);
 * } else {
 *   console.log('No active session');
 * }
 * ```
 */
export const getSession = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[AuthService] Failed to get session:', error.message);
      return null;
    }

    return data.session;
  } catch (err) {
    console.error('[AuthService] Unexpected error getting session:', err);
    return null;
  }
};

/**
 * Get the current authenticated user
 *
 * Returns the current user if authenticated, null otherwise.
 *
 * @returns Current user or null if not authenticated
 *
 * @example
 * ```typescript
 * const user = await authService.getUser();
 * if (user) {
 *   console.log('Logged in as:', user.email);
 * } else {
 *   console.log('Not logged in');
 * }
 * ```
 */
export const getUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[AuthService] Failed to get user:', error.message);
      return null;
    }

    return data.user;
  } catch (err) {
    console.error('[AuthService] Unexpected error getting user:', err);
    return null;
  }
};

/**
 * Get the current authenticated user ID
 *
 * Returns the user's UUID if authenticated, null otherwise.
 * This is the preferred way to get the user ID for database operations
 * as it works with Row Level Security policies (auth.uid()).
 *
 * @returns User UUID or null if not authenticated
 *
 * @example
 * ```typescript
 * const userId = await authService.getCurrentUserId();
 * if (userId) {
 *   // Use userId for database operations
 *   const moods = await moodApi.getMoods(userId);
 * }
 * ```
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getUser();
  return user?.id ?? null;
};

/**
 * Check authentication status
 *
 * Returns comprehensive auth status including user and session info.
 *
 * @returns Auth status object
 *
 * @example
 * ```typescript
 * const status = await authService.getAuthStatus();
 * if (status.isAuthenticated) {
 *   console.log('Welcome,', status.user?.email);
 * } else {
 *   console.log('Please log in');
 * }
 * ```
 */
export const getAuthStatus = async (): Promise<AuthStatus> => {
  const session = await getSession();
  const user = session?.user ?? null;

  return {
    isAuthenticated: !!session,
    user,
    session,
  };
};

/**
 * Listen to authentication state changes
 *
 * Sets up a listener for auth state changes (sign in, sign out, token refresh).
 * Returns an unsubscribe function to clean up the listener.
 *
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 *
 * @example
 * ```typescript
 * const unsubscribe = authService.onAuthStateChange((session) => {
 *   if (session) {
 *     console.log('User signed in:', session.user.email);
 *   } else {
 *     console.log('User signed out');
 *   }
 * });
 *
 * // Later, clean up
 * unsubscribe();
 * ```
 */
export const onAuthStateChange = (callback: (session: Session | null) => void): (() => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};

/**
 * Reset password for a user
 *
 * Sends a password reset email to the specified address.
 *
 * @param email - User's email address
 * @returns Error if reset failed, null if successful
 *
 * @example
 * ```typescript
 * const error = await authService.resetPassword('user@example.com');
 * if (error) {
 *   console.error('Password reset failed:', error.message);
 * } else {
 *   console.log('Password reset email sent');
 * }
 * ```
 */
export const resetPassword = async (email: string): Promise<AuthError | null> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('[AuthService] Password reset failed:', error.message);
      return error;
    }

    if (import.meta.env.DEV) {
      console.log('[AuthService] Password reset email sent to:', email);
    }

    return null;
  } catch (err) {
    console.error('[AuthService] Unexpected error during password reset:', err);
    return err as AuthError;
  }
};

/**
 * Sign in with Google OAuth
 *
 * Initiates Google OAuth flow. User will be redirected to Google for authentication,
 * then back to the application. On successful return, Supabase automatically creates
 * a user account with email from Google profile.
 *
 * @returns Error if OAuth initialization failed, null if redirect initiated successfully
 *
 * @example
 * ```typescript
 * const error = await authService.signInWithGoogle();
 * if (error) {
 *   console.error('Google sign-in failed:', error.message);
 * }
 * // User will be redirected to Google for authentication
 * ```
 */
export const signInWithGoogle = async (): Promise<AuthError | null> => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[AuthService] Google OAuth failed:', error.message);
      return error;
    }

    if (import.meta.env.DEV) {
      console.log('[AuthService] Google OAuth redirect initiated');
    }

    return null;
  } catch (err) {
    console.error('[AuthService] Unexpected error during Google OAuth:', err);
    return err as AuthError;
  }
};

// Export as singleton service
export const authService = {
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
  getCurrentUserId,
  getAuthStatus,
  onAuthStateChange,
  resetPassword,
  signInWithGoogle,
};

export default authService;
