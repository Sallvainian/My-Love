---
title: 'Birthdays and wedding date on the server'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '70d756435a0fed652c46bfbd8279b0d89d81be72'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Home's birthday cards read two hard-coded people (names, dates, birth years) from `src/config/relationshipDates.ts`, and the wedding card is hard-coded `null`, so nobody can set or change them and the names break CAP-10 (CAP-11).

**Approach:** Each partner's birthday becomes a `date` column on their own `public.users` row, set by them in Settings. The wedding date becomes a `date` column on story 3's `couple_settings` row, which either partner can set, change or clear in Settings. Home reads your birthday and display name from a new local copy of your own profile (kind `profile`), your partner's birthday from the existing `partner` copy, and the wedding date from `coupleSettings`. All three show offline. `relationshipDates.ts` is deleted.

## Boundaries & Constraints

**Always:** Story 3's rules carry over. The server holds the values. Copies are filled only from server reads and confirmed writes. Saving needs a connection (`requireOnline`). Last write wins. Every write to state after an await re-checks `{ userId, authSessionVersion }`. The new `ownProfile` state goes into `signedOutState()`. A failed lookup or read keeps what is shown. `YYYY-MM-DD` values are parsed with `parseEventDate`, never `new Date(string)`. A copy saved before this change (no birthday or wedding field) still parses and reads that value as not set. The persist `version` stays 0.

**Never:** No new RPC (FN-GRANT-008). No Realtime channel. No seeded data: no birthday or wedding date goes into a migration or into source code (the repo is public). The client gains write access to no `users` column except `birthday`. No change to `display_name` editing itself.

**Decisions (owner, 2026-09-23):**
- Your card is labelled with your display name, and your partner's card with `partner.displayName`. With no name chosen, your card reads "You turn N" and your partner's reads "Partner turns N".
- A card whose birthday is not set stays in place with "Not set yet". Your card adds "Set it in Settings".
- Unlinked: your card only, full width. The partner card and the wedding card are hidden.
- The birthday must be in the past, and there is no Clear control for it. The wedding date can be any date and has a Clear control; clearing it shows "Date TBD".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partner sets birthday | B saves 2000-01-01 | B's own card and A's partner card (after start/reconnect) show "{B name} turns N" and the day count | Save error shown in Settings, value unchanged |
| Wedding set/cleared | Either partner saves or clears | Both phones count down, or show "Date TBD" | Same |
| Offline start | Copies saved | All three cards show the saved values | N/A |
| Offline edit | Device offline | "needs a connection"; copy and state unchanged | `AccountDataError('offline')` |
| Old copy | `partner` / `couple-settings` copy lacks the new field | Parses; that value reads as not set until the refresh | N/A |
| Sign-out | A out, B in | A's `profile` copy deleted with the rest; B never sees A's values | Existing `deleteAccountCopies` |
| Display name changed | Saved in Settings | Home's own card label updates without a reload | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` (new, after `20260923020000`) -- `alter table public.users add column birthday date`; `grant update (birthday) on public.users to authenticated` (the table-level UPDATE was revoked in `20260912030000_profile_name_email_ownership.sql:132-141`; `users_update_self_safe` already limits rows to self). `alter table public.couple_settings add column wedding_date date`. The users SELECT policy already admits only self and partner.
- `supabase/tests/database/25_profile_name_email_ownership.sql` -- add a `has_column_privilege` on `birthday` and bump `plan(34)`. `28_couple_settings.sql` -- add partner and outsider cases for `wedding_date`, `plan(29)`.
- `src/types/database.types.ts` -- regenerate only.
- `src/services/coupleSettingsService.ts` -- `ServerCoupleSettings.weddingDate`, mapped in both functions. Add `saveWeddingDate(userId, partnerId, date | null)`, an upsert that sends only `wedding_date` + `updated_at` (PostgREST updates only the columns it is sent, so it cannot clobber `relationship_start`).
- `src/services/profileService.ts` (new) -- `fetchOwnProfile()` returns `{ displayName: string | null, birthday: string | null }`, with `displayName` null under `isSeedFallbackName` (`supabaseClient.ts`). `saveBirthday(date)` calls `.update({ birthday, updated_at }).eq('id', uid)`. Follow `coupleSettingsService` (`requireOnline`, `requestTimeout`, `toAccountDataError`).
- `src/api/partnerService.ts:92` -- select `birthday`; `PartnerInfo.birthday: string | null` (5 files reference `connectedAt` fixtures).
- `src/stores/slices/settingsSlice.ts` -- `CoupleSettings` linked gains `weddingDate` (parser :127 defaults a missing one to null); `setWeddingDate`, following `setRelationshipStart` :645. New `ownProfile` state, kind `profile` refresher `loadOwnProfile` (the `loadCoupleSettings` shape, :584, without the partner lookup) and `setBirthday`.
- `src/stores/slices/partnerSlice.ts:132` -- a saved copy without `birthday` reads it as null.
- `src/stores/slices/authSlice.ts:182` -- reset `ownProfile`.
- `src/components/Settings/Settings.tsx` -- a "Birthday" row (always) and a "Wedding" row (linked only, with Clear) beside "Together since" :74-160. After a display-name save, `refreshLocalCopy('profile')`.
- `src/components/RelationshipTimers/BirthdayCountdown.tsx` -- takes `{ name, birthday: string | null, tone, testId }`. `BirthdayInfo`, `getNextBirthday` and `getUpcomingAge` move into it, and `calculateTimeDifference` moves into `TimeTogether.tsx`.
- `src/App.tsx:14,724-736` -- cards from the store per the decisions; testids `birthday-countdown-self` and `birthday-countdown-partner`, wedding keeps `event-countdown-wedding` and `tone="partner"` on the partner card.
- Delete `src/config/relationshipDates.ts` and `tests/unit/config/relationshipDates.test.ts`. Update `CountdownCards.test.tsx`, `tests/e2e/home/home-kit.spec.ts:32-114`, and the persisted/sign-out unit tests that list local-copy kinds.

## Tasks & Acceptance

**Execution:**
- [x] Migration + both pgTAP files + regenerated types.
- [x] `profileService.ts`, `coupleSettingsService.ts`, `partnerService.ts` -- reads and writes.
- [x] `settingsSlice.ts`, `partnerSlice.ts`, `authSlice.ts` -- state, refresher, writes, sign-out reset.
- [x] `BirthdayCountdown.tsx`, `TimeTogether.tsx`, `App.tsx`, `Settings.tsx` -- UI; delete `relationshipDates.ts`.
- [x] Unit tests for the matrix rows and the decisions; update the listed tests.
- [x] E2E: `tests/e2e/settings/` -- a birthday and wedding date saved by the partner show on this worker's Home after reload. `tests/e2e/offline/` -- the cards show offline after one online session, and an offline save is refused. Teardown resets only this pair's own `birthday` columns and `wedding_date`.

**Acceptance Criteria:**
- Given no source file references `relationshipDates`, `RELATIONSHIP_DATES` or a partner's first name, when the app builds, then typecheck and lint pass.
- Given the new migration, when `supabase test db` runs, then every file passes.

## Implementation Notes

- Migration `20260924000000_birthdays_wedding_date.sql`. pgTAP: PROF-DB-035 (plan 35), CS-DB-030..036 (plan 36).
- Home's cards live in a new `RelationshipTimers/BirthdayWeddingCards.tsx`, rendered by `App.tsx`, so the decisions are unit-testable without the App harness. A card whose source has not answered yet (no copy, no server answer) is not rendered.
- `BirthdayCountdown` takes `name: string | null` (null = "You turn N") and an optional `unsetDescription`; "today" is `calendarDays === 0`, so a 29 Feb birthday highlights on 1 March in non-leap years.
- `profileService.saveBirthday` returns the whole `OwnProfile` read back from the updated row, so the copy is always a server answer.
- `App.tsx`'s first-login display-name modal also refreshes the `profile` copy, like Settings.
- `EventsSettings.tsx` placeholder "e.g., [partner] visits" became "e.g., Weekend trip" (acceptance: no partner first name in source). Test fixtures under `__tests__`/`tests/` still use first names as data.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx` no-ops the `profile` refresher too (its read calls `auth.getSession`, which the harness counts).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | verif-gap | App's first-run name gate refreshing `profile` is untested | medium | Pre-verified: only the Settings call site is asserted; deleting `App.tsx:612` passes every test | patch |
| 2 | edge, blind | Birthday input has no lower bound; a mistyped year like 0198 saves and Home shows a nonsense age | low | `Settings.tsx` sets only `max`; partial typing in a date input yields such years; `min` plus one check in `handleSave` | patch |
| 3 | edge | Wedding card keeps the old day count for up to 1 s after `weddingDate` changes | low | `EventCountdown` recomputes only on its interval (`EventCountdown.tsx:88-96`); a `key` on the date string fixes it | patch |
| 4 | blind | `toDateOnlyOrNull` lives in `coupleSettingsService`; `partnerService` and `normalizePartnerCopy` hand-roll a looser check | low | Profile service and slice import couple settings just for a date helper; a malformed partner birthday reaches the store (card still shows "not set") | patch |
| 5 | blind | Moved doc comments sit on the wrong declarations in `TimeTogether.tsx` / `BirthdayCountdown.tsx` | low | "Calculate time difference" sits above `interface TimeDifference`; direct correction | patch |
| 6 | blind, edge | Touched fixture in `EventsSettings.test.tsx` keeps `'[partner]'` and a now-false comment about `partner` | low | The comment says only the Partner view loads `partner`; Home now renders it; direct correction | patch |
| 7 | edge, blind | Birthday row shows "Loading..." with no form when the first profile read fails and there is no copy | low | Same shape as story 3 finding 9: sign-in needs a connection and the refresh runs right after; fix adds an error/retry state | reject |
| 8 | edge | A past wedding date makes the card disappear | low | Owner approved "any date" at the checkpoint with this side effect stated | reject |
| 9 | edge, blind | No DB CHECK on `birthday`; a direct API write of a future date shows "turns 0" | low | The UI refuses it; needs a hand-crafted request; a `current_date` CHECK is not immutable | reject |
| 10 | edge | `profileService` reads the session user, which could differ from the store's `requestedBy` | low | Sign-out bumps `authSessionVersion` so `isCurrent()` fails; needs a cross-tab account switch mid-read; fix adds a parameter | reject |
| 11 | edge | E2E date helpers shift 29 Feb to 1 Mar, so a day count is off by one on a leap-year date | low | Fails at most on a few days in 2028; fix adds offset-picking | reject |
| 12 | edge | Claim "no source file references a partner's first name" while `__tests__` fixtures still do | false | The AC and CAP-10 concern the app naming the partner; test fixtures render nothing in the app | reject |
| 13 | blind | pgTAP asserts only the `birthday` column grant, not row ownership for it | low | Row ownership is `users_update_self_safe`, already exercised for `display_name` in `25_...sql` and the SELECT policy in `26_...sql`; the column adds no new policy | reject |
| 14 | blind | Partner card may render alone full width while `ownProfile` is still null; partner and wedding cards read different sources | low | Transient until both refreshers answer at start; fix adds layout branches | reject |
| 15 | blind | No unit test for a 29 Feb birthday | low | Behaviour unchanged from before this story and documented in the header | reject |
| 16 | blind | No sign-out race tests for `setWeddingDate` | low | Same two `isCurrent()` gates as `setRelationshipStart`, which story 3 tests | reject |
| 17 | blind | Deploy shows "Not set yet" on both birthday cards until each sets theirs | low | Owner decision (no seeding, public repo), stated at the checkpoint; goes in the PR notes | reject |
| 18 | blind | A partner's change shows only after start or reconnect; no Realtime | low | Frozen block: "No Realtime channel" | reject |
| 19 | blind | The two E2E specs compute dates in Node vs browser time | low | Same timezone in every configured run; no `timezoneId` set | reject |

## Design Notes

The birthday lives on `users` rather than `couple_settings` because it belongs to one person and exists before linking. The column privilege keeps the rest of the row out of the client's reach. The wedding date goes on `couple_settings`, as story 3 planned. A 29 February birthday counts down to 1 March in non-leap years, because JavaScript `Date` rolls that date over, as it does today.

## Verification

**Commands:**
- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npx vitest run tests/unit src` -- all pass
- `supabase test db` -- all pass
- `npx playwright test tests/e2e/offline tests/e2e/home tests/e2e/settings` (with `supabase start`) -- all pass
