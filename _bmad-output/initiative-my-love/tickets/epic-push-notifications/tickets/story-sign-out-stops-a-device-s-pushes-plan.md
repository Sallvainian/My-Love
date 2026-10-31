---
title: "Sign-out stops a device's pushes"
type: 'feature'
ticket: '2'
created: '2026-10-31'
status: done
baseline_revision: '80798275fbdbd5879e6dd334a5c81e40eb1e2115'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      A reinstalled shell leaves its old token's push_devices row on the account; only the sender's APNs 410 cleanup removes it, which never runs on the local stack.
    evidence: |-
      Sign-out removes only the stored token's row; a reinstall gets a new APNs token. The story's simulator check found one such stale row from story 1's install and deleted it by hand. Ledger DW-353.
    location: >-
      src/services/pushNotifications.ts (removePushRegistration); supabase/functions/send-push/handler.ts (410 branch)
    severity: low
---

<intent-contract>

## Intent

**Problem:** After sign-out the device keeps its `push_devices` row and its APNs registration, so the outgoing account's pushes still reach it and its badge stays; nothing removes a token APNs reports as gone.

**Approach:** Online sign-out deletes this device's row through a new RPC before `supabase.auth.signOut()`; every sign-out path (online, offline, no-session boot with the owner marker) then unregisters from APNs natively and clears the badge. The sender deletes a registration on an APNs 410. Takeover on a new account's sign-in already exists (`register_push_device` reassigns by token).

## Boundaries & Constraints

**Always:**
- Native calls only after `Capacitor.isNativePlatform()` then `Capacitor.isPluginAvailable(<that plugin>)`, each plugin checked on its own: a story-1 shell has `PushNotifications` but no badge plugin; an older shell has neither. Every push call in sign-out is caught and logged; sign-out never fails or waits more than ~3 s for it.
- Server removal: only when online (`isOnline()`), only the caller's own row for this device's token (`user_id = auth.uid()`); offline makes no request.
- Native unregister + badge clear run only on transitions to signed out (`clearAuth` with an outgoing account, i.e. sign-out and the marker boot), never on an in-place account switch or sign-in, so they cannot race `startPushRegistration`.
- Sender deletes a device only on APNs status 410, and only if the row was not re-registered after APNs's `timestamp` (fallback: the time the request started); a refused 400 `BadDeviceToken` (environment mismatch) deletes nothing.
- New RPC: SECURITY DEFINER, `search_path = ''`, executable by `authenticated` only; pgTAP grant file and `35_push_devices.sql` updated in the same change; `database.types.ts` regenerated, never hand-edited.
- Fixtures fictional; no device tokens in commits or `_bmad-output/`.

**Never:**
- Touch `deploy.yml`, hosted Supabase, APNs keys (stories 3, 13); add Settings switches, badge counts, tap handling (stories 7–9); remove delivered notifications from Notification Center (not asked; record as deferred).
- Change `appId`, use `supabase.channel()`, `@/` imports in `src/`, leave a test build in `dist/` or driver processes running.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Online sign-out | Shell, token stored, online | RPC deletes own row, then `auth.signOut()`, then native `unregister()` + badge clear, token key removed | RPC error/timeout logged; sign-out continues |
| Offline sign-out | `navigator.onLine` false | No RPC; session still removed (auth-js removes it on a network error); `clearAuth` unregisters natively + clears badge | -- |
| No-session boot | No session, marker names an account | `clearAuth` → unregister + badge clear | -- |
| Web / old shell | Not native, or plugin missing | No native call, no RPC, no new log | -- |
| Story-1 shell | `PushNotifications` present, badge plugin absent | Unregister runs; badge clear skipped | -- |
| Account switch | Signed in as A, sign in as C | No unregister; C's register moves the token row | -- |
| APNs 410 | Send to a gone token | Row deleted (unless re-registered after APNs timestamp), claim released, counted `gone` | Delete failure logged, counted failed |
| Another account's token | RPC with a token owned by B | Nothing deleted | -- |

</intent-contract>

## Code Map

- `src/services/pushNotifications.ts` -- extend: store the token from the `registration` listener in localStorage key `my-love-push-token` (device state, try/catch); new `removePushRegistration()` (native+plugin gate, `isOnline()` from `src/api/errorHandlers.ts`, read key, `supabase.rpc('unregister_push_device', { p_token })` raced against a ~3 s timeout, never throws) and `stopDevicePushes()` (`PushNotifications.unregister()` if available; `AppBadge.clear()` if `isPluginAvailable('AppBadge')`; remove the key; never throws, logs only failures). Update the header's "Not here yet" line. Do NOT use `PushNotifications.removeAllDeliveredNotifications()` for the badge: it rejects unless `register()` ran this launch (plugin source) and also wipes Notification Center.
- `src/services/__tests__/pushNotifications.test.ts` -- existing mocks of Capacitor/plugin/supabase to extend.
- `src/api/auth/actionService.ts:73` `signOut` -- `await removePushRegistration()` before `supabase.auth.signOut()`; test in `src/api/auth/__tests__/authServices.test.ts` (order: RPC before signOut).
- `src/stores/slices/authSlice.ts` `discardAccountState` -- inside `if (outgoingUserId && outgoingUserId !== identity.userId)`, when `identity.userId === null`, fire-and-forget `stopDevicePushes()`; document beside `deleteAccountData`. Test in `tests/unit/stores/signOutClearsAccountState.test.ts` or a new sibling (mock the module): called on sign-out and marker boot, not on switch or fresh sign-in. Its fire-and-forget must not log after a test ends (AGENTS pitfall).
- `ios/App/App/AppBadge.swift` (new) -- app-local `AppBadgePlugin` (`jsName` `AppBadge`, method `clear`): on main queue, `UNUserNotificationCenter.current().setBadgeCount(0)` on iOS 16+, else `UIApplication.shared.applicationIconBadgeNumber = 0` (target is iOS 15.0). Pattern: `PushEnvironment.swift`; register in `MainViewController.capacitorDidLoad` (`NativeAuth.swift:~64`); add PBXBuildFile/PBXFileReference/group/Sources entries in `ios/App/App.xcodeproj/project.pbxproj` as `PushEnvironment.swift`'s (lines 18, 34, 74, 172). Story 8 will add `set`.
- `supabase/migrations/<new, after 20261031000000>.sql` -- `public.unregister_push_device(p_token text) returns void`, SECURITY DEFINER, raises when `auth.uid()` is null, `delete from public.push_devices where token = p_token and user_id = auth.uid()`; revoke from public, anon; grant authenticated. Copy `register_push_device` in `20261031000000_push_devices.sql`.
- `supabase/tests/database/18_function_execute_grants.sql:114,159` -- add to the function list and a FN-GRANT row; `35_push_devices.sql` -- own row deleted, another account's untouched, anon refused.
- `src/types/database.types.ts` -- regenerate (AGENTS command); story 1 notes CLI 2.122 adds `ComputedFields: never` churn — keep the diff to the new function as story 1 did and say how in Implementation Notes.
- `supabase/functions/send-push/apns.ts` -- `ApnsResult` gains `timestamp: number | null` (APNs body's `timestamp`, ms). `handler.ts` -- on `status === 410`: release claim, `db.deleteGoneDevice(token, goneBefore)`, count `gone`; response becomes `{ sent, recorded, skipped, failed, gone }`; update the header's "story 3.2" line. `index.ts` -- implement `deleteGoneDevice` (`delete ... eq token, lte updated_at`). Tests: `handler.test.ts` (existing exact `assertEquals` bodies gain `gone: 0`), `apns.test.ts` (timestamp parse).
- `tests/api/push-love-note-trigger.spec.ts:198` -- `toMatchObject`, unaffected; add a case: `unregister_push_device` removes the caller's row and leaves another account's (pattern at line 225).
- `scripts/sim-driver/provision.ts` -- second fictional pair (`simdriver-other@test.example.com` "Harper", `simdriver-other-partner@test.example.com` "Morgan"), linked, wiped of notes, not seeded with views' rows. `scripts/sim-driver/sim` -- `EMAILS`, `signin [partner|other|other-partner]`, new `signout` step, `help` text. `RunnerUITests/Drive.swift` -- `signout`: tap `buttons["Settings"]`, then `buttons["Sign out"]`, wait for the login text field. Update the driver paragraph in `AGENTS.md` ("Its fixture pair …") to name both pairs.
- `_bmad-output/initiative-my-love/deferred-work.md` -- delivered notifications stay in Notification Center after sign-out (shared-device disclosure), for a later story.

## Tasks & Acceptance

**Execution:**
- [x] migration, pgTAP files, `database.types.ts` -- `unregister_push_device` -- server removal
- [x] `supabase/functions/send-push/{apns,handler,index}.ts` + tests -- 410 deletes the registration
- [x] `src/services/pushNotifications.ts`, `actionService.ts`, `authSlice.ts` + vitest -- sign-out paths
- [x] `ios/App/App/AppBadge.swift`, `NativeAuth.swift`, `project.pbxproj` -- badge clear
- [x] `tests/api/push-love-note-trigger.spec.ts` -- RPC over the wire
- [x] `scripts/sim-driver/{provision.ts,sim,RunnerUITests/Drive.swift}`, `AGENTS.md` -- second pair, `signout`
- [x] `deferred-work.md` -- the Notification Center observation
- [x] Run Verification; run the simulator check below; record commands, exit codes, result lines

**Acceptance Criteria:**
- Given unit tests, when run, then online sign-out calls the RPC before `auth.signOut()`, offline sign-out calls none, and sign-out, offline sign-out and the no-session marker boot each call native `unregister()` and the badge clear; an account switch calls neither.
- Given a deno test, when APNs answers 410 for one device, then that registration is deleted, the others are sent, and the response counts `gone: 1`; a 400 deletes nothing.
- Given the Duo simulator against the local stack (`sim provision`, `sim build`, `sim signin`), when a payload with `"badge": 3` is pushed, `sim badge` reads it; after `sim signout`, `sim badge` reads none and `push_devices` holds no row for the first account; after `sim signin other`, a note inserted from the first account's partner to it gets no `push_requests` row, and a note from `other-partner` to `other` records a payload that `sim banner` shows with its sender's name and text.
- Given the session ends, then `git status` shows only planned files, `dist/` holds no test build, and no driver process runs.

## Implementation Notes

Built 2026-10-31. Server: `20261031010000_unregister_push_device.sql` (`unregister_push_device(p_token)`, SECURITY DEFINER, `search_path = ''`, raises with no `auth.uid()`, deletes only `token = p_token and user_id = auth.uid()`; revoked from public and anon, granted to authenticated). pgTAP: FN-GRANT-008's list and new FN-GRANT-014; PUSH-DB-034..041 (grant, another account's token untouched, own row deleted, no session, anon 42501, nothing removed by the refused calls).

`src/types/database.types.ts`: `supabase gen types typescript --local` (CLI 2.122) was diffed against the file after formatting both copies to scratch files with the repo's Prettier; apart from line width and the CLI's `ComputedFields: never` lines, the only difference was `unregister_push_device`, so that one entry was added in the file's style, as story 1 did.

Sender: `ApnsResult.timestamp` (the 410 body's ms `timestamp`, else null). On a 410 the handler calls `deleteGoneDevice(token, timestamp ?? time the APNs send started)`, then releases the claim (so a failed release cannot keep a dead registration; counted failed), and counts `gone`; `index.ts` deletes `eq token, lte updated_at` (register_push_device bumps `updated_at`, so a re-registered row is kept). Any other refusal, 400 `BadDeviceToken` included, deletes nothing. `SendPushDeps.now` was added for the tests.

Client: the `registration` listener stores the token in `my-love-push-token`. `removePushRegistration()` (native + `PushNotifications` gate, `isOnline()`, stored token, RPC raced against 3 s, never throws) runs first in `actionService.signOut`. `stopDevicePushes()` (`unregister()` if `PushNotifications`, `AppBadge.clear()` if `AppBadge`, token key removed) runs fire-and-forget from `discardAccountState` when `identity.userId === null` inside the outgoing-account branch, so sign-out, the SIGNED_OUT event and the marker boot call it and a switch or sign-in never does. auth-js 2.118.0 `_signOut` (GoTrueClient.js:3424) removes the current session before returning a non-auth error, so the offline path reaches `clearAuth`. Native: `ios/App/App/AppBadge.swift` (`setBadgeCount(0)` on iOS 16+, else `applicationIconBadgeNumber = 0`, on the main queue), registered in `MainViewController.capacitorDidLoad`, with four pbxproj entries.

Driver: `provision.ts` adds Harper/Morgan (`simdriver-other@…`, `simdriver-other-partner@…`), linked, love notes wiped, nothing seeded; `sim signin [partner|other|other-partner]`, `sim signout`; `Drive.swift` `signout` taps Settings, then Sign out (swiping until it is hittable), and waits for the login field. AGENTS.md's driver paragraph names both pairs. DW-352 records the Notification Center observation.

Checks (all exit 0): `deno test --no-lock supabase/functions/send-push/` 30 passed (after the review fix); `deno check --no-lock supabase/functions/send-push/index.ts` ok; `supabase test db` 22 files, 450 tests, PASS; `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 6 passed (edge runtime served by `supabase functions serve`, stopped afterwards); `npm run typecheck`; `npm run lint`; `npm run test:unit` 208 files, 3275 tests.

Simulator (iPhone Duo iOS 27.1, local stack): `sim provision` exit 0 (both pairs; Harper and Morgan created). `sim build` exit 0 (`sim-tree-1793484259`). `sim signin` exit 0; `push_devices` then held two rows for the first account: this install's and a stale `sandbox` row from story 1's earlier install (19:35), whose token no longer exists. That one stale row was deleted by hand as setup, since it would otherwise fail the AC for a reason outside this story (on real APNs the sender's 410 cleanup removes such a row). `sim push` of `{"aps":{…,"badge":3,…}}` with the shell in front: `sim badge` read `none`, because the push plugin shows a foreground push with no presentation options; after `sim background`, the same push gave `badge: 3 new items`. `sim signout` printed `signed out`, exit 0; `sim badge` then read `badge: none`; `push_devices` held 0 rows for all four driver accounts. `sim signin other` exit 0; one `sandbox` row for `simdriver-other@…`. A note inserted from the first account's partner to the first account got no `push_requests` row. A note from `other-partner` to `other` recorded `{"aps": {"alert": {"body": "Hello from Morgan", "title": "Morgan"}, "thread-id": "love-notes"}}`, and `sim banner` with it printed `banner: MY LOVE, now, Morgan, Hello from Morgan`, exit 0. Cleanup: both test notes deleted; `supabase functions serve` stopped (no edge-runtime container left); `pgrep` finds no `xcodebuild`, `functions serve` or `http.server`; the worktree has no `dist/`. The shell stays installed on the simulator, signed in as `simdriver-other@…`.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 3, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` (quick) `database.types.ts` entry added by hand instead of regenerated, against AGENTS.md — real, but `supabase gen types typescript --local` (CLI 2.122) emits the same `unregister_push_device: { Args: { p_token: string }; Returns: undefined }`, checked in this pass; the committed file has diverged from the CLI's layout since story 1, so writing the raw output would rewrite every untouched line. No caller sees a different type; noted under residual risks for the owner.
  - `[false]` `[reject]` (quick) `Drive.swift` `signOut()` may pass on a Settings date input exposed as a text field — `sim dump` on the Settings view of the installed shell (linked pair, every section scrolled) lists buttons and one switch and no `textField`; the date and time inputs are not exposed as text fields, so `textFields.firstMatch` appears only with the login form.
  - `[low]` `[patch]` (quick) 410 branch released the claim before deleting the gone registration, so a failing release kept the dead row — patched: `deleteGoneDevice` now runs first; new deno test (release throws on a 410, registration still deleted, counted failed); 30 deno tests pass.
  - `[low]` `[defer]` (quick) a reinstalled shell leaves its old token's `push_devices` row; on the local stack nothing removes it, and the simulator AC needed one stale row deleted by hand — pre-existing (story 1's registration by token; reinstall issues a new token); with real APNs this story's 410 cleanup removes it. Recorded as DW-353 in the ledger and in `deferred`.

## Design Notes

Sign-out order in `actionService.signOut`: `removePushRegistration()` (needs the session) → `supabase.auth.signOut()` (emits SIGNED_OUT → `setAuthUser(null)` → `clearAuth` → `stopDevicePushes()`). auth-js `_signOut` removes the local session even when the server call fails offline, so the offline path reaches `clearAuth` too. A token APNs issues afresh after `unregister()` leaves the first account's old row to the sender's 410 cleanup; the same token is moved by `register_push_device`.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` (with `supabase functions serve`) -- expected: pass
- `npm run typecheck`, `npm run lint`, `npm run test:unit` -- expected: exit 0

**Manual checks:**
- The simulator sequence in the third AC through `scripts/sim-driver/sim`; then `sim serve-update --stop` if used and confirm no `xcodebuild`/`functions serve` process remains.

## Auto Run Result

Status: built

**Summary:** Sign-out now stops this device's pushes. While the session still exists and the device is online, `actionService.signOut` deletes this device's `push_devices` row through the new `unregister_push_device` RPC (3 s cap, never throws). Every transition to signed out (online or offline sign-out, and a no-session boot whose owner marker names an account) then unregisters from APNs, clears the app icon badge through the new app-local `AppBadge` plugin, and forgets the stored token. An in-place account switch and a sign-in do neither; there the existing `register_push_device` takeover moves the token's row. The sender deletes a registration on an APNs 410 unless it was registered again after APNs's timestamp, and reports it as `gone`. The simulator driver gains a second fixture pair (Harper and Morgan), `sim signin other|other-partner` and `sim signout`.

**Files changed:**
- `supabase/migrations/20261031010000_unregister_push_device.sql`: the RPC.
- `supabase/tests/database/{18_function_execute_grants,35_push_devices}.sql`: grant and behaviour tests.
- `src/types/database.types.ts`: the new function's type (matches the CLI output; see residual risks).
- `supabase/functions/send-push/{apns,handler,index}.ts` and their tests: 410 cleanup and the `gone` count.
- `src/services/pushNotifications.ts`: stored token, `removePushRegistration`, `stopDevicePushes`.
- `src/api/auth/actionService.ts`: removal before `auth.signOut()`.
- `src/stores/slices/authSlice.ts`: native stop on transitions to signed out.
- `src/services/__tests__/pushNotifications.test.ts`, `src/api/auth/__tests__/authServices.test.ts`, `tests/unit/stores/signOutStopsDevicePushes.test.ts`: unit tests.
- `tests/api/push-love-note-trigger.spec.ts`: the RPC over the wire.
- `ios/App/App/AppBadge.swift`, `ios/App/App/NativeAuth.swift`, `ios/App/App.xcodeproj/project.pbxproj`: the badge plugin.
- `scripts/sim-driver/{provision.ts,sim,RunnerUITests/Drive.swift}`: second pair, signin targets, signout.
- `AGENTS.md`: the driver paragraph now names both pairs.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-352 and DW-353.

**Review findings (quick lens, 4):**
- Patched (1, low): the 410 branch now deletes the gone registration before it releases the claim, with a new deno test.
- Deferred (1, low): a stale row after a reinstall (DW-353).
- Rejected (2):
  - The hand-added types entry (low): it equals the CLI output, and regenerating would rewrite untouched lines.
  - The driver's sign-out wait (false): `sim dump` shows no text field on Settings.

**Follow-up review recommended:** false. One patch was applied, and it was `low`; no `high` or `medium` was patched.

**Verification:**
- `deno test --no-lock supabase/functions/send-push/`: 30 passed.
- `supabase test db`: 22 files, 450 tests, PASS.
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts`: 6 passed, with `supabase functions serve` running (stopped afterwards).
- `npm run typecheck` and `npm run lint`: exit 0. `npm run test:unit`: 208 files, 3275 tests.
- Simulator, iPhone Duo on the local stack:
  - After the app was backgrounded, a badge-3 push read `badge: 3 new items`.
  - After `sim signout` the badge read none and `push_devices` held no row for any driver account.
  - After `sim signin other`, a note to the first account produced no `push_requests` row.
  - Morgan's note to Harper gave `banner: MY LOVE, now, Morgan, Hello from Morgan`.
  - One stale row from story 1's install was deleted by hand before the sequence (DW-353).
- I/O matrix audit: every row has a test that ran and passed.

**Residual risks:**
- `src/types/database.types.ts` was edited by hand rather than replaced with the CLI's output. AGENTS.md forbids that. The entry is identical to the generator's, but the file has not matched the CLI's layout since story 1, so a clean regeneration needs an owner decision.
- The 410 path and the re-registration guard run only in deno tests with a fake database; a real APNs send comes in stories 3 and 13. Whether re-registering after `unregisterForRemoteNotifications`, and the takeover, work on a device is story 13's check.
- `AppBadge.clear` ran only on iOS 27.1; the iOS 15 fallback has not been run.
- A badge-only push with the app in front shows no badge, because the push plugin has no foreground presentation options (later stories, R8).
- Delivered notifications stay in Notification Center after sign-out (DW-352).
