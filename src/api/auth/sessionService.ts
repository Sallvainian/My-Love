import type { Session, User } from '@supabase/supabase-js';
import { clearAuthToken, storeAuthToken } from '../../sw-db';
import { logger } from '../../utils/logger';
import { supabase } from '../supabaseClient';
import type { AuthStatus } from './types';

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
      callback(session);
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
