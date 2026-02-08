import { supabase } from '../supabaseClient';
import { clearAuthToken, storeAuthToken } from '../../sw-db';
import type { Session, User } from '@supabase/supabase-js';
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
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      try {
        await storeAuthToken({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          userId: session.user?.id ?? '',
        });
        if (import.meta.env.DEV) {
          console.log(`[AuthService] Updated stored auth token (${event})`);
        }
      } catch (tokenError) {
        console.error('[AuthService] Failed to update stored auth token:', tokenError);
      }
    }

    if (event === 'SIGNED_OUT') {
      try {
        await clearAuthToken();
        if (import.meta.env.DEV) {
          console.log('[AuthService] Cleared stored auth token (SIGNED_OUT)');
        }
      } catch (tokenError) {
        console.error('[AuthService] Failed to clear stored auth token:', tokenError);
      }
    }

    callback(session);
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const sessionService = {
  getSession,
  getUser,
  getCurrentUserId,
  getCurrentUserIdOfflineSafe,
  getAuthStatus,
  onAuthStateChange,
};

export default sessionService;
