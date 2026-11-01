---
title: 'Each push type has a Settings switch'
type: 'feature'
ticket: '7'
created: '2026-10-31'
status: done
baseline_revision: 'e9f2708962113eb7c5fea9ba4ed3eb60eb2e33f9'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-partner-requests-push-plan.md']
warnings: ['oversized']
deferred:
  - summary: >-
      src/types/database.types.ts is not the raw output of AGENTS.md's regeneration command; this story copied only the push_preferences block, in the file's format, from CLI output whose layout is malformed.
    evidence: |-
      supabase gen types typescript --local (CLI 2.122.0) emits the same push_preferences fields but with ComputedFields lines and inline quoted keys; pre-existing drift already in the ledger as DW-357.
    location: >-
      src/types/database.types.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** A person cannot stop one kind of push without turning off all notifications in iOS (R3). Someone who declined notification permission gets no hint why nothing arrives (R9). The website, the Home Screen web app and older shells must show no switches (R11).

**Approach:** Add a new RLS-protected table, `push_preferences`, with one boolean per type. It holds one row per account, and a missing row means every type is on. The sender reads the receiver's switch for the kind and, when it is off, builds nothing for any of their devices. Settings in the shell gets a "Push and reminders" section with six rows. Each row is a general switch row extracted from `MobileDataPhotosRow`, which renders through it unchanged. When iOS reports the permission denied, the section opens with a notice.

## Boundaries & Constraints

**Always:**
- Each kind maps to one switch:
  - `love_note` → `love_notes`
  - `mood` → `moods`
  - `photo` → `photos`
  - `interaction` → `pokes_and_kisses`
  - `date` → `dates`
  - `partner_request` and `partner_accept` → `partner_requests`
- Every column is `boolean not null default true`, and a missing row reads as all on, both in the sender and in the client. The table is named so that story 4.3 can add a reminders column to it later.
- The sender checks the switch after the existing "nobody to tell" return and before `listDevices`. A switch that is off answers 200 with every count at 0, claims nothing and lists no devices. A failed preference read throws, so the sender answers 500 as it does for any other failed read.
- RLS is enabled in the creating migration. `anon` gets no privileges. `authenticated` gets SELECT, INSERT and UPDATE only, through `TO authenticated` policies on `user_id = (select auth.uid())`, and the UPDATE policy states `WITH CHECK` explicitly. There is no DELETE privilege. `user_id` references `auth.users(id) on delete cascade`.
- A client write changes one column. It is an upsert on `user_id` that sends only `user_id` and that column, so concurrent writes to two switches never overwrite each other. A write is made only online and goes to the server first: the component checks `isOnline()` and shows `offlineMessage('Push settings')`, and the store action calls `requireOnline('Push settings')`. Each write captures `{ userId, authSessionVersion }` and re-checks both before calling `set()`.
- The store fields `pushPreferences` and `pushPreferencesLoadFailed` go into `signedOutState()` in the same commit.
- The section renders only when `Capacitor.isNativePlatform()` is true and both the `PushNotifications` and `PushEnvironment` plugins are available (the existing `hasNativePush()`, exported). It sits between Photos and About.
- The section opens with a permission notice when `PushNotifications.checkPermissions()` answers `denied`. The notice reads exactly `Notifications are off for My Love. Turn them on in iOS Settings.` It appears above the rows, which stay usable. The check runs again on `visibilitychange` to visible.
- The "Pushes" group lists these rows in this order:

  | Label | Helper |
  |---|---|
  | Love notes | `When your partner sends a note.` |
  | Moods | `When your partner logs a mood.` |
  | Photos | `When your partner adds a photo.` |
  | Pokes and kisses | `When your partner sends a poke or a kiss.` |
  | Dates | `When your partner adds or changes a date.` |
  | Partner requests | `When someone asks to be your partner, or accepts your request.` |

  Labels are in sentence case and never start with "Notify me".
- `MobileDataPhotosRow` keeps every behaviour, text, `id`, `aria-*` attribute and test id. `Settings.mobileDataPhotos.test.tsx` passes byte-for-byte unchanged.

**Never:**
- Change the payloads, the triggers, `notify_push`, the dedupe, or the paths for the other kinds, except for the switch check.
- Add a reminders switch, a marks list, badges, tap routing or foreground handling. Those belong to stories 4.2, 4.3, 8 and 9.
- Add a `registerLocalCopy` kind or a persisted field. Load the switches from the section.
- Deploy anything, or touch hosted Supabase, APNs or `deploy.yml`.
- Uninstall the owner's phone shell, leave a test build in `dist/`, or leave serve, update or driver processes running.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | No preferences row; partner sends a note | One recorded request per receiver device, as today | -- |
| Switched off | Receiver `love_notes = false`; note sent | 200, counts all 0, no `push_requests` row on any of their devices, `listDevices` not called | -- |
| Switched back on | `love_notes = true`; a new note | Recorded on every receiver device | -- |
| Other type off | `moods = false`; note sent | The note pushes | -- |
| Both partner kinds | `partner_requests = false` | Neither `partner_request` nor `partner_accept` pushes | -- |
| Read fails | `isPushEnabled` throws | 500, nothing claimed | Trigger swallows it |
| Web / web app / old shell | Not native, or no push plugins | No section, nothing fetched | -- |
| Permission denied | `checkPermissions` → `denied` | Notice above the rows; rows work | -- |
| Offline toggle | `isOnline()` false | `offlineMessage('Push settings')`, nothing changes | No request sent |
| Load fails | Fetch throws | Rows disabled, `Couldn't load your push settings.` | Logged |
| Save fails | Upsert errors | Row keeps its old state, error line shown | -- |
| Cross-account | A user writes another user's row | Refused by RLS | -- |

</intent-contract>

## Code Map

- `supabase/migrations/20261031050000_push_preferences.sql` (new). Copy the header and grant style of `20261031000000_push_devices.sql`. Its contents:
  - the table, with columns `user_id` (pk), the six booleans and `updated_at`;
  - `enable row level security`, `revoke all … from anon, authenticated`, and `grant select, insert, update … to authenticated`;
  - three owner policies;
  - a COMMENT naming the sender and pgTAP file `36`.
- `supabase/functions/send-push/handler.ts`:
  - export `PushPreference` (the six column names) and `PREFERENCE_FOR_KIND: Record<PushKind, PushPreference>`;
  - add `PushDb.isPushEnabled(userId, preference): Promise<boolean>`;
  - in `handleSendPush`, check the switch after the "Nobody to tell" return and before the `Promise.all([getDisplayName, listDevices])`;
  - update the header doc.
- `supabase/functions/send-push/index.ts` -- `isPushEnabled` does `admin.from('push_preferences').select(preference).eq('user_id', …).maybeSingle()`. No row means `true`, and an error throws.
- `supabase/functions/send-push/handler.test.ts` -- add `preferences?: Partial<Record<PushPreference, boolean>>` to `fakeDb` (line 64), along with a record of the lookups made. Add the cases:
  - every kind, with its switch off, yields zeros and no claims or `listDevices` call;
  - another switch being off does not stop the kind;
  - the default is on;
  - the switch is looked up for the recipient and never the sender;
  - a throwing read answers 500.
- `src/services/pushNotifications.ts`:
  - export `hasNativePush()`;
  - add `getPushPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'>`, which never throws;
  - remove "Settings switches" from the header's "Not here yet".
- `src/services/pushPreferencesService.ts` (new):
  - `PushPreferences` is the camelCase type `{loveNotes, moods, photos, pokesAndKisses, dates, partnerRequests}`;
  - `fetchPushPreferences(userId)` throws on error and turns a missing row into all true;
  - `savePushPreference(userId, key, enabled)` upserts one column with `onConflict: 'user_id'` and `.select().single()`, and returns the mapped row.
- `src/stores/slices/settingsSlice.ts`:
  - state `pushPreferences: PushPreferences | null` and `pushPreferencesLoadFailed: boolean`;
  - `loadPushPreferences()` never throws and does nothing offline;
  - `setPushPreference(key, enabled)` throws.
  - Pattern: `loadOwnProfile` and `setBirthday` (lines 799–855), including `serializeAccountDataWrite` and the session re-check.
- `src/stores/slices/authSlice.ts` `signedOutState()` -- add `pushPreferences: null` and `pushPreferencesLoadFailed: false` under the settingsSlice comment.
- `src/components/Settings/SwitchRow.tsx` (new) -- the general row: `{ id, icon, label, helper, checked, onChange, disabled? }`. It derives `${id}-label`, `${id}-helper`, `data-testid={id}` and `data-testid={`${id}-helper`}`. Move `MobileDataPhotosRow`'s markup and the `ROW_BUTTON` class there verbatim. `ROW_BUTTON` stays exported for Settings' other buttons, or is duplicated there.
- `src/components/Settings/PushSettings.tsx` (new):
  - a `<section aria-labelledby="settings-push-label" data-testid="settings-push">` with the h2 `Push and reminders` (`SECTION_LABEL`), the notice (`data-testid="settings-push-permission-off"`), and a `CARD` holding an h3 `Pushes` (`GROUP_TITLE`, as in `EventsSettings.tsx:482`) and the six rows `settings-push-<kebab key>` with `DIVIDER`s between them;
  - error lines `settings-push-error` (`role="alert"`) and `settings-push-load-error`;
  - it returns `null` when `!hasNativePush()`;
  - lucide icons: pick existing ones from the installed version (for example `MessageCircleHeart`, `Smile`, `Image`, `Hand`, `CalendarHeart`, `UserPlus`) and confirm each one's export.
- `src/components/Settings/Settings.tsx` -- `MobileDataPhotosRow` renders `<SwitchRow id="settings-mobile-data-photos" …/>`, and `<PushSettings />` goes between the Photos and About sections. Update the header doc.
- Tests:
  - `src/components/Settings/__tests__/SwitchRow.test.tsx` and `PushSettings.test.tsx` (new). Mock `@capacitor/core` and `@capacitor/push-notifications` as `src/services/__tests__/pushNotifications.test.ts` does, and mock the service.
  - The store tests go beside the existing settingsSlice tests (search `tests/unit/stores/`). Check the sign-out reset in the existing sign-out-clears-state test.
- `tests/api/push-love-note-trigger.spec.ts` -- add a fifth `describe` "Push switches" and a header line for story 3.7. It uses the worker's pair:
  - the partner registers two devices, then upserts its own row with `love_notes = false`;
  - the user's note records 0 rows after 3 s, and a direct post answers all zeros;
  - after `love_notes = true`, a new note records 2 rows;
  - the user's client cannot read or update the partner's row (0 rows updated, and an insert for the partner is refused);
  - `cleanup.defer` deletes the partner's `push_preferences` row, the devices and the notes.
- `supabase/tests/database/36_push_preferences.sql` (new) -- covers RLS on, `policies_are`, the defaults, owner insert, select and update of their own row, refusals across accounts, no anon access and no DELETE. Declare helpers inline.
- `tests/e2e/settings/push-switches-web.spec.ts` (new) -- `openSettingsFromHome` (`tests/support/helpers/settings-screen`). Assert that `settings-push` and the heading `Push and reminders` have count 0 while the Photos heading is visible.
- `src/types/database.types.ts` -- regenerate, then take only the `push_preferences` block (DW-357 covers the rest of the drift, as in story 3.6).
- `scripts/sim-driver/*` -- change only what the simulator checks need, for example a way for `signin` to decline the alert if XCUITest's default interruption handling taps Allow. Update `sim help` and the driver clause in AGENTS.md to match.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261031050000_push_preferences.sql` + `36_push_preferences.sql` -- table, RLS, policies, pgTAP -- account storage
- [x] `supabase/functions/send-push/{handler,index,handler.test}.ts` -- switch check per kind -- the sender honours the receiver
- [x] `src/services/{pushPreferencesService,pushNotifications}.ts` + `settingsSlice.ts` + `authSlice.ts` -- service, store state and actions, `signedOutState()` -- client data
- [x] `src/components/Settings/{SwitchRow,PushSettings,Settings}.tsx` + unit tests -- extract the row and build the section -- UI
- [x] `tests/api/push-love-note-trigger.spec.ts` -- off stops the push on every device, and on restores it -- wire proof
- [x] `tests/e2e/settings/push-switches-web.spec.ts` -- website shows no switches -- R11
- [x] `src/types/database.types.ts` -- regenerate (new table only)
- [x] Simulator: run the recipe in Design Notes, and record the commands, exit codes and observed states in Implementation Notes.

**Acceptance Criteria:**
- Given the unit tests, when run, then:
  - the general switch row and the section pass, covering the order, the labels and helpers, a toggle calling the store, offline, load and save errors, the denied notice and no section off-native;
  - `Settings.mobileDataPhotos.test.tsx` passes unchanged;
  - the sign-out reset clears `pushPreferences`.
- Given `deno test`, then each kind with its switch off builds no push for any device, and the default and the other switches leave it on.
- Given the api spec, when the partner switches love notes off, then the user's note records nothing for any of the partner's devices, and once it is switched back on the next note records on both.
- Given the Duo simulator through the driver, then:
  - each of the six switches toggles in Settings (its `aria-checked`/value flips, and the account's row changes);
  - a switch left off reads off after `sim uninstall`, `sim build` and `sim signin`;
  - after the driver taps Don't Allow, Settings shows the iOS Settings notice.
- Given the E2E spec, then the website's Settings has no push section.
- Given the shell built at `284144cfa341a7b0adb3af31d5b339a6813baa0d` and updated by live update to this bundle, when Settings opens, then no push section shows and no error shows.

## Implementation Notes

Built 2026-10-31. Migration `20261031050000_push_preferences.sql`: `push_preferences` (`user_id` pk to `auth.users` on delete cascade, six `boolean not null default true`, `updated_at`), RLS on, `revoke all` then `grant select, insert, update` to `authenticated`, three `TO authenticated` owner policies with an explicit `WITH CHECK` on UPDATE. The table's last column is `created_at` (the plan's `updated_at` renamed on review): no trigger moves a timestamp on a switch change, because the client sends only `user_id` and one column.

Sender: `PushPreference`, `PREFERENCE_FOR_KIND`, `PushDb.isPushEnabled`, checked after the "nobody to tell" return and before `getDisplayName`/`listDevices`; `index.ts` reads `push_preferences` with `maybeSingle()` (no row is on, an error throws). Client: `pushPreferencesService` (fetch and one-column upsert), `settingsSlice.loadPushPreferences` / `setPushPreference` (queued in `serializeAccountDataWrite`, session re-check before `set()`), `signedOutState()` clears both fields, `SwitchRow` extracted from `MobileDataPhotosRow` (`ROW_BUTTON` exported from it), `PushSettings` between Photos and About. `PushSettings` also reloads the switches on `online` (not in the plan), because offline at open leaves the rows disabled otherwise. `src/types/database.types.ts`: hand-added only the `push_preferences` block in the file's format (the local CLI now emits a different layout; DW-357 covers the rest of the drift).

Extra beyond the plan: `tests/unit/services/pushPreferencesService.test.ts`, `tests/unit/stores/pushPreferences.test.ts`, `hasNativePush` / `getPushPermission` cases in `pushNotifications.test.ts`. Sim driver: `sim signin [target] --decline-push` (Drive.swift `signin ... decline-push`), because the runner's own handling taps Allow on its first touch after sign-in, so `sim permission deny` found no alert; `sim help` and the AGENTS.md driver clause updated.

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 84 passed; `deno check` clean; `supabase migration up --local` then `supabase test db` 23 files, 549 tests, PASS (`36_push_preferences.sql` 26); `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 16 passed (1 new, `supabase functions serve` running, stopped afterwards); `npx playwright test tests/e2e/settings/push-switches-web.spec.ts` 1 passed; `npm run test:unit` 213 files, 3358 tests passed; `git diff --exit-code` on `Settings.mobileDataPhotos.test.tsx` clean; `npm run lint` and `npm run typecheck` exit 0.

Simulator (iPhone Duo, local stack, `supabase functions serve` with no APNs env), through `scripts/sim-driver/sim`: `provision` exit 0, `build` exit 0, `signin` exit 0. Settings showed `PUSH AND REMINDERS` between PHOTOS and ABOUT with six switches, all value 1. Each of the six was tapped off and on again (`sim tap`, then `sim dump` and a psql read of the fixture's `push_preferences` row): the dump value went 1 -> 0 -> 1 and the matching column went `f` -> `t` for Love notes, Moods, Photos, Pokes and kisses, Dates and Partner requests, one column at a time. (Switches below the fold of the folded portrait need the unfolded pose: `sim pose open`.) Love notes was left off, then `sim uninstall` exit 0, `sim build` exit 0, `sim signin` exit 0: Love notes read 0 (others 1); switched back on. `sim permission reset` exit 0, `sim signin --decline-push` exit 0 (`tapped Don't Allow`): Settings showed `Notifications are off for My Love. Turn them on in iOS Settings.` above the six switches, still value 1 and tappable. `sim build --from 284144cfa341a7b0adb3af31d5b339a6813baa0d --update-port 8791` exit 0, `sim serve-update --port 8791` exit 0, `sim signin` exit 0; a cold relaunch fetched `latest.json` and `bundle-sim-tree-1793506435.zip` (server log), `sim background` then `sim launch` swapped it in (the app's `serverBasePath` pointed at the downloaded snapshot, which contains `Push and reminders`): Settings dump had the PHOTOS section and its one switch, no `Push and reminders` text, no notice, no error. Cleanup: `sim serve-update --stop` exit 0, `sim build` (current tree) exit 0, `functions serve` killed, the fixture's `push_preferences` rows deleted (0 rows left in the table), no `xcodebuild`, `http.server`, serve or edge container running, `dist/` absent.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 5 findings — high 0, medium 1, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` `src/types/database.types.ts` block written by hand rather than regenerated. Verified: the CLI 2.122 output's `push_preferences` block has exactly the same fields, but its layout is malformed (`ComputedFields`, inline quoted keys), so it was copied in the file's format. This is the pre-existing drift already in the ledger as DW-357; there is no new ledger entry.
  - `[low]` `[patch]` A failed reload after a successful one left `pushPreferences` set, so six enabled switches showed stale values under the load error, against the slice doc and the matrix's "Load fails → rows disabled". Patched: the catch also sets `pushPreferences: null` when `isCurrent()`. Store tests cover success then failure, and a failure that lands after an account switch.
  - `[low]` `[patch]` Opening the section offline with nothing loaded showed six disabled rows and no text. Patched: `settings-push-offline` shows `offlineMessage('Push settings', 'load')` while nothing is loaded, the load has not failed and the device is offline. A component test covers it.
  - `[medium]` `[patch]` A second tap during a row's in-flight save computed `!checked` from the stale value, so a quick off-then-on left the switch off. Patched: each row is disabled while its own save is pending, tracked per key and cleared in `finally`. Component tests cover it.
  - `[low]` `[patch]` `push_preferences.updated_at` held the creation time, and its comment said a switch change does not move it. Patched: renamed to `created_at` in the migration and `database.types.ts`, and applied locally with `alter table … rename column` (no `db reset`).

## Design Notes

- **Why one row with one column per type:** the sender needs one indexed read by primary key, and a missing row is the default. Story 4.3 adds its reminders switch as one more column. Sending a single column in the upsert means two switches toggled quickly never overwrite each other, because PostgREST's merge updates only the columns it is sent.
- **Why the switch is read by the sender and not filtered in SQL:** every kind already resolves a recipient in `resolveSource`, so one check there covers all seven kinds and is unit-testable with `fakeDb`.

**Simulator recipe:**
1. Run `supabase start`, then `supabase functions serve` with no APNs env. Run `sim provision`, then `sim build`, then `sim signin`.
2. Open Settings. Use `sim dump` to find the six switches, and `sim tap` each one off and then on again. After each tap, `sim dump` shows the flipped state and `push_preferences` shows the change (query as the superuser).
3. Leave Love notes off. Run `sim uninstall`, then `sim build` and `sim signin`. Open Settings: Love notes reads off. Switch it back on.
4. Run `sim permission reset`, then sign in so the alert shows, and answer it Don't Allow (`sim permission deny`, or the signin change above). Open Settings: the notice shows.
5. Run `sim build --from 284144cfa341a7b0adb3af31d5b339a6813baa0d --update-port 8791`, then `sim serve-update --port 8791` and `sim signin`. Background the app and relaunch it until the updater swaps (as story 3.1's review pass did). Open Settings: `sim dump` shows no `Push and reminders`.
6. Clean up: run `sim serve-update --stop` and `sim build` (current tree). Stop `functions serve`. Delete the fixture account's `push_preferences` row. Confirm no `xcodebuild`, `http.server` or serve process remains.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` and `deno check supabase/functions/send-push/index.ts` -- expected: pass
- `supabase migration up --local`, then `supabase test db` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` (with `supabase functions serve` running) -- expected: pass
- `npx playwright test tests/e2e/settings/push-switches-web.spec.ts` -- expected: pass
- `npm run test:unit` -- expected: pass, with `Settings.mobileDataPhotos.test.tsx` unchanged (`git diff --exit-code` on it)
- `npm run lint` and `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** Each kind of push now has a switch on the account, and the sender honours the receiver's switch.
- **Data:** a new RLS-protected table, `push_preferences`, holds one row per account with six booleans: love notes, moods, photos, pokes and kisses, dates, and partner requests. Every column defaults to on, and a missing row also reads as all on.
- **Sender:** `send-push` reads the receiver's switch for the kind before it lists any device. When the switch is off, it answers 200 with every count 0 and builds nothing for any device. Both partner kinds share one switch.
- **Settings:** in the native shell, Settings gets a "Push and reminders" section between Photos and About. It has a "Pushes" group of six rows, each a general `SwitchRow` extracted from `MobileDataPhotosRow`, which renders through it unchanged.
  - When iOS reports the permission denied, the section opens with `Notifications are off for My Love. Turn them on in iOS Settings.`, and the rows stay usable.
  - The website, the Home Screen web app and older shells render and fetch nothing, gated by `hasNativePush()`.
- **Store:** the state lives in `settingsSlice`, and `signedOutState()` clears it.
- **Simulator driver:** `sim signin --decline-push` answers the alert Don't Allow.

**Files changed:**
- `supabase/migrations/20261031050000_push_preferences.sql`: the table, RLS, grants and three owner policies.
- `supabase/tests/database/36_push_preferences.sql`: pgTAP for the policies, grants, defaults and cross-account refusals (26 tests).
- `supabase/functions/send-push/{handler,index,handler.test}.ts`: `PREFERENCE_FOR_KIND`, `isPushEnabled`, the switch check, and deno cases.
- `src/services/pushPreferencesService.ts`: fetch, and a one-column upsert.
- `src/services/pushNotifications.ts`: exported `hasNativePush` and added `getPushPermission`; its tests are extended.
- `src/stores/slices/{settingsSlice,authSlice}.ts`: `pushPreferences`, `pushPreferencesLoadFailed`, `loadPushPreferences`, `setPushPreference`, and the `signedOutState()` fields.
- `src/components/Settings/{SwitchRow,PushSettings,Settings}.tsx`: the extracted row, the new section and its placement.
- Unit tests:
  - `SwitchRow.test.tsx` and `PushSettings.test.tsx`;
  - `tests/unit/services/pushPreferencesService.test.ts` and `tests/unit/stores/pushPreferences.test.ts`;
  - the sign-out reset in `signOutClearsAccountState.test.ts`.
- `tests/api/push-love-note-trigger.spec.ts`: a fifth describe covering off and on again over the wire, plus the RLS refusals.
- `tests/e2e/settings/push-switches-web.spec.ts`: the website shows no section and makes no `push_preferences` request.
- `src/types/database.types.ts`: the `push_preferences` block only.
- `scripts/sim-driver/{sim,RunnerUITests/Drive.swift}` and `AGENTS.md`: `signin --decline-push`.

**Review findings:** 5 findings from the Quick lens.
- Patched 4: 1 medium (a double tap during a save) and 3 low (the stale rows after a failed reload, the silent offline open, and `updated_at` renamed to `created_at`).
- Deferred 1 low: the hand-copied types block, which is DW-357's pre-existing CLI drift.
- Rejected: none.

**Follow-up review recommended:** false. No high was patched, and only one medium.

**Verification (after the patches):**
- `deno test --no-lock supabase/functions/send-push/`: 84 passed.
- `deno check`: clean.
- `supabase test db`: 23 files, 549 tests, PASS.
- api spec: 16 passed, with `supabase functions serve` running; it was stopped afterwards.
- `push-switches-web.spec.ts`: 1 passed.
- `npm run test:unit`: 213 files, 3365 tests passed.
- `Settings.mobileDataPhotos.test.tsx`: unchanged (`git diff --exit-code`).
- `npm run lint` and `npm run typecheck`: exit 0.
- Simulator (iPhone Duo, local stack, from the implementer's run before the review patches; see Implementation Notes):
  - all six switches toggled, and their columns flipped;
  - Love notes stayed off across an uninstall and reinstall;
  - after `--decline-push` the iOS Settings notice showed;
  - the `284144cf` shell, updated by live update, showed no push section and no error.
- No `dist/`, no `deno.lock`, and no serve, update, `xcodebuild` or edge process is left.

**Residual risks:**
- On deploy, migrations land before functions, and until `send-push` redeploys the old sender ignores the switches.
- The review patches (the offline line, disabling a row while its save runs, clearing state after a failed reload) were checked only by unit tests, not on the simulator.
- The `visibilitychange` re-check of the permission was not exercised on the simulator.
- Hosted Supabase and real APNs are untested for the switch check.
