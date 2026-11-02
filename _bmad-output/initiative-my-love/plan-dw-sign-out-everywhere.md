---
title: 'DW-353/386/387: sign out everywhere drops every push device, reports a partial sign-out, asks first; send-push prunes stale devices'
type: 'feature'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'a023c1686a5a4bb14c388b7173cc00c7b80506ed'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals', 'oversized']
deferred:
  - summary: >-
      After "Sign out everywhere", another device whose access token has not yet expired can re-register its push_devices row, so a lost phone opened within about an hour keeps receiving pushes until an APNs 410 or the 30-day prune.
    evidence: |-
      Global sign-out revokes refresh tokens, but access tokens stay valid until they expire (supabase/config.toml jwt_expiry = 3600). register_push_device checks only auth.uid() (20261031000000_push_devices.sql), and App.tsx re-registers on every signed-in start with permission. The same happens if a registration lands in the up-to-3 s gap between unregister_all_push_devices() and the global sign-out. Pre-existing: register_push_device never checked whether the caller's session was revoked. Settling it needs a server-side check that the JWT's session_id still exists in auth.sessions, or an owner decision to accept the window.
    location: >-
      supabase/migrations/20261031000000_push_devices.sql (register_push_device); src/api/auth/actionService.ts (signOut, everywhere)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** A `push_devices` row outlives its install or session (reinstall, offline sign-out, session ended elsewhere) and only an APNs 410 removes it; "Sign out of all devices" removes only this device's row, reports success when the global sign-out met a retryable error, and acts on one tap (DW-353, DW-386, DW-387; owner decisions 2026-11-02).

**Approach:** send-push skips and deletes rows whose `updated_at` is older than one month; a new SECURITY DEFINER RPC `unregister_all_push_devices()` deletes all the caller's rows and `signOut({ everywhere: true })` calls it before the global sign-out; `signOut` returns whether the other devices were signed out, and Settings hands a partial result to the login screen as a notice; the Settings row asks first; `sim provision` deletes the six fixture accounts' rows.

## Boundaries & Constraints

**Always:** the RPC is `security definer`, `set search_path = ''`, refuses a NULL `auth.uid()` with `Authentication required`, deletes only `user_id = auth.uid()`, EXECUTE revoked from public/anon and granted to authenticated; "one month" is 30 days (`STALE_AFTER_MS`); a stale delete re-checks `updated_at` so a row re-registered meanwhile survives (reuse `deleteGoneDevice(token, cutoffMs)`, which deletes `updated_at <= cutoff`); this device is signed out on a retryable error exactly as today; the confirmation text is exactly "Sign out on every device? You'll need to sign in again on each one." with buttons "Cancel" and "Sign out everywhere"; Cancel takes initial focus (`useFocusTrap`, as `EventDeleteConfirmation`); regenerate `src/types/database.types.ts` with `npm run db:types`.

**Never:** hand-edit `database.types.ts`; edit the deferred-work ledger; change the plain Sign out row's behaviour; add a new count to send-push's response body (stale prunes count as `gone`, keeping `{ sent, recorded, skipped, failed, gone }`); put the notice in `signedOutState()` or persisted state; call the RPC through `removePushRegistration`'s native/token gate (it must run on the web too).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh device | `updated_at` within 30 days | claimed and sent/recorded as today | unchanged |
| Stale device | `updated_at` older than 30 days | not claimed, not sent; `deleteGoneDevice(token, now-30d)`; counted `gone` | failed delete counted `failed`, others unaffected |
| Everywhere, all ok | RPC ok, global sign-out ok | RPC before `signOut({scope:'global'})`; resolves `{ otherDevicesSignedOut: true }`; no notice | — |
| Everywhere, server unreachable | global sign-out returns `AuthRetryableFetchError` (session stored or already removed) | this device signed out as today; resolves `{ otherDevicesSignedOut: false }` | Settings calls `showSignOutNotice(...)`; login screen shows it |
| Everywhere, RPC fails/times out | RPC error, throw, or 3 s timeout | global sign-out still runs; resolves `{ otherDevicesSignedOut: false }` | logged `[Push] ...` |
| Plain sign-out | `signOut()` | no RPC `unregister_all_push_devices`; resolves `{ otherDevicesSignedOut: true }` | unchanged |
| Row tapped offline | `isOnline()` false | refusal alert, no dialog, no request | — |
| Dialog Cancel / Escape / backdrop | dialog open | dialog closes, no sign-out | — |

</intent-contract>

## Code Map

- `supabase/migrations/20261031010000_unregister_push_device.sql` -- template for the new RPC migration `20261102000000_unregister_all_push_devices.sql`.
- `supabase/tests/database/35_push_devices.sql:201-251` -- unregister pgTAP pattern (helpers declared inline: `create_test_user`, `authenticate_as`, `clear_jwt`); new file `39_unregister_all_push_devices.sql` copies it.
- `supabase/tests/database/18_function_execute_grants.sql:114` -- FN-GRANT-008 exact list: insert `unregister_all_push_devices` (alphabetical, between `register_push_device` and `unregister_push_device`); add an FN-GRANT-016 ok() for its grant; bump `plan(24)`.
- `supabase/functions/send-push/handler.ts:184-187,224,428-485` -- `DeviceRow` gains `updated_at: string`; partition devices before the claim loop; doc block "Gone registrations" mentions the 30-day prune.
- `supabase/functions/send-push/index.ts:128` -- `listDevices` selects `token, environment, updated_at`.
- `supabase/functions/send-push/handler.test.ts:150-160` -- `TWO_DEVICES` and every `DeviceRow` literal need `updated_at`; use a time after both real now and the tests' `now: () => 1800000000000` minus 30 days (e.g. `new Date(1800000000000 - 86_400_000).toISOString()`).
- `src/services/pushNotifications.ts:315-340` -- `removePushRegistration` timeout pattern; add `removeAllPushRegistrations(): Promise<boolean>` beside it (no native/token gate, same 3 s race, true only on `{ error: null }`).
- `src/api/auth/actionService.ts:81-131` -- `signOut`; return type becomes `Promise<SignOutResult>` (`{ otherDevicesSignedOut: boolean }`, exported from `./types`).
- `src/api/auth/__tests__/authServices.test.ts:173-310` -- existing sign-out tests assert `resolves.toBeUndefined()`; update them; `mockRpc` must resolve `{ error: null }` in the everywhere test.
- `src/components/Settings/Settings.tsx:544-566,740-759` -- `handleLogout` and the everywhere row; dialog classes from `../shared/kitClasses` (`DIALOG_BACKDROP`, `DIALOG_PANEL`, `DIALOG_TITLE`, `SECONDARY_BUTTON`, `DESTRUCTIVE_BUTTON`); `useFocusTrap` from `../../hooks/useFocusTrap`; golden example `EventsSettings.tsx:1225-1420`.
- `src/components/Settings/__tests__/Settings.kit.test.tsx:147-184` -- everywhere tests; `backend.signOut` mock.
- `src/components/LoginScreen/LoginScreen.tsx:111-123,253-268` -- `login-notice` block; add the sign-out notice with its own testid `login-sign-out-notice`.
- `src/App.tsx:346-355` -- on a new session, also `clearSignOutNotice()`.
- `scripts/sim-driver/provision.ts:287-323` and its header; `scripts/sim-driver/sim:64-67` help text.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261102000000_unregister_all_push_devices.sql` -- create `public.unregister_all_push_devices() returns void` per Always; header cites DW-353 and the pgTAP files.
- [ ] `supabase/tests/database/39_unregister_all_push_devices.sql` -- pgTAP: grant (anon no, authenticated yes), A's two rows deleted, B's row untouched, NULL uid refused, anon 42501, refused calls delete nothing.
- [ ] `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 list, FN-GRANT-016, plan count.
- [ ] `src/types/database.types.ts` -- `npm run db:types` against the local stack with the migration applied.
- [ ] `supabase/functions/send-push/handler.ts`, `index.ts`, `handler.test.ts` -- stale partition and doc; tests: a stale device is not claimed or sent, `deletedGone` gets `[token, now-30d]`, counted `gone`, fresh one still sent; a stale delete failure counts `failed`.
- [ ] `src/services/pushNotifications.ts` + `src/services/__tests__/pushNotifications.test.ts` -- `removeAllPushRegistrations`; tests: ok → true, error → false + log, timeout → false.
- [ ] `src/api/auth/types.ts`, `src/api/auth/actionService.ts`, `src/api/auth/__tests__/authServices.test.ts` -- everywhere calls `removeAllPushRegistrations()` (instead of `removePushRegistration()`) before the global sign-out; any retryable error or a false RPC result → `otherDevicesSignedOut: false`; tests for the matrix rows, including a retryable error on `{ everywhere: true }` in both the stored-session and already-removed variants.
- [ ] `src/services/signOutNotice.ts` (+ test) -- tiny subscribable: `showSignOutNotice(text)`, `clearSignOutNotice()`, `subscribeSignOutNotice`, `getSignOutNotice`; device UI state, no account data.
- [ ] `src/components/Settings/Settings.tsx` + `Settings.kit.test.tsx` -- row opens the dialog (offline refusal first); confirm runs `handleLogout(true)`; on `{ otherDevicesSignedOut: false }` call `showSignOutNotice("You're signed out on this device, but your other devices could not be signed out. Sign in again when you're online and try Sign out of all devices once more.")`; tests for dialog text/buttons, Cancel, confirm, partial notice, offline refusal.
- [ ] `src/components/LoginScreen/LoginScreen.tsx` + `LoginScreen.kit.test.tsx`, `src/App.tsx` -- show the notice via `useSyncExternalStore` (`role="status"`); clear it on a sign-in attempt (email or Google) and when a session arrives; test shown and cleared.
- [ ] `scripts/sim-driver/provision.ts`, `scripts/sim-driver/sim` -- delete `push_devices` for all six fixture ids via `check(...)`; update header and help text.

**Acceptance Criteria:**
- Given a recipient with one device registered 31 days ago and one today, when a love note is sent, then only today's device gets a `push_requests` row and the old row is gone from `push_devices`.
- Given a signed-in account with rows on three devices, when it confirms "Sign out everywhere", then `push_devices` holds no row for it and its sessions are revoked.
- Given the auth server unreachable, when the person confirms "Sign out everywhere", then this device lands on the login screen showing the partial-sign-out notice.
- Given Settings, when the person taps "Sign out of all devices", then nothing is signed out until they press "Sign out everywhere" in the dialog.

## Implementation Notes

- Implemented by the step-03 subagent from this plan; the parent restored the row-label assertion the old everywhere test made (`Sign out of all devices`) and a blank line in the LoginScreen test.
- The migration was applied with `supabase migration up --local` on the running (possibly shared) stack, not `supabase db reset`; pgTAP and `db:types` ran against it. Types are stable on the pinned CLI 2.122.0.
- `provision.ts` was run once against the local stack by the subagent and printed `push devices deleted for 6 fixture accounts`; it wipes and reseeds the sim fixture accounts, so it was not re-run.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 3 findings — high 0, medium 2, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` send-push `handler.test.ts` `FRESH` (NOW minus one day, 2027-01-14) turns stale on the real clock after about 2027-02-13, so every real-clock test using `TWO_DEVICES` would delete both devices and fail — verified: tests without a `now` override run on `Date.now` through `deps.now ?? Date.now` (handler.ts); patched `FRESH` to `2100-01-01T00:00:00.000Z` and corrected its comment.
  - `[medium]` `[patch]` Settings: the confirm button stays clickable during the dialog's AnimatePresence exit holding the old `onConfirm`, and `handleLogout` had no re-entry guard, so a double tap ran `signOut({ everywhere: true })` twice (two RPCs and global sign-outs; a second RPC without a session would fail and show a false partial notice) — patched with a `signOutRunningRef` re-entry guard, reset only on failure, plus a double-press test that fails without the guard.
  - `[low]` `[patch]` `Settings.kit.test.tsx` in-flight plain Sign out test resolved `signOut` with `undefined`, so the new destructure threw and the test silently ran the failure branch (console.error mocked) — patched to resolve `{ otherDevicesSignedOut: true }`.

### 2026-11-02 — Review pass (follow-up)
- verdicts: 3 findings — high 0, medium 2, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` actionService `signOut({ everywhere: true })`: a non-retryable global sign-out error (a GoTrue 500 or 429) throws, although auth-js `_signOut` removes this device's session before returning any error but 401/403/404 — Settings has unmounted on SIGNED_OUT, so the person lands on the login screen with no partial notice while the other devices stay signed in — verified in auth-js GoTrueClient `_signOut`; patched: when `everywhere` and no session is stored any more, log a warning and resolve `{ otherDevicesSignedOut: false }` instead of throwing (a still-stored session still throws; plain sign-out unchanged); two tests added.
  - `[medium]` `[defer]` A device whose access token is still valid can re-register its push_devices row after the RPC (cold start within jwt_expiry 3600 s, or a registration in the ~3 s gap before the global sign-out), so acceptance criterion 2 holds only at that moment — verified: register_push_device checks only auth.uid() and access tokens outlive a global sign-out; pre-existing in register_push_device and not settled by the intent; recorded in frontmatter `deferred`.
  - `[low]` `[patch]` Settings `SignOutEverywhereConfirmation`: the inline `onCancel` arrow is `useFocusTrap`'s `onEscape` dependency, so every Settings re-render while the dialog is open re-runs the trap and moves focus back to Cancel — verified in `useFocusTrap.ts` deps and initial-focus call; patched with a stable `useCallback` `handleCancelEverywhere`, plus a test that re-renders Settings with focus on "Sign out everywhere" (fails without the fix).

## Design Notes

Settings unmounts the moment `SIGNED_OUT` lands (App renders `LoginScreen` when `session` is null), often before `signOut` resolves, so "Settings tells the person" can only be seen on the screen they land on: Settings, which owns the wording, publishes the notice into a module store and `LoginScreen` subscribes (a mount-time read would miss a notice set after it mounted). The RPC failing also yields a partial result, because a lost phone would keep receiving pushes — the thing "Sign out of all devices" promises to stop. Stale prunes reuse `deleteGoneDevice` and the `gone` count so the response shape, its ~30 test assertions and `tests/api/push-love-note-trigger.spec.ts` stay unchanged. Registration bumps `updated_at` only on a signed-in start with permission (App.tsx:443-449), so a phone not cold-started for 30 days stops getting pushes until it next starts — the owner's accepted trade.

## Verification

**Commands:**
- `npx vitest run src/api/auth src/services/__tests__/pushNotifications.test.ts src/services/__tests__/signOutNotice.test.ts src/components/Settings src/components/LoginScreen` -- expected: all pass
- `deno test --no-lock supabase/functions/send-push/` -- expected: all pass
- `supabase db reset && supabase test db` -- expected: all pgTAP files pass
- `npm run db:types && git diff --stat src/types/database.types.ts` -- expected: only the new function added
- `npm run typecheck && npm run lint` -- expected: clean
- `fnox exec -- node scripts/sim-driver/provision.ts` with `SIM_SUPABASE_URL`/`SIM_SUPABASE_SECRET_KEY` from `supabase status` (or `scripts/sim-driver/sim provision`) -- expected: exits 0 and prints the push-device line

## Auto Run Result

Status: built

**Summary:** Resolves DW-353, DW-386, DW-387. send-push skips and deletes `push_devices` rows not re-registered for 30 days (counted `gone`, so the response shape is unchanged). A new SECURITY DEFINER RPC, `unregister_all_push_devices()`, deletes every row the caller owns, and `signOut({ everywhere: true })` calls it before the global sign-out. `signOut` resolves `{ otherDevicesSignedOut }`, which is false when the global sign-out met a retryable error, when it met any other error after the SDK had already removed this device's session (follow-up pass), or when the RPC failed. On a partial result Settings publishes a notice that the login screen shows. The "Sign out of all devices" row asks first, with the exact wording and the buttons Cancel and Sign out everywhere. `sim provision` deletes the six fixture accounts' push devices.

**Files changed:**
- `supabase/migrations/20261102000000_unregister_all_push_devices.sql`: the new RPC with its grants.
- `supabase/tests/database/39_unregister_all_push_devices.sql`: pgTAP for the RPC's behaviour and grants.
- `supabase/tests/database/18_function_execute_grants.sql`: adds the RPC to FN-GRANT-008, adds FN-GRANT-016, sets plan 25.
- `src/types/database.types.ts`: regenerated.
- `supabase/functions/send-push/handler.ts`, `index.ts`, `handler.test.ts`: the 30-day stale prune and its tests.
- `src/services/pushNotifications.ts` (+ test): `removeAllPushRegistrations()`.
- `src/api/auth/types.ts`, `actionService.ts` (+ `authServices.test.ts`): `SignOutResult`. Everywhere calls the RPC first and reports a partial result, now including a non-retryable error after the SDK removed the session.
- `src/services/signOutNotice.ts` (+ test): the in-memory notice handed from Settings to the login screen.
- `src/components/Settings/Settings.tsx` (+ `Settings.kit.test.tsx`): the confirmation dialog, the re-entry guard, the partial notice and a stable cancel callback for the focus trap.
- `src/components/LoginScreen/LoginScreen.tsx` (+ `LoginScreen.kit.test.tsx`), `src/App.tsx`: show the notice, and clear it on a sign-in attempt or a new session.
- `scripts/sim-driver/provision.ts`, `scripts/sim-driver/sim`: provision deletes the fixture accounts' push devices; the help text is updated.

**Review:**
- First pass, Quick lens: 3 findings, all patched (2 medium, 1 low).
- Follow-up pass, Quick lens: 3 findings. 2 were patched: 1 medium (a non-retryable global sign-out error went unreported) and 1 low (the focus trap re-focused Cancel on every re-render). 1 medium was deferred: a device with a still-valid access token can re-register after the RPC. Nothing was rejected.

**Follow-up review recommended:** false. This was a follow-up pass and it patched no high finding (patched: high 0, medium 1, low 1).

**Verification (follow-up pass):**
- `npx vitest run src/api/auth src/services/__tests__/pushNotifications.test.ts src/services/__tests__/signOutNotice.test.ts src/components/Settings src/components/LoginScreen` passes (27 files, 486 tests).
- The new focus test fails without the Settings fix and passes with it.
- `deno test --no-lock supabase/functions/send-push/` passes (99).
- `supabase test db` passes (26 files, 613 tests) on the running local stack.
- `npm run typecheck` and `npm run lint` are clean.
- This pass changed no SQL, so `db:types` and `provision.ts` were not re-run.

**Residual risks:**
- `supabase db reset` was not run from scratch. The migration was applied incrementally on a stack that may be shared.
- `tests/api/push-love-note-trigger.spec.ts` was not run, though its response shape is unchanged.
- The dialog and the login notice were not checked on a simulator or a device.
- A phone not cold-started for 30 days stops getting pushes until it next starts. The owner accepted that trade.
- Deferred: a device with a still-valid access token can re-register its push row after "Sign out everywhere".
- The orchestrator's uncommitted resolution edits to `deferred-work.md` were left untouched and uncommitted, because the orchestrator owns them.
