# Integration points

Companion to `SPEC.md`. The client-side pieces, ordered by build sequence: badge slice and UI first, then the toast host, then per-feature send wiring, then tests.

## 1. Store — `src/stores/slices/activitySlice.ts` (new)

State: one unseen count per feature, a loading flag, and nothing else — the watermark itself lives server-side and is not mirrored into state beyond the counts derived from it. Actions:

- `refreshUnseenCounts()` — reads `partner` from the store (`partnerSlice.ts:23`); if `null`, zeroes the counts and returns. Otherwise fires the four count queries from `data-model.md` and `set()`s the results. Async, so it captures `userId` first and re-checks `if (get().userId !== capturedUserId) return` after each `await` (`AGENTS.md:53`).
- `markFeatureSeen(feature)` — upserts `{ user_id, feature }` with `{ onConflict: 'user_id,feature' }` and zeroes that feature's count. **The client never sends `seen_at`** — a trigger stamps it with the server clock (`data-model.md`), because the counts compare it against server-written `created_at` values, and a device clock minutes fast would permanently swallow everything the partner creates in that window. Called on entering the destination view (SPEC assumption: glancing is seeing).

Registered in `useAppStore.ts:69-81` with the other eleven spreads. Every key added to `signedOutState()` (`authSlice.ts:54-124`) in the same commit — `signOutClearsAccountState.test.ts` enforces it. Nothing persisted: `partialize` (`useAppStore.ts:151-177`) stays `settings`, `isOnboarded`, `messageHistory`.

Refresh triggers, both already existing — but only one is gated:

- Mount: inside `App.tsx:256-264` — `if (!hasInitialized.current && session) { … initializeApp(); }` — session-guarded, StrictMode-safe via the ref.
- Reconnect: inside `handleOnline` at `App.tsx:308-319`, beside the existing `updateSyncStatus()` (`:313`) and `syncPendingMoods()` (`:316`). **This one is NOT session-gated**: the effect's deps are `[syncPendingMoods, updateSyncStatus]` (`:340`) and hooks run before the `!session` early return, so the `online` listener is live on the login screen. The gate therefore lives inside `refreshUnseenCounts()` itself — its no-`partner`/no-`userId` early return is what makes a signed-out firing a no-op, and that guard is a correctness requirement, not defensive style.

## 2. Badge UI

Where badges render is defined by `../spec-dynamic-events/navigation.md` ("The tray must carry a badge slot"): an aggregate indicator on the hamburger button while the tray is closed, per-destination counts inside it when open. This spec fills those slots.

Interactions' destination is the Partner view (`ViewType 'partner'`, `navigationSlice.ts:18`, path `:48`); its legacy in-tab badge coexists per the SPEC non-goal.

Idiom to copy is the existing badge at `PokeKissInterface.tsx:410-424`: `data-testid="notification-badge"`, `aria-label` of the form `` `${unviewedCount} unviewed interaction${unviewedCount === 1 ? '' : 's'}` `` (`:421`), and an `onClick` that calls `e.stopPropagation()` before acting (`:417-419`). Counts and the aggregate announce via `aria-live="polite"` (`MoodHistoryCalendar.tsx:255`; asserted at `MessageCompose.test.tsx:226-231`, `DisconnectionOverlay.test.tsx:66`).

If the badge ships before the tray does, the interim render target is the existing `BottomNavigation.tsx` buttons — but do not invest there; the bar is being deleted by the other spec.

## 3. Toast host

Two pieces, split for the reason SPEC's constraints give (the splash at `App.tsx:491` and admin at `:502` render alternate trees where shell children don't run):

- **`src/hooks/usePartnerActivity.ts` (new)** — called at the top of `App()` with the other effects. Arms one subscription on `partner-activity:${userId}` when `session && userId` are set; disarms on sign-out and unmount. **It must survive StrictMode's double-invoked effects**: two effect runs arming the same topic put two owners on one deduped channel — exactly the `interactionService.ts:181-184` failure, *"the first teardown closes it under the second"*. So the channel lives behind a module-level refcounted registry in the `moodSyncService.ts:94` style (subscribers attach/detach; the channel closes only when the last one leaves), not as a bare `channel()` call inside the effect. The mount effect this hook sits beside is StrictMode-safe via a ref (`App.tsx:257`); the subscription needs its own equivalent. On a signal `{ feature }`:
  - if `currentView` is that feature's view → call that feature's existing loader silently (CAP-6): `fetchNotes` (`notesSlice.ts:39,190`), `loadPhotos` (`photosSlice.ts:42,145`), events loader when it exists. Interactions have no general loader (`loadInteractionHistory` is modal-gated) and need none: `PokeKissInterface.tsx:134`'s own subscription already applies the update in-tab, so the `'partner'` branch just skips the toast;
  - else → increment that feature's unseen count and surface the toast state.
  - On `SUBSCRIBED`, call `refreshUnseenCounts()` unconditionally — every missed signal (frozen PWA, dropped socket, failed send) self-heals here.
- **`src/components/shared/ActivityToast.tsx` (new)** — rendered beside `SyncToast` at `App.tsx:520`, outside the `ViewErrorBoundary` (`:566`). Copies `SyncToast.tsx:131`'s fixed top-center `z-[100]` positioning; dwell is exactly 5 seconds (Sallvain's call — SPEC constraint), which `SyncToast.tsx:39`'s default `autoDismissMs = 5000` already matches. What differs is the tap: the whole surface is the target (SyncToast has none). Tap = `setView(target)` + the feature's loader (none for interactions) + `markFeatureSeen(feature)`. Text names the partner via `partner.displayName` (`partnerService.ts:27`).

**Channel discipline.** The topic must be the fresh `partner-activity:${userId}` — `supabase.channel()` returns the already-registered object for a repeated topic, so reusing `love-notes:${userId}` (`useRealtimeMessages.ts:68`) puts two owners on one channel and *"the first teardown closes it under the second"* (`interactionService.ts:181-184`). Respect `realtimeSocket.ts`'s `waitForSocketReady()` before subscribing, and store the leave promise on teardown the way `moodSyncService.ts:584-587` does. `useRealtimeMessages` stays untouched (SPEC non-goal): when the user sits on Notes, it still applies the incoming message in-thread; CAP-6's silent refetch coexists with it, and the refetch-not-merge prototype for that behaviour is `PartnerMoodView.tsx:197-200` (receives a realtime mood, calls `fetchPartnerMoods(30)`, merges nothing).

## 4. Send side — one line per feature

The pattern is `notesSlice.ts:554-560`: after the insert returns, `await sendEphemeralBroadcast(topic, event, payload)` in a try/catch whose failure is non-fatal (`console.warn`, the write already succeeded).

- **Love notes:** exists — retarget/add the send so the partner-activity topic receives `{ feature: 'notes' }` alongside the existing `love-notes:${partnerId}` message broadcast.
- **Photos:** new — `photosSlice.ts` currently broadcasts nothing (a grep for `sendEphemeralBroadcast` in it returns nothing); add the block inside `uploadPhoto` (declared `:69`) after the upload call at `:94` succeeds.
- **Interactions:** new — after `sendInteraction`'s insert (`interactionService.ts:105`, insert at `:129-130`) succeeds, broadcast `{ feature: 'interactions' }`. The payload never carries poke-vs-kiss (SPEC constraint: the type is row content on a public channel). This service's hand-rolled receive channel stays untouched.
- **Events:** new, added by the events implementation when `../spec-dynamic-events/` lands; that spec's CAP-1 stays reload-based until then.

Payload is `{ feature }` only — the channel is public, so nothing that isn't already public knowledge rides it (SPEC constraint).

## 5. Tests

- **Unit (vitest):** the slice — counts zero when `partner` is null; identity guard drops a stale resolve; `markFeatureSeen` zeroes one feature and leaves the rest; toast-vs-silent branch on `currentView`. Shape: existing store tests under `tests/unit/stores/`. Note `signOutClearsAccountState.test.ts` does **not** pick up new keys automatically — its `EXPECTED_RESET` table (`:30`) is *"Deliberately duplicated from the source rather than derived from it"* (`:220`), and the key-set assertion at `:370` **fails** until the new keys are hand-added there. That failing test is the enforcement; adding the keys to both `signedOutState()` and `EXPECTED_RESET` is part of the slice commit. The hook's signal handling unit-tests with a faked signal; no browser needed.
- **pgTAP:** `20_feature_seen.sql` per `data-model.md`.
- **E2E (Playwright):** import from `tests/support/merged-fixtures.ts` (`AGENTS.md:26`); auth is free — the worker fixture signs the page in (`tests/support/fixtures/auth.ts:36,57-64,71-72`), exactly as `tests/e2e/notes/love-notes.spec.ts:9-21` uses it. Tag every title `[P0]`/`[P1]` — an untagged spec runs in neither `test:p0` nor `test:p1` (`package.json:28-29`). A badge E2E needs no second browser: seed a note to the worker's account, load, assert the count, open the destination, assert it clears. Do not link/unlink partners or null shared rows — pool accounts belong to other workers (`AGENTS.md:62`).
- **The toast's live delivery needs new fixture work to test, though broadcast delivery itself is provably testable here.** Scripture already asserts cross-browser broadcast arrival: `tests/e2e/scripture/scripture-reading-4.2.spec.ts:66` `await waitForPartnerLocked(partnerPage);` waits on a store flag (`scripture-lobby.ts:117-122`) whose only setter-to-true is the broadcast receive path in `useScriptureBroadcast.ts:166-167`. But the two-context fixture behind it (`tests/support/fixtures/together-mode.ts`) is scripture-coupled — it seeds scripture sessions and drives both users into role selection — so a partner-activity delivery test still needs a leaner two-context fixture of its own. Cheapest honest strategy: unit-test the handler with a faked signal, E2E-test the tap action by driving the toast state directly, and treat the two-browser delivery test as fundable follow-up (~1–2 days), with the scripture spec as proof of feasibility.

## Sequencing

1. **Badge:** migration + pgTAP → `activitySlice` (+ `signedOutState` keys, same commit) → refresh triggers in `App.tsx` → badge UI in whatever nav exists when this lands.
2. **Toast:** `usePartnerActivity` + `ActivityToast` → photo send block → notes send retarget → interactions send block.
3. **Events joins** both halves when its table lands.

The badge half needs no realtime and no new fixture work; it is shippable alone and is most of the felt value.
