---
title: 'Refactor sweep'
type: refactor
ticket: '10'
created: '2026-11-26'
status: done
baseline_revision: 'ef95e4574b4bd555b8cd36bd4a3ffa0b32531ea8'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 1 to 9 deferred seventeen findings (DW-525 to DW-541, all `open`, low). Five are the same host-clock flake in five specs: a run that crosses local midnight (the Daily day turns) or 20:00 (the nudge slot turns) between seeding and the last assertion fails spuriously (DW-527, DW-531, DW-534, DW-535, DW-541); every entry names one shared guard as the fix. One is a direct correction in `send-push`: a pick's `is_second` is never compared with the posted kind (DW-525), while reminders already get a posted/stored guard.

**Approach:** Picked at the start: DW-525, DW-527, DW-531, DW-534, DW-535, DW-541. One test helper waits past a local midnight or 20:00 that falls inside the test's own timeout window (and just after one), then extends the timeout by the wait; the five specs call it before their first date-dependent step. `send-push` reads `is_second` and treats a mismatch with the posted kind as no push, claiming nothing, as it does for a reminder. The other eleven entries stay `open`, unchanged (see Design Notes).

## Boundaries & Constraints

**Always:** The wait covers [now − 10 s, now + `testInfo.timeout`]: a turn inside it means sleep until 10 s past that turn (past `useDailyDayRereads`' 20:00:05 timer), then `testInfo.setTimeout(testInfo.timeout + waited)`. Turns are host-local wall-clock 00:00 and 20:00, built from calendar components (`new Date(y, m, d, h)`), never parsed strings. A mis-posted pick kind answers 200 with every count 0, lists no device and claims nothing, so the correct post later still records. Keep every existing assertion; fixture rows change only to carry `is_second`. `deferred-work.md`: on the six fixed entries only, set `status: done 2026-11-26` and add one `resolution:` line.

**Never:** No skip (`test.skip`) in place of the wait. No change to any migration, SQL function, `database.types.ts`, app code under `src/`, or other spec. Do not edit the eleven other ledger entries (headings, locations or text), any ticket file, or `tickets.toml`. Do not touch the live check (8.11). No `prettier --write`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clear | 14:00, timeout 60 s | no wait, timeout unchanged | — |
| Before midnight | 23:59:30, timeout 60 s | waits until 00:00:10 (40 s), timeout 100 s | — |
| Before 20:00 | 19:58:30, timeout 120 s | waits until 20:00:10, timeout grows by the wait | — |
| Just after a turn | 20:00:04 | waits until 20:00:10 | — |
| Turn beyond window | 19:57:00, timeout 60 s | no wait | — |
| First pick posted as first | `daily_partner_picked`, `is_second` false | records as today | — |
| Kind mismatch | `daily_partner_picked` for `is_second` true, or `daily_both_answered` for false | 200, zeros, no device listed, nothing claimed | — |
| Mis-post then correct post | mismatch post, then the matching kind for the same pick | the second records | — |

</intent-contract>

## Code Map

- `tests/support/helpers/events.ts:185-227` -- `isoDateDaysFromNow`, `clockAnchor`: the clock helpers; add the new pure function and its async wrapper beside them (type-only `TestInfo` import from `@playwright/test`).
- `tests/unit/helpers/events.test.ts` -- existing unit tests of those helpers; add the matrix's clock rows on the pure function.
- `tests/api/push-daily-sender.spec.ts:98,203` -- two tests, each calls `setUpPair` first (DW-527).
- `tests/api/push-daily-picks.spec.ts:49` -- one test, seeds at :60 (DW-531).
- `tests/api/push-daily-nudge.spec.ts:89,129` -- two tests, `setUpPair` first; a repeat-in-slot refusal also breaks across 20:00 (DW-534).
- `tests/e2e/daily/daily-question-nudge.spec.ts:51` -- one test, `clearPairDays` first; header :14-17 names DW-535.
- `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts:88-131` -- the `setup` fixture clears and opens Daily before every test; the guard goes at its top, using the fixture's `testInfo` argument; header :17-22 names the flake (DW-541).
- `supabase/functions/send-push/handler.ts:263-267` `DailyPickRow`, `:418-447` the pick branch of `resolveSource`, `:465-474` the reminder mismatch to copy; header :51-61 describes the guards.
- `supabase/functions/send-push/index.ts:116-121` `getDailyPick` selects `id, day_id, user_id`; service_role has SELECT on `is_second` (`20261105030000_daily_question_days_and_picks.sql:166-168`), never `choice`.
- `supabase/functions/send-push/handler.test.ts:84` the shared `dailyPick` fixture, used with both `PICK_POST` and `BOTH_POST` (:1025-1063 `KIND_CASES`, :1323-1420); `:1552` the reminder-mismatch test to mirror.
- `_bmad-output/initiative-my-love/deferred-work.md:4462-4600` -- DW-525 to DW-541.

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/helpers/events.ts` -- add `msUntilClearOfDailyTurns(now, windowMs)` (pure) and `waitClearOfDailyTurns(testInfo)` (sleeps, extends the timeout) with a header naming the two turns and the DW ids -- one guard for five specs.
- [x] `tests/unit/helpers/events.test.ts` -- the five clock rows of the matrix, plus a DST-day midnight -- pins the window rule.
- [x] `tests/api/push-daily-sender.spec.ts`, `tests/api/push-daily-picks.spec.ts`, `tests/api/push-daily-nudge.spec.ts`, `tests/e2e/daily/daily-question-nudge.spec.ts`, `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts` -- call the guard before the first seed, clear or read; rewrite the header sentences that call the crossing an open flake to say the guard covers it -- DW-527, 531, 534, 535, 541.
- [x] `supabase/functions/send-push/index.ts`, `handler.ts` -- select `is_second`; in the pick branch a kind that disagrees with it returns `recipientId: null, buildPayload: null`; update the header -- DW-525.
- [x] `supabase/functions/send-push/handler.test.ts` -- `firstPick`/`secondPick` fixtures (or `is_second` on `dailyPick` per post); tests for both mismatches and for mis-post then correct post -- DW-525.
- [x] `_bmad-output/initiative-my-love/deferred-work.md` -- `status: done 2026-11-26` and `resolution:` on the six entries.

**Acceptance Criteria:**
- Given a Daily spec started within its timeout of 20:00 or midnight, when it runs, then it starts only after the turn and passes within its extended timeout.
- Given the five specs, when run on the local stack away from a turn, then they pass with no added wait.
- Given `deno test --no-lock supabase/functions/send-push/`, when run, then every existing test and the new mismatch tests pass.

## Implementation Notes

- 2026-11-26 (subagent, Sonnet): `msUntilClearOfDailyTurns` and `waitClearOfDailyTurns` in `tests/support/helpers/events.ts`; the wrapper extends the timeout before it sleeps (the sleep counts against it) and leaves a disabled timeout (0) alone. Eight unit cases in `tests/unit/helpers/events.test.ts` (the matrix's five clock rows, exactly 10 s past, and both 2026 DST days under Vitest's `TZ=America/New_York`). The five specs call the guard first in each test (in the `setup` fixture for `daily-question-after-pick-nudge.spec.ts`). `send-push` selects `is_second`; `handler.test.ts` swaps the shared `dailyPick` for `firstPick`/`secondPick` with no assertion changed, and adds the two mismatch tests. Six ledger entries closed.
- 2026-11-26 (parent): rewrapped two over-long header lines (`push-daily-picks.spec.ts`, `daily-question-nudge.spec.ts`), comment only.
- Verified (parent): `deno test --no-lock supabase/functions/send-push/` 125 passed, no `deno.lock` written; `npm run test:unit` 266 files / 5161 tests passed; `npm run lint`, `npm run typecheck` clean; `supabase test db` 37 files / 1167 PASS. With `supabase functions serve` from this worktree: the five daily/partner push api specs 12 passed, then the `api` and `integration` projects 96 passed, row audit clean. E2E (`chromium`), folder by folder: daily and partner 53 passed; account-data, auth, errors, home, navigation 131 passed; notes, offline, photos, settings 121 passed and 4 failed with `TypeError: fetch failed` from the shared local stack (settings events specs, not touched here); the settings folder again 72 passed / 1 failed the same way; `events-history-pagination.spec.ts` and `events-persistence.spec.ts` at two workers 13 passed. `tests/e2e/auth/token-persistence-overlap.spec.ts` cannot load in this worktree: it reads `node_modules/@playwright/test/package.json` from the worktree root, where the nested worktree's `node_modules` has no `@playwright` (it resolves from the main checkout); untouched by this change.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) `tests/api/push-daily-picks.spec.ts` header said a midnight or 20:00 "would turn the Daily day"; only midnight does, and this spec sends no nudge — real (the sender and nudge headers name "the Daily day or the nudge slot"). Fixed: the header says midnight turns the day and the shared guard also waits past 20:00, which this spec does not need.
  - `[low]` `[patch]` (quick) `supabase/migrations/20261125000000_daily_push_sender.sql:17-20` still says send-push does not check `is_second` (DW-525), stale after this change, and nothing records it — real. Migrations stay as written history (the plan's Never), so the fix is one sentence appended to DW-525's own `resolution:` line naming that header sentence as predating the fix.

## Design Notes

Why the wait, not a skip: a skip drops P0 coverage silently on those runs; the wait costs at most one test timeout on about 0.3% of runs (4 minutes a day near the two turns). The window is the test's own timeout because a test that ends in time cannot cross a turn it started clear of, whatever it does inside. Both turns apply to all five specs: one helper with no options, at the price of a rare needless wait near 20:00 for the picks and sender specs.

```ts
export function msUntilClearOfDailyTurns(now: Date, windowMs: number): number {
  for (const hour of [0, 20]) for (const dayOffset of [-1, 0, 1]) {
    const turn = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour);
    const until = turn.getTime() - now.getTime();
    if (until > -PAST_TURN_MS && until <= windowMs) return until + PAST_TURN_MS;
  }
  return 0;
}
```

Entries left `open`, unchanged: DW-529, DW-532, DW-536 change AD-9's or AD-17's rule (the architect's or owner's call); DW-537 and DW-539 need a behaviour the intent does not settle (the pick path does not reload on P0002 either); DW-538 and DW-540 are new re-read behaviour, scope for a new story; DW-526 needs a choice of what to send when the partner changed (drop, old name or new name); DW-528 and DW-530 need the cron job paused or instants chosen from stored zones, new logic; DW-533 needs a migration for a race no test can show.

Rejections whose missing code now exists, re-checked: story 3's "nudge `from_user`/`to_user` unchecked against the pair" and "`daily_nudges` lacks `from_user <> to_user`" — story 7's `record_daily_nudge` takes both from the viewer's pair, whose seats differ (`couple_days_ordered_pair check (user_a < user_b)`), so still unreachable; "no test for a malformed new-kind row" — stories 5 to 7's writers insert only well-formed rows; "R4 arrives once / retried pick" — story 6 built and tested it; "a post after the date moved on" — pg_net still posts once. None needs a fix.

## Verification

**Commands:**
- `npx vitest run tests/unit/helpers/events.test.ts` -- expected: pass.
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass.
- `npx playwright test --project=api tests/api/push-daily-sender.spec.ts tests/api/push-daily-picks.spec.ts tests/api/push-daily-nudge.spec.ts` -- expected: pass (needs `supabase start` and the edge runtime).
- `npx playwright test --project=chromium tests/e2e/daily/daily-question-nudge.spec.ts tests/e2e/daily/daily-question-after-pick-nudge.spec.ts` -- expected: pass.
- `npm run test:unit`, `npx playwright test` (all projects), `supabase test db` -- expected: pass (the ticket's Verify).
- `npm run lint` and `npm run typecheck` -- expected: no errors.

## Auto Run Result

- **Status:** built.
- **Summary:** Picked at the start, of the seventeen open entries stories 1 to 9 deferred (DW-525 to DW-541): DW-525, DW-527, DW-531, DW-534, DW-535, DW-541. One test guard, `waitClearOfDailyTurns(testInfo)`, now covers the five Daily specs that failed when a run crossed host-local midnight or 20:00. It waits until 10 s past a turn that falls inside the test's own timeout window (or within 10 s behind it) and extends the timeout by the wait, so nothing is skipped. `send-push` now reads a pick's `is_second` and treats a posted kind that disagrees with it as no push that claims nothing, as it already did for reminders. The six entries are `done` in the ledger. The other eleven stay `open` and unchanged, for the reasons in Design Notes. The review rejections whose missing code later stories built were re-checked, and none needs a fix (Design Notes).
- **Files changed:**
  - `tests/support/helpers/events.ts`: `msUntilClearOfDailyTurns` (the pure rule) and `waitClearOfDailyTurns` (sleeps and extends the timeout).
  - `tests/unit/helpers/events.test.ts`: eight clock cases, including both DST days.
  - `tests/api/push-daily-sender.spec.ts`, `tests/api/push-daily-picks.spec.ts`, `tests/api/push-daily-nudge.spec.ts`: each test calls the guard first, and the headers say so.
  - `tests/e2e/daily/daily-question-nudge.spec.ts`, `tests/e2e/daily/daily-question-after-pick-nudge.spec.ts`: the guard runs before the pair's days are cleared (in the latter's `setup` fixture), and the headers no longer call the crossing an open flake.
  - `supabase/functions/send-push/index.ts`: `getDailyPick` selects `is_second`.
  - `supabase/functions/send-push/handler.ts`: `DailyPickRow.is_second`, the order guard in `resolveSource`, and the header updated.
  - `supabase/functions/send-push/handler.test.ts`: `firstPick` and `secondPick` fixtures, no assertion changed, plus the two mismatch tests.
  - `_bmad-output/initiative-my-love/deferred-work.md`: the six entries are `done 2026-11-26` with a `resolution:` line each.
- **Review findings:** 2 patches applied (both low): the picks spec header's wording, and DW-525's resolution now names the stale sentence in the 8.3 migration header. Nothing was deferred or rejected.
- **Follow-up review recommendation:** `false`. This first pass patched 0 high and 0 medium entries.
- **Verification:** as recorded in Implementation Notes:
  - `deno test --no-lock supabase/functions/send-push/` 125 passed.
  - `npm run test:unit` 5161 passed.
  - `npm run lint` and `npm run typecheck` clean.
  - `supabase test db` 1167 PASS.
  - The `api` and `integration` projects 96 passed, with `supabase functions serve` from this worktree, which was stopped afterwards.
  - E2E `chromium` folder by folder: every test passed except four settings events tests, which failed with `fetch failed` from the shared local stack under 5 workers. Those two files passed on a rerun at 2 workers (13 passed).
  - `token-persistence-overlap.spec.ts` cannot load in this worktree (its `node_modules` has no `@playwright`), so it did not run. This change does not touch it.
  - After the review patches (text only): ESLint on the picks spec is clean, and `push-daily-picks.spec.ts` 1 passed.
- **Residual risks:** none known in the change. The guard adds at most one test timeout of wait on runs that start near 20:00 or midnight.
