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

/**
 * Each auth transition with the token side effect it queues, the session the
 * listener receives, and the sentence logged if that side effect rejects.
 */
const TOKEN_CASES = [
  {
    event: 'SIGNED_IN',
    sideEffect: mockStoreAuthToken,
    session: listenerSession,
    message: '[AuthService] Failed to update stored auth token:',
  },
  {
    event: 'TOKEN_REFRESHED',
    sideEffect: mockStoreAuthToken,
    session: listenerSession,
    message: '[AuthService] Failed to update stored auth token:',
  },
  {
    event: 'SIGNED_OUT',
    sideEffect: mockClearAuthToken,
    session: null,
    message: '[AuthService] Failed to clear stored auth token:',
  },
];
type TokenCase = (typeof TOKEN_CASES)[number];

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

  it.each(TOKEN_CASES)(
    'delivers $event synchronously while token persistence is pending',
    async ({ event, sideEffect, session }) => {
      const pending = deferred();
      sideEffect.mockReturnValue(pending.promise);
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

  it.each(TOKEN_CASES)(
    'returns undefined rather than a promise for $event',
    ({ event, session }) => {
      onAuthStateChange(vi.fn());

      const result: unknown = authStateCallback!(event, session);

      expect(result).toBeUndefined();
    }
  );

  it.each([
    {
      firstEvent: 'SIGNED_IN',
      firstSession: listenerSession,
      firstEffect: mockStoreAuthToken,
      secondEvent: 'SIGNED_OUT',
      secondSession: null,
      secondEffect: mockClearAuthToken,
    },
    {
      firstEvent: 'SIGNED_OUT',
      firstSession: null,
      firstEffect: mockClearAuthToken,
      secondEvent: 'SIGNED_IN',
      secondSession: listenerSession,
      secondEffect: mockStoreAuthToken,
    },
  ])(
    'starts the next token write only after a delayed $firstEvent write settles',
    async ({ firstEvent, firstSession, firstEffect, secondEvent, secondSession, secondEffect }) => {
      const firstStorage = deferred();
      const secondStorage = deferred();
      firstEffect.mockReturnValue(firstStorage.promise);
      secondEffect.mockReturnValue(secondStorage.promise);
      const listener = vi.fn();
      onAuthStateChange(listener);

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

  it.each(TOKEN_CASES)(
    'logs a rejected $event token side effect after delivering the auth transition',
    async ({ event, sideEffect, session, message }) => {
      const pending = deferred();
      sideEffect.mockReturnValue(pending.promise);
      const listener = vi.fn();
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      onAuthStateChange(listener);

      authStateCallback!(event, session);
      expect(listener).toHaveBeenCalledExactlyOnceWith(session);
      const error = new Error('Token storage unavailable');
      pending.reject(error);
      await flushPersistence();

      expect(errorLog).toHaveBeenCalledWith(message, error);
      expect(listener).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    }
  );

  /**
   * Fires `event` at a listener that throws, and checks the throw reaches the
   * caller synchronously while the token write is still queued behind it.
   * Returns the pending write so each caller settles it its own way.
   */
  async function rethrowAndQueue({ event, sideEffect, session }: TokenCase) {
    const pending = deferred();
    sideEffect.mockReturnValue(pending.promise);
    const listenerError = new Error('App listener failed');
    const listener = vi.fn(() => {
      throw listenerError;
    });
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
    return { pending, listener };
  }

  it.each(TOKEN_CASES)(
    'rethrows a listener error synchronously and still queues $event token persistence that resolves',
    async (tokenCase) => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { pending, listener } = await rethrowAndQueue(tokenCase);

      pending.resolve();
      await flushPersistence();

      expect(errorLog).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    }
  );

  it.each(TOKEN_CASES)(
    'rethrows a listener error synchronously and still queues $event token persistence that rejects',
    async (tokenCase) => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { pending, listener } = await rethrowAndQueue(tokenCase);

      const tokenError = new Error('Token storage unavailable');
      pending.reject(tokenError);
      await flushPersistence();

      expect(errorLog).toHaveBeenCalledWith(tokenCase.message, tokenError);
      expect(listener).toHaveBeenCalledTimes(1);
      errorLog.mockRestore();
    }
  );
});
