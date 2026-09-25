import type { Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

let authStateCallback: ((event: string, session: Session | null) => void | Promise<void>) | null =
  null;

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

function deferred() {
  let resolve: () => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

// Token persistence runs on the subscription's promise queue after the
// callback returns. A macrotask lets every settled queue step run.
const flushPersistence = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const listenerSession = {
  access_token: 'listener-access-token',
  refresh_token: 'listener-refresh-token',
  expires_at: 777,
  user: { id: 'listener-user', email: 'listener@example.com' },
} as Session;

describe('auth session/action services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    mockStoreAuthToken.mockResolvedValue(undefined);
    mockClearAuthToken.mockResolvedValue(undefined);

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

    authStateCallback('SIGNED_IN', session);
    authStateCallback('SIGNED_OUT', null);
    await flushPersistence();

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

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'])(
    'delivers %s synchronously while token persistence is pending',
    async (event) => {
      const pending = deferred();
      const sideEffect = event === 'SIGNED_OUT' ? mockClearAuthToken : mockStoreAuthToken;
      sideEffect.mockReturnValue(pending.promise);
      const session = event === 'SIGNED_OUT' ? null : listenerSession;
      const listener = vi.fn();
      onAuthStateChange(listener);

      authStateCallback!(event, session);

      expect(listener).toHaveBeenCalledExactlyOnceWith(session);
      expect(sideEffect).not.toHaveBeenCalled();
      await flushPersistence();
      expect(sideEffect).toHaveBeenCalledTimes(1);
      expect(listener.mock.invocationCallOrder[0]).toBeLessThan(
        sideEffect.mock.invocationCallOrder[0]!
      );
      pending.resolve();
      await flushPersistence();
      expect(listener).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'])(
    'returns undefined rather than a promise for %s',
    (event) => {
      onAuthStateChange(vi.fn());

      const result: unknown = authStateCallback!(
        event,
        event === 'SIGNED_OUT' ? null : listenerSession
      );

      expect(result).toBeUndefined();
    }
  );

  it.each(['SIGNED_IN', 'SIGNED_OUT'])(
    'starts the next token write only after a delayed %s write settles',
    async (firstEvent) => {
      const pendingStore = deferred();
      const pendingClear = deferred();
      mockStoreAuthToken.mockReturnValue(pendingStore.promise);
      mockClearAuthToken.mockReturnValue(pendingClear.promise);
      const listener = vi.fn();
      onAuthStateChange(listener);
      const firstSession = firstEvent === 'SIGNED_IN' ? listenerSession : null;
      const secondSession = firstEvent === 'SIGNED_IN' ? null : listenerSession;
      const secondEvent = firstEvent === 'SIGNED_IN' ? 'SIGNED_OUT' : 'SIGNED_IN';
      const [firstEffect, secondEffect] =
        firstEvent === 'SIGNED_IN'
          ? [mockStoreAuthToken, mockClearAuthToken]
          : [mockClearAuthToken, mockStoreAuthToken];
      const firstStorage = firstEvent === 'SIGNED_IN' ? pendingStore : pendingClear;
      const secondStorage = firstEvent === 'SIGNED_IN' ? pendingClear : pendingStore;

      authStateCallback!(firstEvent, firstSession);
      authStateCallback!(secondEvent, secondSession);
      expect(listener.mock.calls).toEqual([[firstSession], [secondSession]]);

      // Even if the second write could finish first, it must not start yet.
      secondStorage.resolve();
      await flushPersistence();
      expect(firstEffect).toHaveBeenCalledTimes(1);
      expect(secondEffect).not.toHaveBeenCalled();

      firstStorage.resolve();
      await flushPersistence();
      expect(secondEffect).toHaveBeenCalledTimes(1);
      expect(firstEffect.mock.invocationCallOrder[0]).toBeLessThan(
        secondEffect.mock.invocationCallOrder[0]!
      );
    }
  );

  it('continues queued token writes after an earlier write rejects', async () => {
    const pendingStore = deferred();
    mockStoreAuthToken.mockReturnValue(pendingStore.promise);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    onAuthStateChange(vi.fn());

    authStateCallback!('SIGNED_IN', listenerSession);
    authStateCallback!('SIGNED_OUT', null);
    await flushPersistence();
    expect(mockClearAuthToken).not.toHaveBeenCalled();

    const error = new Error('Token storage unavailable');
    pendingStore.reject(error);
    await flushPersistence();

    expect(errorLog).toHaveBeenCalledWith(
      '[AuthService] Failed to update stored auth token:',
      error
    );
    expect(mockClearAuthToken).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'])(
    'logs a rejected %s token side effect after delivering the auth transition',
    async (event) => {
      const pending = deferred();
      const sideEffect = event === 'SIGNED_OUT' ? mockClearAuthToken : mockStoreAuthToken;
      sideEffect.mockReturnValue(pending.promise);
      const session = event === 'SIGNED_OUT' ? null : listenerSession;
      const listener = vi.fn();
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      onAuthStateChange(listener);

      authStateCallback!(event, session);
      expect(listener).toHaveBeenCalledExactlyOnceWith(session);
      const error = new Error('Token storage unavailable');
      pending.reject(error);
      await flushPersistence();

      expect(errorLog).toHaveBeenCalledWith(
        event === 'SIGNED_OUT'
          ? '[AuthService] Failed to clear stored auth token:'
          : '[AuthService] Failed to update stored auth token:',
        error
      );
      expect(listener).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    }
  );

  it.each([
    ['SIGNED_IN', 'resolves'],
    ['SIGNED_IN', 'rejects'],
    ['TOKEN_REFRESHED', 'resolves'],
    ['TOKEN_REFRESHED', 'rejects'],
    ['SIGNED_OUT', 'resolves'],
    ['SIGNED_OUT', 'rejects'],
  ] as const)(
    'rethrows a listener error synchronously and still queues %s token persistence that %s',
    async (event, tokenOutcome) => {
      const pending = deferred();
      const sideEffect = event === 'SIGNED_OUT' ? mockClearAuthToken : mockStoreAuthToken;
      sideEffect.mockReturnValue(pending.promise);
      const session = event === 'SIGNED_OUT' ? null : listenerSession;
      const listenerError = new Error('App listener failed');
      const listener = vi.fn(() => {
        throw listenerError;
      });
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      onAuthStateChange(listener);

      let thrown: unknown;
      try {
        authStateCallback!(event, session);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(listenerError);

      expect(listener).toHaveBeenCalledExactlyOnceWith(session);
      await flushPersistence();
      expect(sideEffect).toHaveBeenCalledTimes(1);
      expect(listener.mock.invocationCallOrder[0]).toBeLessThan(
        sideEffect.mock.invocationCallOrder[0]!
      );
      const tokenError = new Error('Token storage unavailable');
      if (tokenOutcome === 'rejects') pending.reject(tokenError);
      else pending.resolve();
      await flushPersistence();

      if (tokenOutcome === 'rejects') {
        expect(errorLog).toHaveBeenCalledWith(
          event === 'SIGNED_OUT'
            ? '[AuthService] Failed to clear stored auth token:'
            : '[AuthService] Failed to update stored auth token:',
          tokenError
        );
      } else {
        expect(errorLog).not.toHaveBeenCalled();
      }
      expect(listener).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    }
  );
});
