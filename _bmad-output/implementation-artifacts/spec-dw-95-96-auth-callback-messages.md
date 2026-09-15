---
title: 'Surface the two silent OAuth callback outcomes on the login screen'
type: 'bugfix'
created: '2026-09-14'
status: 'done'
baseline_revision: '6b4cae36dc647844be9b93622b1620aa5ab90997'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      A `?code=` whose exchange fails in the browser that started the flow -- the ordinary
      expired-or-reused code -- still ends on the login screen with nothing to read.
    evidence: |-
      `getAuthCallbackOutcome` returns null for it (`src/api/supabaseClient.ts:161`, the
      `error ||` half of the guard), and a unit case now pins that answer. Pre-existing: every
      callback was silent before this change, and the bundle scoped the fix to exactly two
      outcomes, so naming a third is a product decision rather than a correction. Probably the
      most common real callback failure. Settle by deciding whether a third recoverable message
      is wanted and what it should say.
    location: >-
      src/api/supabaseClient.ts:161
    severity: medium
  - summary: >-
      A password sign-in that resolves with neither an error nor a session leaves the login
      screen with no feedback at all, and now also clears the callback notice.
    evidence: |-
      `LoginScreen.handleSubmit` branches on `result.error` then `result.session`
      (`src/components/LoginScreen/LoginScreen.tsx:88-103`) with no else, and
      `setNoticeDismissed(true)` has already run. The dead-end branch predates this change; the
      change only adds the cleared notice. Unverified: nothing was found that makes
      `signInWithPassword` answer with neither, so the state may be unreachable. Settle by
      checking whether any GoTrue path (MFA challenge, unconfirmed identity) returns a null
      session with a null error, and adding an else branch if so.
    location: >-
      src/components/LoginScreen/LoginScreen.tsx:88-103
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Two OAuth callbacks end on the login screen with no explanation. A returning `?code=` that finds no PKCE verifier in this browser is classified as not-a-callback (`GoTrueClient.js:3356-3366`), so `_initialize` falls through to `_recoverAndRefresh` and returns `{ error: null }`; a provider denial (`#error=…`) makes `_getSessionFromURL` throw `AuthImplicitGrantRedirectError` at `:3252-3259`, which `_initialize` returns at `:417`. Nothing in `src/App.tsx:233-350` reads that return value, and `checkAuth` at `:238-261` calls only `getSession()`, so both outcomes are invisible (DW-95, DW-96).

**Approach:** Read the SDK's `initialize()` outcome once, classify it into one of two recoverable outcomes with a single shared handler, and render the matching message on one surface — the login screen. Detection uses only what the SDK already produced: the returned `AuthError` for the denial, and a `code` query parameter captured at module load for the missing verifier. No `exchangeCodeForSession` call of our own.

## Boundaries & Constraints

**Always:** Keep the `auth` options in `src/api/supabaseClient.ts:58-73` (`persistSession`, `autoRefreshToken`, `detectSessionInUrl: true`, `flowType: 'pkce'`) and the `realtime` block exactly as they are. Capture the returning `code` parameter synchronously in the same module body as `createClient`, before the SDK's async `_initialize` can strip it on a successful exchange. Both outcomes share one classifier and one rendered surface. Messages must be recoverable in tone — signing in again from this browser works in both cases. New unit cases must keep driving the real installed SDK through the app's own module, and must keep their existing session and `fetch`-count assertions alongside the new outcome assertion.

**Never:** Add an `exchangeCodeForSession` call of our own, a second `createClient`, a signup/password-recovery screen, or a route. Surface anything for a foreign implicit token fragment — story 3's silent refusal of `#access_token=…` is the security behaviour and must stay silent. Change the callback classification itself, `detectSessionInUrl`, or `flowType`. Touch `src/api/auth/sessionService.ts`'s token persistence, Realtime code, or the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Provider denial | App loaded at `/#error=access_denied&error_code=403&error_description=Denied` | Outcome `cancelled`; login screen shows a "sign-in was cancelled" notice | `AuthImplicitGrantRedirectError` read from `initialize()`, never thrown |
| Code callback, no verifier | `/?code=anything` with no PKCE verifier in this browser | Outcome `needs-original-browser`; login screen shows a "finish sign-in in the browser you started in" notice; stored session (if any) untouched; zero `fetch` calls | `initialize()` returns `{ error: null }`; the captured `code` plus the absent session are the discriminator |
| Code callback redeemed | `/?code=…` for a flow this browser started | Outcome `null`; no notice; session established | No error expected |
| Foreign implicit fragment | `/#access_token=…&refresh_token=…&expires_in=3600&token_type=bearer` | Outcome `null`; nothing rendered; zero `fetch` calls; stored session preserved | `AuthPKCEGrantCodeExchangeError` returned and deliberately not surfaced |
| Ordinary load | `/` with no callback parameters | Outcome `null`; login screen unchanged | No error expected |
| Sign-in attempt after a notice | Notice visible, person submits the form or clicks Continue with Google | Notice is replaced by that attempt's own feedback | Existing error mapping unchanged |
| Signed out again after a notice | Notice was shown, person signs in, then signs out | Login screen shows no notice | No error expected |

</intent-contract>

## Code Map

- `src/api/supabaseClient.ts:55-80` — the single `createClient` in `src/`, and already the home of session-shaped helpers (`SessionLookup` type at `:96`, `lookupSignedInUser` at `:110`). Add the module-scope `code` capture immediately after `createClient` and the `getAuthCallbackOutcome()` classifier next to `lookupSignedInUser`. The capture is safe there and only there: `GoTrueClient`'s constructor calls `this.initialize()` at `:294`, whose `_initialize` runs synchronously only as far as `await this._isPKCECallback(params)` (`:389`), so the module body continues before any URL rewrite.
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` (2.116.0, verified on this tree) — `:344-375` `initialize()` memoises `initializePromise`, so calling it again returns the same `InitializeResult` and starts nothing new. `:383-447` `_initialize()`: `:405` returns `{ error }` from `_getSessionFromURL`, `:434` returns `{ error: null }` after `_recoverAndRefresh`. `:3252-3259` throws `AuthImplicitGrantRedirectError` for any `error`/`error_description`/`error_code` parameter **before** the flowType switch; `:3260-3273` under `flowType: 'pkce'` an implicit callback throws `AuthPKCEGrantCodeExchangeError` instead, which is why `isAuthImplicitGrantRedirectError` isolates the denial exactly. `:3284-3286` deletes `code` from the URL only after a successful exchange. `:3356-3367` `_isPKCECallback` requires a stored verifier. `:2412-2413` `getSession()` awaits `initializePromise`.
- `@supabase/supabase-js` re-exports auth-js at runtime (`dist/index.d.mts:7` `export * from "@supabase/auth-js"`); `isAuthImplicitGrantRedirectError` and `AuthError` are both importable from it — verified with `node -e "import('@supabase/supabase-js')…"`.
- `src/App.tsx:233-350` — the bootstrap effect. `checkAuth` at `:238-261` is where the outcome is read; the auth-state-change handler's session branch at `:313-330` is where it must be cleared so a later sign-out cannot re-show a stale notice. `:566-577` renders `<LoginScreen>` and is the only place the prop is passed. `:118-119` holds the `session`/`authLoading` state the new state sits beside.
- `src/components/LoginScreen/LoginScreen.tsx:25-30` props and local state; `:107-133` the container and the existing `.login-error` banner *inside* the `<form>`; `:41-43` and `:87-89` the two handlers that already `setError(null)` on a new attempt. `:108` `data-testid="login-screen"` is every E2E's anchor.
- `src/components/LoginScreen/LoginScreen.css:63-93` `.login-error` — the banner to model the new notice on. It has no `prefers-color-scheme: dark` override (`:310-367` lists every dark rule), so a light banner on the dark card is the established pattern.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` — drives the real SDK through the app's own module with `window.happyDOM.setURL` before import. `:162-174` and `:176-186` are the two cases pinning today's silence. `:100-135` `beforeEach`/`afterEach` already reset modules, clear `localStorage`, reject all `fetch`, and `stopAutoRefresh()` every client. `:268-337` is the redeemed-code case to extend with a `null` assertion.
- `tests/e2e/auth/login.spec.ts:9-22` — `test.use({ authSessionEnabled: false })` plus `page.goto('/')`, the signed-out pattern the new E2E copies. `tests/support/merged-fixtures.ts` is the only allowed `test`/`expect` import.
- `src/api/auth/sessionService.ts` — unchanged. It owns token persistence; nothing here belongs in it.

## Tasks & Acceptance

**Execution:**
- `src/api/supabaseClient.ts` — edit — export `type AuthCallbackOutcome = 'cancelled' | 'needs-original-browser' | null`, capture `const returnedWithCode = new URLSearchParams(window.location.search).has('code')` directly after `createClient` (with a comment naming the synchronous-window guarantee above), and add `getAuthCallbackOutcome(): Promise<AuthCallbackOutcome>` that awaits `supabase.auth.initialize()`, returns `'cancelled'` when `isAuthImplicitGrantRedirectError(error)`, returns `'needs-original-browser'` when `returnedWithCode` and `error` is null and `getSession()` yields no session, and `null` otherwise.
- `src/App.tsx` — edit — hold the outcome in state, set it in `checkAuth` from one `getAuthCallbackOutcome()` call guarded by the existing `isMounted`/`hasAuthNotification` checks, clear it in the auth-state-change session branch, and pass it to `<LoginScreen>`. No other behaviour moves.
- `src/components/LoginScreen/LoginScreen.tsx` — edit — accept an optional `callbackOutcome` prop, map it to the two messages beside the existing error copy, and render it above the form in a `data-testid="login-notice"` region with `role="status"`. Both existing handlers suppress it when a new sign-in attempt starts.
- `src/components/LoginScreen/LoginScreen.css` — edit — add `.login-notice`, modelled on `.login-error` but in an informational palette with a text/background contrast ratio of at least 4.5:1, and no `shake` animation.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` — edit — replace the two silence-pinning cases: the missing-verifier case additionally asserts `getAuthCallbackOutcome()` is `'needs-original-browser'`, and the error-callback case asserts the `AuthError` returned by `initialize()` and an outcome of `'cancelled'`. Both keep their session and `fetch`-count assertions. Extend the redeemed-code case and the foreign-fragment case to assert `null`, so a successful sign-in and a refused fragment both stay silent.
- `tests/unit/components/LoginScreen.callbackNotice.test.tsx` — create — render `LoginScreen` for each outcome and for `null`, asserting the distinct copy, the absent region when `null`, and that starting a sign-in attempt clears it. Mock `../../../src/api/auth/actionService` so no client is built.
- `tests/e2e/auth/callback-messages.spec.ts` — create — `test.use({ authSessionEnabled: false })`, two `[P1]` cases loading `/#error=access_denied&error_code=403&error_description=Denied` and `/?code=not-for-this-browser`, each asserting `login-screen` is visible and `login-notice` carries the matching message. Import from `tests/support/merged-fixtures.ts`.

**Acceptance Criteria:**
- Given a person who returns from the provider to the signed-out app, when the callback carries a denial or an unusable code, then the login screen shows one message naming that outcome and no message appears for any other load.
- Given `npm run lint`, `npm run typecheck` and `npm run test:unit`, when they run, then all pass with the new specs included and every pre-existing auth test still green.
- Given `npx playwright test tests/e2e/auth` against the local stack, when it runs, then all pass, including the unchanged login, logout and fragment-rejection cases.
- Given `fnox exec -- npm run build`, when it runs, then it exits 0.

## Spec Change Log

- **`App.tsx` guard: `hasSessionNotification`, not `hasAuthNotification`.** Execution said to guard the
  outcome set with "the existing `isMounted`/`hasAuthNotification` checks". Measured: the SDK emits
  `INITIAL_SESSION` as soon as the listener subscribes, and on both target loads it carries no session
  and still lands first, so `hasAuthNotification` is already `true` when `getAuthCallbackOutcome()`
  resolves and the notice never renders. Confirmed in a browser before changing anything — instrumented
  `checkAuth` logged `outcome cancelled isMounted true hasAuthNotification true` while the login screen
  showed nothing. A second flag, set only in the listener's session branch beside the clear, keeps the
  intended supersession ("a session retires the outcome") without the false positive.
- **The missing-verifier unit case is two cases, not one.** Execution said the existing
  `ignores a code callback when this browser holds no verifier` case should assert
  `'needs-original-browser'`, but that case seeds a stored session, and the classifier in Design Notes
  returns `null` whenever `getSession()` yields one — correctly, since a recovered session lands in the
  app, not on the login screen. Kept that case with its session and fetch assertions plus a `null`
  assertion and the reason, and added a signed-out sibling
  (`tells a signed-out visitor a code callback belongs to another browser`) carrying the
  `'needs-original-browser'` assertion the spec asked for, with its own session and fetch-count
  assertions.
- **Two coverage additions beyond the Execution list**, both pinning I/O-matrix rows that nothing else
  would have caught: a unit case `says nothing on an ordinary load`, and an E2E control case
  `[P1] shows no notice on an ordinary signed-out load`. Without them a notice rendered unconditionally
  would pass every other case.
- **`tests/unit/App.callbackNotice.test.tsx` created** (not in the Execution list) to cover matrix row 7,
  "Signed out again after a notice", which nothing reached: the Execution list puts the notice's
  *rendering* in a LoginScreen spec and the *classification* in the client spec, but its *lifetime* lives
  in two lines of `App.tsx` that no spec touched. Keeps the real `LoginScreen` — the sibling
  `App.eventsSession.test.tsx` mocks it wholesale — and borrows that file's mock set for the signed-in
  shell. Four cases; each of the two lines is pinned by exactly one, verified by deleting it:
  removing `setCallbackOutcome(null)` from the session branch fails only
  `leaves the login screen clean when the person signs out after a notice`, and dropping the
  `hasSessionNotification` guard fails only
  `does not revive a notice from an outcome that resolves after a session`.
- **`tests/unit/App.eventsSession.test.tsx` mock extended** with `getAuthCallbackOutcome`. It is the only
  unit spec that renders `App`, and it mocks `src/api/supabaseClient` wholesale, so without the entry
  `checkAuth` throws before it settles the session and all 24 of its cases fail. No behaviour of that
  spec changes.

## Review Triage Log

### 2026-09-14 — Review pass
- verdicts: 31 findings — high 0, medium 5, low 20, false 4, maybe-false 2
- findings:
  - `[medium]` `[defer]` (blind-hunter) An expired or already-used `?code=` in the browser that started the flow is still silent — verified by the verification-gap layer's own probe (`AuthApiError`, null session, `?code=` retained). Pre-existing silence; the bundle scoped the fix to two outcomes, so a third message is a product decision. Deferred with severity medium.
  - `[low]` `[reject]` (blind-hunter) Every URL-borne provider error reads "cancelled", including `otp_expired` — real, but DW-96's decision explicitly maps any error callback to one cancelled message, this app has no reachable signup or password-reset UI, and the dominant `#error=` is a genuine Google denial where the copy is correct. Differentiating needs a third outcome, so not a direct correction.
  - `[low]` `[reject]` (blind-hunter) Callback parameters are never stripped, so a reload re-shows the notice — real and minor; the notice then matches what the URL still says. A `history.replaceState` would add a side effect interacting with `navigationSlice`'s popstate handling, which is more than a direct correction for a low.
  - `[false]` `[reject]` (blind-hunter) `noticeDismissed` fires before validation, so a stray Enter on an empty form destroys the notice — refuted: `LoginScreen.tsx:224` disables the submit button whenever either field is empty, so implicit submission cannot fire there. With both fields filled, a validation failure is the attempt's own feedback, which is matrix row 6's specified behaviour.
  - `[low]` `[patch]` (blind-hunter) `.notice-icon` repeats `.error-icon`'s three declarations verbatim (`:89` and `:117`) — patched: `.notice-icon` added to the existing `.error-icon` selector list and the duplicate block deleted.
  - `[low]` `[reject]` (blind-hunter) The dark-mode comment justifies the missing override by appealing to an absence — the comment describes the file's actual state accurately, and adding a dark rule for the new notice alone would make it inconsistent with `.login-error`, which the comment points at.
  - `[low]` `[reject]` (blind-hunter) `getAuthCallbackOutcome()` re-reads the session `checkAuth` already holds — real redundancy; a race between the two reads resolves toward "no notice", the safe direction. Passing the session in changes the function's signature, which is public surface.
  - `[low]` `[reject]` (blind-hunter) The `role="status"` region mounts already populated, so the announcement is unreliable — true of screen-reader announcement, but the notice is visible static text at the top of a short form and is reached by ordinary navigation. Restructuring the region and its tests is more than a direct correction.
  - `[low]` `[patch]` (blind-hunter) The `needs-original-browser` copy says "sign-in link" though the branch catches every PKCE return — patched: reworded so it no longer asserts a link was opened, keeping the "browser you started in" substring both the component spec and the E2E assert.
  - `[low]` `[reject]` (blind-hunter) `App.callbackNotice.test.tsx` duplicates ~120 lines of mock scaffolding from `App.eventsSession.test.tsx` — real developer-only cost, named accurately. Extracting a shared helper is a refactor, not a direct correction.
  - `[low]` `[reject]` (blind-hunter) `getAuthCallbackOutcome()` has no try/catch, so a rejection logs "Auth check failed" though the session was set — reachable only if `getSession()` rejects; `setAuthLoading(false)` still runs in `finally`, so the cost is a lost notice and one wrong log line. The fix adds a guard for a state not demonstrated reachable.
  - `[low]` `[reject]` (blind-hunter) The spec carries an unexplained `warnings: [oversized]`, an empty triage heading and a stale `npm ci` note — rejected by rule: the fix is to edit this build's spec.
  - `[medium]` `[defer]` (edge-case-hunter) `:150` — a `?code=` with a verifier whose exchange fails stays silent. Same defect as the blind-hunter finding above; deferred with it.
  - `[low]` `[reject]` (edge-case-hunter) `:149` — a non-denial `error_code` reads "cancelled". Same defect and same reasoning as the blind-hunter finding above.
  - `[low]` `[patch]` (edge-case-hunter) `:106` — a `#code=` in the hash is invisible to `returnedWithCode` though `parseParametersFromURL` merges hash parameters before query ones, so the SDK would treat it as a callback. Verified in `auth-js/dist/module/lib/helpers.js`. No provider emits `#code=`, but the disagreement with the SDK is real; patched by reading the hash as well as the query string.
  - `[false]` `[reject]` (edge-case-hunter) `:106,151-152` — a non-auth `?code=` link would be explained as a stranded sign-in — refuted: `grep` over `src/` finds no other reader of a `code` query parameter (the only other query reader is the frozen scripture feature's `fresh`), and the app has no invite or referral feature.
  - `[maybe-false]` `[reject]` (edge-case-hunter) `:151` — a `getSession()` error alongside a null session would be reported as a wrong-browser link. Could not establish that path returns a non-null error with a null session (`__loadSession`'s null-session return is `error: null`). If true it would be low: the mislabel is mild and "sign in again below" is still the correct recovery. Would be settled by finding a real `getSession()` error path that yields a null session.
  - `[low]` `[reject]` (edge-case-hunter) `:147-153` — reload replays the notice and the callback stays in a shareable URL. Same defect as the blind-hunter finding above.
  - `[maybe-false]` `[defer]` (edge-case-hunter) `LoginScreen.tsx:68` — a `signIn` that resolves with neither error nor session leaves the screen with no feedback, and now without the notice either. Could not demonstrate that state. If true it would be medium; the dead-end branch is pre-existing. Deferred with severity medium (unverified).
  - `[false]` `[reject]` (edge-case-hunter) `App.tsx:279` — the guard is `hasSessionNotification`, not the spec's `hasAuthNotification` — refuted as a defect: `GoTrueClient.js:3661-3666` emits `INITIAL_SESSION` to every new subscriber, so the spec's guard would suppress every notice. The deviation is correct, recorded in the Spec Change Log, and explained in a comment at the site.
  - `[low]` `[reject]` (edge-case-hunter) `App.tsx:277-286` — "No other behaviour moves" is violated because `setAuthLoading(false)` now waits on the outcome. Real, and the added wait is one settled memoised promise plus a storage read, because `checkAuth`'s earlier `getSession()` already awaited `initializePromise`. Changing it would break the pinned ordering that renders the notice with the login screen.
  - `[medium]` `[defer]` (edge-case-hunter) `:150` — the AC's "an unusable code" is broader than what is named. Same defect as the expired-code finding; deferred with it.
  - `[false]` `[reject]` (edge-case-hunter) `:151-152` — "no message appears for any other load" is violated by any `code` query parameter. Same refutation as the non-auth `?code=` finding above.
  - `[low]` `[reject]` (edge-case-hunter) `tests/…:185-203` — the spec-to-test mapping does not hold, since the named case asserts `null`. Real as stated, but the behaviour is right (a recovered session means no login screen) and the split is recorded in the Spec Change Log; the only remaining fix would edit this build's spec.
  - `[medium]` `[patch]` (verification-gap) The `error ||` half of the classifier's guard is unpinned: mutating it to `if (!returnedWithCode)` left all 46 tests green, and the reachable state would be told to finish in a different browser. Pre-verified with a probe. Patched: a new case beside the redeemed-code case stubs the pkce grant as a 400 and asserts the outcome is `null`.
  - `[medium]` `[defer]` (verification-gap) A third silent callback remains, now encoded deliberately — same defect as the expired-code finding; deferred with it.
  - `[low]` `[reject]` (verification-gap) `returnedWithCode`'s module-scope placement is unpinned but inert — the layer's own analysis found no input on which the two placements disagree, so there is no regression to catch and no fix to make.
  - `[low]` `[reject]` (intent-alignment) DW-95's named unit case still pins the silence; the behaviour is proved by a new sibling — real and declared. The Intent prose and DW-95's decision clause disagree on whether a recovered session suppresses the message; the diff follows the decision clause, which is the more specific text, and records the split.
  - `[low]` `[reject]` (intent-alignment) No unit test connects a real callback URL to a rendered message; only the E2E joins the chain — accurate, and each boundary is pinned separately. The verification-gap layer confirmed the E2E is in the normal CI path (`test.yml:343`, gated on `^src/` and `^tests/e2e/`). A jsdom test driving a real URL through the real client into React is substantial new surface for a low.
  - `[low]` `[reject]` (intent-alignment) "One shared handler" has two visibility owners: App's clear and LoginScreen's `noticeDismissed` — they own different questions (does this load have an outcome; has the person moved on), both are tested, and collapsing them would change the component's API.
  - `[low]` `[reject]` (intent-alignment) First paint now waits on `getAuthCallbackOutcome()` — same finding and same reasoning as the edge-case layer's "No other behaviour moves" row above.

**Round 1 — four findings, all applied.**

- `getAuthCallbackOutcome`'s `error ||` guard was unpinned. Added
  `says nothing when a code this browser started fails to exchange`: the browser holds the verifier, so
  the exchange is attempted and fails (400), which is the ordinary expired-or-reused code. Mutating the
  guard to `if (!returnedWithCode)` now fails that case and only that case.
- `returnedWithCode` read only `window.location.search`, but the SDK's `parseParametersFromURL`
  (auth-js `lib/helpers.js:66-85`) merges hash parameters before query ones, so a `#code=` was a callback
  to `_isPKCECallback` and an ordinary load to the classifier. Broadened to read hash and query, module
  scope and comment kept. Pinned by `sees a code in the fragment, as the SDK does` — reverting the read
  to search-only fails that case and only that case. **This test is beyond what the review asked for**;
  the fix alone would have shipped unpinned.
- The `needs-original-browser` copy asserted a "sign-in link" had been opened. Reworded to name neither a
  link nor a browser the person still has: "Sign-in could not be finished here — this is not the browser
  you started in, or that sign-in is no longer stored. Just sign in again below." The `browser you
  started in` substring both the component spec and the E2E assert is preserved.
- `.notice-icon` duplicated `.error-icon`'s three declarations; merged into that selector list.

## Design Notes

Why the `code` parameter is captured at module load rather than read after `initialize()` resolves: on a successful exchange the SDK deletes `code` from the URL (`GoTrueClient.js:3284-3286`), so a post-hoc read would be indistinguishable from an ordinary load only by accident of timing. Capturing it in the same synchronous module body as `createClient` makes the discriminator a fact about the URL the page was opened with.

Why `isAuthImplicitGrantRedirectError` is a precise test for "cancelled" and not a broad one: under `flowType: 'pkce'` the only route to that error class from `_getSessionFromURL` is the `error`/`error_description`/`error_code` branch at `:3252-3259`, checked before the flowType switch. A hostile `#access_token=` fragment yields `AuthPKCEGrantCodeExchangeError` instead and therefore stays silent, as story 3 requires.

```ts
export const getAuthCallbackOutcome = async (): Promise<AuthCallbackOutcome> => {
  const { error } = await supabase.auth.initialize();
  if (isAuthImplicitGrantRedirectError(error)) return 'cancelled';
  if (error || !returnedWithCode) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? null : 'needs-original-browser';
};
```

## Verification

**Commands:**
- `npm ci` -- expected: exits 0. This worktree has no `node_modules`; nothing else runs until it does.
- `npm run lint` -- expected: exits 0 with no new warnings.
- `npm run typecheck` -- expected: exits 0.
- `npm run test:unit` -- expected: all pass, including `tests/unit/api/supabaseClientAuthFlow.test.ts` and the new `LoginScreen.callbackNotice` spec.
- `npx supabase start` then `npx playwright test tests/e2e/auth --project=chromium` -- expected: all pass, including the new `callback-messages.spec.ts`.
- `fnox exec -- npm run build` -- expected: exits 0.

## Auto Run Result

Status: done

**Summary.** The two OAuth callbacks that used to end on the login screen in silence now explain
themselves. `getAuthCallbackOutcome()` in `src/api/supabaseClient.ts` reads the SDK's memoised
`initialize()` result once and classifies it into `cancelled` (the provider denied the request) or
`needs-original-browser` (a `?code=` came back with no verifier and no session), `null` otherwise.
`App.tsx` reads it once during bootstrap and passes it to `LoginScreen`, which renders one
`data-testid="login-notice"` region. No `exchangeCodeForSession` call was added and the foreign
implicit fragment story 3 refuses stays silent.

**Files changed**
- `src/api/supabaseClient.ts` — the `returnedWithCode` capture (query and hash), the
  `AuthCallbackOutcome` type, and `getAuthCallbackOutcome()`.
- `src/App.tsx` — `callbackOutcome` state, one read in `checkAuth` guarded by a new
  `hasSessionNotification` flag, cleared in the auth-state-change session branch, passed to `LoginScreen`.
- `src/components/LoginScreen/LoginScreen.tsx` — optional `callbackOutcome` prop, the two-entry copy
  map, the notice region, and dismissal when a sign-in attempt starts.
- `src/components/LoginScreen/LoginScreen.css` — the `.login-notice` rule; `.notice-icon` shares
  `.error-icon`'s declarations.
- `tests/unit/api/supabaseClientAuthFlow.test.ts` — the two silence-pinning cases extended, plus
  signed-out, ordinary-load and failed-exchange cases.
- `tests/unit/components/LoginScreen.callbackNotice.test.tsx` — new; the rendering of each outcome.
- `tests/unit/App.callbackNotice.test.tsx` — new; the notice's lifetime across sign-in and sign-out.
- `tests/e2e/auth/callback-messages.spec.ts` — new; both callbacks and a control, in a real browser.
- `tests/unit/App.eventsSession.test.tsx` — its wholesale `supabaseClient` mock gains the new export.

**Review findings.** 31 findings across four layers — high 0, medium 5, low 20, false 4,
maybe-false 2. Four patched: the unpinned `error ||` guard (a new failed-exchange unit case), the
hash-borne `code` parameter, the `needs-original-browser` copy, and the duplicated icon rule. Two
deferred (both recorded in frontmatter `deferred`): the still-silent failed-exchange callback, and
the unverified no-feedback branch in `handleSubmit`. Every rejected finding carries its refutation
or its reason in the Review Triage Log above; the four `false` verdicts were each checked against
the code rather than argued from the diff.

**Follow-up review recommended: false.** Patched entries were one medium and three low; the rule
asks for a follow-up only on a patched high or two or more patched mediums.

**Verification** (all run in this worktree after the patches landed)
- `npm ci` — exit 0 (the worktree had no `node_modules`).
- `npm run lint` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run test:unit` — 1738 passed, 0 failed.
- `npx playwright test tests/e2e/auth --project=chromium` — 28 passed, 0 failed, against the local stack.
- `fnox exec -- npm run build` — exit 0.
- Matrix test audit: all seven I/O rows are covered by cases that ran and passed. Row 7 ("signed out
  again after a notice") was uncovered on the first pass and is now pinned by
  `tests/unit/App.callbackNotice.test.tsx`; deleting `setCallbackOutcome(null)` reddens exactly that
  case, checked by mutation.
- The `Can't perform a React state update…` console error in the E2E web-server log is pre-existing:
  3 occurrences on baseline `src/App.tsx`, the same 3 with this change.

**Residual risks**
- The deferred failed-exchange silence is the likeliest real callback failure and is still unexplained
  to the person.
- No unit test drives a real callback URL all the way to a rendered message; the chain is joined only
  by the E2E, which runs in a path-gated CI leg (gated on `^src/` and `^tests/e2e/`, both of which
  this change touches).
- Notice visibility has two owners — App's cleared outcome and LoginScreen's local dismissal. Both are
  tested, but a future change to one will not see the other.
