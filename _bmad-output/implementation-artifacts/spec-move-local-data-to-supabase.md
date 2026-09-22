---
title: 'Move anniversaries, message favorites and custom messages to Supabase, with a zero-touch upload from the old origin'
type: 'feature'
created: '2026-09-22'
status: 'done'
route: 'dispatch'
baseline_commit: 'ae661b8616a95e05a1912d5d1069cab9066d0b46'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Anniversaries, message favorites and custom messages exist only in each device's browser storage. The 2026-09-22 move from `sallvainian.github.io/My-Love/` to `my-love.sallvain.workers.dev/` stranded both phones' copies on the old origin, which the home-screen icons still open.

**Approach:** Make Supabase the source of truth for all three, each private to its author as today. Keep the existing local stores as read mirrors. Add a one-time, insert-only upload of whatever a device still holds. Serve this build temporarily on GitHub Pages at `/My-Love/`, where it uploads with the session already stored there and then forwards to the same path on Cloudflare. Retire Pages only after the uploads have evidence.

## Boundaries & Constraints

**Always:**
- Visibility: all three stay per-user. Owner-only RLS on every new table: `to authenticated`, explicit `WITH CHECK` on UPDATE, `revoke all … from anon`, and RLS enabled in the creating migration. The partner sees nothing new.
- Writes are server-first, Supabase-only style (`eventsService` model). Offline writes fail with a clear message. Reads render from the local mirror, so display still works offline.
- Every async store action that `set()`s after an `await` captures and re-checks `{ userId, authSessionVersion }`. Any new account-scoped field goes into `signedOutState()`.
- Upload is insert-only and idempotent. Every row it inserts carries a deterministic `client_key` derived from the local row, backed by `UNIQUE (user_id, client_key)` plus `upsert(…, { ignoreDuplicates: true })`. It never updates or deletes a server row. It skips a local item the server already holds (same text for a custom message, same date+label for an anniversary). It survives the SW-triggered reload mid-run.
- Upload runs once per user per device. A localStorage flag is set only after all three uploads and the receipt succeed. Until the flag is set, no local row is replaced or deleted. Mirrors are refreshed from the server only after the flag is set.
- Each successful upload writes one receipt row: user, origin and per-feature counts only, no content.
- The bridge build opens `my-love-db` at the current `DB_VERSION` (10) with the unchanged persist key `my-love-storage` (version 0).

**Never:**
- No `DB_VERSION` bump or IndexedDB store changes. Extra fields on existing rows are fine.
- No change to the persist key or version, and no change to `anniversaryVault` stash/pop behaviour.
- No partner sharing and no offline write queue.
- Never forward away from the old origin before the current user's upload flag is set.
- Never run `pages-redirect.yml`, disable Pages, or edit the Supabase redirect allow-list before the receipt evidence exists. Never trigger any deploy workflow without the human's go-ahead.
- Do not touch ownerless legacy custom rows from `migrationService`. They cannot be attributed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First sign-in after deploy | local items, no flag | all inserted, receipt written, flag set, mirrors refreshed | — |
| Re-run / reload mid-upload | some rows already on server | no duplicates (client_key conflict ignored), completes | — |
| Server already has item | same text / same date+label | local item skipped, server row untouched | — |
| Upload fails part-way | offline / 5xx | flag not set, local data untouched, retried next launch | logged, app stays usable |
| Flag already set | any | no upload; mirrors load from server | — |
| Bridge, signed in | old origin, flag set after upload | `location.replace` to Cloudflare with same path/search/hash minus `/My-Love` | on failure stay on old origin, app works |
| Bridge, no session | old origin | normal login screen; after sign-in upload then forward | — |
| Offline write | add anniversary / favorite / custom msg offline | error shown, nothing half-written | offline code |

</frozen-after-approval>

## Code Map

- `src/stores/slices/settingsSlice.ts:252-283` -- `addAnniversary`/`removeAnniversary`; the list lives in persisted `settings.relationship.anniversaries`. Reader: `DailyMessage.tsx:361-368` → `CountdownTimer`. Editor: `components/Settings/AnniversarySettings.tsx:153-167` (via `updateSettings`).
- `src/services/anniversaryVault.ts`, `authSlice.ts:205-240,352-366` -- sign-out stash/pop per user. Leave as is. After the upload, the server load overwrites the popped list.
- `src/types/index.ts:66-71`, `src/validation/schemas.ts:143-148` -- `Anniversary` (numeric `id`). Add an optional `serverId`. `z.object` strips unknown keys, and a failed `SettingsSchema` parse drops all settings (`useAppStore.ts:154-165`), so keep the schema valid for old blobs.
- `src/services/messageFavorites.ts`, `storage.ts:184,234,254,299-317`, `messagesSlice.ts:138-168` -- IndexedDB `message-favorites` `{messageId:number,userId}` mirror and its toggle. Bundled message ids are device-local autoincrement. Bundled texts are unique (365/365 in `src/data/defaultMessages.ts`), so the server key for a bundled favorite is a stable hash of its text.
- `src/services/customMessageService.ts:195-621`, `messagesSlice.ts:382-600`, `components/AdminPanel/*` -- owner-scoped custom messages in the IndexedDB `messages` store (`isCustom`, `userId`). Rotation pool = bundled + the user's active customs (`storage.ts:214-216`). Add an optional `serverId` on the row; there is no index change.
- `src/services/eventsService.ts`, `stores/slices/eventsSlice.ts` -- template for the service (throws, `handleSupabaseError`, offline guard, typed rows, `.select()` + not-found on UPDATE/DELETE) and for the slice guard.
- `src/stores/slices/notesSlice.ts:143-170`, `supabase/migrations/20260727000000_love_notes_idempotency.sql` -- idempotent upsert and UNIQUE-constraint pattern.
- `supabase/migrations/20260818000002_create_events_table.sql` -- migration template. Next file sorts after `20260916000000_drop_scripture.sql`.
- `supabase/tests/database/20_events.sql` -- pgTAP template. No existing `policies_are` file names these tables.
- `src/App.tsx:375-396` -- post-auth background init (`migrateCustomMessagesFromLocalStorage`). Hook the upload and then the mirror refresh here, once `userId` is known.
- `src/main.tsx:11-28`, `src/sw.ts:52-70` -- `registerSW({immediate})` with autoUpdate, `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches` and NetworkFirst navigation (3 s). A new `sw.js` at `/My-Love/` replaces the old one and reloads the page once.
- `src/api/supabaseClient.ts:59-82` -- default storage key derived from the URL. A same-URL build on the old origin reads the stored session.
- `git show ae661b86^:.github/workflows/deploy.yml` -- old Pages build and deploy: GitHub Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`→`VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `upload-pages-artifact@v5`/`deploy-pages@v5`, env `github-pages`, concurrency `pages`. `public/404.html` was removed in #325.
- `.github/workflows/pages-redirect.yml` -- "Retire GitHub Pages". Never run until evidence exists.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260922000000_local_data_tables.sql` -- create four tables: `anniversaries` (uuid id, user_id, event_date date, label, description, client_key, timestamps); `custom_messages` (uuid id, user_id, text, category check against `MessageCategory`, active, is_favorite, tags, client_key, timestamps); `message_favorites` (user_id, message_key, created_at, PK both); `local_data_uploads` (id, user_id, origin, three counts, created_at; SELECT/INSERT only). Add length checks matching the Zod schemas, `UNIQUE(user_id, client_key)`, owner-only RLS and grants per Boundaries. Then regenerate `src/types/database.types.ts`.
- [x] `supabase/tests/database/27_local_data_tables.sql` -- `policies_are`, roles, and owner/partner/stranger behaviour for all four tables; anon has no privilege.
- [x] `src/services/anniversariesService.ts`, `customMessagesApi.ts`, `messageFavoritesApi.ts` (new) -- CRUD in the eventsService style, plus the bundled-text hash helper.
- [x] `settingsSlice.ts`, `messagesSlice.ts`, `customMessageService.ts`, `storage.ts`, `authSlice.ts` -- writes go to the server first, then to the mirror, with the identity guard. Add `loadFromServer` refreshes that replace the user's mirror rows. Any new fields go into `signedOutState()`.
- [x] `src/services/localDataUpload.ts` (new) -- one-time upload per Boundaries and matrix. Sources: settings anniversaries (after vault pop), the user's IndexedDB custom rows, and the user's IndexedDB favorites (mapping custom ids to `is_favorite` and bundled ids to text hashes). Writes the receipt, then sets the flag `my-love-local-upload-v1:<userId>`.
- [x] `src/App.tsx` -- run the upload and then the mirror refresh after auth. When `import.meta.env.VITE_LEGACY_BRIDGE_TARGET` is set, forward via `location.replace` once the flag is set for the signed-in user.
- [x] `.github/workflows/pages-bridge.yml` (new) -- `workflow_dispatch` only. Build with GitHub Secrets, `npm run build -- --base=/My-Love/` and `VITE_LEGACY_BRIDGE_TARGET=https://my-love.sallvain.workers.dev`, copy `dist/index.html` to `dist/404.html`, then deploy to Pages (env `github-pages`, concurrency `pages`). No migrations.
- [x] `tests/unit/**` -- unit tests for every matrix row, the three services, the slice guards, sign-out reset, and the forward-URL computation.
- [x] `tests/e2e/account-data/` -- one spec: a favorite, a custom message and an anniversary made in one browser context appear in a fresh context for the same account.
- [ ] Post-merge operations (each step needs the human's go-ahead): (1) deploy.yml applies migrations and deploys; (2) dispatch `pages-bridge.yml`; (3) the human opens the old icon on both phones; (4) evidence is `local_data_uploads` rows from origin `https://sallvainian.github.io` for both accounts (report counts only, never commit them); (5) run `pages-redirect.yml`, disable Pages (`gh api -X DELETE repos/Sallvainian/My-Love/pages`), and remove the github.io entry from the hosted auth `uri_allow_list`.

**Acceptance Criteria:**
- Given a signed-in user on a fresh browser, when they open the app, then their anniversaries, favorites and custom messages load from Supabase.
- Given the bridge build on the old origin with a stored session and local data, when the old icon is opened online, then the data reaches Supabase with a receipt, and the page lands on the same path at the Cloudflare origin with no user action beyond the one automatic reload.
- Given the partner's account, when it queries any of the four tables, then it sees none of the other user's rows.

## Design Notes

`client_key` is deterministic per local item, so re-runs and the mid-run SW reload collide rather than duplicate: anniversaries use `a:<date>:<hash(label)>`, custom messages use `c:<createdAt ms>:<hash(text)>`. The content checks (same text, same date+label) catch the same item uploaded from a second device. Because the upload only inserts, "never overwrite newer server data" holds by construction. The one accepted gap: a favorite removed on the server before a device's first upload is re-added. That window only exists between merge and each device's first launch.

## Verification

**Commands:**
- `npm run typecheck` && `npm run lint` -- expected: clean
- `npm run test:unit` -- expected: green, including the new matrix tests
- `supabase test db` -- expected: green, including `27_local_data_tables.sql`
- `fnox exec -- npm run build -- --base=/My-Love/` -- expected: `dist/sw.js` and `dist/manifest.webmanifest` resolve under `/My-Love/`
- `npx playwright test tests/e2e/account-data` (local Supabase running) -- expected: green

## Implementation Notes

- Added beyond the task list: `accountDataQueue.ts`, an in-page lock that serialises account-data writes, refreshes and the upload so a refresh cannot erase a concurrent write. It stores nothing and never retries, and it is strict: a hung request is bounded where it is made (`requestTimeout()`, 30 s, on every request; the two user creates are retry-safe because the form reuses one `client_key` per submit — `useSubmitKey` — and a conflict reads the stored row back), never by releasing the queue, which a pre-push review showed lets a stale refresh erase a later write. Offline writes still fail at once.
- Post-sign-in order lives in `syncAccountDataAfterSignIn` (`localDataUpload.ts`): upload, then forward (bridge build only), otherwise refresh the mirrors. App.tsx only wires it.
- Items not yet uploaded refuse edit/delete with `not-synced` until the device's upload succeeds. After the flag is set, an owned custom row that matches no server row is kept and marked `localOnly`; it can only be deleted, and only from the device.
- Evidence queries: expect at least one `local_data_uploads` row per account from origin `https://sallvainian.github.io`. A reload between the receipt and the flag can add a second, and a device's first sign-in anywhere writes a zero-count receipt.
- The post-merge operations task stays open: it needs the merge, then the human's go-ahead at each step.

## Spec Change Log

## Review Triage Log

Pass 1 (blind B, edge-case E, verification-gap V). Route in brackets.

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| B1 | update/removeAnniversary resolve `existing` by local id after the queue wait, before any identity re-check | medium [patch] | Queued task reads live settings and calls the server; identity checked only after the await, so a switched account's row with the same local id is edited under the new session. |
| B2/E2 | Rows skipped as invalid are deleted by the post-flag refresh | medium [patch] | `replaceMirrorForUser` deletes every owned row without `serverId`. Custom text >1000/blank reachable for rows predating the 2025-11-15 limit (9b8acec2). Anniversary branch unreachable: `IsoDateStringSchema` rejects impossible dates, so persisted entries always parse. |
| B3/E4 | Receipt counts include rows skipped as invalid | low [patch] | Counts are `pending*.length`; the receipt is the Pages-retirement evidence, and the fix is a direct correction. |
| B4/E3 | A duplicate-skipped custom row loses its local favorite | low [reject] | Real, but carrying it needs an UPDATE of a server row, which the frozen intent forbids ("never updates a server row"). |
| B5/E6 | Uploaded custom rows get new local ids on first refresh | low [reject] | Real, one-time; rotation recomputes on a stale id (updateCurrentMessageStaleCache). Fix adds content matching, so rejected under the low rule. |
| B6 | Permanent upload failure retries silently | low [reject] | No data loss (flag unset keeps local data, no forward). A missing receipt is already the operator's signal; surfacing it needs new UI. |
| B7/E1 | Global queue has no timeout; one hung request blocks all writes | medium [patch] | `serializeAccountDataWrite` chains on settle only; supabase-js sets no request timeout. |
| B8 | Bundled keys depend on seeded text | low [patch: uniqueness test] | Measured: all 365 texts of a2d95ffb (2025-11-06) are present today; only a device seeded from the 100-message 517c0f2c set (3 Pages deploys before 2025-11-06) holds 20 texts that no longer exist, whose favorites point at messages the app no longer ships. Uniqueness assumption untested; adding the test is direct. |
| B9 | Mirrors refresh only on auth change | low [reject] | Per-user data; cross-device same-user edits are rare; fix adds listeners. |
| B10/E12 | `favoriteError` persists across message navigation | low [patch] | Cleared only by next toggle or sign-out; direct fix. |
| B11 | Upload runs outside the queue | low [patch] | A toggle during the first upload can be undone by the insert; wrapping is one line with no nested queued call. |
| B12 | pgTAP lacks owner INSERT on receipts/favorites and owner DELETE | low [patch] | Fixture inserts as postgres; the receipt insert gates the flag. Adding assertions is direct. |
| B13 | Bridge gives no re-install prompt; new origin needs sign-in; iOS standalone may open cross-origin in a sheet | low [reject] | Not a code defect: upload completes before navigation, so data is safe either way. Re-adding the icon and signing in on workers.dev are operational steps, reported to the human. |
| B14 | cross-device spec imports `/src/stores/useAppStore.ts` | false | Same pattern as account-data.spec.ts:12,35; E2E runs against the Vite dev server. |
| E5 | Refresh fails right after a successful upload, leaving rows not-synced until next launch | low [reject] | Needs network loss within seconds of a successful upload; fix adds retry wiring. |
| E7 | Bridge forwards after the first account on a shared device, stranding a second account's local data | low [reject] | Each partner uses their own phone; the other account's rows can only be uploaded under its own session. Evidence is per account. |
| E8 | Messages never seed, so upload never runs | false | Without IndexedDB there is no local custom or favorite data to strand, and the upload reads IndexedDB itself. |
| E9 | `localStorage.setItem` throws after the receipt | low [reject] | Persisted settings use the same storage; the outcome is extra receipts, not loss. |
| E10 | `crypto.subtle` missing on a non-secure origin | low [reject] | Both production origins and localhost are secure contexts. |
| E11 | Custom favorite tap with a stale mirror writes the value the server holds | false | Local and server end on the value the user asked for; no divergence. |
| V1 | Custom edit/delete server calls, offline no-op and not-synced untested | pre-verified [patch] | Filed with a demonstration: removing the API call leaves the tests green. |
| V2 | Un-favorite server calls untested | pre-verified [patch] | Filed with a demonstration. |
| V3 | Refresh removal of stale favorites untested | pre-verified [patch] | Filed with a demonstration. |
| V4 | Favorite error alert never rendered in a test | pre-verified [patch] | Filed with a demonstration. |
| V5 | AnniversarySettings server wiring and error display untested | pre-verified [patch] | Filed with a demonstration. |
| V6 | Failed local read stopping the upload untested | pre-verified [patch] | Filed with a demonstration. |
