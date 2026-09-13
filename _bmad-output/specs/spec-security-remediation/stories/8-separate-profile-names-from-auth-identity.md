---
title: 'Separate profile names from auth identity'
type: 'bugfix'
created: '2026-09-12'
status: ready-for-dev
baseline_revision: 34c01f545967222dfb6d873822278c168325cb97
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `sync_user_profile()` (`supabase/migrations/20251206024345_remote_schema.sql`, SECURITY DEFINER, fired by `on_auth_user_created AFTER INSERT OR UPDATE ON auth.users`) ends `ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`, so every auth update rewrites the profile name from `raw_user_meta_data->>'display_name'` or the email. The client only ever sets a name through that path: `DisplayNameSetup.tsx:62` writes auth metadata, and its upsert at `:74` sends `{ id, updated_at }` only. `App.tsx:275` gates setup on `user_metadata.display_name`; `LoveNotes.tsx:67` reads the own name from it. Meanwhile `users_update_self_safe` (`20260205000001_fix_users_rls_recursion.sql`) pins only `partner_id`, so a client can PATCH its own `email` mirror to anything (CAP-9 / F9, LOW).

**Approach:** One forward migration: the trigger keeps seeding a name on INSERT but its conflict branch maintains only `email` and `updated_at`; the client loses the ability to change `email` while the definer sync path keeps it. The client writes `display_name` to `public.users` directly and all three consumers read the profile through one own-name helper beside `getPartnerDisplayName()`.

## Boundaries & Constraints

**Always:**
- Redefine `sync_user_profile()` with `CREATE OR REPLACE`, same `SECURITY DEFINER` and `search_path`; re-assert afterwards that `authenticated` and `service_role` hold no EXECUTE (`18_function_execute_grants.sql:136-138` FN-GRANT-009 pins it). Keep the INSERT seed `COALESCE(metadata display_name, email, 'Unknown')`.
- Protect `email` by column privilege first: revoke table UPDATE from `authenticated` and grant UPDATE on the columns legitimate client writes need (inventory: `grep -rn "from('users')" src` → only `DisplayNameSetup.tsx:74`). If a trigger is needed instead, it is `SECURITY INVOKER`, compares `OLD.email IS DISTINCT FROM NEW.email`, and denies by effective role (`current_user = 'authenticated'`), not JWT claims, so the definer sync still passes. Grant nothing new to `authenticated` — FN-GRANT-008 lists its RPC set exactly.
- Keep `users_update_self_safe`, the `partner_id` pin, `get_my_partner_id()`, the SELECT policy and the INSERT policy untouched. No broadened SELECT.
- Client: `DisplayNameSetup` writes `display_name` with a plain `.update().eq('id', uid)`; no `auth.updateUser`, no session refresh. `App.tsx` gating and `LoveNotes` own-name use the new helper; a delayed profile read is discarded if `userId`/`authSessionVersion` changed meanwhile (`App.eventsSession.test.tsx:358` already pins this ownership rule for the auth listener).
- Define "needs setup" as: profile `display_name` is null, empty, equal to the auth email, or `'Unknown'` — the trigger's seed fallbacks. Do not backfill or rewrite existing rows.
- Regenerate `database.types.ts` only if the public schema changes (column privileges do not change it).

**Never:**
- Add an email-change UI, username login, admin role, or a metadata write of any kind; edit `partner_id` outside `accept_partner_request`.
- Break story 3's callback tests (`tests/unit/api/supabaseClientAuthFlow.test.ts`, `tests/e2e/auth/implicit-fragment-rejection.spec.ts`) — no auth client config change.
- Link, unlink, reset or rename worker-pool accounts in a spec; dedicated accounts only for setup-flow E2E.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own name change | authenticated PATCH `display_name` on own row | Row updated; persists after reload | — |
| Client email change | authenticated PATCH `email` on own row | Refused; stored email unchanged | 42501 or trigger error; 0 rows is not enough |
| Partner-row write | PATCH partner's `display_name` | Refused by policy | 0 rows / 42501 |
| Auth update after chosen name | `UPDATE auth.users SET email = new` (definer path) | `email` synced, chosen `display_name` kept, `updated_at` bumped | — |
| Password signup with metadata name | INSERT auth.users with `display_name` | Row seeded with that name; no setup screen | — |
| Google bootstrap without name | INSERT auth.users, metadata lacks `display_name` | Row seeded with email; setup screen shown | — |
| Setup completes | user submits name | Modal closes, no `refreshSession`, name shows in chat | Error shown inline on failure |
| Profile read fails | 5xx on `users` select | Setup not forced open by an error; error state logged | Fail closed on write, open on display |
| Account switch during read | A's profile read pending, B signs in | A's result discarded | — |
| Chat own-name | profile name set / seed fallback only | Name shown / email-prefix fallback as today | — |

</intent-contract>

## Code Map

- `supabase/migrations/20251206024345_remote_schema.sql` — current `sync_user_profile()` body and `on_auth_user_created` trigger (`:369`); `:296-312`, `:358-366` users SELECT/UPDATE/INSERT policies as first written; `20260205000001_fix_users_rls_recursion.sql:20-58` the live SELECT and `users_update_self_safe` definitions; `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:318-322` the execute revocations to preserve.
- New migration `supabase/migrations/20260912HHMMSS_profile_name_email_ownership.sql` — function redefinition plus column privilege change (or invoker trigger).
- `supabase/tests/database/18_function_execute_grants.sql:120-140` — FN-GRANT-008/009 must still pass; `02_rls_policies.sql` pins no `users` policies (`grep policies_are('public', 'users'` → none), so no array edit unless a policy is added. New `supabase/tests/database/24_profile_name_email_ownership.sql` covering the first six matrix rows as the `authenticated` role with `request.jwt.claims` set.
- `src/components/DisplayNameSetup/DisplayNameSetup.tsx:55-95` — replace `updateUser` + upsert with the profile update; `:10`, `:61`, `:87` comments describe the obsolete path.
- `src/App.tsx:272-283` gating, `:527-541` `onComplete` with the `getSession()` refresh to remove.
- `src/components/love-notes/LoveNotes.tsx:62-82` own/partner name effect; `src/api/supabaseClient.ts:263-289` `getPartnerDisplayName` — add `getOwnDisplayName()` beside it returning the chosen name or `null` for seed fallbacks.
- Tests: `tests/unit/App.eventsSession.test.tsx:123,358-372,555-565` drive gating through `user_metadata` and must move to a mocked profile read; `tests/api/auth-bootstrap-identity.spec.ts` (unchanged contract); `tests/e2e/auth/display-name-setup.spec.ts:17-31` both skipped for want of a name-less user — unskip with a dedicated account created via the admin client in the shape of `tests/support/auth/global-setup.ts:32`, never a pool account; `tests/unit/api/partnerService.check.test.tsx` as the RLS-presentation precedent.

## Tasks & Acceptance

**Execution:**
- Migration + pgTAP file; `supabase db reset`, `supabase test db`; inspect persisted rows after each refused write.
- Helper, `DisplayNameSetup`, `App.tsx`, `LoveNotes.tsx`; update `App.eventsSession.test.tsx`; unit tests for the helper's fallback rule and the discarded stale read.
- Unskip and implement the two setup E2E cases with a dedicated account; a `tests/api/` spec for own-name success, email refusal and partner-row refusal through PostgREST.
- Apply to the hosted project through `deploy.yml`, then record: hosted refused email PATCH, hosted own-name change, FN-GRANT checks green — or the concrete blocker.

**Acceptance Criteria:**
- Given a chosen name, when any auth update fires the trigger, then `email` is synced and the name is unchanged.
- Given the `authenticated` role, when it updates `email` on its own row, then the write is refused and the stored value unchanged; own `display_name` updates succeed; partner rows are untouched.
- Given a new account without a metadata name, when the app loads, then setup is shown, completing it writes the profile without an auth metadata write or session refresh, and the name shows in chat after reload.
- Given story 3's tests, when the suite runs, then they still pass unchanged.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit`, `supabase test db`, the new API/E2E specs and `fnox exec -- npm run build`, then all pass.

## Spec Change Log

## Design Notes

- Column privileges are the narrowest fix and need no new function; they fail if PostgREST upsert semantics require UPDATE on `id`, which is why the client moves to a plain update first.
- The seed-fallback rule for "needs setup" avoids touching customer rows; a user who deliberately chose their email as a name sees setup once more, which is accepted.

## Verification

```
supabase db reset && supabase test db
npm run lint && npm run typecheck && npm run test:unit
fnox exec -- npm run build
```
