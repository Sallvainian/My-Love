---
title: 'Adopt playwright-utils in Playwright specs'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: '00ab451d2a8fe420684438b57b513a8a35836755'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
  - '{project-root}/.claude/skills/bmad-testarch-test-review/resources/knowledge/playwright-utils-mandate.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The two offline reconnect-read waits now resolve on the first matching GET, so a failed read in that window would throw where waitForResponse skipped it.
    evidence: |-
      interceptNetworkCall observe mode resolves on the first matching request and throws "No response received" when that request fails. page.waitForResponse ignored failed requests. The arm is set while offline, just before goOffline(false). To settle it, confirm the app sends no interactions or love_notes_visible GET between the arm and the reconnect (it passed 3 runs). If one can fail there, keep waitForResponse with a deviation comment.
    location: >-
      tests/e2e/offline/interactions-offline-copy.spec.ts:164; tests/e2e/offline/love-notes-offline-copy.spec.ts:252
    severity: medium (unverified)
  - summary: >-
      No fresh TEA re-review has confirmed the M9 fixes: recurseUntil call sites never name recurse, the deviation comments sit on the line above, and one reason repeats about 30 times.
    evidence: |-
      The registry row says the comment must be "on the line"; the mandate's Deviation Protocol says "a one-line comment above the code", and the diff follows the mandate. CAP-5's gate is a fresh bmad-testarch-test-review run on tests/e2e and tests/api reporting zero M9 and L9 rows. Running it settles this.
    location: >-
      tests/support/helpers/recurse.ts; tests/e2e/; tests/api/
    severity: medium (unverified)
  - summary: >-
      The favorites waits in account-data-offline-copy now resolve on the first matching GET, so a failed or cancelled read in the arm window would throw where waitForResponse skipped it.
    evidence: |-
      Same mechanism as the reconnect-read entry above, at two more sites. At ~231 the arm is set while offline, just before goOffline(false). At ~209 and ~268 the arm is set just before page.reload(), so a favorites refresh from the first load that is sent after the arm would be cancelled by the reload. Observe mode then gets a null response() and throws "No response received". To settle it, confirm that no FAVORITES_READ can be sent inside either window. If one can, keep waitForResponse with a deviation comment, or await the first-load read before arming. The spec passed in this run.
    location: >-
      tests/e2e/offline/account-data-offline-copy.spec.ts:209; tests/e2e/offline/account-data-offline-copy.spec.ts:231; tests/e2e/offline/account-data-offline-copy.spec.ts:268
    severity: medium (unverified)
  - summary: >-
      Hand-rolled page.on request/response listeners and a page.waitForEvent('requestfailed') have no deviation comment, and the acceptance grep does not look for them.
    evidence: |-
      These are pre-existing and none of the 50 M9 rows names them, but a fresh bmad-testarch-test-review might flag them as M9. Sites: display-name-setup ~173, partner-mood-realtime ~152-159, love-notes-realtime ~144-151, needs-a-connection ~95, account-data-offline-copy ~312, photos-offline ~328, and events-history-pagination ~241 (waitForEvent). The mandate lists page.on('response') under the network-error-monitor row. To settle it, run the CAP-5 re-review and check whether it reports any of these sites.
    location: >-
      tests/e2e/ (page.on('request'|'response'|'requestfinished'|'requestfailed') sites); tests/e2e/settings/events-history-pagination.spec.ts:241
    severity: medium (unverified)
  - summary: >-
      account-data.spec still asserts response.ok() on the body-matched mood save wait instead of the exact status.
    evidence: |-
      This is pre-existing: line 262 at the baseline, and the story only added a deviation comment above the wait. The story's exact-status rule was applied only to converted waits. `.ok()` accepts any 2xx, so the test proves slightly less than an exact 201 would. The fix is to assert the status the run returns (expected 201 for the POST upsert; confirm it on a run).
    location: >-
      tests/e2e/account-data/account-data.spec.ts:299
    severity: low
---

<intent-contract>

## Intent

**Problem:** 50 M9 rows (46 in `findings-e2e.md`, 4 in `findings-api-integration.md`) and the api advisory for `upload-love-note-image-limits.spec.ts:81` flag Playwright specs that hand-roll what `@seontechnologies/playwright-utils` provides: bare `expect.poll`, `page.route`/`page.waitForResponse` on app endpoints, and raw `request.post`/`fetch`. Nothing records why. `corrections.md` also flags a stale deviation comment in `events-persistence.spec.ts`. No L9 row exists: no spec imports `test` from `@playwright/test`, which is checked with grep.

**Approach:** Replace every bare `expect.poll` in `tests/e2e`, `tests/api` and `tests/support/helpers` with `recurse`, through one small helper. Replace each response wait that a method and URL glob can express with `interceptNetworkCall`, and each raw API call with `apiRequest`. Where the library cannot do the job, keep the vanilla call and put a `// playwright-utils deviation: <reason>` comment directly above it that states the real limit.

## Boundaries & Constraints

**Always:**
- A converted test proves the same thing or more. Keep every message, timeout and assertion. Where a wait asserted `.ok()`, assert the exact status the run returns.
- A deviation reason must be true of that call site. Use the facts in Design Notes; never write a vague reason.
- Import `{ test, expect }` from `tests/support/merged-fixtures.ts`. Use fictional fixture values only. Match the surrounding style by hand, and never run `prettier --write`.
- Make one commit per group (G1–G4), typed `test(e2e)`/`test(api)`.

**Never:**
- Touch other stories' rows: M1, H-rows, M2/L6, selectors and names, H5 splits. Leave these alone too: the partner-kit and partner-mood `interceptNetworkCall` registration race (story 2 deferred it), `tests/e2e-archive/`, `tests/support/fixtures/**`, config, and app code.
- Change routes that only block images or Storage objects (`dock.spec.ts`, `photo-gallery.spec.ts`, and the `STORAGE` routes in `photos-offline` and `love-notes-offline-copy`). The mandate exempts them.
- Replace an awaited `page.route` that must be in place before the next navigation with `interceptNetworkCall`.

</intent-contract>

## Code Map

- `node_modules/@seontechnologies/playwright-utils` v4.4.0 (resolved from the main checkout). The facts below were read from `dist/esm` and are relied on:
  - `recurse(cmd, pred, {timeout=30000, interval=1000, log})`. Its predicate is called without `await`. An `expect(` failure counts as a retry. Any other throw, or a throw from `cmd`, is fatal at once, as in `expect.poll`. It throws `RecurseInternalError` when the last value is falsy (0, false, null, ''). On timeout it throws `RecurseTimeoutError` with a generic message. It is exported from `@seontechnologies/playwright-utils/recurse`.
  - `interceptNetworkCall`:
    - It registers its route or `waitForRequest` inside `test.step`, after the caller's next statement has already run.
    - It resolves on the first match only and never unroutes.
    - With `fulfillResponse` or `handler`, it calls the handler for every match.
    - Matching uses only the method and a picomatch glob over the whole URL (see the rules in `tests/support/helpers/reads.ts`).
    - The fixture drops `timeout`. The standalone `interceptNetworkCall({ page, … })` from `@seontechnologies/playwright-utils/intercept-network-call` accepts it.
  - `apiRequest({method, path, baseUrl?, headers, body, retryConfig, testStep})` returns only `{status, body}`: no headers and no redirect control. By default it retries 5xx responses and network errors; `retryConfig: { maxRetries: 0 }` turns that off. It passes a Buffer `body` through as Playwright `data` (`corrections.md`).
- `tests/support/helpers/reads.ts` holds the read globs and `SECOND_CONTEXT_READ_TIMEOUT`. Reuse them, and add a glob here when two specs share it.
- Repo `recurse` examples: `tests/e2e/settings/events-refresh-unmount.spec.ts` ~59 and `tests/e2e/settings/events-accessibility.spec.ts` ~185. Existing deviation wording: `tests/e2e/auth/login.spec.ts` ~87 and `tests/api/empty-database-error-fallback.spec.ts` ~26.
- Sites (find each by content; lines are approximate). Every `expect.poll` or `await expect` + newline + `.poll(` in the files below is in scope (88 grep hits, comments included).

## Tasks & Acceptance

**Execution:**
- `tests/support/helpers/recurse.ts` (new): `POLL` = `{ timeout: 15_000, interval: 100 }`, which matches the expect timeout in `playwright.config.ts`. Also `recurseUntil`, as in Design Notes.
- **G1** covers `account-data/`, `auth/`, `home/`, `mood/`, `notes/`, `partner/` and `photos/` in `tests/e2e`, plus the new helper:
  - Every `expect.poll` becomes `recurseUntil`.
  - Response waits become `interceptNetworkCall`:
    - `cross-device` ~23, ~91, ~102, ~114. The second-context page uses the standalone form.
    - `love-notes-realtime` ~195 and `partner-mood-realtime` ~200: standalone, keeping `timeout: 30_000` and its comment.
    - `google-oauth` ~37+~50: one `interceptNetworkCall` with a `handler` that records the URL and fulfils the 302. Awaiting it replaces the `waitForRequest`.
  - These keep their vanilla call with a deviation comment:
    - `account-data` ~253 (matches on the request body)
    - `logout` ~227/231/235 (`serve` stubs)
    - `events.spec` ~183/419/498 (holds and counters)
    - `token-persistence-overlap` ~295 (counts every request)
    - `error-boundary` ~38/61 (an app JS module, not an API)
- **G2** covers `tests/e2e/settings/` and `tests/support/helpers/settings-screen.ts`:
  - Polls become `recurseUntil`.
  - Response waits become `interceptNetworkCall`:
    - `events-crud` ~136/178/209/342.
    - `couple-start-date` ~108 and `birthdays-wedding` ~110/123/179: standalone on `partnerPage` with `SECOND_CONTEXT_READ_TIMEOUT`.
    - `events-history-pagination` ~23: load-more has an `or=` param, so confirm the glob against a real URL.
    - `events-history-pagination` ~40: use `responseJson` for the saved id.
    - `events-history-pagination` ~187: `UPCOMING_EVENTS_READ`.
  - Deviation comments: `events-crud` ~307 (holds the response with `route.fetch`), `events-history-pagination` ~215 (gate and abort), `events-load-recovery` ~125 (abort).
  - `events-persistence` ~122-130: delete the stale sentence about `events-crud` using `waitForResponse`.
- **G3** covers `tests/e2e/offline/`:
  - Polls become `recurseUntil`.
  - Response waits become `interceptNetworkCall`, with `responseJson` replacing `response.json()`:
    - `interactions-offline-copy` ~159
    - `love-notes-offline-copy` ~244
    - `account-data-offline-copy` ~183/~242 (`FAVORITES_READ`)
    - `needs-a-connection` ~680
  - Every abort or stub `page.route` gets a deviation comment. That covers `love-notes-offline-send`, `mood-offline-copy`, `interactions-offline-copy`, `photos-offline` ~195, `couple-settings-offline`, `love-notes-offline-copy` ~192, `account-data-offline-copy` ~158/283/284, `events-offline-copy`, `birthdays-wedding-offline` and `needs-a-connection` ~324/327/346/360/561.
- **G4** covers `tests/api/`:
  - `pkce-code-exchange`:
    - `waitForVerifyLink` becomes `recurseUntil` over `apiRequest` calls to Mailpit (`baseUrl: MAILPIT_URL`, `maxRetries: 0`). Keep the "no link" message and the 15 s timeout, and update its comment.
    - The SDK fetch wrapper (~52) and the manual-redirect verify fetch (~162) get deviation comments.
  - `couple-broadcast-authorization` ~496: `apiRequest` with `maxRetries: 0`. The 202 assertion stays.
  - `upload-love-note-image-limits`:
    - The four `request.post` calls whose tests read no response header become `apiRequest` with `maxRetries: 0`.
    - The first test reads `x-ratelimit-remaining`, so its call gets a deviation comment.
    - The in-browser Blob `fetch` (~281) also gets a deviation comment: it is the thing being measured.

**Acceptance Criteria:**
- Given `tests/e2e`, `tests/api` and `tests/support/helpers`, when grepped for `expect.poll` and a line-leading `.poll(` outside comments, then nothing is found.
- Given every remaining `page.route(`, `.waitForResponse(`, `.waitForRequest(`, raw `request.<method>(` or Node-side `fetch(` in `tests/e2e` and `tests/api`, when read, then it is either an exempt image or Storage route or has a `// playwright-utils deviation:` comment on the line directly above it that states the site's real limit.
- Given every spec under `tests/`, when grepped for a value import of `test` from `@playwright/test`, then nothing is found (L9).
- Given every changed spec, when run on its Playwright project, then it passes. When each group's representative wait is broken on purpose (a wrong glob or a wrong expected value), the test fails at that wait and reports the check's own diff. Restore the code afterwards.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 36 findings — high 0, medium 7, low 21, false 6, maybe-false 2
- findings:
  - `[low]` `[patch]` Blind: the stock deviation reason says interceptNetworkCall "resolves on the first match", but its `handler` runs for every match — reworded all 32 comments to state the real limit (a route registered inside a test.step the caller cannot await).
  - `[low]` `[patch]` Blind: `events.spec` ~421/~501 say "next navigation" before a dock click — grouped with the row above; comments now name the trigger (dock navigation, press, send). Also fixed at `events-crud` ~301 and `events-history-pagination` ~230.
  - `[medium]` `[patch]` Blind: google-oauth replaced an awaited `page.route` with an un-awaited handler route and has no timeout (the spec contradicted its own Never list) — restored an awaited `page.route` with a deviation comment; the wait is the standalone observe form with `timeout: 15_000`.
  - `[low]` `[patch]` Blind: the kept 30 s broadcast comment no longer describes the code, since the observe `timeout` bounds only `waitForRequest` — comments rewritten in both realtime specs. `broadcastRequest!` is safe: observe always returns the request.
  - `[false]` `[reject]` Blind: each failed retry adds a failed step, where `expect.poll` made one — `invokePollMatcher` also calls `callMatcherAsStep` on every attempt (`playwright/lib/matchers/expect.js` ~13393), so the old code recorded a step per attempt too.
  - `[low]` `[reject]` Blind: a fixed 100 ms interval replaces expect.poll's backoff, adding up to 150 local DB or Mailpit calls per poll — local-only load that nobody meets in practice; slowing each site means adding parameters.
  - `[low]` `[reject]` Blind: every poll logs the same "Polling until condition is met" step — report noise only; labelling needs a new option at about 85 sites.
  - `[low]` `[reject]` Blind: `COUPLE_SETTINGS_SAVE` is the same string as `COUPLE_SETTINGS_READ` — documented as observe-with-POST, following the `LOVE_NOTE_SEND` convention; no caller diverges.
  - `[low]` `[patch]` Blind: globs shared by two specs were left inline (custom_messages POST, events write) against the spec's reads.ts rule — added `CUSTOM_MESSAGE_SAVE` and `EVENTS_WRITE` to `reads.ts` and used them in cross-device, needs-a-connection, events-crud, events-history-pagination and events-persistence.
  - `[low]` `[reject]` Blind: `read: () => Promise<T>` forces `async` wrappers on counter polls — cosmetic; no defect.
  - `[false]` `[reject]` Blind: `UploadReply` is non-null although apiRequest can return a null body, so a TypeError could come before cleanup — the old `await response.json()` threw at the same point, and the function always answers JSON, so nothing regressed.
  - `[low]` `[reject]` Blind: birthdays-wedding picks 200 or 201 from a pre-read, and the pair-key expression now appears a third time — the result is correct and deterministic per run; a setup change or shared helper is more than a direct correction.
  - `[low]` `[reject]` Blind: the converted polls use three layouts — cosmetic, and normalising them rewrites many lines by hand.
  - `[low]` `[reject]` Blind: pkce uses the standalone `apiRequest` and the raw `request` fixture — both are valid library entry points; no harm.
  - `[low]` `[reject]` Edge: when the test deadline cuts a poll short, recurse's error is not a `RecurseTimeoutError`, so the diff re-check is skipped — rare (the test is timed out anyway) and would need a message-matching guard.
  - `[low]` `[patch]` Edge: a promise returned by an async check could also surface as an unhandled rejection — fixed with the check-return guard: a returned promise gets a no-op `.catch` before the refusal.
  - `[medium]` `[patch]` Edge: google-oauth route registration races the click — same entry as the Blind google-oauth row; fixed there.
  - `[medium]` `[patch]` Edge: google-oauth wait has no timeout — same entry; fixed there.
  - `[maybe-false]` `[defer]` Edge: the observe waits on the reconnect read in interactions-offline-copy and love-notes-offline-copy would throw if an earlier matching GET failed — settle by confirming the app sends no such read between the arm and the reconnect; deferred as medium (unverified).
  - `[medium]` `[patch]` Edge: claim that google-oauth breaks the Never rule and its comment claims an ordering it lacks — same entry; fixed there.
  - `[low]` `[reject]` Edge: claim that a break at the test deadline shows a generic error, not the diff — same as the deadline row above; the recorded break tests showed the diff.
  - `[medium]` `[patch]` Verification gap: `recurseUntil`'s timeout diff, check guard and unwrap had no test — added `tests/unit/helpers/recurse.test.ts` (5 cases: falsy reading, timeout diff, boolean and promise checks refused, read error unwrapped); it runs under Vitest.
  - `[medium]` `[patch]` Verification gap: a boolean-returning check was ignored and passed on the first reading (the repo's existing `recurse` style) — the guard now refuses any return value other than `undefined`.
  - `[low]` `[patch]` Verification gap: the 30 s timeout comment is stale — same entry as the Blind realtime row; fixed there.
  - `[maybe-false]` `[defer]` Intent: no fresh TEA re-review confirms the conversions (recurseUntil naming, comment placement, one reason repeated) — settle with a bmad-testarch-test-review run; deferred as medium (unverified).
  - `[low]` `[patch]` Intent: the deviation reason is applied unevenly (google-oauth converted, the serve stubs kept) — grouped with the reason-wording and google-oauth entries; now consistent.
  - `[low]` `[patch]` Intent: the account-data row also cites the `await response.json()` of the deviated wait, which had no comment — added a one-line deviation comment above it.
  - `[low]` `[reject]` Intent: step 2 of the Deviation Protocol (a `Playwright Utils deviations` summary list) is missing — the fix edits this build's spec; the list is given under Auto Run Result.
  - `[medium]` `[patch]` Intent: `recurseUntil` has no committed test — same entry as the verification-gap test row; fixed there.
  - `[low]` `[reject]` Intent: poll timing changed from backoff to a fixed interval — same as the Blind interval row.
  - `[false]` `[reject]` Intent: a stubbed call's status is a made-up 200 — no spec asserts a fulfilled call's status; google-oauth now uses a plain `page.route`.
  - `[low]` `[reject]` Intent: look-alike glob names — same as the Blind `COUPLE_SETTINGS_SAVE` row.
  - `[low]` `[reject]` Intent: the wedding status depends on a database pre-read — same as the Blind birthdays-wedding row.
  - `[false]` `[reject]` Intent: commit grouping by folder, not rule id — the spec defines the groups G1–G4 and the invocation asks only for one commit per finding group.
  - `[false]` `[reject]` Intent: lint, typecheck and e2e are not evidenced — all were run; results are under Auto Run Result.
  - `[false]` `[reject]` Intent: the story file is not the intent — an observation about provenance, not a defect.

### 2026-09-25 — Review pass
- verdicts: 28 findings — high 0, medium 0, low 17, false 5, maybe-false 6
- findings:
  - `[low]` `[reject]` Blind: triage rows point to an `## Auto Run Result` that the reviewed tree no longer has. The fix edits this build's spec, and Finalize writes a new section.
  - `[low]` `[reject]` Blind: the Design Notes `recurseUntil` sketch and the first deviation-reason bullet are stale against the committed helper and comments. The fix edits this build's spec.
  - `[low]` `[patch]` Blind: the story-2 deviation comment at `login.spec.ts` ~88 says interceptNetworkCall "cannot serve a read that may fire any number of times", which is false with a `handler`, and it sits directly above this story's four accurate comments. Deleted the stale three lines; each route below keeps its own comment.
  - `[maybe-false]` `[defer]` Blind: `page.on` request/response listeners and `waitForEvent('requestfailed')` have no deviation comment and the AC grep skips them. They are pre-existing and none of the M9 rows names them; whether a re-review flags them is unknown. Deferred as medium (unverified).
  - `[low]` `[reject]` Blind: pre-existing bare `recurse` calls (couple-broadcast-authorization and 8 other files) keep the generic timeout message. These sites already use the library, so the intent does not ask to convert them. The harm shows only when those tests fail, and the fix converts about 20 call sites.
  - `[low]` `[patch]` Blind: the `recurse.ts` header said a bare `recurse` would ignore a boolean check, but `recurse.js:205` retries on `false`. Reworded: an async check would pass at once on its promise, and a boolean check has no assertion to re-run for the diff.
  - `[low]` `[reject]` Blind: `POLL.timeout` copies `expect.timeout` instead of reading it at run time. The spec prescribes the constant. Drift needs a config change, and the fix adds a runtime lookup with a fallback.
  - `[low]` `[patch]` Blind: the pkce Mailpit poll wraps each `apiRequest` in its own report step (`api-request.js:238`), one or two per 100 ms tick. Added `testStep: false` to the `mailpit` helper. The extra `apikey` and `Content-Type` headers the reviewer named are harmless to Mailpit, so they were left as they are.
  - `[low]` `[reject]` Blind: the spec's counts ("32 comments", "about 30 times") do not match grep. The fix edits this build's spec; this pass's result uses grep counts.
  - `[low]` `[patch]` Blind: the `reads.ts` header still said every glob goes to `interceptNetworkCall({ method: 'GET', url })`, but the file now holds write globs too. Reworded the header. The inline `message_favorites` and `anniversaries` POST globs in cross-device are each used by one spec, which the reads.ts rule allows, so they are unchanged.
  - `[false]` `[reject]` Blind: `HISTORY_PAGE_READ` (`events?*&or=*`) assumes `or` is never the first parameter. `eventsService.ts:339-341` always calls `.select('*')` before `.or(...)`, so `select=` always comes first.
  - `[false]` `[reject]` Blind: google-oauth's route (`authorize**`) and wait (`authorize*`) would diverge on an unencoded `/`. auth-js builds every authorize parameter with `encodeURIComponent`/`URLSearchParams` (`GoTrueClient.js` ~4800-4815), so the query never holds a raw `/`.
  - `[low]` `[reject]` Blind: a timeout with no reading at all rethrows recurse's generic error without the check's message, and no test covers it. This needs a read to hang for the whole 15 s budget, which is rare, and the fix adds a branch and a test.
  - `[maybe-false]` `[defer]` Edge: the favorites observe arm at `account-data-offline-copy` ~231 is set while offline and would throw if a GET failed in that window. Same mechanism as the deferred reconnect-read entry, at a new site; deferred with the next row as medium (unverified).
  - `[maybe-false]` `[defer]` Edge: the favorites arms at `account-data-offline-copy` ~209/~268 precede a reload that could cancel a late first-load refresh. Grouped with the row above; settle by confirming no FAVORITES_READ is sent inside either window.
  - `[low]` `[reject]` Edge: no reading before the deadline loses the check's message. This is the same claim as the Blind no-reading row, rejected there.
  - `[low]` `[reject]` Edge: the google-oauth task bullet describes code that does not exist. The fix edits this build's spec; the triage log already records the change.
  - `[low]` `[reject]` Edge: the realtime task bullet says to keep the 30 s comment, which was rewritten. The fix edits this build's spec; the triage log already records the change.
  - `[low]` `[patch]` Verification gap: no test pins the `.catch` guard for an async check that rejects; deleting it left all 5 unit tests green. Added the case "refuses an async check that rejects, without an unhandled rejection" to `recurse.test.ts`.
  - `[maybe-false]` `[defer]` Intent: no fresh re-review confirms M9 compliance (the `recurseUntil` naming, the comment placement, the mandate's "interceptNetworkCall declared before page.goto" wording). carried: same claim as the logged TEA re-review row, which is still deferred; not deferred again.
  - `[false]` `[reject]` Intent: whether an observe arm is registered before the next `goto` is UNVERIFIED. It is: `_step` (`playwright/lib/common/index.js:2397`) awaits only `_onUserStepBegin`, which is unset without a `testAnnotate` option (none in `playwright.config.ts`). `waitForRequest` then adds its listener without a protocol round-trip, so it is in place before any request event can arrive.
  - `[maybe-false]` `[defer]` Intent: observe waits take the first matching request and throw if it fails (the reconnect reads). carried: same claim as the logged reconnect-read row, still deferred; not deferred again.
  - `[low]` `[patch]` Intent: the realtime `timeout: 30_000` now bounds only the send wait. carried: same claim as the logged realtime-comment row; the comments still read as that row describes.
  - `[false]` `[reject]` Intent: some globs match different requests than the old checks (`HISTORY_PAGE_READ`, `homeRead` narrowed to `UPCOMING_EVENTS_READ`, `authorize*`). `select=` always leads the load-more query; every home load sends the upcoming read (the spec task named `UPCOMING_EVENTS_READ`); and the authorize query is fully encoded.
  - `[low]` `[defer]` Intent: `account-data.spec.ts:299` still asserts `response.ok()` at the kept body-matched wait. This is pre-existing (baseline line 262) and the story only added its comment, so it is deferred as low.
  - `[low]` `[reject]` Intent: the Deviation Protocol summary list and the verification evidence are absent from the reviewed spec. carried: same as the logged Deviation Protocol row; both are given again under Auto Run Result.
  - `[false]` `[reject]` Intent: there is an extra review-patch commit besides G1–G4. The four group commits exist as asked; a later review-patch commit does not break the grouping.
  - `[maybe-false]` `[defer]` Intent: `page.on('response')` and requestfailed counters are left alone. Grouped with the Blind `page.on` row and deferred there as medium (unverified).

## Design Notes

```ts
export async function recurseUntil<T>(read: () => Promise<T>, check: (value: T) => void,
  options: { timeout?: number; interval?: number; log?: string } = {}): Promise<T> {
  let last: { value: T } | undefined;
  try {
    const boxed = await recurse(async () => (last = { value: await read() }), ({ value }) => {
      if ((check(value) as unknown) instanceof Promise) throw new Error('recurseUntil: check must be synchronous');
    }, { ...POLL, ...options });
    return boxed.value;
  } catch (error) {
    if (error instanceof RecurseTimeoutError && last) check(last.value); // report the assertion's own diff
    throw error;
  }
}
```
- Why the helper exists:
  - The value is boxed, so a falsy reading can pass.
  - The check has to be synchronous, because `recurse` never awaits its predicate.
  - When it times out, it runs the check once more on the last reading, so the failure shows the real diff and not `recurse`'s generic message.
- How to convert a poll: `await expect.poll(fn, { message, timeout }).toX(y)` becomes `await recurseUntil(fn, (v) => { expect(v, message).toX(y); }, { timeout })`, and `.not` carries over.
- Deviation reasons, use whichever is true at the site:
  - "the route must be installed before the next navigation and answer every match; interceptNetworkCall starts its route after the caller moves on and resolves on the first match"
  - "matches on the request body (or on an absent query param), which a method + URL glob cannot express"
  - "apiRequest returns no response headers / cannot disable redirects"
  - "the SDK's own fetch is what is measured"

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0. The worktree-only TS2883 in `merged-fixtures.ts` is the known baseline.
- `npx playwright test <changed e2e specs> --project=chromium` (local Supabase running) -- expected: all pass. Re-run any spec that fails with `--repeat-each=2` before concluding.
- `npx playwright test tests/api/pkce-code-exchange.spec.ts tests/api/couple-broadcast-authorization.spec.ts tests/api/upload-love-note-image-limits.spec.ts --project=api` -- expected: pass. The upload spec needs the edge runtime (`supabase functions serve` in the background if it is stopped). If it cannot run, record that.
- The grep checks in the Acceptance Criteria -- expected: nothing reported.


## Auto Run Result

**Summary:** The Playwright specs in `tests/e2e` and `tests/api` use the installed playwright-utils helpers:
- Every bare `expect.poll` goes through `recurseUntil`, a wrapper over `recurse` in `tests/support/helpers/recurse.ts`.
- Response waits that a method and URL glob can express use `interceptNetworkCall`.
- Raw API calls that read no response header use `apiRequest` with retries off.

Where a helper cannot do the job, the vanilla call keeps a one-line `// playwright-utils deviation:` comment directly above it. The stale `events-persistence` sentence is gone. L9 needed no change.

This was a follow-up review pass. It found nothing high or medium and made five small fixes (commit on top of `4a04bcd1f0f84130c9a257f9fcaf3f4a61ae68c4`).

**Commits in the story:**
- `2f0f27f4ca89cdd16574e73adfad9088e86a44aa`: G1.
- `a4e05ae756e33ff35f23a5d4a232d350a6f843b7`: G2.
- `678b003f1a4dec15eb761fbb2833de52920a3d63`: G3.
- `e1f33c902156cb589b5560ca460b6e72ff519c81`: G4.
- `8b8ecd036cf03fe904249d136160dce3fa65e266`: first-pass review patches.
- `4a04bcd1f0f84130c9a257f9fcaf3f4a61ae68c4`: the first spec record.
- This pass's commit.

**Files changed by this pass:**
- `tests/e2e/auth/login.spec.ts`: deleted the stale story-2 deviation comment above `serve`.
- `tests/support/helpers/recurse.ts`: header now gives the true reason booleans and promises are refused.
- `tests/support/helpers/reads.ts`: header now covers the write globs.
- `tests/api/pkce-code-exchange.spec.ts`: the Mailpit `apiRequest` passes `testStep: false`.
- `tests/unit/helpers/recurse.test.ts`: new case for an async check that rejects (6 cases now).

**Files changed across the story:** 39 files since the baseline:
- `recurse.ts` and its unit test (both new);
- `reads.ts` (`COUPLE_SETTINGS_SAVE`, `CUSTOM_MESSAGE_SAVE`, `EVENTS_WRITE`);
- `settings-screen.ts`;
- 30 e2e specs and 3 api specs.

**Playwright Utils deviations.** grep counts 46 comment lines in 29 spec files under `tests/e2e` and `tests/api`. The reasons are:
- **The route must be in place before the next step.** The next step is a `goto`, `reload`, dock navigation, press or send, and the route must answer, abort, hold or count every match. interceptNetworkCall registers its route inside a test.step the caller cannot await. This covers the `login`/`logout` stubs, `events.spec`, `events-crud`, `events-history-pagination`, `events-load-recovery`, `token-persistence-overlap`, `error-boundary`, `google-oauth`, and every offline abort.
- **The match needs more than a method and a URL glob.** This covers `account-data` ~290 (the request body) and `needs-a-connection` ~349 (either of two query shapes).
- **apiRequest returns no headers and cannot disable redirects.** This covers `pkce-code-exchange` ~178 and the first `upload-love-note-image-limits` case.
- **The fetch is what is measured.** This covers the pkce SDK fetch wrapper and the browser Blob upload.
- **Exempt, unchanged:** the four Storage and image routes in `dock`, `photo-gallery`, `photos-offline` and `love-notes-offline-copy`.

**Review, follow-up pass: 28 findings.** High 0, medium 0, low 17, false 5, maybe-false 6.
- **Patched, 5 entries, all low:**
  - the stale login deviation comment;
  - the `recurse.ts` header;
  - the pkce report-step flood;
  - the `reads.ts` header;
  - the missing test for a rejecting async check.
- **Deferred, 3 new entries:**
  - the account-data-offline-copy favorites observe waits: medium (unverified);
  - the uncommented `page.on`/`waitForEvent` network listeners: medium (unverified);
  - the `response.ok()` at `account-data` ~299: low, pre-existing.
- **Carried:** 2 rows stay under the existing deferred entries (the TEA re-review and the reconnect reads), and 2 more keep their earlier routes.
- **Rejected, with reasons in the triage log:**
  - 5 findings whose fix edits this spec: the missing Auto Run Result, the stale Design Notes, the counts, the google-oauth task bullet and the realtime task bullet;
  - 3 lows: the pre-existing bare `recurse` calls, `POLL` copying the config value, and a timeout with no reading, which counts twice (Blind and Edge);
  - 5 false: the `or=` glob, the authorize glob, the observe registration race, the glob-set changes, and the commit grouping.

**Follow-up review recommended: false.** This follow-up pass patched 0 high, 0 medium and 5 low entries. Without a patched high the work has converged. The open risks are recorded as deferred entries.

**Verification (after patches):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0, with 0 `error TS` lines.
- `npm run test:unit`: 156 files, 2802 tests passed.
- The 30 changed e2e specs on `--project=chromium`: 87 passed. `token-persistence-overlap` was left out, as in the first pass.
- `pkce-code-exchange`, `couple-broadcast-authorization` and `upload-love-note-image-limits` on `--project=api`: 14 passed. `supabase functions serve` was started for this run and stopped afterwards.
- The acceptance greps:
  - no `expect.poll` or line-leading `.poll(` outside comments;
  - every remaining route, response wait, raw request or Node fetch has a deviation comment directly above it, except the 4 exempt Storage routes;
  - no spec imports `test` from `@playwright/test` (only the fixture files under `tests/support` do).

**Residual risks:**
- The CAP-5 gate still rests on a fresh `bmad-testarch-test-review` of `tests/e2e` and `tests/api` (deferred).
- The observe waits at the offline reconnect reads and the account-data-offline-copy favorites reads are unverified against a failed or cancelled read in their arm windows (deferred).
- `tests/e2e/auth/token-persistence-overlap.spec.ts` was not run. It reads `<worktree>/node_modules/@playwright/test/package.json` when it loads, and this worktree has none.
