---
title: 'Separate profile names from auth identity'
type: 'bugfix'
created: '2026-09-12'
status: done
baseline_revision: e193b92b520841a77d601c0df1661e2f9a253add
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      An unnamed partner is rendered as their full email address in the chat, while the
      own-name path falls back to the email prefix.
    evidence: |-
      getPartnerDisplayName returns the stored display_name verbatim and LoveNotes renders
      it. For a profile still carrying the trigger's email seed that value IS the email.
      Pre-existing: this function is untouched by story 8 and behaved identically before,
      because the old trigger also seeded display_name from the email. The fix is to share
      one seed-fallback classification between the own-name and partner-name readers.
    location: >-
      src/api/supabaseClient.ts (getPartnerDisplayName)
    severity: low
  - summary: >-
      If a public.users row were ever absent while its auth user exists, the setup modal
      could never be satisfied, and the users INSERT policy now has no client caller.
    evidence: |-
      lookupOwnDisplayName maps PGRST116 to `unset`, which opens the modal, while
      DisplayNameSetup's plain UPDATE cannot create the row and `id` is outside the new
      column grant. No reachable path to that state was demonstrated: public.users.id is
      REFERENCES auth.users(id) ON DELETE CASCADE and no client code deletes profiles. What
      would settle it: whether any operator or admin path deletes a public.users row without
      deleting the auth user. The intent requires the INSERT policy be left untouched, so
      removing the now-callerless policy is out of scope here regardless.
    location: >-
      src/components/DisplayNameSetup/DisplayNameSetup.tsx (zero-row branch)
    severity: medium (unverified)
  - summary: >-
      Hosted evidence for the migration has not been recorded.
    evidence: |-
      The story's execution list asks for a hosted refused email PATCH, a hosted own-name
      change, and green FN-GRANT checks against the hosted project. The migration reaches
      that project only through .github/workflows/deploy.yml on merge, so this evidence
      cannot be produced before the branch lands. Outstanding operator action.
    severity: low
  - summary: >-
      The acceptance criterion "the name shows in chat after reload" is not covered end to
      end.
    evidence: |-
      display-name-setup.spec.ts asserts the saved profile row and the app container after
      reload but never navigates to love notes; OwnDisplayName.test.tsx covers the chat
      rendering with getOwnDisplayName mocked. Closing this needs a partner-linked dedicated
      account, which the setup spec's throwaway nameless account does not have.
    location: >-
      tests/e2e/auth/display-name-setup.spec.ts
    severity: low
  - summary: >-
      The ledger entry migrated from this story's second deferred item lost its severity
      when it was written to deferred-work.md.
    evidence: |-
      Verified by reading the block: `### DW-105` in
      _bmad-output/implementation-artifacts/deferred-work.md goes straight from
      `source_spec:` to `reason:` with no `severity:` line, while DW-104, DW-106 and DW-107
      each carry `severity: low`. This spec's frontmatter records that same item as
      `severity: medium (unverified)`, so DW-105 is the only non-low severity of the four
      and it is the one the ledger dropped. Not repaired here: this run was instructed not
      to modify, re-open or rewrite existing ledger entries -- the orchestrator owns them.
      Raised through this list because it is the only channel back to the owner.
    location: >-
      _bmad-output/implementation-artifacts/deferred-work.md (DW-105)
    severity: low
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

## Review Triage Log

### 2026-09-13 — Review pass
- verdicts: 36 findings — high 0, medium 10, low 17, false 6, maybe-false 3
- findings:
  - `[low]` `[defer]` Partner name renders an unnamed partner's full email while the own-name path falls back to the email prefix — real, but `getPartnerDisplayName` is untouched by this diff and returned the raw column before it; pre-existing asymmetry, deferred.
  - `[low]` `[reject]` `LoveNotes` makes a redundant `/auth/v1/user` round-trip for the email — `authService.getUser()` was already there before this change; no new request is added and restructuring is more than a direct correction.
  - `[low]` `[reject]` The gate re-reads the profile on every auth notification with no short-circuit — real (one PostgREST GET per auth event, ~hourly), but a short-circuit adds state and branching for negligible gain.
  - `[medium]` `[patch]` Nothing pins that the gate is reachable from a page load rather than only a sign-in transition — grouped with the verification-gap finding below; fixed by adding a reload assertion to `display-name-setup.spec.ts`.
  - `[low]` `[reject]` The newly client-writable `display_name` has no server-side length constraint — real, but the obvious 3–30 CHECK would break the trigger's own email seed for any address longer than 30 characters, so the fix is neither direct nor safe.
  - `[low]` `[patch]` pgTAP asserted only 4 of the 6 columns the migration names as outside the grant — added PROF-DB-033 (`partner_name`) and PROF-DB-034 (`device_id`), plan raised to 34.
  - `[low]` `[reject]` The `'Unknown'` arm of the seed COALESCE is asserted nowhere in the database — reachable only when both the metadata name and the email are null, which the test helper cannot produce (it requires an email).
  - `[false]` `[reject]` Seed matching is inconsistently normalized (`'Unknown'` exact, email case-insensitive) — exact matching is correct for a literal the trigger writes verbatim; case-insensitive matching would misclassify a user who deliberately chose "unknown".
  - `[low]` `[reject]` The four new gate tests sit in the `Home event-load session ownership` describe block — real misfiling, but the cases use different render helpers so the move is not mechanical, and no user or developer is misled by it in practice.
  - `[low]` `[reject]` `createNamelessAccount` duplicates `createOutsiderClient` — the shared helper also builds a signed-in client this spec does not need and returns a different cleanup shape; consolidating is a refactor, not a direct correction.
  - `[low]` `[patch]` The `login.spec.ts` users glob also matches the partner read, and the `/auth/v1/user` stub carried stale `user_metadata` — removed the stale `user_metadata` field; the glob overlap left as-is because narrowing it needs a user id the test does not know in advance.
  - `[low]` `[defer]` Hosted deploy evidence and end-to-end "name shows in chat" coverage are absent, and the Code Map said `24_` where the file shipped as `25_` — deploy evidence is a post-merge operator action; the filename note would be an edit to this build's spec and is rejected on that ground.
  - `[medium]` `[patch]` A user can submit their own email or `'Unknown'` as a name; the write lands and every later read classifies it `unset`, re-opening setup permanently — confirmed at `DisplayNameSetup.tsx:41-43` (length-only validation) against `supabaseClient.ts` seed classification; fixed with a write-side guard refusing exactly what the read side calls a seed.
  - `[maybe-false]` `[defer]` A missing profile row yields a setup modal that can never be satisfied — `public.users.id` is `REFERENCES auth.users(id) ON DELETE CASCADE` and no client code deletes profiles, so no reachable path was shown; would be medium if an operator path exists.
  - `[medium]` `[patch]` A gate flip to `unset` mid-session unmounts the whole app tree, discarding unsent work — same root cause as the seed-name finding above; the write-side guard removes the only demonstrated trigger.
  - `[low]` `[reject]` An auth email change while the name still holds the old email seed makes a never-chosen name read as `chosen` — the app has no email-change UI (the intent forbids adding one), so this needs direct GoTrue API use; the fix adds a column and a comparison.
  - `[low]` `[reject]` No database length bound on `display_name` — duplicate of the CHECK-constraint finding above, rejected for the same seed-conflict reason.
  - `[medium]` `[patch]` The post-reload assertion passes on the initial `needsDisplayName=false` state whether or not the gate ran — grouped with the page-load coverage gap; the added reload assertion observes a nameless account instead.
  - `[medium]` `[patch]` `partner-mood.spec.ts`'s `**/rest/v1/users**` wait now also matches the gate read, so it can resolve before `loadPartner` runs — confirmed by reading the spec; glob narrowed to the partner query.
  - `[false]` `[reject]` Worker-pool accounts would be blocked by the setup modal — refuted: 51 signed-in E2E specs across partner, home and mood pass; `ensureUser` creates pool accounts with a metadata name, which the trigger's INSERT seed writes into the profile row.
  - `[maybe-false]` `[defer]` The removed upsert leaves the `users` INSERT policy and privilege without a client caller — grouped with the missing-row finding; the intent requires the INSERT policy be left untouched, so no fix is available here anyway.
  - `[medium]` `[patch]` The `lookupOwnDisplayName` comment claims an email-as-name user "is asked once more" when the classification recomputes on every read — same root cause as the seed-name finding; comment corrected alongside the guard.
  - `[low]` `[patch]` The `App.tsx` comment claims `setAuthUser` advances `authSessionVersion`, but `authSlice.ts:356` advances it only when `previous !== userId` — a reader could delete `displayNameReadRef`, the only same-identity guard; comment corrected.
  - `[medium]` `[patch]` No test covers the write→read round trip, so a name the form accepts is never asserted to read back as `chosen` — pre-verified gap; closed by the write-side guard plus its unit cases.
  - `[medium]` `[patch]` The gate's page-load path is never exercised for an account with no chosen name — pre-verified gap; closed by the reload assertion in the first setup test.
  - `[medium]` `[patch]` `partner-mood.spec.ts` broad users glob — duplicate of the flake finding above; fixed by the same glob narrowing.
  - `[low]` `[patch]` `implicit-fragment-rejection.spec.ts` cited `App.tsx:527` for the overlay early return, now at `:573` — citation updated.
  - `[false]` `[reject]` Granting column UPDATE to `authenticated` violates "Grant nothing new to `authenticated`" — the same intent bullet instructs that grant, and the clause's stated justification is FN-GRANT-008, an EXECUTE-only assertion; no contradiction.
  - `[false]` `[reject]` Naming `anon` in the revoke exceeds the literal instruction — `anon` held no UPDATE policy on `users`, so nothing behavioural changes; strictly safer and asserted by PROF-DB-016/017/031.
  - `[maybe-false]` `[defer]` A genuinely absent profile row is unrecoverable — duplicate of the missing-row finding; deferred on the same evidence.
  - `[low]` `[reject]` The own-name and partner-name reads are indistinguishable at the URL surface, so a stub answers both — duplicate of the `login.spec.ts` glob finding; narrowing needs a user id the test does not know in advance.
  - `[medium]` `[patch]` The modal now settles a microtask after render, so a nameless account briefly sees the shell — grouped with the page-load coverage gap; the added reload assertion pins the observable outcome.
  - `[low]` `[reject]` Client name rules live only at the component surface with no database bound — duplicate of the CHECK-constraint finding, rejected for the same seed-conflict reason.
  - `[low]` `[reject]` The `service_role` EXECUTE assertion landed in `25_` rather than extending FN-GRANT-009 in `18_` — discoverability only; `25_` cross-references `18_` explicitly and the assertion does run.
  - `[false]` `[reject]` `App.eventsSession.test.tsx`'s precondition moved onto a mocked API surface — a necessary consequence of moving the name out of the session object, not a defect.
  - `[false]` `[reject]` A client can still change its authoritative email through GoTrue — changing your own auth email is a legitimate authenticated self-service operation; CAP-9/F9 concerns the `public.users` mirror, which is now closed.

### 2026-09-13 — Review pass (follow-up)
- verdicts: 32 findings — high 0, medium 0, low 25, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` The citation the previous pass "fixed" points at the wrong line — confirmed: `implicit-fragment-rejection.spec.ts:168` said `src/App.tsx:573`, which is `}}` closing `LoginScreen`'s `onLoginSuccess`; the overlay early return is `:581`. Corrected to `:581`.
  - `[low]` `[patch]` `login.spec.ts` still carried the `user_metadata` that actually gates — confirmed at `:72`: the previous pass removed it from the `/auth/v1/user` stub but not from the `/auth/v1/token` stub, whose `user` object is what the client persists as `session.user`. Removed; the spec now passes only because the profile-read stub answers.
  - `[low]` `[patch]` `scripture-lobby.ts:337` waits on any `/rest/v1/users` 2xx, which the new gate read can now satisfy before `loadPartner` runs — real, and the same shape this diff fixed in `partner-mood.spec.ts`. Graded `low` not `medium`: no live spec reaches `navigateToTogetherRoleSelection` (`grep -rln` over `tests/e2e` returns nothing; only `together-mode.ts` and `scripture-together.ts`, themselves unused), so the flake is latent. Narrowed to `select=partner`, matching `merged-fixtures.ts:38`.
  - `[false]` `[reject]` The gate read is missing from the network-error monitor's `excludePatterns` — no unrelated failure was shown: the 51-spec signed-in suite passes, and the one harness whose synthetic token 401s already routes the request. An exclusion would suppress exactly the refusals this story creates.
  - `[false]` `[reject]` `auth-bootstrap-notification-order.ts:37` routes `select=display_name*` and so would also answer a partner read — no partner read exists in that harness (`getPartnerDisplayName` has one caller, `LoveNotes.tsx:85`, which the harness never mounts), so the overlap produces no wrong answer.
  - `[low]` `[defer]` `DW-105` in the ledger is missing its `severity:` line while DW-104/106/107 carry theirs — confirmed by reading the block; it is the only `medium (unverified)` of the four. Not repaired: this run was instructed not to modify ledger entries. Deferred so the owner sees it.
  - `[low]` `[reject]` carried — Code Map names `24_profile_name_email_ownership.sql` but the file shipped as `25_` (and `24_` is story 7's). Verified still true; the fix is an edit to this build's spec, which triage rejects on that ground.
  - `[low]` `[reject]` The `[patch]` row claiming a nameless account no longer "briefly sees the shell" changed no code — confirmed: `needsDisplayName` starts `false` (`App.tsx:120`), `authLoading` clears in `checkAuth`'s `finally` independent of the gate (`:258`), and the gate settles after a PostgREST round trip (`:286-301`), so the shell does render first and the reload assertion cannot observe it. Rejected anyway: the window is one round trip on a brand-new account's first load with no data at risk, and the smallest fix (a `gateSettled` flag blocking render) delays every signed-in user's load behind a network read.
  - `[low]` `[patch]` `DisplayNameSetup.test.tsx` states that only the exact message is meaningful, then asserts bare `toBeInTheDocument()` at `:174` and `:183` — confirmed; the fail-closed zero-row branch the file exists to protect was matched by any throw. Pinned to `'Could not find your profile to save the name to'` and `'User not authenticated'`.
  - `[low]` `[reject]` The fail-closed branch renders raw PostgREST text (`'permission denied for table users'`) to the end user — real, but reachable only on a misconfigured deployment, and mapping it to friendly copy is a new string plus a test change, not a direct correction.
  - `[false]` `[reject]` Nothing pins the `public.users` policy set, so a future re-widening of UPDATE would go unnoticed — refuted: this story's protection is a column grant, not a policy, and PROF-DB-008..013/033/034 assert all eight columns exactly. A policy cannot restore a revoked column privilege.
  - `[false]` `[reject]` `lookupOwnDisplayName` re-derives identity from its own `getSession()` instead of the captured `ownerId` — no wrong gate decision results: `App.tsx:288-290` rechecks `userId !== ownerId || authSessionVersion !== ownerVersion` and discards a mismatched answer, and the ref guard is required for same-identity supersession regardless.
  - `[low]` `[defer]` carried — own-name and partner-name readers classify the same column differently. Already `DW-104`; the untested-partner half asks for seed tests on a function that has no seed rule.
  - `[low]` `[reject]` A nameless account mounts `initializeApp`, Realtime subs and lazy views before the gate unmounts them — same root cause as the shell-flash entry above and rejected on the same grounds; the churn costs a round trip and no demonstrated state.
  - `[false]` `[reject]` A failed first profile read leaves a new user never asked for a name for the session — refuted: `onAuthStateChange` calls `resolveDisplayNameGate` for every notification with a session, so the next `TOKEN_REFRESHED` re-reads. Fail-open on a read error is also exactly what the intent's matrix specifies.
  - `[low]` `[reject]` `global-setup`'s repair path can no longer fix a pool account's profile name — mechanism confirmed, but the bad state is unreachable: `git log -L21,35` shows `ensureUser` has passed `user_metadata.display_name` on create since the file was introduced, so the trigger's INSERT branch seeded every pool row with the real name. Residual is that editing the `displayName` constant no longer propagates; the fix adds a service-role write, more than a direct correction.
  - `[low]` `[reject]` The write-side guard and the read-side classification compare against different email sources (`getUser()` server email vs `getSession()` cached JWT) — the two rules were compared line by line and agree today; a disagreement needs the auth email to change without a JWT refresh, which the app has no path to (the intent forbids an email-change UI). Sharing one source is a two-module refactor.
  - `[low]` `[patch]` carried claim, new evidence — verification-gap filed the `scripture-lobby` settle-wait as `patch`; same entry as the narrowing above.
  - `[low]` `[reject]` verification-gap filed "a nameless account cannot reach the app" as unpinned, disposition `patch` — the claim holds as filed, but its proposed test (assert `app-container` count 0 while the read is held open) would fail against current code, so it is a code change in test clothing. Routed with the shell-flash entry.
  - `[low]` `[reject]` grouped with the `global-setup` entry above; same root cause, same refutation.
  - `[low]` `[reject]` carried — the seed guard is a component rule, not a column boundary. Unchanged from the previous pass's rejection of the CHECK-constraint fix.
  - `[low]` `[reject]` carried — own and partner reads are byte-identical at the URL surface. Previously rejected; the one place a user id is available (`auth-bootstrap`) has no partner read to confuse.
  - `[low]` `[reject]` The seed rule is mirrored at the write surface with the email clause hand-duplicated — the follow-up risk the previous pass named, and this pass's main question. Compared directly: both trim, both match `SEED_FALLBACK_NAME` exactly, both compare email case-insensitively. They agree, and `ownDisplayNameContract.test.ts` pins the constant against the real module. Extracting a shared predicate adds an export; no present defect. (The sub-claim that the length rule runs on the untrimmed name is `false`: `DisplayNameSetup.tsx:57` passes `displayName.trim()`.)
  - `[low]` `[defer]` carried — "name shows in chat" is verified with the helper mocked. Already `DW-107`.
  - `[low]` `[reject]` The setup test is titled "for new OAuth users" but creates a password account — wording predates this change (the case was skipped before), and the mechanism it drives, absent metadata name, is the one OAuth bootstrap produces.
  - `[low]` `[reject]` "Password signup with metadata name sees no setup screen" is asserted at the database (PROF-DB-019), never at the gate — real coverage gap; closing it is a new E2E case, more than a direct correction, and the pool suite exercises the path 51 times over.
  - `[low]` `[reject]` carried — own/partner reads indistinguishable at the URL surface; duplicate of the entry above.
  - `[false]` `[reject]` The diff adds a third staleness guard (`displayNameReadRef`) beyond the two the intent names — not a defect: `authSlice.ts:356` advances `authSessionVersion` only when the user id changes, so the pair cannot retire a same-identity superseded read, which the diff's own test demonstrates.
  - `[low]` `[reject]` The untouched `implicit-fragment-rejection.spec.ts` used the absence of the setup overlay as a race-free proof, which an async gate weakens — the test's decisive assertion is `storedSessionUserId(page, STORAGE_KEY) === workerUserId` at `:174`, which is unaffected and still detects a accepted fragment. Only the comment's justification is now loose; its line number was corrected as a separate patch.
  - `[false]` `[reject]` carried — the migration's revokes name `anon` and `service_role` beyond the intent's literal list. Previously refuted; strictly safer and pinned by PROF-DB-003/004/005/016/017/031.
  - `[low]` `[reject]` carried — two helpers ship where the approach says "one own-name helper", and `LoveNotes` still calls `authService.getUser()` for the email. Both previously rejected; the pair mirrors `lookupPartnerId`/`getPartnerId` and the auth read predates this change.
  - `[low]` `[defer]` carried — all migration evidence is local; hosted evidence awaits merge. Already `DW-106`.

## Auto Run Result

Status: done
Blocking condition: none

### Summary

Follow-up review pass over the story-8 change (no re-implementation). The implemented behaviour is unchanged: `sync_user_profile()` maintains only `email` and `updated_at` on its conflict branch so a chosen name survives every auth update; `authenticated` holds `UPDATE (display_name, updated_at)` on `public.users` and no table-level UPDATE, so the client can set its own name and cannot touch the `email` mirror; the client writes the name straight to the profile row and both readers go through the new own-name helper.

The specific risk the first pass flagged as unverified — that the write-side guard in `DisplayNameSetup` and the seed classification in `lookupOwnDisplayName` are two independent copies of one rule with nothing asserting they agree — was checked directly this pass. They agree: both trim, both match `SEED_FALLBACK_NAME` by exact equality, both compare the email case-insensitively, and `ownDisplayNameContract.test.ts` pins the constant against the real module rather than a mock. The risk is discharged.

### Files changed

Four test-side corrections, no `src/` or migration changes:

- `tests/e2e/auth/implicit-fragment-rejection.spec.ts` — the overlay citation the first pass corrected pointed at `App.tsx:573` (a closing brace); repointed to `:581`, the `if (needsDisplayName)` early return.
- `tests/e2e/auth/login.spec.ts` — dropped the stale `user_metadata` still sitting in the `/auth/v1/token` stub, the object the client persists as `session.user`; the spec now passes only via the profile read.
- `tests/support/helpers/scripture-lobby.ts` — narrowed the settle wait from any `/rest/v1/users` 2xx to `select=partner`, so the new gate read cannot resolve it ahead of `loadPartner`.
- `src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx` — pinned the two loose error assertions to their exact messages, so the fail-closed zero-row branch is no longer matched by any throw.

### Review findings

- 32 findings across four layers — high 0, medium 0, low 25, false 7, maybe-false 0.
- Patched: 4 entries, all `low` (citation, login stub, settle wait, test assertions).
- Deferred: 1 — `DW-105` reached the ledger without its `severity:` line. Not repaired here: this run was told not to modify ledger entries, so it is raised through the spec's `deferred` list instead.
- Rejected: 27, each with its reason in the triage log above. Ten were carried from the first pass's rows and re-verified as still true; the substantive new rejections are the shell-flash entry (real, but one round trip on a brand-new account's first load, and the fix would block every user's render on a network read), the `global-setup` repair path (mechanism real, bad state unreachable — `ensureUser` has always seeded metadata on create), and four `false` refutations: the monitor exclusion, the bootstrap route overlap, the missing `policies_are`, and the re-derived identity in `lookupOwnDisplayName`.

### Follow-up review

`followup_review_recommended: false`. This pass patched four entries, all `low`, and no `high`. The first pass's named risk was checked and discharged. The work has converged.

### Verification performed

- `npm run lint` — 0 errors (3 pre-existing `react-refresh` warnings in `EventCountdown.tsx`, untouched here).
- `npm run typecheck` — clean.
- `npm run test:unit` — 89 files, 1668 tests, all passed, including the two tightened `DisplayNameSetup` assertions.
- `supabase db reset && supabase test db` — 14 files, 250 tests, PASS.
- `fnox exec -- npm run build` — succeeded.
- Playwright `chromium`: `login.spec.ts` + `display-name-setup.spec.ts` 6 passed; `implicit-fragment-rejection.spec.ts` + `bootstrap-notification-order.spec.ts` + `partner-mood.spec.ts` 11 passed. The login redirect case is the one whose stub changed, and it passes on the profile read alone.

### Residual risks

- A nameless account still renders the shell for the duration of one profile GET before the setup modal replaces it. Verified real and deliberately not fixed — see the triage row; the trade is a network round trip added to every signed-in user's first render.
- `scripture-lobby.ts` has no live spec consumer today, so the narrowed wait is untested in CI; it will matter whenever a together-mode spec returns.
- Hosted evidence (a refused `email` PATCH, an accepted own-name change, FN-GRANT checks green against the hosted project) is still outstanding — the migration reaches the hosted project only through `deploy.yml` on merge. Tracked as `DW-106`.
