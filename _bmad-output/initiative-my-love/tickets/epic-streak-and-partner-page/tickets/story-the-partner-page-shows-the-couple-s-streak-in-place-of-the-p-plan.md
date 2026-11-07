---
title: 'The Partner page shows the couple''s streak in place of the partner''s moods'
type: feature
ticket: '2'
created: '2026-11-07'
status: done
baseline_revision: 'd919197d6d9763f4d57b66282ac257f9bab0a768'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      A linked Partner page shows only the partner's name, with no card, loading block or error, when the slice holds an `unlinked` streak answer (or null with nothing loading) while a partner is shown.
    evidence: |-
      PartnerView.tsx falls through to null when `coupleStreak` is not `ok`, not loading and has no error. Reachable only when the server says unlinked while a saved or stale partner is still shown (a server-side unlink with no client action, or the partner read failing after one); there is no unlink feature. Rare; the fix adds a branch. Reported by blind-hunter, edge-case-hunter, verification-gap and intent-alignment.
    location: >-
      src/components/PartnerView/PartnerView.tsx
    severity: low
  - summary: >-
      The Connect screen's typed email, shown search answer and error line are lost whenever `loadPartner` runs while the account is unlinked.
    evidence: |-
      That state now lives in PartnerConnect, which unmounts while `isLoadingPartner` is true, and partnerSlice.loadPartner raises the flag on every call when `partner` is null (partnerSlice.ts:165). In PartnerMoodView the state sat in the parent and survived. It needs a partner reload during typing (a reconnect refresh, or Retry). Rare; the fix keeps PartnerConnect mounted but hidden across loads, which adds branches.
    location: >-
      src/components/PartnerView/PartnerView.tsx
    severity: low
  - summary: >-
      The streak error card offers no Retry, so an online transient failure with nothing shown stays until Realtime re-joins or the page is reopened.
    evidence: |-
      PartnerView.tsx renders `partner-streak-error` with no action; only SUBSCRIBED, partner_linked, daily_pick, a partner change or a reconnect re-read. Rare (a failed online read with no streak yet); the fix adds a control. Story 3 owns the streak's failure and offline wording.
    location: >-
      src/components/PartnerView/PartnerView.tsx
    severity: low
  - summary: >-
      The interactions local-copy refresher still reads interactions on every signed-in start although no routed screen shows them, and the deleted interaction E2E specs leave that code without browser coverage until epic 10 deletes it.
    evidence: |-
      interactionsSlice.ts:235 `registerLocalCopy(INTERACTIONS_COPY_KIND, ...)` still runs; tests/e2e/partner/interaction-record-ownership.spec.ts and tests/e2e/offline/interactions-offline-copy.spec.ts were deleted with the Poke/Kiss/Fart tiles (the API-level tests/api/interaction-record-ownership.spec.ts stays). The intent keeps the code for epic 10, so removing the refresher is out of this story.
    location: >-
      src/stores/slices/interactionsSlice.ts:235
    severity: low
  - summary: >-
      After a relink to a new partner within one session, the previous couple's streak can show under the new partner's name until the new read lands, or for good if it fails.
    evidence: |-
      The slice answer is not keyed by partner; PartnerView shows any `ok` answer once a partner is present. Needs an unlink (no client action exists) and a new link in the same session. Rare; the fix adds a partner key to the stored answer.
    location: >-
      src/components/PartnerView/PartnerView.tsx
    severity: low
  - summary: >-
      When `subscribePartnerEvents` rejects, usePartnerStreakListener logs and holds nothing, with no retry, so the Partner page gets no live re-reads until it is reopened.
    evidence: |-
      usePartnerStreakListener.ts `.catch` only logs, the same pattern as useDailyPickListener. A registry failure is rare; the page still reads on open, on a partner change and on reconnect. The fix adds retry logic.
    location: >-
      src/hooks/usePartnerStreakListener.ts
    severity: low
  - summary: >-
      The week strip's "Today" sits on the server's date for the viewer's stored zone, which can be a day off from the device while travelling until a Daily fetch records the new zone.
    evidence: |-
      get_couple_streak dates the viewer by user_time_zones (story 7.1's recorded residual risk); StreakCard labels the last week entry Today, as the server answers it. Pre-existing server behaviour, and the epic bars the client from working out a day's state.
    location: >-
      src/components/PartnerView/StreakCard.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Partner view (`/partner`) still shows the partner's mood card, recent moods, the mood toast and the Poke/Kiss/Fart tiles, and nothing on the client reads story 1's `get_couple_streak`, so the couple cannot see their streak.

**Approach:** Build the Partner page in a new folder `src/components/PartnerView/`: the partner's name and the design's streak card (held, run, week strip, next milestone; orange/grey/blue by `today_state`) for a linked account, and only the moved search/requests/linking UI for an unlinked one. The streak lives in `dailyQuestionSlice`; one registry subscriber re-reads it. The old view's code stays, unrouted, for epic 10; E2E moves to the new page.

## Boundaries & Constraints

**Always:**
- Partner search, sent/received requests, accept, decline and their error line move into `PartnerView/PartnerConnect.tsx` with markup, copy and every test id unchanged; `PartnerLoadError.tsx` moves (git mv) to `PartnerView/`, and `Settings/PartnerPage.tsx` and `PartnerMoodView.tsx` import it from there. `PartnerMoodView.tsx` renders `<PartnerConnect />` where its connect block was and keeps everything else for epic 10.
- Page states, in the old view's order: `isLoadingPartner` → the existing loading block; no partner + `partnerLoadError` → `PartnerLoadError` (retry = `loadPartner`); no partner, no error → `PartnerConnect` alone (no streak card, whatever the slice holds); partner → `<h1>` partner's `displayName` (serif 30px, as before) then the streak card. `useLayoutEffect` `loadPartner()` on mount and `loadPendingRequests()` while online stay as in the old view.
- Slice fields `coupleStreak: CoupleStreakAnswer | null`, `coupleStreakLoading`, `coupleStreakError: string | null`, action `loadCoupleStreak()` that never throws: captures `{ userId, authSessionVersion }` before the first await and writes nothing if either changed; only the newest started call writes (a sequence counter); success sets the answer and clears the error; failure keeps the shown answer and sets the error message. All three fields go in `signedOutState()`.
- `fetchCoupleStreak()` in `dailyQuestionApi.ts` follows `fetchDailyDay`: refuses offline before any request, zod-parses `{status:'ok', streak}` | `{status:'unlinked'}`, throws `AccountDataError` on any failure, never maps a failure to `unlinked`. Streak schema: non-negative ints `held, run, milestones, same, done, missed`, `today_state` `grey|orange|blue`, `week` exactly 7 `{day: 'YYYY-MM-DD', state: done|missed|open}`.
- The page loads the streak when a partner is present (keyed on the partner's id) and through `usePartnerStreakListener` (mounted by the page; signed in and online; the registry, never `supabase.channel()`): `SUBSCRIBED` → `loadCoupleStreak`; `partner_linked` → `loadCoupleStreak`, `loadPartner`, `loadPendingRequests`; `daily_pick` → `loadCoupleStreak`; no `new_mood` or `dates_changed` handler.
- Card copy: `{held}` over "days answered together" ("day" when held is 1), `{run}` over "in a row", the week strip (narrow weekday letter per date via `parseEventDate`, the last labelled "Today" with a ring), "Next milestone: {(milestones+1)*25} days · {that − held} to go". Plain `Flame` for grey/orange, `Snowflake` for blue; week dots: done = check on fire, missed = snowflake on cold, open = dashed ring. Colours are new kit tokens with dark values (see Design Notes). Test ids: `partner-view` (root), `partner-streak-card` with `data-state={today_state}`, `partner-streak-held`, `partner-streak-run`, `partner-streak-week` holding 7 `partner-streak-day` with `data-state`, `partner-streak-next`, `partner-streak-loading`, `partner-streak-error`.

**Never:** delete `PartnerMoodView.tsx`, `PokeKissInterface`, mood or interaction code (epic 10); add a local-copy kind or offline streak (story 3); show the streak on Daily (story 4); compute a day's state or the streak on the client; hand-edit `database.types.ts`; link/unlink pool pairs in E2E; use `@/` inside `src/`; run `prettier --write`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tracer | both partners picked today, pair cleared before | each page: held 1 "day answered together", "1" "in a row", `data-state` orange, today dot done | — |
| Unlinked | `partner` null, loaded | only `PartnerConnect`; no `partner-streak-card` | — |
| Load fails | streak shown, next read rejects | card stays; `coupleStreakError` set | logged |
| Nothing yet | partner, streak null, loading | `partner-streak-loading` | error with nothing → `partner-streak-error` text |
| Stale session | sign-out during the read | nothing written | — |
| Overlap | two reads, older lands last | newer answer kept | — |
| Bad answer | RPC returns unparsable JSON | `AccountDataError('invalid-response')`, never unlinked | — |

</intent-contract>

## Code Map

- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- source of the connect UI: state `searchQuery`/`searchedEmail`/`partnerError`, `handleSearch`, `handleSearchSubmit`, `shownSearch`, three request handlers (l.267-347), JSX l.396-404 (error line) and l.413-597 (connect block); loading block l.599-605; header h1 l.611-615. Keep the rest.
- `src/components/PartnerMoodView/PartnerLoadError.tsx` -- moves to `PartnerView/`.
- `src/components/Settings/PartnerPage.tsx:21` -- import to repoint.
- `src/App.tsx:60-62, 1026` -- lazy import and render of the partner view.
- `src/stores/slices/dailyQuestionSlice.ts` -- add the streak fields/action, matching `loadDailyDay`'s session check; header doc gains a paragraph.
- `src/stores/slices/authSlice.ts:250-260` -- `signedOutState()` dailyQuestionSlice block.
- `src/api/dailyQuestionApi.ts:130-151` (`fetchDailyDay`), `src/api/validation/dailyQuestionSchemas.ts` -- API and schema templates.
- `src/hooks/useDailyPickListener.ts` + `src/hooks/__tests__/useDailyPickListener.test.ts` -- the subscriber and test to mirror.
- `src/index.css:67-84` (`@theme inline`), `:102-142` (`:root` and dark kit values) -- add tokens.
- `src/components/PartnerMoodView/__tests__/PartnerMoodView.search.test.tsx`, `.requests.test.tsx` -- move to `PartnerView/__tests__/PartnerConnect.*.test.tsx`, rendering `<PartnerConnect />`; drop mood-only mock fields. `.kit.test.tsx`, `MoodCard.moodArray.test.tsx` stay.
- `tests/unit/api/partnerService.check.test.tsx:31-35` -- renders `PartnerMoodView`; repoint to `PartnerConnect`.
- `src/components/shared/__tests__/fieldFontSize.test.ts:29` -- path becomes `src/components/PartnerView/PartnerConnect.tsx`.
- `tests/unit/stores/signOutClearsAccountState.test.ts:109-113, 243-264` -- expected reset list and seeded secrets.
- `tests/unit/stores/dailyQuestionFixture.ts`, `tests/unit/stores/dailyQuestionSlice.test.ts`, `src/api/__tests__/dailyQuestionApi.test.ts` -- fixtures/patterns for the new slice and API tests.
- E2E delete: `tests/e2e/partner/{partner-mood,partner-kit,interaction-record-ownership,interaction-subscription-warning}.spec.ts`, `tests/e2e/offline/interactions-offline-copy.spec.ts`, and `tests/e2e/offline/mood-offline-copy.spec.ts` (its one test is the removed mood list). Then support only they used: `tests/support/fixtures/interaction-record-ownership.ts`, `tests/support/fixtures/interaction-realtime-control.ts` (both merged at `tests/support/merged-fixtures.ts:22-23,53-54,73-74`), `tests/support/harnesses/interaction-record-ownership.{html,tsx}`, `tests/support/harnesses/interaction-realtime.{html,tsx}`, exports `INTERACTIONS_READ` (`helpers/reads.ts:62`) and `partnerMoodListRead` (`reads.ts:113`). Grep each before deleting; keep `tests/support/factories/interaction-record-ownership.ts` and `tests/api/interaction-record-ownership.spec.ts`.
- E2E edit: `realtime-recovery-after-renewal.spec.ts` (drop the poke third: :221-255 witness → `partner-view` h1, :314-321, :337-355, :395-409, :480-492, :508-509, imports/consts/header; keep pick and note), `needs-a-connection.spec.ts` (delete "Poke and kiss badge offline" :403-466 and its now-unused imports; header :17), `partner-offline-copy.spec.ts` (:45 `partner-view`, :47 → `partner-streak-card` visible), `dock.spec.ts` (:47 witness `partner-view`; :128-144 needs a destination that scrolls at 390x600 — the new page will not; swap Partner for one that does, verified by a run, keeping every check), `settings-navigation-rules.spec.ts:268`, `theme-sweep.spec.ts` (:116-130 read `**/rest/v1/rpc/get_couple_streak` POST armed before `dock`, ready = `partner-view` + `partner-streak-card`; import :39, header :17-19), `partner-connect.spec.ts` (delete the two poke tests :509, :560 and what only they used; the h1 check :455 stays; assert no `partner-streak-card` on the unlinked page).
- E2E templates: `tests/e2e/daily/daily-question-pick-and-reveal.spec.ts:32-152` (two contexts, `partnerAuthToken`, `resolveWorkerPairIds`, `clearPairDays`, `DAILY_DAY_READ`, `DAILY_PICK_SEND`); `partner-kit.spec.ts:178` (h1 in Playfair Display on the kit page colour) and `:303` (connect UI in dark) are ports for kept parts.

## Tasks & Acceptance

**Execution:**
- [ ] `src/api/validation/dailyQuestionSchemas.ts`, `src/api/dailyQuestionApi.ts` -- `CoupleStreakSchema`, `CoupleStreakAnswerSchema`, types, `fetchCoupleStreak()`; module docs -- the read.
- [ ] `src/stores/slices/dailyQuestionSlice.ts`, `src/stores/slices/authSlice.ts` -- streak fields, `loadCoupleStreak`, `signedOutState()` -- state.
- [ ] `src/index.css` -- streak tokens, light and dark -- colours.
- [ ] `src/components/PartnerView/PartnerLoadError.tsx` (git mv), `PartnerConnect.tsx` (moved code), `PartnerView.tsx` (page), `StreakCard.tsx` (card) -- the page.
- [ ] `src/hooks/usePartnerStreakListener.ts` -- registry subscriber per Always.
- [ ] `src/components/PartnerMoodView/PartnerMoodView.tsx`, `src/components/Settings/PartnerPage.tsx`, `src/App.tsx` -- use `PartnerConnect`, repoint imports, route `partner` to `PartnerView`.
- [ ] Unit tests: `src/hooks/__tests__/usePartnerStreakListener.test.ts` (one test each for SUBSCRIBED, partner_linked, daily_pick re-reading; new_mood and dates_changed absent; other statuses, unmount, offline, signed out, session change); `src/components/PartnerView/__tests__/PartnerView.test.tsx` (each page state; card copy for held 1 and 12, run, next milestone at 0/24/25/130 held, `data-state` per today_state, flame vs snowflake, 7 week days with states and "Today"; no `partner-mood-card`, `partner-mood-list`, `poke-kiss-interface`); moved `PartnerConnect.search`/`.requests` tests; slice tests (ok, unlinked, failure keeps shown, stale session, overlapping reads, signed out no-op); API tests (ok, unlinked, unparsable, offline refusal, PostgREST error); `signOutClearsAccountState.test.ts`; `partnerService.check.test.tsx`; `fieldFontSize.test.ts`.
- [ ] E2E per the Code Map, plus new `tests/e2e/partner/partner-streak.spec.ts`: the tracer (both pick on Daily, each Partner page shows `partner-streak-held` "1", "day answered together", run "1", `data-state` orange, counts 0 for `partner-mood-card`, `partner-mood-list`, `poke-kiss-interface`), and the two ported kit tests.

**Acceptance Criteria:**
- Given an unlinked throwaway account on a local stack, when it opens Partner, then it searches, sends, accepts and declines as before and sees no streak card.
- Given a cleared worker pair, when both partners pick on Daily and each opens Partner, then each sees 1 day answered together and 1 in a row in orange, and no mood card, recent moods or Poke/Kiss/Fart tiles.
- Given a failed partner read with nothing saved, when Settings › Partner opens, then it shows the load-error card.
- Given the store holds a streak, when the account signs out, then `coupleStreak` is null and the flags are reset.
- Given the full Playwright suite on a local stack, when it runs, then it passes.

## Implementation Notes

- 2026-11-07: slice tests are in a new `tests/unit/stores/coupleStreakSlice.test.ts`; adding them to `dailyQuestionSlice.test.ts` pushed it past the TEA hook's 1000-line limit.
- 2026-11-07: the glyphs on the fire and cold tiles and week dots are black, not the mock-up's white: white measures 2.80:1 on `fire` and 3.68:1 on `cold`; black clears 4.5:1 on both in either theme.
- 2026-11-07: `dock.spec.ts`'s scroll-reset test goes Daily → Home instead of Daily → Partner; the new Partner page does not scroll at 390x600. Every check is kept.
- 2026-11-07: `realtime-recovery-after-renewal.spec.ts` lost its partner context and `bootExpiredWithSavedPartner` with the poke third, as nothing else used them; the daily-pick leg still exercises the same registry channel after renewal.
- 2026-11-07: `findLightSurfaces` moved from `theme-sweep.spec.ts` to `tests/support/helpers/light-surfaces.ts` (optional root test id) so `partner-streak.spec.ts` checks the orange and blue cards in dark.
- 2026-11-07: `tests/e2e/auth/token-persistence-overlap.spec.ts` cannot be collected in a loop worktree (it reads `node_modules/` at the worktree root, which does not exist here; never symlinked per AGENTS.md), and the three edge-function specs in `tests/api` (`push-love-note-trigger`, `push-partner-activity-trigger`, `upload-love-note-image-limits`) need the edge runtime, which is stopped on the shared local stack. None is touched by this change.

## Plan Change Log

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 32 findings — high 0, medium 0, low 23, false 9, maybe-false 0
- findings:
  - `[low]` `[defer]` (blind) a linked page goes blank under the name when the streak answer is `unlinked` or null with nothing loading — real but needs a server-side unlink with a partner still shown (no unlink action exists); rare, and the fix adds a branch. Deferred (grouped with edge #1, verification-gap other #1, intent #3).
  - `[low]` `[defer]` (blind) the Connect form loses the typed email, shown answer and error line when `loadPartner` runs while unlinked — verified at partnerSlice.ts:165 (the flag rises whenever `partner` is null) and PartnerView's unmount of PartnerConnect while loading; needs a partner reload during typing; the fix adds branches. Deferred.
  - `[low]` `[defer]` (blind) the streak error card has no Retry — real for an online failure with nothing shown; rare, and the fix adds a control (story 3 owns failure wording). Deferred.
  - `[false]` `[reject]` (blind) two identical `get_couple_streak` reads per visit (page-open read plus SUBSCRIBED) — the intent requires the SUBSCRIBED re-read, and the page-open read is the only one when the listener is not running (offline, or a failed subscribe); the newest-wins counter makes the overlap write once, so there is no defect.
  - `[false]` `[reject]` (blind) one `partner_linked` makes App's link listener and the page's listener both reload the partner — the intent requires this listener to re-read the partner "as usePartnerLinkListener does", and `loadPartner`'s own sequence counter lets only the newest call write.
  - `[low]` `[patch]` (blind) `loadCoupleStreak` logs an expected offline refusal with console.error — fixed: the offline code still sets `coupleStreakError` but skips the log; new test in `coupleStreakSlice.test.ts`.
  - `[low]` `[patch]` (blind) no E2E shows the post-link streak read — fixed: `partner-connect.spec.ts` asserts B's `partner-streak-card` after the accept. A live daily_pick E2E is not added; the intent places the per-event proof at unit level (intent #2's patch).
  - `[false]` `[reject]` (blind) the renewal spec no longer proves the new streak subscriber recovers after the token renews — the streak listener is one more subscriber on the same refcounted registry channel, whose recovery the spec's daily-pick leg still proves end to end.
  - `[low]` `[defer]` (blind) the interactions refresher still runs on every start and its E2E coverage is gone until epic 10 — verified at interactionsSlice.ts:235; the intent keeps that code for epic 10. Deferred so the ledger records it.
  - `[low]` `[patch]` (blind) Settings › Partner's load error has no Playwright check although the verify line asks for one — fixed: new `partner-page.spec.ts` test aborts the partner read in a fresh context and asserts `partner-load-error` (grouped with intent #1).
  - `[low]` `[patch]` (blind) stale comments after the move (partner-connect header, App.tsx, PartnerMoodView header) — fixed, comments only (grouped with verification-gap #2, intent #7).
  - `[low]` `[reject]` (blind) the plan's checkboxes and notes were left empty — the fix edits this build's plan; the Implementation Notes and this result record the work.
  - `[low]` `[patch]` (blind) the flame/snowflake unit test ends on a meaningless `expect(container)` and finds the tile structurally — fixed: `partner-streak-icon` test id on the tile, assertions through it.
  - `[low]` `[patch]` (blind) the week-day schema accepts impossible dates — fixed: `z.iso.date()`, with `2030-13-45` in the invalid-response table.
  - `[low]` `[defer]` (edge) partner present with an `unlinked` or null streak shows an empty body — same root as blind #1. Deferred.
  - `[low]` `[defer]` (edge) a relink keeps the previous couple's counts under the new name until the read lands — real, needs an unlink and relink in one session with no client unlink action; the fix keys the answer by partner. Deferred.
  - `[low]` `[patch]` (edge) the streak is not re-read on reconnect, so an offline error stays if SUBSCRIBED never comes — fixed: `isOnline` added to the read effect's dependencies (still reading offline); covered in `PartnerView.test.tsx`.
  - `[low]` `[defer]` (edge) a rejected `subscribePartnerEvents` leaves no live updates and no retry — real, the same pattern as useDailyPickListener; rare, and the fix adds retry logic. Deferred.
  - `[low]` `[defer]` (edge) "Today" follows the stored zone and can sit a day off while travelling — pre-existing server dating (story 7.1's residual risk); the epic bars a client-side day state. Deferred.
  - `[false]` `[reject]` (edge) duplicate or out-of-order week days give duplicate keys — the only producer builds `week` from `generate_series(0, 6)` ordered by date (couple_streak migration, l.130-133 and l.210-215), so the state is unreachable.
  - `[false]` `[reject]` (edge) the removed poke leg should be recorded for epic 10 to restore — epic 10 deletes PokeKissInterface and the interactions code rather than re-routing them, so there is nothing to restore.
  - `[low]` `[patch]` (verification-gap) the orange and blue cards in dark are never checked for light surfaces — fixed: `partner-streak.spec.ts` fakes orange and blue in dark and asserts no light surface inside the card through the shared `findLightSurfaces`; theme-sweep's header no longer implies it covers them.
  - `[low]` `[patch]` (verification-gap) sign-out test comments still name PartnerMoodView — fixed, comments only (grouped with blind #11).
  - `[low]` `[defer]` (verification-gap) partner present with an `unlinked` answer shows nothing under the name — same root as blind #1. Deferred.
  - `[false]` `[reject]` (verification-gap) StreakCard's comment misattributes the black-glyph rationale to the whiteOnColorContrast floor — the comment says white fails that floor and black clears both ratios, which is true; it does not claim the guard measures black.
  - `[low]` `[patch]` (intent) the Settings load error is shown only in unit tests — same root as blind #10; same fix.
  - `[low]` `[patch]` (intent) "the page re-reading" is shown at the hook with the page's listener mocked, and new_mood/dates_changed only as missing handlers — fixed: new `PartnerView.listener.test.tsx` renders the page with the real listener and fires all five, asserting reads on SUBSCRIBED, partner_linked, daily_pick and none on new_mood and dates_changed.
  - `[low]` `[defer]` (intent) unlinked is decided by the partner slice, not the streak answer — same root as blind #1. Deferred.
  - `[false]` `[reject]` (intent) the E2E edits go past the lists (mood-offline-copy deleted, partner-connect's poke tests removed, dock pointed at Home) — each removes steps whose subject is a removed part, which the intent's "removed or pointed at the new page" covers; the dock step cannot point at a page that no longer scrolls.
  - `[false]` `[reject]` (intent) no evidence the full E2E suite passes — the suite ran: 349 passed; the only failures are the 21 edge-runtime tests (9 failed with 503 from `/functions/v1`, 12 serial siblings did not run), plus one spec that cannot be collected in a worktree, none touched by this change.
  - `[false]` `[reject]` (intent) additions the intent does not name (colour tokens, loading and error states, theme-sweep comment) — each is needed to draw the intent's card in both themes or to keep a touched spec accurate, and none conflicts with the intent.
  - `[low]` `[patch]` (intent) `interactionService.ts`'s comment names a harness this change deleted — fixed, comment only (grouped with blind #11).

## Design Notes

- Tokens (`@theme inline` → `--color-*`): `fire` #f97316 / #f97316; `fire-tint` #fff1e6 / rgba(249,115,22,.14); `fire-ink` #c2410c / #fdba74; `fire-soft` #9a3412 / #fdba74; `cold` #3b82f6 / #3b82f6; `cold-tint` #e3eeff / rgba(59,130,246,.16); `cold-ink` #1d4ed8 / #93c5fd; `ash-tint` #eceef2 / #1c2230; `ash-ink` #5b6270 / #9aa3b2. Dark keeps theme-sweep's no-light-surface rule (every opaque dark surface under L .4).
- Card (design "Partner page"): `rounded-[22px] p-4 gap-3.5` on the state's tint; 64px round icon tile; held in serif 40px bold; run 22px bold right-aligned; week grid of 7 with 26px dots; next-milestone line 12px semibold.
- `PartnerConnect` reads the store with `useAppStore()` destructuring, as the moved code did, so its moved tests' wholesale store mocks still work; `PartnerView` and the hook use selectors.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0 (or only the worktree TS2883 baseline in `tests/support/merged-fixtures.ts`).
- `npm run lint` -- expected: exit 0.
- `npx knip` -- expected: no finding introduced by this change (compare against the baseline revision if `node_modules` is stale).
- `npm run test:unit` -- expected: all pass.
- `npx playwright test tests/e2e/partner tests/e2e/settings/partner-page.spec.ts tests/e2e/offline tests/e2e/navigation tests/e2e/daily` -- expected: pass.
- `npx playwright test` -- expected: the full suite passes (stack up via `supabase start`, CLI 2.122.0).

## Auto Run Result

Status: built

**Summary:** `/partner` now renders the new `PartnerView` page. A linked account sees the partner's name and the couple's streak card from story 1's `get_couple_streak`: held ("day/days answered together"), run ("in a row"), the seven-day week strip with "Today", and "Next milestone: {n} days · {k} to go". The card is orange, grey or blue by `today_state`, with the plain flame (snowflake when blue). An unlinked account sees only the moved search, requests and linking UI. The streak lives in `dailyQuestionSlice` (`coupleStreak`, `coupleStreakLoading`, `coupleStreakError`, `loadCoupleStreak`), which has a session check and a newest-read-wins counter and is cleared by `signedOutState()`. `usePartnerStreakListener` re-reads the streak on SUBSCRIBED, `partner_linked` (plus the partner and the requests) and `daily_pick`, and does nothing on `new_mood` or `dates_changed`. The mood card, recent moods, the mood toast and the Poke/Kiss/Fart tiles are off the page; their code stays, unrouted, for epic 10.

**Files changed:**
- **API:** `src/api/dailyQuestionApi.ts` and `src/api/validation/dailyQuestionSchemas.ts`: `fetchCoupleStreak()` and the zod schemas for the streak answer.
- **State:** `src/stores/slices/dailyQuestionSlice.ts` holds the streak fields and `loadCoupleStreak`. `src/stores/slices/authSlice.ts` adds the three fields to `signedOutState()`.
- **Theme:** `src/index.css` adds the fire, cold and ash streak tokens, in light and dark.
- **The new page, in `src/components/PartnerView/`:**
  - `PartnerView.tsx`: the page.
  - `StreakCard.tsx`: the card.
  - `PartnerConnect.tsx`: the connect UI, moved unchanged.
  - `PartnerLoadError.tsx`: moved with `git mv`.
- **Listener:** `src/hooks/usePartnerStreakListener.ts` is the page's registry subscriber.
- **Re-pointed code:**
  - `src/App.tsx` routes `partner` to `PartnerView`.
  - `src/components/PartnerMoodView/PartnerMoodView.tsx` renders `PartnerConnect` and is marked unrouted.
  - `src/components/Settings/PartnerPage.tsx` imports `PartnerLoadError` from its new folder.
  - `src/api/interactionService.ts`: one comment corrected.
- **Unit tests:**
  - New: `PartnerView.test.tsx`, `PartnerView.listener.test.tsx`, `usePartnerStreakListener.test.ts`, `coupleStreakSlice.test.ts`.
  - Moved: `PartnerConnect.search.test.tsx` and `PartnerConnect.requests.test.tsx`.
  - Updated: `dailyQuestionApi.test.ts`, `dailyQuestionFixture.ts`, `signOutClearsAccountState.test.ts`, `partnerService.check.test.tsx`, `fieldFontSize.test.ts`.
- **E2E, new:** `tests/e2e/partner/partner-streak.spec.ts` holds the tracer, the two ported kit tests, and the orange and blue dark checks. `partner-page.spec.ts` gains a Settings load-error test. `findLightSurfaces` moved into `tests/support/helpers/light-surfaces.ts`, and `reads.ts` gains `COUPLE_STREAK_READ`.
- **E2E, deleted:** `partner-mood`, `partner-kit`, `interaction-record-ownership` (e2e), `interaction-subscription-warning`, `interactions-offline-copy` and `mood-offline-copy`. Also deleted are the two interaction fixtures with their merged-fixtures entries, the four interaction harness files, and the `INTERACTIONS_READ` and `partnerMoodListRead` exports.
- **E2E, edited:** `realtime-recovery-after-renewal`, `needs-a-connection`, `partner-offline-copy`, `dock`, `settings-navigation-rules`, `theme-sweep` and `partner-connect`.

**Review (thorough; lenses blind-hunter, edge-case-hunter, verification-gap, intent-alignment):** 32 findings: low 23, false 9, no high or medium.
- **Patched (10 entries, all low):**
  - the offline refusal is no longer logged as an error;
  - the streak is re-read on reconnect;
  - `z.iso.date()` for week days;
  - a test id on the icon tile, with the flame/snowflake test cleaned up;
  - a page-level test with the real listener and all five events;
  - dark light-surface checks for the orange and blue cards;
  - the post-link streak card is asserted in `partner-connect`;
  - a Playwright check of Settings' load error;
  - stale comments in six places.
- **Deferred (7 entries, all low; listed in the frontmatter `deferred`):**
  - the empty body when a partner is shown but the answer is `unlinked`;
  - Connect's typed state is lost on a partner reload;
  - no Retry on the streak error;
  - the interactions refresher still runs until epic 10;
  - the previous couple's counts can show after a relink;
  - no retry when the subscription is rejected;
  - "Today" follows the stored zone.
- **Rejected:** the reasons are in the triage log.
  - Nine were false:
    - the duplicate SUBSCRIBED read and the duplicate `partner_linked` partner read, both of which the intent requires;
    - renewal coverage, which the daily-pick leg gives;
    - week-day duplicates, which the server cannot produce;
    - the poke leg to restore, which epic 10 deletes instead;
    - the black-glyph comment;
    - the E2E list scope;
    - the full-suite evidence;
    - the extra tokens and states.
  - One low was rejected because its fix would edit the plan.

**Follow-up review recommended: false.** This was a first pass, and every patched entry was `low`. Patched counts by verdict: high 0, medium 0, low 10.

**Verification (after the patches):**
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npx knip`: exit 0.
- `npm run test:unit`: 251 files, 4650 tests, all pass.
- Playwright over every spec in `tests/e2e`, `tests/api` and `tests/integration` except `token-persistence-overlap.spec.ts`: 349 passed, 9 failed, 12 did not run.
  - The 9 failures are all in the three edge-function specs (`push-love-note-trigger`, `push-partner-activity-trigger`, `upload-love-note-image-limits`), each answering 503 from `/functions/v1` because the shared stack's edge runtime is stopped.
  - The 12 that did not run are their serial siblings.
  - Neither those specs nor `supabase/functions` is touched by this change.
- `token-persistence-overlap.spec.ts` cannot be collected in a worktree without its own `node_modules`. UNVERIFIED here.
- The tracer (`partner-streak.spec.ts`) passed: both partners of a cleared pool pair pick on Daily, and each Partner page shows held 1 "day answered together", run 1 "in a row", orange, today's dot done, and no mood card, recent moods or Poke/Kiss/Fart tiles.

**Residual risks:**
- The 21 edge-runtime tests and `token-persistence-overlap` were not run against this change. CI's api leg and a full install cover them.
- The seven deferred lows above.
- The streak does not show offline: there is no saved copy yet. Story 3 adds it.
