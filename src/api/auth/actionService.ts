import { Capacitor } from '@capacitor/core';
import type { AuthError } from '@supabase/supabase-js';
import { removePushRegistration } from '../../services/pushNotifications';
import { clearAuthToken, storeAuthToken } from '../../sw-db';
import { logger } from '../../utils/logger';
import { supabase } from '../supabaseClient';
import { signInWithGoogleNative } from './nativeGoogleSignIn';
import type { AuthCredentials, AuthResult } from './types';

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

    logger.debug('[AuthService] Sign-in successful:', data.user?.email);

    if (data.session) {
      try {
        await storeAuthToken({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? 0,
          userId: data.user?.id ?? '',
        });
        logger.debug('[AuthService] Stored auth token for Background Sync');
      } catch (tokenError) {
        console.error('[AuthService] Failed to store auth token:', tokenError);
      }
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

    logger.debug('[AuthService] Sign-up successful:', data.user?.email);

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

export const signOut = async (): Promise<void> => {
  try {
    // While the session still exists: the RPC that drops this device's push
    // registration needs it. Online only, at most ~3 s, never throws. The
    // native half (APNs unregister, badge) runs from clearAuth once the
    // SIGNED_OUT event below arrives, offline too.
    await removePushRegistration();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[AuthService] Sign-out failed:', error.message);
      throw error;
    }

    try {
      await clearAuthToken();
      logger.debug('[AuthService] Cleared auth token from IndexedDB');
    } catch (tokenError) {
      console.error('[AuthService] Failed to clear auth token:', tokenError);
    }

    logger.debug('[AuthService] Sign-out successful');
  } catch (err) {
    console.error('[AuthService] Unexpected error during sign-out:', err);
    throw err;
  }
};

export const resetPassword = async (email: string): Promise<AuthError | null> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
    });

    if (error) {
      console.error('[AuthService] Password reset failed:', error.message);
      return error;
    }

    logger.debug('[AuthService] Password reset email sent to:', email);

    return null;
  } catch (err) {
    console.error('[AuthService] Unexpected error during password reset:', err);
    return err as AuthError;
  }
};

export const signInWithGoogle = async (): Promise<AuthError | 'cancelled' | null> => {
  if (Capacitor.isNativePlatform()) return signInWithGoogleNative();

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
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

    logger.debug('[AuthService] Google OAuth redirect initiated');

    return null;
  } catch (err) {
    console.error('[AuthService] Unexpected error during Google OAuth:', err);
    return err as AuthError;
  }
};
