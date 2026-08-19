---
title: 'Manage events in Settings'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: '47f28b8f479d0edac01bb214e26533979f4391b4'
baseline_revision: '47f28b8f479d0edac01bb214e26533979f4391b4'
context:
  - '{project-root}/_bmad-output/specs/spec-dynamic-events/integration-points.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A save that fails while the first load is still in flight makes the list
      paint a false "we couldn't load your events" notice after that load
      succeeds.
    evidence: |-
      The load-failure flag is read once from the shared `eventsError` key in
      loadEvents()'s .finally, and `addEvent` writes its own failure into that
      same key (eventsSlice.ts, addEvent catch tail). The header Add button
      renders before the load settles, so a save can fail inside the load's
      flight window and leave the key non-null when the successful load reads
      it. The list itself still renders correctly; only the notice is wrong.
      The root cause is that one `eventsError` key serves loads and all three
      writes with no per-call token, which lives in eventsSlice.ts — a file
      this story's Never list forbids editing.
    location: >-
      src/components/Settings/EventsSettings.tsx (load effect) + src/stores/slices/eventsSlice.ts
    severity: low
  - summary: >-
      Once the Settings events load fails, nothing re-fires it: the notice and
      the empty list persist until the user reloads the page.
    evidence: |-
      The mount effect's deps are [userId, loadEvents]. App.tsx's otherwise
      identical Home effect deliberately adds isOnline, commented "coming back
      online re-fires the load, so the offline error card clears without
      leaving Home." There is no retry control, and clearEventsError (exported
      from eventsSlice.ts) still has zero production callers. This story's
      intent-contract specifies "A mount effect keyed on `userId`", so closing
      the gap means widening what the intent asked for.
    location: >-
      src/components/Settings/EventsSettings.tsx (load effect deps)
    severity: low
  - summary: >-
      The three primary buttons this section adds are white text on
      `bg-pink-500`, which measures 3.58:1 against the 4.5:1 WCAG AA
      requirement.
    evidence: |-
      Measured twice and independently. The parked axe run at
      `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts`
      reports impact "serious" on `events-settings-add` and `events-form-submit`
      -- "insufficient color contrast of 3.58 (foreground color: #ffffff,
      background color: #f6339a ... Expected contrast ratio of 4.5:1". Computing
      the relative luminance of #f6339a by hand gives (1.0 + 0.05) / (0.24294 +
      0.05) = 3.58, the same number.

      A third instance nobody scanned carries the identical class string:
      `events-settings-empty-add` at EventsSettings.tsx:296. The axe scaffold
      seeds a row before every scan, so the empty state never renders and that
      button was never measured -- a developer following the checklist, which
      lists only :255 and :813, ships two fixed buttons and one unfixed one.

      The root cause is not this story's markup. `grep -rn "bg-pink-500" src/ |
      grep -c "text-white"` is 17, across 9 files, including the sibling
      AnniversarySettings rendered directly below this section in the same
      Settings view. Repainting only these three would leave two visibly
      different primary buttons side by side, and repainting the house style is
      outside the five-file fence this story's own acceptance criterion pins.

      The ATDD checklist states both that the failing elements are "inside story
      5's own component" and, two sentences later, that the fix is "outside the
      story-5 diff". The first is right and the second is not; the operative
      reason to defer is the shared token, not the file boundary.
    location: >-
      src/components/Settings/EventsSettings.tsx:255, :296, :813 (root cause: the shared bg-pink-500 button style, 17 sites in 9 files)
    severity: medium
  - summary: >-
      A write that lands while the first load is still in flight is discarded by
      that load, so a saved edit or a new event silently reverts on screen.
    evidence: |-
      `loadEvents` replaces the list wholesale on resolution --
      `set({ events, eventsIsLoading: false })` at eventsSlice.ts, guarded only
      by `latestLoadId` against other loads, never against writes. `addEvent` /
      `editEvent` mutate `events` in place the moment their own request
      resolves. So a write that resolves inside the load's flight window is
      overwritten by the server list the load captured before that write landed.

      The reachable form is not the empty-list one. `slot` is `'list'` whenever
      `events.length > 0`, and `events` survives view changes -- so a user who
      loads Home (App's effect populates `events`) and then opens Settings sees
      a fully rendered list with Edit and Delete live while EventsSettings' own
      mount load is still outstanding. An edit accepted in that window reverts
      visually when the load resolves, and the row is durably changed on the
      server, so nothing on screen says a write succeeded.

      This is the success-path twin of DW-26, and it has the same root cause and
      the same blocker: reconciling a write against an in-flight load lives in
      eventsSlice.ts, which this story's Never list forbids editing and which
      "Block If" names explicitly. Gating the header Add button on
      `firstLoadSettled` was considered and rejected -- it closes only the
      empty-list variant and leaves the reachable Edit/Delete one open, which
      would read as a fix.
    location: >-
      src/stores/slices/eventsSlice.ts (loadEvents resolution) exposed by src/components/Settings/EventsSettings.tsx
    severity: medium
  - summary: >-
      Roughly 4,000 lines of measured tests shipped in this change set are
      matched by no test runner and execute nowhere.
    evidence: |-
      `_bmad-output/test-artifacts/` holds 6 ATDD scaffolds and 3 automation
      files. `vitest.config.ts` includes only `tests/**` and `src/**`, and
      Playwright's three projects set testDir to `./tests/e2e`, `./tests/api`
      and `./tests/integration`, so nothing reaches them. Both TEA summaries say
      so plainly ("Nothing here is active until it is moved") and record the
      `git mv` commands that would activate them, along with measurements taken
      by copying each file to its target, running it, and removing it again.

      Two of the three defects this review confirmed were first surfaced by that
      parked tree, so the coverage is real rather than speculative. Activation
      is a deliberate operator decision, not a patch: `automation-summary.md`
      measures typecheck at 6 TS2883 errors without the generated files and 1
      with them, so acceptance criterion 3 -- which pins the literal number six
      -- becomes false the moment the activation happens, and the one-line fix
      the summary proposes at `tests/support/merged-fixtures.ts:53` should land
      with or before it.
    location: >-
      _bmad-output/test-artifacts/ (9 test files, 23 tests)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 2 shipped `addEvent` / `editEvent` / `removeEvent` on the store and nothing calls them — `grep -rn "addEvent\|editEvent\|removeEvent" src/` returns `eventsSlice.ts` plus `addEventListener` noise and no UI caller. Story 3 renders events on Home and story 4 made Settings reachable, so the couple can now *see* events they still have no way to create, correct, or remove. CAP-5 is half-built and CAP-1, CAP-2, CAP-7 have no entry point at all.

**Approach:** One new `EventsSettings` component mounted as a Settings section — `AnniversarySettings`'s layout over the events slice's data — with a full list (past events included), a modal add/edit form, a delete confirmation, an empty state that carries the add affordance, and the save failure surfaced from the write's own returned result.

## Boundaries & Constraints

**Always:**
- Every read and write goes through `useAppStore`: `events`, `eventsIsLoading`, `userId`, `loadEvents`, `addEvent`, `editEvent`, `removeEvent`. Never import `eventsService` into a component, and never route events through `settings.relationship`.
- **`EventsSettings` triggers its own load.** `loadEvents()` has exactly one production call site, `App.tsx:432`, gated at `:429` by `if (!authUserId || currentView !== 'home') return;`. A `/settings` deep link or a reload on Settings therefore never fetches, and `events` is not persisted — so the list would render permanently empty. A mount effect keyed on `userId` fixes it. Overlapping with Home's effect is safe: `eventsSlice.ts:87,112,125` carries a monotonic `latestLoadId` so a superseded load abandons its own resolution.
- **The list shows every event, past included, unfiltered.** CAP-3's auto-hide is Home's rule alone. `SPEC.md` Assumptions: *"'Auto-hide' means filtered out of the Home render, not deleted from the table, so a mistyped year can be corrected rather than lost"* — Settings is where that correction happens, so a hidden past event must still be reachable here.
- **Edit and Delete render only when `event.userId === userId` (CAP-2).** A partner's event is listed and read-only. RLS is the real gate (story 1 measured a partner's write as a silent zero-row filter); this is the affordance that stops the user reaching a failure they cannot fix.
- **The save error comes from the write's own returned `EventWriteResult`, never from `eventsError`.** `eventsSlice.ts:19-22` states the contract: *"a caller that awaited its own write gets the message for THAT write rather than whatever the shared key happens to hold."* Render it inside the form with `role="alert"` and keep the form open (CAP-7).
- **Load failure is tracked in local component state**, using the `App.tsx:436` idiom — read `useAppStore.getState().eventsError !== null` once after the load settles. The shared key cannot distinguish a failed load from a failed save, and a save failure must not paint a list-level banner.
- **Dates.** The `<input type="date">` value goes to `addEvent` / `editEvent` as the bare `"YYYY-MM-DD"` string, untouched. Display uses `formatDateLong(event.date)` over the local-midnight `Date` the service already built. Pre-filling the edit form uses `formatDateISO(event.date)` (`dateUtils.ts:134-139`, local components). Never `new Date(<date string>)` and never `toISOString().split('T')[0]` — `AnniversarySettings.tsx:103` is the live off-by-one this feature exists to avoid (`data-model.md`).
- **Client validation before any request**, mirroring the CHECK constraints at `20260818000002_create_events_table.sql:19,21,22`: label required after `.trim()` and at most 100 characters; description at most 500; date required and matching `/^\d{4}-\d{2}-\d{2}$/`; icon one of `'ring' | 'plane' | 'calendar'`. Without these an over-length or blank label reaches the user as raw Postgres constraint text — `char_length('') = 0` passes the DB check, so a blank label is admitted server-side.
- **Submit and confirm-delete are disabled while their write is in flight.** `public.events` has no unique constraint and no idempotency key, so a disabled control is the only double-submit guard available.
- **Both modals are focus-trapped**, using `useFocusTrap(panelRef, true, { onEscape, initialFocusRef })` with the identity-stable Escape shape at `NoteRemoveConfirmation.tsx:58-67` — latest-ref plus a `useCallback` with an empty dep array, because `useFocusTrap.ts:80` lists `onEscape` in its deps and re-focuses on every run. Markup is `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the heading.
- **The delete dialog needs a surviving fallback focus target.** A successful delete removes the row that held the Delete button, and `useFocusTrap.ts:92-94` records that restore is skipped when the opener is no longer connected. `NoteRemoveConfirmation.tsx:32,118-123` is the `fallbackFocusRef` shape to copy.
- **Every interactive element carries a `data-testid`, and row-scoped ids key on `event.id`.** `AnniversarySettings` has none at all, and a label-derived id is what DW-23 already records as fragile.
- **Validation is hand-rolled in the form**, matching `AnniversarySettings.tsx:223-278`, `DisplayNameSetup.tsx:43-49` and `LoginScreen.tsx:179`. No component in `src/` imports a Zod schema.

**Block If:**
- `eventsSlice` no longer exposes `addEvent` / `editEvent` / `removeEvent` returning `EventWriteResult`, or `eventsService` is absent — story 2's foundation would be missing, and this story writes no data layer of its own.
- `'settings'` is not registered at `navigationSlice.ts:25,58` or `Settings.tsx` is not rendered from `App.tsx:717` — story 4's foundation would be missing and the CRUD would have nowhere reachable to live.
- Meeting a requirement here would need a change inside `eventsService.ts` or `eventsSlice.ts`. Widening the data layer is story 2's contract, not this story's.

**Never:**
- No edit to `src/services/eventsService.ts` or `src/stores/slices/eventsSlice.ts`.
- No change to `App.tsx`'s Home events block, `EventCountdown.tsx` (its testid scheme included — DW-23 is ledger-owned), `relationshipDates.ts`, or `NavigationTray.tsx`.
- No realtime, no `supabase.channel()`, no broadcast, no IndexedDB mirror, no persistence — events stay Supabase-only and reload-based (`integration-points.md` §8 is an assessment, out of scope).
- No behavioural change to `AnniversarySettings.tsx` and no touching `settings.relationship.anniversaries`; copy its layout only.
- No migration, no pgTAP file, no hand-edit of `src/types/database.types.ts`.
- No new Zod schema, no `@/` alias inside `src/`, no react-router.
- No edit to `_bmad-output/implementation-artifacts/deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add valid event | Label, future date, online | Form closes; row appears in date order; the card is on Home with no reload | No error expected |
| Blank label | Label `'   '` | Field error under Label; no request issued | Inline, form stays open |
| Over-length label | Label of 101 characters | Field error naming the 100-character limit; no request issued | Inline, form stays open |
| Save rejected | `addEvent` resolves `{ success: false, error }` | Form stays open, list unchanged, that exact message rendered | `role="alert"` inside the form |
| Double submit | Second submit click while the first write is open | Submit disabled; exactly one create request | No error expected |
| Edit own event | Change the date on an own row | Row re-sorts into date order; Home's card follows | Failure behaves as "Save rejected" |
| Partner's event | `event.userId !== userId` | Row renders with label, date, description; no Edit and no Delete control | N/A |
| Delete confirmed | Own row, confirmation accepted | Row removed; focus lands on a surviving element | Failure keeps the row and shows the returned message |
| Past event | Event dated yesterday | Listed here and editable, though absent from Home | N/A |
| Zero events, settled | `events: []`, first load finished | Empty state carrying an add control, not a bare heading | N/A |
| First load in flight | `events: []`, load unresolved | Loading indicator, never the empty state | N/A |
| Load failed | `loadEvents` left `eventsError` set | List area explains the load failed | Local flag, not the shared key |
| Deep link to Settings | `GET /settings`, or reload on it | The list loads from its own effect | Same as "Load failed" if it fails |

</intent-contract>

## Code Map

**The surface being extended**
- `src/components/Settings/Settings.tsx:155-161` — the Anniversary `<section className="settings-section">` block; the Events section copies its shape. `:51` `data-testid="settings-view"`, `:106` `settings-sign-out`, `:159` `<AnniversarySettings />`. Section classes are defined at `Settings.css:50,57,67`; inside a section, children are Tailwind (`AnniversarySettings` is entirely Tailwind).
- `src/components/Settings/AnniversarySettings.tsx` — **layout model, not data or date model.** Header + Add button `:59-76`; empty state `:80-86` (note: it carries *no* add affordance, which CAP-10 requires here); list rows `:88-131` with per-row Edit `:113-119` and Delete `:120-126`; delete-confirmation modal `:164-203`; form modal `:280-398` with overlay class at `:285`; hand-rolled validation `:223-278`. `:103` `formatDateLong(new Date(anniversary.date))` is the UTC off-by-one **not** to copy, and `:141-158` routes saves into the persisted `settings` blob, which events must not.

**The data layer (read-only for this story)**
- `src/stores/slices/eventsSlice.ts:44-57` — the slice interface. `:39` `EventWriteResult`, `:42` `NewEventInput = Omit<EventCreateInput, 'userId'>` (the creator comes from the store). `:147` `addEvent`, `:179` `editEvent`, `:212` `removeEvent`, `:242` `clearEventsError`. `:19-22` the contract that a caller uses its own returned message. `:87,112,125` the `latestLoadId` overlap guard. `:163,196,227` show the list is maintained in place on success, so no refetch is needed after a write.
- `src/services/eventsService.ts:67-76` — `CoupleEvent` (`id`, `userId`, `label`, `date: Date`, `createdAt: Date`, `description: string | null`, `icon: EventIcon`); `:61` `EventIcon`; `:83-89` `EventCreateInput` with `eventDate` documented as *"the `<input type="date">` value verbatim"*; `:92-97` `EventUpdateInput`, where `undefined` means "not written".
- Error strings the UI will surface verbatim: `:308` `'You are offline. Events need a connection to save.'`, `:413` `'Event not found or not yours to edit'`, `:466` `'Event not found or not yours to delete'`.
- `src/stores/slices/authSlice.ts:136` `userId: string | null`; `:124-130` the three events keys already inside `signedOutState()` — this story adds no account-scoped state, so nothing new belongs there.

**Where the load gap is**
- `src/App.tsx:428-447` — the only `loadEvents()` effect; `:429` the `currentView !== 'home'` bail; `:436` the `useAppStore.getState().eventsError !== null` idiom this story reuses locally.
- `src/App.tsx:53-55` Settings is `lazy`-loaded; `:716-717` the `currentView === 'settings'` branch, inside `ViewErrorBoundary` (`:701`) and `Suspense` (`:702`).

**Accessibility reuse**
- `src/hooks/useFocusTrap.ts:6-25` signature and options; `:80` the `onEscape` dep; `:92-104` restore-on-close and the `isConnected` guard. Exported from the barrel at `src/hooks/index.ts:7`.
- `src/components/love-notes/NoteRemoveConfirmation.tsx:32,39` the `fallbackFocusRef` prop; `:58-67` latest-ref + empty-dep `useCallback`; `:73-76` the trap call; `:118-123` the fallback effect; `:103-108` warns that swapping the declaration order of the trap call and the fallback effect breaks it. `:173-176` the dialog markup; `:203` the `role="alert"` error paragraph.
- `src/components/Navigation/NavigationTray.tsx:189-192,201,224` — recent testid and dialog conventions (`role="dialog"`, `aria-modal`, kebab-case `component-element` ids).

**Date helpers**
- `src/utils/dateUtils.ts:134-139` `formatDateISO(date: Date): string` from local components; `:144-150` `formatDateLong`; `:126-128` the `toISOString()` trap comment.

**Constraints being mirrored client-side**
- `supabase/migrations/20260818000002_create_events_table.sql:19` `label text not null check (char_length(label) <= 100)`, `:21` `description text check (char_length(description) <= 500)`, `:22` `icon text not null default 'calendar' check (icon in ('ring', 'plane', 'calendar'))`.

**Test conventions**
- No test exists for `src/components/Settings/` today — this is the first (`find` over the repo returns nothing under that path).
- Colocated pair convention: `src/components/Navigation/__tests__/NavigationTray.test.tsx` (behaviour) + `NavigationTray.focus.test.tsx` (focus). `NavigationTray.test.tsx:13-17` the import block; `:19-29` the framer-motion mock — **mock the `m` export**, since `AnniversarySettings.tsx:12` and this component import `{ AnimatePresence, m as motion }`. `NavigationTray.focus.test.tsx:32-42` records that `fireEvent.click` does not focus like a pointer, so the opener must be focused explicitly first.
- Store mocking in component tests is always `vi.mock('../../../stores/useAppStore', ...)`; the bare-object form at `src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx:29-32` (with `vi.hoisted`) fits a component that destructures `useAppStore()` without a selector.
- `src/components/love-notes/__tests__/NoteRemoval.test.tsx:417-421,438-445` — the house shape for "awaited write failed": `getByRole('alert')` with the exact service message, plus an explicit assertion that the dialog did not close.
- `vitest.config.ts` includes `src/**/*.test.tsx`, and pins `env: { TZ: 'America/New_York' }` — build expected dates as `new Date(y, m - 1, d)`, never from a string.
- E2E: `tests/e2e/settings/` does not exist yet; the `chromium` project is `testDir: './tests/e2e'` (`playwright.config.ts:138-144`), so a new subdirectory is picked up automatically. Import `{ test, expect }` from `tests/support/merged-fixtures.ts`, and `navigateTo` from `tests/support/helpers/navigation.ts:50` by its **deep path** — `../../support/helpers` resolves to the scripture-helpers *file*, not the barrel.
- `tests/e2e/home/events.spec.ts:34-49` `resolveAppUserId`, `:52-66` `resolveOwnPair`, `:93-105` `clearPairEvents` (delete by `user_id`), `:107-117` the throwing `afterEach`, `:120-125` the `lastWelcomeView` splash dismissal. Cards on Home are `event-countdown-<slugified-label>`.
- Failed-write E2E idiom: `tests/e2e/scripture/scripture-reflection-2.2-errors.spec.ts:42-51` `interceptNetworkCall({ method, url, fulfillResponse: { status: 500, ... } })`, with the describe-level `{ annotation: [{ type: 'skipNetworkMonitoring' }] }` at `:14-16` — without that annotation the network monitor fails the test on the injected 5xx.
- `tests/e2e/navigation/tray.spec.ts:87-105` already covers reaching Settings and surviving a reload; do not duplicate it.

## Tasks & Acceptance

**Execution:**
- `src/components/Settings/EventsSettings.tsx` (new) — the whole feature: a mount effect that loads events for the signed-in user and records whether that load failed; the unfiltered list with per-row Edit/Delete shown only to the creator; the empty, loading and load-error states; a focus-trapped add/edit form modal over four fields — label (text, required), date (`<input type="date">`, required), description (textarea, optional) and icon (a choice among `'ring' | 'plane' | 'calendar'`, defaulting to `calendar`, which `EventCountdown.tsx:32-36` maps to `Gem`, `Plane` and `Calendar`) — with hand-rolled validation and the returned save message rendered as an alert; a focus-trapped delete confirmation with a fallback focus target; `data-testid` on every control, row ids keyed on `event.id`. One component so the modals, their focus wiring and the list state that opens them stay in one place — CAP-1, CAP-2, CAP-7, CAP-10's Settings half.
- `src/components/Settings/Settings.tsx` — add an `Events` section between Account and Anniversary, in the shape of the existing sections. The couple-shared feature reads above the device-local one, and this is the mount point CAP-5 needs.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` (new) — the behavioural rows of the I/O matrix against a mocked store: list contents and order, a partner row rendering no Edit or Delete, blank and over-length label rejection with no write issued, a rejected save keeping the form open with its exact message, submit disabled during a write, delete confirm and cancel, and the empty / loading / load-error states. The first test in this directory, so it also fixes the conventions.
- `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` (new) — the focus half, following `NavigationTray.focus.test.tsx`: focus moves into each modal on open, Escape closes it, focus returns to the control that opened it, Tab wraps inside the panel, and a successful delete lands focus on a surviving element rather than nowhere. The house standard is a dedicated focus test per dialog.
- `tests/e2e/settings/events-crud.spec.ts` (new) — the real round trip against the local stack: reach Settings through the tray, add an event, see it in the list and then on Home, edit its label and date, delete it, and confirm the empty state carries an add control. Plus one failed-save case that fulfils the events POST with a 500 and asserts the visible message with the form still open, under the `skipNetworkMonitoring` annotation. Clean up every row for the worker's own account in `afterEach`, following `clearPairEvents`; never use a label that could collide with the fixed `event-countdown-wedding` testid.

**Acceptance Criteria:**
- Given a signed-in account on `/settings` reached by direct navigation rather than through Home, when the view mounts, then the events list loads and settles without the user visiting Home first.
- Given an event added from Settings, when the user navigates to Home, then its card is present with the same label, date and description, and no reload was needed.
- Given `npm run typecheck` and `npm run lint`, when both run, then lint is clean and typecheck emits only the six pre-existing `TS2883` errors at `tests/support/merged-fixtures.ts(53,14)`.
- Given `npm run test:unit`, when it runs, then every suite passes including the two new `EventsSettings` suites, and the existing 1238-test baseline is unbroken.
- Given `supabase start` and the local stack, when `npx playwright test tests/e2e/ --project=chromium` runs, then every spec passes, including the new Settings spec and the unchanged `tests/e2e/home/events.spec.ts`.
- Given `git diff --name-only` outside `_bmad-output/`, when inspected, then it lists only the five files above — nothing under `supabase/`, `src/types/`, `src/services/`, `src/stores/`, or `src/App.tsx`.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 0, medium 4, low 9)
- defer: 2: (high 0, medium 0, low 2)
- dismissed:
  - Reopening the edit form during the modal's exit animation reuses the stale instance, writing the previous row's values onto the newly opened event — measured in Chromium: reproducible only by dispatching both clicks in one task via page.evaluate. The exiting overlay is `position:fixed; inset:0; pointer-events:auto; z-index:50` and useFocusTrap is still armed for the whole window (focus measured inside the panel immediately after Escape), so neither pointer nor keyboard can reach another row's Edit before the exit completes and state re-initialises. Through the UI the correct row's values are shown.
  - A write whose promise never settles locks the modal with "no in-page exit; only a reload frees the user" — refuted: `popstate` is handled at src/App.tsx:210, so browser Back leaves /settings and unmounts the dialog. The stated consequence does not hold. (Raised twice, once for each dialog; both dismissed on the same measurement.)
  - ISO_DATE_PATTERN admits impossible calendar dates such as 2026-02-31 — the only producer of that value is `<input type="date">`, which cannot emit an unparseable value; the branch is unreachable through the rendered control.
  - The edit form loses its identity if the row disappears while it is open, re-titling itself "Add Event" while still routing through editEvent — nothing mutates `events` while the form is open: there is no realtime and no polling on this surface, and the load effect's deps are stable for the life of the mount.
  - The `useAppStore.getState()` eslint suppression is the only one in src/ and contradicts the rule's own message — the rule prescribes a subscribed useShallow selector, which is exactly what the intent-contract forbids ("a save failure must not paint a list-level banner"). The suppression is the only way to satisfy the intent, and it is commented.
  - Past events sort to the top of the list with no "passed" badge, grouping or dimming — the intent requires the list to be unfiltered and is silent on ordering and marking; there is no defect against the captured intent.
  - The bare `useAppStore()` subscription re-renders the section on every unrelated store write — this is the prevailing convention at 15 sites, including the sibling AnniversarySettings.tsx:21; no consequence specific to this change.
  - Re-deriving five types from AppState instead of importing NewEventInput / EventWriteResult from eventsSlice.ts costs readable names — a deliberate, documented choice that keeps the service module ungreppable from components; no behavioural consequence.
  - The main E2E covers five separable behaviours in one test, so a mid-test failure leaves later steps unexercised — the add→Home→edit→delete→empty round trip is the single behaviour the test exists to prove; splitting it would re-seed state the sequence deliberately carries forward.
  - The Home assertion exercises a re-fetch rather than store propagation, because App's Home effect lists currentView in its deps — the matrix row reads "the card is on Home with no reload", and no reload occurs; the row is satisfied as written.
  - ~60 lines of test scaffolding are duplicated between the two new suites — the spec's own acceptance criterion pins the diff to five files, and the house pattern already duplicates this scaffolding (NavigationTray.test.tsx / NavigationTray.focus.test.tsx); extracting a helper would add a sixth file against an explicit acceptance criterion.
- addressed_findings:
  - `[medium]` `[patch]` Header Add button had no accessible name below the `sm` breakpoint, where the "Add Event" span is `display:none` — added aria-label and marked the icon aria-hidden.
  - `[medium]` `[patch]` Field-level validation errors were neither announced nor associated — each error paragraph now carries a stable id and `role="alert"`, and each input points at it with aria-describedby.
  - `[medium]` `[patch]` The sr-only icon radios had no visible focus indicator — the radio is now a preceding sibling of its label and the label carries peer-focus-visible ring utilities (emitted CSS verified in a production build).
  - `[medium]` `[patch]` The two fallback-focus tests asserted a premise false inside the test: the frozen mock never removed the opener, so useFocusTrap's own restore fired and the production `isConnected === false` branch went unexercised, and no test put two events on screen across a write. Both suites now use a subscribable mock whose writes mutate `events`, and the tests assert `opener.isConnected` explicitly on both sides.
  - `[low]` `[patch]` "Events" rendered twice, as two sibling h2s — the inner heading is now "Event Countdowns" under the section title, matching the AnniversarySettings precedent.
  - `[low]` `[patch]` The visible icon control carried no data-testid (it sat on the sr-only radio), forcing the E2E onto a `label[for=...]` CSS selector — added `events-form-icon-option-<value>` and switched the E2E to it.
  - `[low]` `[patch]` `ListSlot` declared an `'error'` member with no render branch, so a failed first load with zero events left the list area silent — the notice is now mounted inside the list area for that case and above a surviving list otherwise, as a single element with one testid.
  - `[low]` `[patch]` Field errors persisted until the next submit — editing a field now clears that field's error, its aria-invalid and its aria-describedby.
  - `[low]` `[patch]` Ordering after a write was pinned nowhere — added cases for an add landing in the middle of the list and an edit re-sorting a row past another.
  - `[low]` `[patch]` The banner-over-a-surviving-list precedence had no test; reordering the slot ternary blanked the list area with the suite still green — added a case with non-empty events and a failing mount load.
  - `[low]` `[patch]` The form's post-failure focus return to Save had no test while its delete-dialog twin did — added the mirror.
  - `[low]` `[patch]` The mid-write Escape and backdrop suppression guards were exercised nowhere — added a dismissal-guards describe covering both dialogs, idle and in-flight.
  - `[low]` `[patch]` Two E2E defects: the past-event absence assertion fired before the load could settle and passed vacuously, and the "30 days" expectation was computed from Node's clock while the assertion read the browser's, flaking across local midnight. The absence is now grounded behind a witness card from the same load, and the day count is computed and compared inside a single browser-side sample.

### 2026-08-19 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 1, low 3)
- defer: 3: (high 0, medium 2, low 1)
- dismissed:
  - `deferred-work.md` is edited in this change set against the story's Never list — the DW-26 / DW-27 append was made by the orchestrator before this session opened; both TEA result files record it as "already present when this session started". The Never clause binds this story's implementation, which never touched the file.
  - `test-design-epic-5.md` quotes "Story residual risk, lines 309-311", which does not exist — measured: `git show HEAD:…/5-manage-events-in-settings.md | wc -l` is 314, and lines 309-311 read the quoted text verbatim. The citation resolves; the reviewer measured against the working copy after this run's predecessor stripped the 83-line Auto Run Result section.
  - Three artifacts record the story as 314 lines and `status: 'done'` while it is 231 and `in-review` — same measurement: at HEAD the file is exactly 314 lines with `status: 'done'`, so all three recorded it accurately. 231 is the stripped working copy and `in-review` is the status this pass set at its own start.
  - `review_loop_iteration: 0` contradicts the Review Triage Log — the counter bounds bad_spec repair loopbacks, not completed passes, and step-01 resets it to 0 when re-reviewing a `done` spec. No bad_spec loopback has ever run on this story, so 0 is correct.
  - The `## Spec Change Log` heading is empty — it records spec amendments made during a bad_spec loopback. None has occurred, so empty is its correct state; the 13 earlier patches are recorded in this log, where they belong.
  - The `useAppStore.getState()` suppression is not the only one in `src/`, so the earlier dismissal's premise is false — measured: `grep -rn "no-restricted-properties" src/ | grep -c "eslint-disable"` is 1. The claim was about that suppression and it holds; the file's other `eslint-disable` comments suppress a different rule.
  - Two inert `eslint-disable-next-line react-hooks/exhaustive-deps` comments ship in production code — refuted by measurement: deleting both makes eslint report `react-hooks/exhaustive-deps` at `EventsSettings.tsx:469:42` and `:878:41`, the ref-access sites. The rule reports ref-in-cleanup at the access, not only at the dependency array, so both suppressions are load-bearing.
  - The section heading hierarchy skips a level — document order is h1 "Settings" → h2 "Events" → h2 "Event Countdowns" → h3 row labels. No level is skipped, and `AnniversarySettings.tsx:61` is the identical h2-under-h2 shape this section was told to copy.
  - The label and description inputs carry no `maxLength` — the I/O matrix specifies exactly the shipped behaviour ("Over-length label → Field error naming the 100-character limit; no request issued"). A submit-time field error is the captured requirement, not a departure from it.
  - The unreachable icon validation branch and its testid should go — the branch implements an enumerated Always clause ("icon one of `'ring' | 'plane' | 'calendar'`"); the stated consequence is a hypothetical future test, which is not a consequence that occurs.
  - "Added by your partner" (`event-partner-note-<id>`) is asserted by no test — the matrix row it sits on (a partner row renders label, date and description and no Edit or Delete) is asserted; the note itself is beyond the captured intent, so no requirement goes unpinned by its absence.
  - A stale save error stays on screen after the user edits a field — `role="alert"` re-announces only on content change, and the message accurately reports the last submitted attempt. The intent prescribes keeping it with the form open and is silent on clearing it.
  - The automate run's citations into `EventsSettings.tsx` are off by 5-8 lines — confirmed (180 vs `:172`, 549 vs `:544`, 142 vs `:141`), but every cited construct is unique in the file and greppable, so no reader is directed to the wrong code.
  - "33 `data-testid` attributes" is 32 — confirmed 32. The measurement was quoted to show no production change was needed, and 32 supports that conclusion identically.
  - Activating the parked automation files invalidates acceptance criterion 3 — AC3 is evaluated against this change set, where typecheck emits exactly the six `TS2883` errors. The claim is about a future activation, and its fix would edit this spec's acceptance criteria. The substance is carried in the third deferred item instead.
  - The ledger and the risk register grade DW-27 differently — `severity` in the ledger is user impact; the register's `P × I` is test-planning priority. Different scales, so a difference in number is not a contradiction, and the ledger is orchestrator-owned and outside this run's reach.
  - `DE.5-API-*` is used while the id convention list omits `API` — an artifact-documentation omission already recorded as future work in three places. The tests run and report under those ids, so no consumer is affected.
  - The offline scaffold's header and body disagree on whether `setOffline` was verified — the scaffold is parked and reached by no runner, so nothing consumes the stale note; if the file is ever activated, its own measured header is the operative record.
  - `futureDate(-14)` is used to build a past date — the helper is documented as "a `YYYY-MM-DD` calendar date N days out" and a negative offset is the same arithmetic. The call site binds the result to `pastDate`, so the intent is recorded where it is read.
  - The diff introduces a Zod schema against the Never list — the schema is `TEST-LOCAL` inside `_bmad-output/`, and the Never's Always twin scopes the prohibition to `src/` ("No component in `src/` imports a Zod schema"). No `src/` file imports Zod; the summary's suggestion to move it into `src/validation/schemas.ts` was not acted on.
- addressed_findings:
  - `[medium]` `[patch]` The only test pinning the intent's "a save failure must not paint a list-level banner" rule wrote to the shared key outside `act()`, so React never re-rendered before the assertion. Measured: subscribing the banner straight to `eventsError` passed 45/45. The write is now flushed, and a comment names the post-settle boundary the test actually covers.
  - `[low]` `[patch]` Both dialogs park focus on the panel before their control is disabled, and nothing observed it. Measured: deleting both `panelRef.current?.focus()` calls left 45/45 green. The two in-flight tests now assert the panel itself is `document.activeElement` — the weaker "somewhere inside the dialog" form still passes with the parking deleted, so it was rejected.
  - `[low]` `[patch]` The Add button's accessible name and both dialogs' `role`/`aria-modal`/`aria-labelledby` were asserted nowhere. Measured: deleting `aria-label="Add event"` and both `aria-modal` attributes left 45/45 green. Added three cases; the mutation now fails three of them.
  - `[low]` `[patch]` The edit form's date pre-fill could not tell `formatDateISO` apart from the forbidden `toISOString().split('T')[0]`. Measured: the forbidden idiom passed 45/45, because under the pinned `TZ=America/New_York` a local-midnight fixture has the same UTC day. Added a case whose fixture is 20:00 local, the only shape that makes the two disagree west of UTC.

## Design Notes

**Why the component loads its own events rather than widening App's effect.** App's effect is deliberately Home-scoped — story 3's Always rule ties it to `currentView === 'home'`, and its companion state (`eventsSettledForUserId`, `eventsLoadFailed`, the retirement tick) exists to drive Home's four-way slot decision. Widening the gate would make App track settled-state for two views with different empty-state semantics. A mount effect inside `EventsSettings` keeps the lifecycle next to the list it feeds, and the slice's `latestLoadId` guard already makes the overlap safe. The cost is one extra fetch when a user goes Home → Settings; at a couple's data scale that is the cheaper side of the trade.

**Why the save message comes back from the call and not from the store.** `eventsError` is one shared key written by loads and by all three writes. A form reading it can render an error from a *different* action — a background load failure, say — as though the user's own save had failed. The slice was built to avoid exactly this (`eventsSlice.ts:19-22`), so the form awaits its own result:

```tsx
const result = await addEvent({ label, eventDate, description, icon });
if (!result.success) {
  setSaveError(result.error);   // stays open, alert renders, list untouched
  return;
}
onClose();
```

**Why partner rows lose their controls rather than showing a disabled button.** RLS filters a non-creator's UPDATE and DELETE to zero rows, which `eventsService.ts:413,466` turns into `'Event not found or not yours to edit'`. Rendering a control that can only ever produce that message is a worse experience than not offering it — and the same rule keeps the list honest about who owns what.

**Why past events stay in this list.** They are hidden on Home by design, so Settings is the only place a mistyped year can be seen and corrected. Filtering here would make a wrong-year event both invisible and uneditable — recoverable only by an admin.

## Verification

**Commands:**
- `npm run typecheck` — expected: only the six pre-existing `TS2883` errors at `tests/support/merged-fixtures.ts(53,14)`, reproduced before and after the change.
- `npm run lint` — expected: clean over `src tests scripts`.
- `npm run test:unit` — expected: all suites pass; the two new `EventsSettings` suites present and running.
- `supabase start`, then `npx playwright test tests/e2e/settings/ tests/e2e/home/events.spec.ts --project=chromium` — expected: the new spec passes and the Home spec is unchanged and still passing.
- `npx playwright test tests/e2e/ --project=chromium` — expected: all pass; run the whole directory because `scripture-overview.spec.ts` is untagged and neither `test:p0` nor `test:p1` reaches it.
- `grep -rn "eventsService" src/components/` — expected: no hits; the UI reaches events only through the store.
- `git diff --name-only` — expected: the five files in Execution and nothing else outside `_bmad-output/`.

**Manual checks (if no CLI):**
- On a narrow viewport, open Settings, add an event, and confirm the form closes and the row appears in date order; reopen it on the row's Edit and confirm the date input is pre-filled with the same calendar day that the list shows.
- With the tray open on Settings, Tab through the add form and confirm focus never leaves the panel; press Escape and confirm focus lands back on the Add button.


## Auto Run Result

Status: blocked

Blocking condition: `no subagents` — two of the four mandatory review layers could not be
run, so the review pass never reached classification.

### What happened

This run routed straight to the review step (the spec was `in-review` with
`followup_review_recommended: true`). The diff since `47f28b8f` was staged as required —
8,835 lines across 23 files, untracked included — and all four layers were launched in one
message, none skipped.

Two layers reported:

- **blind-hunter** — 19 findings, mostly about the parked `_bmad-output/` test tree and the
  four TEA artifacts measuring a superseded 851-line / 34-test version of
  `EventsSettings.test.tsx` (the shipped file is 923 lines / 38 tests, so the real total is
  49, not 45).
- **intent-alignment** — a surface-mismatch audit: the diff implements the fence reading of
  acceptance criterion 6 plus the literal readings of the load-failure and mount-effect
  clauses, and three expectations stated at the component surface have their determining
  mechanism at surfaces the story fenced off.

Two layers produced nothing:

- **edge-case-hunter** and **verification-gap** were each spawned twice (four spawns total)
  and pinged six times over roughly fifty minutes. Neither returned a single byte — not
  even a one-word acknowledgement.

### Why this is a subagent failure rather than a review outcome

A control probe was spawned with a trivial sixty-second task: read five lines of one file,
stat another, and report. It also returned nothing, including after a direct ping. Both
reviewer instruction files were read directly from this session and are intact and
well-formed (110 and 113 lines), and the diff file is readable — blind-hunter reviewed it
successfully. The failure is in the subagent channel for agents spawned after the first
batch, not in the review workload, the instruction files, or the staged diff.

### What was deliberately not done

No classification, no triage-log entry, no patches, and no deferrals. The review step
requires every layer to report before any finding is verified or triaged, and half the
layers are missing. Recording a verdict from two of four layers would present a partial
pass as a complete one, and the two silent layers are exactly the ones that trace unhandled
paths and verification gaps — the findings most likely to change the outcome. The two
completed layers' raw output is preserved in this run's transcript; nothing from them has
been acted on.

No production code, test, or artifact was modified by this run. The only change is this
file's `status` and this section.

### Verification performed

- `npx vitest run src/components/Settings/__tests__/` → 2 files, 49 tests, all passing.
  Recorded as the pre-existing baseline, not as evidence for any finding.
- The staged diff was confirmed at 8,835 lines / 23 files before the layers were launched;
  nothing was `git add`ed.

### Residual risk

The change set is unreviewed along two of its four axes. The previous pass set
`followup_review_recommended: true`, and that recommendation still stands unaddressed —
re-drive this story once subagents are healthy so the edge-case and verification-gap layers
actually run.

## Operator resolution — 2026-08-19

Review cycle 1 classified this story **done** (run `20260818-230216-c22b`,
`5-review-1`). The `blocked` status above it came from the optional follow-up
review, which could not run two of its four layers because background
subagents returned nothing (claude v2.1.235 channel failure, proven by the
reviewer's own control probe) — an environmental failure, not a review
outcome. The three story commits were merged to `feature/dynamic-events`
manually as `47bd3e61`; status restored to done accordingly.
