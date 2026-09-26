/**
 * CAP-13 / F13: the app's own Supabase client must accept an authentication
 * callback only for a flow started in this browser.
 *
 * These cases drive the REAL installed SDK through the real module under test
 * (`src/api/supabaseClient.ts`), not a stubbed `createClient`: the URL is set
 * before the module is imported, so `GoTrueClient._initialize()` classifies it
 * exactly as it does in a browser.
 *
 * Every callback case asserts the number of `fetch` calls as well as the
 * session, because the session assertion alone does not discriminate. Under
 * the SDK's implicit default (`GoTrueClient.js:21`) a hostile fragment causes
 * an immediate `GET /auth/v1/user` with the supplied token; under `flowType:
 * 'pkce'` the URL is refused at `GoTrueClient.js:3263-3265` before anything is
 * sent. A fake token therefore yields "no session" either way -- only the
 * absent request distinguishes the fixed client from the broken one. The
 * sign-in cases below assert the built authorize URL instead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { AuthError, isAuthImplicitGrantRedirectError } from '@supabase/supabase-js';
import { loadConfigFromFile } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createAuthBootstrapSession } from '../../support/factories/auth-bootstrap-notification-order';

// `vitest.config.ts` defines VITE_SUPABASE_URL as the project URL, so the
// SDK derives this storage key (`sb-${hostname.split('.')[0]}-auth-token`).
const STORAGE_KEY = 'sb-xojempkrugifnaveqtqc-auth-token';
const APP_ORIGIN = 'http://localhost:3000';

/**
 * The deployed base path. `vite.config.ts:11` is the source of truth
 * (`base: '/'`, the root of the Cloudflare Workers origin) and the case below
 * binds this constant to it at runtime: `loadConfigFromFile` takes a path
 * string, so moving the app under a sub-path turns the suite red instead of
 * shipping green. It is read that way rather than imported because a static
 * `import '../../../vite.config'` raises TS6307 -- that file belongs to
 * `tsconfig.node.json` while this suite builds under `tsconfig.test.json`.
 */
const PRODUCTION_BASE = '/';

/**
 * A complete implicit grant fragment, in the shape `_getSessionFromURL`
 * requires (`GoTrueClient.js:3294-3297`). The token values are syntactic
 * placeholders: whether they are real only changes what the *unfixed* client
 * gets back from the server, and this suite asserts it never asks.
 */
const HOSTILE_FRAGMENT =
  '#access_token=header.payload.signature' +
  '&refresh_token=foreign-refresh-token' +
  '&expires_in=3600' +
  '&token_type=bearer';

const VICTIM_USER_ID = '11111111-1111-4111-8111-111111111111';

// Pinned to a whole second: GoTrue reads `Date.now()` to decide whether the
// stored session is due a refresh, so its expiry is measured from this.
const NOW = new Date('2026-09-15T16:00:00.000Z');
const NOW_SEC = NOW.getTime() / 1000;

function setUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url);
}

/** A stored session that is valid and far from expiry, so no refresh is due. */
function seedVictimSession(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      createAuthBootstrapSession({
        userId: VICTIM_USER_ID,
        email: 'victim@test.example.com',
        displayName: null,
        accessToken: 'victim.access.token',
        refreshToken: 'victim-refresh-token',
        expiresAt: NOW_SEC + 3600,
      })
    )
  );
}

/**
 * GoTrue's 400 answer to a token grant it refuses. A new `Response` per call,
 * because a body can be read only once.
 */
function invalidGrantResponse(description?: string): Response {
  const body = description === undefined
    ? { error: 'invalid_grant' }
    : { error: 'invalid_grant', error_description: description };
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Import the module under test with the current URL and storage in place. */
async function importAppClient() {
  return await import('../../../src/api/supabaseClient');
}

type FetchSpy = MockInstance<typeof globalThis.fetch>;

function fetchUrls(spy: FetchSpy): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

describe('supabaseClient auth callback flow (CAP-13)', () => {
  let fetchSpy: FetchSpy;
  // Every client built during a case, so none is left running afterwards.
  let clients: Array<{ auth: { stopAutoRefresh: () => Promise<void> } }>;
  // Set only by the case that drives a real browser redirect; `afterEach`
  // restores it so no later case runs with navigation suppressed.
  let assignSpy: MockInstance<typeof window.location.assign> | null;

  beforeEach(() => {
    // Only `Date` is faked; GoTrue's own timers stay real.
    vi.setSystemTime(NOW);
    vi.resetModules();
    localStorage.clear();
    clients = [];
    assignSpy = null;
    // Never call through. `vitest.config.ts` points the module at the real
    // hosted project, so an un-stubbed spy would put the regression state --
    // the one where the SDK does fetch the callback token -- on the network.
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network disabled in this suite'));
  });

  afterEach(async () => {
    // `vi.resetModules()` builds a fresh client per case but disposes none, so
    // without this each leaves an auto-refresh ticker bound to the same storage
    // key -- and a stray refresh is exactly what would corrupt a fetch count.
    for (const client of clients) await client.auth.stopAutoRefresh();
    vi.useRealTimers();
    fetchSpy.mockRestore();
    assignSpy?.mockRestore();
    assignSpy = null;
    // The production-base case stubs `BASE_URL`; every other case must see the
    // `"/"` that is Vite's own built-in `base` default -- `vitest.config.ts`
    // sets no `base` and defines no `BASE_URL`.
    vi.unstubAllEnvs();
    // AC 3, asserted rather than assumed: without these two lines, deleting
    // either restore above leaves the whole unit suite green, so a leaked stub
    // would only ever surface as an unrelated case failing somewhere later.
    // The sibling cases cannot catch it themselves -- they interpolate
    // `import.meta.env.BASE_URL` on both the input and the expected side, so a
    // leaked value shifts both together.
    expect(import.meta.env.BASE_URL).toBe('/');
    expect(vi.isMockFunction(window.location.assign)).toBe(false);
    localStorage.clear();
    setUrl(`${APP_ORIGIN}/`);
  });

  it('refuses a foreign implicit token fragment while signed out, and says nothing', async () => {
    setUrl(`${APP_ORIGIN}/${HOSTILE_FRAGMENT}`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session).toBeNull();
    // The discriminator: the implicit default would have fetched /auth/v1/user.
    expect(fetchUrls(fetchSpy)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    // DW-95/DW-96 must not undo story 3. Under `flowType: 'pkce'` this fragment
    // raises `AuthPKCEGrantCodeExchangeError`, not the implicit-grant class, so
    // the silent refusal stays silent -- nothing tells the sender it landed.
    await expect(getAuthCallbackOutcome()).resolves.toBeNull();
  });

  it('preserves an existing session when a foreign implicit fragment arrives', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/${HOSTILE_FRAGMENT}`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
    expect(fetchUrls(fetchSpy)).toEqual([]);
    await expect(getAuthCallbackOutcome()).resolves.toBeNull();
  });

  it('tells a signed-out visitor a code callback belongs to another browser', async () => {
    setUrl(`${APP_ORIGIN}/?code=minted-for-some-other-browser`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    // `_isPKCECallback` needs a stored verifier (`GoTrueClient.js:3356-3367`),
    // so the URL is not a callback at all: `_initialize` falls through to
    // `_recoverAndRefresh` and answers `{ error: null }`. Nothing was
    // exchanged, and with no session to recover this lands on the login screen.
    expect(data.session).toBeNull();
    expect(fetchUrls(fetchSpy)).toEqual([]);
    // DW-96: the captured `code` plus the absent session are the only
    // discriminator, and this is the case that must not be silent.
    await expect(getAuthCallbackOutcome()).resolves.toBe('needs-original-browser');
  });

  it('sees a code in the fragment, as the SDK does', async () => {
    // `parseParametersFromURL` (auth-js `lib/helpers.js:66-85`) merges hash
    // parameters before query ones, so `_isPKCECallback` treats this as a PKCE
    // callback. A capture that read only `window.location.search` would leave
    // the SDK calling it a callback and the classifier calling it an ordinary
    // load.
    setUrl(`${APP_ORIGIN}/#code=minted-for-some-other-browser`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session).toBeNull();
    expect(fetchUrls(fetchSpy)).toEqual([]);
    await expect(getAuthCallbackOutcome()).resolves.toBe('needs-original-browser');
  });

  it('ignores a code callback when this browser holds no verifier', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/?code=attacker-supplied-code`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    // `_isPKCECallback` needs a stored verifier, so the URL is not a callback
    // at all and the stored session is recovered untouched.
    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
    expect(fetchUrls(fetchSpy)).toEqual([]);
    // Null, not `needs-original-browser`, and deliberately so: a recovered
    // session means this browser lands in the app, not on the login screen, so
    // there is no surface for the notice and nothing about the session to
    // explain. The signed-out case above is the one DW-96 is about.
    await expect(getAuthCallbackOutcome()).resolves.toBeNull();
  });

  it('preserves an existing session for an error callback, and reports the denial', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/#error=access_denied&error_code=403&error_description=Denied`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
    expect(fetchUrls(fetchSpy)).toEqual([]);

    // DW-95: `_getSessionFromURL` throws `AuthImplicitGrantRedirectError` for
    // the `error`/`error_description`/`error_code` branch
    // (`GoTrueClient.js:3252-3259`) and `_initialize` RETURNS it rather than
    // throwing, which is why nothing in the app ever saw it. Asserted on the
    // SDK's own value, not on our classification of it.
    const { error } = await supabase.auth.initialize();
    expect(error).toBeInstanceOf(AuthError);
    expect(isAuthImplicitGrantRedirectError(error)).toBe(true);
    expect(error?.message).toBe('Denied');

    await expect(getAuthCallbackOutcome()).resolves.toBe('cancelled');
  });

  it('separates a provider-side failure from a denial, and keeps the session', async () => {
    seedVictimSession();
    // DW-93: the SDK throws the SAME error class here as for a denial
    // (`GoTrueClient.js:3255-3261`), so before the split this read
    // "Sign-in was cancelled" at someone who cancelled nothing.
    setUrl(
      `${APP_ORIGIN}/#error=server_error&error_code=unexpected_failure&error_description=Database+error`
    );

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);

    const { error } = await supabase.auth.initialize();
    expect(isAuthImplicitGrantRedirectError(error)).toBe(true);
    // The discriminator, on the SDK's own value: `details.error` carries the raw
    // OAuth name, while `details.code` is defaulted and so never absent.
    expect(error && 'details' in error ? error.details : null).toMatchObject({
      error: 'server_error',
    });

    await expect(getAuthCallbackOutcome()).resolves.toBe('provider-error');
  });

  it('still reads an unrecognised error name as a cancellation', async () => {
    // The split only reclassifies names it can name, so an unfamiliar fragment
    // keeps the old answer rather than inventing a new claim about it.
    setUrl(`${APP_ORIGIN}/#error=interaction_required&error_code=403&error_description=Nope`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);

    await expect(getAuthCallbackOutcome()).resolves.toBe('cancelled');
  });

  it('says nothing on an ordinary load', async () => {
    // The load every other one is measured against: no callback parameters, no
    // stored session. Without this the classifier could return a notice for
    // every visit and only the cases above would notice.
    setUrl(`${APP_ORIGIN}/`);

    const { supabase, getAuthCallbackOutcome } = await importAppClient();
    clients.push(supabase);

    await expect(getAuthCallbackOutcome()).resolves.toBeNull();
    expect(fetchUrls(fetchSpy)).toEqual([]);
  });

  it('starts Google sign-in with a PKCE challenge and an unchanged redirect', async () => {
    setUrl(`${APP_ORIGIN}/`);

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // The values `actionService.signInWithGoogle` passes.
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
        skipBrowserRedirect: true,
      },
    });

    expect(error).toBeNull();
    const authorizeUrl = new URL(data.url as string);
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('s256');
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();
    // The project's redirect allow-list entry must still match exactly: the SDK
    // appends a flow id only under `experimental.appendPkceFlowIdToRedirects`.
    expect(authorizeUrl.searchParams.get('redirect_to')).toBe(
      `${window.location.origin}${import.meta.env.BASE_URL}`
    );
    expect(authorizeUrl.searchParams.get('access_type')).toBe('offline');
    expect(authorizeUrl.searchParams.get('prompt')).toBe('consent');

    // The verifier that ties the returned code to this browser. The flow index
    // (`helpers.js:269` `${storageKey}-flows-code-verifier`) shares the suffix
    // and holds flow ids, so matching it alone would not prove a verifier.
    const verifierKeys = Object.keys(localStorage).filter(
      (key) => key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')
    );
    expect(verifierKeys.length).toBeGreaterThan(0);
  });

  it('sends the authorize redirect_to to the deployed base path', async () => {
    // Every other case here runs at `BASE_URL === '/'`, so nothing pins the
    // base the deployed bundle is built with. Stub it to `vite.config.ts:11`'s
    // production value and let the REAL `signInWithGoogle` build the URL
    // through the REAL SDK -- the expectation below is a hard-coded literal,
    // not a restatement of the template at `src/api/auth/actionService.ts:119`.
    //
    // First bind the stub to the config that actually builds the deployment, so
    // a repo rename cannot leave this case green against a stale literal.
    const viteConfig = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      // Absolute on purpose. `loadConfigFromFile` resolves an explicit path
      // against `process.cwd()` and ignores its `configRoot` parameter
      // (`vite/dist/node/chunks/node.js:36963`), so a bare `'vite.config.ts'`
      // makes this case depend on the directory vitest was launched from.
      // `fileURLToPath` is handed the string, not a `URL` instance: under
      // happy-dom the global `URL` is happy-dom's own class and Node rejects it
      // with "The URL must be of scheme file".
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../vite.config.ts')
    );
    expect(viteConfig?.config.base).toBe(PRODUCTION_BASE);

    vi.stubEnv('BASE_URL', PRODUCTION_BASE);
    // Deeper than the base on purpose: were line 119 `${window.location.href}`,
    // the captured `redirect_to` would carry `settings` and fail below.
    setUrl(`${APP_ORIGIN}${PRODUCTION_BASE}settings`);
    // `signInWithGoogle` passes no `skipBrowserRedirect`, so the SDK navigates
    // at `GoTrueClient.js:4067-4068`. The spy captures the built URL and
    // suppresses the navigation.
    assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    const { supabase } = await importAppClient();
    clients.push(supabase);
    // `vi.resetModules()` ran in `beforeEach`, so this shares the registry with
    // the import above and reuses the client already pushed to `clients`.
    const { signInWithGoogle } = await import('../../../src/api/auth/actionService');
    const error = await signInWithGoogle();

    expect(error).toBeNull();
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const authorizeUrl = new URL(String(assignSpy.mock.calls[0][0]));
    expect(authorizeUrl.searchParams.get('redirect_to')).toBe('http://localhost:3000/');
  });

  it('says nothing about a failed exchange to someone who is already signed in', async () => {
    // The same failing callback as the case above, in a browser that already
    // holds a session — a link opened a second time, or opened in a tab that is
    // already authenticated.
    //
    // The classifier has to read the session before it reports anything, which
    // is why the error case cannot short-circuit: 'code-expired' tells the
    // person to sign in again, and they already are. The docblock's promise
    // that `null` covers "a redeemed callback" is what this pins.
    setUrl(`${APP_ORIGIN}/`);
    const starter = await importAppClient();
    clients.push(starter.supabase);
    await starter.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        skipBrowserRedirect: true,
      },
    });

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('grant_type=pkce')) {
        return invalidGrantResponse('Invalid code');
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });

    vi.resetModules();
    // The difference from the case above, and the whole point of it.
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/?code=a-code-this-browser-cannot-redeem`);
    const returning = await importAppClient();
    clients.push(returning.supabase);

    const { data } = await returning.supabase.auth.getSession();
    expect(data.session, 'the precondition is that a session survives').not.toBeNull();

    await expect(returning.getAuthCallbackOutcome()).resolves.toBeNull();
  });

  it('sends the password-reset link to the deployed base path', async () => {
    // The sibling of the authorize-URL case above, for the one other place that
    // composes `origin + BASE_URL` into a link people receive by email
    // (`src/api/auth/actionService.ts:97`). Nothing asserted it at any base:
    // measured, `grep -rn "reset-password" tests/ src/` returned that single
    // source line and nothing under `tests/`, and the only other mention --
    // `src/api/auth/__tests__/authServices.test.ts:41` -- registers
    // `resetPasswordForEmail` as a mock and never inspects its options
    // (DW-124).
    //
    // The path join is correct only because `BASE_URL` ends in `/`. At the root
    // base that is invisible: `'/' + 'reset-password'` is well-formed, and so
    // is any sub-path base Vite would hand over, since Vite guarantees the
    // trailing slash; only a base without it would silently produce
    // `/sub-pathreset-password`.
    const viteConfig = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../vite.config.ts')
    );
    expect(viteConfig?.config.base).toBe(PRODUCTION_BASE);

    vi.stubEnv('BASE_URL', PRODUCTION_BASE);
    // Deeper than the base on purpose, the same way the authorize case is: were
    // line 97 `${window.location.href}`, the captured link would carry
    // `settings` and fail below.
    setUrl(`${APP_ORIGIN}${PRODUCTION_BASE}settings`);

    // `resetPasswordForEmail` navigates nowhere, so there is no `assign` to spy
    // on. The link travels in the recover request body instead.
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { resetPassword } = await import('../../../src/api/auth/actionService');
    const error = await resetPassword('someone@example.com');

    expect(error).toBeNull();
    const recoverCall = fetchSpy.mock.calls.find((call) =>
      String(call[0]).includes('/auth/v1/recover')
    );
    expect(recoverCall, 'the reset must have reached the recover endpoint').toBeDefined();

    // A hard-coded literal, not a restatement of the template in
    // actionService.ts -- otherwise this passes whatever that line composes.
    const body = JSON.parse(String((recoverCall?.[1] as RequestInit).body)) as {
      email: string;
      gotrue_meta_security?: unknown;
    };
    expect(body.email).toBe('someone@example.com');
    const redirectTo = new URL(String(recoverCall?.[0])).searchParams.get('redirect_to');
    expect(redirectTo).toBe('http://localhost:3000/reset-password');
  });

  it('redeems a code callback for a flow this browser started', async () => {
    // The acceptance half, on the app's own client. Every other callback case
    // here asserts a refusal, so without this one nothing would notice if the
    // app stopped completing logins at all -- `detectSessionInUrl: false` would
    // leave the whole suite green while Google sign-in silently never finished.
    setUrl(`${APP_ORIGIN}/`);
    const starter = await importAppClient();
    clients.push(starter.supabase);
    await starter.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        skipBrowserRedirect: true,
      },
    });
    // The real SDK wrote the verifier; the "returning browser" below is the same
    // storage, which is exactly what ties the code to this browser.
    // The flow index shares the `-code-verifier` suffix
    // (`auth-js/dist/module/lib/helpers.js:269`) and holds flow ids, not a
    // verifier, so it is excluded here.
    const storedVerifierKey = Object.keys(localStorage).find(
      (key) => key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')
    );
    expect(storedVerifierKey).toBeTruthy();
    const storedVerifier = JSON.parse(localStorage.getItem(storedVerifierKey!) as string) as string;
    expect(typeof storedVerifier).toBe('string');

    const exchanged = {
      access_token: 'exchanged.access.token',
      refresh_token: 'exchanged-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        email: 'initiator@test.example.com',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: NOW.toISOString(),
      },
    };
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('grant_type=pkce')) {
        return new Response(JSON.stringify(exchanged), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });

    // The provider returns to the app with a code, in a fresh page load.
    vi.resetModules();
    setUrl(`${APP_ORIGIN}/?code=a-code-minted-for-this-browser`);
    const returning = await importAppClient();
    clients.push(returning.supabase);
    const { data } = await returning.supabase.auth.getSession();

    const exchangeCall = fetchSpy.mock.calls.find((call) =>
      String(call[0]).includes('grant_type=pkce')
    );
    expect(exchangeCall, 'the returning client exchanged the code').toBeDefined();
    // The tie to this browser, asserted rather than assumed: the request must
    // carry the verifier the starting client wrote, not merely be addressed to
    // the PKCE grant.
    const exchangeBody = String((exchangeCall?.[1] as RequestInit | undefined)?.body ?? '');
    expect(JSON.parse(exchangeBody).auth_code).toBe('a-code-minted-for-this-browser');
    expect(JSON.parse(exchangeBody).code_verifier).toBe(storedVerifier);
    expect(data.session?.user?.id).toBe(exchanged.user.id);
    // A sign-in that worked says nothing. The `code` capture happens at module
    // load, so this also pins that a redeemed callback -- whose `code` the SDK
    // then strips from the URL (`GoTrueClient.js:3284-3286`) -- is classified
    // by its session rather than by the parameter that is no longer there.
    await expect(returning.getAuthCallbackOutcome()).resolves.toBeNull();
  });

  it('explains a code this browser started but could not exchange', async () => {
    // The error-with-a-code half of the classifier's guard, which nothing else
    // reaches. This browser HOLDS the verifier, so the URL is a real PKCE
    // callback and the exchange is attempted -- it just fails, which is the
    // ordinary expired-or-reused code. `_getSessionFromURL` rethrows the
    // `AuthApiError` into its own catch (`GoTrueClient.js:3332-3337`) and
    // `_initialize` returns it, leaving `initialize()` with a non-null error
    // that is NOT the implicit-grant class.
    //
    // This used to answer `null`, which is what DW-131 was raised about: the
    // most common real callback failure ended on the login screen in silence.
    // It must still not read `needs-original-browser` -- the captured `code` is
    // present and the failed exchange left no session, so the branch below it
    // would tell someone whose code simply expired to go and find a different
    // browser.
    setUrl(`${APP_ORIGIN}/`);
    const starter = await importAppClient();
    clients.push(starter.supabase);
    await starter.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        skipBrowserRedirect: true,
      },
    });
    const storedVerifierKey = Object.keys(localStorage).find(
      (key) => key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')
    );
    expect(storedVerifierKey, 'this browser started the flow').toBeTruthy();

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('grant_type=pkce')) {
        return invalidGrantResponse('Invalid code');
      }
      throw new Error(`unexpected request: ${String(input)}`);
    });

    // The provider returns to the app with a code, in a fresh page load.
    vi.resetModules();
    setUrl(`${APP_ORIGIN}/?code=a-code-this-browser-cannot-redeem`);
    const returning = await importAppClient();
    clients.push(returning.supabase);
    const { data } = await returning.supabase.auth.getSession();

    // The exchange really was attempted -- otherwise this case would be
    // indistinguishable from the missing-verifier one it exists to separate.
    const exchangeCall = fetchSpy.mock.calls.find((call) =>
      String(call[0]).includes('grant_type=pkce')
    );
    expect(exchangeCall, 'the returning client attempted the exchange').toBeDefined();
    expect(data.session).toBeNull();

    const { error } = await returning.supabase.auth.initialize();
    expect(error).toBeInstanceOf(AuthError);
    expect(isAuthImplicitGrantRedirectError(error)).toBe(false);

    await expect(returning.getAuthCallbackOutcome()).resolves.toBe('code-expired');
  });

  it('leaves password sign-in on the password grant with no PKCE parameters', async () => {
    setUrl(`${APP_ORIGIN}/`);
    fetchSpy.mockResolvedValue(invalidGrantResponse());

    const { supabase } = await importAppClient();
    clients.push(supabase);
    await supabase.auth.signInWithPassword({
      email: 'someone@test.example.com',
      password: 'not-a-real-password',
    });

    const tokenCall = fetchSpy.mock.calls.find((call) =>
      String(call[0]).includes('/auth/v1/token')
    );
    expect(tokenCall).toBeDefined();
    expect(String(tokenCall?.[0])).toContain('grant_type=password');
    const body = String((tokenCall?.[1] as RequestInit | undefined)?.body ?? '');
    expect(body).not.toContain('code_challenge');
  });
});
