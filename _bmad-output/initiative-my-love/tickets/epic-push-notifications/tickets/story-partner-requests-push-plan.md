---
title: 'Partner requests push'
type: 'feature'
ticket: '6'
created: '2026-10-31'
status: done
baseline_revision: '8cc2f9129fd7203d0736647e44fee41a6abb0a19'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-date-changes-push-plan.md']
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A person learns of a partner request sent to them, or of their own request being accepted, only when the app is open (R2). R7 says what each push says.

**Approach:** Reuse story 3.4's generic `notify_push(kind)` trigger function on `partner_requests`: an INSERT of a pending request posts `{kind: 'partner_request', id}`, and the `pending → accepted` UPDATE made by `accept_partner_request` posts `{kind: 'partner_accept', id}`. The sender reads the request row; it pushes the request to `to_user_id` and the acceptance to `from_user_id`. It claims one `push_requests` row per (request, device) in a new column for each kind.

## Boundaries & Constraints

**Always:**
- Payloads use the `partner-activity` thread, with no image, no `badge` and no `sound`.
  - Request: the title is the asker's display name, or `Someone` when there is none (the asker is not a partner yet). The body is `Sent you a partner request`.
  - Acceptance: the title is the accepter's display name, or `Your partner` when there is none (they are linked now). The body is `Accepted your partner request`.
- Pushes go out for two changes only:
  - a `partner_requests` INSERT whose `status` is `pending`, to the `to_user_id` devices;
  - an UPDATE of `status` from `pending` to `accepted`, to the `from_user_id` devices.
  - Nothing goes out for a decline: neither `decline_partner_request` nor the other pending requests that `accept_partner_request` auto-declines push anything. An INSERT that arrives already `accepted` or `declined` pushes nothing either.
- The sender does not call `getPartnerId` for these kinds. It answers 200 with every count 0, and claims nothing, when:
  - a `partner_accept` names a request whose current status is not `accepted` (a forged or replayed post must not announce an acceptance);
  - the recipient equals the sender.
- A missing request answers 404. A replayed post skips every device.
- `push_requests` gets two columns, `partner_request_id` and `partner_accept_id`. Each is an FK to `partner_requests` with `on delete cascade` and has `unique (<col>, token)`. `push_requests_source_check` becomes `num_nonnulls` over seven columns.
- Trigger bodies are unchanged: `notify_push` is reused as it is. Only its COMMENT and the `push_sender_settings` and `push_requests` COMMENTs are updated. The new triggers inherit its rules: no settings means nothing is posted, and a failure never fails or delays the write.
- pgTAP pins the new columns, the check, the triggers and the queued calls. `18_function_execute_grants.sql` stays unchanged. `database.types.ts` is regenerated, never hand-edited.
- The love-note, mood, photo, interaction and date paths are unchanged on the wire, and their tests keep passing.
- Accounts:
  - The api spec uses throwaway accounts (`createOutsiderClient`) and deletes them at the end. It never links or unlinks pool accounts.
  - The simulator uses a new unlinked driver pair: `simdriver-unlinked@test.example.com` (Riley) and `simdriver-unlinked-other@test.example.com` (Quinn). `sim provision` creates or resets them as unlinked and deletes every `partner_requests` row involving either.
  - Their `sim signin` targets are `unlinked` and `unlinked-other`.

**Never:**
- Deploy, or touch hosted Supabase, APNs or `deploy.yml`.
- Change `notify_push`'s body, the partner-request RPCs or policies, the client, or the triggers of earlier migrations.
- Add switches, a badge, tap routing or foreground handling (stories 7–9).
- Uninstall the owner's phone shell, leave serve or driver processes running, or leave a test build in `dist/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Request sent | Unlinked A inserts a pending request to unlinked B | One recorded request per B device (`A`, `Sent you a partner request`), none on A's devices | -- |
| Accepted | B calls `accept_partner_request` | One recorded request per A device (`B`, `Accepted your partner request`), none on B's | -- |
| Auto-declined others | B also had a pending request from C when accepting A | C gets nothing | -- |
| Declined | D calls `decline_partner_request` on C's request | No `partner_accept` post or rows | -- |
| Inserted non-pending | Superuser inserts with `status = 'accepted'` | Nothing posted | -- |
| Forged accept | `{kind:'partner_accept', id}` for a pending or declined request | 200, all counts 0, nothing claimed | -- |
| Replay / missing / bad kind | Same post again / unknown id / unknown kind | All `skipped` / 404 / 400 | -- |
| Sender down | Unusable `sender_url` | Insert and accept commit | `notify_push` swallows and warns |

</intent-contract>

## Code Map

- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql`:
  - `notify_push()` posts `{kind: tg_argv[0], id: new.id}` and works unchanged in an AFTER UPDATE.
  - Copy its trigger and header style. Do not edit this file.
- `supabase/migrations/20261031030000_push_date_changes.sql` -- the latest push migration. Copy how it adds a `push_requests` column and drops and re-adds `push_requests_source_check`.
- `supabase/migrations/20260818000000_revoke_anon_execute_and_fix_partner_guards.sql` -- read only. It has the current bodies of the RPCs:
  - `accept_partner_request` sets the request `accepted`, then sets every other pending request of either user `declined`;
  - `decline_partner_request` sets one request `declined`.
  - The UPDATE privilege on `partner_requests` is revoked from anon and authenticated, so only these RPCs change `status`. The INSERT policy checks only `from_user_id = auth.uid()`.
- `supabase/migrations/20261031040000_push_partner_requests.sql` (new):
  - the two `push_requests` columns, their unique keys and the seven-column check;
  - `partner_requests_push_after_insert` (`after insert … when (new.status = 'pending') execute function public.notify_push('partner_request')`);
  - `partner_requests_push_after_accept` (`after update of status … when (old.status = 'pending' and new.status = 'accepted') … notify_push('partner_accept')`);
  - the COMMENT updates.
- `supabase/functions/send-push/handler.ts`:
  - add `'partner_request' | 'partner_accept'` to `PushKind` and `POSTED_KINDS`, and update the 400 message;
  - add `PartnerRequestRow {id, from_user_id, to_user_id, status}` and `PushDb.getPartnerRequest`;
  - add two `resolveSource` cases (the acceptance's `buildPayload` is null unless `status === 'accepted'`);
  - update the header doc.
- `supabase/functions/send-push/payload.ts` -- `buildPartnerRequestPayload(name)`, `buildPartnerAcceptPayload(name)`, the body constants and `FALLBACK_REQUESTER_NAME = 'Someone'`. Update the header.
- `supabase/functions/send-push/index.ts`:
  - `SOURCE_COLUMN`: `partner_request: 'partner_request_id'`, `partner_accept: 'partner_accept_id'`;
  - `getPartnerRequest` reads `partner_requests`;
  - update the header.
- `supabase/functions/send-push/{handler,payload}.test.ts`:
  - extend `fakeDb`;
  - add cases for each body, both fallbacks, the recipients, a forged accept, 404, replay, and the claim kind;
  - add both kinds to the 404 loop at about line 543.
- `supabase/tests/database/35_push_devices.sql`:
  - append PUSH-DB-095+ in the style of the date section, and raise `plan(94)` to match;
  - make fresh unlinked users with `tests.create_test_user`. Accept and decline as the recipient through `tests.authenticate_as`, then `tests.clear_jwt`;
  - read `net.http_request_queue` as the earlier sections do, and scope every count to this file's own users or request ids.
- `tests/api/push-love-note-trigger.spec.ts`:
  - add a fourth `describe` in this serial file (it shares the one `push_sender_settings` row);
  - reuse `clientFor`, `newToken`, `requestsFor`, `postToSender` and `partnerPayload`, extending `SourceColumn` with the two columns;
  - make the accounts with `createOutsiderClient`, name them as `createThrowaway` in `tests/e2e/partner/partner-connect.spec.ts` does, register their devices with `register_push_device`, and delete them in `cleanup.defer` (the FKs cascade the requests, `push_requests` and `push_devices`);
  - add both kinds to the 404 loop at about line 535, and add a header line for story 3.6.
- `scripts/sim-driver/provision.ts` -- an `UNLINKED_PAIR`, created or reset with `ensureUser`. Set `partner_id` null on both and delete `partner_requests` where either is `from_user_id` or `to_user_id`. Update the header comment.
- `scripts/sim-driver/sim` -- add the two emails to `EMAILS`, the `unlinked` and `unlinked-other` cases (plus die message) to `cmd_signin`, and the `usage` lines for `provision` and `signin`.
- `AGENTS.md` -- update the sim-driver paragraph's fixture-pair sentence ("Its two fixture pairs …") to name the third, unlinked pair and its signin targets. Change nothing else.
- `src/types/database.types.ts` -- regenerate as story 3.5 did: take only the new `push_requests` columns and relationships (DW-357 covers the rest of the file's drift).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261031040000_push_partner_requests.sql` -- columns, keys, check, two triggers, comments -- server half
- [x] `supabase/functions/send-push/{payload,handler,index}.ts` + tests -- two kinds, recipients, R7 bodies, forged-accept guard, claim columns -- sender
- [x] `supabase/tests/database/35_push_devices.sql` -- each matrix row as queued calls. Also cover: no settings queues nothing, a raising call keeps the insert and the accept, the columns, cascade, the check and the trigger existence -- DB proof
- [x] `tests/api/push-love-note-trigger.spec.ts` -- wire proof:
  - a request records on the asked person's devices only, and its acceptance on the asker's only;
  - a decline and the auto-declined requests record no `partner_accept` row after 3 s;
  - a forged accept answers all zeros, a replay is skipped, and both kinds 404 for a missing id
- [x] `scripts/sim-driver/{provision.ts,sim}` + `AGENTS.md` -- the unlinked pair, its signin targets, help and docs
- [x] `src/types/database.types.ts` -- regenerate
- [x] Simulator: run the recipe in Design Notes and record the commands, exit codes and banner lines in Implementation Notes

**Acceptance Criteria:**
- Given the deno tests, when run, then both bodies, both fallbacks, the forged accept's zero result, the replay skip and the 404 pass.
- Given the local stack with the sender serving, when one throwaway account requests another and the other accepts, then each records one request per recipient device with its R7 body. A decline records none.
- Given the Duo simulator, when the recorded request and acceptance payloads are delivered with `sim banner FILE`, then the banners read `Riley, Sent you a partner request` and `Quinn, Accepted your partner request`.
- Given `sim provision` runs after the simulator check, then Riley and Quinn are unlinked with no `partner_requests` rows.
- Given the session ends, then `git status` shows only planned files, `dist/` holds no test build, and no serve or driver process is running.

## Implementation Notes

Built 2026-10-31. Migration `20261031040000_push_partner_requests.sql`: `push_requests.partner_request_id` and `partner_accept_id` (FK to `partner_requests`, cascade, each `unique (<col>, token)`), `push_requests_source_check` re-added over seven columns, `partner_requests_push_after_insert` (WHEN `new.status = 'pending'`) and `partner_requests_push_after_accept` (`after update of status`, WHEN pending to accepted), both `notify_push(...)`; only the COMMENTs of `notify_push`, `push_sender_settings` and `push_requests` changed. Sender: `partner_request` and `partner_accept` kinds, `PartnerRequestRow`, `PushDb.getPartnerRequest`, `buildPartnerRequestPayload` / `buildPartnerAcceptPayload`, `FALLBACK_REQUESTER_NAME`, `SOURCE_COLUMN` entries. A `partner_accept` whose request is not `accepted` has a null `buildPayload`, so it answers all zeros and claims nothing; neither kind calls `getPartnerId`.

`src/types/database.types.ts`: took only the two new `push_requests` columns and their two relationships from `supabase gen types typescript --local` (DW-357 covers the rest of the file's drift; no new ledger entry). The worktree's `node_modules` was empty; `npm ci` fixed it (gitignored). The migration was applied to the shared local database with `supabase migration up --local`.

pgTAP: `35_push_devices.sql` plan 94 -> 114, PUSH-DB-095..114 (columns, triggers and function, source check and unique keys, each matrix row as queued calls scoped to the section's own request ids, no settings, a raising call keeping the insert and the RPC accept, cascade). A `results_eq` over `pg_trigger` names failed with a collation error (name vs text literals), so the trigger set is one `string_agg` compared with `is`.

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 75 passed; `deno check` clean; `supabase test db` 22 files, 523 tests, PASS; `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 15 passed (1 new, `supabase functions serve` running, stopped afterwards); `npm run lint` and `npm run typecheck` exit 0.

Simulator (iPhone Duo, local stack, `supabase functions serve` with no APNs env): `sim provision` exit 0 (Riley and Quinn created), `sim build` exit 0 (installed `sim-tree-1793503531`), `sim signin unlinked-other` exit 0 (Quinn; the shell registered his device). Riley -> Quinn was inserted as the database superuser; the recorded `partner_request_id` payload was written to a scratchpad file and delivered with `sim banner FILE`, exit 0: `banner: MY LOVE, now, Riley, Sent you a partner request`. `sim signout` exit 0, `sim signin unlinked` exit 0 (Riley; device registered). Quinn accepted in psql (`set local role authenticated`, `request.jwt.claims` with his `sub`, `select public.accept_partner_request(...)`); the `partner_accept_id` payload delivered with `sim banner FILE`, exit 0: `banner: MY LOVE, now, Quinn, Accepted your partner request`. No fake `push_devices` row was needed. A final `sim provision` exit 0 left Riley and Quinn with no `partner_id` and no `partner_requests` rows (checked by query); `functions serve` stopped, no `xcodebuild`, `http.server` or serve process, no edge container, `dist/` absent.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The api spec's file header still said every case uses the worker's pair and that nothing links an account — verified: the fourth describe links two throwaway accounts through `accept_partner_request`. Patched: the header now says the first three describes use the worker's pair and never link, unlink or reset it, and the fourth links and deletes throwaway accounts.
  - `[low]` `[patch]` PUSH-DB-102's description claimed the accept linked the pair, but it checked only the request statuses — verified. Patched: it also asserts that a's and b's `users.partner_id` point at each other (plan stays 114).
  - `[low]` `[patch]` PUSH-DB-098 read the whole shared `net.http_request_queue`, unlike the rest of the section — verified: a call that another session commits during the test would add a second distinct row. Patched: the read is scoped to the section's request ids with `tests.preq_queue()`'s filter.
  - `[low]` `[patch]` The edited `send-push/index.ts` header line ran to about 119 columns — verified. Patched: re-wrapped only the edited lines.

## Design Notes

- **Why the trigger function is reused.** `notify_push` already posts `{kind: tg_argv[0], id: new.id}`, and `partner_requests.id` is stable. Each request row is inserted once and accepted at most once, because accept requires `pending`. So the request id is a sound dedupe source for both kinds. The kinds get separate columns, so the same token can never collide across the two pushes for one request, for example a device that switched accounts.
- **Why a forged accept is refused.** The sender treats `partner_accept` as a claim that the request was accepted. It re-checks `status`, so a replayed or forged post for a pending request cannot announce an acceptance. A request push is true for any status, so its status is not checked.
- **Push to a person who already has a partner.** It is not gated: the intent pushes every new request to the person asked. Residual risk: anyone who knows an address can send one push per pending request, as they can already send the request.

**Simulator recipe** (story 3.5's):
1. Run `supabase start`.
2. Run `supabase functions serve` with no APNs env.
3. Run `sim provision`, then `sim build`.
4. Run `sim signin unlinked-other` (Quinn).
5. Insert Riley → Quinn as the database superuser. Read the `partner_request_id` request's `payload` into a scratchpad file, then run `sim banner FILE`.
6. Run `sim signout`, then `sim signin unlinked` (Riley).
7. Accept as Quinn: in psql, `set local role authenticated` and `request.jwt.claims` with Quinn's `sub`, then `select public.accept_partner_request(…)`. Read the `partner_accept_id` payload, then run `sim banner FILE`.
8. Re-run `sim provision` to unlink the pair.

If the shell registers no device for the recipient, insert a fake `push_devices` row for that recipient as the superuser, and delete it afterwards.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `supabase migration up --local`, then `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` -- expected: pass (with `supabase functions serve` running)
- `npm run lint`, `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** A new partner request now pushes to the person asked, and accepting one pushes to the person who sent it. Two new triggers on `partner_requests` reuse story 3.4's `notify_push(kind)` unchanged:
- an INSERT of a pending request posts `{kind: 'partner_request', id}`;
- the `pending` to `accepted` UPDATE made by `accept_partner_request` posts `{kind: 'partner_accept', id}`.

The sender reads the request, then pushes `Sent you a partner request` to `to_user_id` (titled with the asker's name, or `Someone`) and `Accepted your partner request` to `from_user_id` (titled with the accepter's name, or `Your partner`), on the `partner-activity` thread. It claims one `push_requests` row per (request, device), in the new `partner_request_id` or `partner_accept_id` column.

Nothing is pushed for a decline, for a request that `accept_partner_request` auto-declines, or for a request inserted already non-pending. A `partner_accept` post for a request that is not `accepted` now answers all zeros and claims nothing.

`sim provision` now also creates an unlinked fixture pair, Riley and Quinn, with the `sim signin unlinked|unlinked-other` targets.

**Files changed:**
- `supabase/migrations/20261031040000_push_partner_requests.sql`: two `push_requests` source columns with their unique keys, the seven-column source check, two triggers and comment updates.
- `supabase/functions/send-push/{handler,payload,index}.ts`: the two kinds, their recipients, the forged-accept guard, the R7 payloads and the claim columns.
- `supabase/functions/send-push/{handler,payload}.test.ts`: deno cases for both bodies, both fallbacks, recipients, forged accept, self-addressed, replay, release by kind, 400 and 404.
- `supabase/tests/database/35_push_devices.sql`: PUSH-DB-095..114 (plan 94 -> 114).
- `tests/api/push-love-note-trigger.spec.ts`: a fourth `describe` with throwaway accounts, plus both kinds added to the 404 check.
- `scripts/sim-driver/provision.ts`, `scripts/sim-driver/sim`: the unlinked Riley/Quinn pair, its signin targets and the help text.
- `AGENTS.md`: the sim driver's fixture-pair sentence now names the third pair.
- `src/types/database.types.ts`: the two new `push_requests` columns and their relationships.

**Review findings:** 4, all low, from the Quick lens.
- Patched all 4: the api spec header, PUSH-DB-102's partner_id assertion, PUSH-DB-098's scoping, and the comment wrap in `index.ts`.
- Deferred and rejected: none.

**Follow-up review recommended:** false. No high and no medium was patched.

**Verification (after the patches):**
- `deno test --no-lock supabase/functions/send-push/`: 75 passed.
- `supabase test db`: 22 files, 523 tests, PASS.
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts`: 15 passed, with `supabase functions serve` running; it was stopped afterwards.
- `npm run lint` and `npm run typecheck`: exit 0.
- Simulator, from the implementer's run (iPhone Duo, local stack): the banners read `Riley, Sent you a partner request` and `Quinn, Accepted your partner request`. A final `sim provision` left Riley and Quinn unlinked with no requests.
- No `dist/`, no `deno.lock`, and no serve or edge process is left.

**Residual risks:**
- On deploy, migrations land before functions. Until `send-push` redeploys, the old sender answers 400 to the two new kinds, so those first pushes are lost.
- A request still pushes to a person who already has a partner. Anyone who knows an address can cause one push per pending request, as they can already send the request.
- The hosted project and real APNs delivery of these pushes are untested.
