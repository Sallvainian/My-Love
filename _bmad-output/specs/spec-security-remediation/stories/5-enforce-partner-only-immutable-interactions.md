---
title: 'Enforce partner-only immutable interactions'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: 'f9d4d378e9f3f129cb69f762de9cb6c2b3c73491'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred:
  - summary: >-
      loadInteractionHistory recomputes unviewedCount from unfiltered server rows, so a
      non-partner interaction can still raise the badge when the history modal opens.
    evidence: |-
      CAP-4's success criterion names the badge, and the ingest guard added by this story
      sits only in addIncomingInteraction. src/stores/slices/interactionsSlice.ts counts
      every row with `!i.viewed && i.toUserId === currentUserId`, and the SELECT policy is
      deliberately unchanged, so a row from a former partner - or one forged before
      20260912020000 shipped - still counts. Pre-existing: that recompute predates this
      story and no test covers it either way. Not patched because the only handle for a
      partner filter is `interactionPartnerId`, which is null until a subscription opens,
      so filtering there would zero the badge for anyone who opens history before
      PokeKissInterface subscribes. Settle by querying the hosted table after deploy for
      rows where `to_user_id` is a user and `from_user_id` is not that user's current
      `partner_id`; if the count is zero, nothing reachable raises the badge and the entry
      closes.
    location: >-
      src/stores/slices/interactionsSlice.ts (loadInteractionHistory, unviewedCount recompute)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `public.interactions` trusts whatever the caller puts in the row. The INSERT policy checks only `auth.uid() = from_user_id` (`supabase/migrations/20251206024345_remote_schema.sql:228-233`), so any authenticated user who knows a UUID can poke a stranger or themselves. The UPDATE policy checks only recipient ownership and has no `WITH CHECK` (`:316-321`), and `authenticated` holds table-level `ALL` from the blanket grant at `20260725170000_grant_api_roles_on_public.sql:35` — so a recipient can rewrite `type`, `from_user_id`, `to_user_id`, `id` and `created_at` on a received row. On the client, `addIncomingInteraction` adds any delivered row to the feed and increments the badge without checking who sent it.

**Approach:** Move both guarantees to the database boundary: INSERT requires sender-is-caller **and** recipient-is-the-caller's-current-partner (resolved through `public.get_my_partner_id()`), and `authenticated` loses table-level UPDATE in favour of a column grant on `viewed` alone. On the client, derive the recipient from the authenticated relationship instead of accepting it as an argument, and reject incoming rows that are not from the current partner before they reach the feed or `unviewedCount`.

## Boundaries & Constraints

**Always:**
- The authorization decision is the migration. Client checks are defence in depth and never the proof.
- New `interactions` policies are `to authenticated`, never `to public` — `anon` holds no EXECUTE on `get_my_partner_id()` since `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:241-260`, so a PUBLIC policy would surface `permission denied for function` instead of a clean RLS denial.
- `service_role` keeps every privilege it has: `tests/api/interaction-record-ownership.spec.ts:97-102` deletes its fixtures with the service key.
- Legitimate poke/kiss delivery, the unviewed badge, mark-as-viewed, and history loading keep their current observable behaviour and their current toast strings.
- Any new account-scoped store field is reset in `signedOutState()` (`src/stores/slices/authSlice.ts:61-140`) in the same commit.
- Evidence is role-sensitive: assertions run as `authenticated`/`anon` against the real database, not only through mocked clients.

**Never:**
- Do not touch `src/api/interactionService.ts:250-251`'s public `postgres_changes` channel or the hosted "Allow public access to channels" setting. That is story 2's open rollout item and this story must leave its dependency exactly as recorded in `rollout.md`.
- Do not filter or drop rows in `loadInteractionHistory`/`getInteractionHistory`. Those are the user's own server-authorized history, including rows exchanged with a former partner; erasing them is not what CAP-4 asks for.
- Do not add a `different_users` CHECK constraint to `interactions`, a new `public.` RPC, or a SECURITY DEFINER function. A definer function would turn every client into a privileged bypass (F5) and a new granted `public.` function would force an edit to the exact-list assertion at `supabase/tests/database/18_function_execute_grants.sql:128-132`.
- Do not change the `interactions` SELECT policy, the table's columns, or `src/types/database.types.ts` (the public schema's shape does not change).
- Do not link, unlink or repartner any Playwright worker-pool account.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Legitimate send | A is linked to B; A POSTs `{type:'poke', from_user_id:A, to_user_id:B}` | 201, one row created | No error expected |
| Stranger target | A linked to B; A POSTs `to_user_id: outsider` | Rejected, zero rows created | PostgREST 42501 RLS denial |
| Self target | A linked to B; A POSTs `to_user_id: A` | Rejected, zero rows created | 42501 |
| Spoofed sender | A POSTs `from_user_id: B, to_user_id: A` | Rejected, zero rows created | 42501 |
| Unlinked sender | Outsider with `partner_id IS NULL` POSTs to anyone | Rejected (`x = NULL` is never TRUE) | 42501 |
| Former-partner target | A's `partner_id` now points elsewhere; A POSTs to the old partner | Rejected | 42501 |
| Mark viewed | B received a row; B PATCHes `{viewed:true}` | Succeeds; `viewed` persists as `true` | No error expected |
| Forge on update | B PATCHes `{type:'kiss'}` / `{from_user_id:…}` / `{to_user_id:…}` / `{id:…}` / `{created_at:…}` | Rejected; every column unchanged when read back | 42501 column-privilege denial |
| Combined patch | B PATCHes `{viewed:true, type:'kiss'}` | Rejected as a whole; `viewed` still `false` | 42501 |
| Sender marks viewed | A PATCHes `{viewed:true}` on a row A sent | Zero rows affected; `viewed` unchanged | No error; RLS hides the row |
| Anon | Anon client SELECT/INSERT/UPDATE on `interactions` | Refused | Privilege denial |
| Incoming from partner | Subscribed as B with partner A; record `{from:A, to:B, viewed:false}` arrives | Added once; `unviewedCount` +1 | No error expected |
| Incoming from stranger | Same, record `{from: stranger, to:B}` arrives | Feed and `unviewedCount` unchanged | Logged and dropped |
| Incoming misaddressed | Record `{from:A, to: someone-else}` arrives | Feed and `unviewedCount` unchanged | Logged and dropped |
| Incoming before link | Subscribed while `partner_id` is null; any record arrives | Feed and `unviewedCount` unchanged | Logged and dropped |
| Already-viewed incoming | `{from:A, to:B, viewed:true}` | Added to the feed; `unviewedCount` unchanged | No error expected |
| Duplicate incoming | Same id delivered twice | Added once; badge counted once | No error expected |
| Send with no partner | `partner_id` is null; user taps poke | No request issued; toast `Error: Partner not configured` | `NoPartnerError` |

</intent-contract>

## Code Map

- `supabase/migrations/20251206024345_remote_schema.sql:228-233` — `"Users can insert interactions"`, `for insert to public with check ((( SELECT auth.uid() AS uid) = from_user_id));`. `:237-242` — `"Users can view interactions to/from them"` (SELECT, leave alone). `:316-321` — `"Users can update received interactions"`, `for update to public using ((( SELECT auth.uid() AS uid) = to_user_id));` with **no** `with check`. These three are the entire policy set on the table; the base-schema ones at `20251203000001_create_base_schema.sql:166-178` were dropped at `20251206024345:3,5,27`.
- `supabase/migrations/20251203000001_create_base_schema.sql:149-156` — the table: `id uuid pk`, `type`, `from_user_id`, `to_user_id`, `viewed boolean default false`, `created_at timestamptz default now()`. `type` became `text` + `interactions_type_check` at `20251206024345:53,89,91`.
- `supabase/migrations/20260725170000_grant_api_roles_on_public.sql:35` — `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;` and `:40-43` the matching `ALTER DEFAULT PRIVILEGES`. **No migration anywhere names `interactions` in a GRANT or REVOKE**, so this blanket grant is the table's whole ACL today.
- `supabase/migrations/20260818000002_create_events_table.sql:106-107` — the revoke-then-regrant precedent to copy: `revoke all on public.events from anon, authenticated;` / `grant select, insert, update, delete on public.events to authenticated;`. Also `20260817000000_love_note_removals.sql:108-109`. **No column-level grant exists anywhere in the repo** (`grep -rn -iE "grant .*\(.*\) on" supabase/migrations/` → zero hits), so `grant update (viewed)` is the first of its kind.
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:13-21` — `public.get_my_partner_id()`, `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, body `SELECT partner_id FROM public.users WHERE id = auth.uid();`. Granted to `authenticated` at `:23`, re-granted at `20260818000000_...:285`; `anon` and `PUBLIC` revoked by the loop at `20260818000000_...:241-260`.
- `supabase/migrations/20260912010000_private_couple_broadcast_policies.sql` — the newest migration and the house style for this change: a `-- ====` rationale header, `begin;` at `:47`, `commit;` at `:69`, `to authenticated`, plain `=` against `get_my_partner_id()` with the NULL reasoning spelled out at `:30-33`. A new migration must sort after `20260912010000`.
- `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:42-55` — `users_update_self_safe` `WITH CHECK (... AND partner_id IS NOT DISTINCT FROM public.get_my_partner_id())`: a client cannot repoint its own `partner_id`. Combined with `no_self_requests` on `partner_requests` (`20251206024345:105-107`) and `accept_partner_request` (`20260818000000_...:132-194`), `users.partner_id` can never equal `users.id` — which is why a partner-derived recipient already rejects self-targeting without a new CHECK constraint.
- `supabase/migrations/20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql:278-317` — the repo's only immutability trigger (`scripture_sessions_freeze_membership`, SECURITY INVOKER, errcode `42501`). Read its header at `:245-277` for the doctrine; this story does **not** need it, because column privileges cover the same invariant without a new function.
- `supabase/tests/database/` — 24 files; **nothing mentions `interactions`** (`grep -rn -i "interactions" supabase/tests/database/` → zero hits), so no existing pgTAP array constrains this change. `02_rls_policies.sql:70-93`'s `policies_are` calls are scripture-only; `01_schema.sql` covers scripture tables only.
- `supabase/tests/database/23_couple_broadcast_policies.sql:21-23,183-185` — the metadata-test shape to copy (`begin;` / `select plan(N);` / `select * from finish();` / `rollback;`), including `policies_are`, `policy_cmd_is`, `policy_roles_are` and raw `pg_policies` introspection at `:155-181`. `22_claude_bot_config_no_secret.sql:49-71` — the `set local role authenticated|anon|service_role` / `reset role` idiom for privilege assertions.
- `supabase/tests/database/00_helpers.sql:16-33,38-48,53-59` — `tests.create_test_user(email)`, `tests.authenticate_as(uuid)` (sets both the `role` GUC and `request.jwt.claims`), `tests.reset_role()`. Helpers live inside each file's transaction, so a new file re-creates the ones it needs, as `18_function_execute_grants.sql:31-55` does.
- `supabase/tests/database/20_events.sql:147-166` — the model for a table-privilege assertion, with the comment explaining why `anon`'s zero privileges are load-bearing and easy to lose.
- `src/api/interactionService.ts:153-205` `sendInteraction(type, toUserId, userId)` — inserts the caller-supplied `toUserId` verbatim. `:114-140` `sendPoke`/`sendKiss` pass it through. `:64-69` `InteractionWriteError` (not exported) and `:78-81` `networkFailure()` — the two local error builders; the module header at `:8-16` explains why `handleNetworkError` is never used here. `:398-419` `markAsViewed` already writes `{ viewed: true }` and nothing else.
- `src/api/supabaseClient.ts:117-151` `getPartnerId()` — reads the session, then `users.partner_id` for `auth.uid()`; returns `null` on every failure path including `PGRST116`. This is the authenticated relationship the recipient must come from.
- `src/utils/interactionValidation.ts:49-68` `validatePartnerId`, `:76-98` `validateInteraction(partnerId, type)`, `:112-121` `INTERACTION_ERRORS` (`NO_PARTNER` already exists). No incoming-row validator exists yet.
- `src/stores/slices/interactionsSlice.ts:44-45` `sendPoke/sendKiss: (partnerId: string)`, `:77-141` their implementations, `:218-261` `subscribeToInteractions` (identity guard at `:231-235` pairs `userId` with `authSessionVersion`; status guard at `:241`), `:263-285` `addIncomingInteraction` — dedupes on id and then adds unconditionally. `:37-54` the slice interface; `:10-18` the docblock recording cross-slice dependencies.
- `src/stores/slices/authSlice.ts:98-101` — the `// interactionsSlice` block of `signedOutState()`: `interactions: []`, `unviewedCount: 0`, `isSubscribed: false`. A new field goes here.
- `src/components/PokeKissInterface/PokeKissInterface.tsx:27` imports `getPartnerId`; `:178-195` and `:223-236` the offline guard then the `getPartnerId()` pre-check and its `'Error: Partner not configured'` toast; `:201` `await sendPoke(partnerId)`, `:242` `await sendKiss(partnerId)`; `:146` `subscribeToInteractions(handleStatusChange)`; `:457-470` the badge. Mounted only from `src/components/PartnerMoodView/PartnerMoodView.tsx:585`.
- `tests/api/interaction-record-ownership.spec.ts:42,63-89` — the positive PostgREST path (worker pair, sender inserts to partner, receiver reads it back); `:97-102` service-role cleanup. Worker pairs are pre-linked by `tests/support/auth/global-setup.ts:90-109,148-152`, so this spec stays green under the new policy.
- `tests/api/check-constraint-error-mapping.spec.ts:107-117` — **breaks under the new policy**: the `interactions` row posts `to_user_id: userId` (self), which RLS now refuses before the CHECK constraint can fire. `resolveOwnPair` (`tests/support/helpers/events.ts:70-85`) supplies the partner id this row needs.
- `tests/support/helpers/rls-security.ts:14-36` `createUserClient(admin, userId)` and `:43-93` `createOutsiderClient(admin, prefix)` → `{ client, userId, cleanup }` — the ready-made unlinked attacker identity. `tests/support/fixtures/index.ts:73,105` `supabaseAdmin` / `supabaseAsUser`; `tests/support/fixtures/auth.ts:47,58` `authToken` / `partnerAuthToken`. Specs import `{ test, expect }` from `tests/support/merged-fixtures.ts`.
- `playwright.config.ts:153-163` — the `api` project is directory-scoped to `tests/api` with `baseURL = SUPABASE_URL`; priority tags live in the test title (`package.json:28-29`).
- `tests/support/harnesses/interaction-record-ownership.tsx:44,58-64,90-95` — mounts the real `PokeKissInterface`, monkey-patches `InteractionService.prototype.subscribeInteractions`, and dispatches every record verbatim ("Filtering here would hide a missing production guard"). `:66` `setAuthUser(userId)`. Its page is `tests/support/harnesses/interaction-record-ownership.html` (reads `?userId=`), driven by `tests/support/fixtures/interaction-record-ownership.ts:19-29`.
- `tests/e2e/partner/interaction-record-ownership.spec.ts:13,18` — `authSessionEnabled: false` with `randomUUID()` identities, so no real session exists in the browser: the partner identity has to come through the harness, not through `getPartnerId()`.
- `tests/unit/api/interactionService.test.ts:74-80` — `vi.mock('@/api/supabaseClient', …)` currently exposing only `supabase`, `channel`, `removeChannel`; it needs `getPartnerId`. `tests/unit/api/fakeInteractionsBackend.ts:84-89` `RLS_DENIED` is a hand-copied 42501 envelope.
- `tests/unit/stores/interactionsSubscription.test.ts:20-24` — builds a real store from `createAuthSlice` + `createInteractionsSlice` with `src/api/interactionService` mocked; `tests/unit/stores/signOutClearsAccountState.test.ts:290-299` asserts the interactions reset.
- `node_modules/` was absent in this worktree; `npm ci` has been run (exit 0).

## Tasks & Acceptance

**Execution:**

- `supabase/migrations/20260912020000_partner_only_immutable_interactions.sql` — create — the authorization boundary, inside one `begin;`/`commit;` with a `-- ====` header recording each decision:
  1. `drop policy "Users can insert interactions" on public.interactions;` then `create policy "interactions_sender_to_partner_insert" on public.interactions for insert to authenticated with check (from_user_id = (select auth.uid()) and to_user_id = public.get_my_partner_id());`
  2. `drop policy "Users can update received interactions" on public.interactions;` then `create policy "interactions_recipient_marks_viewed" on public.interactions for update to authenticated using (to_user_id = (select auth.uid())) with check (to_user_id = (select auth.uid()));`
  3. `revoke all on public.interactions from anon, authenticated;` then `grant select, insert on public.interactions to authenticated;` and `grant update (viewed) on public.interactions to authenticated;` — the column grant is what makes `type`/`from_user_id`/`to_user_id`/`id`/`created_at` immutable; the table-level `ALL` from `20260725170000:35` must be revoked first or it subsumes the column grant. Leave `service_role` untouched.
  Leave the SELECT policy exactly as it is.
- `supabase/tests/database/24_interactions_partner_only.sql` — create — pgTAP covering both halves. Metadata: `policies_are('public','interactions', …)` listing all three policy names, `policy_cmd_is` for each, `policy_roles_are` `{authenticated}` for the two new ones, and PERMISSIVE checks via `pg_policies`. Privileges: `has_table_privilege('authenticated','public.interactions','SELECT'|'INSERT')` true, `not has_table_privilege('authenticated', …, 'UPDATE'|'DELETE')`, `has_column_privilege('authenticated', …, 'viewed','UPDATE')` true, `not has_column_privilege` for `type`, `from_user_id`, `to_user_id`, `id`, `created_at`, `not has_table_privilege('anon', …)` for SELECT/INSERT/UPDATE/DELETE, and `service_role` still holding DELETE. Behaviour: re-create the `00_helpers.sql` helpers locally, create three users, link two of them by setting `users.partner_id` both ways before switching role, then `tests.authenticate_as` each and assert with `lives_ok`/`throws_ok` every write row of the I/O matrix, reading persisted values back after each rejected UPDATE.
- `src/api/interactionService.ts` — edit — `sendInteraction(type, userId)` resolves the recipient itself with `await getPartnerId()`, throws `NoPartnerError` when it is null, runs the resolved id through `validateInteraction(partnerId, type)` and throws on failure, then inserts. `sendPoke(userId)` / `sendKiss(userId)` lose their `partnerId` parameter. Also add `resolvePartnerId(): Promise<string | null>` that simply returns `getPartnerId()`, so the store has one seam the E2E harness can patch the way it already patches `subscribeInteractions`. Keep the offline guard first, keep both local error builders and the `InteractionWriteError` re-throw, leave `subscribeInteractions` and its public channel untouched, and update the JSDoc to say the recipient is server-derived.
- `src/utils/interactionValidation.ts` — edit — export `class NoPartnerError extends Error` carrying `INTERACTION_ERRORS.NO_PARTNER`, and `validateIncomingInteraction(record, { currentUserId, partnerId })` returning `{ isValid, error? }`: requires a non-null `partnerId`, `record.to_user_id === currentUserId`, `record.from_user_id === partnerId`, and a valid `type`. Reuse `isValidUUID`/`isValidInteractionType`.
- `src/stores/slices/interactionsSlice.ts` — edit — `sendPoke`/`sendKiss` take no argument and pass only `currentUserId` to the service. Add `interactionPartnerId: string | null` to the slice state, resolved once in `subscribeToInteractions` via a new `interactionService.resolvePartnerId()` before subscribing, refreshed from the status callback on `SUBSCRIBED`, and set back to `null` by the returned teardown. `addIncomingInteraction` runs `validateIncomingInteraction(record, { currentUserId: get().userId, partnerId: get().interactionPartnerId })` and returns early (logging the reason) before the dedupe, the feed write and the `unviewedCount` increment. Keep the existing `userId`/`authSessionVersion` guards untouched and update the slice docblock.
- `src/stores/slices/authSlice.ts` — edit — add `interactionPartnerId: null` to the `// interactionsSlice` block of `signedOutState()`.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` — edit — drop the `getPartnerId` import and both pre-checks, call `sendPoke()` / `sendKiss()`, and in each catch show `'Error: Partner not configured'` when the error is a `NoPartnerError` and the existing `'Failed to send poke/kiss. Try again.'` otherwise. The offline guard stays first and unchanged.
- `tests/api/interaction-authorization.spec.ts` — create — real PostgREST in the `api` project, titles tagged `[P0]`. Use `resolveOwnPair` for the linked pair, `authToken`/`partnerAuthToken` for their JWTs and `createOutsiderClient` for an unlinked attacker. Cover every send row of the I/O matrix plus the F5 update rows against a legitimately received row, asserting persisted values through `supabaseAdmin` after each rejection (a zero-row update is not proof). Clean up with the service-role client; link or unlink nothing.
- `tests/api/check-constraint-error-mapping.spec.ts` — edit — the `interactions` entry's `body` takes the partner id and posts `to_user_id: partnerId`, so the CHECK constraint is the only thing the row violates; resolve the pair with `resolveOwnPair`.
- `tests/support/harnesses/interaction-record-ownership.tsx`, `…/interaction-record-ownership.html`, `tests/support/fixtures/interaction-record-ownership.ts` — edit — thread a `partnerId` through `mount(userId, partnerId)` and the query string, and patch `InteractionService.prototype.resolvePartnerId` to return it alongside the existing `subscribeInteractions` patch. Keep dispatching every record verbatim.
- `tests/e2e/partner/interaction-record-ownership.spec.ts` — edit — mount with a partner id and build every record that is expected to be **accepted** with `from_user_id: partnerId`; add one dispatch from a stranger id asserting the feed and badge do not move.
- `tests/unit/utils/interactionValidation.test.ts` — edit — cover every `validateIncomingInteraction` row of the matrix (partner, stranger, misaddressed, null partner, bad type) and `NoPartnerError`'s message.
- `tests/unit/api/interactionService.test.ts` — edit — add `getPartnerId` to the `@/api/supabaseClient` mock; assert the insert's `to_user_id` is the resolved partner and is never a caller-supplied value, that a null partner throws `NoPartnerError` before any request is issued, and that the offline guard still precedes the partner lookup. Keep every existing case green.
- `tests/unit/stores/interactionsSubscription.test.ts` — edit — assert the partner snapshot is resolved before `subscribeInteractions` is called, refreshed on `SUBSCRIBED`, cleared by teardown, and that stranger/misaddressed/no-partner records leave `interactions` and `unviewedCount` untouched while a partner record is accepted exactly once.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — edit — add `interactionPartnerId` to the reset assertion.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` — edit — update the store mock for the no-argument actions and add a case asserting the `NoPartnerError` toast.

**Acceptance Criteria:**
- Given a clean local stack, when `supabase db reset` and `supabase test db` run, then every pgTAP file passes including `24_interactions_partner_only.sql`, and `public.interactions` carries exactly the three expected policies.
- Given the new migration replayed from scratch, when `pg_policies` and the ACL are inspected, then both new policies are `{authenticated}` and PERMISSIVE, `authenticated` holds no table-level UPDATE or DELETE on `interactions`, and its only UPDATE privilege is on the `viewed` column.
- Given two linked worker accounts, when the sender POSTs a poke and a kiss to the partner, then both are created and the recipient can read them back — and the recipient's badge increments exactly once per delivered row.
- Given a legitimately received row, when the recipient PATCHes `viewed` alone it succeeds and persists, and when it PATCHes any other column — alone or combined with `viewed` — the request is refused and every column including `viewed` is unchanged on re-read.
- Given an unlinked outsider client, when it attempts to insert, read or update any interaction belonging to the worker pair, then every attempt is refused and no row is created or altered.
- Given the app's own suites, when `npm run test:unit` runs, then every pre-existing interaction case still passes alongside the new validation cases, and `npm run typecheck` is clean with the new action signatures.
- Given each new guard is reverted one at a time, when the affected suite runs, then only that guard's own cases fail.
- Given `npm run lint`, `npm run typecheck`, `npm run test:unit` and `fnox exec -- npm run build`, when they run, then all pass (3 pre-existing `EventCountdown.tsx` lint warnings are baseline).
- Given `rollout.md`'s "Database protections" row, when this story closes, then it records that the migration is applied locally and still awaits `deploy.yml`, and story 2's Realtime rollout row is left exactly as it is.

### Results (2026-09-12)

All commands were run on the patched tree, in this worktree, against the local Supabase stack.

- `npm ci` — exit 0 (`node_modules/` was absent in this worktree).
- `supabase db reset` — every migration replays clean, `20260912020000_partner_only_immutable_interactions.sql` applied last.
- `supabase test db` — 25 files, **302** pgTAP tests, PASS (254 at baseline; +48 from `24_interactions_partner_only.sql`).
- `npm run test:unit` — 111 files, **2066** tests pass (2037 at baseline).
- `npx playwright test --project=api` over `interaction-authorization`, `interaction-record-ownership`, `check-constraint-error-mapping` and `interaction-realtime` — 9 passed.
- `npx playwright test --project=chromium tests/e2e/partner/` — 6 passed.
- `npm run typecheck` — clean. `npm run lint` — 0 errors, 3 pre-existing `EventCountdown.tsx` warnings.
- `fnox exec -- npm run build` — exit 0.

**Mutation matrix (red-then-green), each guard reverted one at a time:**

| Guard reverted | What failed | What stayed green |
|---|---|---|
| the INSERT policy's `to_user_id = get_my_partner_id()` conjunct (applied with `psql`, then restored) | pgTAP 8, 27, 28, 30, 31, 43, 44; API "the insert boundary accepts only the caller and their current partner" | every other pgTAP file; the immutability API test |
| `grant update (viewed)` replaced by table-level UPDATE | pgTAP 12, 15–19, 35–41; API "a received interaction is viewed-only for its recipient" | the insert-boundary API test |
| `addIncomingInteraction`'s partner check | the four new `interactionsSubscription` guard cases | 352 other store/component tests |
| the service's recipient derivation | the four `interactionService` derivation cases | 275 other API-unit tests |
| `sendPoke`'s post-await identity re-check | only "keeps a send that resolves after an account switch out of the new account feed" | the other 15 cases in that file |
| the subscribe-time identity re-check | only "does not write the snapshot when the account changes during the lookup" | the other 15 |
| the `SUBSCRIBED` refresh identity re-check | only "does not let a reconnect refresh write the snapshot after sign-out" | the other 15 |

**Measurements worth recording:**
- PostgREST answers an authenticated denial (RLS or privilege) with **403**, and the same denial to an anonymous caller with **401**. The body carries SQLSTATE `42501` in both cases, so both are asserted on the code as well as the status.
- `set local role anon` in pgTAP does **not** clear `request.jwt.claims`; the anon block clears them explicitly so `auth.uid()` is genuinely null.
- `src/main.tsx:40` renders under `StrictMode`, which is what makes the subscription double-mount race real in development — the reason the partner snapshot is account state rather than subscription state.

**Manual checks:**
- `select policyname, cmd, roles, permissive, with_check from pg_policies where schemaname='public' and tablename='interactions'` — three rows; the two new ones `{authenticated}`, PERMISSIVE, `get_my_partner_id()` in the INSERT `with_check`, a non-null UPDATE `with_check`.
- `information_schema.column_privileges` for `authenticated` on `interactions` — UPDATE on `viewed` only.
- `git diff src/` — confined to `interactionService.ts`, `interactionValidation.ts`, `interactionsSlice.ts`, the `signedOutState()` interactions block and `PokeKissInterface.tsx`. `subscribeInteractions`' public `postgres_changes` channel and `src/types/database.types.ts` are untouched.


## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 38 findings — high 0, medium 8, low 27, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) `rollout.md` never updated, though the story's own last AC requires it — real: stories 2 and 3 each added a "status after story N" section and this diff had none; patched by adding **Database protections — status after story 5 (2026-09-12)**, recording the selected alternative, both evidence surfaces, the measured 403/401 split and what is still outstanding for hosted closure.
  - `[low]` `[patch]` (blind-hunter) `resolveOwnPairIds` in the check-constraint spec duplicates the shared `resolveOwnPair` — grouped with the verification-gap row below; patched: the local duplicate was deleted and `tests/support/helpers/events.ts`'s `resolveOwnPair` imported, leaving only the single-id helper the other rows need.
  - `[low]` `[patch]` (blind-hunter) A failed `subscribeInteractions` leaves a non-null partner snapshot with nothing listening — grouped with the teardown-race row below; same root cause: the snapshot's lifetime was tied to one subscription instance instead of to the account.
  - `[low]` `[patch]` (blind-hunter) An older subscription's teardown nulls a newer one's snapshot, silently refusing real records — verified reachable: `src/main.tsx:40` renders under `StrictMode`, so the first effect's teardown runs after a second `subscribeToInteractions` has already taken its snapshot; patched by deletion — the teardown no longer clears `interactionPartnerId`, which is account state cleared by `signedOutState()` and overwritten by each subscribe. That also settles the failed-subscribe row above.
  - `[false]` `[reject]` (blind-hunter) The SUBSCRIBED refresh is a floating promise with no `.catch()` — `resolvePartnerId()` wraps `getPartnerId()`, whose body is one `try` returning `null` from every failure path (`src/api/supabaseClient.ts:148-151`), so there is no rejection to leave unhandled.
  - `[low]` `[reject]` (blind-hunter) The reconnect refresh has an unclosed staleness window — real but bounded and fail-closed: records arriving during the in-flight refresh are validated against the previous partner and refused, never accepted. The smallest fix is a generation counter for a state that needs a repartner concurrent with a reconnect, which was not demonstrated reachable.
  - `[low]` `[patch]` (blind-hunter) `validateInteraction` inside `sendInteraction` has a dead type branch and a message telling the user to check settings for a server-derived id — verified: `sendInteraction` is private and every caller passes a literal type; patched to `validatePartnerId(toUserId)` with a truthful message, and the unit case updated.
  - `[low]` `[reject]` (blind-hunter) `validateIncomingInteraction` skips `isValidUUID` and never checks `record.id` — the equality checks against a snapshot read from a `uuid` column already imply UUID shape, and `id` is a non-null uuid primary key, so the guard would cover a state not shown reachable.
  - `[low]` `[reject]` (blind-hunter) Two spellings of the invalid-type rejection, and new inline literals bypass `INTERACTION_ERRORS` — developer-only tidiness with no named harm; the fix adds constants and public surface for strings only tests read.
  - `[medium]` `[patch]` (blind-hunter) `sendPoke`/`sendKiss` `set()` after an `await` with no identity re-check — real, and this change widened the window by adding a second round trip ahead of the insert: the previous account's poke lands in the next account's feed on a shared device. Patched with the `eventsSlice`/`loadInteractionHistory` guard shape, returning the true record to its own caller; red-then-green reproduced.
  - `[low]` `[patch]` (blind-hunter) The pgTAP anon block runs with the previous user's JWT claims installed — verified: `set local role anon` does not clear `request.jwt.claims`, so `auth.uid()` still answered; patched by clearing the claims before the block.
  - `[low]` `[patch]` (blind-hunter) The migration's "SELECT policy deliberately untouched" promise is asserted by nothing — patched: after the relationship moves on, both the former sender and the former recipient are asserted to still read the two rows (INT-DB-044/045).
  - `[low]` `[patch]` (blind-hunter) The API spec has no anon case although the I/O matrix promises one — patched with GET/POST/PATCH as the anon key; the measurement is worth having: PostgREST answers an anonymous denial **401**, not 403, with SQLSTATE 42501 in the body.
  - `[low]` `[patch]` (blind-hunter) The forged-`id` PATCH generates an id cleanup cannot reach — patched: the id is bound and included in the service-role cleanup set.
  - `[low]` `[reject]` (edge-case-hunter) A transient `getPartnerId` failure nulls the snapshot and drops every incoming record for the mount — the window is already closed by the refresh this change added: `SUBSCRIBED` fires moments after subscribing and re-resolves. A retry policy would guard a state that needs both lookups to fail.
  - `[low]` `[patch]` (edge-case-hunter) `subscribeInteractions` rejecting after the snapshot was stored leaves it set with no teardown left to clear it — grouped with the snapshot-lifetime entry; resolved by making the snapshot account state.
  - `[low]` `[reject]` (edge-case-hunter) Out-of-order refresh promises could restore an older partner id — grouped with the staleness-window row; same rejection, same generation-counter cost.
  - `[medium]` `[patch]` (edge-case-hunter) `sendPoke`'s optimistic `set` is unguarded across an account switch — grouped with the blind-hunter row; patched there.
  - `[medium]` `[patch]` (edge-case-hunter) `sendKiss`'s optimistic `set` is unguarded across an account switch — same entry, same fix.
  - `[false]` `[reject]` (edge-case-hunter) `resolvePartnerId`/`validateInteraction` throw outside the `try`, so an un-normalised error escapes — neither can throw (`getPartnerId` swallows everything; `validatePartnerId` returns a result), and the two errors raised there are the module's own `NoPartnerError` and `InteractionWriteError`, exactly like the offline guard that already sits outside the `try`.
  - `[low]` `[reject]` (edge-case-hunter) The removed pre-check means the FAB now collapses and shows a busy state before reporting no partner — real but cosmetic, in a state a linked couple never reaches; keeping the old ordering needs either a second partner lookup in the component or a new branch.
  - `[low]` `[patch]` (edge-case-hunter) `validateInteraction`'s invalid-type branch is newly dead — grouped with the service-validation row; patched there.
  - `[low]` `[reject]` (edge-case-hunter) `validateIncomingInteraction` never calls `isValidUUID` — grouped with the blind-hunter row; same rejection.
  - `[low]` `[patch]` (edge-case-hunter) The API spec omits the matrix's "Former-partner target" row — grouped with the intent-alignment row below; patched in pgTAP, where INT-DB-043 now repoints A's `partner_id` at a third account instead of nulling it, so it stops duplicating the unlinked case.
  - `[medium]` `[patch]` (verification-gap) The new post-await identity guard in `subscribeToInteractions` is exercised by no test — pre-verified; patched with a deferred-promise case that signs out mid-lookup and asserts no snapshot is written and no subscription opened. Reverting the guard now fails exactly that case.
  - `[medium]` `[patch]` (verification-gap) The identity guard inside the `SUBSCRIBED` refresh is likewise untested — pre-verified; patched with the matching deferred-promise case. Reverting the re-check fails exactly that case.
  - `[medium]` `[patch]` (verification-gap) No test runs the slice's `sendPoke`/`sendKiss`, so the `NoPartnerError` chain is unpinned at the store seam — pre-verified; patched with three cases: the service is called with the sender id and nothing else, the `NoPartnerError` instance propagates unchanged, and a send resolving after an account switch stays out of the new feed.
  - `[low]` `[patch]` (verification-gap) `PokeKissInterface.test.tsx` still mocks `supabaseClient` after the component stopped importing it — patched by deleting the mock; the suite still passes.
  - `[low]` `[defer]` (verification-gap) `loadInteractionHistory` recomputes `unviewedCount` from unfiltered rows, so a non-partner row can raise the badge when the history modal opens — real, but pre-existing and reachable only from a former partner's rows or a forgery inserted before this migration; filtering there would read `interactionPartnerId`, which is null before a subscription, and would zero the badge. Deferred with the settling check.
  - `[low]` `[patch]` (verification-gap) The check-constraint spec duplicates `resolveOwnPair` — grouped with the blind-hunter row; patched there.
  - `[low]` `[defer]` (intent-alignment) `loadInteractionHistory` is a second write path to the badge that no reading of F4 reaches in the diff — grouped with the verification-gap row; same deferral.
  - `[low]` `[reject]` (intent-alignment) Fail-closed is pinned; the "legitimate relationship loading" half is untested — grouped with the transient-failure row; same refutation, the `SUBSCRIBED` refresh closes the window.
  - `[low]` `[reject]` (intent-alignment) Send and badge are proven on different surfaces and never joined — the local stack has no tables in the `supabase_realtime` publication, recorded at `tests/api/interaction-realtime.spec.ts:12-16`, so a real INSERT cannot be used as a delivery probe without mutating shared parallel infrastructure. No bad outcome was demonstrated.
  - `[low]` `[reject]` (intent-alignment) `resolvePartnerId()` is a production seam added to make the harness surface reachable — deliberate and documented in its JSDoc: a direct `getPartnerId()` import would leave the E2E guard untestable and push the harness into filtering records, which its own comment forbids.
  - `[low]` `[patch]` (intent-alignment) INT-DB-043 tested the unlinked condition, not the repointed one — grouped with the edge-case row; patched there.
  - `[false]` `[reject]` (intent-alignment) The revoke also strips `anon` and `DELETE`, wider than the contract asked — no bad outcome: nothing in `src/` deletes an interaction (`grep -n "from('interactions')" src/` returns only the select/insert/update-viewed call sites) and no anon path reads the table. It is the `20260818000002_create_events_table.sql:106-107` revoke-then-regrant shape, and both removals are asserted.
  - `[medium]` `[patch]` (intent-alignment) The evidence-recording surface is empty — `rollout.md` unchanged and the story's Verification lists expectations rather than results — grouped with the blind-hunter row; patched there and in **Verification → Results** below.
  - `[low]` `[reject]` (intent-alignment) The no-partner UI path moved surfaces — grouped with the FAB-collapse row; same rejection.

## Auto Run Result

Status: done

### Summary of implemented change

`public.interactions` no longer trusts the row it is handed. A forward migration
replaces the INSERT policy with one requiring the caller to be the sender **and**
the recipient to be `public.get_my_partner_id()`, states the UPDATE policy's
`WITH CHECK` instead of letting PostgreSQL reuse `USING`, and narrows the ACL so
`authenticated` holds `select, insert` plus `update (viewed)` and nothing else —
which is what makes `type`, `from_user_id`, `to_user_id`, `id` and `created_at`
immutable. `anon` keeps nothing; `service_role` is untouched.

On the client the recipient stopped being a parameter: `interactionService`
derives it from the authenticated relationship, and `sendPoke`/`sendKiss` take
only the sender id all the way up to the component. Incoming rows are checked
against a partner snapshot before they can reach the feed or the badge.

### Files changed

- `supabase/migrations/20260912020000_partner_only_immutable_interactions.sql` — new; the two policies and the revoke-then-regrant, with the reasoning for each decision in its header.
- `supabase/tests/database/24_interactions_partner_only.sql` — new; 48 assertions covering policy metadata, table and column privileges, and role-sensitive behaviour as `authenticated` and as `anon`.
- `src/api/interactionService.ts` — `sendInteraction` derives the recipient and drops its `toUserId` parameter; new `resolvePartnerId()` seam; `validatePartnerId` replaces the dead-branch `validateInteraction` call.
- `src/utils/interactionValidation.ts` — new `validateIncomingInteraction()` and `NoPartnerError`.
- `src/stores/slices/interactionsSlice.ts` — `sendPoke`/`sendKiss` take no recipient and re-check identity before their optimistic write; new `interactionPartnerId` account state, resolved at subscribe and refreshed on `SUBSCRIBED`; `addIncomingInteraction` rejects non-partner rows.
- `src/stores/slices/authSlice.ts` — `interactionPartnerId` reset in `signedOutState()`.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` — sends with no recipient and maps `NoPartnerError` to the existing "Partner not configured" toast.
- `tests/api/interaction-authorization.spec.ts` — new; the whole boundary over real PostgREST with real JWTs, an unlinked outsider and the anon key.
- `tests/api/check-constraint-error-mapping.spec.ts` — the interactions row targets the partner, so the CHECK constraint is still the only violation.
- `tests/support/harnesses/interaction-record-ownership.{tsx,html}`, `tests/support/fixtures/interaction-record-ownership.ts`, `tests/e2e/partner/interaction-record-ownership.spec.ts` — a partner identity threaded through the harness, plus a stranger-dispatch case.
- `tests/unit/{api,stores,utils}/…` and `src/components/PokeKissInterface/__tests__/` — unit coverage for the derivation, the incoming guard, the three identity guards and the toast.
- `_bmad-output/specs/spec-security-remediation/rollout.md` — **Database protections — status after story 5**.

### Review findings breakdown

38 findings across four layers — high 0, medium 8, low 27, false 3, maybe-false 0.
Thirteen root-cause entries were patched, one was deferred, and the rest were
rejected on their refutation or as low findings whose fix added complexity for a
state not shown reachable. Every finding has its own row in the Review Triage
Log above.

**Patched (13 entries; 4 `medium`, 9 `low`):** the missing `rollout.md` record;
the unguarded optimistic `set` in both send actions; test coverage for the two
new post-await identity guards; test coverage for the slice's send path; the
partner snapshot's lifetime (now account state, so a StrictMode teardown cannot
blank a live one); the service's dead type-validation branch and its misleading
message; the pgTAP anon block's leftover JWT claims; an assertion that
former-partner history stays readable; the former-partner case repointed rather
than nulled; the duplicated `resolveOwnPair`; the unreachable forged id in
cleanup; an anon case in the API spec; and a dead module mock.

**Deferred (1):** `loadInteractionHistory` recomputes `unviewedCount` from
unfiltered rows, so a former-partner or pre-migration row can still raise the
badge when the history modal opens. Pre-existing, and the only available filter
handle is null before a subscription opens. The ledger entry carries the
settling query.

**Rejected (with reasons):** three `false` — the SUBSCRIBED refresh has no
rejection path because `getPartnerId` returns `null` from every failure branch;
nothing in `sendInteraction` throws outside the `try` that is not the module's
own error type; and the wider revoke removes privileges with no consumer
(`grep -n "from('interactions')" src/` finds only select/insert/update-viewed).
The remaining rejections are `low` findings whose smallest fix adds a generation
counter (refresh staleness, out-of-order refresh), a guard for an unreachable
state (UUID checks behind an equality test against a `uuid` column), string
constants for developer-only tidiness, retry policy for a window the
`SUBSCRIBED` refresh already closes, a branch for the FAB collapsing in a state
a linked couple never reaches, or infrastructure the local stack does not have
(no tables in the `supabase_realtime` publication, so a real INSERT cannot probe
delivery).

### Follow-up review recommendation

`true`. Four `medium` entries were patched on a first pass, which is above the
threshold. The specific unverified risk: **the partner snapshot's lifetime
change is argued from a `StrictMode` double-mount race that no browser test
reproduces.** The teardown no longer clears `interactionPartnerId`, and the
justification — `src/main.tsx:40` renders under `StrictMode`, so the first
effect's teardown runs after a second subscription has taken its snapshot — was
established by reading the effect in `PokeKissInterface.tsx:132-166`, not by
observing a dropped record in a browser. The unit suite covers the new
semantics, but nothing exercises the double-mount ordering that motivated them.
Patched counts by verdict: high 0, medium 4, low 9.

### Verification performed

See **Verification → Results (2026-09-12)** above for the full command list,
the seven-row mutation matrix, and the recorded measurements. In short:
`supabase test db` 302 passing (+48), `npm run test:unit` 2066 passing (+29 over
baseline), 9 API and 6 browser Playwright tests passing, typecheck clean, lint 0
errors, and `fnox exec -- npm run build` exit 0. Each of the seven guards fails
only its own cases when reverted individually.

### Matrix test audit

All 18 I/O matrix rows are covered by tests that ran and passed. The send rows
(legitimate, stranger, self, spoofed sender, unlinked, former partner) and the
update rows (mark viewed, five single-column forgeries, combined patch, sender
marks viewed, anon) are covered twice — in `24_interactions_partner_only.sql`
against the database and in `tests/api/interaction-authorization.spec.ts`
through PostgREST, except the former-partner row, which is pgTAP-only. The five
incoming rows and the duplicate/already-viewed rows are covered in
`tests/unit/stores/interactionsSubscription.test.ts` and
`tests/e2e/partner/interaction-record-ownership.spec.ts`; the send-with-no-partner
row in `tests/unit/api/interactionService.test.ts` and the component test.

### Residual risks

- **Nothing is deployed.** The migration reaches the hosted project only through
  `.github/workflows/deploy.yml`. Until it runs, the hosted table keeps the old
  policies and the blanket `ALL` grant, and `rollout.md`'s Database protections
  row stays open with the post-deploy check to run.
- **Rows forged before the fix are not cleaned up.** The migration closes the
  hole; it does not audit or delete anything already inserted. That is what the
  deferred badge entry would settle.
- **`interactionService`'s public `postgres_changes` channel is unchanged**, by
  contract — it remains story 2's open dependency for disabling public Realtime
  access.
- **Badge-on-delivery is not proven end to end.** The local stack has no tables
  in the `supabase_realtime` publication, so no test moves a real INSERT through
  the real subscription to a rendered badge; delivery is proven as insert
  acceptance plus a harness-driven store and UI path.

## Design Notes

**Why column privileges rather than a trigger or an RPC.** `rollout.md`'s F4/F5 row says to prefer the narrow privilege configuration if actual grants and clients support it. They do: the only UPDATE the app ever issues is `markAsViewed`'s `{ viewed: true }` (`interactionService.ts:400-403`). Revoking table-level UPDATE and granting `update (viewed)` makes every other column immutable for `authenticated` without adding a function — which matters because a new granted `public.` function would have to be inserted into the exact-list assertion at `18_function_execute_grants.sql:128-132`, and a SECURITY DEFINER one is explicitly forbidden by F5. The trigger at `20260818000001_...:278-317` remains the fallback if a column grant turns out to break PostgREST; it does not, because PostgREST only needs UPDATE on the columns actually in the payload.

**Why the table-level revoke has to come first.** `20260725170000_grant_api_roles_on_public.sql:35` grants `ALL ON ALL TABLES` to `authenticated`, and a table-level UPDATE subsumes any column grant. `revoke all … from anon, authenticated` then re-granting exactly `select, insert` (+ the column UPDATE) is the same revoke-then-regrant shape `20260818000002_create_events_table.sql:106-107` uses, and it is what makes `anon` lose privileges it never needed.

**Why no new CHECK constraint for self-targeting.** `to_user_id = public.get_my_partner_id()` already rejects it: `users.partner_id` cannot be your own id, because a client cannot write `partner_id` at all (`users_update_self_safe` WITH CHECK, `20260205000001:50-55`) and the only writer, `accept_partner_request`, sources both ids from a `partner_requests` row that carries `no_self_requests` (`20251206024345:105-107`). Adding a constraint would also add a second failure mode to `check-constraint-error-mapping.spec.ts`, whose interactions row already has to move to a partner recipient.

**Why the recipient is derived in the service, not passed in.** F4 says to derive the target from the authenticated relationship rather than trusting a caller-supplied UUID. Deriving it at `sendInteraction` removes the UUID from the boundary entirely instead of validating it after the fact, and it leaves exactly one lookup per send — `PokeKissInterface` no longer does its own, so the component's `'Error: Partner not configured'` toast now comes from a typed `NoPartnerError` instead of a pre-check. The offline guard stays ahead of everything, for the reason written at `PokeKissInterface.tsx:178-183`.

**Why the partner snapshot is resolved at subscribe time.** `addIncomingInteraction` is synchronous and runs inside a Realtime callback, so it cannot await a lookup per row. Resolving once before `subscribeInteractions` and refreshing on `SUBSCRIBED` mirrors `moodSyncService`'s pattern from story 2 without its refcounted registry, which interactions do not have. A partner linked *while* the subscription is live is covered by remounting: `PokeKissInterface` lives inside `PartnerMoodView` (`:585`), and the partner-linking UI is a different `currentView`, so returning to it re-subscribes and re-resolves.

**Why `resolvePartnerId()` is a service method.** `tests/e2e/partner/interaction-record-ownership.spec.ts` runs with `authSessionEnabled: false` and random UUIDs, so a direct `getPartnerId()` call would return `null` in the browser and reject every record the spec expects to be accepted. The harness already patches `InteractionService.prototype`; putting the lookup behind a method on the same prototype gives it the one seam it needs without weakening the production path or letting the harness filter records itself.

**Why history is left alone.** CAP-4's success criterion is about incoming rows altering the feed and badge. `loadInteractionHistory` reads rows the server already authorized for this user — including exchanges with a former partner, which are legitimately the user's own history. Filtering them client-side would delete real history to fix a problem the INSERT boundary now prevents at the source.

## Verification

**Commands:**
- `npm ci` — expected: exit 0 (already run; `node_modules/` was absent in this worktree).
- `supabase start && supabase db reset` — expected: all migrations replay clean, `20260912020000` applied last.
- `supabase test db` — expected: every file passes, including the new `24_interactions_partner_only.sql`.
- `npx playwright test tests/api/interaction-authorization.spec.ts tests/api/interaction-record-ownership.spec.ts tests/api/check-constraint-error-mapping.spec.ts` — expected: all pass; the two pre-existing specs prove the legitimate paths survive.
- `npx playwright test tests/e2e/partner/interaction-record-ownership.spec.ts tests/e2e/partner/interaction-subscription-warning.spec.ts` — expected: pass.
- `npm run test:unit` — expected: green, with every pre-existing interaction case still passing.
- `npm run lint && npm run typecheck` — expected: 0 errors (3 pre-existing `EventCountdown.tsx` warnings are baseline).
- `fnox exec -- npm run build` — expected: exit 0. A bare `npm run build` would exit 0 with a secret-less bundle.
- Red-then-green, one guard at a time: revert the INSERT policy's recipient conjunct, the column grant, the `addIncomingInteraction` partner check and the service-side derivation individually, and confirm only that guard's own cases fail.

**Manual checks (if no CLI):**
- `select policyname, cmd, roles, permissive, qual, with_check from pg_policies where schemaname='public' and tablename='interactions'` — expected: three rows; the two new ones `{authenticated}`, PERMISSIVE, with `get_my_partner_id()` in the INSERT `with_check` and a non-null UPDATE `with_check`.
- `select grantee, privilege_type, column_name from information_schema.column_privileges where table_name='interactions' and grantee='authenticated'` — expected: UPDATE on `viewed` only.
- `git diff src/` — expected: changes confined to `interactionService.ts`, `interactionValidation.ts`, `interactionsSlice.ts`, the `signedOutState()` interactions block and `PokeKissInterface.tsx`; nothing in `src/api/interactionService.ts:236-283` (the public Realtime channel) and nothing in `src/types/database.types.ts`.
