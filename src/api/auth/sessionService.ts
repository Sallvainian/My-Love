import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { clearAuthToken, storeAuthToken } from '../../sw-db';
import { logger } from '../../utils/logger';
import { readStoredSession } from '../authStorage';
import { supabase } from '../supabaseClient';
import type { AuthStatus } from './types';

/**
 * How long `getSession` waits for the SDK, while a session is stored, before
 * answering with the stored one. The SDK answers at once unless it is
 * refreshing an expired access token, and a refresh that cannot reach the
 * server retries with backoff for up to 30 s (auth-js
 * `AUTO_REFRESH_TICK_DURATION_MS`), which held the app on its loading screen.
 */
export const STORED_SESSION_WAIT_MS = 1500;

const SDK_TOO_SLOW = Symbol('sdk-too-slow');

/**
 * The current session, or `null` when signed out or the read failed.
 *
 * While the server is unreachable this may return the session the SDK still
 * holds in storage, whose access token may have expired; the SDK renews it
 * once the server answers. With a session stored, it never waits on the SDK's
 * refresh retries: offline (`navigator.onLine` false) it answers with the
 * stored session at once, and otherwise after `STORED_SESSION_WAIT_MS`. The
 * SDK's own outcome still reaches the app through `onAuthStateChange`
 * (TOKEN_REFRESHED, or SIGNED_OUT when the server rejects the refresh token).
 */
export const getSession = async (): Promise<Session | null> => {
  const sdkRead = readSdkSession();
  if (!readStoredSession()) return sdkRead;
  // A sign-in redirect (`?code=` or `#code=`) may be exchanging a code for a
  // different account; the stored session must not open the app first.
  if (carriesAuthCode()) return sdkRead;

  if (globalThis.navigator?.onLine === false) {
    const stored = readStoredSession();
    if (stored) {
      console.warn('[AuthService] Offline; using the stored session');
      return stored;
    }
    return sdkRead;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooSlow = new Promise<typeof SDK_TOO_SLOW>((resolve) => {
    timer = setTimeout(() => resolve(SDK_TOO_SLOW), STORED_SESSION_WAIT_MS);
  });
  const first = await Promise.race([sdkRead, tooSlow]);
  clearTimeout(timer);
  if (first !== SDK_TOO_SLOW) return first;

  // Read again: the SDK may have emptied its storage (a real sign-out) while
  // this waited, and an empty store means signed out.
  const stored = readStoredSession();
  if (!stored) return sdkRead;
  console.warn('[AuthService] Session read is slow; using the stored session');
  return stored;
};

/** Whether this page load is a sign-in redirect carrying a code, as `supabaseClient`'s `returnedWithCode` reads it. */
const carriesAuthCode = (): boolean => {
  try {
    const url = new URL(globalThis.location?.href ?? '');
    if (url.searchParams.has('code')) return true;
    return url.hash.startsWith('#') && new URLSearchParams(url.hash.substring(1)).has('code');
  } catch {
    return false;
  }
};

/** The SDK's answer, with the stored session standing in for an unreachable server. */
const readSdkSession = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // An unreachable server is not a sign-out: while the SDK still holds
      // the session in storage, answer with it (see `readStoredSession`).
      if (isAuthRetryableFetchError(error)) {
        const stored = readStoredSession();
        if (stored) {
          console.warn(
            '[AuthService] Server unreachable; using the stored session:',
            error.message
          );
        } else {
          console.error('[AuthService] Failed to get session:', error.message);
        }
        return stored;
      }
      console.error('[AuthService] Failed to get session:', error.message);
      return null;
    }

    return data.session;
  } catch (err) {
    console.error('[AuthService] Unexpected error getting session:', err);
    return null;
  }
};

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

export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getUser();
  return user?.id ?? null;
};

export const getCurrentUserIdOfflineSafe = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.user?.id ?? null;
};

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const session = await getSession();
  const user = session?.user ?? null;

  return {
    isAuthenticated: !!session,
    user,
    session,
  };
};

export const onAuthStateChange = (callback: (session: Session | null) => void): (() => void) => {
  // The SDK no longer waits for token writes, so this subscription queues
  // them itself: each store/clear starts only after the previous one settles,
  // committing in auth arrival order. Work items log their own errors, so the
  // chain never rejects.
  let persistence = Promise.resolve();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    // Synchronous on purpose: auth-js awaits async listeners, which can
    // deadlock a nested refresh triggered from TOKEN_REFRESHED. Invalidate the
    // app's previous session before any token persistence is queued.
    try {
      // A null INITIAL_SESSION also arrives when the SDK could not reach the
      // server to refresh an expired token, with the session still stored.
      // Hand the app that stored session; an empty store stays `null`.
      if (event === 'INITIAL_SESSION' && !session) {
        const stored = readStoredSession();
        if (stored) {
          console.warn('[AuthService] INITIAL_SESSION carried no session; using the stored one');
        }
        callback(stored);
      } else {
        callback(session);
      }
    } finally {
      // Queue token persistence even if app delivery throws, while letting
      // that original error propagate synchronously.
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const token = {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          userId: session.user?.id ?? '',
        };
        persistence = persistence.then(async () => {
          try {
            await storeAuthToken(token);
            logger.debug(`[AuthService] Updated stored auth token (${event})`);
          } catch (tokenError) {
            console.error('[AuthService] Failed to update stored auth token:', tokenError);
          }
        });
      }

      if (event === 'SIGNED_OUT') {
        persistence = persistence.then(async () => {
          try {
            await clearAuthToken();
            logger.debug('[AuthService] Cleared stored auth token (SIGNED_OUT)');
          } catch (tokenError) {
            console.error('[AuthService] Failed to clear stored auth token:', tokenError);
          }
        });
      }
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};
