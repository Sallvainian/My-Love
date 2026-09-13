---
title: 'Contain the exposed bot credential'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: 'f52ac9840889917ba46dbcb821f5ca0aa33e022c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The forward DELETE migration is only ever verified on a fresh replay, where the row it deletes never exists.
    evidence: |-
      supabase/tests/database/22_claude_bot_config_no_secret.sql runs against a db reset database whose edited seed never inserts test_password, so the DELETE in 20260912000000_remove_claude_bot_password_row.sql matches nothing there; the migration was hand-verified inside a rolled-back transaction (insert placeholder row, apply, before=1 after=0) and the repo has no pattern for replaying one migration against pre-seeded state. Settle by running `select count(*) from public.claude_bot_config where key = 'test_password'` against the linked project after the next deploy and expecting 0.
    location: >-
      supabase/migrations/20260912000000_remove_claude_bot_password_row.sql:13
    severity: low
  - summary: >-
      AGENTS.md carries no durable prose about the bot credential being provisioned out of band or the rotation command.
    evidence: |-
      AGENTS.md says durable prose goes in that block, but the rotation procedure (fnox set -p age CLAUDE_BOT_PASSWORD, then fnox exec -- node scripts/provision-claude-bot.mjs) lives only in script and migration comments and an out-of-repo memory note. Fix edits an agent-context file, so it is recorded rather than applied here.
    location: >-
      AGENTS.md (Running and verifying)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `supabase/migrations/20260316031209_create_claude_bot_config.sql` commits the live password of the production bot login `claude-bot@test.example.com` in public git history (CAP-1 / F1). The value is still live: the hosted `auth.users` row for that login has 7 sessions and 7 unrevoked refresh tokens, and `public.claude_bot_config` still holds the `test_password` row.

**Approach:** Rotate the password through the Auth Admin API and revoke every existing session, keep the replacement only in the age-encrypted `fnox.toml` (there is no CI consumer, so no GitHub Secret is needed), strip the literal from the seed migration, delete the stored row with a forward migration, and replace seeding with an explicit, optional provisioning script that reads the secret from the environment.

## Boundaries & Constraints

**Always:** Rotate before touching source. Never print, log, test-output or write either password anywhere except the encrypted fnox entry (evidence records status codes, counts and paths only). Keep `public.claude_bot_config` and its two email rows: they are identifiers, not credentials, and `01_schema.sql`, `02_rls_policies.sql` and `database.types.ts` do not need to change. A fresh `supabase db reset` must succeed with `CLAUDE_BOT_PASSWORD` unset. Use the existing fnox provider (`age`); migration names follow `YYYYMMDDHHMMSS_slug.sql`.

**Never:** Rewrite git history; touch `claude-bot-partner@test.example.com` or any worker-pool/test account; add a new secrets store; store the new password in the database; edit `src/types/database.types.ts` by hand; run `npm run deploy`; add anything to `.env`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Provision, secret present | `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_KEY`, `CLAUDE_BOT_PASSWORD` set; bot user exists | Script finds user by email via Admin API, sets password, signs in once, signs out with `scope=global`, exits 0, prints only email/user id/step names | Non-2xx from any step: exit 1 with status code and step name, no secret echoed |
| Provision, secret absent | `CLAUDE_BOT_PASSWORD` unset | Prints that optional bot provisioning was skipped, exits 0, makes no network call | No error expected |
| Provision, secret present but service key missing | `CLAUDE_BOT_PASSWORD` set, `SUPABASE_SERVICE_KEY` unset | Exit 1 naming the missing variable | Password never appears in output |
| Provision, user not found | Admin list contains no `claude-bot@test.example.com` | Exit 1 "user not found"; no password update attempted | No secret echoed |
| Old password login | `POST /auth/v1/token?grant_type=password` with the pre-rotation value | HTTP 400 `invalid_credentials` | Recorded as status only |
| Fresh DB replay | `supabase db reset` with no env secret | Migrations and seed apply; `claude_bot_config` has `test_email` and `partner_email` only | No error expected |

</intent-contract>

## Code Map

- `supabase/migrations/20260316031209_create_claude_bot_config.sql:12-16` -- the INSERT with the live literal at line 14 (`('test_password', '...')`). Deliberate edit of the old file: remove that row, keep the table, RLS-without-policies and the two email rows. Lines 1-2 comment says "Only accessible via service role"; update the comment to say the password is provisioned out of band.
- `supabase/migrations/20260818000002_create_events_table.sql` -- latest migration; the new forward migration must sort after it.
- `supabase/migrations/20260725170000_grant_api_roles_on_public.sql:29` -- comment relies on `claude_bot_config` staying RLS-on with no policies; keep that true.
- `supabase/seed.sql` -- local-only seed, has no bot rows; leave alone.
- `fnox.toml` -- `[secrets]` table with four age-encrypted entries and `if_missing = "error"`; add `CLAUDE_BOT_PASSWORD` with `fnox set CLAUDE_BOT_PASSWORD -d "..."` reading the value from stdin. `fnox exec --` already decrypts (verified: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` all resolve).
- `.github/workflows/*.yml` -- no workflow references `claude_bot_config` or the bot login, so no GitHub Secret is required; record this in the story result.
- `scripts/perf-bundle-report.mjs` -- ESM style reference for the new script (`node:` imports, top-level constants). `scripts/**` is ignored by eslint; keep the script dependency-free (plain `fetch`).
- `tests/unit/helpers/rls-security.test.ts` -- vitest style reference. `vitest.config.ts` includes `tests/**/*.test.ts`; `tsconfig.test.json` includes only `src` and `tests`, so the script test must exercise the script as a child process, not import the `.mjs`.
- `supabase/tests/database/18_function_execute_grants.sql:1-40` -- pgTAP shape (`begin; select plan(N); ... select * from finish(); rollback;`). No existing test names `claude_bot_config`.
- Hosted project `xojempkrugifnaveqtqc` (linked; `supabase status` shows `linked_project`). Bot user id `c2675795-d8af-45ce-a881-98dfbda90171`. Read-only inspection via the Supabase MCP `execute_sql` works for `auth.sessions`/`auth.refresh_tokens` counts.
- Supabase docs (Context7, `guides/auth/signout.mdx`): a password change does not revoke sessions; `scope=global` sign-out destroys all refresh tokens; already-issued access tokens stay valid until `exp` (local `jwt_expiry = 3600`; confirm the hosted value or state the default).
- Memory note `~/.claude/projects/-Users-sallvain-Projects-My-Love/memory/reference_claude_test_account.md` -- says to read the password from the table; update to point at `fnox get CLAUDE_BOT_PASSWORD` after rotation (outside the repo).

## Tasks & Acceptance

**Execution:**
- `scripts/provision-claude-bot.mjs` -- create -- reads env, finds bot user through `GET /auth/v1/admin/users` (paged), `PUT /auth/v1/admin/users/{id}` with the new password, then password sign-in and `POST /auth/v1/logout?scope=global` to revoke every session; skips with exit 0 when `CLAUDE_BOT_PASSWORD` is unset; never prints secrets.
- `fnox.toml` -- add encrypted `CLAUDE_BOT_PASSWORD` (generated with `openssl rand`, piped to `fnox set`) -- the approved local secret mechanism.
- Operational: run `fnox exec -- node scripts/provision-claude-bot.mjs` against production, then record sanitized evidence: old-password login status, new-password login status (from the script's success), `auth.sessions`/`auth.refresh_tokens` counts before and after, access-token expiry window.
- `supabase/migrations/20260316031209_create_claude_bot_config.sql` -- remove the `test_password` row and fix the header comment -- the literal itself is the defect.
- `supabase/migrations/20260912000000_remove_claude_bot_password_row.sql` -- create -- `DELETE FROM public.claude_bot_config WHERE key = 'test_password';` so the already-applied production seed row disappears on the next `supabase db push`.
- `supabase/tests/database/22_claude_bot_config_no_secret.sql` -- create -- pgTAP: table exists, RLS on, zero policies, no `test_password` row, both email rows present.
- `tests/unit/scripts/provision-claude-bot.test.ts` -- create -- child-process tests for the I/O matrix rows using a `node:http` stub of the four Auth endpoints; asserts request order and that stdout/stderr never contain the password.
- `tests/unit/supabase/no-committed-bot-secret.test.ts` -- create -- scans every `supabase/migrations/*.sql` and `supabase/seed.sql` for a `test_password` value literal; must find none.

**Acceptance Criteria:**
- Given the pre-rotation password, when a password grant is attempted against the hosted Auth endpoint, then the response is 400 and no session is created.
- Given `fnox.toml` holds `CLAUDE_BOT_PASSWORD`, when `fnox exec -- node scripts/provision-claude-bot.mjs` runs, then it exits 0, the bot login succeeds with the new value, and afterwards `auth.sessions` for the bot user holds 0 rows and no unrevoked refresh tokens.
- Given a clean local stack, when `supabase db reset` and `supabase test db` run with `CLAUDE_BOT_PASSWORD` unset, then both pass and `claude_bot_config` contains exactly `test_email` and `partner_email`.
- Given the repository tree, when the old literal is searched for (`grep -rlF` with the value taken from `git show HEAD~:` of the seed file, paths only), then only git history matches, no working-tree file.
- Given `npm run lint`, `npm run typecheck` and `npm run test:unit`, when they run, then all pass with the new tests included.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 24 findings — high 0, medium 2, low 17, false 4, maybe-false 1
- findings:
  - `[false]` `[reject]` (intent-alignment) The intent's hard requirements live at the hosted Auth/DB surface while the diff's tests are local and stub-backed; the bridge is evidence in the story file outside the diff — the intent itself (stories.yaml story 1: "Record rotation and session-containment evidence or the outstanding operator actions"; rollout.md: "external rotation evidence may remain awaiting-operator") places hosted-surface proof in recorded evidence, and the story's Operational Evidence table carries it (sessions 7→0, old password HTTP 400).
  - `[false]` `[reject]` (intent-alignment) Provisioning is a manual command (reading A1), not wired into deploy.yml or db reset (A2) — F1 says to inspect consumers before deciding which variables are required; no workflow or source file consumes the bot login, so wiring the password into CI would add a secret with no consumer. A1 is the reading the contract selects.
  - `[low]` `[patch]` (intent-alignment) The literal-removal regression test was key-shaped and scoped to migrations + seed.sql — grouped with the two scan findings below; patched: the guard now flags any INSERT/UPDATE/MERGE/COPY statement naming test_password after stripping comments, scans supabase/tests/database too, and self-tests five quoting/statement shapes.
  - `[low]` `[defer]` (intent-alignment) The hosted row DELETE is exercised by nothing in the diff — same root cause as the verification-gap finding below; deferred with the post-deploy hosted count as the settling check.
  - `[false]` `[reject]` (intent-alignment) Skip keys on the password being unset; under fnox exec with no local bot user the script would exit 1 "user not found" — db reset never invokes the script, so that state is unreachable from a fresh setup, and the exit is loud rather than silent.
  - `[low]` `[reject]` (blind-hunter) CLAUDE_BOT_PASSWORD is injected into every fnox exec process, not only the provisioning run — real, but SUPABASE_SERVICE_KEY and SUPABASE_PAT already travel the same way and Vite inlines only VITE_* variables; a fnox profile would add config surface and change the documented command, which is more than a direct correction for a defect nobody meets in everyday use.
  - `[low]` `[patch]` (blind-hunter) pgTAP file claimed anon coverage it never tested and had no positive service_role case — patched: added anon count-is-0 and service_role count-is-2 assertions, plan(8). The raw `set local role` idiom was kept because the helper `tests.authenticate_as` sets an authenticated JWT, which is not the anon/service_role shape these assertions need.
  - `[low]` `[patch]` (blind-hunter) Scan regex matched one textual shape and hardcoded the seed path — patched as above (statement-shaped guard, pgTAP directory scanned). The seed list is still the single path config.toml names; deriving it from config.toml was not applied because the scan directory list is already broader than the seed setting.
  - `[medium]` `[patch]` (blind-hunter) A failure after update-password leaves the rotation half-done and the message does not say so — verified: sign-in or global sign-out failing after the PUT leaves every old refresh token valid while the output reads as a plain step failure; patched: sign-in and sign-out are wrapped, and on failure the script prints that the password was already rotated but sessions were NOT revoked before rethrowing; two tests (sign-in 403, sign-out 500) cover the branch.
  - `[low]` `[patch]` (blind-hunter) Pagination, email override, no-access_token and sign-out failure branches untested — patched for pagination (page 1 full of 100 filler users, bot on page 2) and sign-out failure; the CLAUDE_BOT_EMAIL override and the no-access_token branch remain untested and are noted as residual, not risks to the recorded rotation.
  - `[low]` `[patch]` (blind-hunter) Empty CLAUDE_BOT_PASSWORD reported a successful skip — patched: undefined skips, empty string exits 1 with "CLAUDE_BOT_PASSWORD (set but empty)"; test added.
  - `[false]` `[reject]` (blind-hunter) Password grant sends the service-role JWT as Bearer — no bad outcome: the same key already travels in the apikey header of the same TLS request, GoTrue accepted it (recorded HTTP 200), and switching to the publishable key would add a second required variable.
  - `[low]` `[defer]` (blind-hunter) AGENTS.md has no durable prose about the out-of-band bot credential — fix edits an agent-context file; deferred.
  - `[low]` `[patch]` (blind-hunter) Child env stripped to PATH only breaks Node networking on Windows — patched: PATH, SYSTEMROOT, TEMP and TMP pass through when present; still no secret inheritance.
  - `[medium]` `[patch]` (edge-case-hunter) update-password succeeds then sign-in/sign-out throws — same root cause as the blind-hunter half-done finding; patched with it.
  - `[maybe-false]` `[reject]` (edge-case-hunter) Server returns fewer than 100 users per page while more pages exist — Supabase docs list no per_page cap and the hosted project has 6 auth users, so the stop condition cannot be shown wrong from the diff; if true the script exits 1 "user not found" loudly (low), so rejected with that note; settling would need GoTrue's per_page ceiling or a project with more than 100 users.
  - `[low]` `[reject]` (edge-case-hunter) Trailing whitespace in CLAUDE_BOT_PASSWORD would be set verbatim — fnox stored the argument value exactly (stored length equals generated length, 40), and trimming or rejecting whitespace adds a guard for a state not demonstrated.
  - `[low]` `[patch]` (edge-case-hunter) Symlinked invocation silently exits 0 because Node realpaths the entry module — verified from Node's default main-module resolution; patched: the entry check compares the realpath of process.argv[1].
  - `[low]` `[reject]` (edge-case-hunter) A hung child would leave the stub port and worker alive — the deadlock cause (spawnSync) is fixed; a hang now fails the test loudly at vitest's timeout, and a kill timer adds a guard for a state not shown reachable.
  - `[low]` `[patch]` (edge-case-hunter) Password reintroduced via UPDATE, dollar-quoting, E'' or column order passes the guard — same root cause as the scan findings; patched as above with a self-test of those shapes.
  - `[low]` `[patch]` (edge-case-hunter) seededKeys regex missed keys with digits, hyphens or uppercase — patched: `[a-z_]+` became `[^']+`.
  - `[low]` `[defer]` (verification-gap) The forward DELETE is only verified on a fresh replay where the row never exists — pre-verified; filed disposition defer followed: the row is dead after rotation, the migration was hand-checked against a pre-seeded row, and the story tracks the post-deploy hosted count.
  - `[low]` `[patch]` (verification-gap) findUser pagination past page 1 never exercised — pre-verified; patched with the page-2 test described above.
  - `[low]` `[patch]` (verification-gap) pgTAP header overstated that it proves the DELETE — patched: header now states what a fresh replay proves and that the hosted deletion is confirmed after deploy.

## Design Notes

Why plain `fetch` instead of supabase-js in the script: the four GoTrue calls are trivial, the script must be runnable with `node` alone, and the unit test can then stub the endpoints with a dozen-line `node:http` server instead of mocking the SDK. Why keep the table: dropping it would force a types regeneration, a `01_schema.sql`/grant-comment edit and a data decision, none of which the finding needs; the table with no password row is harmless. Why a forward migration rather than an MCP `DELETE`: `rollout.md` requires live database behavior to ship through `deploy.yml`; the row is dead after rotation, so waiting for the push is safe.

## Verification

**Commands:**
- `fnox exec -- node scripts/provision-claude-bot.mjs` -- expected: exit 0, log lines for find/update/sign-in/sign-out, no secret printed.
- `supabase db reset && supabase test db` -- expected: all pgTAP files pass including `22_claude_bot_config_no_secret.sql`.
- `npm run lint && npm run typecheck && npm run test:unit` -- expected: green.
- `fnox exec -- npm run build` -- expected: exit 0 (no app code changes, sanity only).

**Manual checks (if no CLI):**
- Supabase MCP `execute_sql` on `auth.sessions`/`auth.refresh_tokens` for user `c2675795-d8af-45ce-a881-98dfbda90171`: 0 sessions, 0 unrevoked tokens after rotation.
- `git diff` of `fnox.toml` shows one added encrypted line and nothing else changed.

## Operational Evidence

Recorded 2026-09-12 against hosted project `xojempkrugifnaveqtqc` (bot user `c2675795-d8af-45ce-a881-98dfbda90171`). No credential value appears here or in any log.

| Check | Before | After |
|---|---|---|
| `auth.sessions` rows for the bot user | 7 | 0 |
| Unrevoked `auth.refresh_tokens` rows for the bot user | 7 | 0 |
| `public.claude_bot_config` `test_password` row on hosted DB | present (32 chars) | still present until `20260912000000_remove_claude_bot_password_row.sql` ships via `deploy.yml`; value is dead |
| Password grant with the pre-rotation value | (not attempted before rotation, to avoid minting a session) | HTTP 400, `error_code=invalid_credentials`, no `access_token` |
| `fnox exec -- node scripts/provision-claude-bot.mjs` | – | exit 0: find-user, update-password HTTP 200, sign-in HTTP 200, sign-out-global HTTP 204 |
| Working-tree scan for the old literal (`grep -rlF`, value taken from `git show HEAD:` of the seed file, paths only) | 1 file: `supabase/migrations/20260316031209_create_claude_bot_config.sql` | 0 files; the value remains only in git history (not rewritten, per contract) |
| Hosted Auth `jwt_exp` / refresh token rotation | – | 3600 s / enabled, so any access token issued before the global sign-out is dead within one hour of 2026-09-12 19:55 UTC; no refresh token can renew it |
| Local `supabase db reset` + `supabase test db` | – | 23 files, 242 pgTAP tests pass, including `22_claude_bot_config_no_secret.sql`; `claude_bot_config` holds `partner_email` and `test_email` only |

Consumers: no workflow under `.github/workflows/` and no source file reads `claude_bot_config` or the bot login, so no GitHub Secret was added. The replacement password is held only in `fnox.toml` (`CLAUDE_BOT_PASSWORD`, age provider). The out-of-repo memory note that told Claude sessions to read the password from the table was updated to point at `fnox get CLAUDE_BOT_PASSWORD`.

Outstanding until the PR merges and `deploy.yml` runs `supabase db push`: deletion of the dead `test_password` row from the hosted table.

## Auto Run Result

Status: done

**Summary:** The live bot password committed in the seed migration was rotated on the hosted project through the Auth Admin API and every existing session was revoked. The replacement lives only as an age-encrypted `CLAUDE_BOT_PASSWORD` entry in `fnox.toml`; a new script applies it from the environment and a forward migration removes the dead row from already-migrated databases. No CI consumer exists, so no GitHub Secret was added.

**Files changed:**
- `fnox.toml` — one added encrypted secret, `CLAUDE_BOT_PASSWORD` (age provider).
- `scripts/provision-claude-bot.mjs` — new; finds the bot user, sets the password, signs in, signs out `scope=global`; skips when the variable is unset, errors when empty, warns when rotation completed but revocation did not.
- `supabase/migrations/20260316031209_create_claude_bot_config.sql` — password row removed, header explains the out-of-band provisioning.
- `supabase/migrations/20260912000000_remove_claude_bot_password_row.sql` — new; deletes the dead `test_password` row on databases migrated before the fix.
- `supabase/tests/database/22_claude_bot_config_no_secret.sql` — new pgTAP: table, RLS, no policies, no password row, identifier rows present, anon/authenticated see nothing, service_role reads both.
- `tests/unit/scripts/provision-claude-bot.test.ts` — new; nine child-process cases against a stubbed Auth API (skip, empty, missing key, not found, happy path, page-2 pagination, sign-in failure, sign-out failure, update rejected).
- `tests/unit/supabase/no-committed-bot-secret.test.ts` — new; flags any writing SQL statement naming `test_password` across migrations, pgTAP files and seed.sql.

**Review findings:** 24 reported — 10 patched (1 medium root cause shared by two findings, 8 low; grouped rows share fixes), 3 deferred (hosted DELETE verified only on fresh replay; AGENTS.md prose, an agent-context edit), 11 rejected: four `false` (recorded evidence satisfies the intent's hosted-surface expectations; manual provisioning is the reading the consumer inventory selects; the no-local-user exit is unreachable from db reset and loud; the Bearer service key on the password grant causes no bad outcome), one `maybe-false` with low if-true impact (per_page cap), and three `low` whose fix would add guards for states not demonstrated (fnox profile scoping, whitespace in the secret, a child kill timer). Patched counts by verdict: medium 1 entry (2 findings), low 8 entries.

**Follow-up review recommendation:** false — one medium entry was patched and no high; below the threshold.

**Verification performed:**
- `fnox exec -- node scripts/provision-claude-bot.mjs` against `xojempkrugifnaveqtqc`: exit 0; update-password 200, sign-in 200, sign-out-global 204.
- Hosted checks via Supabase MCP: bot user sessions 7 → 0, unrevoked refresh tokens 7 → 0; old password grant HTTP 400 `invalid_credentials`; `jwt_exp` 3600 with refresh-token rotation enabled.
- `supabase db reset` then `supabase test db`: 23 files, all pass; `claude_bot_config` holds only `partner_email` and `test_email`.
- `npm run test:unit`: 106 files, 1921 tests pass. `npm run typecheck`: pass. `npm run lint`: 0 errors (3 pre-existing warnings in `EventCountdown.tsx`). `fnox exec -- npm run build`: pass.
- Working-tree scan for the old literal by value: 0 files.

**Matrix test audit:** six matrix rows; five are covered by tests that ran and passed (skip, missing key, not found, happy path, fresh replay via pgTAP 22). The "old password login" row is an operational demonstration recorded above (HTTP 400), not an automated test, because the pre-rotation value must never be stored anywhere a test could read it.

**Residual risks:**
- The dead `test_password` row stays in the hosted table until the PR merges and `deploy.yml` runs `supabase db push`; confirm with a count afterwards (deferred item 1).
- The old value remains in git history (rewriting history is outside this story's contract); it no longer authenticates.
- `scripts/**` is eslint-ignored, so the new script has no lint coverage beyond its tests.
