# Implementation and Rollout

The report's scripture exclusion depends on the separately approved [removal plan](../spec-remove-scripture-feature/SPEC.md), specifically its app, database and cache removal capabilities. This queue does not execute that plan. Do not describe its seven excluded findings as resolved while those surfaces remain, and reconcile shared files if the removal lands before or during this work.

## Agreed bmad-loop queue

Sallvain approved these eight independently reviewable slices and their checkpoint settings on September 12. `stories.yaml` carries the dispatch entries; its list order defines execution order.

| ID | Story | Contract | Dependencies |
|---|---|---|---|
| 1 | Contain the exposed bot credential | CAP-1 / F1 | First priority; external rotation evidence may remain awaiting-operator. |
| 2 | Authorize and validate couple broadcasts | CAP-2, CAP-3 / F2, F3 | Shared sender, private subscriptions, policies and receiver/render validation ship together. |
| 3 | Require browser-initiated auth callbacks | CAP-13 / F13 | Isolated auth change; later profile work must retain these callback tests. |
| 4 | Guard photo continuations across accounts | CAP-12 / F12 | Independent of database changes. |
| 5 | Enforce partner-only immutable interactions | CAP-4, CAP-5 / F4, F5 | Recipient restriction and viewed-only mutation validated together. |
| 6 | Bound image upload request buffering | CAP-10 / F10 | Separate Edge Function deployment and endpoint verification. |
| 7 | Partition custom messages by account | CAP-8 / F8 | IndexedDB ownership/upgrade and all service/store paths ship together. |
| 8 | Separate profile names from auth identity | CAP-9 / F9 | Profile sync, write protection and all three client consumers ship together. |

Sallvain's latest direction supersedes the earlier checkpoints: `spec_checkpoint: false`, `done_checkpoint: false` and `invoke_dev_with: ""` on all eight stories. The loop sessions handle the work automatically; no planned human review stop remains.

For this run only, Sallvain delegates routine planning, migration-alternative selection, implementation, testing, review-finding fixes and in-scope operational remediation to the loop sessions without additional approval. This direction supersedes the earlier approval requirements in this contract and the corresponding general AGENTS.md rules. Research, concrete plans, tests, review and evidence remain required; the loop performs them rather than waiting for a person.

## Migration alternatives for the loop to evaluate

The loop must evaluate the config-level alternatives below and document its selected plan before changing a schema. Sallvain's task-specific automation direction authorizes the loop to choose and execute the in-scope plan without another approval checkpoint.

| Boundary | Config-level alternative | Proposed approach and reason |
|---|---|---|
| F1 secret seeding | Replace committed literals with deployment/local environment injection. | Use the existing fnox/GitHub Secrets mechanisms; remove live literals and make optional bot provisioning explicit. No new secrets store. Rotation remains a real Auth action. |
| F2/F3 Realtime | Disable public Realtime access in hosted settings. | Use that setting as a rollout safeguard after checking existing consumers; settings alone cannot distinguish one couple from another. Add directional RLS on private topics and private client subscriptions. |
| F4/F5 interactions | Tighten RLS and revoke broad UPDATE in favor of a `viewed` column grant. | Partner-scoped INSERT plus viewed-only writes. Prefer the narrow privilege configuration if actual grants/clients support it; otherwise use an invoker immutability trigger or narrow RPC with explicit role tests. |
| F8 IndexedDB | Hide AdminPanel, clear state on logout or move to separate per-account database names. | None establishes ownership for every persisted service path; separate databases duplicate schema/opening logic and still need a legacy decision. Use the shared database with owner fields/index and checks at the service boundary. |
| F9 profiles | Revoke broad UPDATE and grant only supported profile columns. | This may be sufficient if all legitimate writes are inventoried. The report's proposed invoker email-immutability trigger preserves existing unrelated profile writes and allows the definer auth-sync path; separately stop sync from overwriting names. |

Before implementing a database slice, document a concrete plan covering objects, current grants/policies, effective roles, backward compatibility and checks. Select the supported alternative and implement it step by step within this contract; do not stop for routine plan approval.

Use forward migrations for live database behavior. F1 source sanitization is a deliberate edit to the old seed file because the literal itself is the defect; it cannot repair an already-applied production migration. Confirm replacements work before deleting code. Keep generated database types generated. Check latest definitions and actual policy sets, including `02_rls_policies.sql`, `16_photos_storage_update_policy.sql` and function-execute grant assertions, rather than relying on the report's earlier statement that a particular table lacks a test.

## Verification gates

- For every code slice, run lint, the full project typecheck and the affected unit/integration tests. Add tests at the boundary that failed; mocked client tests alone cannot demonstrate RLS, private Realtime authorization, auth callback rejection or role-sensitive triggers.
- For database slices, verify clean migration replay in a disposable local stack, `supabase test db`, and authenticated/anon/outsider negative cases plus valid partner operations. Inspect persisted data after failed mutations. Regenerate types when the public schema changes.
- Use dedicated accounts/isolated clients for adversarial cases. Shared Playwright worker-pool accounts must not be linked/unlinked or reset by a spec. Use merged fixtures and the normal worker-index contract from AGENTS.md.
- For private Realtime, use real subscription/send outcomes and state/UI assertions. Exercise a malicious public subscription to the same topic as well as private joins. Policies are evaluated at join/auth refresh, so test reconnection and explicit identity/relationship changes; do not claim per-message relationship revalidation from RLS alone.
- For IndexedDB, test service calls directly, account-switch promise races and fresh/legacy database upgrades. For F10, assert body consumption/cancellation and Storage calls. For F13, use the installed SDK and real callback semantics with sanitized tokens.
- Before release, run the required aggregate checks, including coverage if enforced by CI, and a secret-injected production build. Use `fnox exec -- npm run build`; the smoke script alone cannot prove the app loads. Exercise the built app and affected user journeys against the intended test environment.
- Keep test results tied to the actual commit. If a PR is opened or pushed, immediately arm the commit-pinned Claude review waiter and read/triage the full matching-run comment as AGENTS.md specifies. This run's automation authorization covers fixes and follow-up pushes for findings that hold within the agreed scope; the loop verifies those fixes without a routine approval stop.

## Operational completion

Apply authorization policies before private clients rely on them. After valid private delivery is verified, disable public Realtime access if compatible with all remaining consumers, reconnect clients and address installed PWA versions still broadcasting publicly. Do not briefly restore public fallback to make a failed deployment appear healthy. If a global setting conflicts with another live consumer, report the concrete dependency before changing it and keep rollout completion open.

Follow `.github/workflows/deploy.yml` for Pages/database shipping; never run `npm run deploy`. Inventory the Edge Function deployment mechanism independently. Determine any existing-data/grant incompatibility through read-only inspection before applying changes; do not silently delete or rewrite customer data to make a migration pass.

The loop must first attempt in-scope external actions through available authorized integrations, including bot credential containment and the required deployments. Do not automatically classify them as human-only work. If access is unavailable or a required action cannot be performed by the session, finish and commit the agent-doable work, record the concrete access/action blocker, and use the installed loop's `awaiting-operator` outcome so independent stories can continue. `bmad-loop confirm` is for actions already performed and verified, not a way to waive them. Overall remediation remains incomplete while any finding's operational acceptance is outstanding.

Resolve routine implementation and test failures within the loop's configured retries. Removing checkpoints does not disable verification or manufacture credentials/access: unresolved contradictions, exhausted retries and actions outside this contract can still require escalation. Report the specific blocker rather than asking for an approval already granted here.

| Work | Required evidence before closure |
|---|---|
| Bot containment | Password rotated; old login rejected; intended consumers work; session/refresh-token revocation or bounded expiry explicitly accounted for. Never record credential values. |
| Realtime rollout | Policies applied; updated clients use private topics; hosted public-access setting/old-client handling recorded; outsider denied and partner delivery confirmed after reconnect. |
| Database protections | Forward migrations selected under this run's authorization and applied to the intended project; role-sensitive checks and existing-data compatibility verified. Code merged without deployment is not production closure. |
| PKCE | Real supported OAuth callback completes from the initiating browser; attacker-fragment callback rejected; Pages redirect/base path and enabled signup confirmation behavior verified. |
| Edge Function | Bounded handler deployed separately from Pages; supported browser upload succeeds and an over-limit request is rejected without a Storage write. Record actual Content-Length behavior. |

### Realtime rollout — status after story 2 (2026-09-12)

Open. The code half is done and verified on the local stack; the operational half is not.

- **Done and verified locally.** `20260912010000_private_couple_broadcast_policies.sql` adds the two directional `realtime.messages` policies; `supabase/tests/database/23_couple_broadcast_policies.sql` pins the six-policy set; `useRealtimeMessages` and `moodSyncService` subscribe with `private: true` and validate every payload; `sendEphemeralBroadcast` sends over the private REST broadcast endpoint. `tests/api/couple-broadcast-authorization.spec.ts` measures partner delivery on both topics, delivery after a reconnect, outsider and anon private joins denied, an outsider send denied, and legitimate delivery still working afterwards.
- **A write-only private JOIN is refused.** A sender holding INSERT and no SELECT cannot open a private websocket channel to the partner's topic ("You do not have permissions to read from this Channel topic", realtime v2.124.4). The REST broadcast endpoint evaluates the same INSERT policy without a join — partner send 202 and delivered, outsider send 403 and rejected — so sends go over REST and the SELECT policy was not widened.
- **Public access stays Enabled, and here is the concrete dependency.** `src/api/interactionService.ts:251` is still a public `postgres_changes` channel with no policy, and installed PWA builds are still on the old public topics. Measured: an anon **public** join to `love-notes:<victim>` reaches `SUBSCRIBED` on this stack, and receives none of the privately-sent broadcasts. The setting was not flipped.
- **The hosted REST broadcast route is live — dependency satisfied, not outstanding.** Every outgoing love note and mood now goes through `channel.httpSend`, which requires a Realtime that serves `/realtime/v1/api/broadcast` (realtime-js rejects a 404 with "requires Realtime server v2.97.0 or newer"), and the version had until now only been measured on the local container. Probed on the hosted project at `$VITE_SUPABASE_URL/realtime/v1/api/broadcast` with the publishable key and an empty `messages` array: HTTP 422 `{"errors":{"messages":["can't be blank"]}}`. A 422 from the route's own validator means the route exists and is serving, so this dependency is met.
- **Still outstanding for closure.** The migration applied to the hosted project via `.github/workflows/deploy.yml`; the hosted "Allow public access to channels" value actually read (not read in this session — the MCP project endpoint exposes no Realtime settings); `interactionService` moved off its public channel; old installed PWA clients handled; then, and only then, the decision on disabling public access.

Full measurements, with the log lines they came from, are in `stories/2-authorize-and-validate-couple-broadcasts.md` under **Operational Evidence**.

### PKCE — status after story 3 (2026-09-12)

Open. The code half is done and verified; the hosted half is not.

- **Done and verified locally.** `src/api/supabaseClient.ts` sets `flowType: 'pkce'`. A foreign implicit fragment is refused before any network call, and an existing session survives it — measured in a real browser with a real second account's complete token set (`tests/e2e/auth/implicit-fragment-rejection.spec.ts`, both signed out and signed in) and against the app's own client module (`tests/unit/api/supabaseClientAuthFlow.test.ts`, which asserts zero requests, the discriminator that fails under the implicit default). The app's client also redeems a `?code=` for a flow it started, so the acceptance path is pinned rather than assumed. `tests/api/pkce-code-exchange.spec.ts` mints a real GoTrue code and shows only the initiating client redeems it; a client with no verifier is refused locally without burning the code, and one with a wrong verifier is refused by the server.
- **The hosted project issues the PKCE authorize redirect.** `GET /auth/v1/authorize?provider=google&…&code_challenge_method=s256` returned HTTP 302 to `accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `access_type=offline`, `prompt=consent`. `/auth/v1/settings` reads `"google": true`, `"mailer_autoconfirm": false`, `"disable_signup": false`.
- **PKCE does not change the redirect URL.** `experimental.appendPkceFlowIdToRedirects` defaults off, so `redirect_to` stays exactly `${origin}${BASE_URL}` — asserted both in the unit case and on the real button click. Whatever allow-list entry makes today's Google sign-in work keeps matching.
- **Still outstanding for closure.** One real Google sign-in completed from the initiating browser on the deployed site (the consent step needs Google credentials this session does not hold); the hosted redirect-URL allow list actually read (the authorize endpoint does not validate `redirect_to` up front — a bogus value returned the same 302 with no error — and the MCP project endpoint exposes no auth settings); and the change shipped to Pages through `deploy.yml`.
- **Recorded consequence, not a regression to fix.** With `mailer_autoconfirm: false`, a hosted signup-confirmation link opened in a *different* browser than the one that signed up no longer establishes a session. The account is still confirmed server-side and password sign-in works. This is CAP-13's intent, and it reaches no user today: nothing in `src/components/` calls `signUp`, and there is no `/reset-password` route.

Full measurements are in `stories/3-require-browser-initiated-auth-callbacks.md` under **Operational Evidence**.

### Database protections — status after story 5 (2026-09-12)

Open. The code half is done and verified on the local stack; the hosted half is not.

- **Done and verified locally.** `20260912020000_partner_only_immutable_interactions.sql` replaces the two weak `public.interactions` policies and narrows the ACL: INSERT now requires `from_user_id = (select auth.uid()) and to_user_id = public.get_my_partner_id()`; UPDATE is recipient-only with an explicit `with check`; `authenticated` holds `select, insert` plus `update (viewed)` and nothing else, and `anon` holds nothing. `service_role` is untouched, because the Playwright specs delete their fixtures with the service key.
- **The narrow privilege configuration was the alternative selected**, per this file's F4/F5 row. It supports every write the app makes — `markAsViewed` sends `{ viewed: true }` alone — so no trigger and no RPC were added; an RPC would also have forced an edit to the exact-list assertion in `supabase/tests/database/18_function_execute_grants.sql`. The invoker trigger at `20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql:278-317` is recorded as the fallback if a column grant ever stops fitting the API.
- **Role-sensitive evidence exists at two real surfaces.** `supabase/tests/database/24_interactions_partner_only.sql` (48 assertions) runs as `authenticated` and as `anon` against the real database; `tests/api/interaction-authorization.spec.ts` runs the same rules through PostgREST with real user JWTs and a throwaway outsider account. Every refusal is followed by an admin read-back, so a silent zero-row update is not mistaken for immutability.
- **Measured, and worth recording:** PostgREST returns **403** with SQLSTATE 42501 for an authenticated denial and **401** with the same SQLSTATE for an anonymous one. Both are asserted.
- **The SELECT policy was deliberately not touched.** Interaction history is the user's own server-authorized record, including exchanges with a former partner; pgTAP asserts both sides still read it after the relationship moves on.
- **Still outstanding for closure.** The migration applied to the hosted project through `.github/workflows/deploy.yml`; and a hosted check that `authenticated` holds no table-level UPDATE on `public.interactions` afterwards (`select privilege_type, column_name from information_schema.column_privileges where table_name = 'interactions' and grantee = 'authenticated'`). Code merged without deployment is not production closure.
- **Not in this story, by contract:** `src/api/interactionService.ts`'s public `postgres_changes` channel is untouched — it remains the dependency recorded in the Realtime rollout row above.

Full measurements are in `stories/5-enforce-partner-only-immutable-interactions.md` under **Verification**.

### Edge Function — status after story 6 (2026-09-12)

Open. The bounded handler is written and verified end to end on the local stack; it is not deployed.

- **Done and verified locally.** `supabase/functions/upload-love-note-image/` now splits into a `Deno.serve` binding (`index.ts`) and an injectable `handleUpload(req, deps)` (`handler.ts`). The declared `Content-Length` decides 411 (absent), 400 (non-integer, negative, fractional, or past the safe-integer range) and 413 (over the 5 MiB cap) from headers alone; the body is then streamed with the running total checked *before* each chunk is retained, so a header that lies small still ends in 413. The unused multipart branch is gone and answered 415. `arrayBuffer()`, `formData()`, `text()` and `json()` are never called on the request.
- **Two evidence surfaces.** `supabase/functions/upload-love-note-image/handler.test.ts` — 29 `deno test` cases asserting stream pull count, cancel count and Storage call count, not just status — and `tests/api/upload-love-note-image-limits.spec.ts` — 6 Playwright cases driving the real local endpoint through Kong and listing the uploader's Storage prefix before and after every refusal.
- **Actual Content-Length behaviour, measured** (this row's requirement). A real Chromium on the dev server, issuing the exact call shape of `src/services/loveNoteImageService.ts:139-145` — Authorization plus `application/octet-stream`, a `Blob` body, no hand-set length — was answered **200**, not 411. The browser sets the header and it survives Kong. No bounded-stream-only exception is needed. The *hosted* gateway remains unmeasured.
- **One deviation from the story contract, forced by the runtime and recorded there in full.** On `supabase-edge-runtime 1.74.3`, a response returned while the body is still in flight never reaches the client: a 5 MiB + 1 POST refused without reading hung until the client timeout, and so did `req.body.cancel()` and read-one-then-cancel; only a full drain delivered the 413. So an over-limit refusal now drains and **discards** what is left — live memory stays one chunk, which is the property F10 names — bounded by a 25 MiB ceiling and skipped entirely above it. Every other refusal still reads nothing.
- **Still outstanding for closure.** `supabase functions deploy upload-love-note-image --project-ref xojempkrugifnaveqtqc`, then on the hosted endpoint: one supported upload through the app succeeds, and one `Content-Length: 5242881` request returns 413 with the bucket listing unchanged. The CLI is authenticated and the project linked — `supabase functions list` reports the hosted function at `version: 4`, `verify_jwt: true` — so this is a sequencing hold, not an access blocker: deploying from the loop branch would put unreviewed code into production ahead of the pull request. The first hosted check must be a real upload, because it is also the first measurement of whether the hosted gateway preserves `Content-Length`.
- **Not in this story, by contract:** the per-isolate rate limiter, the upload formats, and the `love-notes-images` bucket policies are all untouched.

Full measurements are in `stories/6-bound-image-upload-request-buffering.md` under **Verification**.

## Loop handoff

The installed loop supports folder dispatch without creating a sprint-status file or changing the global policy:

```sh
bmad-loop validate --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation
bmad-loop run --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation --dry-run
bmad-loop run --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation
```

Validate the agreed queue and inspect the dry-run plan before launch. Commit the contract separately from implementation before isolated worktrees consume it. Start from an appropriately named implementation branch, respecting the existing worktree-per-story configuration; do not launch onto main by accident. Sallvain will start bmad-loop personally; spec preparation does not launch a run.

Existing adapter, review, TEA and worktree settings are retained. The installed flat stories queue assigns all entries the same epic, so the current `per-epic` policy creates no between-story pause; only `per-story-spec-approval` would add a global story gate. With both checkpoint flags false everywhere, no policy edit is required. Queue-specific validation is recorded in the spec memory log after the dispatch file is written.

## Verified external constraints

Private Broadcast requires channel configuration and directional policies; join permission can be read or write, and authorization is cached until join/JWT refresh. Hosted settings can disable public channel access. See [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

Do not alter Realtime-owned tables/functions or create custom objects in its schema. RLS policy changes on `realtime.messages` remain supported under the [July 2026 Realtime schema restriction](https://supabase.com/changelog/realtime-schema-locked-down-against-modification). Keep custom guard/sync functions in the project's own schema; the [managed-schema restrictions](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025) still permit supported triggers on `auth.users`.

PKCE exchanges a one-use code using the initiating client's verifier. Preserve the browser callback/redirect behavior described by [Supabase's PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), verified against the installed SDK during implementation.
