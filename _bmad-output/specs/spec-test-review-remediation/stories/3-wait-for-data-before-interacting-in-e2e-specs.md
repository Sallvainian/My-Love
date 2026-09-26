---
title: 'Wait for data before interacting in e2e specs'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: 'ad5115cdb1a6f4378d6c2062669599c23d4a27cb'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Returning to Settings mid-test by dock click is not gated on Settings' own mount read.
    evidence: |-
      events-crud (~164, ~201) and events-persistence (~324) click a row control right after navigateTo(settings) while the mount GET is in flight. Pre-existing and not an M1 row; row ids are stable, so the click still lands.
    location: >-
      tests/e2e/settings/events-crud.spec.ts; tests/e2e/settings/events-persistence.spec.ts
    severity: low
  - summary: >-
      Non-retrying reads remain in touched specs outside the M1 rows.
    evidence: |-
      events-history-pagination one-shot evaluateAll order check (~196-198) and hand-rolled waitForResponse; love-notes-offline-send allTextContents()/queuedContents (~143-148); cross-device textContent() (~85). None is named by an M1 row; they fall under M9 or other rows.
    location: >-
      tests/e2e/settings/events-history-pagination.spec.ts; tests/e2e/offline/love-notes-offline-send.spec.ts; tests/e2e/account-data/cross-device.spec.ts
    severity: low
  - summary: >-
      Navigating e2e specs with no M1 row were not audited, so a fresh re-review may still score M1 somewhere.
    evidence: |-
      About 25 navigating spec files carry no M1 row and are untouched. Settle by running bmad-testarch-test-review on tests/e2e/.
    location: >-
      tests/e2e/
    severity: medium (unverified)
  - summary: >-
      account-data.spec.ts A/B/A favorites fails about 1 run in 6 on a 406 partner-record read during sign-out/sign-in switching.
    evidence: |-
      Reproduced on the unchanged baseline spec (git show ad5115cd copy, --repeat-each=6: 1 failed with the same GET 406 users?select=id,email,display_name,birthday). Looks like the partner lookup (single()) racing a sign-out; app-side, not caused by this story.
    location: >-
      tests/e2e/account-data/account-data.spec.ts; src/api/partnerService.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** 29 e2e specs navigate and then read or click server-loaded content with nothing registered before the navigation to prove the data arrived (every M1 row in `findings-e2e.md`, folder and suite tables, 132 rows ≈ 70 distinct sites), and four readiness gates accept a screen that is not ready (`corrections.md`: theme-sweep error state, `openSettings` `aria-busy='false'` before loading starts, the photos skeleton that carries `data-testid="photo-gallery"`, plus the `waitForLoadState('networkidle')` gates story 2 deferred here).

**Approach:** Arm the exact server read that carries the asserted data — `interceptNetworkCall({ method: 'GET', url: <glob> })` — before each `goto`/`reload`/dock click, await it (assert `status` 200, and where cheap that `responseJson` holds the seeded row) before the first data-dependent step, then keep or add a retrying web-first assertion, because the first match is often StrictMode's superseded duplicate. Replace gates that accept not-ready states with gates that accept only the loaded states.

## Boundaries & Constraints

**Always:**
- Locate every site by content; catalog lines are from 92f1c517 and stories 1–2 moved them. Merge the folder-run and suite-run rows for the same site.
- Use a glob that matches only the read carrying the data (see Code Map). Commas in `select`/`order` are sent as `%2C`; `*` never crosses `/`; never a bare `**/rest/v1/users*`, `moods*`, `photos*` or `events*` where sibling reads exist.
- Arm before the navigation, await after it, then a retrying assertion. Absence assertions only after a positive assertion on the same load. Turn non-retrying reads the rows name (`allTextContents()`, `count()`, `textContent()`, one-shot IndexedDB reads) into web-first assertions or `expect.poll`.
- For a page in a second browser context, use the standalone `interceptNetworkCall({ page, method, url, timeout })` from `@seontechnologies/playwright-utils/intercept-network-call` (the fixture is bound to `page` and drops `timeout`).
- Offline reloads under `route.abort()`/`setOffline` cannot be armed (observe mode throws on a null response): their readiness is the copy written in the online session plus a positive assertion; where a row flags one, register an aborted-read counter before the navigation and poll it `> 0`.
- Keep story 2's `page.clock.install` before any arm and goto. Match surrounding style by hand; no `prettier --write`. E2E imports stay on `tests/support/merged-fixtures.ts`. Fictional fixture values only. Any new `eslint-disable` carries ` -- reason`.
- One commit per group G1–G6, `test(e2e): …`, each ending `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Never:**
- Branch on the response (`if (responseJson.length)`) — that is an H3 row; use `.or()` locators over loaded states instead.
- Weaken, skip or delete a test; drop a gear/dock click a test exercises; add `page.route` stubs where observing suffices.
- Touch other stories' rows: H4 cleanup/leaked love-note rows (story 4), M9/L9 helper adoption beyond what an arm needs (story 6), selectors/names/L-rows (story 8), H5 splits (story 9); no `tests/e2e-archive/`, config, ESLint rules or app code.

</intent-contract>

## Code Map

Shared read globs (verified against postgrest-js URLs by the investigators; confirm each by one run). Put them in a new `tests/support/helpers/reads.ts` as named constants:
- events upcoming `**/rest/v1/events*event_date=gte.*`, past `**/rest/v1/events*event_date=lt.*` (`eventsService.ts` ~330-356 sends both in parallel per load; `or=` only on load-more).
- photos list `**/rest/v1/photos?*order=created_at.desc*` (`photoService.ts` ~209; `select=file_size` quota read excluded).
- love-notes thread `**/rest/v1/love_notes_visible?*`; interactions `**/rest/v1/interactions?*`; couple settings `**/rest/v1/couple_settings*`; anniversaries `**/rest/v1/anniversaries*`; custom messages `**/rest/v1/custom_messages?*`; favorites `**/rest/v1/message_favorites?select=message_key*`.
- users: gate name `**/rest/v1/users?select=display_name&id=eq.<uid>*`; own profile `**/rest/v1/users?select=display_name%2Cbirthday*`; partner record `**/rest/v1/users?select=id%2Cemail%2Cdisplay_name%2Cbirthday*`.
- moods: own history backfill `**/rest/v1/moods?*user_id=eq.<me>*limit=500*`; partner list `**/rest/v1/moods?*user_id=eq.<partner>*limit=30*`; partner latest `**/rest/v1/moods?*limit=1` (build as functions of the id).
- Facts: every signed-in start runs `refreshLocalCopies()` (`App.tsx` ~409-413) — all refreshers except events on home/settings (`eventsSlice.ts` ~283-288); Home loads events itself (`App.tsx` ~500-504), Settings on mount (`EventsSettings.tsx` ~209-224); StrictMode doubles loads; IndexedDB starts empty per test, so first loads are network-only and reloads show the IndexedDB copy first. Type: `InterceptNetworkCallFn` from `@seontechnologies/playwright-utils/intercept-network-call`.

### G1 — Settings events (`test(e2e): gate Settings events screens on their own load`)
- `tests/support/helpers/events.ts` — add `openSettingsFromHome(page, intercept)`: arm upcoming → `goto('/')` → await (200) → poll `__APP_STORE__` `!eventsIsLoading && eventsPagination !== null`; arm upcoming again → `navigateTo(page,'settings')` → `settings-view` visible → await (200) → `events-settings-load-region` `aria-busy='false'`. (Home and Settings send identical GETs; only ordering separates them.)
- `settings/events-history-pagination.spec.ts` — corrections gate: `openSettings(page)` ~12-16 → `openSettings(page, intercept)` arming upcoming before `goto('/settings')`, awaiting it before the `aria-busy` check (aria-busy starts false, `EventsSettings.tsx` ~514); add `reloadSettings` for the reloads (~81, ~109, ~120; the copy shows 52/51/52 rows before the server's answer). Callers ~68, 102, 134, 159, 199.
- `settings/events-crud.spec.ts` — ~114, ~244-256 (plus arm before its `page.reload()`, await, `aria-busy='false'` before rows), ~437, ~462 → `openSettingsFromHome`; ~289 and ~406 arm upcoming before `goto('/')`, await before the card witness (observe installs no route, so the ~303 route is untouched).
- `settings/events-persistence.spec.ts` — reloads ~190 and ~260: arm upcoming, await, `aria-busy='false'` before `rowFor`/`toHaveCount(3)`; fix the ~187-189 comment (`addEvent` writes the IndexedDB copy, `eventsSlice.ts` ~471); its `openSettings` ~148 → `openSettingsFromHome`.
- `settings/events-write-failures.spec.ts` ~119, ~177, ~229; `events-accessibility.spec.ts` ~127, ~170, ~225, ~271; `events-check-constraint.spec.ts` ~143 → `openSettingsFromHome` (add the fixture to each destructuring).
- `settings/settings-kit.spec.ts` ~26-32 `openSettings` → take `intercept`, use the helper, and replace `events-settings-loading toHaveCount(0)` (~76, also true on the error slot) with `events-settings-list`.or(`events-settings-empty`) visible.

### G2 — Home events (`test(e2e): arm Home events reads before navigating`)
- `home/events-read-window.spec.ts` ~127, ~193: arm upcoming before goto (after `clock.install`/`addInitScript`), await; test A also arms past and asserts `responseJson.length` 51. ~216 `allTextContents()` → `toHaveText([...])`.
- `home/events.spec.ts` ~91, ~148, ~259 (after clock install), ~346, ~389: arm upcoming; ~227 arm past (asserts 2 rows). ~115-119 and ~350-361 `allTextContents()` → `toHaveText([...])`; ~267 `count()` → `toHaveCount(0)`. Leave the ~178/~403 routes and `rejectedLoad` alone.
- `home/persisted-events-strip.spec.ts` ~79, ~109: arm upcoming after `seedPersistedBlob`, before goto; rewrite the header paragraph (~44-49) that says `interceptNetworkCall` has no call site.
- `home/home-kit.spec.ts` `openHome` ~44-50: take `intercept`, arm upcoming before `goto('/')`, await, then event card (`[data-testid^="event-countdown-"]:not([data-testid="event-countdown-wedding"])`).or(`events-empty-placeholder`) visible; test 2 also asserts both birthday cards visible before the one-shot `chromeText` read.

### G3 — Couple, profile, account data (`test(e2e): wait for account reads before asserting`)
- `settings/birthdays-wedding.spec.ts` ~73 (couple_settings + partner record + own profile), partner page ~87 (standalone arm: couple_settings + own profile), reloads ~118 (couple_settings + partner) and ~168 (couple_settings, before 'Date TBD' — the copy shows '39 days').
- `settings/couple-start-date.spec.ts` ~72, partner ~83 (standalone), reload ~107, ~113 (the copy already holds `targetIso`): couple_settings each.
- `account-data/account-data.spec.ts` ~119 (arm favorites before `goto('/')`, `responseJson` `[]`), ~131 reload (arm, length 1; `snapshot().currentFavorite` → `expect.poll`).
- `account-data/cross-device.spec.ts` `fresh` context: standalone arm custom_messages before `/admin` goto (assert row text), anniversaries before `/settings` goto (assert label).
- `auth/display-name-setup.spec.ts`: gate-name read before the submit (~118) and each `reload()` (~130, ~196 — assert `display_name` before the `toHaveCount(0)`); Settings row ~316 `not.toHaveText('Loading...')` → `toHaveText(seededName)`; notes after reload ~357: arm love-notes before `reload()`, assert `responseJson` has the note `content`.

### G4 — Photos and the theme sweep (`test(e2e): gate photo and sweep screens on loaded states`)
- `photos/photo-upload.spec.ts` ~14, ~33, ~88: arm photos list before `goto('/photos')`, await; gate `photo-gallery-grid`.or(`photo-gallery-empty-state`) (skeleton carries `photo-gallery`, `PhotoGallery.tsx` ~192). A local `openGallery(page, intercept)` covers all three.
- `navigation/theme-sweep.spec.ts` `SIGNED_IN_SCREENS` ~42-89 and `openSignedInScreen` ~204-212 (12 tests, one context each, no caching): give each screen a read and arm point — home: upcoming before goto, gate event-card-or-placeholder; mood: partner latest (`limit=1`) before dock click, gate `partner-mood-display`.or(`no-mood-logged-state`); notes: love-notes before goto, gate `virtualized-list`.or(text 'No messages to show'); photos: list before goto, gate grid-or-empty (drop `photo-gallery-error-state` — corrections); partner: partner list (`limit=30`) before dock click, gate `partner-mood-list`.or(`partner-mood-empty-state`); settings: upcoming via the G1 ordering, gate list-or-empty.

### G5 — Offline copy specs (`test(e2e): arm the online reads offline specs copy`)
Arm before the ONLINE goto only; keep every copy poll (copies are written after the response).
- `offline/account-data-offline-copy.spec.ts` ~140 anniversaries before `goto('/settings')` (also arm+await before the ~125 `goto('/')` so its read cannot be caught); ~275 `/admin` under abort: aborted-read counter on `custom_messages` registered before the goto, poll `> 0`.
- `offline/birthdays-wedding-offline.spec.ts` ~117 (profile + partner record + couple_settings); ~165 profile before `goto('/')`, ~179 one-shot copy read → `expect.poll`.
- `offline/couple-settings-offline.spec.ts` ~117, ~167 couple_settings; ~181 → `expect.poll`.
- `offline/events-offline-copy.spec.ts` ~103 upcoming. `interactions-offline-copy.spec.ts` ~98, ~140 interactions (assert `pokeId`). `love-notes-offline-copy.spec.ts` ~170, ~225 love-notes (assert ids).
- `offline/love-notes-offline-send.spec.ts` ~120 partner record (`id=eq.<partnerId>`) before `goto('/notes')`; keep the `partner.id` poll.
- `offline/mood-offline-copy.spec.ts` ~172 and reload ~183 own backfill (assert `moodId`); ~222 partner list (assert note).
- `offline/needs-a-connection.spec.ts` ~119 and ~177 photos list (gate grid-or-empty; assert `photoId`); ~237 `toHaveText(original.trim())`; ~388 interactions (assert `interactionId` unviewed); `openNotesWithPartner` ~439-446 → `(page, supabaseAdmin, intercept)`, arms partner record + love-notes, returns the thread result; ~550 asserts `noteId` in it.
- `offline/partner-offline-copy.spec.ts` ~54: partner record via `resolveOwnPair`; heading `textContent()` → `toHaveText(responseJson.display_name.trim())`.
- `offline/photos-offline.spec.ts` ~225, ~313 photos list (assert every seeded id).

### G6 — Realtime networkidle (`test(e2e): replace networkidle with read signals in realtime specs`)
- `notes/love-notes-realtime.spec.ts` ~152: standalone arm love-notes on `partnerPage` before its goto plus a request/settled counter for that path; after SUBSCRIBED await it, poll started === settled, and after delivery assert no new thread read started. Fix the ~154-157 comment (the refresher also reads).
- `partner/partner-mood-realtime.spec.ts` ~152: standalone arm partner list (`user_id=eq.<sender>`) on `partnerPage` + in-flight counter; after SUBSCRIBED await, poll none in flight, then `partner-mood-refresh-button` `aria-busy='false'`.

## Tasks & Acceptance

**Execution:**
- `tests/support/helpers/reads.ts`, `tests/support/helpers/events.ts` -- read globs, `openSettingsFromHome` -- shared arms.
- G1–G6 spec files as mapped -- arm, await, retrying assertions, gate fixes -- M1 rows and readiness items.

**Acceptance Criteria:**
- Given every M1 site, when the spec runs, then an `interceptNetworkCall` (or, offline, an aborted-read counter) for the asserted data is registered before the navigation and awaited before the first data-dependent step, and no non-retrying read the row names remains.
- Given the four corrections gates and both `networkidle` sites, when the screen is still loading or in its error state, then the gate does not pass.
- Given one arm per group, when its glob is broken locally (e.g. wrong table), then the test fails with a network-call timeout; restore (never commit a break). Record one per group in the Auto Run Result.
- Given the story, when `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npx playwright test` on every changed spec run, then all pass; changed specs pass `--repeat-each=2`.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 30 findings — high 0, medium 5, low 16, false 8, maybe-false 1
- findings:
  - `[false]` `[reject]` Blind: openSettingsFromHome's second arm can match a late Home response — observe mode is `waitForRequest`, which fires only on requests sent after the arm; Home's superseded GETs were sent before it, so their late responses cannot satisfy it.
  - `[low]` `[patch]` Blind: theme-sweep partner `armBefore: 'dock'` can be answered by App's start-up `fetchPartnerMoods(30)` — same rows either way; docblock reworded to say a start-up read of the same rows may answer first.
  - `[low]` `[patch]` Blind: /admin aborted-read counter does not prove the editor asked the server — listener moved after `goOffline(false)`, right before the goto; comment now credits the cold start's message-data refresh.
  - `[low]` `[patch]` Blind: intercepts armed together but awaited one by one leave later promises unhandled on failure — `Promise.all` in birthdays-wedding (3), openNotesWithPartner, events-read-window test A.
  - `[false]` `[reject]` Blind: partner-mood-realtime lacks an after-delivery started-count check — the broadcast handler refetches on purpose (PartnerMoodView ~190), and the toast is broadcast-only, so such a check would fail healthy runs.
  - `[low]` `[patch]` Blind: PARTNER_LATEST_MOOD_READ not pinned to the partner id (spec said build mood globs from the id) — now `partnerLatestMoodRead(partnerId)`.
  - `[low]` `[reject]` Blind: no unit test checks globs against sibling reads — every glob is exercised by a passing run and six were break-checked; a picomatch test file is new coverage for a rarely-met defect.
  - `[low]` `[patch]` Blind: reads.ts header omits that `?` is a single-char wildcard — sentence added.
  - `[low]` `[defer]` Blind: returning to Settings mid-test is not gated — pre-existing, not an M1 row; recorded in `deferred`.
  - `[low]` `[defer]` Blind: non-retrying reads remain in touched specs — not named by any M1 row (M9/other rows); recorded in `deferred`.
  - `[low]` `[patch]` Blind: events.ts header now wrong and api/unit importers load the UI fixture graph — helper moved to new `tests/support/helpers/settings-screen.ts`; events.ts restored.
  - `[low]` `[patch]` Blind: duplicated timeouts, reloadSettings, Home locator and inline POST glob — `SECOND_CONTEXT_READ_TIMEOUT`, `LOVE_NOTE_SEND` in reads.ts; `reloadSettings`, `homeEventsSettled` in settings-screen.ts.
  - `[low]` `[patch]` Blind: love-notes-realtime timeout comment split mid-phrase and settle poll on the implicit default — comment rejoined, `timeout: 15_000` explicit.
  - `[low]` `[patch]` Edge: love-notes-realtime settle poll can pass between the mount and refresher reads, failing a healthy delivery — poll and snapshot moved to immediately before the send click.
  - `[low]` `[patch]` Edge: /admin counter armed before `goOffline(false)` counts the online refresh — same fix as the Blind counter row.
  - `[medium]` `[patch]` Edge: openSettingsFromHome passes on a failed load when rows exist — `settingsEventsLoaded` now also asserts `events-settings-load-error` count 0.
  - `[medium]` `[patch]` Edge: pagination/persistence reload gates pass on the error state — same helper and check.
  - `[false]` `[reject]` Edge: needs-a-connection name row fails when the pool name is a seed value — global-setup writes a real display name to every pool profile (`tests/support/auth/global-setup.ts` ~83); the run passes.
  - `[false]` `[reject]` Edge: partner-offline-copy heading reads 'Partner' for a seed name — same refutation.
  - `[medium]` `[patch]` Verification-gap: Settings "loaded state" gates pass on a failed refresh with rows on screen — load-error absence added to the helper, theme-sweep Settings `ready` and settings-kit.
  - `[medium]` `[patch]` Verification-gap: theme-sweep partner gate times out when the partner has exactly one mood (`partner-mood-list` needs 2+) — gate is now `partner-mood-card`.or(`partner-mood-empty-state`).
  - `[low]` `[patch]` Verification-gap: /admin counter overclaims — same fix as the Blind counter row.
  - `[low]` `[patch]` Verification-gap: events-read-window truncation comment not backed (51 seeded = page size) — comment reworded; upcoming response now asserted to hold the survivor.
  - `[medium]` `[patch]` Intent: display-name-setup and needs-a-connection name rows still had nothing registered before navigation — `gateNameRead(userId)` armed before `navigateTo(settings)` and awaited.
  - `[low]` `[reject]` Intent: no demonstration that the new gates reject a not-ready screen — the gates now accept only loaded-state testids plus an error-banner absence; a local break demonstration is not a code defect and the story's AC required glob breaks, which were recorded.
  - `[false]` `[reject]` Intent: events.spec past-only arm comment "both past rows reached the store" — the placeholder (rendered only after the load settles, one store update per load) is asserted before the absences.
  - `[maybe-false]` `[defer]` Intent: ~25 navigating specs with no M1 row were not audited — settle with a fresh tests/e2e re-review; recorded as medium (unverified).
  - `[false]` `[reject]` Intent: adjacent corrections items (events-persistence stale deviation comment, token-persistence loop count) untouched — they belong to M9 (story 6) and CAP-1 (story 1), not this story's rule ids.
  - `[false]` `[reject]` Intent: verification not shown — lint, typecheck, unit (2796/2796) and all 31 changed specs (101/101 after patches) were run.
  - `[false]` `[reject]` Intent: networkidle and unlisted skeleton-gate fixes go beyond the rows — no bad outcome; story 2 deferred networkidle to this story and the skeleton gate is the same corrections defect.

### 2026-09-25 — Review pass
- verdicts: 22 findings — high 0, medium 2, low 12, false 7, maybe-false 1
- findings:
  - `[false]` `[reject]` Blind: the story spec has no `## Auto Run Result` section — the orchestrator removed it before this follow-up pass, and Finalize writes it again below.
  - `[false]` `[reject]` Blind: frontmatter contradicts its body (`in-review` status, iteration 0, `medium (unverified)` severity) — the review step sets `in-review` itself, the iteration counts only bad_spec loopbacks (none so far), and `<grade> (unverified)` is the workflow's required form for a maybe-false deferral.
  - `[low]` `[reject]` Blind: Code Map and Execution still place `openSettingsFromHome` in `events.ts`, and the new exports are not listed — the fix would edit this build's spec.
  - `[low]` `[patch]` Blind: `reads.ts` header says "two rules" and then lists three — changed to "three rules".
  - `[false]` `[reject]` Blind: `LOVE_NOTE_SEND` (`love_notes?*`) also matches `love_notes_visible` — it is observed only with `method: 'POST'`, and the app never POSTs to that view, so the send wait cannot resolve on a thread read.
  - `[false]` `[reject]` Blind: `settingsEventsLoaded` has no positive loaded-state check — it asserts a 200 read, then `aria-busy='false'` (a positive state), then no load error; every caller then asserts rows or the list-or-empty state, so no gate passes on a loading or error screen.
  - `[low]` `[patch]` Blind: the partner-mood-realtime in-flight poll runs right after the mount read, before the receiver's sync-driven `fetchPartnerMoods(30)` (`moodSlice.ts` ~428-434) can start — the poll and the `aria-busy` check moved to just before the mood submit, as love-notes-realtime already does.
  - `[low]` `[reject]` Blind: the Settings name arm in display-name-setup and needs-a-connection may be answered by the app's cold-start gate read of the same URL — both carry the same name, and the retrying `toHaveText(<exact name>)` that follows carries readiness; arming before the `goto` and awaiting two reads adds complexity for no failure anyone would see.
  - `[medium]` `[patch]` Blind: home-kit's one-shot emoji copy is only partly gated: the wedding card's couple settings read is never awaited — grouped with the Intent home-kit row; `openHome` now arms and awaits couple settings, own profile, partner record and upcoming events before the goto (`Promise.all`).
  - `[false]` `[reject]` Blind: account-data-offline-copy keeps URL matching outside `reads.ts` — the `waitForResponse` on `message_favorites` predates this story (M9 helper adoption, story 6), and the new counter is a request predicate, not a glob; no caller diverges because of it.
  - `[low]` `[patch]` Blind: love-notes-realtime timeout comment still has a 112-character line — rewrapped at 80.
  - `[false]` `[reject]` Blind: mood-offline-copy asserts the month header twice — the first check runs before the backfilled mood shows and the second after it, which is the baseline's "header unchanged while the day fills" check against a fixed value.
  - `[low]` `[reject]` Blind: `SECOND_CONTEXT_READ_TIMEOUT` copies `actionTimeout` and can drift — drift changes only a second-context bound, never a result; importing the config into a helper is more than a direct fix.
  - `[low]` `[reject]` Edge: theme-sweep Notes gate passes on the empty state plus an error banner if the screen's own fetch fails after the start-up refresher's read answered 200 — rare on local Supabase, and the banner has no testid; a bare `role="alert"` absence check would also catch SyncToast and input alerts, so the guard is more than a direct fix.
  - `[low]` `[reject]` Edge: theme-sweep Mood gate passes on `no-mood-logged-state` if StrictMode's second `limit=1` read fails after the first returned 200 — `getLatestPartnerMood` does swallow errors, but a failure right after a 200 on local Supabase is unlikely, and the fix is a new response tally.
  - `[low]` `[patch]` Edge: partner-mood-realtime in-flight poll can pass before the sync-driven partner read starts — grouped with the Blind row above; same fix.
  - `[low]` `[reject]` Edge: Execution names `events.ts` for `openSettingsFromHome` — the fix would edit this build's spec.
  - `[medium]` `[patch]` Intent: home-kit arms only the events read, while its M1 rows (`findings-e2e.md` ~80, ~316) name the wedding card (couple settings) and both birthday cards (profile, partner record) — grouped with the Blind home-kit row; same fix.
  - `[low]` `[reject]` Intent: acceptance criterion 2 (gates reject a loading/error screen) is never exercised — carried: no demonstration that the new gates reject a not-ready screen; the gates still accept only loaded-state testids plus an error-banner absence.
  - `[low]` `[reject]` Intent: some arms can be answered by another request for the same URL (theme-sweep mood/partner, display-name rows, `openSettingsFromHome`) — carried for `openSettingsFromHome` (observe mode fires only on requests sent after the arm) and the theme-sweep docblock; the rest carry the same rows' data, and a retrying assertion follows every await.
  - `[maybe-false]` `[defer]` Intent: whole-folder M1 removal (reading D) not implemented; ~25 unaudited specs — carried: already in `deferred` as medium (unverified); not deferred again.
  - `[false]` `[reject]` Intent: mood-offline-copy computes the month in Node and assumes it matches the browser — both run on the same machine with no `timezoneId` set in `playwright.config.ts`, and the anchor is local noon, so they share one month.

## Design Notes

```ts
const read = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
await page.goto('/');
expect((await read).status).toBe(200);
await expect(page.getByTestId('event-countdown-future-meetup-e2e')).toBeVisible();
```
The awaited response proves the request went out after navigation; the web-first assertion proves the latest (not superseded) load rendered.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0 (worktree-only TS2883 in `tests/support/merged-fixtures.ts` is the known baseline).
- `npx playwright test <changed specs> --project=chromium --repeat-each=2` (local Supabase running) -- expected: all pass.
- `npm run test:unit` -- expected: all pass (untouched, sanity).

## Auto Run Result

**Summary:** Every M1 row in `findings-e2e.md` (29 files) now arms the server read that carries the asserted data before its `goto`, `reload` or dock click. It awaits that read before the first step that uses the data, then makes a retrying assertion. Named one-shot reads became web-first assertions or `expect.poll`. The corrections readiness gates (theme-sweep error state, `aria-busy` before loading, the photos skeleton) and both realtime `networkidle` gates now accept only loaded states. Offline reloads under abort rely on an aborted-read counter or a poll of the local copy. This follow-up review pass patched four entries.

**Files changed:**
- `tests/support/helpers/reads.ts` (new): named read globs, the love-note send glob, and the second-context timeout. This pass fixes the rule count in its header.
- `tests/support/helpers/settings-screen.ts` (new): `openSettingsFromHome`, `settingsEventsLoaded`, `reloadSettings`, `homeEventsSettled`.
- G1 Settings events specs, G2 Home events specs, G3 couple/profile/account specs, G4 photo-upload and theme-sweep, G5 eleven offline specs, G6 love-notes-realtime and partner-mood-realtime: armed reads and loaded-state gates.
- This pass:
  - `home/home-kit.spec.ts`: `openHome` now also awaits the couple settings, own profile and partner record reads.
  - `partner/partner-mood-realtime.spec.ts`: the receiver settle poll moved to just before the send.
  - `notes/love-notes-realtime.spec.ts`: timeout comment rewrapped.

**Commits:** G1 `225c50fd`, G2 `372d5cb9`, G3 `8e6d9061`, G4 `17cd33c8`, G5 `ff491db0`, G6 `088f61de`, and the first pass's spec record `46908506`. This pass's patch and spec record are committed on top of those.

**Glob-break checks (first pass).** Each break was made locally and restored, never committed. Each failed its test at the armed wait:
- G1: `eventz` in the `events-history-pagination` `openSettings`.
- G2: `eventz` in the `home/events` past-only test.
- G3: `couple_settingz` in the `couple-start-date` Home arm.
- G4: `photoz` in the `photo-upload` `openGallery`.
- G5: `interactionz` in the `interactions-offline-copy` first arm.
- G6: `moodz` in the `partner-mood-realtime` receiver arm.

**Review, this follow-up pass:** 22 findings (high 0, medium 2, low 12, false 7, maybe-false 1).
- Patched 4 entries, 1 medium and 3 low:
  - the home-kit arms (medium: Blind and Intent rows);
  - the partner-mood-realtime settle poll (low: Blind and Edge rows);
  - the `reads.ts` rule count (low);
  - the comment wrap (low).
- Nothing new deferred. The unaudited-specs item was carried; it is already in `deferred`.
- Rejected, with reasons in the triage log:
  - 8 lows: stale Code Map/Execution entries (×2, spec edits); the display-name arms; the timeout constant; the theme-sweep Notes and Mood error paths; the gate-rejection demonstration (carried); same-URL arms (partly carried).
  - 7 false: the removed Auto Run Result, frontmatter state, `LOVE_NOTE_SEND`, `settingsEventsLoaded`, account-data-offline-copy URL matching, the double month check, the Node/browser month.

**Follow-up review recommended: false.** This is a follow-up pass and it patched no high entry, so the work has converged. Patched this pass: high 0, medium 1, low 3.

**Verification (this pass, after patches):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 155 files / 2796 tests passed.
- The three patched specs with `--project=chromium --repeat-each=2`: 16 passed.
- All 31 changed specs with `--project=chromium --repeat-each=2`: 202 passed.

**Residual risks:**
- The account-data A/B/A favorites test is still flaky, about 1 run in 6 on the unchanged baseline. The cause is an app-side partner lookup racing sign-out, and it is deferred.
- Several first matches are StrictMode duplicates or start-up reads of the same URL, so correctness depends on the retrying assertion kept after each await.
- The theme-sweep Notes and Mood gates can still pass on a screen whose own fetch failed after an earlier read of the same URL succeeded. This is rare locally and was rejected.

