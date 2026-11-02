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

/** What `signOut` resolves with: whether the account's other devices were signed out too. */
export interface SignOutResult {
  /**
   * False when "Sign out of all devices" could not reach every device: the
   * auth server was unreachable, or the push registrations could not be
   * removed. This device is signed out either way. True for a plain sign-out,
   * which never claims the other devices.
   */
  otherDevicesSignedOut: boolean;
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
