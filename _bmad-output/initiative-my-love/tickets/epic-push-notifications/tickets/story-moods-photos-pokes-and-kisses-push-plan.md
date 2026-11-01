---
title: 'Moods, photos, pokes and kisses push'
type: 'feature'
ticket: '4'
created: '2026-10-31'
status: done
baseline_revision: '74897fd930ccbe2898bd13dd41bfd8f04f94444f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-a-love-note-pushes-to-the-partner-s-iphone-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      src/types/database.types.ts is not the raw output of AGENTS.md's regeneration command; it is reformatted by hand, as stories 3.1 and 3.2 did, so the documented command rewrites the whole file.
    evidence: |-
      CLI 2.122 raw output differs from the committed file by 1268 diff lines, at baseline 74897fd9 too; this story's change to the file is only the push_requests block. Fix is a decision on AGENTS.md or a one-time raw regeneration. Ledger DW-357.
    location: >-
      src/types/database.types.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** Only a new love note pushes. A new mood, photo, poke or kiss reaches the partner only while the app is open (R1), and R7 fixes what each push says.

**Approach:** Extend story 1's trigger-and-sender pattern: AFTER INSERT triggers on `moods`, `photos` and `interactions` post `{kind, id}` to `send-push`; the sender reads the row with the service role, finds the recipient (the owner's `partner_id` for a mood or photo, `to_user_id` for an interaction), builds the R7 payload and claims one `push_requests` row per (row, device), exactly as for notes.

## Boundaries & Constraints

**Always:**
- Payloads (title = sender's display name, fallback "Your partner"; no image, no `badge`, no `sound`; `thread-id` `partner-activity`, so love notes stay their own lock-screen stack, R4):
  - mood: body `Logged a mood: <labels>` — labels as `MOOD_DISPLAY` (`src/constants/moodDisplay.ts`) spells them, for the valid `mood_types` in stored order, else `mood_type` (the rule of `normalizeMoodValues`, `src/types/moods.ts:25`), joined `, `; no valid value → `Logged a mood`. The mood's note is not included.
  - photo: `Added a photo`. poke: `Poked you`. kiss: `Sent you a kiss`.
- One push per new row: only an inserted row fires. A mood upsert that hits `(user_id, created_at)` and updates the row (`moodApi.create`, `sw.ts upsertMood`, `merge-duplicates`) and any UPDATE push nothing; a retried photo upsert ignored on `storage_path` pushes nothing.
- Partner's devices only: no recipient (mood/photo owner unlinked) or recipient equal to the sender → 200 with all counts 0, no claim.
- The triggers never fail or delay the insert (same body shape as `notify_love_note_push`: settings read, `net.http_post` 2 s timeout, `exception when others` → `raise warning`).
- The love-note path is unchanged on the wire: its trigger still posts `{note_id}` and the sender still accepts it; existing tests keep passing.
- Deleting a mood, photo or interaction deletes its `push_requests` rows (FK cascade), as notes do.
- RLS/grants: the new trigger function is executable by no API role; pgTAP pins it. `database.types.ts` regenerated, never hand-edited.
- Fixtures fictional (`Casey`/`Jessie`); simulator checks on the local stack only.

**Never:**
- Deploy, touch hosted Supabase, APNs or `deploy.yml`.
- Push for deletes, updates, the fart animation, dates or partner requests (stories 5, 6); add switches, badge, tap routing or foreground handling (stories 7–9).
- Change `notify_love_note_push`, `register_push_device`, `unregister_push_device` or the client.
- Uninstall the owner's phone shell; leave serve/driver processes running; leave a test build in `dist/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New mood | A (linked to B) inserts `happy`+`grateful`; B has 2 devices, A has 1 | 2 recorded rows on B's tokens: title A's name, body `Logged a mood: Happy, Grateful` | -- |
| Mood re-sent | Same `(user_id, created_at)` upserted again (merge-duplicates) | Row updated, no second call, rows unchanged | -- |
| New photo / poke / kiss | Inserted by A | One row per B device, body `Added a photo` / `Poked you` / `Sent you a kiss` | -- |
| Photo retry | Same `storage_path`, `ignoreDuplicates` | No second push | -- |
| Unlinked owner | Mood/photo by user with null `partner_id` | 200, all counts 0 | -- |
| Sender replay | `{kind, id}` posted again | `skipped` per device, nothing recorded | -- |
| Bad body | Unknown `kind`, non-uuid id | 400 | -- |
| Row gone | Valid kind, missing id | 404 | -- |
| Sender down | Unreachable URL | Insert fast and committed | Trigger swallows, warns |

</intent-contract>

## Code Map

- `supabase/migrations/20261031000000_push_devices.sql` -- the pattern: `notify_love_note_push` (~line 172), `push_requests` (`note_id` NOT NULL FK cascade, unique `(note_id, token)`). Do not edit.
- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql` (new) -- `push_requests`: `note_id` nullable; add nullable `mood_id`, `photo_id`, `interaction_id`, each FK to its table `on delete cascade`, each `unique (<col>, token)`; `check (num_nonnulls(note_id, mood_id, photo_id, interaction_id) = 1)`. Existing hosted rows all carry `note_id`, so the check holds. New `public.notify_push()` (SECURITY DEFINER, `search_path = ''`) posting `jsonb_build_object('kind', tg_argv[0], 'id', new.id)`; triggers `moods_push_after_insert` (`'mood'`), `photos_push_after_insert` (`'photo'`), `interactions_push_after_insert` (`'interaction'`), AFTER INSERT FOR EACH ROW. Revoke execute from public, anon, authenticated. Header comment in the style of the 20261031 files.
- `supabase/functions/send-push/handler.ts` -- accept `{note_id}` (kind `love_note`) or `{kind: 'mood'|'photo'|'interaction', id}`; resolve a source `{kind, id, senderId, recipientId, payload}`, then the existing per-device loop unchanged. `PushRequestRow.note_id` → `kind` + `source_id`; `releaseRequest(kind, sourceId, token)`. `PushDb` gains `getMood`, `getPhoto`, `getInteraction`, `getPartnerId`. Update the header doc.
- `supabase/functions/send-push/payload.ts` -- add builders for mood, photo, interaction with the constants above; a Deno-side copy of the 12 mood labels (cannot import `src/`), with a comment naming `MOOD_DISPLAY` as the source.
- `supabase/functions/send-push/index.ts` -- real DB wiring; map kind → column (`note_id`/`mood_id`/`photo_id`/`interaction_id`) in `claimRequest` (`onConflict: '<col>,token'`, `ignoreDuplicates`) and `releaseRequest`; `getPartnerId` reads `users.partner_id`.
- `supabase/functions/send-push/{handler,payload}.test.ts` -- existing fake DB (`fakeDb`); extend it per kind.
- `supabase/tests/database/35_push_devices.sql` -- trigger cases follow PUSH-DB-026..033 (read `net.http_request_queue`); bump `plan(41)`. `18_function_execute_grants.sql` FN-GRANT-008's list must stay unchanged.
- `tests/api/push-love-note-trigger.spec.ts` -- add a second `describe` here, not a new file: its "sender is down" test rewrites the one `push_sender_settings` row, and a parallel file's triggers would then miss the sender. Reuse `clientFor`, `newToken`, `resolveOwnPair`; generalise `requestsFor` to take a column. Interactions are partner-only (`interactions_sender_to_partner_insert`); photos need `storage_path`, `filename`, `file_size`, `width`, `height`.
- `src/types/database.types.ts` -- regenerate (AGENTS.md command).
- `scripts/sim-driver/sim` -- `provision`, `build`, `signin`, `banner FILE`; unchanged.
- `_bmad-output/initiative-my-love/deferred-work.md` -- any deferral.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261031020000_push_moods_photos_interactions.sql` -- columns, check, uniques, trigger fn, three triggers -- server half
- [x] `supabase/functions/send-push/{payload,handler,index}.ts` + tests -- kinds, recipients, R7 payloads, claim by kind -- sender
- [x] `supabase/tests/database/35_push_devices.sql` -- one queued `{kind,id}` call per new mood/photo/interaction; a mood `on conflict (user_id, created_at) do update` queues none; the source check refuses zero or two ids; deleting a mood deletes its requests; trigger fn not executable by anon/authenticated -- DB proof
- [x] `tests/api/push-love-note-trigger.spec.ts` -- mood (multi-label body, partner tokens only), mood re-sent with same key (one row, no new request after 3 s), photo, poke, kiss, sender replay skipped -- wire proof
- [x] `src/types/database.types.ts` -- regenerate
- [x] Simulator: run the checks below and record commands, exit codes and result lines in Implementation Notes

**Acceptance Criteria:**
- Given the deno tests, when run, then each kind's payload, the unknown-kind 400, the unlinked-owner zero result and the replayed `{kind,id}` skip pass.
- Given the local stack and linked A/B with devices, when A inserts a mood, a photo, a poke and a kiss, then each gets one recorded request per B device with the R7 text and none for A's device, and re-sending the mood with the same `(user_id, created_at)` adds none.
- Given the Duo simulator signed in as Casey, when Jessie's mood, photo, poke and kiss are inserted and each recorded payload is delivered with `sim banner FILE`, then each banner reads `Jessie` with its R7 body.
- Given the session ends, then `git status` shows only planned files, `dist/` holds no test build, and no serve or driver process runs.

## Implementation Notes

Built 2026-10-31. Migration `20261031020000_push_moods_photos_interactions.sql`: `push_requests.note_id` nullable, `mood_id`/`photo_id`/`interaction_id` (FK cascade, `unique (<col>, token)`), `push_requests_source_check` (`num_nonnulls(...) = 1`), `notify_push()` (SECURITY DEFINER, posts `{kind, id}`, execute revoked from public/anon/authenticated) and the three AFTER INSERT triggers. The sender (`handler.ts`) parses `{note_id}` or `{kind, id}` (kinds `mood`, `photo`, `interaction`; `love_note` is not accepted on the wire), resolves a source with its sender and recipient (owner's `users.partner_id` for a mood or photo, `to_user_id` for an interaction), and runs the unchanged per-device loop. No recipient, recipient equal to sender, or an interaction type other than `poke`/`kiss` answers 200 with all counts 0 and claims nothing. `payload.ts` holds the builders and a Deno copy of the 12 mood labels (source: `MOOD_DISPLAY`). `index.ts` maps kind to column for `claimRequest` and `releaseRequest`.

`src/types/database.types.ts` was regenerated with CLI 2.122 (AGENTS.md command), then formatted by piping through `prettier --no-config --no-semi --ignore-path /dev/null --stdin-filepath` to stdout (no file was `--write`n) with the CLI's `ComputedFields: never` lines dropped; the diff is the `push_requests` columns and relationships only.

The worktree's `node_modules` was empty and the main checkout's lacks `@capacitor/push-notifications`, so `npm run typecheck` first failed in `pushNotifications.ts` (story 1's file); `npm ci` in the worktree fixed it (gitignored).

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 50 passed; `deno check` on the function files clean; `supabase test db` 22 files, 466 tests, PASS (`35_push_devices.sql` plan 41 -> 57); `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 10 passed (4 new; `supabase functions serve` running, stopped afterwards); `npm run lint` and `npm run typecheck` clean.

Simulator (iPhone Duo, local stack): `sim provision`, `sim build` (installed `sim-tree-1793500523`), `sim signout`, `sim signin` (Casey) exit 0. Jessie's mood (`happy`,`grateful`, with a note), photo, poke and kiss inserted with the service role; each recorded `push_requests.payload` was written to a scratchpad file and delivered with `sim banner FILE`, exit 0 each: `banner: MY LOVE, now, Jessie, Logged a mood: Happy, Grateful`; `... Jessie, Added a photo`; `... Jessie, Poked you`; `... Jessie, Sent you a kiss`. Casey's fixture account already held a stale second token from earlier runs, so each row recorded two requests, both Casey's. Test rows deleted afterwards (cascade left 0 requests); `functions serve` stopped; no `xcodebuild`, `http.server` or serve process; `dist/` absent; the shell on the simulator is the working-tree build.

Verify (coordinator, 2026-10-31): PUSH-DB-052 counted every `kiss` and every mood at its timestamp in the shared local database (the trap story 1's PUSH-DB-033 hit); now scoped to the test user. Re-run: `deno test --no-lock supabase/functions/send-push/` 50 passed; `supabase test db` 22 files, 466 tests, PASS; api spec 10 passed (`supabase functions serve`, stopped afterwards, no edge container left); `npm run lint` and `npm run typecheck` exit 0.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` (quick) `database.types.ts` is reformatted output, not the raw AGENTS.md command output — verified: raw CLI 2.122 output differs from the committed file by 1268 diff lines, already at baseline 74897fd9 (stories 3.1/3.2 set the practice); this diff touches only `push_requests`. Pre-existing, and the fix is an AGENTS.md decision or a whole-file rewrite; DW-357.
  - `[low]` `[patch]` (quick) `push_sender_settings` table comment still says only the love-note trigger reads it — verified in 20261031000000; patched: the new migration sets a comment naming `notify_love_note_push` and `notify_push`.

## Design Notes

Separate nullable FK columns (not one `source_id`) keep the cascade on delete and leave every existing `note_id` row, query and test valid. `deploy.yml` applies migrations before functions, so for the minutes between them the old sender answers 400 to `{kind,id}`: those first pushes are lost, love notes are not. Simulator recipe (story 1's): `supabase start`; `supabase functions serve` with no APNs env (records); `sim provision`, `sim build`, `sim signin`; insert each row as Jessie with the service role; read its `push_requests.payload` into a scratchpad file; `sim banner FILE` → `banner: MY LOVE, now, Jessie, Logged a mood: …`. Delete the test rows afterwards.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` -- expected: pass (with `supabase functions serve` running)
- `npm run lint`, `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** A new mood, photo, poke or kiss now pushes to the partner's devices. AFTER INSERT triggers on `moods`, `photos` and `interactions` call a new `notify_push()` that posts `{kind, id}` to `send-push`. The sender reads the row with the service role and picks the recipient: the owner's `partner_id` for a mood or photo, `to_user_id` for an interaction. It claims one `push_requests` row per (row, device). The R7 payloads are titled with the sender's name, with the bodies `Logged a mood: Happy, Grateful`, `Added a photo`, `Poked you` and `Sent you a kiss`, on the `partner-activity` thread. A mood upsert that hits its `(user_id, created_at)` key, any update, and a photo retry ignored on `storage_path` push nothing. Love notes still post `{note_id}`, unchanged.

**Files changed:**
- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql`: one-source `push_requests` (nullable `note_id` and new `mood_id`/`photo_id`/`interaction_id`, FK cascade, unique per token, source check), `notify_push()`, three triggers, table comments.
- `supabase/functions/send-push/{handler,payload,index}.ts`: `{kind, id}` parsing, recipient resolution, R7 builders, mood labels, claim and release by kind.
- `supabase/functions/send-push/{handler,payload}.test.ts`: deno cases for every kind and edge case.
- `supabase/tests/database/35_push_devices.sql`: 16 pgTAP assertions (triggers, upsert and update queue nothing, inserts survive a failing call, source check, cascade, grant).
- `tests/api/push-love-note-trigger.spec.ts`: second `describe` for mood (with re-send), photo (with retry), poke, kiss, replay, and bad bodies.
- `src/types/database.types.ts`: `push_requests` regenerated.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-357.

**Review findings:** 2 (quick lens). Patched 1 low: the `push_sender_settings` comment. Deferred 1 low: DW-357, the types file is not raw command output (pre-existing). Rejected none. Patched by verdict: high 0, medium 0, low 1.

**Follow-up review recommended:** false. Only one low entry was patched.

**Verification:**
- `deno test --no-lock supabase/functions/send-push/`: 50 passed.
- `supabase test db`: 22 files, 466 tests, PASS.
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts`: 10 passed, with `supabase functions serve`, stopped afterwards.
- `npm run lint` and `npm run typecheck`: exit 0.
- All of the above were re-run after the review patch.
- Simulator (iPhone Duo, local stack, signed in as Casey): Jessie's mood, photo, poke and kiss gave the banners `Jessie, Logged a mood: Happy, Grateful`, `Jessie, Added a photo`, `Jessie, Poked you` and `Jessie, Sent you a kiss`.
- No serve, driver or `xcodebuild` process is left, and there is no `dist/`.

**Residual risks:**
- On deploy, migrations land before functions, so until `send-push` redeploys, the old sender answers 400 to `{kind, id}` and those first pushes are lost; love notes are unaffected.
- The hosted project and real APNs delivery of the new kinds are untested here.
- Every mood, photo and interaction insert anywhere, E2E seeding included, now queues one `pg_net` call while `push_sender_settings` has a row.
