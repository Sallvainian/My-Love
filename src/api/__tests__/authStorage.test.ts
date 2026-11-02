/**
 * The client's fetch guard: while the SDK holds a session in storage but
 * cannot use it, a data request without a user token fails like an
 * unreachable server instead of going out as anon (RLS would answer `[]`, and
 * a refresher would save that over the account's local copies). The auth
 * server's own requests -- the token refresh that ends this state among them
 * -- always pass the guard. The file also covers the guard removing `expires_at`
 * from the auth server's session responses, so the SDK measures expiry on the
 * device clock (DW-383).
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthBootstrapSession } from '../../../tests/support/factories/auth-bootstrap-notification-order';
import { AUTH_STORAGE_KEY, createSessionGuardedFetch } from '../authStorage';

const SUPABASE_URL = 'https://unit-tests.invalid';
const SUPABASE_KEY = 'test-anon-key-for-unit-tests';
const ANON_BEARER = `Bearer ${SUPABASE_KEY}`;
const USER_BEARER = 'Bearer user-jwt';

const EVENTS_URL = `${SUPABASE_URL}/rest/v1/events?select=*`;
const REFRESH_URL = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;

const storedSession = createAuthBootstrapSession({
  userId: 'stored-user',
  email: 'stored@example.com',
  displayName: null,
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  expiresAt: Math.floor(Date.now() / 1000) - 3600,
});

const sent = new Response('[]', { status: 200 });
const fetchImpl = vi.fn<typeof fetch>();
const guardedFetch = createSessionGuardedFetch({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  fetchImpl,
});

function storeSession() {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedSession));
}

async function expectRefused(request: Promise<Response>) {
  const error = await request.then(
    () => {
      throw new Error('the request was sent');
    },
    (err: unknown) => err
  );
  expect(error).toBeInstanceOf(TypeError);
  expect((error as TypeError).message).toBe('Failed to fetch');
  expect(fetchImpl).not.toHaveBeenCalled();
}

describe('createSessionGuardedFetch', () => {
  beforeEach(() => {
    fetchImpl.mockReset();
    fetchImpl.mockResolvedValue(sent);
  });

  afterEach(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  describe('a session is stored and the SDK has no live session', () => {
    beforeEach(storeSession);

    it.each([
      {
        label: 'the publishable key as bearer, plain-object headers',
        init: { headers: { apikey: SUPABASE_KEY, Authorization: ANON_BEARER } },
      },
      {
        label: 'the publishable key as bearer, a Headers instance',
        init: { headers: new Headers({ apikey: SUPABASE_KEY, Authorization: ANON_BEARER }) },
      },
      {
        label: 'no Authorization header (Edge Functions omit the key as bearer)',
        init: { headers: new Headers({ apikey: SUPABASE_KEY }) },
      },
      { label: 'no headers at all', init: undefined },
    ])('refuses a data request with $label', async ({ init }) => {
      await expectRefused(guardedFetch(EVENTS_URL, init));
    });

    it('refuses a Request input that carries the publishable key as bearer', async () => {
      const request = new Request(EVENTS_URL, { headers: { Authorization: ANON_BEARER } });

      await expectRefused(guardedFetch(request));
    });

    it('refuses storage, functions and Realtime HTTP calls too', async () => {
      for (const path of [
        '/storage/v1/object/sign/photos/a.jpg',
        '/functions/v1/upload-love-note-image',
        '/realtime/v1/api/broadcast',
      ]) {
        await expectRefused(
          guardedFetch(`${SUPABASE_URL}${path}`, { headers: { Authorization: ANON_BEARER } })
        );
      }
    });

    it('lets the token refresh through unchanged, with no user token', async () => {
      const init = {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: ANON_BEARER },
        body: JSON.stringify({ refresh_token: 'stored-refresh-token' }),
      };

      await expect(guardedFetch(REFRESH_URL, init)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(REFRESH_URL, init);
    });

    it('lets every other auth request through (sign-in, password reset)', async () => {
      for (const path of ['/auth/v1/token?grant_type=password', '/auth/v1/recover', '/auth/v1']) {
        await expect(guardedFetch(`${SUPABASE_URL}${path}`, { method: 'POST' })).resolves.toBe(
          sent
        );
      }
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('lets an auth request given as a Request input through', async () => {
      const request = new Request(REFRESH_URL, { method: 'POST' });

      await expect(guardedFetch(request)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(request, undefined);
    });

    it('does not treat a path that only starts like the auth server as auth', async () => {
      await expectRefused(guardedFetch(`${SUPABASE_URL}/auth/v10/token`));
    });

    it('lets a request outside the project URL through', async () => {
      const url = 'https://elsewhere.example/rest/v1/events';

      await expect(guardedFetch(url)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(url, undefined);
    });
  });

  describe('a data request with a user token passes through', () => {
    beforeEach(storeSession);

    it.each<{ label: string; headers: HeadersInit }>([
      { label: 'plain-object headers', headers: { Authorization: USER_BEARER } },
      { label: 'a Headers instance', headers: new Headers({ Authorization: USER_BEARER }) },
      { label: 'a lower-case header name', headers: { authorization: USER_BEARER } },
    ])('with $label', async ({ headers }) => {
      const init = { headers };

      await expect(guardedFetch(EVENTS_URL, init)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(EVENTS_URL, init);
    });

    it('as a Request input', async () => {
      const request = new Request(EVENTS_URL, { headers: { Authorization: USER_BEARER } });

      await expect(guardedFetch(request)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(request, undefined);
    });

    it('as a URL input', async () => {
      const url = new URL(EVENTS_URL);
      const init = { headers: { Authorization: USER_BEARER } };

      await expect(guardedFetch(url, init)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(url, init);
    });
  });

  describe('nobody signed in: anon is legitimate', () => {
    it('passes a data request with the publishable key as bearer', async () => {
      const init = { headers: { Authorization: ANON_BEARER } };

      await expect(guardedFetch(EVENTS_URL, init)).resolves.toBe(sent);
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(EVENTS_URL, init);
    });

    it('passes when the stored value is corrupt', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem(AUTH_STORAGE_KEY, '{not json');

      await expect(guardedFetch(EVENTS_URL)).resolves.toBe(sent);
      expect(warn).toHaveBeenCalledWith(
        '[AuthService] Could not read the stored session:',
        expect.any(SyntaxError)
      );
    });
  });
});

describe('session responses from the auth server', () => {
  const TOKEN_URL = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const sessionBody = {
    access_token: 'new-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 1_700_000_000,
    refresh_token: 'new-refresh-token',
    user: { id: 'user-1' },
  };
  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });

  beforeEach(() => {
    fetchImpl.mockReset();
  });

  it('removes expires_at from a token response and keeps everything else', async () => {
    fetchImpl.mockResolvedValue(
      json(sessionBody, {
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '999',
          'X-Request-Id': 'req-1',
        },
      })
    );

    const response = await guardedFetch(TOKEN_URL, { method: 'POST' });

    const { expires_at: _removed, ...expected } = sessionBody;
    await expect(response.json()).resolves.toEqual(expected);
    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('X-Request-Id')).toBe('req-1');
    expect(response.headers.has('Content-Length')).toBe(false);
  });

  it('rewrites a refresh response too, and one given as a Request input', async () => {
    fetchImpl.mockImplementation(() => Promise.resolve(json(sessionBody)));

    for (const request of [
      guardedFetch(REFRESH_URL, { method: 'POST' }),
      guardedFetch(new Request(REFRESH_URL, { method: 'POST' })),
    ]) {
      const body = (await (await request).json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty('expires_at');
      expect(body.access_token).toBe('new-access-token');
    }
  });

  it('returns the original response for a non-session auth body', async () => {
    const user = json({ id: 'user-1', email: 'a@example.com' });
    fetchImpl.mockResolvedValue(user);

    await expect(guardedFetch(`${SUPABASE_URL}/auth/v1/user`)).resolves.toBe(user);
  });

  it('returns the original response for a body missing a session field', async () => {
    const partial = json({ access_token: 'a', expires_in: 3600, expires_at: 1 });
    fetchImpl.mockResolvedValue(partial);

    await expect(guardedFetch(TOKEN_URL, { method: 'POST' })).resolves.toBe(partial);
  });

  it('returns the original response for a session body that has no expires_at', async () => {
    const { expires_at: _removed, ...noExpiry } = sessionBody;
    const response = json(noExpiry);
    fetchImpl.mockResolvedValue(response);

    await expect(guardedFetch(TOKEN_URL, { method: 'POST' })).resolves.toBe(response);
  });

  it.each([429, 500])('returns the original response for a %i error', async (status) => {
    const error = json({ ...sessionBody, code: 'over_request_rate_limit' }, { status });
    fetchImpl.mockResolvedValue(error);

    await expect(guardedFetch(REFRESH_URL, { method: 'POST' })).resolves.toBe(error);
  });

  it('returns the original response for a 204 and for a text body', async () => {
    const empty = new Response(null, { status: 204 });
    const text = new Response(JSON.stringify(sessionBody), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

    fetchImpl.mockResolvedValueOnce(empty);
    await expect(guardedFetch(`${SUPABASE_URL}/auth/v1/logout`)).resolves.toBe(empty);
    fetchImpl.mockResolvedValueOnce(text);
    await expect(guardedFetch(TOKEN_URL, { method: 'POST' })).resolves.toBe(text);
  });

  it('returns the original response for unparsable JSON, body still readable', async () => {
    const broken = json('{bad');
    fetchImpl.mockResolvedValue(broken);

    const response = await guardedFetch(TOKEN_URL, { method: 'POST' });

    expect(response).toBe(broken);
    await expect(response.text()).resolves.toBe('{bad');
  });

  it('leaves a session-shaped body from a data path or another origin alone', async () => {
    for (const url of [
      `${SUPABASE_URL}/rest/v1/rpc/whatever`,
      `https://elsewhere.example/auth/v1/token`,
    ]) {
      const response = json(sessionBody);
      fetchImpl.mockResolvedValueOnce(response);
      await expect(
        guardedFetch(url, { headers: { Authorization: USER_BEARER } })
      ).resolves.toBe(response);
    }
  });

  describe('against the SDK with a device clock days ahead of the server', () => {
    const SERVER_NOW_MS = Date.parse('2026-11-02T12:00:00Z');
    const DEVICE_NOW_MS = SERVER_NOW_MS + 5 * 24 * 60 * 60 * 1000;
    const GOTRUE_URL = 'https://gotrue-clock.invalid';
    const STORAGE_KEY = 'sb-gotrue-clock-auth-token';

    let unsubscribe: (() => void) | undefined;

    afterEach(() => {
      unsubscribe?.();
      unsubscribe = undefined;
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    async function run() {
      // auth-js opens a BroadcastChannel for a persisted session and offers no
      // way to close it; without one it skips the cross-tab sync.
      vi.stubGlobal('BroadcastChannel', undefined);
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(DEVICE_NOW_MS);

      const requests: string[] = [];
      const fakeGoTrue = vi.fn<typeof fetch>((input) => {
        const url = new URL(requestUrlOf(input));
        requests.push(`${url.pathname}${url.search}`);
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          return Promise.resolve(
            json({ code: 429, error_code: 'over_request_rate_limit', msg: 'rate limited' }, {
              status: 429,
            })
          );
        }
        return Promise.resolve(
          json({
            access_token: 'server-access-token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(SERVER_NOW_MS / 1000) + 3600,
            refresh_token: 'server-refresh-token',
            user: {
              id: 'user-1',
              aud: 'authenticated',
              email: 'clock@example.com',
              app_metadata: {},
              user_metadata: {},
              created_at: '2026-01-01T00:00:00Z',
            },
          })
        );
      });
      const store = new Map<string, string>();
      const client = createClient(GOTRUE_URL, 'clock-anon-key', {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
          storageKey: STORAGE_KEY,
          storage: {
            getItem: (key) => store.get(key) ?? null,
            setItem: (key, value) => void store.set(key, value),
            removeItem: (key) => void store.delete(key),
          },
        },
        global: {
          fetch: createSessionGuardedFetch({
            supabaseUrl: GOTRUE_URL,
            supabaseKey: 'clock-anon-key',
            fetchImpl: fakeGoTrue,
          }),
        },
      });
      const events: string[] = [];
      const { data: subscription } = client.auth.onAuthStateChange((event) => {
        events.push(event);
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
      return { client, requests, events, store };
    }

    function requestUrlOf(input: RequestInfo | URL): string {
      return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    }

    it('keeps the session: no refresh, no SIGNED_OUT, expiry on the device clock', async () => {
      const { client, requests, events, store } = await run();

      const signIn = await client.auth.signInWithPassword({
        email: 'clock@example.com',
        password: 'pw',
      });
      expect(signIn.error).toBeNull();
      for (let i = 0; i < 5; i += 1) {
        const { data, error } = await client.auth.getSession();
        expect(error).toBeNull();
        expect(data.session?.access_token).toBe('server-access-token');
      }

      expect(requests.filter((r) => r.includes('grant_type=refresh_token'))).toEqual([]);
      expect(events).not.toContain('SIGNED_OUT');
      const stored = JSON.parse(store.get(STORAGE_KEY) ?? 'null') as {
        access_token: string;
        expires_at: number;
      };
      expect(stored.access_token).toBe('server-access-token');
      expect(stored.expires_at).toBeGreaterThanOrEqual(Math.floor(DEVICE_NOW_MS / 1000) + 3600 - 2);
      expect(stored.expires_at).toBeLessThanOrEqual(Math.floor(DEVICE_NOW_MS / 1000) + 3600 + 2);
    });
  });
});
