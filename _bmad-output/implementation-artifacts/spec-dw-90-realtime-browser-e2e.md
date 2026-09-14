---
title: 'DW-90: browser-level E2E for live love-note delivery over the private couple topic'
type: 'chore'
created: '2026-09-14'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      The sibling private-broadcast path, mood-updates:<partnerId>, still has no
      browser-level Realtime coverage; DW-90 is closed for love notes only.
    evidence: |-
      src/api/moodSyncService.ts:257 runs the same composition (private topic,
      sendEphemeralBroadcast, store, UI) under the same policy migration
      20260912010000_private_couple_broadcast_policies.sql, whose predicates
      cover both prefixes. grep -c "realtime\|broadcast"
      tests/e2e/partner/partner-mood.spec.ts returns 0, and the only other
      tests/e2e files mentioning realtime are the interaction specs, whose own
      header states they do not exercise live Realtime. Pre-existing: this
      story's intent names one deliverable, "sends a love note from one context
      and asserts it arrives live in the other", so the mood leg was never in
      scope for it.
    location: >-
      tests/e2e/partner/partner-mood.spec.ts
    severity: low
baseline_revision: '11b12f02c04be3df129c4c08b0630ef5dbc7cdc1'
---

<intent-contract>

## Intent

**Problem:** No test drives the app's own Realtime clients in a browser against the couple-broadcast policies. `tests/api/couple-broadcast-authorization.spec.ts:53,:87` builds its own `createClient` identities and never imports `useRealtimeMessages`, `moodSyncService`, `sendEphemeralBroadcast` or the store, and `grep -rn "realtime\|broadcast"` over `tests/e2e/notes/love-notes.spec.ts` and `tests/e2e/partner/partner-mood.spec.ts` returns nothing — so the composition shipped to users (hook → private join → `httpSend` → store → UI) is covered only by mocked unit tests.

**Approach:** Add one two-browser-context spec under `tests/e2e/` that signs in this worker's already-linked pooled pair, parks the partner on `/notes` until the app's own hook reports `SUBSCRIBED`, sends a love note from the first context through the real UI, and asserts it appears in the partner's message list with no reload and no second navigation.

## Boundaries & Constraints

**Always:** Import `{ test, expect }` from `tests/support/merged-fixtures.ts`. Use this worker's own pooled identities only — `worker-N` for the sender (the default `page`) and `worker-N-partner` for the receiver, linked already by `tests/support/auth/global-setup.ts:151`. Wait for the receiving page's own `useRealtimeMessages` join to be reported before sending; a broadcast is ephemeral and a send made before the join is lost. Close the second context in a `finally`. Delete only rows this test created, keyed on its own unique content plus this worker's pair ids.

**Never:** Do not link, unlink or reset any account, and do not null a shared row at teardown — those rows belong to other workers. Do not build a Supabase client to stand in for the app's Realtime client: the whole point is that the browser's own client does the work. Do not reload, re-navigate or refetch on the receiving page after its first `goto`. Do not add scripture code or repair anything in `tests/e2e-archive/`. Do not touch `implementation-artifacts/deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Live delivery | Partner context on `/notes` with its hook joined; sender types a unique note and clicks send | Sender's `POST **/realtime/v1/api/broadcast` answers 202; the note text becomes visible inside `love-note-message` on the partner page with no reload | No error expected |
| Receiver not yet joined | Partner page mounted but its hook has not reported `SUBSCRIBED` | The spec blocks on that signal before sending, so the send never lands in the unjoined window | Wait times out and the test fails naming the missing join, rather than flaking on a lost broadcast |
| Send rejected by policy | `couple_broadcast_partner_can_send` refuses the sender's topic | The broadcast response is not 202 and the spec fails on that status | Failure names the rejected send, not a missing UI element |

</intent-contract>

## Code Map

- `tests/e2e/notes/love-notes-realtime.spec.ts` -- NEW. The only file to create.
- `tests/support/merged-fixtures.ts:75-89` -- the merged `test`; the only sanctioned import for `{ test, expect }`.
- `tests/support/fixtures/auth.ts:73-90` -- `context`/`page` build the sender's context from the worker's storage state. `:93-99` `partnerUserIdentifier` (worker-scoped, `worker-N-partner`); `:58-70` `partnerAuthToken` calls `provider.manageAuthToken` for that identifier, whose side effect is writing the partner's storage-state file to disk.
- `tests/support/auth/supabase-auth-provider.ts:142-166` -- what that file contains: `sb-<host>-auth-token` plus `lastWelcomeView` under origin `BASE_URL`, saved at `getStorageStatePath({ environment, userIdentifier })`.
- `tests/support/fixtures/together-mode.ts:98-136` -- shape reference ONLY for the second context (`browser.newContext({ storageState, baseURL })`). Its seeding/linking is scripture work; copy none of it.
- `tests/support/auth/global-setup.ts:151` -- `linkUserPair(admin, getWorkerEmail(i), getWorkerPartnerEmail(i))`: the pair is already partners. Nothing in the spec may re-link.
- `tests/support/helpers/events.ts:70-80` -- `resolveOwnPair(supabaseAdmin)` → `{ userId, partnerId }` for this worker, keyed on `TEST_WORKER_INDEX`. Use for the teardown filter.
- `src/hooks/useLoveNotes.ts:141` -- `useRealtimeMessages({ enabled: autoFetch })`; `:126-130` the mount fetch is the ONLY other notes read, so a note appearing later without a reload can only have arrived over the broadcast.
- `src/hooks/useRealtimeMessages.ts:208` topic `love-notes:<currentUserId>`; `:465` `config: { private: true }`; `:479` `channel.subscribe(handleStatus)`; `:250` `logger.info('[useRealtimeMessages] Subscription status:', status, …)` — always logged (`src/utils/logger.ts:10-12`), so `SUBSCRIBED` is observable as a console message. `:389-406` the pre-join snapshot makes the FIRST `SUBSCRIBED` already armed.
- `src/stores/slices/notesSlice.ts:565` -- `sendEphemeralBroadcast('love-notes:<partnerId>', 'new_message', { message: data })` after the insert.
- `src/api/ephemeralBroadcast.ts:154` -- REST `httpSend`. `transformers.js:224-238` derives only the BASE `<supabaseUrl>/realtime/v1/api/broadcast`; `RealtimeChannel.js:454-458` then appends `/<encodeURIComponent(subTopic)>/events/<event>` and `?private=true`, so the real request is `POST .../api/broadcast/love-notes%3A<uuid>/events/new_message?...`. Match it as a substring, never as a suffix. 202 is the only success status (`RealtimeChannel.js:465-466`). [corrected during implementation — see Spec Change Log]
- `src/components/love-notes/LoveNoteMessage.tsx:228` -- `data-testid="love-note-message"`.
- `src/components/love-notes/MessageInput.tsx:257,268` -- `aria-label="Love note message input"`, `aria-label="Send message"`.
- `tests/e2e/notes/love-notes.spec.ts:51-78` -- existing single-context send; the new spec must not duplicate its assertions.
- `playwright.config.ts:145-152` -- `chromium` project is `./tests/e2e`; `:99` `fullyParallel`, `:120-122` 15s expect timeout.
- `.github/workflows/test.yml:486-507` -- a changed E2E spec is burned in 5× at `--retries=0`. Every wait must be on a real signal; no fixed sleeps.

## Tasks & Acceptance

**Execution:**
- `tests/e2e/notes/love-notes-realtime.spec.ts` -- Create one `test.describe` with a single `[P1] DW-90-E2E-001` test. Destructure `{ page, browser, supabaseAdmin, authOptions, partnerUserIdentifier, partnerAuthToken }` from the merged fixtures. Depend on `partnerAuthToken` so the partner's storage state is on disk, then open the second context from `getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier })`, passing `baseURL` explicitly as `together-mode.ts:134` does. Register the console wait for `/\[useRealtimeMessages\].*SUBSCRIBED/` BEFORE `partnerPage.goto('/notes')`, await it, then let the page settle before sending. Send a `randomUUID()`-tagged note from `page` through the real input and send button while awaiting the sender's `**/realtime/v1/api/broadcast` response. Assert on the partner page. Close the partner context and delete the created row in `finally`, filtered on the unique content and this worker's `resolveOwnPair` ids. Use `log.step` for phases, matching `tests/e2e/partner/interaction-record-ownership.spec.ts:28`.

**Acceptance Criteria:**
- Given this worker's pooled pair signed into two browser contexts and the partner parked on `/notes` with its own `useRealtimeMessages` reporting `SUBSCRIBED`, when the sender types a unique note and clicks send, then that exact text is visible inside a `love-note-message` element on the partner page while that page has never been reloaded or re-navigated since its first `goto`.
- Given the same setup, when the send completes, then the sender's `POST` to `**/realtime/v1/api/broadcast` answered 202 — the private `couple_broadcast_partner_can_send` INSERT policy admitted a send made by the app's own client, not a hand-built one.
- Given the test ends in any state, when teardown runs, then the partner context is closed and only `love_notes` rows carrying this test's unique content and this worker's own pair ids are deleted; no `users.partner_id`, password or other shared row is written.
- Given `npx playwright test --project=chromium tests/e2e/notes/love-notes-realtime.spec.ts --retries=0` is run five times against a local Supabase stack, then all five runs pass.

## Spec Change Log

- 2026-09-14 (implementation) — **Code Map line 50 and the Execution/AC wording were wrong about the broadcast URL, and the spec-as-written could not pass.** `transformers.js:224-238` yields only the BASE endpoint; `@supabase/realtime-js@2.116.0` `RealtimeChannel.js:454-458` then appends `/<encoded topic>/events/<event>` and a `private=true` query, and the socket URL it was built from already carries `apikey`, `eventsPerSecond` and `vsn`. The request measured on the local stack is `POST http://127.0.0.1:54321/realtime/v1/api/broadcast/love-notes%3A<partner uuid>/events/new_message?apikey=…&eventsPerSecond=10&vsn=2.0.0&private=true`. Waiting on `**/realtime/v1/api/broadcast` therefore never fires — the first run failed with `TimeoutError: page.waitForResponse: Timeout 15000ms exceeded` while the note itself sent and rendered fine. Implemented as a substring match on `/realtime/v1/api/broadcast/` plus a separate assertion that the decoded URL contains `love-notes:<partnerId>/events/new_message`, which also makes the 202 provably about THIS partner's topic rather than any topic.
- 2026-09-14 (implementation) — Teardown's row delete is a soft assertion (`expect.soft`) rather than a `throw`. `no-unsafe-finally` rejects a throw inside the `finally`, and a hard assertion there replaces the test's real failure with a teardown message. Soft still fails the run and still surfaces a leaked row.
- 2026-09-14 (implementation) — `resolveOwnPair` is called once at the top of the test rather than in the `finally`, because the acceptance assertion on the broadcast topic needs `partnerId` too. Same call, same filter, same rows.

## Review Triage Log

- 2026-09-14 review round 1 — five findings, all accepted and fixed in `tests/e2e/notes/love-notes-realtime.spec.ts`; no finding rejected.
  1. **Broadcast wait matched any topic.** The predicate tested only for `/realtime/v1/api/broadcast/`, which `mood-updates:` sends share, so a concurrent mood sync could have resolved it and the 202 would have described an unrelated request. Now matched AND asserted on the exact encoded path `${BROADCAST_PATH}${encodeURIComponent(\`love-notes:${partnerId}\`)}/events/new_message`, built from `resolveOwnPair`. The `decodeURIComponent` comparison is gone — it throws `URIError` on a stray percent sequence in a query value — and `private=true` is now asserted from `searchParams`, without which Realtime never evaluates `couple_broadcast_partner_can_send` and the 202 proves delivery rather than authorization. This closes a real gap in AC 2 as originally written.
  2. **Two timeout collisions.** `waitForResponse` inherited the 15s `actionTimeout`, which is exactly `BROADCAST_TIMEOUT_MS` (`src/api/ephemeralBroadcast.ts:77`), so a slow send expired both bounds at once and the app's own abort never surfaced — given an explicit 30s. The test's own waits sum to a 150s sequential worst case against `playwright.config.ts:119`'s 60s default, which would have replaced the failing wait with a generic test-timeout message — `test.describe.configure({ timeout: 180_000 })`. Neither affects the healthy path: the test still completes in under 3s.
  3. **Join failure was unnamed.** I/O matrix row 2 promises a failure "naming the missing join"; Playwright's own message is `waitForEvent: Timeout 30000ms exceeded`, which names neither the hook nor which page waited. Now rethrown as a named error with the original preserved as `{ cause }`. Verified: fails at 30.5s with the named message and `[cause]: TimeoutError`.
  4. **Teardown could not see a leak.** A PostgREST delete matching zero rows — the shape a mis-resolved identity produces — also answers `error: null`, so the filter's whole purpose went unchecked. Now `.select('id')` plus a soft `toHaveLength(1)`, guarded by a `noteRowCommitted` flag so a failure before the send does not stack a false teardown failure on the real one. Verified with the filter deliberately broken: fails `Expected length: 1 / Received length: 0`.
  5. **Comment overstated an assertion.** `expect(partnerAuthToken).not.toBe('')` cannot catch a silent auth failure — `manageAuthToken` throws first and `tests/support/fixtures/auth.ts:68` throws on a missing token. Comment corrected to state what it actually proves (the fixture ran and wrote the partner's storage state); the assertion is kept so the dependency stays an explicit precondition.

### 2026-09-14 — Review pass
- verdicts: 28 findings — high 0, medium 3, low 21, false 4, maybe-false 0
- findings:
  - `[false]` `[reject]` blind-hunter: sender clicks send before the app is authenticated, so `sendNote` throws 'User not authenticated' and no POST fires — refuted: `App.tsx:566` renders `LoginScreen` unless `session` is set, and `App.tsx:311-318` calls `setSession(newSession)` and `setAuthUser(...)` in the same synchronous callback, so the store's `userId` is always set before the message input can render; `getPartnerId()` is awaited inside `sendNote` itself and the pair is linked by `global-setup.ts:151`.
  - `[low]` `[patch]` blind-hunter: the test's waits (30s + 15s + 15s) can exceed `playwright.config.ts:119`'s 60s test timeout, replacing the failing wait's message with a generic one — patched: `test.describe.configure({ timeout: 180_000 })` with the 150s worst-case arithmetic recorded in the comment.
  - `[low]` `[patch]` blind-hunter: a missing join fails with Playwright's generic `waitForEvent: Timeout 30000ms exceeded`, which names neither the hook nor the page, though the I/O matrix promises a failure naming the missing join — patched: `await subscribed` wrapped in try/catch that rethrows a named error with the original as `{ cause }`; verified by the implementer against an unmatchable regex.
  - `[low]` `[reject]` blind-hunter: the broadcast-URL correction is stale in the matrix row, the Execution bullet and AC 2, which still name the `**/realtime/v1/api/broadcast` glob — rejected: its only fix is to edit this build's spec, and the matrix row and AC sit inside the read-only `<intent-contract>`; the Code Map carries the correction and the Spec Change Log records it.
  - `[low]` `[reject]` blind-hunter: the Code Map cites `ephemeralBroadcast.ts:154` for `httpSend`, but :154 is `export function sendEphemeralBroadcast(` and the call is at :128 — confirmed accurate as a claim, rejected because its only fix is to edit this build's spec.
  - `[medium]` `[patch]` blind-hunter: teardown asserts only `error === null`, and a PostgREST delete matching zero rows also answers `error: null`, so a leaked row from a mis-resolved identity passes silently — patched: `.select('id')` plus a soft `toHaveLength(1)`, gated on a `noteRowCommitted` flag so a pre-send failure adds no false second failure.
  - `[low]` `[patch]` blind-hunter: the comment above `expect(partnerAuthToken).not.toBe('')` claims it catches a silent auth failure, but `fixtures/auth.ts:68` already throws on a missing token and `manageAuthToken` throws before it — patched: comment corrected to state what the assertion actually proves; assertion kept so the fixture dependency stays explicit.
  - `[low]` `[reject]` blind-hunter: the Verification section records expected outcomes but no measured result for any command — rejected: its fix is to edit this build's spec, and the measured outcomes are recorded under `## Auto Run Result` below.
  - `[low]` `[defer]` blind-hunter: the Problem statement indicts three modules but the work covers one, with `deferred: []` empty and no entry for the mood path — deferred: recorded in frontmatter `deferred`; the mood leg is outside this story's stated deliverable.
  - `[low]` `[reject]` blind-hunter: `waitForLoadState('networkidle')` is a discouraged wait and redundant because `SUBSCRIBED` already implies the list mounted — rejected: it settled in 10/10 measured runs at ~3s total, it is the only cover for a post-`SUBSCRIBED` partner-snapshot refresh, and replacing it with a UI signal would add complexity without covering that window.
  - `[false]` `[reject]` blind-hunter: the target list is virtualized, so an incoming note may land outside the render window — refuted: `MessageList.tsx:284-293` scrolls to the last row on mount, which makes `atBottom` true at `:259`, and `:300-316` then auto-scrolls each new note; the assertion passed in 10/10 runs against a pair whose history already carries rows from `love-notes.spec.ts`.
  - `[low]` `[reject]` blind-hunter: `## Review Triage Log` is an empty heading and `warnings: ['oversized']` ships unexplained — rejected: its fix is to edit this build's spec, and this entry fills the section.
  - `[low]` `[patch]` edge-case-hunter: the `waitForResponse` predicate matches any POST containing `/realtime/v1/api/broadcast/`, which `mood-updates:` sends share, so an unrelated send could resolve it — patched: predicate and assertion now use the exact encoded path `<base>/love-notes%3A<partnerId>/events/new_message`.
  - `[low]` `[reject]` edge-case-hunter: a failed pre-join partner lookup lets `SUBSCRIBED` fire with `partnerIdRef` null, and the note is dropped by `parseLoveNoteBroadcast` — real as a mechanism (`useRealtimeMessages.ts:399-406` sets `snapshotFresh` only when the lookup produced an id), but the proposed `waitForResponse` on `/rest/v1/users` guards state never demonstrated to occur: the pair is linked, and the lookup succeeded in 10/10 runs.
  - `[false]` `[reject]` edge-case-hunter: Realtime websocket and token-refresh traffic keep the page off `networkidle` — refuted: Playwright excludes WebSocket connections from the networkidle computation, token refresh is hourly not continuous, and the whole test including that wait completed in 2.5–3.2s in 10/10 runs.
  - `[low]` `[patch]` edge-case-hunter: the waits sum past the 60s test timeout — same defect as the blind-hunter row above; patched by the same `test.describe.configure({ timeout: 180_000 })`.
  - `[low]` `[patch]` edge-case-hunter: `waitForResponse` inherits the 15s `actionTimeout`, which is exactly `BROADCAST_TIMEOUT_MS` at `ephemeralBroadcast.ts:77`, so both bounds expire together and the app's own abort never surfaces — patched: explicit `{ timeout: 30_000 }`.
  - `[medium]` `[patch]` edge-case-hunter: the delete filter matching zero rows still answers `error: null` — same defect as the blind-hunter teardown row; patched by the same `.select('id')` plus soft `toHaveLength(1)`.
  - `[low]` `[patch]` edge-case-hunter: `decodeURIComponent(response.url())` throws `URIError` on a stray percent sequence and would mask the real result — patched: the assertion now compares the raw URL against the encoded path, and `decodeURIComponent` is gone.
  - `[low]` `[reject]` edge-case-hunter: Tasks and AC 2 still claim the `**/realtime/v1/api/broadcast` glob the code no longer uses — same claim as the blind-hunter stale-wording row; rejected for the same reason, its only fix being an edit to this build's spec.
  - `[low]` `[patch]` verification-gap (Other findings): the asserted substring stops before `private=true`, so the 202 proves delivery rather than authorization even though the comment and AC 2 call it a policy result — patched: `expect(new URL(url).searchParams.get('private')).toBe('true')` added beside the 202.
  - `[low]` `[defer]` verification-gap (Other findings): `mood-updates:<partnerId>` still has no browser-level coverage — deferred alongside the blind-hunter scope row; recorded in frontmatter `deferred`.
  - `[low]` `[defer]` intent-alignment: `moodSyncService` is named in the ledger's expectation and loaded by nothing here, so browser coverage lands on the non-canonical client and not the sanctioned one — deferred as the same scope entry; the intent's own deliverable sentence names love notes only.
  - `[low]` `[reject]` intent-alignment: the test's premise is gated on an app log string in `src/`, so editing that message turns a healthy app into a 30s timeout — real coupling, deliberately chosen and documented in the file header; rejected because the alternatives (app state, websocket frame inspection) add complexity, and the named-error patch above makes the breakage legible when it happens.
  - `[low]` `[reject]` intent-alignment: policy coverage is admit-only — the receiver joins its own topic, which cannot fail for a signed-in user, so every deny path stays at the raw-SDK surface — rejected as excluded by the intent itself, whose deliverable is "sends a love note from one context and asserts it arrives live in the other" and whose ledger entry states the predicates are already measured by `tests/api/couple-broadcast-authorization.spec.ts`.
  - `[medium]` `[patch]` intent-alignment: teardown's assertion surface is "the request did not error" while the AC's surface is "the row is gone" — same defect as the two teardown rows above; patched by the same row-count assertion.
  - `[low]` `[reject]` intent-alignment: the artifact records one run, not the five the AC names — rejected: its fix is to edit this build's spec, and the measured 5/5 is recorded under `## Auto Run Result` below.
  - `[false]` `[reject]` intent-alignment: added artifact is within bounds — the deferred-work ledger is untouched and the `_bmad-output/` artifact carries zero email matches — no defect claimed; recorded for completeness.

## Design Notes

The receiving page must be joined before the send, because a broadcast has no replay. The join is observable without adding app code: `useRealtimeMessages:250` logs through `logger.info`, which is unconditional (`src/utils/logger.ts:10-12`), so the console message is a real signal rather than a timing guess.

One `SUBSCRIBED` is expected even under `StrictMode` (`src/main.tsx:40`): the effect creates its channel only after two awaits (`useRealtimeMessages.ts:389-479`), and StrictMode's cleanup sets `cancelled` synchronously before either resolves, so the discarded run never reaches `supabase.channel()`.

```ts
const subscribed = partnerPage.waitForEvent('console', {
  predicate: (msg) => /\[useRealtimeMessages\].*SUBSCRIBED/.test(msg.text()),
});
await partnerPage.goto('/notes');
await subscribed;
await partnerPage.waitForLoadState('networkidle');
```

## Verification

**Commands:**
- `npx playwright test --project=chromium tests/e2e/notes/love-notes-realtime.spec.ts --retries=0` -- expected: 1 passed. Needs `supabase start` already running (CLI ≥ 2.117.0).
- Repeat the above five times -- expected: 5/5 passes, mirroring `test.yml:503-506`.
- `npx eslint tests/e2e/notes/love-notes-realtime.spec.ts` -- expected: no errors.
- `npx tsc -b --force` -- expected: no errors other than the worktree-only `TS2883` baseline at `tests/support/merged-fixtures.ts`; a changed count there is not a regression.

## Auto Run Result

Status: done

**Summary.** DW-90 is settled for love notes. `tests/e2e/notes/love-notes-realtime.spec.ts` signs this worker's already-linked pooled pair into two browser contexts, parks the partner on `/notes` until the app's own `useRealtimeMessages` reports `SUBSCRIBED`, sends a uuid-tagged note from the sender through the real input and send button, asserts the resulting `httpSend` answered 202 on `love-notes:<partnerId>/events/new_message` with `private=true`, and asserts the note appears in the partner's message list with no reload and no re-navigation. Teardown closes the second context and deletes exactly the one row the test created, scoped to this worker's own pair. No account is linked, unlinked or reset; no shared row is nulled; no scripture code was added; the deferred-work ledger was not touched.

**Files changed.**
- `tests/e2e/notes/love-notes-realtime.spec.ts` — new; the two-context Realtime E2E, the only production-side artifact of this story.
- `_bmad-output/implementation-artifacts/spec-dw-90-realtime-browser-e2e.md` — new; this spec, its change log, and this result.

**Review findings breakdown.** Four layers reported 28 findings: 0 high, 3 medium, 21 low, 4 false, 0 maybe-false.

*Patched (5 entries — 1 medium, 4 low):*
1. Broadcast wait and assertion now pin the exact encoded topic path and `private=true`, and `decodeURIComponent` is gone (low).
2. `waitForResponse` given an explicit 30s so it no longer expires in the same instant as the app's own `BROADCAST_TIMEOUT_MS`, and the test timeout raised to 180s so the wait that fails is the one the report names (low).
3. A missing join now throws a named error with Playwright's timeout preserved as `{ cause }` (low).
4. Teardown returns the deleted ids and soft-asserts exactly one row, gated on a flag so a pre-send failure adds no false second failure (medium).
5. The `partnerAuthToken` comment corrected to state what the assertion actually proves (low).

*Deferred (1):* `mood-updates:<partnerId>` still has no browser-level Realtime coverage — recorded in frontmatter `deferred`.

*Rejected (14), with reasons:*
- Sender sends before authentication (false) — `App.tsx:566` gates the app on `session` and `App.tsx:311-318` sets `session` and the store's `userId` in one synchronous callback.
- Virtualized list may hide the incoming note (false) — `MessageList.tsx:284-293` scrolls to the last row on mount, making `atBottom` true, and `:300-316` auto-scrolls each new note.
- `networkidle` may never settle (false) — Playwright excludes WebSockets from it; the whole test ran in 2.5–3.2s in 10/10 runs.
- Artifact within bounds (false) — an observation, not a defect claim.
- Stale `**/realtime/v1/api/broadcast` glob in the matrix row, Execution bullet and AC 2; wrong `ephemeralBroadcast.ts:154` citation; Verification records no measured result; empty triage-log heading and unexplained `oversized`; the same glob claim refiled by a second layer; one-run-not-five (6 findings) — each accurate, each rejected because its only fix is to edit this build's spec; the Code Map's endpoint fact was corrected before review and the measured results are recorded here.
- Failed pre-join partner lookup leaves `partnerIdRef` null — real mechanism, but the proposed wait guards state never demonstrated: the pair is linked and the lookup succeeded in 10/10 runs.
- `networkidle` is discouraged and redundant — it is the only cover for a post-`SUBSCRIBED` snapshot refresh, and replacing it adds complexity without covering that window.
- The join gate reads an app log string — real coupling, chosen deliberately and documented in the file header; the named-error patch makes the breakage legible.
- Policy coverage is admit-only — excluded by the intent, whose deliverable is live delivery and whose ledger entry states the predicates are already measured by `tests/api/couple-broadcast-authorization.spec.ts`.

**Follow-up review recommendation: false.** Patched entries by verdict: 1 medium, 4 low, 0 high. A first pass recommends a follow-up only on a patched high or two or more patched mediums; neither holds, and no specific unverified risk remains that a further pass would settle.

**Verification performed** (local Supabase running, CLI 2.117.0):
- `npx playwright test --project=chromium tests/e2e/notes/love-notes-realtime.spec.ts --retries=0`, five separate invocations after the patches — 5/5 passed, 6.7–7.1s wall each, test body 2.5–3.2s. Five more passed before the patches.
- `npx playwright test --project=chromium tests/e2e/notes` — 4 passed across 4 parallel workers; no interference with `love-notes.spec.ts`.
- `npx eslint tests/e2e/notes/love-notes-realtime.spec.ts` — clean.
- `npx tsc -b --force` — exit 0, zero errors. The worktree TS2883 baseline is 0 here rather than 6 because the new spec references the named types through a short specifier; a changed count there is not a regression.
- Teardown confirmed by query: `love_notes` holds zero rows matching `DW-90 realtime note %` after the runs.
- Implementer's negative controls, both reverted: routing the broadcast endpoint to a local 202 made the partner assertion fail (delivery is real, not a refetch); breaking the delete filter made the new row-count assertion fail with `Received length: 0`; making the join regex unmatchable produced the named error at 30.5s inside the new 180s bound.

**Residual risks.**
- The join gate matches a console line emitted by `useRealtimeMessages.ts:250`. Editing that log message breaks this spec with a named 30s failure rather than a silent one, but it does break it.
- A failed pre-join partner lookup would let `SUBSCRIBED` fire with `partnerIdRef` null and the note be dropped. Not observed in 10/10 runs and not guarded; it would present as a delivery failure.
- CI burns the spec in 5× at `--retries=0` (`test.yml:486-507`) on a 4-vCPU runner also hosting Supabase and Vite, which is slower than the machine these timings came from.
- `love_notes` still accumulates rows from `love-notes.spec.ts:51`, which has no teardown. Pre-existing and untouched.
