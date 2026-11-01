---
title: 'Pushes arrive through APNs on a device and from the hosted project'
type: 'feature'
ticket: '13'
created: '2026-10-31'
status: done
baseline_revision: '56c1aaa37b13084ca0c0b2bf71bb5466f041c5c0'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-sign-out-stops-a-device-s-pushes-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The sender has never called APNs, and the hosted trigger has never fired: hosted has `pg_net` 0.19.5, both push migrations, the enabled `love_notes_push_after_insert` trigger and `send-push` v1, but no `push_sender_settings` row and only one fixture pair (Claude Bot / Claude Partner). Story 2's re-registration and takeover are unproven on a device.

**Approach:** The APNs key already exists: in fnox (commit `1ae5dcbb1a73d9b9f6bab5cab913b7d10026dae6`, cherry-picked here as `85bf643d`) and as hosted secrets, so this story only checks the hosted names read-only. One SQL write gives hosted its sender row; a committed script provisions a second fictional pair on production and sets passwords for the accounts the checks sign in as. Then a person runs the device checks on the owner's iPhone with a shell built from `main`, sending notes from the website as the partner, and a local-stack run answers whether the simulator receives a real sandbox push.

**Decisions (owner, 2026-10-31):** the device is the owner's iPhone: the `main` build installs over the existing shell (never uninstalled), the owner's account signs out for the checks (local copies are deleted and fetched again, unsent queues stay) and the owner signs back in at the end. The plan is kept whole, not split. The APNs key and its hosted secrets were set up by the owner before this story; each remaining production write (the sender row, the provisioning script) needs the owner's approval in the session.

## Boundaries & Constraints

**Always:**
- Every production write (secrets, the sender row, provisioning, sign-ins) runs only after the person approves it in this session; reads stay read-only.
- The hosted sender secret is generated inside Postgres (`encode(extensions.gen_random_bytes(32), 'hex')`) and never leaves it: the trigger and the sender both read it from `push_sender_settings`. `sender_url` is `https://xojempkrugifnaveqtqc.supabase.co/functions/v1/send-push`.
- APNs secrets are already set and are not written again: `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID` in fnox and on hosted; `APNS_TOPIC` stays unset (default `dev.sallvain.mylove`). Hosted is checked by name only (Management API `GET /v1/projects/xojempkrugifnaveqtqc/secrets`). A scratch env file for local serving lives in the scratchpad and is deleted afterwards.
- The owner signs back in to their own account on the iPhone at the end; the shell is never uninstalled.
- The device runs a shell built from `main` with `fnox exec -- npm run ios:sync`, installed from Xcode (development signing, so its registration is `sandbox`); `dist/` is rebuilt from `main` afterwards if anything else was built there.
- Evidence in the plan: words, row counts, HTTP statuses and `send-push` response counts only. No device tokens, emails beyond the fictional fixture addresses, or screenshots of real accounts.
- A fix found here belongs to this story (story 1's reviewers left a literal-`\n` PEM and a 403 provider-token refresh to it); it gets a test and is recorded in Implementation Notes.

**Never:**
- Commit a secret, token or `.p8`; put the sender secret in a migration or `seed.sql`.
- Uninstall the shell from the owner's iPhone; change `appId` or the Worker name; deploy a function by hand (`deploy.yml` only).
- Build stories 4–9's behaviour (other push types, switches, badge counts, tap routing).
- Link partners through a client `UPDATE` of `users.partner_id` (the script links with the service role, as `tests/support/auth/global-setup.ts` `linkUserPair` does).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hosted note | Device signed in as Claude Bot; Claude Partner sends a note on the website | Push on the device: title the partner's name, body the text | `net._http_response` and the function's logs read for the cause |
| Same-account return | Offline sign-out (airplane mode), online, sign in as Claude Bot | The next partner note pushes again | -- |
| Takeover | Offline sign-out, sign in as the second pair's first account | Claude Partner's note to Claude Bot shows nothing; the second pair's partner's note pushes | Stale row removed by the 410 path or moved by `register_push_device`; record which |
| Simulator sandbox | Local stack, `sim` shell signed in, sender served with APNs env | Recorded: banner seen or not, and APNs status | -- |
| Script re-run | Accounts exist | Passwords and names reset, pair linked, nothing duplicated | Non-2xx exits 1 with the step name, no secret printed |

</frozen-after-approval>

## Code Map

- `scripts/provision-claude-bot.mjs` + `tests/unit/scripts/provision-claude-bot.test.ts` -- pattern to copy (env read, Auth Admin REST, `StepError`, never prints secrets, `isInvokedDirectly`, fetch mocked in tests). Leave unchanged.
- `scripts/provision-push-fixtures.mjs` (new) -- needs `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUSH_FIXTURE_PASSWORD` (new fnox secret); refuses a missing value. Ensures `push-fixture@test.example.com` ("Riley") and `push-fixture-partner@test.example.com` ("Avery"): create with `email_confirm` and `user_metadata.display_name`, else update password and name; resets `public.users.display_name`; links both with service-role `partner_id` updates (as `scripts/sim-driver/provision.ts:267`). Sets `claude-bot-partner@test.example.com`'s password to the same value (no repo code reads it; checked with grep). Usage: `fnox exec -- node scripts/provision-push-fixtures.mjs`.
- `tests/unit/scripts/provision-push-fixtures.test.ts` (new) -- create path, existing-user path, link calls, missing env, no secret in output.
- `supabase/functions/send-push/apns.ts:45,71` -- `apnsConfigFromEnv` and PEM parsing (strips whitespace only). Touch only if the real key fails; tests in `apns.test.ts`.
- `supabase/functions/send-push/index.ts:26` -- reads `push_sender_settings.sender_secret`; `handler.ts` answers 401 with no row.
- `supabase/migrations/20261031000000_push_devices.sql:151,172` -- `push_sender_settings` (one row, secret ≥16 chars) and the trigger (`net.http_post`, 2 s timeout, swallowed errors with `raise warning`).
- `supabase/seed.sql:10` -- the local row; `supabase functions serve --env-file <scratch>` gives the local sender APNs secrets for the simulator run.
- `scripts/sim-driver/sim` -- `provision`, `build`, `signin`, `banner` for the simulator run; unchanged.
- `ios/App/App/App.entitlements` (`aps-environment` development), `project.pbxproj` (team `W778837A9L`, `TARGETED_DEVICE_FAMILY = "1,2"`) -- unchanged.
- `_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/tickets.toml` -- not edited (the ticket owns story 4's `unknown`; the plan records the hosted trigger working).
- `_bmad-output/initiative-my-love/deferred-work.md` -- any deferral.

## Tasks & Acceptance

**Execution:** the implementation agent does the first task and its Verification commands only, touching no hosted project, device or simulator; every later task is run by the coordinator with the owner.
- [x] `scripts/provision-push-fixtures.mjs`, its unit test -- second pair and partner password -- the checks need sign-ins
- [x] Person: confirm Push Notifications is enabled on the `dev.sallvain.mylove` App ID; `fnox set -p age PUSH_FIXTURE_PASSWORD <value>`
- [x] Read-only: the hosted secrets list holds `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID` (names only)
- [x] Production writes, each approved by the owner: insert the `push_sender_settings` row; run the provisioning script
- [x] Simulator run on the local stack with the APNs env; record the result
- [x] Device run with the person: hosted note, same-account return, takeover; read `push_devices`/`push_requests` counts and `net._http_response` statuses read-only between steps
- [x] Remove the test notes the checks sent (fixture rows only); record everything in Implementation Notes

**Acceptance Criteria:**
- Given the key in fnox and its three names in the hosted secrets list, when Claude Partner sends a note on the website, then the device signed in as Claude Bot shows a push with the partner's name and the text, and hosted `push_requests` holds its row with `delivery = 'sent'`.
- Given the device signed out offline, when Claude Bot signs in again, then the next partner note pushes.
- Given the device signed out offline and signed in as Riley, when Claude Partner sends Claude Bot a note, then the device shows nothing, and Avery's note to Riley pushes.
- Given the local stack with the APNs env, when a partner note is inserted for the `sim` shell's account, then the plan records whether the banner showed and APNs's status.
- Given the session ends, then `git status` shows only planned files, no `.p8`, env file or token is in the tree or scratchpad, `dist/` holds no test build, no serve process runs, and the owner's iPhone is signed in to the owner's account.

## Implementation Notes

Script (implementation agent, 2026-10-31): `scripts/provision-push-fixtures.mjs` and `tests/unit/scripts/provision-push-fixtures.test.ts` (11 tests, a fake server and the script run as a child process). It accepts `VITE_SUPABASE_URL` when `SUPABASE_URL` is unset, because fnox holds only the former. Its stub-server helpers are copied from `provision-claude-bot.test.ts`, which the plan keeps unchanged. `npx vitest run tests/unit/scripts/provision-push-fixtures.test.ts` 11 passed; `npm run lint` exit 0 (`scripts/**` is lint-ignored); `deno test --no-lock supabase/functions/send-push/` 30 passed. `npm run typecheck` exit 2 at first, only in the untouched `src/services/pushNotifications.ts` (`Cannot find module '@capacitor/push-notifications'`): the worktree had no `node_modules` and resolved the main checkout's stale one; `npm ci` in the worktree fixed it: `npm run typecheck` exit 0.

fnox: the owner's APNs commit `1ae5dcbb1a73d9b9f6bab5cab913b7d10026dae6` cherry-picked as `85bf643d`; the key has real newlines (6 lines, no literal `\n`) and `APNS_TEAM_ID` equals the Xcode team. The owner added `PUSH_FIXTURE_PASSWORD` and confirmed Push Notifications is enabled on the `dev.sallvain.mylove` App ID.

Hosted, read-only: secrets list names `APNS_KEY_ID`, `APNS_KEY_P8`, `APNS_TEAM_ID`. Before any write: migrations `20261031000000` and `20261031010000` applied, `pg_net` 0.19.5, trigger `love_notes_push_after_insert` enabled, 0 rows in `push_sender_settings`, `push_devices` and `push_requests`; fixture accounts only Claude Bot and Claude Partner.

Production write 1 (owner approved, 2026-10-31): inserted the `push_sender_settings` row with the secret from `encode(extensions.gen_random_bytes(32), 'hex')`; read back `row_count` 1 and `sender_url` `https://xojempkrugifnaveqtqc.supabase.co/functions/v1/send-push`; the secret was never read.

Production write 2 (owner approved, 2026-10-31): `fnox exec -- node scripts/provision-push-fixtures.mjs` exit 0: Riley and Avery created (not found before), both profile names reset (HTTP 200), linked both ways (HTTP 200 each), Claude Partner's password set (HTTP 200). Read back: all four `@test.example.com` accounts are linked both ways to their partner, display names Claude Bot, Claude Partner, Riley, Avery.

Simulator, real APNs sandbox (2026-10-31, local stack, iPhone Duo iOS 27.1): `sim provision` exit 0, `sim build` installed `sim-tree-1793494944`, `sim signin` exit 0, and Casey's registration was fresh, `sandbox`. `supabase functions serve --env-file <scratchpad file with the three APNs values, mode 600>`, then `sim background`; a note inserted from Jessie to Casey left one `push_requests` row with `delivery = 'sent'` (the sender's response was not captured; the row keeps `sent` only when the APNs call returns 2xx, unless a release after a refusal also failed, and the delivery below settles it), payload `{"aps": {"alert": {"body": "Real APNs sandbox check 3.13", "title": "Jessie"}, "thread-id": "love-notes"}}`. `sim center` (unfolded from closed and put back) printed `{"groups":[{"count":1,"text":"Jessie, Real APNs sandbox check 3.13"}]}`, exit 0. **Result: a real APNs sandbox push reaches the simulator** (read from Notification Center; no banner watch was running when it arrived, so whether a banner showed was not observed). The real key signed a provider token APNs accepted, so the PEM parsing needs no fix. Cleanup: serve stopped, no edge-runtime container, env file deleted, test note deleted.

Device build: web and native sources identical to `main` at the baseline (`git diff 56c1aaa3 -- src ios capacitor.config.ts package.json package-lock.json index.html public vite.config.ts` empty); `fnox exec -- npm run ios:sync` exit 0, bundle points at the hosted project; the owner installed it from Xcode over the existing shell on their iPhone, build number 1.

Device check 1, hosted note (2026-11-01 01:26 UTC): on first launch the new shell registered the owner's own account (one `sandbox` row), since it was still signed in. The owner's online sign-out removed that row, and signing in as Claude Bot left one `sandbox` row for Claude Bot. `send-note.mjs partner "Hosted push check 1"` (a scratchpad Playwright script that signs in on the website with the fnox password and sends from Love Notes) exit 0; hosted `push_requests` held one row for the note, `delivery = 'sent'`, `sandbox`, payload title "Claude Partner", body "Hosted push check 1", `thread-id` `love-notes`. **The lock screen showed My Love's notification "Claude Partner / Hosted push check 1", "now"** (owner's screenshot, not committed: it shows the owner's own wallpaper and other apps). The hosted trigger reaches the sender (the epic's Unknown, hosted half), and APNs delivers on a device.

Device check 2, same account after an offline sign-out (01:30–01:31 UTC): Airplane Mode with Wi-Fi off, sign-out, back online, sign in as Claude Bot. Hosted then held two Claude Bot `sandbox` rows: the 01:25 one (the offline sign-out could not remove it) and a new one at 01:30 with a different token, so APNs issued a new token after `unregister()`. "Hosted push check 2" gave two `push_requests` rows, both `delivery = 'sent'`; the sender answered `{"sent":2,"recorded":0,"skipped":0,"failed":0,"gone":0}` (`net._http_response` 200). APNs accepted the unregistered token with 200 rather than 410, but **the lock screen showed exactly one "Claude Partner / Hosted push check 2"**: pushes arrive again after re-registering, and the old token delivered nothing visible. The old row stays until APNs reports it gone.

Device check 3, takeover after an offline sign-out (01:57–01:59 UTC): offline sign-out, back online, sign in as Riley; hosted then held a new Riley `sandbox` row (a third token) beside Claude Bot's two. "Takeover check A" (Claude Partner to Claude Bot): two `push_requests` rows, both to Claude Bot's old rows, `{"sent":2,...,"gone":0}`; none to Riley's row; **the phone showed nothing** (owner). "Takeover check B" (Avery to Riley): one row to Riley's row, payload title "Avery", body "Takeover check B", `{"sent":1,...,"gone":0}`; **the phone showed "Avery / Takeover check B"** (owner). Story 2's device proofs hold: after `unregister()` the device gets a new token each sign-in, and its old tokens deliver nothing visible, though APNs keeps accepting them with 200 (no 410 within about 30 minutes), so the sender keeps sending to them. Recorded as DW-356; Claude Bot's two stale rows are kept so the 410 question can be re-read later.

Cleanup (owner approved): the four test notes between the fixture accounts deleted (`deleted` 4), hosted `push_requests` back to 0. The owner signed out of Riley online (Riley's row removed) and back in to their own account, which registered the phone at 02:01 UTC, so the owner's account now receives sandbox pushes on that phone. The local run left nothing running; the scratchpad holds no key, env file or token; `dist/` holds the `main` build from `ios:sync`.

Review patches (2026-11-01): shared `tests/support/helpers/node-script.ts` (`readBody`, `runNodeScript`) imported by both script tests; status asserted in the two tests that skipped it; a `pages` stub option and a page-2 test; `PUSH_FIXTURE_PASSWORD` got a description. After them: `npx vitest run tests/unit/scripts/` 2 files, 24 passed; `npm run lint` exit 0; `npx eslint tests/support/helpers/node-script.ts tests/unit/scripts/` exit 0; `npm run typecheck` exit 0; `deno test --no-lock supabase/functions/send-push/` 30 passed; fnox still decrypts `PUSH_FIXTURE_PASSWORD`.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 0, maybe-false 0; 1 rejected as a plan edit
- findings:
  - `[low]` `[patch]` (quick) `readBody`/`runScript` copied from `provision-claude-bot.test.ts` against AGENTS.md's shared-helper rule (DW-313) — verified identical; moved into one `tests/support/helpers/` module both tests import.
  - `[low]` `[patch]` (quick) two tests ignore the run's exit status, so an early exit passes over an empty `stub.seen` — verified at lines 227-237 and 288-293; both now assert exit 0 and requests seen.
  - `[low]` `[patch]` (quick) `findUser`'s page loop never runs past page 1 in a test — verified: the new stub has no per-page option; added one and a page-2 test.
  - `[low]` `[patch]` (quick) `PUSH_FIXTURE_PASSWORD` is the only fnox secret without a `description` — verified; description added, value untouched.
  - `[low]` `[reject]` (quick) AC4's evidence reads Notification Center, not a banner, and infers the APNs status as "200" — true (`handler.ts:177` keeps the row only on `result.ok`, a 2xx, or when a release after a refusal also throws); the fix is to the plan's notes, which now say Notification Center, no banner watched, and 2xx settled by the delivery.

## Design Notes

The hosted row needs no recoverable secret: rotating it is another `update ... set sender_secret = encode(extensions.gen_random_bytes(32), 'hex')`, which both sides pick up on their next call. Notes are sent from the website because the partner fixture has no shell; the trigger fires on any insert, and the website path is the same RLS insert the shell makes.

## Verification

**Commands:**
- `npx vitest run tests/unit/scripts/provision-push-fixtures.test.ts` -- expected: pass
- `npm run lint`, `npm run typecheck` -- expected: exit 0
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass (and after any sender fix)

**Manual checks:**
- Hosted read after each device step: `select status, count(*) from net._http_response where created > <step start> group by status` and the `send-push` function logs show 200s; `push_devices` row count per fixture account matches the step.
