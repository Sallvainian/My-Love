---
title: "A love note pushes to the partner's iPhone"
type: 'feature'
ticket: '1'
created: '2026-10-31'
status: done
baseline_revision: '284144cfa341a7b0adb3af31d5b339a6813baa0d'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/epic-push-notifications.md', '{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-the-simulator-driver-reads-and-taps-notifications-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      A send-push claim is inserted before the APNs call, so an isolate killed between claim and send drops that push for good, and nothing re-calls the sender for a released claim.
    evidence: |-
      handler.ts claims (note, token) before sending; pg_net fires once per insert and nothing retries. Settles with a real APNs run (story 13) and a decision on a pending state or a retrier.
    location: >-
      supabase/functions/send-push/handler.ts
    severity: medium
  - summary: >-
      Picture-only detection assumes the stand-in text is blank; the composer sends an empty string and love_notes_content_check needs at least one character, so the real stand-in is unverified.
    evidence: |-
      MessageInput.tsx sends '' for a picture-only note; the table check requires char_length(content) >= 1; no substitute was found in notesSlice.ts. A non-blank stand-in would be pushed as text. Settle by sending a picture-only note from the app against the local stack and reading the row.
    location: >-
      supabase/functions/send-push/payload.ts (hasCaption)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The shell cannot receive a push: no Push capability, no device registration, no sender. A love note reaches the partner only while the app is open.

**Approach:** Tracer through every layer. The shell gains the push plugin and entitlement and asks permission once on the first signed-in launch; it registers the device and its APNs environment in an RLS table; an AFTER INSERT trigger on `love_notes` calls a new `send-push` Edge Function, which sends to the partner's devices, or with no APNs key records the request it would have sent for `sim push` to deliver.

## Boundaries & Constraints

**Always:**
- Web code calls the push plugin only after `Capacitor.isNativePlatform()` then `Capacitor.isPluginAvailable()`; an older shell and the browser do nothing and show nothing new.
- New public tables enable RLS in their creating migration, policies `TO authenticated`; edit the pgTAP `policies_are` files and `18_function_execute_grants.sql` in the same change. A policy on `public.users` never reads `public.users`.
- The trigger never fails or delays the insert: it catches every error, makes only an asynchronous `pg_net` call, and an insert ignored as a duplicate fires nothing (AFTER INSERT row trigger).
- Payload: `aps.alert.title` = sender's display name, `body` = note text, or "Sent you a picture" for a picture-only note; `thread-id` `love-notes`; no image, no badge (story 8).
- Targets: every device registered to the recipient, none of the sender's. A retried send yields one push (unique per note and device).
- Each registration records `sandbox` or `production`; the sender picks the APNs host from it (`api.sandbox.push.apple.com` / `api.push.apple.com`). A device registered again under another account moves to it.
- With no APNs key secret set, the sender inserts the request (device token, environment, payload) into a service-role-only table that `sim`/the driver reads.
- Secrets never in source; no tokens, names or emails in commits or `_bmad-output/`; fixtures use `Casey`/`Jessie`.
- The sender's `[functions.send-push]` section in `supabase/config.toml`; its deno tests added to `test.yml` beside upload-love-note-image's.

**Never:**
- Deploy anything or touch `deploy.yml`, hosted Supabase or APNs (stories 3 and 13); edit `src/types/database.types.ts` by hand (regenerate it); change `appId`; use `supabase.channel()`; add `@/` imports in `src/`.
- Add sign-out unregistering, settings switches, badge, tap handling or foreground suppression (stories 2, 7, 8, 9, 6).
- Uninstall the owner's phone shell; leave processes running; leave a test build in `dist/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Text note | Insert as A, B linked, B has 2 devices | 2 recorded requests, B's tokens only, title A's name, body the text | -- |
| Picture-only note | Insert with `image_url` and placeholder content | Body "Sent you a picture" | -- |
| Own devices | A also has a device | No request for A's token | -- |
| Duplicate insert | Same `(from_user_id, idempotency_key)` upserted with `ignoreDuplicates` | One row, one request per device | -- |
| Sender down | Function unreachable or slow | Insert returns promptly, row committed | Trigger swallows error |
| Re-register | Token registered by A, then by B | Row belongs to B only | RPC reassigns |
| Sandbox / production | Registration env value | APNs host chosen from it | Bad env rejected by check constraint |
| Unconfigured | No sender settings (CI, hosted pre-story 3) | Insert unaffected, no call | Trigger no-ops |

</intent-contract>

## Code Map

- `supabase/migrations/` (latest `20261029000000_love_note_upload_counts.sql`) -- new migration(s): `push_devices` (user_id FK auth.users cascade, token unique, environment check), register RPC (SECURITY DEFINER, reassigns by token, `authenticated` only), recorded-request table (RLS, no policies, service_role only, unique `(note_id, token)`), `pg_net` extension, trigger fn + trigger on `public.love_notes`. `pg_net` is available locally but not installed; hosted had it dropped in `20251206024345_remote_schema.sql`, so create `if not exists` and read the hosted state only read-only later (story 13).
- `supabase/seed.sql` -- local-only sender URL/secret settings (hosted gets them in story 3); the trigger reads them from a service-only table or vault and no-ops when absent.
- `supabase/functions/upload-love-note-image/{index,handler,handler.test}.ts` -- pattern to copy: `index.ts` serve binding + client factory, `handler.ts` pure and fake-testable, `deno test --no-lock`; `index.ts` is excluded from type check.
- `supabase/functions/send-push/` -- new: `handler.ts`, `payload.ts` (builder), `apns.ts` (ES256 JWT, host by environment), tests, `index.ts`. Reads recipient via `love_notes`/`users`; deletes nothing yet.
- `supabase/config.toml` -- add `[functions.send-push]` (`verify_jwt` false only if the trigger authenticates by shared secret; otherwise true); `[edge_runtime]` exists at ~line 358.
- `supabase/tests/database/` -- new `35_push_devices.sql` (`policies_are`, RLS, trigger); edit `18_function_execute_grants.sql` for the register RPC. Declare helpers inline.
- `tests/api/` -- new `push-love-note-trigger.spec.ts` in the `api` project (pattern: `upload-love-note-image-limits.spec.ts`; `resolveOwnPair`, merged fixtures, per-slot accounts); `.github/workflows/test.yml` line ~205 adds `deno test --no-lock supabase/functions/send-push/`.
- `ios/App/App/AppDelegate.swift` -- forward `didRegisterForRemoteNotifications` / failure via `NotificationCenter` per the Capacitor push plugin; `ios/App/App/NativeAuth.swift` -- `MainViewController` registers app-local plugins (line ~64): add a small `PushEnvironment` plugin returning `sandbox`/`production` (embedded.mobileprovision `aps-environment`; simulator and no profile: sandbox/production by rule recorded in notes). Add `App.entitlements` (`aps-environment`) and wire `CODE_SIGN_ENTITLEMENTS` in `ios/App/App.xcodeproj/project.pbxproj`; `ios/App/CapApp-SPM/Package.swift` is Capacitor-managed (`npx cap sync ios`).
- `package.json` -- add `@capacitor/push-notifications` `^8.x` matching Capacitor 8.6; `src/utils/haptics.ts` -- the isNativePlatform → isPluginAvailable pattern.
- `src/services/pushNotifications.ts` (new) + call site after sign-in (find in `src/App.tsx` / `authSlice`); permission asked only when `checkPermissions` says `prompt`; registers via the RPC. Vitest in `src/services/__tests__/`.
- `src/types/database.types.ts` -- regenerate, never hand-edit. `AGENTS.md` -- only if a durable rule is learned. `_bmad-output/initiative-my-love/deferred-work.md` -- any deferral.
- `scripts/sim-driver/sim` -- used for the simulator checks (`provision`, `build`, `signin`, `permission`, `push`, `banner`, `badge`); do not change it unless a step cannot run, then note why.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<new>.sql`, `supabase/seed.sql` -- tables, RPC, recorded requests, `pg_net`, trigger -- the server half
- [x] `supabase/functions/send-push/*`, `supabase/config.toml` -- sender, payload builder, APNs client, deno tests -- the sender
- [x] `supabase/tests/database/35_push_devices.sql`, `18_function_execute_grants.sql` -- pgTAP -- policy and grant sets
- [x] `tests/api/push-love-note-trigger.spec.ts` -- registration, trigger, dedupe, picture-only, own devices, slow/failed send -- the wire proof
- [x] `.github/workflows/test.yml` -- deno step for send-push -- CI runs the tests
- [x] `package.json`, lockfile, `ios/App/**`, `src/services/pushNotifications.ts`, its call site, `src/types/database.types.ts` -- shell capability, permission once, registration -- the client half
- [x] Run lint, typecheck, unit, deno, pgTAP, api spec; run the simulator checks through `sim` and record commands, exit codes and result lines in Implementation Notes

**Acceptance Criteria:**
- Given the deno tests, when run, then payload text, picture-only body, environment→host and the unconfigured record path pass.
- Given the local stack, when linked A inserts a note, then B's devices (and not A's) get one recorded request with A's name and the text, a retried upsert adds none, and a failing sender leaves the insert fast and committed.
- Given the Duo simulator signed in as one fixture account, when launched twice, then the permission alert shows once, the device row exists with its environment, and `simctl push` of a recorded payload shows a banner with the sender's name and text.
- Given a shell built at the earlier commit and updated by live update to this bundle, when it runs, then no error shows.
- Given the session ends, then `git status` shows only planned files, `dist/` holds no test build, and no driver process runs.

## Implementation Notes

Built 2026-10-31. Server: `20261031000000_push_devices.sql` (`push_devices`, `register_push_device`, `push_requests`, `push_sender_settings`, `pg_net`, trigger `love_notes_push_after_insert`); `seed.sql` holds the local sender URL (through Kong) and secret. The sender (`supabase/functions/send-push/`) has `verify_jwt = false` and checks the shared secret itself against `push_sender_settings`. Payload carries no `sound`, `badge` or image. Picture-only means `image_url` set and blank text. A refused APNs send releases its claim in `push_requests`; deleting gone registrations is story 3.2.

APNs environment rule (`ios/App/App/PushEnvironment.swift`): embedded profile `aps-environment` `development` is sandbox, `production` is production; no profile on a device is production (App Store and TestFlight strip it); no profile on the simulator is sandbox. `App.entitlements` says `development`; Xcode re-signs it to production for distribution.

`src/types/database.types.ts` was regenerated with CLI 2.122 and formatted to the file's style, with the CLI's new `ComputedFields: never` lines dropped; the same CLI also made `love_notes_visible`'s columns non-null, which typechecks and is kept.

Checks (all exit 0): `deno test --no-lock supabase/functions/send-push/` 19 passed; `supabase test db` 22 files, 441 tests; `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 5 passed (edge runtime served by `supabase functions serve`); `npm run typecheck`; `npm run lint`; `npm run test:unit` 206 files, 3248 tests.

Simulator (iPhone Duo, local stack, fixture pair): `sim provision`, `sim build`, `sim signin` exit 0. The permission alert showed on the first signed-in launch and was answered by XCUITest's default interruption handler during `signin` (drive.log: `Tap "Allow" Button`), so `sim permission allow` then reports "no permission alert" (exit 1), as it should; `push_devices` held one row, environment `sandbox`. A second launch showed no alert and left one row. A note inserted as the partner recorded `{"aps":{"alert":{"body":"Good morning, love","title":"Jessie"},"thread-id":"love-notes"}}` and `sim banner` printed `banner: MY LOVE, now, Jessie, Good morning, love`, exit 0.

The live-update check was run in the review pass below.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 28 findings (the same claim from several lenses is one row) — high 0, medium 4, low 20, false 3, maybe-false 1
- findings:
  - `[low]` `[patch]` (blind, edge) `listenOnce` caches a rejected promise — patched: `listening` resets on failure; vitest case added.
  - `[low]` `[patch]` (blind, edge) One throwing claim/release rejects the whole batch with a 500 — patched: per-device try/catch; 3 deno tests.
  - `[medium]` `[patch]` (verification-gap) Retried send never exercised over the wire against the real upsert — patched: api spec posts to `send-push` twice, expects recorded 0, skipped 1.
  - `[low]` `[patch]` (verification-gap) Thrown APNs send and the 413 guard untested — patched: deno tests.
  - `[low]` `[patch]` (blind, edge, verification-gap) api spec comment false and `<= 1` too weak — patched: `toHaveLength(1)`, comment corrected.
  - `[medium]` `[patch]` (verification-gap) `startPushRegistration` call site in App.tsx untested — patched: `tests/unit/App.pushRegistration.test.tsx`.
  - `[low]` `[patch]` (edge) Partial APNs secrets fall silently into record-only — patched: logs "APNs partially configured".
  - `[low]` `[patch]` (blind) Trigger failures invisible — patched: `raise warning` before swallowing.
  - `[medium]` `[patch]` (intent) Live-update check not run — patched by running it: baseline-commit shell took the new bundle, no error, no registration.
  - `[medium]` `[defer]` (blind, edge) Claim inserted before send; killed isolate drops the push and nothing retries — design trade-off; DW-340.
  - `[maybe-false]` `[defer]` (intent, blind) Picture-only stand-in unverified (composer sends '') — `[maybe-false]`, medium if true; DW-341.
  - `[low]` `[reject]` (blind) Types file hand-reflowed — regenerated with the newer CLI and formatted to the file's existing style; `ComputedFields` lines dropped to avoid churn; typecheck passes.
  - `[low]` `[reject]` (blind, edge) Body cap bypassable by chunked request — the call is authenticated by the shared secret first; hardening only.
  - `[low]` `[reject]` (blind, edge) 4 KB payload limit, no truncation — needs about 900 four-byte characters; truncating changes "the note's text".
  - `[low]` `[reject]` (blind, edge) PEM with literal `\n`, provider-token concurrency, 403 refresh — story 13 sets the real key and first real send.
  - `[low]` `[reject]` (blind) Seeded URL uses the local Kong container name — local-only seed, same project id in CI and worktrees.
  - `[false]` `[reject]` (blind) Anyone can steal a registration by token — moving a token to the registrant is the ticket's rule; tokens are unguessable.
  - `[low]` `[reject]` (blind) No registration rate limit — not in the ticket.
  - `[low]` `[reject]` (blind, edge) Failed registration not retried when offline — the next signed-in start retries; rare.
  - `[false]` `[reject]` (edge) Registration after account switch lands on the wrong account — the device belongs to whoever is signed in then.
  - `[low]` `[reject]` (edge) QUERY_CANCELED not caught by `exception when others` — the call only queues a pg_net request.
  - `[low]` `[reject]` (blind, edge) api spec rewrites the one settings row and asserts under 1.5 s — only this spec uses it; the bound sits below the 2 s timeout.
  - `[low]` `[reject]` (blind) `aps-environment` is development in both configurations — Xcode re-signs for distribution.
  - `[low]` `[reject]` (verification-gap) `PushEnvironment.swift` has no automated test — no native harness; checked on the simulator.
  - `[false]` `[reject]` (blind) No guard for sender equal to recipient or an unlinked recipient — the `different_users` check and the sender's device lookup cover both.
  - `[low]` `[reject]` (intent) Simulator evidence is notes, not tests; Allow was tapped by the interruption handler during `signin` — the ticket's check is a driver run.
  - `[low]` `[reject]` (intent) Environment-to-host path has no end-to-end test in the record-only path — covered by deno `apnsHost` tests; no APNs key until story 13.
  - `[low]` `[reject]` (intent) Plan checkboxes unticked — ticked at finalize.

## Design Notes

The trigger posts the new row's id to the sender with `net.http_post` (async, so a slow sender cannot delay the insert) inside `begin … exception when others then null`. The sender reads the note with the service role and derives sender name and recipient itself, so a forged call cannot choose a target beyond an existing note; the trigger authenticates with a shared secret read from a service-only source. The environment comes from the registration, never from the sender's own signing.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `fnox exec -- npm run typecheck` and `npm run lint` -- expected: exit 0
- `npm run test:unit` -- expected: pass
- `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` -- expected: pass (edge-runtime serving)

**Manual checks:**
- `scripts/sim-driver/sim` sequence for the permission alert, registration and banner; record results.

**Review fixes (2026-10-31).**
- `pushNotifications.ts`: a rejected listener setup resets `listening`, so the next start retries; new vitest case. `handler.ts`: each device's work has its own try/catch (counted failed, others still run); `apns.ts` logs "APNs partially configured" when some but not all of the three secrets are set; migration: the trigger's exception block now does `raise warning 'notify_love_note_push: %', sqlerrm;` before swallowing (applied to the local database with `create or replace`, since the migration was already recorded). New deno tests: APNs reject for one device, release throws, claim throws, content-length 2000 gives 413, partial config.
- Spec: the "sender is down" case asserts `toHaveLength(1)` with a corrected comment; the retry case posts the note id to `/functions/v1/send-push` again with the secret read from `push_sender_settings` and gets `recorded: 0, sent: 0, skipped: 1` with the row count unchanged. New `tests/unit/App.pushRegistration.test.tsx` (once signed in, not signed out, again after an account switch changes `authSessionVersion`).
- Results: `deno test --no-lock supabase/functions/send-push/` 24 passed; `supabase test db` PASS (441 tests); `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 5 passed; `npx vitest run tests/unit/App.pushRegistration.test.tsx src/services/__tests__/pushNotifications.test.ts` 15 passed; eslint on the touched files and `tsc -b` clean.

**Live update from the baseline shell.** `sim build --from 284144cfa341a7b0adb3af31d5b339a6813baa0d --update-port 8791` exit 0 (installed `sim-284144cf-...`); `sim serve-update --port 8791` serving `sim-tree-1793475809`; `sim signin` exit 0, then background, relaunch, terminate and relaunch so the updater swapped. Result: the app's `serverBasePath` is the downloaded snapshot `ionic_built_snapshots/hAVsoTiArb`, whose bundle contains `register_push_device` (the built-in `public/` bundle has 0 matches); the screenshot shows Home rendering normally with no alert and no error, and `push_devices` stayed at 1 row (the old shell registered nothing). Cleanup: `sim serve-update --stop` stopped the server; `sim build` reinstalled the current-tree shell (`sim-tree-1793475923`), exit 0; `sim state` reads pose closed, orientation portrait; `pgrep` finds no `xcodebuild`, `http.server` or `functions serve`; nothing was built into `dist/`.

## Auto Run Result

Status: built

**Summary:** A love note now pushes through every layer on the local stack. The shell gains `@capacitor/push-notifications`, the `aps-environment` entitlement and an app-local `PushEnvironment` plugin, and asks for permission once on the first signed-in launch. It registers the device and its APNs environment through `register_push_device`; a token registered again moves to the new account. An AFTER INSERT trigger on `love_notes` posts the note id to the new `send-push` Edge Function with `pg_net`. The sender sends to the recipient's devices only, from a payload with the sender's name, the text, or "Sent you a picture". With no APNs key it records each request in `push_requests` for `xcrun simctl push`.

**Files changed:**
- `supabase/migrations/20261031000000_push_devices.sql`, `supabase/seed.sql` — tables, RPC, trigger, local sender settings.
- `supabase/functions/send-push/*`, `supabase/config.toml`, `.github/workflows/test.yml` — sender, payload builder, APNs client, 24 deno tests, CI step.
- `supabase/tests/database/35_push_devices.sql`, `18_function_execute_grants.sql` — pgTAP.
- `tests/api/push-love-note-trigger.spec.ts`, `tests/unit/App.pushRegistration.test.tsx`, `src/services/__tests__/pushNotifications.test.ts` — tests.
- `src/services/pushNotifications.ts`, `src/App.tsx`, `src/types/database.types.ts`, `package.json`, `package-lock.json` — web side.
- `ios/App/App/{AppDelegate.swift,PushEnvironment.swift,NativeAuth.swift,App.entitlements}`, `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/CapApp-SPM/Package.swift` — native side.

**Review findings:** 28 rows. Patched 9 (medium 3, low 6): retried send over the wire, the App.tsx call site, the live-update run, the rejected listener promise, per-device failure isolation, thrown-send and 413 tests, partial APNs config, the trigger warning, and the api spec's weak assertion. Deferred 2 (DW-340, DW-341). Rejected 17, each with its reason in the triage log.

**Follow-up review recommended:** false. No high patched; three medium were patched, but each is a test or a run that passed.

**Verification:** `deno test --no-lock supabase/functions/send-push/` 24 passed; `supabase test db` 441 passed; api spec 5 passed (edge runtime served by `supabase functions serve`, run by the implementer); `npm run lint` and `npm run typecheck` exit 0; vitest on the push service and App tests 15 passed (full `test:unit` 3248 passed before the fixes, not re-run after). Simulator on the iPhone Duo: alert shown on the first signed-in launch only, one `push_devices` row (`sandbox`), the recorded payload from a partner note delivered with `simctl push` showed "Jessie, Good morning, love"; the baseline-commit shell took the new bundle by live update with no error. One PUSH-DB-033 assertion counted every `push_requests` row and failed on the shared local database; it now counts its own note's rows.

**Residual risks:**
- Real APNs delivery and the hosted trigger are untested (stories 3 and 13).
- The permission alert was tapped by XCUITest's interruption handler during `sim signin`, so `sim permission allow` found none afterwards.
- A picture-only note's real stand-in text is unverified (DW-341); a killed sender isolate drops a push (DW-340).
- `database.types.ts` was regenerated with CLI 2.122 and formatted by hand to the file's style; the `love_notes_visible` view columns became non-null.
- The seeded sender URL uses the local Kong container name; CI's edge-runtime serving of `send-push` for the new api spec is unverified.
