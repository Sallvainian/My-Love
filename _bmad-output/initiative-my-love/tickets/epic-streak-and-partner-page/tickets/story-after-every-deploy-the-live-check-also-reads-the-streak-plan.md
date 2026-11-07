---
title: 'After every deploy, the live check also reads the streak'
type: feature
ticket: '11'
created: '2026-11-07'
status: done
baseline_revision: '64489fb032c26b1c15c0b3400e58a8a87d8568f3'
route: oneshot
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The post-deploy live check (`tests/live/daily-question-live.spec.ts`, story 6.11, run by `deploy.yml`'s `live-daily-check`) proves the hidden pick and the reveal on the real site, but nothing checks the streak or Past questions in production after a deploy (epic Done: "the live check sees the production Claude bot pair's streak and today's question in Past questions on the live Partner page").

**Approach:** After both reveal checks, each bot loads `/partner` (waiting on its own `get_couple_streak` and `get_daily_history` answers, both 200) and the page must show the streak card in orange with 1 day answered together and 1 in a row, and Past questions holding exactly today's question, with that bot's pick first, the partner's second, marked Different (A always picks This, B That). `reset_bot_daily_days` leaves the pair only today, and `couple_streak` counts from the pair's first `couple_days.day`, so 1 / 1 / orange holds on every run. The spec keeps its rules: the two bot accounts and the publishable key only, never the Supabase secret key, never the owner's or partner's account, plain `@playwright/test` with no pooled fixtures. A defect this check finds that predates it gets its own new story, never a fix here.

</intent-contract>

## Implementation Notes

- Oneshot: one spec file, about 40 lines (a small `openPartner` helper beside `openDaily`, a per-bot assertion block, the header comment); no app, server or workflow change. `deploy.yml`'s job comment describes the job's purpose and secrets and stays accurate.
- `/partner` is loaded with `page.goto`, not the dock: after the second pick Daily raises the +1 screen (story 7.5) and the write-tomorrow sheet over the dock, and the +1 belongs to Daily only, so a fresh load of `/partner` shows neither. `dismissStreakUp` is not imported because its module imports `merged-fixtures`, which this spec avoids on purpose.
- Test ids read: `partner-streak-card` (`data-state`), `partner-streak-held`, `partner-streak-run`, `partner-past-questions`, `partner-past-question` (`data-same`), `partner-past-question-text`, `partner-past-question-picks` (`{mine} · {theirs}`), `partner-past-question-mark`.
- 2026-11-07 (built): `tests/live/daily-question-live.spec.ts` only: header paragraph, `COUPLE_STREAK_READ`/`DAILY_HISTORY_READ` imports, `openPartner(page)` and `expectOneDayTogether(page, question, mine, theirs)` helpers, the two per-bot calls after the reveal checks, and the test title. Both pages' streak card are checked for 1 day answered together, 1 in a row and `data-state` orange; Past questions for exactly one row, today's question, the bot's own pick first, Different (`data-same` false).
- 2026-11-07 (verify): the shared local stack held no bot account, so the first local-mode run created and linked both bots and passed, and a second run passed (4.8 s, 4.5 s). A mutation (expecting `Same`) failed on `partner-past-question-mark` with "Received: Different", then the file was restored. The dev server's log shows `Failed to fetch` console errors from reads a reload or navigation cancels (B's pick announcement and Daily's reads); the spec does not monitor console errors, and nothing failed on them.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0, or only the loop worktree's known TS2883 errors, the same set as at `baseline_revision`.
- `npm run lint` -- expected: exit 0.
- `CLAUDE_BOT_PASSWORD=<any> CLAUDE_BOT_PARTNER_PASSWORD=<any> npx playwright test -c playwright.live.config.ts`, run twice in a row on the shared local stack (pinned CLI `mise exec -- supabase`), whose `auth.users` held no bot account at planning -- expected: the first run creates and links the bots and both runs pass.

**Manual checks (if no CLI):**
- On main, the deploy's Live Daily Check passes with the streak and Past questions assertions: only observable after this epic ships through `deploy.yml`, since the live site and hosted project do not yet carry epic 7.

## Review Triage Log

### 2026-11-07 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` `openPartner`'s 200 check could match a `get_couple_streak` response from Daily's mount read or the start refresher, not the Partner page's own read — the check lets no wrong result through: a Partner-page streak read that is not 200 leaves no `partner-streak-card` (`PartnerView.tsx` shows the loading or error box instead), so `expectOneDayTogether`'s `toBeVisible`/`data-state`/`1` assertions fail whichever 200 the watcher saw; the refresher's read on the new document is the same account's read of the same RPC that fills the same store.
  - `[low]` `[patch]` `deploy.yml`'s `live-daily-check` comment still said the job proves only the hidden-pick gate and the reveal — fixed: the comment now also names the Partner page's streak and today's question in Past questions (R6, R7); YAML still parses.
  - `[low]` `[patch]` the spec's first header line named only story 6.11 (R1, R2) — fixed: it now also names the Partner page's streak and Past questions (story 7.11; R6, R7).

## Auto Run Result

Status: built

**Summary:** The post-deploy live check now also reads the streak. After both reveal checks, each bot loads `/partner`, waits for its `get_couple_streak` and `get_daily_history` reads (both 200), and must see the streak card orange with 1 day answered together and 1 in a row, and Past questions holding only today's question with its own pick first, marked Different. The spec keeps its rules: bot accounts and the publishable key only, plain `@playwright/test`, no secret key. This check found no defect that predates it.

**Files changed:**
- `tests/live/daily-question-live.spec.ts` -- `openPartner` and `expectOneDayTogether` helpers, the per-bot Partner checks, header and title.
- `.github/workflows/deploy.yml` -- the `live-daily-check` job comment names the new checks (comment only).

**Review findings:** 2 patched (both low), 0 deferred, 1 rejected (`false`: a non-200 Partner-page read leaves no streak card, so the screen assertions fail anyway).

**Follow-up review recommended:** false -- first pass patched no high and no medium (patched by verdict: high 0, medium 0, low 2).

**Verification:** `npm run lint` exit 0; `npm run typecheck` exit 0; the live spec in local mode on the shared local stack (no bot account there beforehand): run 1 created and linked the bots and passed, run 2 passed; after the review patches it passed twice more. A mutation expecting `Same` failed on the mark with "Received: Different". `deploy.yml` parses as YAML.

**Residual risks:** the ticket's second check, the deploy's Live Daily Check passing on main, cannot run yet. The live site and the hosted project get epic 7's Partner page, `get_couple_streak` and `get_daily_history` only when this epic ships through `deploy.yml`, so it is UNVERIFIED until the first deploy after the merge to main. The production bots' existing days are cleared by `reset_bot_daily_days` before each run, so a pair linked long ago still reads 1 / 1. The dev server logs `Failed to fetch` errors for reads cut off by a reload or navigation; the spec does not watch console errors.

## Corrections

- 2026-11-07: Implementation Notes said `deploy.yml`'s job comment "stays accurate"; it described only the hidden-pick gate and the reveal, and now also names the Partner-page checks.
