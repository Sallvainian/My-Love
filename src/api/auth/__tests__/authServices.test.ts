import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import { signIn, signOut } from '../actionService';
import { onAuthStateChange } from '../sessionService';

const {
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockResetPasswordForEmail,
  mockSignInWithOAuth,
  mockGetSession,
  mockGetUser,
  mockOnAuthStateChange,
  mockStoreAuthToken,
  mockClearAuthToken,
  mockUnsubscribe,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockStoreAuthToken: vi.fn(),
  mockClearAuthToken: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

let authStateCallback:
  | ((event: string, session: Session | null) => void | Promise<void>)
  | null = null;

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      signInWithOAuth: mockSignInWithOAuth,
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock('../../../sw-db', () => ({
  storeAuthToken: mockStoreAuthToken,
  clearAuthToken: mockClearAuthToken,
}));

describe('auth session/action services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;

    mockOnAuthStateChange.mockImplementation(
      (callback: (event: string, session: Session | null) => void | Promise<void>) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: mockUnsubscribe,
            },
          },
        };
      }
    );
  });

  it('stores SW auth token on successful sign-in', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
    } as unknown as User;
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 12345,
      user,
    } as unknown as Session;

    mockSignInWithPassword.mockResolvedValue({
      data: { user, session },
      error: null,
    });

    const result = await signIn({ email: 'user@example.com', password: 'password123' });

    expect(result.error).toBeNull();
    expect(mockStoreAuthToken).toHaveBeenCalledTimes(1);
    expect(mockStoreAuthToken).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 12345,
      userId: 'user-123',
    });
  });

  it('clears SW auth token on successful sign-out', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearAuthToken).toHaveBeenCalledTimes(1);
  });

  it('applies token side effects in onAuthStateChange for sign-in and sign-out events', async () => {
    const user = {
      id: 'user-456',
      email: 'auth@example.com',
    } as unknown as User;
    const session = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: 777,
      user,
    } as unknown as Session;

    const listener = vi.fn();
    const unsubscribe = onAuthStateChange(listener);

    if (!authStateCallback) {
      throw new Error('Auth state callback was not registered');
    }

    await authStateCallback('SIGNED_IN', session);
    await authStateCallback('SIGNED_OUT', null);

    expect(mockStoreAuthToken).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 777,
      userId: 'user-456',
    });
    expect(mockClearAuthToken).toHaveBeenCalled();
    expect(listener).toHaveBeenNthCalledWith(1, session);
    expect(listener).toHaveBeenNthCalledWith(2, null);

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
