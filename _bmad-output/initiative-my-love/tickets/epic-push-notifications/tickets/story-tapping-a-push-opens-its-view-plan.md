---
title: 'Tapping a push opens its view'
type: 'feature'
ticket: '9'
created: '2026-11-01'
status: done
baseline_revision: 'd6faae419c0bc70da35a3aa96fb0c8077c021096'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-love-notes-stack-apart-and-the-badge-counts-unread-notes-plan.md']
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Tapping a push opens the shell on whatever view it last showed (Home on a cold start), never the view the push is about (R6). The payload carries no field that names its kind; `aps.thread-id` only separates love notes from everything else.

**Approach:** The sender adds the push's kind as a top-level `kind` key to every payload. The web push module listens for `pushNotificationActionPerformed`, maps the tapped payload to a `ViewType`, and hands it to App, which navigates through `navigationSlice.setView`. The plugin keeps a tap until a listener exists, and the listener is added on the signed-in start, so a cold-start tap opens its view after sign-in restores.

## Boundaries & Constraints

**Always:**
- Every payload the sender builds has a top-level `kind` equal to the `PushKind` it handles: `love_note`, `mood`, `photo`, `interaction` (poke and kiss), `date`, `partner_request`, `partner_accept`. `withBadge` keeps top-level keys. `aps` is unchanged (text, thread ids, badge).
- The map from kind to view: `love_note` → `notes`; `mood`, `interaction`, `partner_request`, `partner_accept` → `partner`; `photo` → `photos`; `date` → `home`. With no known `kind`, `aps.thread-id` `love-notes` → `notes`. Anything else → `null`, and the tap navigates nowhere.
  - A push sent before this sender is deployed has no `kind`. The thread-id fallback still opens Love Notes for a love note.
- Only `actionId === 'tap'` navigates.
- Navigation goes through `setView(view)` with history, so the URL matches the view and a reload keeps it.
- The tap listener is added in the existing `listenOnce`. Nothing native changes unless the cold-start check below fails.
- A tap that arrives before App subscribes is kept, one at most (the latest), and delivered when App subscribes. A handler that throws is logged, never rethrown.
- The website, the Home Screen web app and shells without the push plugin: nothing changes, and no listener is added (`hasNativePush()` gates `startPushRegistration`, as today).

**Never:**
- Change alert text, thread ids, the badge, triggers, dedupe or switches.
- Add react-router, a sixth dock item, a `ViewType`, or anything in `signedOutState()`.
- Route date reminders. Story 4.6 reuses this module's map and subscription for that.
- Remove delivered notifications.
- Deploy anything, or touch hosted Supabase, APNs or `deploy.yml`.
- Uninstall the owner's phone shell, leave a test build in `dist/`, or leave serve, update, driver or `functions serve` processes running.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Note tapped | `{kind:'love_note'}` | Love Notes opens (and marks read, story 3.8) | -- |
| Mood, poke, kiss, request, accept | each kind | Partner | -- |
| Photo / date | `photo` / `date` | Photos / Home | -- |
| Old payload | no `kind`, thread `love-notes` | Love Notes | -- |
| Old payload, other thread | no `kind`, `partner-activity` | No navigation | -- |
| Junk | `kind: 'x'`, `data` missing or not an object | No navigation | Never throws |
| Dismiss | `actionId: 'dismiss'` | No navigation | -- |
| Cold start | Tap retained before the listener exists | View opens once the signed-in start adds the listener | -- |
| Tap before App subscribes | No handler yet | Delivered on subscribe, once | -- |

</intent-contract>

## Code Map

- `supabase/functions/send-push/payload.ts`
  - `ApnsPayload` gains optional top-level `kind?: string`.
  - Add `withKind(payload, kind)`. It returns a copy and does not mutate its input.
  - Fix `withBadge` (line ~95) to spread the payload: `{ ...payload, aps: { ...payload.aps, badge } }`.
  - Header: add a story 3.9 paragraph naming `kind`.
- `supabase/functions/send-push/handler.ts`
  - At line ~424, `payload = withKind(withBadge(source.buildPayload(senderName), unread), source.kind)`.
  - Add a header-doc line on `kind`, the web code's tap routing key.
- `supabase/functions/send-push/{handler,payload}.test.ts`
  - Add `kind` to the exact-payload asserts (handler.test.ts lines ~175, 460, 478, 623, 743, 793).
  - New case: each of the seven kinds records its `kind`.
  - Payload tests: `withKind` does not mutate its input, and `withBadge` keeps `kind`.
- `tests/api/push-love-note-trigger.spec.ts`
  - Add `kind` to the expected payloads: line ~137 (`love_note`), and `partnerPayload` (line ~355) gains a `kind` argument at its 6 call sites.
  - The interaction case at ~541 covers poke and kiss, so both are `interaction`.
- `src/services/pushNotifications.ts`
  - Export `viewForPush(data: unknown): ViewType | null`, implementing the map in Always. Import `ViewType` as a type only from `../stores/slices/navigationSlice`, which has no runtime imports of this module.
  - Add `onPushTap(handler: (view: ViewType) => void): () => void`. It is a module-level set plus one pending view, the same pattern as `onForegroundPush` (line ~95).
  - In `listenOnce` (line ~131), add `PushNotifications.addListener('pushNotificationActionPerformed', …)`. For `actionId === 'tap'`, it computes `viewForPush(action.notification.data)` and delivers a non-null view to every handler, or keeps it as pending when there are none.
  - Update the header's "Not here yet" line.
  - Do not import `useAppStore`: `authSlice` imports this module.
- `src/App.tsx`
  - Next to the push registration effect (line ~419), add `useEffect(() => onPushTap((view) => setView(view)), [setView])`.
  - The initial-route effect (line ~187) runs on mount, before sign-in, so it does not override a later tap.
- Unit tests:
  - `src/services/__tests__/pushNotifications.test.ts` (its `push.addListener` mock captures handlers by name) covers:
    - every row of the matrix through `viewForPush`;
    - the listener: tap → handler, dismiss → none;
    - a pending tap delivered on subscribe, once;
    - unsubscribe;
    - a throwing handler.
  - `tests/unit/App.pushRegistration.test.tsx` mocks this module: add `onPushTap` to the mock, plus one case where a captured tap handler called with `'notes'` sets `currentView` to `notes`.
  - Run `tests/unit/stores/signOutStopsDevicePushes.test.ts` too.
- Simulator: `scripts/sim-driver/sim`. It needs no change. `banner FILE --tap cold|background` exists for the shell (story 3.12). `sim dump` reads the web view's elements, and the dock button for the open view carries `aria-current="page"` (`AppNavigation.tsx:202`).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/functions/send-push/{payload,handler}.ts` + tests -- `kind` on every payload -- the tap's routing key
- [x] `tests/api/push-love-note-trigger.spec.ts` -- expected payloads carry `kind` -- the recorded wire shape
- [x] `src/services/pushNotifications.ts` + its tests -- `viewForPush`, `onPushTap`, the tap listener -- mapping
- [x] `src/App.tsx` + `tests/unit/App.pushRegistration.test.tsx` -- subscribe and `setView` -- navigation
- [x] Simulator: run the recipe in Design Notes, and record the commands, exit codes and the observed views in Implementation Notes.

**Acceptance Criteria:**
- Given the sender's deno tests, when each of the seven kinds is sent, then its recorded payload carries its `kind`, and `aps` is unchanged.
- Given the unit tests, when a tap is reported for each kind, then it maps to its view, a payload without a `kind` maps by thread id, and the tap reaches `currentView` through App.
- Given the api spec with `functions serve` running, when each push type is triggered, then every recorded payload carries its `kind`.
- Given the Duo simulator through the driver, signed in as Casey, when the banner of each recorded payload is tapped, then each one opens its view. The payloads are a note, a mood, a photo, a poke, a kiss, a date change, a partner request and an acceptance. Each one is tapped twice: with the app terminated (`--tap cold`), and with the app backgrounded on a different view (`--tap background`).

## Implementation Notes

Built 2026-11-01. Sender: `withKind` in `payload.ts` (a copy; `ApnsPayload.kind?`), `withBadge` now spreads the payload so it keeps `kind`, and `handler.ts` builds `withKind(withBadge(...), source.kind)`; header docs name `kind`. Web: `viewForPush`, `onPushTap` and a `pushNotificationActionPerformed` listener in `listenOnce` (`pushNotifications.ts`); `App.tsx` subscribes with `useEffect(() => onPushTap((view) => setView(view)), [setView])`. A known `kind` wins over the thread id; `Object.hasOwn` guards the map so `kind: 'toString'` is junk. No native code changed.

Tests: the deno exact-payload asserts gained `kind`, plus a case for all seven kinds (and poke and kiss both `interaction`), `withKind` and `withBadge` payload tests; `pushNotifications.test.ts` covers `viewForPush`, the listener, the pending tap, unsubscribe and a throwing handler (its "listens once" count went from 3 to 4 listeners); `App.pushRegistration.test.tsx` mocks `onPushTap` and checks a tap of `'notes'` sets `currentView` and the URL.

Checks (all exit 0 / pass): `deno test --no-lock supabase/functions/send-push/` 95 passed; `deno check --no-lock supabase/functions/send-push/index.ts` clean; `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` 17 passed (`supabase functions serve` running, stopped afterwards); `npm run test:unit` 215 files, 3412 passed; `npm run lint` and `npm run typecheck` exit 0.

Simulator (iPhone Duo, local stack, `supabase functions serve` with no APNs env; payloads from `push_requests.payload` read with psql in the db container into scratch files), through `scripts/sim-driver/sim`: `provision`, `build`, `signin` (Casey) exit 0. Rows were inserted as Jessie for Casey (note, mood, photo, poke, kiss, an event for the date change); Quinn and Riley produced the request (Quinn to Riley) and the acceptance (Riley's request to Quinn set `accepted` by psql), both recorded for Riley's device. All eight recorded payloads carried `kind` (`love_note`, `mood`, `photo`, `interaction` for poke and for kiss, `date`, `partner_request`, `partner_accept`) and an unchanged `aps`.
- Cold (`sim banner FILE --tap cold`, 8 payloads, each exit 0, state `notRunning` before and `runningForeground` after; `sim dump` 8 s later, the open view read from the dock button that shows its label): note Love Notes; mood, poke, kiss, request, accept Partner; photo Photos; date Home. The date case cannot tell its target from the cold-start default, as the plan says. The cold tap reached the web code with no native change, so the Design Notes' `SceneDelegate` fallback was not needed.
- Background (`sim launch`, a dock tap to another view, `sim banner FILE --tap background`, exit 0, `runningBackground` before the tap and `runningForeground` after): the view before the tap was Mood for note, photo, kiss and request, and Photos for mood, poke, date and accept. After it: note Love Notes; mood, poke, kiss, request, accept Partner; photo Photos; date Home. Each of the eight opened its target.
- Cleanup: `functions serve` stopped (the edge runtime container is gone); the rows this check made were deleted (the note, the mood, the photo, the two interactions, the event with its date change, both partner requests, 56 `push_requests`, and Casey's `love_notes_read_markers` row), so `push_requests` is back to its 554 rows. No `xcodebuild`, `http.server` or serve process, no `dist/`, no `deno.lock`. `sim provision` was not re-run: the psql accept changed no `users.partner_id`, so Riley and Quinn are still unlinked.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 1, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` A cold-start tap 60 minutes or more after the last welcome showed the Welcome splash, not the tapped view. `shouldShowWelcome()` decides `showSplash` at mount, and while it is true App renders `<WelcomeSplash>` in place of the tree, so the tap only set the view underneath it. Patched: App's `onPushTap` handler calls `setShowSplash(false)` before `setView(view)` and leaves `lastWelcomeView` as it was. A new case in `App.pushRegistration.test.tsx` checks the splash is gone, `currentView` is `notes` and the stale stamp is kept. Its first version was flaky: the real lazy `WelcomeSplash` crashed on the file's partial motion mock into the ErrorBoundary. It now uses a stubbed `WelcomeSplash` and waits for it before the tap; three full unit runs passed.
  - `[low]` `[reject]` A tap after sign-out still navigates, and a tap kept from a signed-out cold start reaches whichever account signs in next. This is real: the listener lives for the page load, and the App subscription has no auth check. Only the view changes: the next account sees its own data on that view, and no data crosses accounts. It needs a shared device plus a tap on the previous account's stale notification, so it is rare. The fix needs a guard, and even then it could not tell the accounts apart without account identity in the payload.
  - `[false]` `[reject]` The claim was that the poke/kiss deno case "holds by construction" and would not catch a kind derived from the interaction type. That is wrong: the case asserts `kind === 'interaction'` for both types (`handler.test.ts:1101`). A handler that derived `kind` from `interaction.type` would record `poke`/`kiss` and fail it.

## Design Notes

**Why `kind` and not a view name in the payload:** the sender cannot import `src/`, and the view a push opens is a client decision. A kind lets story 4.6 and later views change the map without a redeploy. The `kind` key is a top-level APNs custom key; the plugin hands the whole `userInfo` to the web code as `notification.data` (`PushNotificationsHandler.swift`, `makeNotificationRequestJSObject`).

**Why cold start works without native code:** the plugin sends `pushNotificationActionPerformed` with `retainUntilConsumed: true`, and `CAPPlugin.m` replays the retained events when the first listener is added. `listenOnce` runs on the signed-in start, after the session restores. If the cold-start check shows no tap reaching the web code, the Capacitor notification delegate was set too late in `SceneDelegate`. In that case, fix it in `ios/App/App/{SceneDelegate,AppDelegate}.swift` only, and record the cause and the fix in the Plan Change Log.

**Simulator recipe** (local stack, `supabase functions serve` with no APNs env; the payloads come from `push_requests.payload`, read with psql in the db container into scratch files, as story 3.8 did; routing reads only the payload, so any fixture pair may produce a kind, e.g. Riley and Quinn for a partner request and its acceptance):
1. `sim provision`, `sim build` (this tree), `sim signin` (Casey). Produce one recorded payload per kind: note, mood, photo, poke, kiss, date change, partner request, acceptance. Check that each has `kind`.
2. Cold: for each payload, run `sim banner FILE --tap cold`. After it, wait for the app to settle, then `sim dump`. Expect the `aria-current="page"` dock item (or the view's own content) to be its target view. For the date payload, Home is also the cold-start default, so note that the case cannot tell the two apart.
3. Background: for each payload, `sim launch`, then tap a dock item for a view other than the target, then `sim banner FILE --tap background`, then `sim dump`. Expect the target view.
4. Clean up:
   - stop `functions serve` and every serve process;
   - delete the rows this check made (notes, moods, photos, interactions, date changes, partner requests, the push requests), and re-run `sim provision` if the Riley/Quinn link must be undone;
   - confirm that no `xcodebuild` or `http.server` process remains, and that `dist/` and `deno.lock` are absent.

## Verification

**Commands:**
- `deno test --no-lock supabase/functions/send-push/` and `deno check --no-lock supabase/functions/send-push/index.ts` -- expected: pass
- `npx playwright test --project=api tests/api/push-love-note-trigger.spec.ts` (with `supabase functions serve` running) -- expected: pass
- `npm run test:unit`, `npm run lint` and `npm run typecheck` -- expected: exit 0

## Auto Run Result

Status: built

**Summary:** Tapping a push now opens the view it is about, both after a cold start and when the app was in the background (R6).
- **Sender:** `send-push` stamps every payload with a top-level `kind`: `love_note`, `mood`, `photo`, `interaction`, `date`, `partner_request` or `partner_accept`. `aps` is unchanged.
- **Push module:** `viewForPush` maps the kind to a view:
  - a note opens Love Notes;
  - a mood, a poke, a kiss, a partner request and an acceptance open Partner;
  - a photo opens Photos;
  - a date opens Home.
  - A payload with no `kind` that is on the `love-notes` thread opens Love Notes. Anything else opens nothing.
- **Taps:** a `pushNotificationActionPerformed` listener added in `listenOnce` passes the tapped view to `onPushTap`'s handlers. It keeps the latest tap until a handler subscribes.
- **App:** App subscribes, hides the welcome splash and calls `setView(view)` with history, so the URL matches.
- **Native:** nothing native changed. The plugin keeps a cold-start tap until the listener the signed-in start adds.

**Files changed:**
- `supabase/functions/send-push/payload.ts`: `withKind`, `ApnsPayload.kind`, and `withBadge` now keeps top-level keys.
- `supabase/functions/send-push/handler.ts`: every payload is `withKind(withBadge(...), source.kind)`, plus a "The kind" doc section.
- `supabase/functions/send-push/{handler,payload}.test.ts`: the exact-payload asserts carry `kind`, a case for all seven kinds, and the `withKind`/`withBadge` cases.
- `tests/api/push-love-note-trigger.spec.ts`: the recorded payloads are expected to carry `kind`.
- `src/services/pushNotifications.ts`: `viewForPush`, `onPushTap`, the tap listener and the header.
- `src/services/__tests__/pushNotifications.test.ts`: the map, the listener, the pending tap, unsubscribe and throwing handlers.
- `src/App.tsx`: the `onPushTap` subscription, which dismisses the splash and navigates.
- `tests/unit/App.pushRegistration.test.tsx`: a tap sets the view and the URL, a tap dismisses the splash, and the listener stops on unmount.

**Review findings:** 3 from the Quick lens.
- Patched 1 (medium): a cold-start tap was hidden behind the hourly welcome splash.
- Deferred: none.
- Rejected 2:
  - low: a tap after sign-out carries over into the next sign-in. It is rare, changes only the view, and the fix needs a guard.
  - false: the claim that the poke/kiss deno case cannot catch a type-derived kind. Its `interaction` assert would fail.

**Follow-up review recommended:** false. One medium was patched and no high.

**Verification, after the patch:**
- `deno test --no-lock supabase/functions/send-push/` passed 95 tests, and `deno check --no-lock` on `index.ts` is clean.
- The api spec passed 17 tests with `supabase functions serve` running; it was stopped afterwards.
- `npm run test:unit` passed 215 files in three consecutive runs (3413 tests). A run before the test fix failed on the flaky splash case.
- `npm run lint` and `npm run typecheck` exit 0.
- Simulator (iPhone Duo, local stack, before the splash patch; see Implementation Notes): all eight payload types opened their view from `--tap cold` and from `--tap background` on a different view.
- No `dist/`, `deno.lock`, serve, edge-runtime, `xcodebuild` or `http.server` process is left.

**Residual risks:**
- The splash patch is covered by unit tests only. The simulator taps ran before it, and `sim signin` had just dismissed the splash, so no simulator run showed a cold tap with the splash due.
- The date case under `--tap cold` cannot tell its target from Home, the cold-start default. The background run covers it.
- Until `send-push` is redeployed, hosted pushes carry no `kind`. Only a love note routes then, through the thread-id fallback.
- A tap on the previous account's delivered notification after sign-out changes the next account's opening view (rejected low, above).
- Real APNs delivery and a real iPhone are untested for taps; story 3.11 is the device check.
