---
title: 'Love notes stack apart and the badge counts unread notes'
type: 'feature'
ticket: '8'
created: '2026-11-01'
status: done
baseline_revision: '25d1cd9966d9dffacd1e48c119e466834508004d'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-each-push-type-has-a-settings-switch-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      A push arriving while Love Notes is in front may leave its badge showing on a real iPhone, because the second clear waits a fixed 1 s measured only on the simulator.
    evidence: |-
      The plugin's willPresent notifies the web view and then returns the badge option, so iOS applies the badge after the first clear. On the Duo simulator a clear 1 s later held on every run; no device was checked. Settle on the owner's iPhone in story 3.11 (Love Notes in front, a partner note leaves the badge clear). Ledger DW-361.
    location: >-
      src/hooks/useLoveNotesReadMarker.ts (FOREGROUND_BADGE_RECLEAR_MS)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** Every push already carries a lock-screen group (`aps.thread-id`: `love-notes` for notes, `partner-activity` for every other kind), but nothing pins that, and no push carries a badge. So the app icon never shows unread love notes (R5). With the app in front, the shell shows no banner and also sets no badge, because the push plugin has no `presentationOptions` (R8).

**Approach:** Add a per-account server-side marker, `love_notes_read_markers`, that records when the person last opened Love Notes, written with the server clock through a new RPC. Add a service-role SQL function that counts the partner notes newer than the marker; the sender puts that count in `aps.badge` on every push. In the web code, Love Notes writes the marker and clears the badge in the background: when it opens, when it comes back to the front, when a partner note arrives on screen, and when a push arrives while it is on screen. The shell's foreground presentation becomes badge-only.

## Boundaries & Constraints

**Always:**
- `public.love_notes_read_markers`:
  - Columns: `user_id uuid primary key references auth.users(id) on delete cascade` and `last_opened_at timestamptz not null default now()`.
  - RLS is enabled in the creating migration. Revoke all from `anon, authenticated`; grant `select` to `authenticated`, with one `TO authenticated` SELECT policy on `user_id = (select auth.uid())`.
  - The table has no client write path. Writes go only through the RPC below.
  - The migration seeds one row at `now()` for every existing `auth.users` row, so the first push after the deploy counts no old notes. An account with no row counts every note it has received.
- `public.mark_love_notes_read() returns timestamptz`:
  - `security definer`, `set search_path = ''`. It raises `Authentication required` when `auth.uid()` is null.
  - It upserts the caller's row with `last_opened_at = now()` and returns that value.
  - Revoke execute from `public, anon`; grant it to `authenticated`.
- `public.unread_love_note_count(p_user_id uuid) returns integer`:
  - Counts `love_notes` where `to_user_id = p_user_id`, `from_user_id <> p_user_id`, and `created_at` is later than that user's `last_opened_at` (every note when the user has no row). `created_at` is the server's delivery time.
  - Execute is revoked from `public, anon, authenticated` (all three explicitly, because the hosted default ACL grants each one separately) and granted to `service_role` only.
- The sender:
  - It reads the count for the recipient after the switch check, in the same `Promise.all` as `getDisplayName` and `listDevices`.
  - Every built payload carries `aps.badge` = the count, `0` included (0 clears the badge).
  - A failed count read throws and answers 500, like every other failed read.
  - A love-note push counts the note it announces, so it is at least 1.
- Thread ids are unchanged: `love-notes` for `love_note` and `partner-activity` for every other kind. Story 4.6 puts reminders on `PARTNER_ACTIVITY_THREAD_ID`.
- In the web code, marking read never throws and shows nothing. Failures are only `console.error`.
  - Offline, it clears the badge, sends no request, and marks again on `online` while Love Notes is mounted.
  - The badge is cleared only when `Capacitor.isNativePlatform()` and `isPluginAvailable('AppBadge')` are both true. The RPC runs on every surface (the website, the Home Screen web app and every shell), so the website and the web app write the marker too (R5, R11).
- "Love Notes on screen" means `LoveNotes` is mounted (`currentView === 'notes'`) and `document.visibilityState === 'visible'`. While it is on screen, Love Notes marks read:
  - once on mount;
  - on `visibilitychange` to visible;
  - when the newest note whose `from_user_id` is not the signed-in user changes id;
  - on every foreground push the shell reports (`pushNotificationReceived`).
- `capacitor.config.ts` gets `plugins.PushNotifications.presentationOptions: ['badge']`. In front, a push shows no banner, plays no sound, and sets the badge.

**Never:**
- Change the alert text, the thread ids, the triggers, the dedupe, or the switch logic.
- Add tap routing (story 9), dock badges (DW-327), or anything to `signedOutState()`, `registerLocalCopy` or localStorage. The marker is server state, and its row goes with the account through the cascade.
- Remove delivered notifications from Notification Center when Love Notes opens.
- Deploy anything, or touch hosted Supabase, APNs or `deploy.yml`.
- Uninstall the owner's phone shell, leave a test build in `dist/`, or leave serve, update or driver processes running.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Two unread notes | Marker before both notes | Payloads carry `badge` 1, then 2 | -- |
| Opened, then a note | Marker written after the earlier notes | Next note's `badge` is 1 | -- |
| Mood push | 2 unread notes | Mood payload `badge` 2, `thread-id` `partner-activity` | -- |
| No unread | Marker newer than every note | Non-note push `badge` 0 | -- |
| Own notes | The recipient sent notes | Not counted | -- |
| No marker row | Account created after the migration | Counts every note received | -- |
| Count read fails | `countUnreadNotes` throws | 500, nothing claimed | Trigger swallows it |
| RPC signed out | `auth.uid()` null | Raises | Logged by the client |
| Offline open | `isOnline()` false | Badge cleared, no request; marks on `online` | -- |
| Older shell / web | No `AppBadge` plugin | RPC only, no badge call, nothing visible | -- |
| Foreground push on Love Notes | `pushNotificationReceived`, view mounted and visible | Marker written, badge cleared | -- |
| Foreground push elsewhere | Another view | No banner, badge set by the payload | -- |
| Cross-account | User reads another user's marker | 0 rows (RLS) | -- |

</intent-contract>

## Code Map

- `supabase/migrations/20261101000000_love_notes_read_markers.sql` (new) -- the table, RLS, the grant and the policy, the seed `insert … select id, now() from auth.users on conflict do nothing`, both functions with their grants, and comments. Copy the header style and the RPC shape from `20261031000000_push_devices.sql` (`register_push_device`, about lines 91–122) and the table block from `20261031050000_push_preferences.sql`.
- `supabase/tests/database/37_love_notes_read_markers.sql` (new) -- covers:
  - RLS on, `policies_are`, and the select grant only;
  - the owner reads their own row, and another user reads 0 rows;
  - `mark_love_notes_read()` as authenticated sets the row, and refuses anon;
  - `unread_love_note_count` counts only notes to the user, from others, and newer than the marker (and all notes with no row), and is not executable by `authenticated` or `anon`.
  - Declare the helpers inline (`00_helpers.sql` rolls back).
- `supabase/tests/database/18_function_execute_grants.sql` -- add `mark_love_notes_read` to the FN-GRANT-008 list (line ~114, alphabetical) and a FN-GRANT-015 `ok` for it. Run the file to see whether another list (anon, or SECURITY DEFINER) also needs an entry.
- `supabase/functions/send-push/payload.ts` -- `ApnsPayload.aps` gains an optional `badge?: number`. Add `withBadge(payload, count): ApnsPayload`, which returns a copy with `aps.badge`, and leave the builders as they are. Update the header (drop "no `badge` … story 3.8", and name the badge and the two thread ids, with reminders using `PARTNER_ACTIVITY_THREAD_ID`).
- `supabase/functions/send-push/handler.ts` -- `PushDb.countUnreadNotes(userId): Promise<number>`. In `handleSendPush`, `Promise.all([getDisplayName, listDevices, countUnreadNotes(recipientId)])`, then `payload = withBadge(source.buildPayload(senderName), count)`. Add a header-doc section "The badge".
- `supabase/functions/send-push/index.ts` -- `countUnreadNotes` calls `admin.rpc('unread_love_note_count', { p_user_id })`; an error throws, and the result is a number.
- `supabase/functions/send-push/{handler,payload}.test.ts` -- `fakeDb` (line ~66) gains `unreadCount?: number | Error` and records its lookups. New cases:
  - every kind's recorded payload carries `badge` = the count, `0` included;
  - the count is looked up for the recipient, never the sender;
  - a throwing count answers 500 and claims nothing;
  - a payload test asserts each builder's `thread-id`: `love-notes` for notes, `partner-activity` for all six others;
  - `withBadge` does not mutate its input.
- `src/services/loveNotesReadService.ts` (new) -- `markLoveNotesRead(): Promise<void>`. It clears the badge first (through `clearAppBadge`), then, if `isOnline()`, calls `supabase.rpc('mark_love_notes_read')`. It never throws.
- `src/services/pushNotifications.ts`:
  - Export `clearAppBadge()` (the `AppBadge` block from `stopDevicePushes`, reused there).
  - Add `onForegroundPush(handler): () => void`, a module-level handler set.
  - In `listenOnce`, add a `pushNotificationReceived` listener that calls every handler.
  - Update the header's "Not here yet".
- `src/hooks/useLoveNotesReadMarker.ts` (new) -- `useLoveNotesReadMarker(notes: LoveNote[], userId: string)`, implementing the "on screen" rule in Always. Use a ref so the same newest partner-note id never marks twice. Clean up every listener on unmount.
- `src/components/love-notes/LoveNotes.tsx` -- call the hook with `notes` and `currentUserId` from `useLoveNotes`. Nothing rendered changes.
- `capacitor.config.ts` -- add `PushNotifications: { presentationOptions: ['badge'] }`, with a comment citing R8. The plugin's `PushNotificationsHandler.willPresent` (node_modules/@capacitor/push-notifications 8.1.3) returns `[]` when the option is unset, which is why no badge shows in front today.
- `src/types/database.types.ts` -- hand-add only the new table and the two function blocks in the file's format (DW-357, as in story 3.7).
- Unit tests:
  - `src/hooks/__tests__/useLoveNotesReadMarker.test.ts`: mount, visibility, a new partner note, own notes, a duplicate id, a hidden document, foreground push, offline then `online`, and cleanup;
  - `src/services/__tests__/loveNotesReadService.test.ts`;
  - `clearAppBadge` and `onForegroundPush` cases in `src/services/__tests__/pushNotifications.test.ts`.
  - If the existing `LoveNotes` tests break on the new RPC, mock the service in `src/components/love-notes/__tests__/loveNotesTestKit.ts`.
- `tests/api/push-love-note-trigger.spec.ts` -- add a describe "Badge" using the worker's pair (pattern: story 3.7's "Push switches" describe):
  - set the partner's marker to now through the partner's client `rpc('mark_love_notes_read')`;
  - two notes from the user record `aps.badge` 1, then 2;
  - a mood from the user records `badge` 2 and `thread-id` `partner-activity`;
  - after the partner calls the RPC again, the next note records `badge` 1;
  - `cleanup.defer` deletes the notes, the mood, the devices and the partner's marker row.
- `tests/e2e/notes/love-notes-read-marker.spec.ts` (new) -- signed in as the worker's user, with the pair from `resolveOwnPair` (`tests/support/helpers/events`):
  - the partner inserts a note through the admin client (`createSupabaseAdminClient`);
  - the user opens Love Notes;
  - `recurseUntil` reads the user's `love_notes_read_markers.last_opened_at` later than that note's `created_at`;
  - the partner inserts a second note, and `admin.rpc('unread_love_note_count', { p_user_id })` returns 1, the count the sender puts in `aps.badge`;
  - teardown deletes only this test's notes and the user's marker row.
- `scripts/sim-driver/{sim,RunnerUITests/Notify.swift}` -- `banner` always puts Settings in front first (`Notify.swift` `banner`, about line 104), so it cannot check a push to the shell in front. Add `sim banner FILE --front`:
  - it activates the app and waits for `runningForeground` instead of activating Settings;
  - it then watches and pushes as now, and prints `banner: …` or ends in `no banner` (exit 1), which is what this check expects;
  - `--front` and `--tap` are mutually exclusive (exit 2).
  - Update `sim help` and the driver clause in AGENTS.md ("Maintained by hand", the simulator paragraph) to match.
- `tests/e2e/notes/*.spec.ts`, `tests/e2e/offline/love-notes-*.spec.ts` -- run them; a spec that fails on the new RPC request (route stubs, network-error monitor) is fixed in the same change.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261101000000_love_notes_read_markers.sql` + `37_love_notes_read_markers.sql` + `18_function_execute_grants.sql` -- marker, RPC, count, pgTAP -- server state
- [x] `supabase/functions/send-push/{payload,handler,index}.ts` + tests -- badge on every payload, thread ids pinned -- sender
- [x] `src/services/{loveNotesReadService,pushNotifications}.ts`, `src/hooks/useLoveNotesReadMarker.ts`, `LoveNotes.tsx` + unit tests -- mark read from every surface -- client
- [x] `capacitor.config.ts` -- badge-only foreground presentation -- R8
- [x] `src/types/database.types.ts` -- the new blocks only
- [x] `tests/api/push-love-note-trigger.spec.ts` and `tests/e2e/notes/love-notes-read-marker.spec.ts` -- wire proofs
- [x] `scripts/sim-driver/{sim,RunnerUITests/Notify.swift}` + `AGENTS.md` driver clause -- `banner --front` -- the foreground check
- [x] Simulator: run the recipe in Design Notes, and record the commands, exit codes and observed states in Implementation Notes.

**Acceptance Criteria:**
- Given `deno test`, then every kind's payload carries the recipient's unread count as `badge`, notes carry `thread-id` `love-notes`, and every other kind carries `partner-activity`.
- Given the unit tests, then marking read covers mount, return to front, a partner note on screen, a foreground push on screen, offline, and no badge call without `AppBadge`.
- Given the api spec, when the user sends two notes, then the recorded badges are 1 and 2. A mood carries 2. After the partner marks read, the next note carries 1.
- Given the E2E spec, when the user opens Love Notes on the website, then the marker is written, and the count for the next partner note is 1.
- Given the Duo simulator through the driver, signed in as Casey:
  - a recorded love note and a recorded mood show as two `sim center` groups;
  - two recorded notes read `sim badge` 2, opening Love Notes clears it, and the next note reads 1;
  - a note pushed while Love Notes is in front leaves the badge clear;
  - a mood pushed while the shell is in front on Home shows no banner and raises the badge.

## Implementation Notes

Built 2026-11-01. Migration `20261101000000_love_notes_read_markers.sql`: `love_notes_read_markers` (RLS on, `revoke all` then `grant select` to `authenticated`, one owner SELECT policy, seeded at `now()` for every existing `auth.users` row), `mark_love_notes_read()` (security definer, raises `Authentication required` on a null `auth.uid()`, execute to `authenticated`) and `unread_love_note_count(uuid)` (execute revoked from `public`, `anon`, `authenticated`; granted to `service_role`). The count function is a plain `stable` SQL function, not security definer: the service role bypasses RLS, so it needs no extra rights. pgTAP `37_love_notes_read_markers.sql` (26 tests) and FN-GRANT-008/015 in `18_function_execute_grants.sql` (the FN-GRANT-008 list gained `mark_love_notes_read`; no anon or SECURITY DEFINER list needed an entry).

Sender: `withBadge` in `payload.ts` (builders unchanged), `PushDb.countUnreadNotes` read in the same `Promise.all` as the name and devices, `index.ts` through `rpc('unread_love_note_count')`. Client: `loveNotesReadService.markLoveNotesRead`, `pushNotifications.clearAppBadge` and `onForegroundPush` (a `pushNotificationReceived` listener), `useLoveNotesReadMarker` called from `LoveNotes`, `capacitor.config.ts` `presentationOptions: ['badge']`, hand-added blocks in `database.types.ts` (DW-357 drift untouched). The three `LoveNotes` component tests that render it mock the hook.

Sim driver: `sim banner FILE --front` (`Notify.swift` `banner(front:)`); `--front` with `--tap` exits 2. `sim help` and the AGENTS.md driver clause updated.

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 91 passed; `deno check` clean; `supabase migration up --local`, then `supabase test db` PASS (24 files, 37 new); `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 17 passed (`supabase functions serve` running, stopped afterwards; the earlier describes' exact-payload asserts now expect `badge: expect.any(Number)`); `tests/e2e/notes/love-notes-read-marker.spec.ts` 1 passed; `npx playwright test tests/e2e/notes/ tests/e2e/offline/love-notes-offline-copy.spec.ts tests/e2e/offline/love-notes-offline-send.spec.ts` 22 passed; `npm run test:unit` 215 files, 3395 passed; `npm run lint` and `npm run typecheck` exit 0.

Simulator (iPhone Duo, local stack, `supabase functions serve` with no APNs env; payloads from `push_requests.payload` read with psql in the db container), through `scripts/sim-driver/sim`: `provision`, `build`, `signin` exit 0. Step 2: a note and a mood from Jessie pushed with the app in the background; `sim center` printed two groups (`Jessie, Logged a mood: Happy` and `Jessie, 3.8 sim note A`, one notification each). Step 3: Love Notes opened and left (the marker moved, `sim badge` none), two notes pushed with payload badges 1 and 2; `sim badge` read `2 new items`. Step 4: `sim launch`, tap Love Notes, `sim background`: `sim badge` none; the next note's payload (badge 1) made it `1 new item`. Step 5: Love Notes in front, note pushed with `sim banner FILE --front`: ended `no banner`, exit 1, and `sim badge` read none. Step 6: Home in front, a note left unread, then a mood pushed with `--front`: `no banner`, exit 1, and `sim badge` read `1 new item`, the payload's count. Step 7: `functions serve` stopped, the fixture's `3.8 sim note*` notes, the two moods and Casey's marker row deleted, no `xcodebuild` or `http.server` process left, `dist/` absent.

Observation outside the plan: a push sent right after `sim signin` and `sim background` reached the shell while it was still in front (badge `1 new item`, empty Notification Center); that is the foreground presentation working, and `sim center` was empty until the app really was in the background.

Step 5 re-run with a delivery signal (2026-11-01, review follow-up; same installed shell, `functions serve` running, Casey in front on Love Notes after `sim launch` and `sim tap 359 871`; times are the db container's clock, UTC). The note was inserted from Jessie by psql (`send.sh`, which sends no Broadcast), and its recorded payload (`badge` 1, `thread-id` `love-notes`) pushed with `sim banner FILE --front`, its output timestamped line by line:
- `sim badge` before: `none`. Casey's `love_notes_read_markers.last_opened_at` before: `05:13:22.967693`.
- `sim banner FILE --front` printed `Notification sent to 'dev.sallvain.mylove'` at `05:14:48.891` (the push), then `watching` and `failed - no banner`; exit 1.
- `last_opened_at` after: `05:14:48.984261`, 93 ms after the push and 85 s after its previous value. Nothing else touched Love Notes in between, so the foreground-push handler wrote it. `unread_love_note_count` 0, `sim badge` after: `none`.
- A first run of the same step (marker `05:12:55.208294` before, `05:13:22.967693` after, `no banner`, exit 1, `sim badge` none) did not timestamp the push line, so the second run is the evidence.
Cleanup as in step 7: `functions serve` stopped, the `3.8 sim note*` rows and Casey's marker row deleted, no `xcodebuild`, `http.server` or serve process, no `dist/`, no `deno.lock`.

## Plan Change Log

- Design Notes said a clear issued from `pushNotificationReceived` lands after iOS applies the foreground badge. On the Duo simulator it did not: the marker was written and `clear()` ran, yet `sim badge` still read the payload's `1 new item`, because the plugin returns the presentation options right after notifying the web view and iOS sets the badge after the first clear. `useLoveNotesReadMarker` therefore clears the badge a second time `FOREGROUND_BADGE_RECLEAR_MS` (1 s) after a foreground push while Love Notes is still on screen. With it, step 5 ended with the badge clear on both runs; hook tests cover the timer, a hidden document and unmount.

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 2, false 0, maybe-false 1
- findings:
  - `[low]` `[patch]` `handler.ts` "The badge" doc said a love note's push is always at least 1. That is false: the recipient's open Love Notes can get the note over Broadcast and mark it read before pg_net reaches the sender, so the badge is 0 (correct behaviour). Patched: the doc now names that case. Comment only.
  - `[low]` `[patch]` `ios/App/App/AppBadge.swift:11` still said "Story 3.8 adds `set`", but no `set` was built. Patched: the line now says Love Notes clears the badge when it marks notes read, and that the count arrives in `aps.badge`. Comment only.
  - `[medium]` `[patch]` The step 5 simulator evidence (`no banner` and `sim badge` none) could not tell a delivered-then-cleared push from one never delivered. Patched by re-running step 5 with a delivery signal: the note was inserted by psql, so no Broadcast was sent, and the payload (`badge` 1) was pushed `--front` at 05:14:48.891. Casey's `last_opened_at` moved from 05:13:22.967693 to 05:14:48.984261, and only the foreground-push handler writes it then. `sim badge` read none and the count was 0. Recorded in Implementation Notes.
  - `[maybe-false]` `[defer]` The 1 s second clear (`FOREGROUND_BADGE_RECLEAR_MS`) is a timing assumption measured only on the simulator, so a slower real device could keep the payload's badge. Settling it needs a check on the owner's iPhone in story 3.11. If true, it is medium. Deferred in frontmatter and in the ledger as DW-361.

## Design Notes

- **Why the server clock and a SQL count:** the badge is computed when the sender runs, from rows on the server, so the marker must use the same clock as `love_notes.created_at`. One SQL function is the single definition, used by the sender and read directly by the E2E spec. The E2E project has no edge runtime, so it cannot call the sender.
- **Why a foreground push clears from JS:** the plugin's `willPresent` returns the options, with the badge, before the `pushNotificationReceived` event reaches the web view. So a clear issued from that event lands after iOS applies the badge. A note that arrives over Realtime on Love Notes also writes the marker, so the next push's count stays right.

**Simulator recipe** (local stack, `supabase functions serve` with no APNs env; payloads come from `push_requests.payload`, read with psql as the superuser and written to a scratch file, as stories 3.4–3.7 did):
1. Run `sim provision`, `sim build`, then `sim signin` (Casey). Leave the shell on Home.
2. Insert a note and a mood from Jessie, then `sim push` each recorded payload with the app in the background. Expect `sim center` to show two groups.
3. Open Love Notes once to set the marker, then go back to Home. Insert two notes from Jessie and push both payloads. Expect `sim badge` to read 2 (it is 2 in both payloads).
4. Run `sim launch` and tap Love Notes. Background the app; `sim badge` reads none. Push the next note's payload: the badge reads 1.
5. Open Love Notes and keep it in front. Insert a note from Jessie and run `sim banner FILE --front` with its payload. It ends in `no banner`; then `sim badge` reads none.
6. Tap Home (the shell stays in front). Insert a mood from Jessie. With an unread note first, so the count is at least 1, run `sim banner FILE --front` with the mood's payload. It ends in `no banner`, and `sim badge` reads the payload's count.
7. Clean up: stop `functions serve` and any serve process, delete the fixture's test notes, moods and marker rows, and confirm no `xcodebuild` or `http.server` process remains and `dist/` is absent.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` and `deno check supabase/functions/send-push/index.ts` -- expected: pass
- `supabase migration up --local`, then `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` (with `supabase functions serve` running) -- expected: pass
- `npx playwright test tests/e2e/notes/ tests/e2e/offline/love-notes-offline-copy.spec.ts tests/e2e/offline/love-notes-offline-send.spec.ts` -- expected: pass
- `npm run test:unit`, `npm run lint` and `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** Every push now carries the recipient's unread love-note count as `aps.badge`, and Love Notes resets it on every surface.
- **Data:** `love_notes_read_markers` holds one row per account with the time it last opened Love Notes, on the server clock. It has RLS, and the owner can only read it. The migration seeds a row for every existing account.
- **Server functions:** `mark_love_notes_read()` is the only way to write the marker, and `authenticated` can execute it. `unread_love_note_count(uuid)` is the single definition of the badge: partner notes newer than the marker. Only the service role can execute it.
- **Sender:** `send-push` reads the count with the name and devices, and `withBadge` adds it to every payload, `0` included. A failed count answers 500. The thread ids are unchanged and now pinned by a test: `love-notes` for notes, `partner-activity` for every other kind.
- **Web code:** `useLoveNotesReadMarker`, called from `LoveNotes`, writes the marker and clears the badge in the background while Love Notes is on screen:
  - when it opens, when it comes back to the front, and when a partner note arrives;
  - when the connection returns after an open made offline;
  - on a foreground push, with a second badge clear 1 s later.
  - On the website, the Home Screen web app and older shells it writes the marker only, with nothing visible.
- **Shell:** `capacitor.config.ts` sets `presentationOptions: ['badge']`, so with the app in front a push shows no banner and still sets the badge.
- **Simulator driver:** `sim banner FILE --front` checks a push to the shell while it is in front.

**Files changed:**
- `supabase/migrations/20261101000000_love_notes_read_markers.sql`: the table, RLS, the seed, `mark_love_notes_read` and `unread_love_note_count`.
- `supabase/tests/database/37_love_notes_read_markers.sql`: new pgTAP, 26 tests. `18_function_execute_grants.sql`: the FN-GRANT-008 list and FN-GRANT-015.
- `supabase/functions/send-push/{payload,handler,index}.ts`, plus `{payload,handler}.test.ts`: `withBadge`, `countUnreadNotes`, the badge doc and the thread-id pins.
- `src/services/loveNotesReadService.ts`: `markLoveNotesRead`.
- `src/services/pushNotifications.ts`: `clearAppBadge`, `onForegroundPush` and the `pushNotificationReceived` listener.
- `src/hooks/useLoveNotesReadMarker.ts`: the rule for when Love Notes counts as on screen. `src/components/love-notes/LoveNotes.tsx` calls it.
- `capacitor.config.ts`: badge-only foreground presentation.
- `ios/App/App/AppBadge.swift`: the stale doc line is corrected.
- `src/types/database.types.ts`: the new table and the two function blocks only.
- Unit tests: the hook, the service, the `pushNotifications` cases, and the hook mock in three `LoveNotes` component tests.
- `tests/api/push-love-note-trigger.spec.ts`: a new "Badge" describe. The earlier exact-payload checks now expect any number as the badge.
- `tests/e2e/notes/love-notes-read-marker.spec.ts`: the website writes the marker, and the next count is 1.
- `scripts/sim-driver/{sim,RunnerUITests/Notify.swift}` and the driver clause in `AGENTS.md`: `banner --front`.
- `_bmad-output/initiative-my-love/deferred-work.md`: DW-361.

**Review findings:** 4 from the Quick lens.
- Patched 3: 1 medium (the step 5 evidence, re-run with a delivery signal) and 2 low (the handler's badge doc, and the stale `AppBadge.swift` line).
- Deferred 1: maybe-false, medium if true. The 1 s second clear is unverified on a device (DW-361).
- Rejected: none.

**Follow-up review recommended:** false. No high was patched, and only one medium.

**Verification, after the patches:**
- `deno test --no-lock supabase/functions/send-push/`: 91 passed. `deno check --no-lock`: clean.
- `supabase test db`: PASS, 24 files.
- The api spec: 17 passed, with `supabase functions serve` running; it was stopped afterwards.
- `tests/e2e/notes/` and the two love-notes offline specs: 22 passed.
- `npm run test:unit`: 215 files, 3395 tests passed.
- `npm run lint` and `npm run typecheck`: exit 0.
- Simulator (iPhone Duo, local stack, recipe steps 2–7; see Implementation Notes):
  - a note and a mood showed as two Notification Center groups;
  - two notes read badge 2, opening Love Notes cleared it, and the next note read 1;
  - a note pushed with Love Notes in front was handled (the marker moved 93 ms after the push), and the badge read none;
  - a mood pushed with the shell in front on Home showed no banner, and the badge read the payload's count.
- No `dist/`, `deno.lock`, serve, `xcodebuild` or `http.server` process is left.

**Residual risks:**
- The 1 s second clear is UNVERIFIED on a real iPhone (DW-361; story 3.11 checks it).
- `presentationOptions` is a native change, so a shell built before this story still shows nothing in front and sets no foreground badge until it is reinstalled. Pushes delivered in the background carry the badge either way.
- Until `send-push` is redeployed, the hosted sender sends no badge. The marker migration is harmless before that.
- An account created after the migration has no marker row, so it counts every note it has received until it first opens Love Notes.
- Real APNs delivery and the hosted project are untested for the badge.
