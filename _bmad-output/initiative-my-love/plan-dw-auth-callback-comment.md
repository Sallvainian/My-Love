---
title: 'DW-388: make the auth-check comments agree with getAuthCallbackOutcome for a signed-in error redirect'
type: 'chore'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '54d99343d6a0318cbb914d7c9b9da73e4e16b96a'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `src/App.tsx`'s auth check says "a session present means its outcome is `null`", and `getAuthCallbackOutcome`'s docblock in `src/api/supabaseClient.ts` says the same, but the function returns `'cancelled'` or `'provider-error'` for an implicit-grant error redirect (`#error=…`) before it reads any session. A signed-in person can land on one (the SDK keeps the stored session: `GoTrueClient.js` `_initialize` returns the error without `_removeSession`). DW-388.

**Approach:** Keep the behaviour, correct both comments. Checked against the code, the premise that a signed-in person sees the notice is false: the outcome renders only on `LoginScreen`, which App mounts only with no session, and the session notification every subscription receives (`INITIAL_SESSION` carrying the stored session) clears the outcome, or the `hasSessionNotification` guard keeps it from being stored, so a later sign-out shows a clean login screen. No concrete harm, so no code change. Add an App-level unit test that pins this for a signed-in load whose outcome is `'cancelled'`. The function-level fact (`'cancelled'` with a session kept) is already pinned by `supabaseClientAuthFlow.test.ts` "preserves an existing session for an error callback, and reports the denial".

</intent-contract>

## Implementation Notes

Oneshot: two comment corrections and one unit test, well under 100 lines.

- `src/App.tsx` (the `if (currentSession) setAuthLoading(false)` comment): say that a session means no notice is shown. The outcome can be non-null on an implicit-grant error redirect, but it renders only on the login screen and the session notification retires it.
- `src/api/supabaseClient.ts` (the closing paragraph of `getAuthCallbackOutcome`'s docblock): limit the "session reads `null`" claim to the code-callback branches, and say the implicit-grant error branch answers before any session read, so App relies on the login screen and the session notification for that case.
- `tests/unit/App.callbackNotice.test.tsx`: new case. `getSession` resolves a session and `getAuthCallbackOutcome` resolves `'cancelled'` before any listener call. The app container shows with no `login-notice`. Then the listener gets the session (INITIAL_SESSION), and after a sign-out the login screen has no `login-notice`.

## Verification

**Commands:**
- `npx vitest run tests/unit/App.callbackNotice.test.tsx tests/unit/api/supabaseClientAuthFlow.test.ts`: all pass.
- `npm run typecheck`: exits 0.
- `npx eslint src/App.tsx src/api/supabaseClient.ts tests/unit/App.callbackNotice.test.tsx`: no errors.

Implemented as planned. Files touched: `src/App.tsx`, `src/api/supabaseClient.ts`, `tests/unit/App.callbackNotice.test.tsx`. I mutation-checked the new test: with the session branch's `setCallbackOutcome(null)` removed, it fails, along with the existing sign-out case. With the line back, all 24 tests in the two files pass. `npm run typecheck` and eslint on the three files are clean.

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` Both new comments said the session notification always clears the outcome. A load whose expired token's refresh the server rejects never gets a notification carrying a session, so `'cancelled'` stays and shows after the forced sign-out. — Confirmed against auth-js `_callRefreshToken`: a non-retryable failure with an expired access token runs `_removeSession`. `sessionService.getSession` then answers with the stored session after 1.5 s, while `INITIAL_SESSION` passes `null` once storage is empty. Fixed by narrowing the `src/App.tsx` comment to "once a session notification arrives", naming that path as the one that keeps the notice (the person really is signed out), and softening the `src/api/supabaseClient.ts` docblock to "does not show it while they are signed in".
  - `[low]` `[patch]` The comments named only `#error=`, but `?error=` takes the same branch. — Confirmed: `parseParametersFromURL` merges the query and fragment parameters, and `_isImplicitGrantCallback` tests `params.error`. Fixed by writing "`error=` in the query or the fragment" in both comments and "`error=`" in the test's lead comment.

## Auto Run Result

Status: built

**Summary:** DW-388. App's auth-check comment and `getAuthCallbackOutcome`'s docblock both claimed a present session means a `null` outcome. That is false for an implicit-grant `error=` redirect: the function answers `cancelled` or `provider-error` before it reads a session, and the SDK keeps the stored session. Behaviour is kept and both comments now describe it. Checked against the code, a signed-in person never sees that notice: it renders only on the login screen, and a session notification clears the outcome before any later sign-out. So no code change was warranted. A new App-level unit test pins this for a signed-in load whose outcome is `cancelled`.

**Files changed:**
- `src/App.tsx`: corrected the comment on opening the app with a session.
- `src/api/supabaseClient.ts`: corrected the closing paragraph of `getAuthCallbackOutcome`'s docblock.
- `tests/unit/App.callbackNotice.test.tsx`: new case. A signed-in load with a `cancelled` outcome shows no notice in the shell, and none on the login screen after a sign-out.

**Review findings:** 2 patches applied (both `low`, comment wording). 0 deferred, 0 rejected. Details are in the Review Triage Log.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 2.

**Verification:**
- `npx vitest run tests/unit/App.callbackNotice.test.tsx tests/unit/api/supabaseClientAuthFlow.test.ts`: 24 passed.
- `npm run typecheck`: exit 0.
- `npx eslint` on the three files: exit 0.
- Mutation check: with the session branch's `setCallbackOutcome(null)` removed, the new test fails.

**Residual risks:** There is one path where the outcome survives without a session notification: the server rejects the refresh of an expired stored token on the error-redirect load. There the person sees the notice after being signed out. The `src/App.tsx` comment now documents it as acceptable, and no test covers it.
