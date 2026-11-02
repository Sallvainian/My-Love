---
title: 'DW-383: session expiry measured on the device clock'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'bae10e51b9d10591b0720f1bedd931c5adf0a90f'
route: 'full'
route_source: 'auto'
risk: 'medium'
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

**Problem:** GoTrue token responses carry `expires_at` stamped by the server's clock. On a device whose clock runs days ahead, every new session already looks expired, so supabase-js refreshes in a loop until GoTrue answers 429, and `_callRefreshToken` then calls `_removeSession()` and emits SIGNED_OUT (DW-383, seen on the owner's iPhone 2026-11-02).

**Approach:** Owner decision 2026-11-02 (fix-device-relative-expiry): in `createSessionGuardedFetch`, remove `expires_at` from session-shaped JSON responses of the auth server, so auth-js `_sessionResponse` (@supabase/auth-js 2.118.0 `lib/fetch.js:140`) computes it as device-now + `expires_in`. The server still validates tokens on its own clock.

## Boundaries & Constraints

**Always:** Only rewrite responses to requests under the project's `/auth/v1/` path that are 2xx, JSON, and whose top-level body has `access_token`, `refresh_token` and `expires_in` (auth-js `hasSession`) plus an `expires_at`. Keep status, statusText and every other header and body field; drop a stale `Content-Length`. Return the original `Response` object untouched in every other case, including an unparsable body. Leave the data-request refusal behaviour exactly as it is.

**Never:** Do not patch `node_modules` or fork auth-js; do not change session storage, `readStoredSession`, or `sessionService.ts`; do not intercept 429 refreshes (the owner chose this fix instead); do not edit the deferred-work ledger.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Token response | 200 JSON from `/auth/v1/token?grant_type=…` with `expires_at` | Same body without `expires_at`; other fields intact | No error expected |
| Non-session auth JSON | 200 JSON from `/auth/v1/user` (no tokens) | Original response object returned | No error expected |
| Auth error | 4xx/5xx JSON (e.g. 429) | Original response object returned | auth-js handles it as before |
| Non-JSON / empty | 204 logout, text body | Original response object returned | No error expected |
| Unparsable JSON | content-type JSON, body `{bad` | Original response object returned, body still readable | Swallowed; no throw |
| Outside project / data path | `rest/v1`, other origin | Unchanged (data guard rules unchanged) | As today |

</intent-contract>

## Code Map

- `src/api/authStorage.ts` -- `createSessionGuardedFetch`: `dataRequestPath` already classifies auth vs data paths of the project; extend it (or add a sibling) to know "auth request of this project", then post-process `fetchImpl`'s promise for those. Module must not import `supabaseClient.ts`. Update the JSDoc to describe the new duty.
- `src/api/supabaseClient.ts:92-104` -- wiring (`global.fetch`); supabase-js hands this fetch to the auth client. Update the comment only if it now misdescribes the guard; no behaviour change here.
- `src/api/__tests__/authStorage.test.ts` -- existing guard tests; `sent` is a shared text `Response` asserted with `toBe(sent)` on auth paths, so non-session responses must come back as the same object.
- auth-js 2.118.0 (resolved from `/Users/sallvain/Projects/My-Love/node_modules/@supabase/auth-js`): `lib/fetch.js` `_sessionResponse`/`hasSession`; `GoTrueClient.js` `__loadSession` (≈2537, refreshes when `expires_at*1000 - Date.now() < EXPIRY_MARGIN_MS`). Read-only.

## Tasks & Acceptance

**Execution:**
- [ ] `src/api/authStorage.ts` -- for project `/auth/v1/` requests, await `fetchImpl`; when the response is ok, JSON, and its clone parses to a session-shaped object with `expires_at`, return `new Response(JSON.stringify(bodyWithoutExpiresAt), { status, statusText, headers })` with `Content-Length` removed; otherwise return the original -- auth-js then derives expiry from `expires_in` on the device clock.
- [ ] `src/api/__tests__/authStorage.test.ts` -- unit tests for every matrix row against the guard directly; plus an integration test: `createClient` from `@supabase/supabase-js` with `global.fetch` = the guard over a fake GoTrue, in-memory `auth.storage`, `autoRefreshToken: false`, `detectSessionInUrl: false`; `vi.useFakeTimers({ toFake: ['Date'] })` with the system time 5 days ahead of the fake server's clock; the fake `/token` answers `expires_in: 3600` and `expires_at` = server-now + 3600 (days in the past for the device), and answers `grant_type=refresh_token` with 429 `over_request_rate_limit`. Sign in with password, call `getSession()` several times, then assert zero refresh requests, no SIGNED_OUT event, the session still returned and stored, and stored `expires_at` ≈ device-now + 3600.

**Acceptance Criteria:**
- Given a device clock 5 days ahead and a GoTrue that stamps `expires_at` from its own clock, when the person signs in and the app reads the session repeatedly, then no refresh request is sent, SIGNED_OUT is never emitted, and the session stays stored.
- Given the guard with the fix reverted, when the same integration test runs, then it fails (refreshes happen and/or SIGNED_OUT fires) — checked once by hand during implementation and recorded in Implementation Notes.

## Implementation Notes

- `createSessionGuardedFetch` now post-processes every project `/auth/v1/` response through `withoutServerExpiry`; the data-request refusal is unchanged (`dataRequestPath` split into `projectPath` + `isAuthPath`).
- Revert check done by hand: with the `.then(withoutServerExpiry)` removed, 3 tests fail (the two unit rewrite tests and the integration test, which got the 429 refresh error), restored afterwards.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 0, maybe-false 1
- findings:
  - `[low]` `[reject]` Design Notes say a device clock behind real time refreshes late; with expiry derived from `expires_in` on the device clock, it no longer does — real, but the fix is an edit to this build's plan, which triage rejects.
  - `[low]` `[reject]` Execution checkboxes still `[ ]` while the plan is in review — the fix is an edit to this build's plan, which triage rejects.
  - `[maybe-false]` `[patch]` Integration test never tears down the `createClient`: auth-js opens a `BroadcastChannel(storageKey)` (GoTrueClient.js:267-277, no public close) and the auth-state subscription stays live — whether it ever hangs a worker or logs after teardown was not shown (the full suite exited 0), but the fix is direct test cleanup; patched: `BroadcastChannel` stubbed to `undefined` before `createClient`, subscription unsubscribed and globals unstubbed in `afterEach`.
  - `[low]` `[patch]` `authStorage.test.ts` header JSDoc described only the data-request refusal — patched: header now also names the `expires_at` removal (DW-383).
  - `[low]` `[patch]` `supabaseClient.ts` wiring comment described the guard only as a refusal — patched: two comment lines say the same fetch removes `expires_at` from auth session responses; no code change.

## Design Notes

Stripping rather than re-basing keeps one source of truth: auth-js already falls back to `expiresAt(expires_in)` when `expires_at` is absent, so the wrapper changes no auth-js behaviour beyond which clock the expiry is measured on. A device clock behind real time is the mirror case: the client refreshes late, the server rejects the stale JWT with 401 (data requests) as it would anyway.

## Verification

**Commands:**
- `npx vitest run src/api/__tests__/authStorage.test.ts` -- expected: all pass
- `npm run typecheck` -- expected: exit 0 (worktree TS2883 baseline errors, if any, unchanged)
- `npx eslint src/api/authStorage.ts src/api/__tests__/authStorage.test.ts` -- expected: no errors
- `npm run test:unit` -- expected: all pass

## Auto Run Result

Status: built

**Summary:** DW-383 — `createSessionGuardedFetch` now removes `expires_at` from the auth server's successful, JSON, session-shaped responses (`access_token`, `refresh_token`, `expires_in` present), so auth-js `_sessionResponse` sets `expires_at` = device-now + `expires_in`. A device clock days ahead no longer sees every new session as expired, so it no longer refresh-loops into a 429 and SIGNED_OUT. Every other response is returned as the original object; the data-request refusal is unchanged.

**Files changed:**
- `src/api/authStorage.ts` — `isSessionBody` and `withoutServerExpiry`; project `/auth/v1/` responses go through it; JSDoc updated.
- `src/api/__tests__/authStorage.test.ts` — unit tests for every I/O matrix row, plus an integration test with a real supabase-js client, a fake GoTrue, and a device clock 5 days ahead (no refresh request, no SIGNED_OUT, session stored, `expires_at` ≈ device-now + 3600).
- `src/api/supabaseClient.ts` — wiring comment only.

**Review (quick lens, 5 findings):** 3 patched (test teardown of the SDK client, test header JSDoc, wiring comment), 0 deferred, 2 rejected (plan Design Notes clock-behind sentence and unticked Execution checkboxes — both fixes would edit this build's plan). Patched counts by verdict: high 0, medium 0, low 2, maybe-false 1.

**Follow-up review recommended:** false — no high or medium entry was patched.

**Verification:** `npx vitest run src/api/__tests__/authStorage.test.ts` 29 passed; `npx eslint` on the three files clean; `npm run typecheck` exit 0; `npm run test:unit` 224 files / 3793 tests passed, exit 0. Revert check run by hand twice (implementer and orchestrator): removing `.then(withoutServerExpiry)` fails 3 tests, including the integration test.

**Residual risks:** Not exercised on a real device or against hosted GoTrue; the change relies on auth-js 2.118.0 falling back to `expires_in` when `expires_at` is absent (`lib/fetch.js:140`), so an auth-js upgrade that stops doing so would be caught by the integration test. The plan's Design Notes sentence about a clock running behind is inaccurate (rejected review finding): with this change a slow clock no longer refreshes late either.
