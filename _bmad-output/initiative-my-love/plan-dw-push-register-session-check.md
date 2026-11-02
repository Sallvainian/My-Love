---
title: 'DW-406: register_push_device refuses a caller whose session has ended'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: 'b2f6cfa3a825b0664d0453c535321426f0331f05'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      A register_push_device call that lands between unregister_all_push_devices() and the global sign-out still has a live session, so the session check accepts it and its push_devices row outlives "Sign out of all devices"; the device keeps receiving pushes until APNs answers 410.
    evidence: |-
      src/api/auth/actionService.ts signOut({ everywhere }) awaits removeAllPushRegistrations() before supabase.auth.signOut({ scope: 'global' }). In that window the other device's auth.sessions row still exists, so the new check in 20261102010000 passes and the insert commits; the later session delete does not touch push_devices, and send-push reads only push_devices. The 2026-11-02 owner decision expected the session check to cover this window, but it closes only registrations after the sign-out. Closing the window needs new state, for example an account-level fence written by unregister_all_push_devices() that refuses sessions created before it, or the registering session id stored on each push_devices row and checked or pruned by send-push. Either needs an owner decision, because the intent limited this change to replacing the function.
    location: >-
      supabase/migrations/20261102010000_register_push_device_session_check.sql (register_push_device); src/api/auth/actionService.ts (signOut, everywhere)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `register_push_device` (`supabase/migrations/20261031000000_push_devices.sql`) checks only `auth.uid()`. After "Sign out of all devices" every refresh token is revoked and every `auth.sessions` row deleted, but another device's access token stays valid for up to `jwt_expiry` (3600 s), and `App.tsx` re-registers on every signed-in start — so a lost phone opened within the hour re-creates its `push_devices` row and keeps receiving pushes. A registration landing between `unregister_all_push_devices()` and the global sign-out does the same (DW-406).

**Approach:** Owner decision 2026-11-02 (server-session-check): a new migration replaces `register_push_device(text, text)` — same signature, `security definer`, `set search_path = ''`, grants — so it also refuses a caller whose JWT `session_id` claim does not name a live `auth.sessions` row of that same user. `jwt_expiry` stays as is; nothing outside push registration changes. Extend `supabase/tests/database/35_push_devices.sql` with a live-session case (accepted) and a deleted-session case (refused). The signature is unchanged, so database types are not regenerated.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261102010000_register_push_device_session_check.sql` -- `create or replace` the function with the session check after the `auth.uid()` check; restate the comment, `revoke … from public, anon` and `grant … to authenticated` -- DW-406.
- [ ] `supabase/tests/database/35_push_devices.sql` -- give the existing register calls a live session (helper that inserts an `auth.sessions` row and puts its id in the claims); add cases: live session accepted, deleted session refused, missing `session_id` refused, another user's session refused, and no row written by a refused call; bump `plan(...)`.

**Acceptance Criteria:**
- Given a signed-in caller whose `session_id` is a live session of theirs, when they call `register_push_device`, then the row is written as before.
- Given that session has been deleted (global sign-out), when the same claims call `register_push_device`, then the call is refused and no `push_devices` row is created or reassigned.
- Given a real GoTrue access token, when its user signs out with `scope=global` and the token (still unexpired) calls `register_push_device`, then the call is refused; before the sign-out the same token is accepted.

## Implementation Notes

Oneshot: one replaced function plus pgTAP cases, well under 100 lines. Hosted catalog read-only check (2026-11-02): `postgres` owns `register_push_device` and has SELECT on `auth.sessions` on both hosted and local, so the definer can read it.

- Files: `supabase/migrations/20261102010000_register_push_device_session_check.sql` (new), `supabase/tests/database/35_push_devices.sql` (PUSH-DB-115..121, `plan(121)`). No client or type changes; signature unchanged.
- Refusal: `raise exception 'Session has ended' using errcode = '42501'`. The claim is compared as text (`s.id::text = v_session_id`, scoped by `s.user_id = v_uid`, served by `sessions_user_id_idx`) so a malformed claim is refused instead of raising 22P02. A missing `session_id` is refused: every GoTrue access token carries one (checked below).
- Test helper: `tests.authenticate_as` now puts a live session's id in the claims through a new security-definer `tests.session_for(uid)`; `tests.authenticate_with_session(uid, sid)` sets explicit claims for the refusal cases. Every other caller in the file keeps working (all 121 pass).
- Verified: 35 (121 ok), 18 (25 ok), 39 (9 ok) with the migration body inside each file's rolled-back transaction; against the unpatched function PUSH-DB-116..121 fail (red before green). Real local GoTrue token: its `session_id` claim is present; it registers, then `logout?scope=global` (204) leaves 0 sessions and the same token is refused with `Session has ended`. The temporary user was deleted; the shared stack's function was never replaced (its body still lacks `session_id`). `pushNotifications.test.ts` 69/69.
- API fixtures (`tests/support/helpers/supabase.ts` `getUserAccessToken`) sign in fresh per test, so `tests/api/push-love-note-trigger.spec.ts` tokens carry a live session.

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 1, low 0, false 1, maybe-false 0
- findings:
  - `[medium]` `[defer]` A registration landing between unregister_all_push_devices() and the global sign-out still passes the session check, and its row survives the sign-out — real: `actionService.ts` signOut({ everywhere }) unregisters first, and the session is live until the global sign-out. The gap was already there before this change, which neither causes nor exposes it. Closing it needs new state outside "replace the function", so it is deferred in frontmatter `deferred`. The migration header now says plainly that this window is still open.
  - `[false]` `[reject]` No committed test proves AC 3 (real GoTrue token), so CI would not catch a GoTrue change — refuted for the `session_id` half: `tests/api/push-love-note-trigger.spec.ts` registers with real per-test GoTrue tokens (`getUserAccessToken`) and asserts `.error` is null, so a token without `session_id` would fail it. A change to global logout deleting the sessions is GoTrue's documented contract, unlikely to change, and AC 3 was checked against the real local GoTrue (Implementation Notes). A new spec would mean creating and deleting a user, not a direct correction.

## Verification

**Commands:**
- Migration body (without `begin`/`commit`) inserted after `begin;` of `35_push_devices.sql`, `18_function_execute_grants.sql` and `39_unregister_all_push_devices.sql`, each run through `psql` against the local stack (the files roll back) -- expected: every line `ok`, none `not ok`, plan count matches.
- Real-token check in a rolled-back transaction: a temporary `@example.com` user signs in through local GoTrue, its token's claims call the replaced function (accepted), `POST /auth/v1/logout?scope=global`, the same claims call again (refused); the user is deleted afterwards -- expected: accepted then refused.
- `npx vitest run src/services/__tests__/pushNotifications.test.ts` -- expected: green (client unchanged).

## Auto Run Result

Status: built

**Summary:** `register_push_device` now also refuses (`42501`, `Session has ended`) a caller whose JWT `session_id` does not name a live `auth.sessions` row of that user. A device signed out by "Sign out of all devices" therefore cannot re-register its push row while its access token is still valid. Signature, `security definer`, empty `search_path` and grants are unchanged; `jwt_expiry` is untouched; no type regeneration.

**Files changed:**
- `supabase/migrations/20261102010000_register_push_device_session_check.sql` — replaces `register_push_device` with the session check; restates comment and grants.
- `supabase/tests/database/35_push_devices.sql` — `tests.session_for` and `tests.authenticate_with_session` helpers. `authenticate_as` now carries a live `session_id`. Adds PUSH-DB-115..121: live session accepted; deleted, missing, another user's and malformed sessions refused; refused calls write nothing. `plan(121)`.
- `_bmad-output/initiative-my-love/plan-dw-push-register-session-check.md` — this plan.

**Review:** quick lens, 2 findings. Patches applied: 0 (the migration header was corrected to state the residual window, alongside the deferral). Deferred: 1 (medium) — a registration in the gap between unregister and global sign-out still passes, because its session is live at that moment. Rejected: 1 (false) — the CI coverage claim is refuted by the existing real-token API spec.

**Follow-up review recommended:** false — no patched entries (patched counts: high 0, medium 0, low 0).

**Verification:**
- pgTAP with the migration in each file's rolled-back transaction: `35_push_devices` 121/121, `18_function_execute_grants` 25/25, `39_unregister_all_push_devices` 9/9. Against the unpatched function, PUSH-DB-116..121 fail.
- Real local GoTrue token: `session_id` claim present. Accepted before `logout?scope=global` (204, 0 sessions left), refused with `Session has ended` after it. Temporary `@example.com` user deleted.
- `npx vitest run src/services/__tests__/pushNotifications.test.ts`: 69 passed.
- Not run: the full `supabase test db` and the `api` Playwright project, because the migration was not applied to the shared local stack. CI's Database Tests job runs both.

**Residual risks:** the deferred gap window (≤ a few seconds during "Sign out of all devices"). A token without `session_id` (none issued by GoTrue today) is refused, which would show as `[Push] Could not record the device` in the client log.
