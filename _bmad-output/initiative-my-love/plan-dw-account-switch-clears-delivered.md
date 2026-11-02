---
title: 'DW-408: an account switch empties the app''s delivered notifications'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '36f7f894054d262a57539cb40bd6f0830f4a6c19'
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
deferred:
  - summary: >-
      On an account switch without a sign-out, a love-note push sent to the outgoing account between the Notification Center clear and the incoming account's `register_push_device` still lands, so it stays for the incoming account.
    evidence: |-
      On the in-place switch and the fresh-sign-in leftover paths nothing deletes this device's `push_devices` row first (only `actionService.signOut` calls `removePushRegistration`, src/api/auth/actionService.ts:100). The token moves to the incoming account only when `register_push_device` upserts it (supabase/migrations/20261102010000_register_push_device_session_check.sql:64-69), after App.tsx's effect re-runs `startPushRegistration()`, APNs answers and `recordDevice` sends the RPC. That is normally seconds. If the RPC fails, `recordDevice` only logs it (src/services/pushNotifications.ts:216-218), and the token stays with the outgoing account until the next signed-in start or the 12-hour foreground renewal. The gap predates DW-408, and the intent rules out the APNs unregister on these paths. Options: a second `clearDeliveredNotifications()` once `recordDevice` succeeds after a switch, or have the switch delete the outgoing row server-side while the outgoing session still exists, which the leftover path cannot do. Either needs an owner decision.
    location: >-
      src/stores/slices/authSlice.ts (clearDeliveredForSwitch callers); src/services/pushNotifications.ts (recordDevice)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Only a transition to signed out empties Notification Center (DW-352). An in-place account switch (`discardAccountState`, which calls `stopPushesForSignOut()` only when `identity.userId === null`, src/stores/slices/authSlice.ts:336) and a fresh sign-in whose owner marker names another account (`deleteAccountData(leftover)` alone, authSlice.ts:456-458) leave the outgoing account's delivered pushes and date reminders for the incoming account to read (DW-408).

**Approach:** Per the owner's 2026-11-02 switch-clears-too decision, factor a removal-only `clearDeliveredNotifications()` out of `stopDevicePushes` in `src/services/pushNotifications.ts`: native-platform gated, the `LocalNotifications.removeAllDeliveredNotifications()` call behind its own `isPluginAvailable('LocalNotifications')` check, then `clearAppBadge()`; never throws, logs only failures. `stopDevicePushes` becomes unregister → `clearDeliveredNotifications()` → forget token, unchanged in behaviour. `authSlice` calls it fire-and-forget (logged catch, like `stopPushesForSignOut`) on the in-place switch branch and the fresh-sign-in leftover branch — never the APNs unregister or token forget, which would race `startPushRegistration`. Unit tests cover the new function (called; skipped without the plugin; skipped in a browser; a rejection logged with the badge still cleared) and both store paths (called once; not on sign-out, where `stopDevicePushes` already removes; not on a repeat sign-in for the same user or a fresh sign-in with no foreign marker).

</intent-contract>

## Implementation Notes

Oneshot: one extracted function, two call sites and their tests, under 100 lines.

- `src/services/pushNotifications.ts`: new exported `clearDeliveredNotifications()` (native gate, `LocalNotifications` removal behind its own `isPluginAvailable` check in a try/catch, then `clearAppBadge()`). `stopDevicePushes` is now unregister → `clearDeliveredNotifications()` → `forgetToken()`, the same order and behaviour as before; its doc and the module header name the switch path.
- `src/stores/slices/authSlice.ts`: `clearDeliveredForSwitch()` wraps the call fire-and-forget with a logged catch, like `stopPushesForSignOut`. `discardAccountState` runs it when an account is replaced by another (`else` of the signed-out branch), and the fresh-sign-in leftover branch runs it beside `deleteAccountData(leftover)`. Sign-out does not call it: `stopDevicePushes` already removes.
- Tests: `src/services/__tests__/pushNotifications.test.ts` gains a `clearDeliveredNotifications` describe (called with no unregister and token kept; skipped without the plugin; nothing in a browser; a rejection logged once with the badge still cleared). `tests/unit/stores/signOutStopsDevicePushes.test.ts` gains five store cases (sign-out does not call it; in-place switch once; fresh sign-in over a foreign marker once; no marker or own marker not; a rejection logged and the switch completes) and its header and describe title now cover switches. The three positive store tests fail against the baseline `authSlice.ts` (checked by swapping the baseline file in).
- Surprise: `tests/unit/App.pushRegistration.test.tsx` and `tests/unit/stores/signOutCancelsDateReminders.test.ts` mock the push module with a factory, and both drive an account switch, so each mock gained `clearDeliveredNotifications`; without it Vitest fails with a missing-export error.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 1 finding — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` On both switch paths this device's token stays with the outgoing account on the server until `register_push_device` runs, so a push sent in that window lands after the clear (longer if the RPC fails) — confirmed: `register_push_device` upserts on `token` (migration 20261102010000:64-69), and only `actionService.signOut` deletes the row first. The gap predates this change, the intent rules out the unregister that would close it, and closing it needs an owner decision, so it is recorded in `deferred` for the orchestrator to carry to the ledger.

## Verification

**Commands:**
- `npx vitest run src/services/__tests__/pushNotifications.test.ts tests/unit/stores/signOutStopsDevicePushes.test.ts tests/unit/stores/signOutCancelsDateReminders.test.ts` -- expected: all pass
- `npm run test:unit` -- expected: all pass
- `npm run typecheck` and `npm run lint` -- expected: no new errors (worktree TS2883 baseline aside)

## Auto Run Result

Status: built

**Summary:** An account switch without a sign-out now empties the app's delivered notifications and badge (DW-408). This covers an in-place switch and a fresh sign-in whose owner marker names another account. A new `clearDeliveredNotifications()` in the push service does the removal and badge clear. It is gated on the native platform, the removal sits behind its own `LocalNotifications` check, and it never throws. `stopDevicePushes` reuses it, so sign-out behaves as before. `authSlice` calls it fire-and-forget on both switch paths, without the APNs unregister or token forget.

**Files changed:**
- `src/services/pushNotifications.ts`: `clearDeliveredNotifications()` factored out of `stopDevicePushes`, with docs.
- `src/stores/slices/authSlice.ts`: `clearDeliveredForSwitch()`, called on the in-place switch and the leftover sign-in path.
- `src/services/__tests__/pushNotifications.test.ts`: four `clearDeliveredNotifications` cases.
- `tests/unit/stores/signOutStopsDevicePushes.test.ts`: five store cases for switch, leftover, no-op and rejection; header and describe updated.
- `tests/unit/App.pushRegistration.test.tsx`, `tests/unit/stores/signOutCancelsDateReminders.test.ts`: the push-module mocks export `clearDeliveredNotifications`.
- `_bmad-output/initiative-my-love/plan-dw-account-switch-clears-delivered.md`: this plan.

**Review:** quick lens found 1 issue, rated low. 0 patched and 1 deferred: a push sent to the outgoing account before the token moves still lands after the clear. That gap predates this change and needs an owner decision. None rejected. Patched counts: high 0, medium 0, low 0. Follow-up review recommended: false.

**Verification:** targeted vitest run (3 files, 92 tests) passed. The three positive store tests fail against the baseline `authSlice.ts`. `npm run test:unit` failed first on 2 tests in `App.pushRegistration.test.tsx`, because its mock lacked the new export. After fixing the mock, it passed: 224 files, 3866 tests. `npm run typecheck` exit 0. `npm run lint` exit 0.

**Residual risks:** the native removal is still unverified on a shell (the DW-352 simulator follow-up). The deferred push window above remains.
