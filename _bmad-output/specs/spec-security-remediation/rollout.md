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

Approved checkpoint rule: `spec_checkpoint: true` on stories 2, 5, 7 and 8, `false` on the others; `done_checkpoint: false` on all eight; `invoke_dev_with: ""` on all eight. An operator action is distinct from either checkpoint. These choices do not waive review of the concrete migration plans.

## Migration alternatives to review before execution

AGENTS.md requires proposing a config-level alternative and obtaining approval before migrations. This document prepares that review; it does not authorize schema changes.

| Boundary | Config-level alternative | Proposed approach and reason |
|---|---|---|
| F1 secret seeding | Replace committed literals with deployment/local environment injection. | Use the existing fnox/GitHub Secrets mechanisms; remove live literals and make optional bot provisioning explicit. No new secrets store. Rotation remains a real Auth action. |
| F2/F3 Realtime | Disable public Realtime access in hosted settings. | Use that setting as a rollout safeguard after checking existing consumers; settings alone cannot distinguish one couple from another. Add directional RLS on private topics and private client subscriptions. |
| F4/F5 interactions | Tighten RLS and revoke broad UPDATE in favor of a `viewed` column grant. | Partner-scoped INSERT plus viewed-only writes. Prefer the narrow privilege configuration if actual grants/clients support it; otherwise use an invoker immutability trigger or narrow RPC with explicit role tests. |
| F8 IndexedDB | Hide AdminPanel, clear state on logout or move to separate per-account database names. | None establishes ownership for every persisted service path; separate databases duplicate schema/opening logic and still need a legacy decision. Use the shared database with owner fields/index and checks at the service boundary. |
| F9 profiles | Revoke broad UPDATE and grant only supported profile columns. | This may be sufficient if all legitimate writes are inventoried. The report's proposed invoker email-immutability trigger preserves existing unrelated profile writes and allows the definer auth-sync path; separately stop sync from overwriting names. |

Before implementing a database slice, turn the selected alternative into a concrete plan covering objects, current grants/policies, effective roles, backward compatibility and checks. After that plan is approved, implement step by step. Do not re-ask approval already explicitly given for that plan.

Use forward migrations for live database behavior. F1 source sanitization is a deliberate edit to the old seed file because the literal itself is the defect; it cannot repair an already-applied production migration. Confirm replacements work before deleting code. Keep generated database types generated. Check latest definitions and actual policy sets, including `02_rls_policies.sql`, `16_photos_storage_update_policy.sql` and function-execute grant assertions, rather than relying on the report's earlier statement that a particular table lacks a test.

## Verification gates

- For every code slice, run lint, the full project typecheck and the affected unit/integration tests. Add tests at the boundary that failed; mocked client tests alone cannot demonstrate RLS, private Realtime authorization, auth callback rejection or role-sensitive triggers.
- For database slices, verify clean migration replay in a disposable local stack, `supabase test db`, and authenticated/anon/outsider negative cases plus valid partner operations. Inspect persisted data after failed mutations. Regenerate types when the public schema changes.
- Use dedicated accounts/isolated clients for adversarial cases. Shared Playwright worker-pool accounts must not be linked/unlinked or reset by a spec. Use merged fixtures and the normal worker-index contract from AGENTS.md.
- For private Realtime, use real subscription/send outcomes and state/UI assertions. Exercise a malicious public subscription to the same topic as well as private joins. Policies are evaluated at join/auth refresh, so test reconnection and explicit identity/relationship changes; do not claim per-message relationship revalidation from RLS alone.
- For IndexedDB, test service calls directly, account-switch promise races and fresh/legacy database upgrades. For F10, assert body consumption/cancellation and Storage calls. For F13, use the installed SDK and real callback semantics with sanitized tokens.
- Before release, run the required aggregate checks, including coverage if enforced by CI, and a secret-injected production build. Use `fnox exec -- npm run build`; the smoke script alone cannot prove the app loads. Exercise the built app and affected user journeys against the intended test environment.
- Keep test results tied to the actual commit. If a PR is opened or pushed, immediately arm the commit-pinned Claude review waiter and read/triage the full matching-run comment as AGENTS.md specifies. Approval is required before editing or pushing in response to that review.

## Operational completion

| Work | Required evidence before closure |
|---|---|
| Bot containment | Password rotated; old login rejected; intended consumers work; session/refresh-token revocation or bounded expiry explicitly accounted for. Never record credential values. |
| Realtime rollout | Policies applied; updated clients use private topics; hosted public-access setting/old-client handling recorded; outsider denied and partner delivery confirmed after reconnect. |
| Database protections | Approved forward migrations applied to the intended project; role-sensitive checks and existing-data compatibility verified. Code merged without deployment is not production closure. |
| PKCE | Real supported OAuth callback completes from the initiating browser; attacker-fragment callback rejected; Pages redirect/base path and enabled signup confirmation behavior verified. |
| Edge Function | Bounded handler deployed separately from Pages; supported browser upload succeeds and an over-limit request is rejected without a Storage write. Record actual Content-Length behavior. |

Apply authorization policies before private clients rely on them. After valid private delivery is verified, disable public Realtime access if compatible with all remaining consumers, reconnect clients and address installed PWA versions still broadcasting publicly. Do not briefly restore public fallback to make a failed deployment appear healthy. If a global setting conflicts with another live consumer, report the concrete dependency before changing it and keep rollout completion open.

Follow `.github/workflows/deploy.yml` for Pages/database shipping; never run `npm run deploy`. Inventory the Edge Function deployment mechanism independently. Determine any existing-data/grant incompatibility through read-only inspection before applying changes; do not silently delete or rewrite customer data to make a migration pass.

When an external action cannot be completed by the implementing session, finish and commit the agent-doable work, then use the installed loop's `awaiting-operator` outcome with concrete `operator_actions` and evidence requirements. `bmad-loop confirm` is for actions already performed and verified, not a way to waive them. Overall remediation remains incomplete while any finding's operational acceptance is outstanding.

## Loop handoff

The installed loop supports folder dispatch without creating a sprint-status file or changing the global policy:

```sh
bmad-loop validate --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation
bmad-loop run --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation --dry-run
bmad-loop run --project /Users/sallvain/Projects/My-Love --spec _bmad-output/specs/spec-security-remediation
```

Validate the agreed queue and inspect the dry-run plan before launch. Commit the contract separately from implementation before isolated worktrees consume it. Start from an appropriately named implementation branch, respecting the existing worktree-per-story configuration; do not launch onto main by accident. Sallvain will start bmad-loop personally; spec preparation does not launch a run.

Existing adapter, review, TEA and worktree settings are retained. Baseline preflight found Codex, tmux and hooks installed; its only failure was the missing sprint-status queue, which explicit `--spec` mode replaces. Queue-specific validation is recorded in the spec memory log after the dispatch file is written.

## Verified external constraints

Private Broadcast requires channel configuration and directional policies; join permission can be read or write, and authorization is cached until join/JWT refresh. Hosted settings can disable public channel access. See [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

Do not alter Realtime-owned tables/functions or create custom objects in its schema. RLS policy changes on `realtime.messages` remain supported under the [July 2026 Realtime schema restriction](https://supabase.com/changelog/realtime-schema-locked-down-against-modification). Keep custom guard/sync functions in the project's own schema; the [managed-schema restrictions](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025) still permit supported triggers on `auth.users`.

PKCE exchanges a one-use code using the initiating client's verifier. Preserve the browser callback/redirect behavior described by [Supabase's PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), verified against the installed SDK during implementation.
