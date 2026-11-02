import { Capacitor } from '@capacitor/core';
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';
import { removeAllPushRegistrations, removePushRegistration } from '../../services/pushNotifications';
import { clearAuthToken, storeAuthToken } from '../../sw-db';
import { logger } from '../../utils/logger';
import { AUTH_STORAGE_KEY, readStoredSession } from '../authStorage';
import { supabase } from '../supabaseClient';
import { signInWithGoogleNative } from './nativeGoogleSignIn';
import type { AuthCredentials, AuthResult, SignOutResult } from './types';

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

/**
 * The access token the SDK would send now, renewed first if it was about to
 * expire, as the global sign-out's own request uses; the stored one when the
 * SDK has none to give. Never throws.
 */
async function currentAccessToken(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch (error) {
    console.warn('[AuthService] Could not read the session before signing out:', error);
  }
  return readStoredSession()?.access_token;
}

/**
 * Signs out. By default only this device's session ends (owner decision
 * 2026-11-02); `everywhere` ends the account's sessions on every device, for a
 * lost or given-away phone. Callers check the connection before `everywhere`:
 * a server it cannot reach still signs this device out, below, but no other.
 *
 * Resolves `{ otherDevicesSignedOut: false }` when `everywhere` could not
 * reach every device -- the global sign-out met a retryable error, or the push
 * registrations could not be removed (a lost phone would keep its pushes) --
 * so the caller can say so. A plain sign-out always resolves true.
 */
export const signOut = async ({
  everywhere = false,
}: { everywhere?: boolean } = {}): Promise<SignOutResult> => {
  try {
    let otherDevicesSignedOut = true;

    // A plain sign-out drops this device's push row while the session still
    // exists: the RPC needs it. At most ~3 s, never throws; online, in the
    // shell only. The native half (APNs unregister, badge) runs from clearAuth
    // once the SIGNED_OUT event below arrives, offline too.
    //
    // Everywhere drops every device's row only after the global sign-out
    // (DW-412): before it, another device's session is still live, so a
    // registration landing in between passed register_push_device's session
    // check and outlived the sign-out. Afterwards that check refuses every
    // device, and this access token stays valid until it expires, which is all
    // unregister_all_push_devices reads (auth.uid()). It is read here because
    // the sign-out removes the session from the client.
    let accessToken: string | undefined;
    if (everywhere) {
      accessToken = await currentAccessToken();
    } else {
      await removePushRegistration();
    }

    // 'local' ends this device's session only; the SDK's default, 'global',
    // ends the account's sessions on every device.
    let { error } = await supabase.auth.signOut({ scope: everywhere ? 'global' : 'local' });

    if (everywhere && !(await removeAllPushRegistrations(accessToken))) {
      otherDevicesSignedOut = false;
    }

    // The server is unreachable. With a valid access token the SDK has already
    // removed the session and emitted SIGNED_OUT, so the sign-out is done. On a
    // stored session it could not refresh, it returns before removing it: sign
    // out on this device instead -- with the key gone, a local sign-out skips
    // the server and emits SIGNED_OUT, so the usual cleanup runs. Either way the
    // server-side session is not revoked (DW-377).
    if (error && isAuthRetryableFetchError(error)) {
      // The other devices' sessions were not revoked either way.
      if (everywhere) otherDevicesSignedOut = false;
      if (readStoredSession()) {
        console.warn(
          '[AuthService] Server unreachable; signing out on this device:',
          error.message
        );
        localStorage.removeItem(AUTH_STORAGE_KEY);
        ({ error } = await supabase.auth.signOut({ scope: 'local' }));
      } else {
        error = null;
      }
    }

    // Any other error on the global sign-out (a 500, a 429): the SDK removes
    // this device's session before it returns one, so this device is signed
    // out but the others may not be. Report that rather than throw -- Settings
    // has already unmounted and could not show a thrown error.
    if (error && everywhere && !readStoredSession()) {
      console.warn(
        '[AuthService] Global sign-out failed; signed out on this device only:',
        error.message
      );
      otherDevicesSignedOut = false;
      error = null;
    }

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
    return { otherDevicesSignedOut };
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
