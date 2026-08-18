---
id: SPEC-dynamic-events
companions:
  - data-model.md
  - integration-points.md
  - navigation.md
sources:
  - ../../implementation-artifacts/deferred-work.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Couple-Shared Events, and the Navigation That Reaches Them

## Why

A pain to solve, and the pain is visible on the app's front page right now. The Home dashboard's visit countdowns are compiled into the bundle: `src/config/relationshipDates.ts:48-61` declares exactly two of them, `'Next Visit'` dated `new Date(2025, 10, 26)` and `'Following Visit'` dated `new Date(2025, 11, 20)`, and `src/App.tsx:547-555` maps over that literal array. Both dates are now in the past, so both cards render `src/components/RelationshipTimers/EventCountdown.tsx:158` — `<p className="text-lg text-gray-500 dark:text-gray-400">Event passed</p>` — and have done since December 2025. The couple cannot add the next visit, cannot correct a date that moved, and cannot clear a card that expired; changing any of it means a code edit and a deploy. This is the work `deferred-work.md:11-17` (DW-2, "Stale visit events on Home dashboard") was folded into rather than patched, on the grounds that the cards "were hardcoded and had no expiry".

Managing events needs somewhere to live, and today there is nowhere. `src/components/Settings/Settings.tsx` exists but nothing in the repo imports or renders it, and `navigationSlice.ts:18` has no `'settings'` view. So this spec also gives the app a navigation surface that can hold Settings: the fixed bottom tab bar is retired in favour of a hamburger-triggered tray. That half is independently shippable and has no data dependency on events.

## Capabilities

### Events

- **CAP-1**
  - **intent:** Either partner can add an event carrying a label, a date, and an optional description, and it appears on both partners' Home dashboards.
  - **success:** Partner A adds an event dated in the future; it renders as a countdown card on A's Home without a reload, and on B's Home after B's next load of Home, with the same label, date and description.

- **CAP-2**
  - **intent:** The person who created an event can correct or remove it afterwards, so a moved date or a mistaken entry does not require a deploy.
  - **success:** The creator can edit an event's label, date or description and delete it, and both partners see the result. The partner can see every event but cannot change or delete one they did not create — an attempted update or delete by the partner changes zero rows.

- **CAP-3**
  - **intent:** An event stops occupying the dashboard once its day is over, in each partner's own local time, without anyone deleting it.
  - **success:** An event dated yesterday renders no card. An event dated today still renders — the existing "Today! 🎉" branch at `EventCountdown.tsx:147,154` — for the whole of that viewer's local day, and disappears at that viewer's own local midnight, which for partners in different timezones is a different absolute moment. Both partners always agree on *which calendar date* the event is. No path renders the string `Event passed`.

- **CAP-4**
  - **intent:** Home's event cards read from store state rather than a compiled-in constant, while the rest of the timers grid is untouched.
  - **success:** `src/App.tsx:547-555` no longer reads `RELATIONSHIP_DATES.visits`, and `src/config/relationshipDates.ts` no longer exports a `visits` array; the two `BirthdayCountdown` cards (`App.tsx:535-536`), the Wedding `EventCountdown` (`:541-546`) and `TimeTogether` (`:529`, reading `RELATIONSHIP_DATES.datingStart` via `TimeTogether.tsx:21`) render exactly as before.

- **CAP-6**
  - **intent:** Events belong to the account, not the device, so a shared device never shows one couple's events to the next.
  - **success:** Sign out and sign in as an unrelated account on the same browser: Home shows none of the previous account's events, and no event data survives in `localStorage` under `my-love-storage`.

- **CAP-7**
  - **intent:** A creating user is told when an event failed to save, rather than seeing it vanish on the next load.
  - **success:** With the network offline or the insert rejected, the add attempt surfaces a visible error and the event is not silently presented as saved.

- **CAP-10**
  - **intent:** With no events yet, the events area says so and offers the way to add one.
  - **success:** On a fresh account with zero events, Home's timers grid does not render an unexplained gap where the two hardcoded cards used to be, and the Settings events list shows an empty state carrying the add affordance rather than a bare heading.

### Navigation

- **CAP-5**
  - **intent:** A signed-in user can reach a Settings screen from the running app and manage events there.
  - **success:** From Home, a user opens the tray and reaches Settings, sees the events list, and completes add, edit and delete without leaving it. Reloading the browser on Settings returns to Settings rather than resetting to Home.

- **CAP-8**
  - **intent:** Navigation moves from a permanently visible bottom tab bar to a hamburger control that opens a collapsible tray carrying every destination.
  - **success:** The tray reaches all six existing views plus Settings. It closes on selecting a destination, on Escape, and on a click outside. While open, keyboard focus is confined to it and returns to the hamburger on close. No view renders a dead strip where the 64px bar used to be. The active destination carries `aria-current`.

- **CAP-9**
  - **intent:** Signing out happens in Settings and nowhere else.
  - **success:** The application has exactly one sign-out control, inside Settings. Signing out from it returns the user to the login screen with account state cleared.

## Constraints

### Data

- **The event date is a Postgres `date` column, not a `timestamptz`.** This follows directly from resolving "passed" in each viewer's own timezone, and it deviates from `deferred-work.md:25`, which says "event timestamp". A `timestamptz` stores one absolute instant, so `new Date(iso).getDate()` resolves in each browser's zone and the two partners can disagree about *which calendar date the event is* — measured: `2026-09-13T00:00:00.000Z` renders as Sep 12 in `America/New_York` and Sep 13 in `Europe/Berlin`. A `date` column returns a bare `"YYYY-MM-DD"` string, which every viewer reads as the same calendar day, while `EventCountdown.tsx:70-73` still decides "today" from local components. No single column gives both a shared date and a shared boundary; per-viewer means `date`.

- **The date string is parsed into local components, never handed to `new Date(string)`.** `new Date('2026-09-12')` is the ECMA-262 date-only form, parsed as UTC midnight, which in `America/New_York` yields Sep 11 — measured. The required form is `const [y, m, d] = row.event_date.split('-').map(Number); const eventDate = new Date(y, m - 1, d);`, matching the idiom already at `src/utils/countdownService.ts:83`. The write path has the mirror trap, recorded at `src/utils/dateUtils.ts:127`: `"toISOString().split('T')[0] which is UTC-based — at 11 PM EST"`.

- **Writes are creator-only; reads are both partners.** Four policies, all declared `to authenticated`: SELECT on `(select auth.uid()) = user_id or user_id = public.get_my_partner_id()`, and INSERT, UPDATE and DELETE each on `(select auth.uid()) = user_id`. The UPDATE policy states `with check` as well as `using` — omitting it makes Postgres reuse `using` as the check, the shape `20260818000001:234-243` records this repo as having been bitten by, and here the check is what stops a creator donating a row by rewriting `user_id` to their partner's. Full policy text in `data-model.md`.

- **The events table must `enable row level security` in the same migration that creates it.** `supabase/migrations/20260725170000_grant_api_roles_on_public.sql:35` runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;` and `:40-41` extends that to future tables via `ALTER DEFAULT PRIVILEGES`. `20260817000000_love_note_removals.sql:64-68` restates it: *"a new public table without RLS is readable and writable by every authenticated user. RLS is the gate."*

- **Partner visibility resolves through `public.get_my_partner_id()`, and any policy calling it must be declared `to authenticated`.** `20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql:205-210` records why the role matters: anon holds no `EXECUTE` on that function since `20260818000000`, so a PUBLIC policy makes an anon write fail with `"permission denied for function get_my_partner_id"` — `:207` says `INSERT` specifically instead of a clean row-level-security denial. `AGENTS.md:60` directs new policy work through the helper.

- **There is no `couple_id` in this schema.** A grep of `supabase/` for `couple_id` returns nothing; sharing is always derived from `users.partner_id`. `AGENTS.md:60` adds that `users.partner_id` changes only via the `accept_partner_request` RPC.

- **`src/types/database.types.ts` is regenerated, never hand-edited** — `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts` (`AGENTS.md:10`). Note it gives no protection here: every Postgres temporal column becomes plain `string` (`src/types/database.types.ts:167` `updated_at: string | null`), so nothing stops a future contributor writing `new Date(row.event_date)`, which typechecks, builds, and is wrong only in some timezones.

### State

- **Every events state key goes into `signedOutState()` in the same commit, loading flags and write locks included.** `src/stores/slices/authSlice.ts:35-37` states: *"ADDING STATE? If it is derived from the signed-in user or their partner, add it here. signOutClearsAccountState.test.ts asserts that every key in this object is reset, so DELETING or renaming one fails there."* `:39-42` extends it to flags, because *"A stranded flag is a dead screen for the next account."*

- **Events state is not persisted.** `src/stores/useAppStore.ts:151-177` `partialize` returns only `settings` (`:154`), `isOnboarded` (`:155`) and `messageHistory` (`:157-163`), under the comment at `:152` `// Only persist small, critical state to LocalStorage`. `:164-168` records the cost of getting this wrong: persisting the moods array `"under this single global key meant one account's mood notes were rehydrated into the next account's session on a shared device, before any fetch could correct them."`

- **Any async events action that `set()`s after an `await` must first re-check `if (get().userId !== capturedUserId) return`** (`AGENTS.md:53`).

- **`src/config/relationshipDates.ts` survives.** Only its `visits` array (`:48-61`) moves. `TimeTogether.tsx:21` reads `RELATIONSHIP_DATES.datingStart` and `App.tsx:535-536,544` read `birthdays` and `wedding`.

### Navigation

- **The tray uses the existing shared focus trap, and its Escape handler must be identity-stable.** `src/hooks/useFocusTrap.ts:21-25` exports `useFocusTrap(containerRef, enabled, options)`, documented at `:14` as *"Traps keyboard focus within a container element (WCAG 2.4.3)."* `NoteRemoveConfirmation.tsx:48-53` records the trap that follows: *"useFocusTrap lists onEscape in its effect deps and re-focuses initialFocusRef on every run, so any change of identity re-arms the trap and drags focus back to Cancel — which a `isRemoving ? undefined : onClose` ternary did on every write, and an inline arrow from the parent did on every parent render."* The working shape is a latest-ref plus a `useCallback` with an empty dep array (`:58-67`).

- **Retiring the bar means sweeping five hardcoded offsets, not one.** `App.tsx:515` `min-h-screen pb-16`, `LoveNotes.tsx:88` `h-[calc(100vh-4rem)]`, `PhotoGallery.tsx:306` FAB at `bottom-20`, `InteractionHistory.tsx:94` overlay at `fixed inset-x-4 top-20 bottom-20`, and `PokeKissInterface.tsx:448` toast at `top-20`. Leaving any of them produces a dead strip, a short chat viewport, or an element floating against nothing.

- **The viewport meta gains `viewport-fit=cover`, and the new chrome uses the real `.safe-top`/`.safe-bottom` classes.** `index.html:6` has no `viewport-fit=cover`, so `env(safe-area-inset-*)` resolves to 0 everywhere and the `safe-area-bottom` class the old bar applies at `BottomNavigation.tsx:19` is doubly inert — it is not even a defined class, while the real `.safe-top`/`.safe-bottom` at `src/index.css:133-139` go unused. Resolved from an open question by Sallvain; both edits land with the tray.

- **Adding a `settings` view costs the five hand-maintained registration edits at `AGENTS.md:25`**, of which *"Only `pathMap` is typechecked, so missing the rest still compiles, renders nothing, and resets to home on reload."* No react-router (`AGENTS.md:45`).

### Tests

- **The nav change is a test change first.** 15 `nav-*` references across 5 live specs — 11 `.click()` calls and 4 `toBeVisible()` assertions — plus 14 uses of the `bottom-navigation` testid across three of those specs as an "app is loaded" readiness proxy. Two tests in one spec click `nav-logout`, the control CAP-9 deletes, so they need a new flow rather than a renamed locator. Separately, `src/components/Navigation/__tests__/BottomNavigation.test.tsx` (179 lines, 19 `nav-` references) tests the component being deleted and needs replacing wholesale, not adapting. Inventory in `navigation.md`.

- **New E2E goes in `tests/e2e/`, never `tests/e2e-archive/`** (`AGENTS.md:13`), importing `{ test, expect }` from `tests/support/merged-fixtures.ts` and never from `@playwright/test` (`AGENTS.md:26`). E2E accounts come from the per-worker pool keyed on `TEST_WORKER_INDEX`, and a spec must not link or unlink partners — those rows belong to other workers (`AGENTS.md:62`).

## Non-goals

- No recurring or repeating events. Each event is a single dated occurrence.
- No time of day on an event. A `date` column cannot express one, so the countdown always runs to local midnight. This is not a regression — the existing hardcoded visits are already local midnight — but it caps what the feature can show.
- No reminders, push notifications, or emails.
- No calendar, month, or agenda view.
- No per-user private events. Every event is visible to both partners; there is no visibility toggle.
- Birthdays, the wedding date, and `datingStart` stay in `src/config/relationshipDates.ts`.
- `settings.relationship.anniversaries` is not rewritten onto the events table. It stays device-local and keeps rendering through `DailyMessage.tsx:359,366`.
- No seed data. The two hardcoded visits are not migrated — both are dated 2025 and CAP-3 would hide them the moment they landed.
- No offline-first IndexedDB mirror for events. Events are Supabase-only, the model `AGENTS.md:65` assigns to photos, love notes and partner interactions.
- No live partner updates in this spec. CAP-1 requires only that the partner sees a new event on their next load; the assessment for adding realtime is in `integration-points.md`, unbuilt pending a decision.
- No storage bucket, so `16_photos_storage_update_policy.sql`'s nine-policy assertion on `storage.objects` is untouched.

## Success signal

One partner opens the tray, goes to Settings, and adds "Gracie flies in" for a date three weeks out. The card is on their Home immediately and on the other partner's Home when that partner next opens the app — neither of them touched the codebase, and no deploy happened. Both phones agree it is the 12th. Three weeks later the card counts down to `Today! 🎉` through the whole of the 12th on each phone, and is gone by each of their own next mornings, six hours apart, with nobody deleting it. The string `Event passed` never appears again.

## Assumptions

- The icon set stays the three already declared at `EventCountdown.tsx:14`, `type IconType = 'ring' | 'plane' | 'calendar'`.
- "Auto-hide" means filtered out of the Home render, not deleted from the table, so a mistyped year can be corrected rather than lost.
- The hamburger lives in a new fixed affordance or a new header on Home. `App.tsx:524` `<main id="main-content">` sits directly under the status indicators with no top bar of any kind, so there is nothing existing to hang it on.
- Events are ordered soonest-first on Home.

## Open Questions

- ~~**Live partner updates.**~~ **Resolved.** Sallvain chose a different design from the one assessed in `integration-points.md` section 8: an unseen-count badge plus a tappable live toast, where the broadcast carries a signal and the tap refetches. That is now its own spec, `../spec-partner-activity/`, and events is one of the three features it covers. CAP-1 stays written to reload-based behaviour here; the badge and toast arrive with that spec, not this one.
- ~~**Safe-area inset.**~~ **Resolved.** Sallvain chose the fix: story 4 adds `viewport-fit=cover` to the `index.html:6` viewport meta and puts the real `.safe-top`/`.safe-bottom` classes (`src/index.css:133-139`) on the new chrome. The undefined `safe-area-bottom` class dies with the bar. Detail in `navigation.md`.
- ~~**`aria-current`.**~~ **Resolved.** Sallvain chose to add it: the tray marks the active destination with `aria-current`, replacing the old bar's colour-only signalling.
