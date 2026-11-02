/**
 * The Supabase SDK's session storage, read from outside the SDK.
 *
 * Everything here must not import `supabaseClient.ts`, because that module
 * imports this one to configure the client. Its own module, too, rather than
 * new exports of `supabaseClient.ts`: many test files mock that module
 * wholesale, and a new export there would be missing from every one of them.
 *
 * @module api/authStorage
 */

import type { Session } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

function storageKeyFor(supabaseUrl: string | undefined): string {
  try {
    return `sb-${new URL(supabaseUrl?.trim() ?? '').hostname.split('.')[0]}-auth-token`;
  } catch {
    // A missing or malformed URL: `supabaseClient.ts` reports it and refuses
    // to start, so this module must not throw first and hide that message.
    return '';
  }
}

/**
 * The localStorage key the Supabase SDK keeps the session under.
 *
 * Built exactly as supabase-js builds its default (`sb-<first hostname
 * label>-auth-token`, `SupabaseClient` constructor), so passing it to
 * `createClient` changes nothing for sessions already stored on a device.
 */
export const AUTH_STORAGE_KEY = storageKeyFor(
  import.meta.env.VITE_SUPABASE_URL as string | undefined
);

/**
 * The session the SDK holds in its storage, or `null` when it holds none.
 *
 * An unreachable server is not a sign-out. When a refresh cannot reach the
 * server the SDK keeps the session in storage but reports no session (an
 * `AuthRetryableFetchError` from `getSession`, a null `INITIAL_SESSION`).
 * The SDK empties this key itself on a real sign-out and when the server
 * rejects the refresh token, so only an empty key means "signed out" -- the
 * same signed-out vs read-failed split `lookupPartnerId` makes.
 *
 * The stored access token may have expired; the SDK's auto-refresh renews it
 * and emits TOKEN_REFRESHED once the server answers.
 */
export const readStoredSession = (): Session | null => {
  try {
    const raw = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null) return null;
    const { access_token, refresh_token, user } = stored as Record<string, unknown>;
    if (typeof access_token !== 'string' || !access_token) return null;
    if (typeof refresh_token !== 'string' || !refresh_token) return null;
    if (typeof user !== 'object' || user === null) return null;
    const userId = (user as Record<string, unknown>).id;
    if (typeof userId !== 'string' || !userId) return null;
    return stored as Session;
  } catch (err) {
    console.warn('[AuthService] Could not read the stored session:', err);
    return null;
  }
};

interface SessionGuardOptions {
  supabaseUrl: string;
  supabaseKey: string;
  fetchImpl: typeof fetch;
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, globalThis.location?.href);
  } catch {
    return null;
  }
}

/**
 * The `Authorization` header the request will carry. As `fetch` does, headers
 * given in `init` replace a `Request` input's own headers.
 */
function authorizationOf(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (init?.headers !== undefined) return new Headers(init.headers).get('Authorization');
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.headers.get('Authorization');
  }
  return null;
}

/** Does this parsed auth-server body carry a session, as auth-js `hasSession` reads one? */
function isSessionBody(body: unknown): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const { access_token, refresh_token, expires_in } = body as Record<string, unknown>;
  return Boolean(access_token) && Boolean(refresh_token) && Boolean(expires_in);
}

/**
 * The response without the `expires_at` GoTrue stamped on its session, or the
 * response itself when it is not a successful session-shaped JSON answer.
 *
 * GoTrue computes `expires_at` on the server's clock. A device whose clock is
 * ahead of it sees every new session as already expired, refreshes in a loop
 * until GoTrue answers 429, and auth-js then removes the session (DW-383).
 * Without `expires_at`, auth-js `_sessionResponse` derives it from
 * `expires_in` on the device's own clock. The server still validates tokens on
 * its clock.
 */
async function withoutServerExpiry(response: Response): Promise<Response> {
  try {
    if (!response.ok) return response;
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('json')) return response;
    const body: unknown = await response.clone().json();
    if (!isSessionBody(body) || !('expires_at' in body)) return response;
    const { expires_at: _serverExpiry, ...rest } = body;
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    return new Response(JSON.stringify(rest), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // An unparsable or unreadable body: auth-js reads the original as it would
    // have without this wrapper.
    return response;
  }
}

/**
 * A `fetch` that refuses a data request carrying no user token while the SDK
 * still holds a session in storage.
 *
 * That state is the app running on a stored session the SDK cannot use: an
 * expired access token whose refresh could not reach the server, including the
 * SDK's 60 s cooldown after a failed refresh, or the auth server down while
 * the rest of the project answers. The SDK then sends data requests with the
 * publishable key as the bearer (or with no `Authorization` at all, for
 * Edge Functions), RLS answers `[]`, and a refresher would save that over the
 * account's local copies. Failing such a request exactly as an unreachable
 * server does keeps every caller on its failed-read path instead.
 *
 * Never blocks the auth server's own requests (`/auth/v1/`): the token refresh
 * that ends this state goes out with no user token. Requests outside the
 * project URL, requests with a user token, and every request while nothing is
 * stored (anon is legitimate when nobody is signed in) pass through unchanged.
 *
 * It also removes `expires_at` from the auth server's successful session
 * responses, so the SDK measures a new session's expiry on the device clock
 * rather than the server's -- see `withoutServerExpiry`. Every other response
 * is returned as it came.
 */
export function createSessionGuardedFetch({
  supabaseUrl,
  supabaseKey,
  fetchImpl,
}: SessionGuardOptions): typeof fetch {
  const base = requestUrl(supabaseUrl);
  const basePath = base?.pathname.replace(/\/+$/, '') ?? '';
  const anonBearer = `Bearer ${supabaseKey}`;

  /** The path of a request to the project, relative to the project URL, else `null`. */
  const projectPath = (input: RequestInfo | URL): string | null => {
    const url = base ? requestUrl(input) : null;
    if (!base || !url || url.origin !== base.origin) return null;
    if (!url.pathname.startsWith(`${basePath}/`)) return null;
    return url.pathname.slice(basePath.length);
  };
  const isAuthPath = (path: string): boolean => `${path}/`.startsWith('/auth/v1/');

  return (input, init) => {
    const path = projectPath(input);
    if (path !== null && isAuthPath(path)) {
      return fetchImpl(input, init).then(withoutServerExpiry);
    }
    if (path !== null) {
      const authorization = authorizationOf(input, init);
      const hasUserToken = authorization !== null && authorization !== anonBearer;
      if (!hasUserToken && readStoredSession()) {
        logger.debug(
          '[AuthService] Refused a request with no user token on a stored session:',
          path
        );
        return Promise.reject(new TypeError('Failed to fetch'));
      }
    }
    return fetchImpl(input, init);
  };
}
