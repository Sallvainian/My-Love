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
import { loadConfigFromFile } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// `vitest.config.ts` defines VITE_SUPABASE_URL as the project URL, so the
// SDK derives this storage key (`sb-${hostname.split('.')[0]}-auth-token`).
const STORAGE_KEY = 'sb-xojempkrugifnaveqtqc-auth-token';
const APP_ORIGIN = 'http://localhost:3000';

/**
 * The deployed base path. `vite.config.ts:11` is the source of truth
 * (`base: mode === 'production' ? '/My-Love/' : '/'`) and the case below binds
 * this constant to it at runtime: `loadConfigFromFile` takes a path string, so
 * a repo rename or custom-domain switch turns the suite red instead of shipping
 * green. It is read that way rather than imported because a static
 * `import '../../../vite.config'` raises TS6307 -- that file belongs to
 * `tsconfig.node.json` while this suite builds under `tsconfig.test.json`.
 */
const PRODUCTION_BASE = '/My-Love/';

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

function setUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url);
}

/** A stored session that is valid and far from expiry, so no refresh is due. */
function seedVictimSession(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: 'victim.access.token',
      refresh_token: 'victim-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: VICTIM_USER_ID,
        email: 'victim@test.example.com',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    })
  );
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

  it('refuses a foreign implicit token fragment while signed out', async () => {
    setUrl(`${APP_ORIGIN}/${HOSTILE_FRAGMENT}`);

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session).toBeNull();
    // The discriminator: the implicit default would have fetched /auth/v1/user.
    expect(fetchUrls(fetchSpy)).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('preserves an existing session when a foreign implicit fragment arrives', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/${HOSTILE_FRAGMENT}`);

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
    expect(fetchUrls(fetchSpy)).toEqual([]);
  });

  it('ignores a code callback when this browser holds no verifier', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/?code=attacker-supplied-code`);

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    // `_isPKCECallback` needs a stored verifier, so the URL is not a callback
    // at all and the stored session is recovered untouched.
    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
    expect(fetchUrls(fetchSpy)).toEqual([]);
  });

  it('preserves an existing session for an error callback', async () => {
    seedVictimSession();
    setUrl(`${APP_ORIGIN}/#error=access_denied&error_code=403&error_description=Denied`);

    const { supabase } = await importAppClient();
    clients.push(supabase);
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user?.id).toBe(VICTIM_USER_ID);
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
    expect(authorizeUrl.searchParams.get('redirect_to')).toBe('http://localhost:3000/My-Love/');
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
        created_at: new Date().toISOString(),
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
  });

  it('leaves password sign-in on the password grant with no PKCE parameters', async () => {
    setUrl(`${APP_ORIGIN}/`);
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

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
