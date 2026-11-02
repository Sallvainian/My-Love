/**
 * The client's fetch guard: while the SDK holds a session in storage but
 * cannot use it, a data request without a user token fails like an
 * unreachable server instead of going out as anon (RLS would answer `[]`, and
 * a refresher would save that over the account's local copies). The auth
 * server's own requests -- the token refresh that ends this state among them
 * -- always pass.
 */
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
