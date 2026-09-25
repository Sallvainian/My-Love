---
title: 'Couple settings on the server'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '65dabce8d410cbb4be17b53231afafab8e2fbef8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The relationship start date is hard-coded twice (`APP_CONFIG.defaultStartDate`, copied into the device-global `settings`, and `RELATIONSHIP_DATES.datingStart` for Home's "Together for" card), so neither partner can change it and the two can disagree (CAP-9). The partner is named from hard-coded values: the mood pop-up uses `PARTNER_NAME`, and Home's birthday cards take first names from `relationshipDates.ts` (CAP-10). `notificationTime`/`notifications` are persisted but read by nothing.

**Approach:** A new couple-level table holds one start date per linked pair, which either partner can edit in Settings. It reaches screens through a new local-copy kind `couple-settings`, so it shows offline. Home's card and the message-history limit read it. The pop-up names the partner from `partner.displayName`. The hard-coded constants, `datingStart`, `settings.relationship.startDate`/`partnerName` and the notification settings are removed.

## Boundaries & Constraints

**Always:** The server holds the value; the copy is filled only from server reads and confirmed writes. Editing requires a connection (`requireOnline`). Last write wins. Every post-await set re-checks `{ userId, authSessionVersion }`; `coupleSettings` goes into `signedOutState()`. A failed partner lookup (`lookupPartnerId` `error`) keeps the shown copy and is never treated as unlinked. Removed persisted keys are stripped on load; persist `version` stays 0. The new table enables RLS in its creating migration, with policies `TO authenticated` that use `get_my_partner_id()`, and an UPDATE policy that states `WITH CHECK`.

**Never:** No new RPC (FN-GRANT-008 pins the set). No write to `users` columns. No Realtime channel. No change to bundled messages or to `getDailyMessage`. Birthdays and the wedding date stay as they are (story 4). No persist version bump.

**Decisions (owner, 2026-09-23):**
- The start date is a date **and time** (`timestamptz`), edited with a date and a time picker, so "Together for" keeps its exact hours, minutes and seconds.
- Nothing is seeded: no couple data goes in a migration. Until one partner sets it, a linked couple sees the "Set your start date in Settings" placeholder.
- The birthday cards keep their hard-coded names until story 4 replaces them; `relationshipDates.ts` keeps `birthdays` and `wedding`. CAP-10 is met in this story only for the mood pop-up.
- "Rotation" in CAP-9 means the history-browsing limit (`getAvailableHistoryDays`); `getDailyMessage` is unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner edits | B saves a new date online | B's Home card and Settings update; A sees it after start/reconnect | Save error shown in Settings, value unchanged |
| Offline start | Copy saved | Home card and Settings show the saved date | N/A |
| Offline edit | Device offline | "needs a connection" message; copy and state unchanged | `AccountDataError('offline')` |
| Not set yet | Linked, no row | Home card shows a "Set your start date in Settings" placeholder; history limit falls back to its 30-day cap | N/A |
| Unlinked | No partner | Card hidden; Settings row says to link a partner first | N/A |
| Lookup fails | Partner lookup `error` or read fails | Shown copy kept | Logged |
| Sign-out | A out, B in | A's copy deleted; B never sees A's date | Existing `deleteAccountCopies` |
| Old device | Blob holds `startDate`, `partnerName`, `notificationTime`, `notifications` | Keys stripped; blob still parses | N/A |
| Pop-up | Partner B logs a mood | "{B's display name} just logged a mood" | No name → "Your partner" |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` (new, after `20260923010000`) -- table `couple_settings`: `user_a`/`user_b` uuid FK `users` on delete cascade, PK `(user_a, user_b)`, `CHECK (user_a < user_b)`, `relationship_start timestamptz` (nullable), `updated_at`. SELECT/INSERT/UPDATE `TO authenticated` where `auth.uid()` is one of the pair and `get_my_partner_id()` is the other; no DELETE. Revoke all from `anon, authenticated`; grant select, insert, update to `authenticated`. Template: `20260922000000_local_data_tables.sql:130-194`, SELECT pattern `20260818000002_create_events_table.sql:64-103`.
- `supabase/tests/database/28_couple_settings.sql` (new) -- `policies_are`; partner can read and update; outsider and unlinked cannot. Helpers inline.
- `src/types/database.types.ts` -- regenerate only.
- `src/services/coupleSettingsService.ts` (new) -- `fetchCoupleSettings(partnerId)`, `saveStartDate(partnerId, value)` via `upsert(onConflict 'user_a,user_b')`; pattern of `anniversariesService.ts` (`requireOnline`, `requestTimeout`, `toAccountDataError`).
- `src/services/localCopy.ts` -- API only: `readLocalCopy`, `writeLocalCopy`, `registerLocalCopy`.
- `src/stores/slices/settingsSlice.ts` -- add `coupleSettings` state, `loadCoupleSettings` refresher (copy first, offline return, `lookupPartnerId`, fetch, re-check, save copy) and `setRelationshipStart`; mirror the anniversaries refresher at :458-502. Remove first-run defaults :179-190 for the removed keys.
- `src/stores/slices/authSlice.ts` -- `signedOutState()` resets `coupleSettings`.
- `src/stores/slices/partnerSlice.ts` -- after a link is accepted, `refreshLocalCopy('couple-settings')`.
- `src/types/index.ts:85`, `src/validation/schemas.ts:151-162`, `src/validation/errorMessages.ts:42-47` -- drop `notificationTime`, `notifications`, `relationship.startDate`, `relationship.partnerName`.
- `src/stores/useAppStore.ts:85,192-199` -- strip the removed keys, including the two nested under `relationship`.
- `src/utils/messageRotation.ts:53` -- `getAvailableHistoryDays` reads the couple start date; null means the cap. Delete the unused deprecated `startDate` helpers :95-156 and their tests. Caller `messagesSlice.ts:445`.
- `src/components/RelationshipTimers/TimeTogether.tsx` -- read the store; placeholder or hidden per the matrix.
- `src/components/Settings/Settings.tsx` -- a "Together since" row with date and time inputs, next to the display-name row :155-190.
- `src/components/PartnerMoodView/PartnerMoodView.tsx:18,361` -- use `partner?.displayName`.
- `src/config/constants.ts` -- delete; `DailyMessage.tsx:14,146` keeps only the "try refreshing" text.
- `src/config/relationshipDates.ts:26` -- remove `datingStart` (and its test assertion).
- Tests pinning removed keys: `tests/unit/stores/{persistedSettingsThemeKeys,persistedBlobContract,persistedEvents,persistedAnniversaries,persistedMoods,signOutClearsAccountState}.test.ts`, `tests/unit/config/relationshipDates.test.ts`, `CountdownCards.test.tsx`, `PartnerMoodView.kit.test.tsx`, `tests/support/helpers/persisted-blob.ts:53-64`, `tests/e2e/home/persisted-events-strip.spec.ts:115-128`, `tests/e2e/partner/partner-mood-realtime.spec.ts:184` (add a display-name assertion).

## Tasks & Acceptance

**Execution:**
- [x] Migration + pgTAP file + regenerated types.
- [x] `coupleSettingsService.ts` -- read and upsert.
- [x] `settingsSlice.ts`, `authSlice.ts`, `partnerSlice.ts` -- state, refresher, write, sign-out reset, refresh on link.
- [x] Settings type, schema, labels, `useAppStore.ts` strip -- remove the four keys.
- [x] `messageRotation.ts`, `messagesSlice.ts` -- history limit from the couple date.
- [x] `TimeTogether.tsx`, `Settings.tsx`, `PartnerMoodView.tsx`, `DailyMessage.tsx` -- UI changes; delete `constants.ts`, remove `datingStart`.
- [x] Unit tests for the matrix rows; update the listed tests.
- [x] `tests/e2e/offline/` -- start date visible offline after one online session; offline edit refused. `tests/e2e/` -- a date saved by one partner shows on the other after reload.

**Acceptance Criteria:**
- Given no source file references `PARTNER_NAME`, `APP_CONFIG` or `datingStart`, when the app builds, then typecheck and lint pass.
- Given the new migration, when `supabase test db` runs, then every file passes.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verif-gap | `canNavigateBack` reading `coupleSettings` is untested through the slice | medium | Pre-verified: only the helper is tested with a passed-in value | patch |
| 2 | verif-gap | Accept-triggered `refreshLocalCopy('couple-settings')` untested | medium | Pre-verified: no test calls `acceptPartnerRequest`; an unregistered kind is a silent no-op | patch |
| 3 | verif-gap | Couple-settings late-copy-read freshness guard untested | medium | Pre-verified: anniversaries has both deferred-read cases (`accountDataSlices.test.ts:364,381`), couple settings has none | patch |
| 4 | blind | `persistedMoods.test.ts:104` still pins `relationship.partnerName === 'A'` | low | Assertion reads the raw blob and pins a key the adapter now strips; direct correction | patch |
| 5 | blind | `CountdownCards.test.tsx` ordinary-day case sets `coupleSettings` without reset | low | Only the new describe resets it; file becomes order-dependent; one-line reset | patch |
| 6 | blind | Style: `Settings.tsx` header reflowed into a long line; `STALE_PERSISTED_SETTINGS_KEYS` four items on one line | low | No formatter; neighbours use one item per line; direct correction | patch |
| 7 | edge, blind | Stale startup "unlinked" answer can overwrite the post-accept "linked" state | low | Refreshers are not serialized (`localCopy.ts:131-141`), but the startup lookup must outlast the accept RPC plus a second lookup and fetch; fix adds a sequence guard | reject |
| 8 | edge | Copy linked to X, lookup returns Y, fetch fails → old date shown | low | Needs a re-link, and no unlink path exists; fix adds a branch | reject |
| 9 | edge, blind, verif-gap | Settings row shows "Loading..." forever with no copy offline / failed lookup | low | Sign-in needs a connection and the refresh runs online right after, so no-copy-offline needs a failure on first load; fix adds a state | reject |
| 10 | edge, blind | A future start date renders a positive "Together for" (`Math.abs`) | low | Real, but needs a user to type a future date; fix adds validation and a message | reject |
| 11 | edge | A non-HH:MM time shows "Pick a date first." | low | `<input type=time>` without `step` yields HH:MM; fix adds a branch | reject |
| 12 | edge, blind | `setRelationshipStart` resolves silently after a session change | low | Needs sign-out mid-save; fix adds error paths | reject |
| 13 | blind | The start date cannot be cleared in the UI | low | Intent requires set/edit only; the migration comment describes the DB, which does allow NULL | reject |
| 14 | blind | The requesting partner's device is not refreshed after the other accepts | low | Real until next start/reconnect; linking happens once per couple; fix needs a new signal | reject |
| 15 | blind | Form remounts on value change, discarding an in-progress edit | low | Needs a background change mid-edit; fix restructures the form | reject |
| 16 | blind | A time in the spring-forward gap saves one hour later | low | Once a year, one hour; fix adds a check | reject |
| 17 | blind | Existing E2E specs that assert `time-together` were not re-run | false | Re-ran: `tests/e2e/home` (in the 77) and `tests/e2e/navigation` + `errors` (32 passed); every spec listing `time-together` passed | reject |
| 18 | blind | No record that the live counter becomes the placeholder at deploy | false | Owner decision 2 in the frozen block records it | reject |
| 19 | blind | pgTAP lacks positive grant assertions | low | CS-DB-014..020 exercise SELECT/INSERT/UPDATE and fail on a revoke | reject |

## Design Notes

A couple row keyed on the ordered pair was chosen over a column on each `users` row, which could hold two different dates and would need an RPC to write both rows. The ordered pair also means a re-linked account never sees an old couple's row. Story 4's wedding date goes in the same table. Daily-message rotation hashes the calendar date and ignores the start date. The start date only limits how many past days of messages can be browsed (`getAvailableHistoryDays`), and that is the part of CAP-9 this story delivers.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `supabase test db` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/home tests/e2e/settings` (with `supabase start`) -- all pass
