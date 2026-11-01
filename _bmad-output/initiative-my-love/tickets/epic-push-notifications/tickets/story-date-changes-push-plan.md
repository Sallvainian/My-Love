---
title: 'Date changes push'
type: 'feature'
ticket: '5'
created: '2026-10-31'
status: done
baseline_revision: '5d92008130854d7ac47d31292212d3dd29fc7e0c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-moods-photos-pokes-and-kisses-push-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      src/types/database.types.ts is not the raw output of AGENTS.md's regeneration command; this story took only its own hunks from reformatted CLI output, as stories 3.1-3.4 did.
    evidence: |-
      Pre-existing drift already in the ledger as DW-357 (raw CLI 2.122 output differs from the committed file by 1268 diff lines). This story's change to the file is only the date_changes block and push_requests.date_change_id. The fix is an AGENTS.md decision or a one-time raw regeneration.
    location: >-
      src/types/database.types.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** A partner sees a new or changed event, wedding date, relationship start or birthday only when the app is open (R1). R7 says what each push says.

**Approach:** Use story 3.4's trigger-and-sender pattern, with one extra step. The triggers on `events`, `couple_settings` and `users` write one row per push-worthy change into a new service-only `date_changes` log. They then post `{kind: 'date', id}` to `send-push`. The sender reads that row, pushes to the sender's partner, and claims one `push_requests` row per (change, device). A log row is needed because an edit must push again for the same source row, and a `couple_settings` row does not record who changed it.

## Boundaries & Constraints

**Always:**
- Payloads use the `partner-activity` thread. The title is the sender's display name, or "Your partner" when there is none. No image, no `badge`, no `sound`, and no date value in the text (the recipient's timezone is unknown). The bodies are:
  - event inserted: `Added an event: <label>`. Event changed: `Changed an event: <label>` (the label as it is when the sender reads it).
  - wedding date NULL→date: `Set the wedding date`. Date→other date: `Changed the wedding date`.
  - relationship start NULL→value: `Set the date you got together`. Changed: `Changed the date you got together`.
  - birthday NULL→date: `Added their birthday`. Changed: `Changed their birthday`.
- Pushes are sent for these changes only:
  - an event INSERT;
  - an event UPDATE where `label`, `event_date`, `description` or `icon` is distinct from its old value;
  - a `couple_settings` INSERT, or an UPDATE, where `relationship_start` or `wedding_date` is non-NULL and distinct from its old value. One change is logged per such column;
  - a `users` UPDATE where `birthday` is non-NULL and distinct from its old value.
- Nothing pushes for an event DELETE, a value cleared to NULL, an update that changes only `updated_at` or other columns, or an `anniversaries` write (no trigger on that table).
- The sender is `events.user_id` for an event and `users.id` for a birthday. For `couple_settings` it is `auth.uid()`, and only when that is `user_a` or `user_b`; otherwise nothing is logged or posted. The recipient is the sender's `users.partner_id`. When there is none, or it equals the sender, the sender answers 200 with every count 0.
- With no `push_sender_settings` row the trigger logs and posts nothing. The whole body sits in `exception when others → raise warning`, so it never fails or delays the write (posting uses `net.http_post` with a 2 s timeout, as `notify_push` does).
- Deleting an event cascades to its `date_changes` and their `push_requests`. A replayed `{kind:'date', id}` is skipped for every device.
- `date_changes` enables RLS in its creating migration and has no policies. It grants nothing to anon or authenticated, and the trigger function's execute is revoked from public, anon and authenticated. pgTAP pins all of this. `database.types.ts` is regenerated, never hand-edited.
- The love-note, mood, photo and interaction paths are unchanged on the wire, and their tests keep passing.
- Fixtures are fictional (`Casey`/`Jessie`). Simulator checks run on the local stack only. The api spec restores any `couple_settings` or birthday value it changes.

**Never:**
- Deploy, or touch hosted Supabase, APNs or `deploy.yml`.
- Push on a delete, for anniversaries or for partner requests. Add switches, a badge, tap routing or foreground handling (stories 6–9).
- Change `notify_love_note_push`, `notify_push`, the client or the triggers of earlier migrations.
- Uninstall the owner's phone shell, leave serve or driver processes running, or leave a test build in `dist/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Event added | A (linked to B) inserts event `Paris trip` | One recorded request per B device: `Added an event: Paris trip`; none on A's devices | -- |
| Event edited | A changes `event_date` | New change, `Changed an event: Paris trip` | -- |
| Unchanged save | Event UPDATE setting the same label, date, description and icon, with a new `updated_at` | Nothing logged or posted | -- |
| Event deleted | A deletes the event | Nothing posted; its changes and requests are gone | -- |
| Wedding set / cleared | Upsert `wedding_date` `2027-06-12`, then `null` | One `Set the wedding date` push, then none | -- |
| Start set | Upsert `relationship_start` on a row that exists | `Set the date you got together` (or `Changed …` when it was set) | -- |
| Birthday | Owner sets their birthday; then sets it to the same value; then to NULL | `Added their birthday`, then none, then none | -- |
| Anniversary | Insert into `anniversaries` | Nothing posted | -- |
| Couple write, no session | Service role updates `wedding_date` | Nothing logged | -- |
| Replay / bad body | `{kind:'date', id}` posted again / unknown kind | All `skipped` / 400 | -- |
| Sender down | Empty `sender_url` | Write commits | Trigger swallows and warns |

</intent-contract>

## Code Map

- `supabase/migrations/20261031020000_push_moods_photos_interactions.sql` -- the pattern to copy: header style, `notify_push()` body, the `push_requests` FK-per-source columns and `push_requests_source_check`. Do not edit.
- `supabase/migrations/20261031030000_push_date_changes.sql` (new):
  - `public.date_changes` (`id uuid pk default gen_random_uuid()`, `sender_id uuid not null → public.users on delete cascade`, `subject text check in ('event','wedding_date','relationship_start','birthday')`, `action text check in ('added','changed')`, `event_id uuid → public.events on delete cascade`, `created_at`, with the check `(subject = 'event') = (event_id is not null)`). It enables RLS, revokes all from anon and authenticated, and has an index on `event_id`.
  - `push_requests.date_change_id`: an FK with cascade, `unique (date_change_id, token)`. `push_requests_source_check` is dropped and re-added with five columns.
  - `public.notify_date_change()`: SECURITY DEFINER, `search_path = ''`, branching on `tg_table_name`. It inserts one `date_changes` row per change and posts `{kind:'date', id}` for each.
  - Triggers: `events_push_after_insert`, and `events_push_after_update` (`after update … when (old.label is distinct from new.label or …)`); `couple_settings_push_after_insert` / `_after_update` (with a WHEN clause on the two columns); `users_push_after_birthday` (`after update of birthday … when (new.birthday is not null and old.birthday is distinct from new.birthday)`).
  - Comments on the tables and the function.
- `src/services/coupleSettingsService.ts` -- read only. It upserts one column with `onConflict: 'user_a,user_b'`, so an existing row takes the UPDATE path and fires AFTER UPDATE, not AFTER INSERT. A first write INSERTs with the other column NULL.
- `supabase/functions/send-push/handler.ts` -- add `'date'` to `POSTED_KINDS` and `PushKind`, `DateChangeRow {id, sender_id, subject, action, event_label: string | null}`, and `PushDb.getDateChange`. In `resolveSource`, the recipient is `getPartnerId(sender_id)`. An event change whose label is null is treated as gone (404). Update the header doc.
- `supabase/functions/send-push/payload.ts` -- `buildDatePayload(change, senderName)` with the constants above. Update the header.
- `supabase/functions/send-push/index.ts` -- `SOURCE_COLUMN.date = 'date_change_id'`. `getDateChange` reads `date_changes`, then `events.label` when `event_id` is set.
- `supabase/functions/send-push/{handler,payload}.test.ts` -- extend `fakeDb` and add a case for each body and edge.
- `supabase/tests/database/35_push_devices.sql` -- new cases in the PUSH-DB-044..057 style. Use `tests.authenticate_as` / `tests.clear_jwt` for `couple_settings`, which needs a linked pair, so link `a`/`b` via `users.partner_id` as superuser. Raise `plan(57)` to match. `18_function_execute_grants.sql` FN-GRANT-008 must stay unchanged.
- `tests/api/push-love-note-trigger.spec.ts` -- add a third `describe` in the same serial file (it shares the one `push_sender_settings` row). Reuse `clientFor`, `newToken`, `resolveOwnPair`, `requestsFor(…, 'date_change_id')` and `postToSender`. Find a change via `date_changes` (by `event_id`, or by `sender_id` + `subject` + newest). Write `couple_settings` and the birthday through the user client (`clientFor`) so `auth.uid()` is set, then restore the originals afterwards.
- `src/types/database.types.ts` -- regenerate it as story 3.4 did (Implementation Notes there).
- `scripts/sim-driver/sim` -- `provision`, `build`, `signin`, `banner FILE`. Unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261031030000_push_date_changes.sql` -- log table, push_requests column and check, trigger function, five triggers -- server half
- [x] `supabase/functions/send-push/{payload,handler,index}.ts` + tests -- `date` kind, recipient, R7 bodies, claim by `date_change_id` -- sender
- [x] `supabase/tests/database/35_push_devices.sql` -- each push and no-push row of the matrix, as queued calls and `date_changes` rows; no-settings queues nothing; a failing call keeps the write; RLS, policies, grants, cascade, source check -- DB proof
- [x] `tests/api/push-love-note-trigger.spec.ts` -- event add and edit, wedding date, start, birthday each record their body on B's devices only; delete, wedding cleared, unchanged event save and anniversary record nothing after 3 s; replay skipped -- wire proof
- [x] `src/types/database.types.ts` -- regenerate
- [x] Simulator: run the checks below and record commands, exit codes and result lines in Implementation Notes

**Acceptance Criteria:**
- Given the deno tests, when run, then every date body, the replay skip, the unlinked sender's zero result and the missing change's 404 pass.
- Given the local stack and linked A/B with devices, when A adds and edits an event and sets the wedding date, the relationship start and A's birthday, then each records one request per B device with its R7 body. Deleting an event, clearing the wedding date, saving an unchanged event and adding an anniversary record none.
- Given the Duo simulator signed in as Casey, when Jessie's event is inserted and Jessie's birthday is cleared and then set, and each recorded payload is delivered with `sim banner FILE`, then the banners read `Jessie, Added an event: <label>` and `Jessie, Added their birthday`.
- Given the session ends, then `git status` shows only planned files, `dist/` holds no test build, and no serve or driver process is running.

## Implementation Notes

Built 2026-10-31. Migration `20261031030000_push_date_changes.sql`: `date_changes` (RLS on, no policies, all revoked from anon/authenticated, index on `event_id`), `push_requests.date_change_id` (FK cascade, `unique (date_change_id, token)`, `push_requests_source_check` re-added over five columns), `notify_date_change()` (SECURITY DEFINER, execute revoked from public/anon/authenticated) and the five triggers. The function collects the changes of one write into two arrays and logs and posts each in a loop; it reads `old` only in an UPDATE. First pgTAP run caught `text[] || 'literal'` parsing the literal as an array (swallowed by the exception block, so every couple_settings write logged nothing); fixed with `array_append`. The exception block is a subtransaction, so a post that raises also rolls back the change rows logged in that call.

Sender: `date` kind in `POSTED_KINDS`/`PushKind`, `DateChangeRow`, `PushDb.getDateChange` (reads `date_changes`, then `events.label`), recipient `getPartnerId(sender_id)`, an event change with no label is a 404, `buildDatePayload`, `SOURCE_COLUMN.date = 'date_change_id'`.

`src/types/database.types.ts` was regenerated with CLI 2.122 and formatted as story 3.4 did (prettier to stdout, `ComputedFields: never` dropped); only the `date_changes` block and the `push_requests.date_change_id` column and relationship were taken (DW-357 covers the rest of the file's drift).

The worktree's `node_modules` was empty; `npm ci` fixed it (gitignored). The migration was applied to the shared local database with `supabase migration up --local` (once rolled back by hand to apply the corrected file); `provision` then seeded events through the new trigger, so a few `date_changes` rows for the driver's fixture accounts remain locally.

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 61 passed; `deno check` on the function files clean; `supabase test db` 22 files, 500 tests, PASS (`35_push_devices.sql` plan 57 -> 91, PUSH-DB-058..091); `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 14 passed (4 new, `supabase functions serve` running, stopped afterwards); `npm run lint` and `npm run typecheck` exit 0.

Simulator (iPhone Duo, local stack): `sim provision` exit 0, `sim build` exit 0 (installed `sim-tree-1793502052`), `sim signout` exit 1 (already signed out after the fresh install: "no Settings button"), `sim signin` (Casey) exit 0. Jessie's event `Lisbon weekend` and birthday (cleared, then set) were written with the database superuser; each recorded `push_requests.payload` (3 requests each, all Casey's devices) was written to a scratchpad file and delivered with `sim banner FILE`, exit 0 each: `banner: MY LOVE, now, Jessie, Added an event: Lisbon weekend` and `banner: MY LOVE, now, Jessie, Added their birthday`. Test event deleted and birthday restored to NULL afterwards; `functions serve` stopped; no `xcodebuild`, `http.server` or serve process; `dist/` absent.

## Plan Change Log

## Review Triage Log

### 2026-10-31 — Review pass
- verdicts: 5 findings — high 0, medium 1, low 4, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` `tests.date_state()` counted every non-event `date_changes` row in the shared local database, so a birthday, wedding or start-date row left by a local E2E run (birthdays-wedding, couple-start-date) would break PUSH-DB-074..088 — verified: the local seed has a `push_sender_settings` row, so those specs' writes log rows that nothing removes (the local DB held only 6 event rows at review time, which is why the run passed). Patched: the helper and its two cleanup deletes now filter on the file's three test accounts.
  - `[low]` `[defer]` `database.types.ts` is selected hunks of reformatted CLI output, not the raw command output — verified pre-existing practice since story 3.1, already ledgered as DW-357; frontmatter `deferred` records it, and no new ledger entry is needed.
  - `[low]` `[patch]` the no-settings and failing-call cases covered only the events trigger — verified in PUSH-DB-089..091. Patched: a couple write (as a pair member) and a birthday write now also log nothing with no settings and commit when the pg_net call raises (PUSH-DB-089..093).
  - `[low]` `[patch]` nothing checked the migration header's claim that a raising post rolls back that call's change rows — verified. Patched: PUSH-DB-094 asserts no `date_changes` row for the failing event, couple or birthday writes.
  - `[low]` `[patch]` an edited `handler.ts` header-doc line ran past the comment width — verified. Patched: re-wrapped only the edited lines.

## Design Notes

A `couple_settings` INSERT carrying both dates logs two changes, so it sends two pushes. The client never does this (each save sends one column). `deploy.yml` applies migrations before functions, so until `send-push` redeploys, the old sender answers 400 to `{kind:'date'}` and those first date pushes are lost. Simulator recipe (story 3.4's):
1. `supabase start`.
2. Run `supabase functions serve` with no APNs env, so requests are recorded.
3. `sim provision`, then `sim build`, then `sim signin`.
4. Insert Jessie's event and update Jessie's birthday with the service role.
5. Read each `push_requests.payload` into a scratchpad file.
6. `sim banner FILE`.
7. Delete the test event and restore the birthday afterwards.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` -- expected: pass (with `supabase functions serve` running)
- `npm run lint`, `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** A partner now gets a push when the other adds or changes an event, sets or changes the wedding date or the date they got together, or sets or changes their own birthday. Triggers on `events`, `couple_settings` and `users` call `notify_date_change()`, which logs each push-worthy change in a new service-only `date_changes` table and posts `{kind: 'date', id}` to `send-push`. The sender reads the change, pushes to the sender's partner and claims one `push_requests` row per (change, device) in the new `date_change_id` column. The R7 bodies are `Added an event: <label>`, `Changed an event: <label>`, `Set the wedding date`, `Changed the wedding date`, `Set the date you got together`, `Changed the date you got together`, `Added their birthday` and `Changed their birthday`, on the `partner-activity` thread. Nothing is pushed for a delete, a value cleared to NULL, an update that changes nothing the partner sees, an anniversary, or a `couple_settings` write with no member session.

**Files changed:**
- `supabase/migrations/20261031030000_push_date_changes.sql`: `date_changes` (RLS on, no policies, revoked from anon and authenticated), `push_requests.date_change_id` and the five-source check, `notify_date_change()`, five triggers.
- `supabase/functions/send-push/{handler,payload,index}.ts`: the `date` kind, the recipient lookup, `buildDatePayload`, and claim and release by `date_change_id`.
- `supabase/functions/send-push/{handler,payload}.test.ts`: deno cases for every body, replay, unlinked sender, 404 and release.
- `supabase/tests/database/35_push_devices.sql`: PUSH-DB-058..094 (plan 57 -> 94).
- `tests/api/push-love-note-trigger.spec.ts`: a third `describe` (event, wedding date, start date, birthday), plus `date` in the 404 check.
- `src/types/database.types.ts`: `date_changes` and `push_requests.date_change_id`.

**Review findings:** 5 (quick lens).
- Patched 4: medium 1 (`date_state()` scoping), low 3 (failure-path coverage for the couple and birthday triggers, a rollback assertion, the comment wrap).
- Deferred 1: low, DW-357, pre-existing.
- Rejected none.

**Follow-up review recommended:** false. No high was patched, and only one medium.

**Verification (after the patches):**
- `deno test --no-lock supabase/functions/send-push/`: 61 passed.
- `supabase test db`: 22 files, 503 tests, PASS.
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts`: 14 passed, with `supabase functions serve` running, stopped afterwards; no edge container is left.
- `npm run lint` and `npm run typecheck`: exit 0.
- Simulator, from the implementer's run (iPhone Duo, local stack, signed in as Casey): the banners read `Jessie, Added an event: Lisbon weekend` and `Jessie, Added their birthday`.
- No `dist/`, no `deno.lock`, and no serve or driver process is left.

**Residual risks:**
- On deploy, migrations land before functions, so until `send-push` redeploys, the old sender answers 400 to `{kind: 'date'}` and those first date pushes are lost.
- A `couple_settings` insert carrying both dates sends two pushes. The client never does this.
- A `couple_settings` write made with the service role (no session) never pushes.
- The hosted project and real APNs delivery of date pushes are untested.
- Every event, couple-settings or birthday change on a stack with `push_sender_settings` adds a `date_changes` row. Nothing prunes them; there are 6 event rows from `sim provision` in the local database.
