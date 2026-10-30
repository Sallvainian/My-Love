import { Capacitor, registerPlugin } from '@capacitor/core';
import { AuthError } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { supabase } from '../supabaseClient';

/**
 * Google sign-in for the native iOS shell (DW-323).
 *
 * Google refuses sign-in inside the shell's web view, and the web flow's
 * redirect back to `window.location.origin` would land on `capacitor://localhost`.
 * Here the provider page opens in Apple's sign-in sheet instead (the NativeAuth
 * plugin, ios/App/App/NativeAuth.swift), which hands back the callback URL.
 * The code verifier `signInWithOAuth` stored stays in this web view, so the
 * exchange below redeems it exactly as the web flow's `detectSessionInUrl` does.
 *
 * The callback URL must be in the hosted project's redirect allow list, or
 * Supabase sends the sheet to the site URL and it never returns.
 */
const CALLBACK_SCHEME = 'dev.sallvain.mylove';
export const NATIVE_AUTH_CALLBACK = `${CALLBACK_SCHEME}://auth-callback`;

interface NativeAuthPlugin {
  start(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
}

const NativeAuth = registerPlugin<NativeAuthPlugin>('NativeAuth');

/** `'cancelled'` when the person closed the sheet or declined at Google. */
export const signInWithGoogleNative = async (): Promise<AuthError | 'cancelled' | null> => {
  // An app installed before the plugin existed still receives web updates.
  if (!Capacitor.isPluginAvailable('NativeAuth')) {
    return new AuthError('Google sign-in needs the latest version of the app.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_AUTH_CALLBACK,
      skipBrowserRedirect: true,
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

  let callbackUrl: string;
  try {
    ({ url: callbackUrl } = await NativeAuth.start({
      url: data.url,
      callbackScheme: CALLBACK_SCHEME,
    }));
  } catch (err) {
    if ((err as { code?: string }).code === 'CANCELLED') return 'cancelled';
    console.error('[AuthService] Google sign-in sheet failed:', err);
    return new AuthError('The Google sign-in sheet failed.');
  }

  const params = new URL(callbackUrl).searchParams;
  const providerError = params.get('error');
  if (providerError === 'access_denied') return 'cancelled';
  const code = params.get('code');
  if (providerError || !code) {
    console.error('[AuthService] Google sign-in returned no code:', providerError);
    return new AuthError(params.get('error_description') ?? 'Google sign-in returned no code.');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[AuthService] Google code exchange failed:', exchangeError.message);
    return exchangeError;
  }

  logger.debug('[AuthService] Google sign-in completed in the native shell');
  return null;
};
