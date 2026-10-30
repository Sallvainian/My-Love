/**
 * Google sign-in in the native iOS shell (DW-323): the provider page opens in
 * Apple's sign-in sheet via the NativeAuth plugin, and the returned code is
 * exchanged in this web view, where `signInWithOAuth` left the code verifier.
 */
import { AuthError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWithGoogle } from '../actionService';
import { NATIVE_AUTH_CALLBACK } from '../nativeGoogleSignIn';

const { capacitor, nativeAuth, mockSignInWithOAuth, mockExchangeCodeForSession } = vi.hoisted(
  () => ({
    capacitor: { isNativePlatform: vi.fn(), isPluginAvailable: vi.fn() },
    nativeAuth: { start: vi.fn() },
    mockSignInWithOAuth: vi.fn(),
    mockExchangeCodeForSession: vi.fn(),
  })
);

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => nativeAuth,
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  },
}));

vi.mock('../../../sw-db', () => ({
  storeAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
}));

const PROVIDER_URL = 'https://project.supabase.invalid/auth/v1/authorize?provider=google';

beforeEach(() => {
  vi.clearAllMocks();
  capacitor.isNativePlatform.mockReturnValue(true);
  capacitor.isPluginAvailable.mockReturnValue(true);
  mockSignInWithOAuth.mockResolvedValue({ data: { url: PROVIDER_URL }, error: null });
  nativeAuth.start.mockResolvedValue({ url: `${NATIVE_AUTH_CALLBACK}?code=abc` });
  mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('signInWithGoogle in the native shell', () => {
  it('opens the provider in the sign-in sheet and exchanges the returned code', async () => {
    await expect(signInWithGoogle()).resolves.toBeNull();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'dev.sallvain.mylove://auth-callback',
        skipBrowserRedirect: true,
      }),
    });
    expect(nativeAuth.start).toHaveBeenCalledWith({
      url: PROVIDER_URL,
      callbackScheme: 'dev.sallvain.mylove',
    });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('asks for an app update when the installed shell has no NativeAuth plugin', async () => {
    capacitor.isPluginAvailable.mockReturnValue(false);

    const result = await signInWithGoogle();

    expect(result).toBeInstanceOf(AuthError);
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    expect(nativeAuth.start).not.toHaveBeenCalled();
  });

  it('reports a closed sheet as cancelled', async () => {
    nativeAuth.start.mockRejectedValue(Object.assign(new Error('closed'), { code: 'CANCELLED' }));

    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a refusal at Google as cancelled', async () => {
    nativeAuth.start.mockResolvedValue({ url: `${NATIVE_AUTH_CALLBACK}?error=access_denied` });

    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('fails when the sheet itself fails', async () => {
    nativeAuth.start.mockRejectedValue(Object.assign(new Error('no window'), { code: 'FAILED' }));

    await expect(signInWithGoogle()).resolves.toBeInstanceOf(AuthError);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('fails when the callback carries a provider error or no code', async () => {
    nativeAuth.start.mockResolvedValue({
      url: `${NATIVE_AUTH_CALLBACK}?error=server_error&error_description=Google+is+down`,
    });
    const providerError = await signInWithGoogle();
    expect(providerError).toBeInstanceOf(AuthError);
    expect((providerError as AuthError).message).toBe('Google is down');

    nativeAuth.start.mockResolvedValue({ url: NATIVE_AUTH_CALLBACK });
    await expect(signInWithGoogle()).resolves.toBeInstanceOf(AuthError);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('returns the error when the code exchange fails', async () => {
    const exchangeError = new AuthError('invalid flow state');
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: exchangeError });

    await expect(signInWithGoogle()).resolves.toBe(exchangeError);
  });

  it('returns the error when Supabase cannot build the provider URL', async () => {
    const oauthError = new AuthError('provider disabled');
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: oauthError });

    await expect(signInWithGoogle()).resolves.toBe(oauthError);
    expect(nativeAuth.start).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle on the web', () => {
  it('keeps the page redirect back to this origin and never opens the sheet', async () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    mockSignInWithOAuth.mockResolvedValue({ data: { url: PROVIDER_URL }, error: null });

    await expect(signInWithGoogle()).resolves.toBeNull();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: `${window.location.origin}/` }),
    });
    const [{ options }] = mockSignInWithOAuth.mock.calls[0];
    expect(options).not.toHaveProperty('skipBrowserRedirect');
    expect(nativeAuth.start).not.toHaveBeenCalled();
  });
});
