/**
 * CAP-13 / F13: the acceptance half of a browser-initiated auth callback.
 *
 * The browser specs prove that a foreign token fragment is refused. This one
 * proves the other direction against the real local Auth server: a `?code=` is
 * exchanged only by the client that started the flow, using a real code minted
 * by GoTrue, with no mocked SDK anywhere.
 *
 * One email is sent per run. The local stack's `[auth.rate_limit] email_sent`
 * of 2/hour is documented as requiring `auth.email.smtp`, and the built-in
 * Mailpit catcher is not that — measured on 2026-09-12, three consecutive OTP
 * sends all succeeded. The single send here keeps the spec inside the limit
 * even if a future stack does enforce it.
 */
import type { APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { apiRequest } from '@seontechnologies/playwright-utils/api-request';
import { test, expect } from '../support/merged-fixtures';
import { recurseUntil } from '../support/helpers/recurse';
import { TEST_USER_PASSWORD } from '../support/test-credentials';

const MAILPIT_URL = process.env.MAILPIT_URL;

/**
 * A storage adapter the test owns, so a client can be given the wrong verifier.
 * The SDK reads verifiers through exactly this interface
 * (`auth-js/dist/module/lib/helpers.js:313` `retrievePKCEVerifier`).
 */
function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
}

/** A PKCE client whose storage and outbound requests the test can inspect. */
function pkceClient() {
  const storage = memoryStorage();
  let pkceGrantCalls = 0;
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('grant_type=pkce')) pkceGrantCalls += 1;
        // playwright-utils deviation: the SDK's own fetch is what is measured; this wrapper counts the PKCE grant calls it sends.
        return fetch(input as RequestInfo, init);
      },
    },
  });
  return { client, storage, pkceGrantCalls: () => pkceGrantCalls };
}

/** The sign-in link GoTrue mailed to `address`, once it arrives. */
async function waitForVerifyLink(request: APIRequestContext, address: string): Promise<string> {
  const mailpit = <T>(path: string, params?: Record<string, string>) =>
    apiRequest<T>({
      request,
      method: 'GET',
      baseUrl: MAILPIT_URL,
      path,
      params,
      retryConfig: { maxRetries: 0 },
      // One report step per poll tick would bury the test's own steps.
      testStep: false,
    });
  const readLink = async (): Promise<string | undefined> => {
    // Everything in here is inside the try: `recurse` fails at once on a throw
    // from its command, so a thrown request (the catcher still starting, a
    // dropped connection) would abort the poll on the first tick instead of
    // using the window and the message below.
    try {
      const search = await mailpit<{ messages?: Array<{ ID: string }> } | null>(
        '/api/v1/search',
        { query: `to:${address}` }
      );
      if (search.status !== 200) return undefined;
      const id = search.body?.messages?.[0]?.ID;
      if (!id) return undefined;
      const message = await mailpit<{ Text?: string; HTML?: string } | null>(
        `/api/v1/message/${id}`
      );
      // `||`, not `??`: an HTML-only mail has an empty-string Text part,
      // which is not nullish and would skip the HTML fallback.
      const body = message.body?.Text || message.body?.HTML || '';
      return (body.match(/https?:\/\/[^\s"'<>)]+/g) ?? []).find((candidate) =>
        candidate.includes('/auth/v1/verify')
      );
    } catch {
      return undefined;
    }
  };
  const link = await recurseUntil(
    readLink,
    (value) => {
      expect(value, `no /auth/v1/verify link mailed to ${address}`).toBeTruthy();
    },
    { timeout: 15_000 }
  );
  return link!;
}

test.describe('PKCE code exchange', () => {
  test('[P0] a code is exchanged only by the client that started the flow', async ({
    supabaseAdmin,
    request,
    cleanup,
  }) => {
    // Fail rather than skip in CI, and gate only this case. `MAILPIT_URL` is
    // published solely by `playwright.config.ts`'s `supabase status` parse,
    // whereas SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY also arrive through
    // `$GITHUB_ENV` from `.github/actions/setup-supabase` (:147-149). If that
    // parse ever throws in CI, every other api spec still passes on the
    // GITHUB_ENV values while this one would skip — retiring the only evidence
    // for the acceptance half of CAP-13 behind a green check.
    //
    // What the variable actually reports is `[inbucket] enabled` in
    // supabase/config.toml, not a running container: a catcher that is enabled
    // but down leaves it set, and this spec then fails loudly on the 15 s poll
    // below, which is the intended outcome.
    test.skip(
      !MAILPIT_URL && !process.env.CI,
      'Could not read MAILPIT_URL from `supabase status` (local stack not running?)'
    );
    if (!MAILPIT_URL) {
      throw new Error(
        'MAILPIT_URL is unset in CI. This job starts the mail catcher ' +
          '(setup-playwright-e2e `needs-mail: true`), so a P0 auth test must fail here, not skip.'
      );
    }

    // Given a throwaway account and a PKCE flow started by client A alone.
    const address = `pkce-exchange-${Date.now()}@test.example.com`;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: address,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(`Failed to create PKCE test account: ${createError?.message}`);
    }
    const userId = created.user.id;
    cleanup.defer('delete the PKCE test account', async () => {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
    });

    const initiator = pkceClient();
    await log.step('Start a PKCE flow from the initiating client');
    const { error: otpError } = await initiator.client.auth.signInWithOtp({ email: address });
    expect(otpError, 'OTP send should succeed on the local stack').toBeNull();

    // The flow INDEX key also ends in `-code-verifier`
    // (`auth-js/dist/module/lib/helpers.js:269`
    // `${storageKey}-flows-code-verifier`), and it holds an array of flow
    // ids, not a verifier. Exclude it, so "stored a verifier" means a real
    // verifier slot — and so the impostor loop below overwrites only slots.
    const verifierKeys = [...initiator.storage.entries.keys()].filter(
      (key) => key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')
    );
    expect(verifierKeys.length, 'the initiating client stored a verifier').toBeGreaterThan(0);
    // Our redirects carry no `sb_flow_id`, so `retrievePKCEVerifier` reads
    // the fixed legacy key (`helpers.js:313-319`). That is the slot whose
    // contents decide every exchange below.
    expect(
      verifierKeys.some((key) => !key.includes('-flow-')),
      'the legacy slot the exchange reads was written'
    ).toBe(true);

    // When GoTrue mints a real auth code for that flow.
    await log.step('Follow the mailed verify link to obtain the auth code');
    const verifyLink = await waitForVerifyLink(request, address);
    // playwright-utils deviation: apiRequest returns no response headers and cannot disable redirects, and the Location header of this redirect is the evidence.
    const verifyResponse = await fetch(verifyLink, { redirect: 'manual' });
    // Any redirect: GoTrue answers 303 on this CLI version, but the evidence
    // this case needs is what the Location carries, not which 3xx code
    // carried it. Pinning 303 would redden a P0 security case on an
    // unrelated CLI bump.
    expect(verifyResponse.status).toBeGreaterThanOrEqual(300);
    expect(verifyResponse.status).toBeLessThan(400);
    const redirectLocation = verifyResponse.headers.get('location') ?? '';
    const code = new URL(redirectLocation).searchParams.get('code');
    expect(code, 'PKCE verify redirects with a code, not a token fragment').toBeTruthy();
    expect(redirectLocation).not.toContain('access_token');

    // Then a client holding no verifier is refused without reaching the server,
    // which is why this attempt cannot consume the single-use code.
    await log.step('Reject an exchange from a client with no verifier');
    const stranger = pkceClient();
    const strangerResult = await stranger.client.auth.exchangeCodeForSession(code!);
    expect(strangerResult.data.session).toBeNull();
    expect(strangerResult.error).toMatchObject({
      name: 'AuthPKCECodeVerifierMissingError',
      code: 'pkce_code_verifier_not_found',
      status: 400,
    });
    expect(stranger.pkceGrantCalls(), 'refused locally, so the code is untouched').toBe(0);

    // And a client holding the wrong verifier is refused by the server itself.
    await log.step('Reject an exchange carrying the wrong verifier');
    const impostor = pkceClient();
    for (const key of verifierKeys) {
      // JSON-encoded: the SDK writes every storage value through
      // `setItemAsync` and treats a non-JSON entry as absent
      // (`auth-js/dist/module/lib/helpers.js:104-117`), which would make this
      // a missing-verifier case rather than a wrong-verifier one.
      impostor.storage.entries.set(
        key,
        JSON.stringify('a-verifier-this-client-never-generated-0123456789')
      );
    }
    const impostorResult = await impostor.client.auth.exchangeCodeForSession(code!);
    expect(impostorResult.data.session).toBeNull();
    expect(impostorResult.error).toMatchObject({
      name: 'AuthApiError',
      status: 400,
      code: 'bad_code_verifier',
    });
    expect(impostor.pkceGrantCalls(), 'the server evaluated and rejected it').toBeGreaterThan(0);

    // While the initiating client completes the exchange for its own account.
    // This runs after the server-side rejection above, so it also pins an
    // assumption worth stating: GoTrue does not consume or invalidate the flow
    // state when the verifier comparison fails. If that ever changes, this
    // assertion reddens rather than the security cases.
    await log.step('Accept the exchange from the initiating client');
    const initiatorResult = await initiator.client.auth.exchangeCodeForSession(code!);
    expect(initiatorResult.error).toBeNull();
    expect(initiatorResult.data.session?.user?.id).toBe(userId);
    expect(initiatorResult.data.session?.user?.email).toBe(address);
  });

  test('[P0] password signup still completes under PKCE', async ({ supabaseAdmin, cleanup }) => {
    // CAP-13 names signup among the flows that must keep working. `signUp` sends
    // a code challenge under PKCE (`GoTrueClient.js:738-750`), so this checks the
    // server still accepts that request shape and returns the account.
    const address = `pkce-signup-${Date.now()}@test.example.com`;
    const applicant = pkceClient();

    // Deferred before signUp: a signup that misbehaves or never answers may
    // still have created the account. Deleted by the id signUp returned; found
    // by address only when there is none.
    const signup: { userId?: string; succeeded: boolean } = { succeeded: false };
    cleanup.defer('delete the signup account', async () => {
      let accountId = signup.userId;
      if (!accountId) {
        // `listUsers()` pages at 50 by default and this scans one page, so a
        // stack holding more accounts than that would leak the throwaway
        // account precisely when signUp already misbehaved.
        const { data: found, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        });
        if (listError) throw listError;
        accountId = found.users.find((user) => user.email === address)?.id;
      }
      if (!accountId) {
        if (signup.succeeded) {
          throw new Error(
            'signUp succeeded, but its account was found neither by id nor by address'
          );
        }
        return;
      }
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(accountId);
      if (deleteError) throw deleteError;
    });

    const { data, error } = await applicant.client.auth.signUp({
      email: address,
      password: TEST_USER_PASSWORD,
    });
    signup.userId = data.user?.id;
    signup.succeeded = !error;

    const userId = data.user?.id;
    expect(error).toBeNull();
    expect(data.user?.email).toBe(address);
    expect(userId, 'signup returned an account').toBeTruthy();

    // The local stack has `enable_confirmations = false`, so the session comes
    // back directly and no code round-trip is involved. Where confirmation IS
    // enabled — as it is on the hosted project — the same request instead
    // mails a link that returns as `?code=`, which is the flow the case above
    // measures end to end.
    expect(data.session?.user?.id).toBe(userId);

    // A verifier was still stored, so a confirmation code would be redeemable
    // by this client and by no other.
    const verifierKeys = [...applicant.storage.entries.keys()].filter(
      (key) => key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')
    );
    expect(verifierKeys.length, 'signup started a PKCE flow').toBeGreaterThan(0);
  });
});
