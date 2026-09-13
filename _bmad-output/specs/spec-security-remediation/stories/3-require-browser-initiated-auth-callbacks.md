---
title: 'Require browser-initiated auth callbacks'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '8c03845db05cad436735843d41c0490f6efa9043'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The PKCE callback is never exercised against the deployed site: no real Google
      consent round-trip, and the hosted redirect-URL allow list was not read.
    evidence: |-
      The hosted project issues the PKCE authorize redirect (measured: HTTP 302 to
      accounts.google.com with response_type=code), but completing consent needs a Google
      account this session does not hold and no authorized integration provides. Separately,
      /auth/v1/authorize does not validate redirect_to up front -- a deliberately bogus
      https://not-allowed.example.com/steal returned the same 302 with no error parameter --
      so the allow list is not readable from here and the Supabase MCP exposes no auth
      settings endpoint. The local substitute (tests/api/pkce-code-exchange.spec.ts) mints a
      real GoTrue code and proves only the initiating client redeems it. Settle by completing
      one real Google sign-in on https://sallvainian.github.io/My-Love/ after deploy.yml ships
      this, confirming the session lands and the URL returns with ?code=.
    location: >-
      src/api/auth/actionService.ts:119 (redirectTo) / hosted project xojempkrugifnaveqtqc
    severity: medium
  - summary: >-
      A PKCE sign-in cannot complete where localStorage is unavailable, which the previous
      implicit flow tolerated.
    evidence: |-
      With site data blocked or in a private window, supportsLocalStorage() is false and the
      SDK falls back to an in-memory store, which a full-page redirect to the provider wipes
      along with the verifier; the returning ?code= then finds nothing and is ignored. Under
      the old implicit flow the fragment carried the tokens, so the same browser signed in for
      that tab. Password sign-in is unaffected either way. Not fixed here: a cookie or
      sessionStorage adapter is new storage surface rather than a direct correction. Settle by
      deciding whether a private-window Google sign-in is supported, then adding an adapter or
      a stated limitation.
    location: >-
      src/api/supabaseClient.ts:59
    severity: low
  - summary: >-
      A code callback that finds no verifier is ignored in silence, with nothing shown to the
      person who just came back from the provider.
    evidence: |-
      GoTrueClient.js:3356-3366 classifies such a URL as not-a-callback, so _initialize falls
      through to _recoverAndRefresh and the app renders the login screen with no explanation;
      measured in tests/unit/api/supabaseClientAuthFlow.test.ts, which asserts exactly that
      silence. Recoverable -- signing in again from this browser works -- and the fix is
      user-facing callback handling, which the story's contract excludes ("Never: add ... an
      exchangeCodeForSession call of our own"). Settle by deciding whether a "finish sign-in
      in the browser you started in" message is wanted, and where it would live given that
      the SDK owns callback classification.
    location: >-
      src/App.tsx:229-296
    severity: low
  - summary: >-
      The provider-denial callback is as silent as the missing-verifier one, and
      only the second was recorded.
    evidence: |-
      GoTrueClient.js:3252-3259 throws AuthImplicitGrantRedirectError for any `#error=`
      URL before the flowType switch, _initialize returns it at :417, and nothing in
      src/App.tsx:229-296 reads _initialize's return value -- so a user who declines
      Google consent lands on the login screen with no explanation. Pre-existing: the
      implicit flow behaved identically, so this story neither caused nor changed it.
      The unit case "preserves an existing session for an error callback" asserts the
      session and the request count, never the returned error. Settle together with the
      missing-verifier silence: decide whether a "sign-in was cancelled" message is
      wanted, and where it lives given that the SDK owns callback classification.
    location: >-
      src/App.tsx:229-296
    severity: low
  - summary: >-
      Every redirect_to assertion runs where BASE_URL is "/", so the production
      "/My-Love/" base path is pinned nowhere.
    evidence: |-
      vite.config.ts:11 is `base: mode === 'production' ? '/My-Love/' : '/'` and
      playwright.config.ts:178 boots the dev server with `npx vite --mode test`, so both
      new assertions -- the unit case's `redirect_to` equality and the E2E's
      `appBaseUrl + '/'` -- only ever observe `/`. The byte-for-byte requirement the
      story pins is therefore verified at local origins alone. Not fixable from this
      session for the same reason the deployed-site verification is not. Recorded
      separately rather than folded into that entry, because the triage log of the
      previous pass said it had been grouped there and the text does not carry it.
      Settle by asserting the authorize URL's `redirect_to` once against a
      production-mode build, or by reading it during the outstanding deployed-site
      sign-in.
    location: >-
      tests/unit/api/supabaseClientAuthFlow.test.ts / tests/e2e/auth/google-oauth.spec.ts
    severity: low
  - summary: >-
      Whether an installed PWA returns from Google consent into the same storage
      partition that wrote the verifier was not established.
    evidence: |-
      Unverified. vite.config.ts:71 declares `display: 'standalone'`, and
      signInWithGoogle navigates the current context with window.location.href, which
      on the platforms checked keeps the round trip inside the app's own context and
      storage. What was not measured is an actual installed-PWA Google sign-in on a
      platform that hands OAuth to a separate browser context: there the returning
      `?code=` would find no verifier and be ignored, where the old implicit fragment
      carried the tokens themselves. Same failure mode as the private-window entry, a
      different trigger. Settle by completing one Google sign-in from the installed PWA
      on iOS and Android after deploy; if it fails, the fix is a storage adapter or a
      stated limitation, not a change to the flow type.
    location: >-
      src/api/supabaseClient.ts:59-77
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** `src/api/supabaseClient.ts:59-63` configures auth with `persistSession`, `autoRefreshToken` and `detectSessionInUrl: true` but **no `flowType`**, and the installed SDK defaults to `implicit` (`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:21`). Any link of the form `https://sallvainian.github.io/My-Love/#access_token=…&refresh_token=…&expires_in=…&token_type=bearer` is therefore treated as a login callback: `_isImplicitGrantCallback` matches on `access_token` alone (`:3351`), `_getSessionFromURL` fetches `/auth/v1/user` with the attacker's token and `_saveSession` + a `SIGNED_IN` notification follow (`:3294-3331`, `:419-429`). Measured on this tree: importing the app's own client with a fragment present issues `GET /auth/v1/user` immediately. A victim who clicks such a link is silently switched to the attacker's identity — store auth state (`App.tsx:262-290`), the Realtime channels keyed on `userId`, and the Background-Sync token in the `sw-auth` IndexedDB record (`sessionService.ts:71-83` → `sw-db.ts:127-139`) all rebind to it (CAP-13 / F13).

**Approach:** Set `flowType: 'pkce'` on the app's single client. The SDK then rejects any implicit callback URL before any network call (`GoTrueClient.js:3261-3265`), leaves storage untouched, and accepts only a `?code=` whose PKCE verifier this browser stored when it started the flow (`:3356-3366`, `:1625-1626`). Prove the rejection and the preservation of an existing account with the real installed SDK and a real second account, and prove the acceptance half against a real code minted by the local Auth server.

## Boundaries & Constraints

**Always:** Keep `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` and the `realtime.params.eventsPerSecond: 10` block exactly as they are — PKCE is one added key. Keep `signInWithGoogle`'s `redirectTo` (`${window.location.origin}${import.meta.env.BASE_URL}`) and its `access_type`/`prompt` query params byte-for-byte: measured, `_maybeAppendFlowIdToRedirect` is a no-op because `experimental.appendPkceFlowIdToRedirects` defaults off (`GoTrueClient.js:179`, `:4830-4834`), so the project's redirect allow-list is unaffected and must stay unaffected. Every new test must drive the **real** installed SDK, not a stubbed `createClient`. The hostile-fragment E2E identity must be a throwaway account created and deleted through `supabaseAdmin`; never link, unlink or reset a worker-pool account. Sanitize evidence: record user ids and status codes, never a token value.

**Never:** Add a password-recovery screen, a signup screen, a `/reset-password` route or an `exchangeCodeForSession` call of our own — the SDK's bootstrap already performs the exchange and no such UI exists today (`grep` over `src/components/` finds no `signUp`, no `reset-password`). Set `detectSessionInUrl` to a function, or add a second `createClient` in `src/`. Change `sessionService.ts`, `actionService.ts`, `App.tsx` or `LoginScreen.tsx` behaviour. Touch F2/F3's Realtime code, `interactionService.ts`, or any story-2 file. Hand-edit `src/types/database.types.ts`. Run `npm run deploy`. Flip any hosted Auth setting.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hostile fragment, signed out | App loaded at `/#access_token=<real foreign token>&refresh_token=…&expires_in=3600&token_type=bearer` | No session stored, login screen stays, **no** `GET /auth/v1/user`, no `sw-auth` record | Rejected locally; nothing logged as success |
| Hostile fragment, signed in | Same fragment while the worker account is signed in | Stored session user id unchanged, app stays past the login screen, `sw-auth.current.userId` unchanged | Existing session explicitly not removed (`GoTrueClient.js:415-417`) |
| Code callback, no verifier | `/?code=<anything>` with no PKCE verifier in this browser | URL ignored entirely; existing session (if any) preserved; no `/token?grant_type=pkce` call | `_isPKCECallback` returns false; silent |
| Code callback, wrong verifier | A real code exchanged by a client holding a different verifier | No session; Auth server rejects the exchange | Non-2xx from `/token?grant_type=pkce`, surfaced as an `AuthError` |
| Code callback, right verifier | A real code exchanged by the client that started the flow | Session established for that account | No error expected |
| Error callback | `/#error=access_denied&error_description=…` | No session established; an existing session is preserved | `AuthImplicitGrantRedirectError` returned, not thrown |
| Google sign-in start | `signInWithGoogle()` | Authorize URL carries `code_challenge` and `code_challenge_method=s256`; `redirect_to` is exactly `${origin}${BASE_URL}`; verifier written to `localStorage` | Existing error mapping unchanged |
| Password sign-in | `signIn({ email, password })` | Unchanged: `/token?grant_type=password`, session stored, `sw-auth` written | Existing error mapping unchanged |

</intent-contract>

## Code Map

- `src/api/supabaseClient.ts:55-70` — the single `createClient` in `src/` (`grep -rn "createClient" src/` returns only `:10` and `:55`). The `auth` object at `:59-63` is the whole change surface; `:62`'s comment "Enable OAuth callback detection" needs to say which callbacks are now accepted.
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` — the installed 2.116.0 behaviour, all of it measured on this tree:
  - `:21` `flowType: 'implicit'` is the default this story overrides.
  - `:383-404` `_initialize()` classifies the URL, then only calls `_getSessionFromURL` when `detectSessionInUrl` is on and the type is not `'none'`.
  - `:3261-3265` under `flowType: 'pkce'` an `implicit` callback throws `AuthPKCEGrantCodeExchangeError` **before** any fetch; `:3333-3335` converts it to a returned error.
  - `:405-418` on that error the existing session is deliberately **not** removed; `_saveSession` and the `SIGNED_IN` notification at `:419-429` never run.
  - `:3347-3352` `_isImplicitGrantCallback` matches on `access_token` / `error` alone. `:3356-3366` `_isPKCECallback` additionally requires a verifier in this browser's storage.
  - `:1606-1636` `_exchangeCodeForSession`: `:1625-1626` throws `AuthPKCECodeVerifierMissingError` locally, before the network, when no verifier is present — a missing-verifier attempt therefore cannot burn the auth code.
  - `:2412-2425` / `:2510-2563` `getSession()` reads storage independently of `_initialize`'s outcome, which is why a rejected callback leaves a signed-in user signed in.
  - `:4790-4799` + `:4830-4834` `_getUrlForProvider` adds `code_challenge`/`code_challenge_method` and leaves `redirectTo` alone (`experimental` defaults to `{}` at `:179`).
  - No `flowType` branch exists in `signInWithPassword`; the PKCE branches are `signUp` `:738`, `signInWithOtp` `:1859`, `signInWithSSO` `:2137`, `resend` `:2282`, `resetPasswordForEmail` `:3762`, `_getUrlForProvider` `:4795`.
- `node_modules/@supabase/auth-js/dist/module/lib/helpers.js:268` `pkceVerifierSlotKey` and `:304` — the verifier is written to `<storageKey>-flow-<id>-code-verifier`, `<storageKey>-flows-code-verifier` and the legacy `<storageKey>-code-verifier`. `constants.js:42` `PKCE_FLOW_ID_PARAM = 'sb_flow_id'` (unused here, see above).
- Storage key is `sb-${hostname.split('.')[0]}-auth-token` (`node_modules/@supabase/supabase-js/dist/index.mjs`): `sb-127-auth-token` under `.env.test` (`VITE_SUPABASE_URL=http://127.0.0.1:54321`) and `sb-xojempkrugifnaveqtqc-auth-token` under `vitest.config.ts:12`'s `define`.
- `src/api/auth/actionService.ts:114-139` `signInWithGoogle` — `redirectTo` at `:119`, `queryParams` at `:120-123`. `:94-112` `resetPassword` targets a `/reset-password` route that does not exist (`grep -rn "reset-password" src/` returns only this line). `:46-69` `signUp` is exported but called by nothing in `src/components/`.
- `src/api/auth/sessionService.ts:60-99` `onAuthStateChange` — writes `sw-auth` on `SIGNED_IN`/`TOKEN_REFRESHED` (`:71-83`) and clears it on `SIGNED_OUT`. Nothing here changes; it is the state that must **not** move on a rejected callback.
- `src/sw-db.ts:127-139` `storeAuthToken` → `db.put('sw-auth', { id: 'current', … })`; `src/services/dbSchema.ts:199` `STORE_NAMES.SW_AUTH = 'sw-auth'`. The E2E reads `my-love-db` → `sw-auth` → `current` to prove no service-worker rebinding.
- `src/App.tsx:229-296` — the bootstrap consumer: `checkAuth()` at `:234` then `onAuthStateChange` at `:262`; `setAuthUser` at `:274`. `:182-199` reads only `window.location.pathname` and calls `setView(initialView, true)`, and `navigationSlice.ts:50` skips the history write when `skipHistory` is set, so nothing strips `?code=` out from under the SDK during bootstrap.
- `src/components/LoginScreen/LoginScreen.tsx:87-105` `handleGoogleSignIn`, `:108` `data-testid="login-screen"` — the E2E's signed-out assertion anchor.
- `tests/e2e/auth/google-oauth.spec.ts:33-38` — already routes `**/auth/v1/authorize**`; the glob still matches once PKCE adds query params. Extend its handler to capture `route.request().url()` rather than writing a new spec.
- `tests/e2e/auth/login.spec.ts:12` `test.use({ authSessionEnabled: false })` — the signed-out pattern. `tests/support/fixtures/auth.ts:73-90` injects the worker storage state when the flag is true, which is how the signed-in half gets a real session.
- `tests/support/helpers/rls-security.ts:43-93` `createOutsiderClient(supabaseAdmin, prefix)` → `{ client, userId, cleanup }` — the ready-made throwaway identity; `client.auth.getSession()` yields its real token set for the fragment. `tests/support/fixtures/index.ts:73` provides `supabaseAdmin` to every project.
- `tests/api/interaction-realtime.spec.ts` / `tests/api/couple-broadcast-authorization.spec.ts` — the `api`-project shape (Node, `playwright.config.ts:148-158`, `testDir: ./tests/api`). Local Mailpit is at `http://127.0.0.1:54324` (`supabase status`), REST API `/api/v1/messages`.
- `src/api/auth/__tests__/authServices.test.ts:35-49` mocks `../../supabaseClient` wholesale, and `tests/api/empty-database-error-fallback.spec.ts:24` builds its own client — neither is affected by this change; no test anywhere asserts the app client's `createClient` options.
- `supabase/config.toml` `[auth.email] enable_confirmations = false` and `[auth.rate_limit] email_sent = 2` — locally signup returns a session with no email, and OTP sends are rate-limited (the comment says the limit requires `auth.email.smtp`; measure before relying on more than two sends per hour).
- Hosted `GET $VITE_SUPABASE_URL/auth/v1/settings`, read 2026-09-12: `"google": true`, `"email": true`, `"disable_signup": false`, `"mailer_autoconfirm": false` — Google OAuth is live and **email confirmation is enabled on the hosted project**, so the hosted signup link becomes a `?code=` callback under PKCE.
- Measured on this tree before planning (probe deleted): with `flowType: 'pkce'`, a hostile fragment produced **0** fetch calls, `getSession()` null, `localStorage` untouched; with a pre-seeded session it was preserved with 0 fetches; `/?code=x` with no verifier preserved the session with 0 fetches; `signInWithOAuth` produced `…/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2F&code_challenge=<…>&code_challenge_method=s256&access_type=offline&prompt=consent` and three verifier keys in `localStorage`. Without the change the same fragment issued `GET /auth/v1/user` — that call is the red/green discriminator.

## Tasks & Acceptance

**Execution:**
- `src/api/supabaseClient.ts` — edit — add `flowType: 'pkce'` to the `auth` options and replace the `detectSessionInUrl` comment with one naming what is now accepted (a code callback whose verifier this browser stored) and what is refused (a foreign implicit token fragment). One key added; nothing else in the file changes.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` — create — real-SDK behaviour tests that import **the app's own module** under a URL set before import (`window.happyDOM.setURL(...)` plus `vi.resetModules()`; verified working in this environment). Cover the matrix rows that need no server: hostile fragment signed out, hostile fragment over a pre-seeded session, `?code=` with no verifier, and the `#error=` row — each asserting **zero `fetch` calls** (spy on `globalThis.fetch`) alongside the session assertion, because the fetch is what fails under the old implicit default. Add the Google-start row: assert the authorize URL contains `code_challenge` and `code_challenge_method=s256`, that its `redirect_to` decodes to exactly `${origin}${BASE_URL}` with no added parameter, and that a `*-code-verifier` key appeared in `localStorage`. Add the password row: `signIn` still posts `grant_type=password` with no `code_challenge`. Clear `localStorage` and restore the URL between cases.
- `tests/e2e/auth/implicit-fragment-rejection.spec.ts` — create — chromium project, real browser, real foreign account. Create a throwaway account with `createOutsiderClient(supabaseAdmin, 'pkce-attacker')`, read its **real** session, and build the complete fragment (`access_token`, `refresh_token`, `expires_in`, `token_type`). Two `[P0]` cases: signed out (`test.use({ authSessionEnabled: false })`) — login screen still visible, no `sb-127-auth-token` in `localStorage`, no `sw-auth`/`current` record in `my-love-db`; and signed in as the worker account — the stored session's `user.id` is still the worker's, the login screen is not shown, and `sw-auth.current.userId` is still the worker's. Delete the throwaway account in teardown. This spec must never link, unlink or reset a worker-pool account.
- `tests/api/pkce-code-exchange.spec.ts` — create — `api` project, real local Auth server, proving the acceptance half the browser cases cannot. Start a PKCE flow from client A (`signInWithOtp` for a throwaway address created through `supabaseAdmin`), read the link from Mailpit (`http://127.0.0.1:54324/api/v1/messages`), follow `/auth/v1/verify` without redirects and take `code` from the `Location` header. Then, in this order: a fresh client B with no verifier is rejected **without** a network call (so the code survives — `GoTrueClient.js:1625-1626`); a client seeded with a wrong verifier is rejected **by the server** (assert the non-2xx and that no session results); and client A exchanges the code successfully for that account. Measure the `email_sent` rate limit before adding a second OTP send, and keep the spec to at most two sends per run; if a second code cannot be minted, derive the wrong-verifier case from the surviving code and record the measurement in the story.
- `tests/e2e/auth/google-oauth.spec.ts` — edit — in the existing `**/auth/v1/authorize**` route handler, capture `route.request().url()` and assert it carries `code_challenge` and `code_challenge_method=s256` and that `redirect_to` is unchanged, so the real browser demonstrates the PKCE start. Keep both existing assertions and the redirect-back fulfilment as they are.
- Operational: record in **Operational Evidence** the hosted `/auth/v1/settings` read (`google`, `mailer_autoconfirm`, `disable_signup`), the outcome of an attempted real Google redirect against the hosted project, the measured Mailpit/rate-limit behaviour, and — because `mailer_autoconfirm` is false — the hosted signup-confirmation consequence: under PKCE a confirmation link opened in a **different** browser no longer signs the user in, though the account is still confirmed and password sign-in works. If the Google consent step cannot be completed by this session, record the concrete blocker rather than claiming it.

**Acceptance Criteria:**
- Given the app's own client module, when it is imported in a browser-like environment with any foreign implicit token fragment in the URL, then no request is made to `/auth/v1/user` and no session is written to storage.
- Given a browser already signed in as the worker account, when the app is loaded with a real second account's complete implicit fragment, then the stored session user id, the rendered app and the `sw-auth` Background-Sync record all still belong to the original account.
- Given a real auth code minted by the local Auth server for a flow started by client A, when A exchanges it, then a session for that account is established; and when a client without that verifier exchanges it, then no session is established.
- Given `npm run lint`, `npm run typecheck` and `npm run test:unit`, when they run, then all pass with the new unit spec included and every pre-existing auth test still green.
- Given `npx playwright test tests/e2e/auth tests/api/pkce-code-exchange.spec.ts`, when they run against the local stack, then all pass, including the unchanged Google-button and redirect-initiation cases.
- Given `fnox exec -- npm run build`, when it runs, then it exits 0.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 37 findings — high 0, medium 10, low 21, false 6, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) CI never starts the mail catcher this spec needs — verified: `.github/actions/setup-supabase/action.yml:108` sets `EXCLUDE='studio,postgres-meta,mailpit,…'`, justified at `:83` by "no mail is ever sent", a claim this story invalidates. Patched: `mailpit` removed from `EXCLUDE` and the justification rewritten to say why it is now required, mirroring the `edge-runtime` note already there.
  - `[low]` `[patch]` (blind-hunter) `expect.poll` evaluates its callback outside the retry guard, so a thrown fetch aborts on the first tick — verified in `playwright/lib/matchers/expect.js`. Patched: the whole poll body is wrapped in try/catch returning `undefined`, so a catcher that is still starting uses the 15 s window and the intended message.
  - `[medium]` `[patch]` (blind-hunter) The describe-level `test.skip(!MAILPIT_URL)` could make a P0 security test a silent no-op — real, and reachable because `MAILPIT_URL` is only set inside `playwright.config.ts`'s swallowing `try`. Patched as one root cause with the CI and env rows: CI now runs the catcher, and the env assignment no longer produces a truthy placeholder, so the skip fires only when `supabase status` itself failed — a state in which every api spec fails anyway.
  - `[low]` `[patch]` (blind-hunter) The `INBUCKET_URL` fallback is dead here and wrong where it would matter — verified: `supabase status -o env` emits **both** names simultaneously with the same value on this CLI. Patched: fallback dropped.
  - `[low]` `[patch]` (blind-hunter) The unit fetch spy calls through to the live hosted project — verified: `vi.spyOn` without an implementation delegates, and `vitest.config.ts:12` points the module at the production URL. The claim that it leaks the fragment's tokens is overstated (they are syntactic placeholders, and the green state issues no request at all), but the regression state really would reach production. Patched: the spy now rejects by default, so no case can reach the network.
  - `[low]` `[patch]` (blind-hunter) Each case leaves a live GoTrue client — verified: the SDK logs "Multiple GoTrueClient instances" once per case. Matters more now that stray traffic would be recorded by the rejecting spy. Patched: every imported client is registered and `stopAutoRefresh()`ed in `afterEach`.
  - `[low]` `[patch]` (blind-hunter) The signed-out E2E's storage assertion is vacuous if the derived key drifts — real: `storedSessionUserId` returns null for a key that does not exist. Patched: the case now also asserts that **no** `sb-*-auth-token` key exists at all.
  - `[low]` `[patch]` (blind-hunter) `syncUserId === null || syncUserId === workerUserId` accepts a wiped record — measured: `syncUserId` is genuinely `null` in the passing state, because a session restored from storage emits no `SIGNED_IN` and `sessionService` therefore never writes the record. Patched: the assertion is now a strict `toBeNull()` with that measurement recorded, so it still fails if a callback ever binds the attacker's identity but no longer passes on a wipe.
  - `[medium]` `[patch]` (blind-hunter) No evidence for the signup half — verified against the intent, not merely the spec: `SPEC.md` CAP-13 success names "password login, signup and Google OAuth", so the story's grep-based argument that no UI calls `signUp` answers a different question. Patched: a `[P0]` case in the api spec runs a real `signUp` under PKCE against the local Auth server and asserts the account, the session and the stored verifier.
  - `[low]` `[defer]` (blind-hunter) Open operational work lived only in the story's prose — real: the frontmatter said `deferred: []` and `rollout.md` was untouched, against story 2's precedent. Deferred: a `### PKCE — status after story 3` block was added to `rollout.md` and the outstanding deployed-site verification recorded in `deferred`.
  - `[low]` `[patch]` (blind-hunter) The impostor seeding loop overwrote every storage key, not just verifier slots — real, and working only by luck today. Patched: it now iterates the already-computed `verifierKeys`.
  - `[low]` `[patch]` (blind-hunter) The success case silently assumes a failed verifier does not consume the code — measured true on this stack, but unstated. Patched: the assumption is now written at the call site, noting that a change would redden this assertion rather than the security ones.
  - `[low]` `[patch]` (blind-hunter) `authorizeUrl` is assigned only inside a route callback, so TypeScript narrows it to `null` and `authorizeUrl!` is `never` — verified. Patched: an array collects the URLs, which restores checking and also pins that exactly one authorize request was made. The other half — splitting the test in two — is rejected: the spec's Execution deliberately extends the existing handler, and one failure naming either cause is not a bad outcome.
  - `[medium]` `[patch]` (edge-case-hunter) Nothing pins the app client's **acceptance** of a code callback; the reviewer measured that flipping `detectSessionInUrl` to `false` leaves all 2007 unit and 23 auth E2E tests green. Confirmed by inspection: every callback case in the diff asserted a refusal. Patched: a new unit case starts a real OAuth flow on the app's own client so the SDK writes a verifier, then re-imports the module at a `?code=` URL and asserts the exchange request is issued and the session is established. Re-measured: `detectSessionInUrl: false` now reddens exactly that case.
  - `[medium]` `[patch]` (edge-case-hunter) The new api spec cannot verify anything in CI because the mail catcher is excluded there — same root cause as the first row; patched with it.
  - `[medium]` `[patch]` (edge-case-hunter) `process.env.MAILPIT_URL ??= undefined` stores the **string** `"undefined"`, which is truthy, so the skip guard never fires and the spec fetches a host named "undefined" — verified by running it. Patched: the variable is assigned only when the parse found a value.
  - `[false]` `[reject]` (edge-case-hunter) No missing-adoption gap for the client config — not a defect; recorded as the layer filed it.
  - `[false]` `[reject]` (edge-case-hunter) The `flowType` change itself is well covered, red-then-green measured — not a defect; recorded as filed.
  - `[medium]` `[patch]` (verification-gap) `playwright.config.ts:76` can store the literal string "undefined" — same root cause as the edge-case row above; patched with it.
  - `[low]` `[patch]` (verification-gap) A second PKCE flow started before the first callback returns overwrites the legacy verifier slot, leaving the first unredeemable — real SDK behaviour (`helpers.js:304`, `:318`; our redirects carry no `sb_flow_id`). The proposed fix, enabling `experimental.appendPkceFlowIdToRedirects`, is rejected: it appends a parameter to `redirect_to` and the story measured that leaving it off is what keeps the project's exact-match allow list matching. Patched instead at the claim: the source comment now says "a verifier", not "the matching verifier", and records the two-tab consequence and why the option stays off.
  - `[low]` `[defer]` (verification-gap) A PKCE sign-in cannot complete where localStorage is unavailable, which implicit tolerated — real behaviour change for private windows; a cookie/sessionStorage adapter is new storage surface rather than a direct correction. Deferred with what would settle it.
  - `[low]` `[defer]` (verification-gap) A real `?code=` arriving at a browser with no verifier is ignored in silence, with no message — real and recoverable by signing in again; the fix is user-facing callback handling, which the intent-contract's Never list excludes. Deferred with the open product question.
  - `[false]` `[reject]` (verification-gap) A signup-confirmation or password-reset link opened in a different browser silently no-ops — refuted as a defect: that is precisely CAP-13's stated intent ("Accept authentication redirects only for a flow initiated in that browser"), the account is still confirmed server-side, and `remediation.md` puts a recovery screen out of scope. Recorded in Operational Evidence rather than fixed.
  - `[false]` `[reject]` (verification-gap) On an insecure origin `crypto.subtle` is absent and the challenge degrades to `plain` — the trigger is not reachable: the app is served from GitHub Pages over HTTPS and from `localhost`, both secure contexts.
  - `[low]` `[reject]` (verification-gap) The rejected fragment stays in the address bar and history — real but the retained token is the attacker's own, not the victim's, and the fix means reading the URL in application code, which the Design Notes exclude on purpose. Not worth the surface.
  - `[low]` `[patch]` (verification-gap) The IndexedDB read has no `onblocked` handler, so a pending versionchange elsewhere would hang the test to its timeout — real. Patched: `onblocked` resolves `null`.
  - `[low]` `[patch]` (verification-gap) `message.Text ?? message.HTML` skips the HTML fallback for an HTML-only mail, because an empty string is not nullish — real. Patched to `||`.
  - `[low]` `[patch]` (verification-gap) `resetModules` leaves prior GoTrue clients alive on the same storage key — same root cause as the blind-hunter row; patched with it.
  - `[low]` `[reject]` (verification-gap) The unit case calls `signInWithOAuth` directly rather than `signInWithGoogle`, making the `redirect_to` assertion tautological — refuted for the coverage it claims is missing: `tests/e2e/auth/google-oauth.spec.ts` drives the real button through `signInWithGoogle` and asserts the same parameters on the resulting request, so the real caller's options are exercised. Duplicating that in happy-dom needs a navigation stub for no added coverage.
  - `[low]` `[patch]` (verification-gap, claim) "accepts only a `?code=` whose verifier this browser stored when it started the flow" overstates the single legacy slot — same root cause as the concurrent-flow row; patched with it.
  - `[medium]` `[patch]` (intent-alignment) The acceptance half is demonstrated of the SDK on a test-built client, not of `src/api/supabaseClient.ts` or the app bootstrap — same root cause as the edge-case acceptance row; patched with it, and the new case runs on the app's own module.
  - `[false]` `[reject]` (intent-alignment) "Still work" for password is asserted as an outgoing request shape, never a successful login — refuted: `tests/e2e/auth/login.spec.ts:54` drives a password sign-in through the app's own client to a signed-in state, and it ran and passed in this pass's chromium run.
  - `[medium]` `[patch]` (intent-alignment) Signup has no surface at all in the diff — same root cause as the blind-hunter signup row; patched with it.
  - `[medium]` `[patch]` (intent-alignment) Google coverage stops at the outgoing authorize URL; the return leg is exercised nowhere — grouped with the acceptance entry. The app-client half is now pinned by the new code-redemption case; the provider round-trip itself needs Google credentials this session does not hold and stays an operator action, recorded in `deferred` and `rollout.md`.
  - `[low]` `[defer]` (intent-alignment) The Pages base path is asserted at local origins, never at `https://sallvainian.github.io/My-Love/` — real and not fixable from here; grouped with the deployed-site defer entry.
  - `[low]` `[patch]` (intent-alignment) The service-worker assertion accepts absence as success — same root cause as the blind-hunter row; patched with it.
  - `[false]` `[reject]` (intent-alignment) `playwright.config.ts` is a surface outside the contract's named site — refuted: the contract's "Site" names where the required change goes, not an exhaustive list of files the story may touch, and that line exists solely to make the required evidence runnable. No bad outcome named.


### 2026-09-12 — Review pass (follow-up)
- verdicts: 36 findings — high 0, medium 8, low 17, false 10, maybe-false 1
- findings:
  - `[medium]` `[patch]` (blind-hunter) The CI mail-catcher change is unscoped — verified: `.github/actions/setup-supabase/action.yml` is composed by `db-tests`, `backend-tests` x2 and seven Playwright jobs, and its own comment justifies the list with "10 jobs x 36 fewer blobs is ~360 fewer requests per run" and names run 32268765187 as killed by `toomanyrequests`. Only `Backend Tests (api)` reads mail. Patched: a `needs-mail` input (default `false`) on both composite actions, `mailpit` appended to `EXCLUDE` unless it is `true`, and `needs-mail: ${{ matrix.project == 'api' }}` on the one job.
  - `[medium]` `[patch]` (blind-hunter) `test.skip(!MAILPIT_URL)` does not test catcher availability — verified: `supabase status -o env` emits `MAILPIT_URL` from `[inbucket] enabled` in `config.toml` while the same output reports stopped services, so the guard fires only when the whole parse throws. Patched with the row below; the skip message now says what it detects and the comment records that an enabled-but-down catcher fails loudly on the poll instead.
  - `[medium]` `[patch]` (blind-hunter) A P0 case that sends no mail is gated behind the mail catcher — verified: `[P0] password signup still completes under PKCE` references `MAILPIT_URL` nowhere, yet sat under the describe-level skip. Patched: the skip moved onto the one case that reads mail.
  - `[low]` `[patch]` (blind-hunter) `endsWith('-code-verifier')` also matches the flow index, so "stored a verifier" is weaker than its message — verified at `auth-js/dist/module/lib/helpers.js:269`, where `pkceFlowIndexKey` is `${storageKey}-flows-code-verifier` and holds an array of flow ids. Patched in all four places: the index suffix is excluded, and the api spec additionally asserts the legacy slot `retrievePKCEVerifier` actually reads (`helpers.js:313-319`) was written.
  - `[low]` `[defer]` (blind-hunter) The silent-callback deferral covers only half the silence — verified: `GoTrueClient.js:3252-3259` throws for any `#error=` URL before the flowType switch and nothing in `App.tsx:229-296` reads `_initialize`'s return value. Pre-existing: identical under the implicit default. Deferred with the missing-verifier silence.
  - `[low]` `[defer]` (blind-hunter) The base-path gap the previous triage log says it grouped into the deployed-site defer entry is not in that entry — verified: that entry's text mentions neither `BASE_URL` nor `/My-Love/`, and `vite.config.ts:11` + `playwright.config.ts:178` mean every `redirect_to` assertion only ever sees `/`. Deferred as its own entry rather than rewriting the existing one.
  - `[low]` `[patch]` (blind-hunter) The `rollout.md` insertion puts standing rollout prose under a story-specific heading — verified: the four CAP-2/CAP-3 paragraphs sat after `### PKCE — status after story 3`, having already been displaced once by story 2's block. Patched: the standing guidance moved directly under `## Operational completion`, above both per-story blocks.
  - `[false]` `[reject]` (blind-hunter) Story 3 lacks the review roll-up stories 1 and 2 carry — refuted: `## Auto Run Result` was present and was stripped by the orchestrator's harvest before this follow-up pass; the Finalize step of this pass writes it back. Its absence mid-run is the process, not a defect.
  - `[low]` `[patch]` (blind-hunter) A dead assertion in the signed-in E2E, where a live one is missing — verified: `expect(syncUserId).not.toBe(foreign.userId)` cannot fail once `toBeNull()` has passed. Patched with the sw-auth group below.
  - `[low]` `[patch]` (blind-hunter) The acceptance unit case never asserts the verifier was sent — verified: it checked only that a `grant_type=pkce` URL was requested against a stubbed 200. Patched: the request body is now parsed and both `auth_code` and `code_verifier` are asserted against the value the starting client wrote; the case still passes, so the SDK does transmit it.
  - `[false]` `[reject]` (blind-hunter) Two different line citations for the same SDK fact — refuted: measured in the installed 2.116.0 copy, `:3261` is the `switch`, `:3262` the `case 'implicit'`, `:3264` the throw. `3261-3265` and `3263-3265` are the same throw at two granularities and both contain it; neither is wrong.
  - `[false]` `[reject]` (blind-hunter) The mail lookup can read another worker's message — refuted: the two tests use different address prefixes (`pkce-exchange-` / `pkce-signup-`), Playwright runs each test once per project per run and retries sequentially, so two same-millisecond executions of the same test against one stack were not shown to occur.
  - `[low]` `[patch]` (blind-hunter) `expect(verifyResponse.status).toBe(303)` pins a GoTrue implementation detail inside a P0 security case — real: a CLI emitting 302 would redden it for a reason unrelated to PKCE, and the evidence the case needs is on the next two lines. Patched: any 3xx is accepted; the `code` and the absence of `access_token` in `Location` still carry the claim.
  - `[low]` `[patch]` (blind-hunter) The signup cleanup fallback is not robust — verified: `listUsers()` pages at 50 by default and the fallback scanned page 1, on a stack whose account count is machine-dependent. Patched: `{ perPage: 1000 }`.
  - `[false]` `[reject]` (blind-hunter) The redirect-allow-list reasoning covers one of two `redirectTo` values — refuted: `actionService.ts:97`'s `reset-password` target is never sent, because `grep -rn "resetPassword" src/` finds only the definition at `actionService.ts:94` and the re-export at `authService.ts:10,30` — no call site anywhere. An unsent redirect cannot weaken the allow-list claim.
  - `[low]` `[patch]` (edge-case-hunter) The sw-auth assertion is flaky if the worker token refreshes mid-run — verified: `sessionService.ts:71` writes the record on `TOKEN_REFRESHED` as well as `SIGNED_IN`, the app client has `autoRefreshToken: true`, and the fixture reuses a cached token until it expires, so a near-expiry token produces a record with the worker's id and `toBeNull()` reddens a P0 for an unrelated reason. Patched with the group below.
  - `[low]` `[patch]` (edge-case-hunter) The authorize assertions race the click — verified: under PKCE the SDK awaits `crypto.subtle.digest` before assigning `window.location.href`, and `waitForLoadState('domcontentloaded')` plus a login-screen assertion that was already true do not wait for the navigation, so `authorizeUrls` could be empty. Patched: `page.waitForRequest('**/auth/v1/authorize**')` is armed before the click and awaited after it.
  - `[medium]` `[patch]` (edge-case-hunter) `MAILPIT_URL` unset in CI retires a P0 behind a green check — patched with the guard group; see the verification-gap row for the measured mechanism.
  - `[maybe-false]` `[defer]` (edge-case-hunter) An installed PWA may return from consent into a different storage partition than the one that wrote the verifier — could not be decided here: `signInWithGoogle` navigates the current context, which keeps the round trip in-app on the platforms inspected, but no installed-PWA sign-in was performed. Deferred as medium (unverified) with what would settle it: one Google sign-in from the installed PWA on iOS and Android after deploy.
  - `[low]` `[patch]` (edge-case-hunter) The signup cleanup fallback pages at 50 — same root cause as the blind-hunter row; patched with it.
  - `[medium]` `[patch]` (edge-case-hunter) Removing `mailpit` from `EXCLUDE` re-imposes the documented pull cost on ~10 jobs — same root cause as the first row; patched with it.
  - `[low]` `[patch]` (edge-case-hunter, claim) The spec says the signed-in case asserts "`sw-auth.current.userId` is still the worker's" while the test asserts the record is absent — verified: in the passing state no record exists, so the contract's "unchanged" was never observed on a live record. Patched with the group below.
  - `[medium]` `[patch]` (verification-gap) Both PKCE `[P0]` cases are gated behind a describe-level skip that fires on an unrelated failure, and one never uses mail — pre-verified and confirmed: `.github/actions/setup-supabase/action.yml:147-149` exports `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` through `$GITHUB_ENV` before Playwright starts, while `MAILPIT_URL` exists only if `playwright.config.ts`'s `supabase status` parse succeeds — so that parse failing in CI leaves every other api spec passing while these two silently skip. This refutes the previous pass's justification for keeping the skip. Patched: the skip gates only the mail-reading case and only outside CI; in CI a missing `MAILPIT_URL` throws.
  - `[medium]` `[patch]` (verification-gap) The catcher now starts in all ten Supabase-provisioning jobs though only one reads mail — same root cause as the first row; patched with it, by the input the layer proposed.
  - `[low]` `[patch]` (verification-gap) The `MAILPIT_URL` guard does not detect whether mailpit is running — pre-verified against `internal/status/status.go` at the CI-pinned `v2.77.1`: the variable follows `[inbucket] enabled` in `config.toml`, not what `supabase start -x` excluded. It fails loudly rather than silently, so the filed disposition was `defer`; folded into the guard patch instead, where the comment now records exactly this.
  - `[low]` `[patch]` (verification-gap) The new E2E pins a pre-existing sw-auth gap as the passing state — verified at `sessionService.ts:71`: the record is written only on `SIGNED_IN`/`TOKEN_REFRESHED`, never on `INITIAL_SESSION`. Patched with the group below; the assertion no longer encodes today's incidental value.
  - `[false]` `[reject]` (verification-gap) Two candidates checked and refuted (the Pages SPA redirect script cannot mangle `?code=`; app navigation cannot strip it before `_initialize` parses the URL at import time) — recorded as the layer filed them: no defect.
  - `[medium]` `[carried]` (intent-alignment) The acceptance half is proven with a real code on a test-built client and on the app's client with a fabricated response, so real client and real server never meet — carried: same location and claim as the previous pass's medium `[patch]` row, which added the app-module redemption case, and the code still reads as that row describes. Not re-patched. (This pass did strengthen that case's assertions — see the body row above.)
  - `[false]` `[reject]` (intent-alignment) The "no `GET /auth/v1/user`" expectation is asserted in happy-dom, not at the browser surface the matrix row names — refuted: the browser cases carry a *real* foreign token, so the implicit regression state would establish and store the attacker's session there and fail the session, `display-name-setup` and `sw-auth` assertions. The fetch count is not the discriminator that surface needs.
  - `[low]` `[patch]` (intent-alignment) "`sw-auth.current.userId` unchanged" is verified against an empty store — same root cause as the edge-case and verification-gap rows; patched as one group: the assertion is now `not.toBe(foreign.userId)` plus membership in `[null, workerUserId]`, with a comment naming both admissible values and why pinning either one alone is wrong, so a later pass does not flip it back.
  - `[false]` `[carried]` `[reject]` (intent-alignment) Password "still work" is asserted as a request shape, never a successful login — carried: refuted in the previous pass on `tests/e2e/auth/login.spec.ts:54`, which drives a password sign-in through the app's own client to a signed-in state and passed again in this pass's run.
  - `[low]` `[defer]` (intent-alignment) `redirect_to` byte-for-byte is asserted only where `BASE_URL` cannot differ from `/` — same root cause as the blind-hunter base-path row; deferred with it.
  - `[low]` `[carried]` (intent-alignment) The source comment narrows "the matching verifier" to "a verifier", and no test exercises the concurrent-tab case — carried: same claim and location as the previous pass's low `[patch]` row, which chose the comment over enabling `appendPkceFlowIdToRedirects` precisely to keep the allow list matching. Not re-patched.
  - `[false]` `[reject]` (intent-alignment) Signup is a scenario added outside the matrix — refuted as a defect: `SPEC.md` CAP-13 names signup among the flows that must keep working, and the previous pass added the case for that reason. Covering a named flow is not scope the contract withheld; the contract's "Never" forbids a signup *screen*, which nothing here adds.
  - `[false]` `[carried]` `[reject]` (intent-alignment) `playwright.config.ts` and the CI action are surfaces the contract neither permits nor forbids — carried: refuted in the previous pass on the grounds that the contract's "Site" names where the required change goes, not an exhaustive list of touchable files. The CI half's actual cost is handled as the first row of this pass.
  - `[false]` `[reject]` (intent-alignment) Placement note: `tests/api/` is a declared Playwright project and not the frozen archive — filed by the layer as "not a divergence"; recorded, no defect.

## Design Notes

**Why one key and no callback code of our own.** The SDK already owns the whole callback surface: classification (`_initialize`), rejection (`_getSessionFromURL`) and exchange (`_exchangeCodeForSession`) all run from the client constructor before React mounts. Adding a hand-written handler would mean a second place that decides what a callback is, and F13 names the client configuration — not a new route — as the site.

**The assertion that actually discriminates.** A rejected fragment and an *invalid* accepted fragment both end with `getSession() === null`, so a session assertion alone passes on the unfixed code whenever the test token is fake. Measured on this tree: under the implicit default the SDK issues `GET /auth/v1/user` with the supplied token; under PKCE it issues nothing. Every unit case therefore asserts the fetch count as well, and the browser case uses a *real* foreign token so that "no session" means something.

**What is deliberately left alone.** The rejected fragment stays in `window.location.hash` — the SDK only clears it on the success path (`GoTrueClient.js:3328-3329`) — so a reload re-rejects it harmlessly. Clearing it ourselves would mean reading the URL in application code for no security gain. Likewise `?code=` survives a failed classification; both are cosmetic.

**The two behaviour changes worth naming.** Hosted email confirmation is on (`mailer_autoconfirm: false`), and the app exports `signUp`/`resetPassword` with no UI calling either. Under PKCE both flows become code callbacks, so a link opened in a different browser than the one that started the flow no longer establishes a session. That is precisely CAP-13's intent, the account is still confirmed server-side, and password sign-in is unaffected — but it is recorded rather than discovered later.

## Operational Evidence

Measured 2026-09-12. Installed SDK `@supabase/supabase-js` and `@supabase/auth-js` 2.116.0; local stack `supabase status` API `http://127.0.0.1:54321`, Mailpit `http://127.0.0.1:54324`. No token value is recorded here or in any test output.

**Hosted Auth settings** — `GET $VITE_SUPABASE_URL/auth/v1/settings` with the publishable key: `"google": true`, `"email": true`, `"disable_signup": false`, `"mailer_autoconfirm": false`, `"phone": false`. So Google OAuth is live and **email confirmation is enabled on the hosted project**.

**Hosted PKCE authorize redirect** — `GET $VITE_SUPABASE_URL/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fsallvainian.github.io%2FMy-Love%2F&code_challenge=<RFC 7636 example>&code_challenge_method=s256&access_type=offline&prompt=consent` returned **HTTP 302** to `accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `scope=email profile`, `access_type=offline`, `prompt=consent`, `redirect_uri=https://xojempkrugifnaveqtqc.supabase.co/auth/v1/callback` and a 36-character `state`. The hosted project accepts and issues the PKCE authorize redirect.

**The Google consent step was not completed — concrete blocker.** Finishing the redirect requires signing in to a Google account at `accounts.google.com`; this session holds no Google credentials and none are available through any authorized integration here. Everything up to the consent screen is measured above; the returning `?code=` half is measured against the real local Auth server instead, by `tests/api/pkce-code-exchange.spec.ts`, which mints a genuine GoTrue auth code and proves only the initiating client can redeem it. **Outstanding operator action:** complete one real Google sign-in on the deployed site after this ships and confirm the session lands.

**The Pages redirect and base path are unaffected, and here is the limit of that claim.** PKCE does not change the `redirect_to` the app sends: `_maybeAppendFlowIdToRedirect` is a no-op because `experimental.appendPkceFlowIdToRedirects` defaults off (`GoTrueClient.js:179`, `:4830-4834`). Measured in two places — the unit case asserts the authorize URL's `redirect_to` decodes to exactly `${origin}${BASE_URL}`, and the browser case asserts the same on the real click. So whatever allow-list entry makes today's Google sign-in work keeps matching. What was **not** established: that `https://sallvainian.github.io/My-Love/` is in the hosted allow list. The authorize endpoint does not validate `redirect_to` up front — a deliberately bogus `https://not-allowed.example.com/steal` returned the same 302 to Google with no error parameter — so the check happens at callback time and is not readable from here.

**Email-confirmation consequence, recorded not discovered.** With `mailer_autoconfirm: false`, a hosted signup link becomes a `?code=` callback under PKCE. Opened in a **different** browser than the one that signed up, it no longer establishes a session: `_isPKCECallback` finds no verifier, so the URL is ignored silently. The account is still confirmed server-side by the verify endpoint and password sign-in then works. This is CAP-13's intent, and it reaches no user today — `grep` over `src/components/` finds no caller of `signUp` and no `/reset-password` route, so neither exported function has a UI entry point.

**Local mail rate limit is not enforced.** `supabase/config.toml` sets `[auth.rate_limit] email_sent = 2` per hour and notes it requires `auth.email.smtp`; the built-in Mailpit catcher is not that. Three consecutive `signInWithOtp` sends all returned no error. `tests/api/pkce-code-exchange.spec.ts` still sends exactly one per run so it stays inside the limit if a future stack enforces it.

**Real code exchange on the local stack.** `signInWithOtp` produced a `pkce_`-prefixed verify token; following `/auth/v1/verify` returned **HTTP 303** to `…?code=<uuid>` with no `access_token` anywhere in the location. A client with no verifier was refused with `AuthPKCECodeVerifierMissingError` and **zero** `grant_type=pkce` requests, so the single-use code survived; a client holding a wrong verifier reached the server and was refused there; the initiating client then exchanged the same code for a session belonging to that account.

**Red-then-green, reproduced against the exact mutation.** Removing only the `flowType` line and rerunning: the two browser cases fail because the app never reaches the login screen (signed out) and never reaches `app-container` (signed in — the victim lands on the display-name setup overlay, which is what being switched to the attacker's brand-new account looks like), and three unit cases fail on the fetch-count and `code_challenge_method` assertions. Restoring the line makes all of them pass.

**Production bundle.** `fnox exec -- npm run build` exits 0 and `dist/assets/index-*.js` contains `detectSessionInUrl:!0,flowType:\`pkce\`` — the option reaches the shipped artifact, not just the source.

**Not verified in this session:** the hosted redirect-URL allow list (above), and the deployed site itself — this change ships to Pages through `.github/workflows/deploy.yml` and was not deployed here.

## Verification

**Commands:**
- `npm ci` — expected: exit 0; `node_modules/` is absent in a fresh worktree (already run this session).
- `npm run test:unit` — expected: green, with the new `supabaseClientAuthFlow` cases and `src/api/auth/__tests__/authServices.test.ts` still passing.
- `npx playwright test tests/e2e/auth tests/api/pkce-code-exchange.spec.ts` — expected: all pass against the running local stack (`supabase status` shows `API_URL=http://127.0.0.1:54321`).
- `npm run lint && npm run typecheck` — expected: 0 errors (3 pre-existing `EventCountdown.tsx` warnings are baseline).
- `fnox exec -- npm run build` — expected: exit 0.
- Red-then-green: revert `flowType` alone and confirm the new unit cases fail on the fetch-count assertion and the E2E signed-in case fails on the user id.

**Manual checks (if no CLI):**
- `git diff src/api/supabaseClient.ts` — expected: one added `flowType` line plus the reworded comment, and nothing else.
- `curl -s -H "apikey: $VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY" "$VITE_SUPABASE_URL/auth/v1/settings"` under `fnox exec` — expected: `google: true`, `mailer_autoconfirm: false`; record verbatim.

## Auto Run Result

Status: done

**Summary:** The app's Supabase client ran on the SDK's default `implicit` flow, so `detectSessionInUrl` treated any `#access_token=...` link as a login callback and a victim who clicked one was silently switched to the attacker's identity — store auth state, the Realtime channels keyed on `userId`, and the Background-Sync token all rebinding to it. `flowType: 'pkce'` makes the SDK refuse a foreign fragment before any network call and accept only a `?code=` whose verifier this browser stored. The production change is one option; the work is the evidence. This follow-up review pass changed no production code: it hardened the evidence and scoped the CI change that the evidence needed.

**Files changed (this pass):**
- `.github/actions/setup-supabase/action.yml` — a `needs-mail` input (default `false`); `mailpit` is appended to the exclusion list unless a job asks for it, so the documented pull saving survives for the nine jobs that never read mail.
- `.github/actions/setup-playwright-e2e/action.yml` — forwards `needs-mail` to the action above.
- `.github/workflows/test.yml` — `needs-mail: ${{ matrix.project == 'api' }}` on `backend-tests`, the only leg whose specs read a real auth email.
- `tests/api/pkce-code-exchange.spec.ts` — the mail-catcher guard now gates only the case that reads mail and throws rather than skips in CI; the verifier assertions exclude the SDK's flow-index key and pin the legacy slot the exchange actually reads; the verify redirect accepts any 3xx; cleanup pages past the default 50.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` — the redemption case now parses the exchange request body and asserts both `auth_code` and the exact `code_verifier` the starting client wrote; the two verifier lookups exclude the flow index.
- `tests/e2e/auth/implicit-fragment-rejection.spec.ts` — the `sw-auth` assertion is now "not the attacker's, and one of `[null, workerUserId]`", with both admissible values and their causes recorded at the call site.
- `tests/e2e/auth/google-oauth.spec.ts` — the authorize request is awaited rather than assumed to have happened by the time the assertions run.
- `_bmad-output/specs/spec-security-remediation/rollout.md` — the standing CAP-2/CAP-3 rollout guidance moved back above the per-story status blocks, which had displaced it twice.

**Review findings:** 36 reported — 0 high, 8 medium, 17 low, 10 false, 1 maybe-false. Nine entries patched (2 medium, 7 low after grouping), three deferred, ten rejected on their refutations, and four carried unchanged from the previous pass's log. The two medium root causes were both about evidence that could stop running without going red. First, the mail-catcher guard: `setup-supabase` exports `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` through `$GITHUB_ENV` while `MAILPIT_URL` comes only from `playwright.config.ts`'s `supabase status` parse, so a parse failure in CI would leave every other api spec passing while both PKCE `[P0]` cases silently skipped — including the signup case, which reads no mail at all. That refutes the previous pass's stated reason for leaving the skip at describe scope. Second, the CI change made to serve those cases removed `mailpit` from an exclusion list shared by ten jobs, re-spending the pull saving whose own comment records run 32268765187 dying on `toomanyrequests`; it is now opt-in per job. The rejected findings are each recorded with their refutation above — chiefly that the browser cases carry real foreign tokens and so do not need the unit suite's fetch-count discriminator, that `resetPassword`'s second redirect target has no call site anywhere in `src/`, and that the two SDK line citations are the same throw at two granularities. Patched counts by verdict: high 0, medium 2 entries, low 7 entries.

**Follow-up review recommendation:** false. This was itself a follow-up pass and it patched no `high`, so the work has converged. The previous pass's `true` named one unverified risk — the CI change made blind — and that risk is now smaller rather than larger: the change is scoped to a single job and the two specs it serves fail loudly in CI instead of skipping. It remains unexecuted on a GitHub runner from here.

**Verification performed (all after the patches):**
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (3 pre-existing `EventCountdown.tsx` warnings).
- `npm run test:unit`: 111 files, **2008** tests pass.
- `npx playwright test tests/e2e/auth tests/api/pkce-code-exchange.spec.ts`: **25 passed**, 2 skipped (pre-existing), both PKCE `[P0]` cases among them.
- `npx playwright test tests/e2e/auth/implicit-fragment-rejection.spec.ts tests/e2e/auth/google-oauth.spec.ts`: 4 passed — the two patched specs specifically.
- `fnox exec -- npm run build`: exit 0, and `dist/assets/index-*.js` still contains `detectSessionInUrl:!0,flowType:` + `` `pkce` ``.
- `python3 -c "yaml.safe_load(...)"` over `setup-supabase/action.yml`, `setup-playwright-e2e/action.yml` and `test.yml`: all parse.
- The strengthened redemption assertion is evidence in itself: the case still passes, so the SDK does put the stored verifier in the exchange body rather than merely addressing the PKCE grant.

**Residual risks:**
- The CI change is still unexecuted from this session. It is now two composite-action inputs and one `matrix.project == 'api'` expression; if the input does not reach `supabase start`, the failure is a mailpit container that either starts everywhere (the previous state) or nowhere, and in the latter case `Backend Tests (api)` fails loudly on the new CI throw rather than skipping.
- The deployed site remains unverified: no real Google consent round-trip, and the hosted redirect-URL allow list could not be read. Recorded in `deferred` and `rollout.md`; the story is not operationally closed until one real Google sign-in lands after `deploy.yml` ships this.
- Newly recorded this pass: the production `/My-Love/` base path is asserted nowhere, because every test origin serves `BASE_URL` as `/`; a declined-consent `#error=` callback is as silent as a missing-verifier one; and whether an installed PWA returns from consent into the verifier's own storage partition is unmeasured.
- Carried from the previous pass: two sign-ins started concurrently in different tabs leave the first unredeemable (fails closed, retry works), and private-window or blocked-site-data browsers lose the verifier across the provider redirect.
