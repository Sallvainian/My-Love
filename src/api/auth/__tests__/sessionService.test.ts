/**
 * An unreachable server is not a sign-out: when the SDK cannot refresh an
 * expired token it keeps the session in its storage but reports none, and
 * `sessionService` answers with that stored session. Only an empty store is
 * "signed out".
 */
import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthBootstrapSession } from '../../../../tests/support/factories/auth-bootstrap-notification-order';
import { AUTH_STORAGE_KEY, readStoredSession } from '../../authStorage';
import { getSession, onAuthStateChange } from '../sessionService';

const { mockGetSession, mockOnAuthStateChange, mockStoreAuthToken, mockClearAuthToken } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockStoreAuthToken: vi.fn(),
    mockClearAuthToken: vi.fn(),
  }));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock('../../../sw-db', () => ({
  storeAuthToken: mockStoreAuthToken,
  clearAuthToken: mockClearAuthToken,
}));

type SdkListener = (event: string, session: Session | null) => void;
let sdkListener: SdkListener | null = null;

/** The session the SDK left in storage; its access token expired an hour ago. */
const storedSession = createAuthBootstrapSession({
  userId: 'stored-user',
  email: 'stored@example.com',
  displayName: null,
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  expiresAt: Math.floor(Date.now() / 1000) - 3600,
});

const refreshedSession = createAuthBootstrapSession({
  userId: 'stored-user',
  email: 'stored@example.com',
  displayName: null,
  accessToken: 'refreshed-access-token',
  refreshToken: 'refreshed-refresh-token',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});

const unreachable = () => new AuthRetryableFetchError('Failed to fetch', 0);

function store(value: unknown) {
  localStorage.setItem(AUTH_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

function subscribe() {
  const listener = vi.fn();
  onAuthStateChange(listener);
  if (!sdkListener) throw new Error('Auth state callback was not registered');
  return { listener, emit: sdkListener };
}

describe('sessionService: a stored session survives an unreachable server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkListener = null;
    mockStoreAuthToken.mockResolvedValue(undefined);
    mockClearAuthToken.mockResolvedValue(undefined);
    mockOnAuthStateChange.mockImplementation((callback: SdkListener) => {
      sdkListener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it("uses the SDK's default storage key for the configured URL", () => {
    // vitest.config.ts sets VITE_SUPABASE_URL to https://unit-tests.invalid;
    // supabase-js names its key `sb-<first hostname label>-auth-token`.
    expect(AUTH_STORAGE_KEY).toBe('sb-unit-tests-auth-token');
  });

  it('returns the SDK session when the read succeeds', async () => {
    mockGetSession.mockResolvedValue({ data: { session: refreshedSession }, error: null });

    await expect(getSession()).resolves.toBe(refreshedSession);
  });

  describe('offline cold start, access token expired', () => {
    beforeEach(() => store(storedSession));

    it('getSession answers with the stored session and logs a warning', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: unreachable() });

      await expect(getSession()).resolves.toEqual(storedSession);
      expect(console.warn).toHaveBeenCalledWith(
        '[AuthService] Server unreachable; using the stored session:',
        'Failed to fetch'
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    it('a null INITIAL_SESSION reaches the app as the stored session', () => {
      const { listener, emit } = subscribe();

      emit('INITIAL_SESSION', null);

      expect(listener).toHaveBeenCalledExactlyOnceWith(storedSession);
      expect(console.warn).toHaveBeenCalledWith(
        '[AuthService] INITIAL_SESSION carried no session; using the stored one'
      );
      // Substituting the session writes nothing: the SDK still owns the token.
      expect(mockStoreAuthToken).not.toHaveBeenCalled();
      expect(mockClearAuthToken).not.toHaveBeenCalled();
    });

    it('an INITIAL_SESSION that carries a session passes it through unchanged', () => {
      const { listener, emit } = subscribe();

      emit('INITIAL_SESSION', refreshedSession);

      expect(listener).toHaveBeenCalledExactlyOnceWith(refreshedSession);
    });
  });

  it('server back: the renewed session from TOKEN_REFRESHED reaches the app and is persisted', async () => {
    store(storedSession);
    const { listener, emit } = subscribe();

    emit('INITIAL_SESSION', null);
    emit('TOKEN_REFRESHED', refreshedSession);

    expect(listener.mock.calls).toEqual([[storedSession], [refreshedSession]]);
    await vi.waitFor(() =>
      expect(mockStoreAuthToken).toHaveBeenCalledExactlyOnceWith({
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        expiresAt: refreshedSession.expires_at,
        userId: 'stored-user',
      })
    );
  });

  describe('true sign-out: the store is empty', () => {
    it('getSession answers null on an unreachable server', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: unreachable() });

      await expect(getSession()).resolves.toBeNull();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '[AuthService] Failed to get session:',
        'Failed to fetch'
      );
    });

    it('a null INITIAL_SESSION stays null', () => {
      const { listener, emit } = subscribe();

      emit('INITIAL_SESSION', null);

      expect(listener).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('SIGNED_OUT passes null even if a session is still stored', async () => {
      store(storedSession);
      const { listener, emit } = subscribe();

      emit('SIGNED_OUT', null);

      expect(listener).toHaveBeenCalledExactlyOnceWith(null);
      await vi.waitFor(() => expect(mockClearAuthToken).toHaveBeenCalledTimes(1));
    });
  });

  describe('revoked refresh token', () => {
    const revoked = () =>
      new AuthApiError(
        'Invalid Refresh Token: Refresh Token Not Found',
        400,
        'refresh_token_not_found'
      );

    it('getSession answers null once the SDK has cleared its store', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: revoked() });

      await expect(getSession()).resolves.toBeNull();
    });

    it('a non-retryable error never falls back to storage', async () => {
      store(storedSession);
      mockGetSession.mockResolvedValue({ data: { session: null }, error: revoked() });

      await expect(getSession()).resolves.toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        '[AuthService] Failed to get session:',
        'Invalid Refresh Token: Refresh Token Not Found'
      );
    });

    it('the null INITIAL_SESSION that follows stays null', () => {
      const { listener, emit } = subscribe();

      emit('INITIAL_SESSION', null);

      expect(listener).toHaveBeenCalledExactlyOnceWith(null);
    });
  });

  describe('corrupt stored value', () => {
    const { user, ...withoutUser } = storedSession;
    const { access_token: _access, ...withoutAccessToken } = storedSession;
    const { refresh_token: _refresh, ...withoutRefreshToken } = storedSession;
    const withoutUserId = { ...storedSession, user: { ...user, id: undefined } };

    it.each([
      { label: 'unparsable JSON', value: '{not json' },
      { label: 'a JSON non-object', value: '"just a string"' },
      { label: 'JSON null', value: 'null' },
      { label: 'no user', value: withoutUser },
      { label: 'no user.id', value: withoutUserId },
      { label: 'no access_token', value: withoutAccessToken },
      { label: 'no refresh_token', value: withoutRefreshToken },
    ])('$label reads as null without throwing', async ({ value }) => {
      store(value);

      expect(readStoredSession()).toBeNull();

      mockGetSession.mockResolvedValue({ data: { session: null }, error: unreachable() });
      await expect(getSession()).resolves.toBeNull();

      const { listener, emit } = subscribe();
      emit('INITIAL_SESSION', null);
      expect(listener).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('a storage that throws on read counts as empty', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('SecurityError');
        },
      });

      expect(readStoredSession()).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[AuthService] Could not read the stored session:',
        expect.any(Error)
      );
    });
  });
});
