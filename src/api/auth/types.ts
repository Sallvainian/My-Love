import type { AuthError, Session, User } from '@supabase/supabase-js';

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
 * The code on the error Google sign-in returns in an installed app that predates
 * the NativeAuth plugin. Here, not in nativeGoogleSignIn.ts, so the login screen
 * can match it without importing the Supabase client.
 */
export const NATIVE_AUTH_UNAVAILABLE = 'native_auth_unavailable';
