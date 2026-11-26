---
title: 'After every deploy, the live check also sends a nudge'
type: feature
ticket: '11'
created: '2026-11-26'
status: done
baseline_revision: '4d79a1942e5a054da49722d2364193d1b1beac11'
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
deferred:
  - summary: >-
      The live check fails on the wrong sheet when UTC midnight passes between bot A's first Daily read and its pick on a day A is the writer.
    evidence: |-
      The spec picks its branch from A's `snapshot.write.mine` at open, but `showWriteSheet` (src/components/DailyQuestion/DailyQuestion.tsx:496-505) also needs `snapshot.day` to equal the device date. After a midnight crossing no write sheet shows and the nudge sheet does, so `daily-write-sheet` toBeVisible fails. It is real but rare (a crossing in the seconds between the open and the pick), and the spec already failed on a midnight crossing between A's pick and B's read. Routed here rather than rejected (the build's persistent fact for unlikely lows): the fix is a UTC-midnight guard, and `waitClearOfDailyTurns` reads the host clock, not UTC.
    location: >-
      tests/live/daily-question-live.spec.ts (the `openedA.snapshot.write.mine` branch)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The post-deploy live check (`tests/live/daily-question-live.spec.ts`, run by `deploy.yml`'s `live-daily-check`) proves the hidden pick and the reveal on the hosted site, but nothing after a deploy proves the hosted `send_daily_nudge` and the waiting card's Nudge button (epic 8, R2).

**Approach:** Between bot A's pick and bot B's, A answers the one sheet its pick raises: the write sheet's "No thanks" (`daily-write-decline`) when A's own snapshot says `write.mine` (so no hosted question row is written), then asserts no nudge sheet; otherwise the nudge sheet's "Not now" (`daily-nudge-sheet-dismiss`). Then A taps the waiting card's `daily-nudge`, one `send_daily_nudge` POST answers 200, the button is disabled and no `daily-nudge-error` shows. Everything else in the spec, its rules (bot pair only, publishable key only, never the owner's or partner's account, no device registered for either bot) and `reset_bot_daily_days` as the only clear stay as they are; the reset's cascade to `daily_nudges` lets a rerun nudge again. The header comment says what the spec now checks.

</intent-contract>

## Implementation Notes

Oneshot: one spec file, about 40 lines. A's writer status is read from its own `get_daily_day` answer (`snapshot.write.mine`), the one `openDaily` already returns, so the branch is decided by the server, not by whichever sheet happens to appear; the live check has no secret key, so the E2E specs' `readPairDayWriter` (admin) is not available. B, when it is the writer, meets the write sheet after its pick as today and leaves it open, which writes nothing. No turn guard: `waitClearOfDailyTurns` uses the host clock while this spec runs both bots on UTC, and the nudge's only new exposure is a 20:00 UTC crossing in the seconds between the 200 and the disabled check (the re-read fires at 20:00:05).

- 2026-11-26: `tests/live/daily-question-live.spec.ts` only: A's `openDaily` answer is kept for `snapshot.write.mine`; after A's pick it declines the write sheet (`daily-write-decline`) or dismisses the nudge sheet (`daily-nudge-sheet-dismiss`), then the waiting card's `daily-nudge` sends one `send_daily_nudge` (200) and is disabled, with no `daily-nudge-error` and no nudge sheet; header and test title say so. The writer alternates by date parity (`assign_couple_day`: `user_a` on even days since 2000-01-01), so a given day runs one branch; on 2026-11-26 the partner bot writes, so the real spec ran the Not now branch.
- Verified: `npx eslint tests/live/daily-question-live.spec.ts` clean; `npm run typecheck` clean; `fnox exec -- npx playwright test --config=playwright.live.config.ts` in local mode on the shared local stack (not a fresh one: the loop shares it, and no reset is allowed while it runs) 1 passed, twice in a row; each run left one `daily_nudges` row from A. The writer branch was run once from a throwaway copy with the two bots' roles swapped (`tests/live/zz-swapped-roles.spec.ts`, deleted afterwards): 1 passed, the writing bot sent one nudge and the pair has 0 `daily_questions` rows from the day. The deploy's Live Daily Check on main runs after the loop's PR merges; not run here.

- 2026-11-26 (review patch): the grey is now read after a reload of A, from the server's answer (`snapshot.nudge.spent` true, `daily-nudge` disabled, no error, no sheet), and `trackReads` counts exactly one `send_daily_nudge` POST; the header no longer says the spec proves nothing reaches a phone, only that it registers no device. Re-verified: lint and typecheck clean; the spec 1 passed twice in a row on the shared local stack; the role-swapped throwaway copy 1 passed (writer declined, one nudge, 0 written questions) and was deleted.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` (quick) `toBeDisabled()` and the no-error check right after the 200 pass while `sending` still disables the button (`DailyQuestion.tsx:221`, `dailyDaySlice.ts:636-655` awaits the merges first), so "its button greys" was never shown from `nudge.spent`, and "one POST" was unchecked. Real. Fixed: A reloads after the 200, its day answer must have `nudge.spent` true, then the button is disabled with no error or sheet, and `trackReads` counts exactly one `send_daily_nudge` POST.
  - `[low]` `[reject]` (quick) the ticket's verify asks for two passes on a fresh local stack, and both ran on the shared one. True, but the fix is a run, not code: the owner's one-shared-stack rule forbids a second or reset stack while the loop runs. The sign-up and link path that only a fresh stack exercises is unchanged and runs before the new steps. The deploy's Live Daily Check on main is the orchestrator's, after merge.
  - `[low]` `[patch]` (quick) the header said the spec "pushes nothing to a phone", which it cannot prove: a hosted bot could already have a device. Real wording overclaim. Fixed: the header says only that the spec registers no push device for either bot.
  - `[low]` `[defer]` (quick) a UTC midnight between A's open and its pick, on A's writer day, shows the nudge sheet instead of the write sheet and fails the branch. Real and rare. The whole spec already failed on a midnight crossing, and the fix is a UTC guard. Deferred to the ledger (frontmatter `deferred`).

## Verification

**Commands:**
- `fnox exec -- npx playwright test --config=playwright.live.config.ts` (local mode: `supabase start` on the pinned CLI, `VITE_SUPABASE_*` from `supabase status`, `CLAUDE_BOT_PASSWORD` and `CLAUDE_BOT_PARTNER_PASSWORD` set), run twice in a row -- expected: 1 passed both times.
- `npx eslint tests/live/daily-question-live.spec.ts` and `npm run typecheck` -- expected: no errors.

## Auto Run Result

- **Status:** built.
- **Summary:** The post-deploy live check now sends a nudge between the two bots' picks. After bot A's pick, A answers the one sheet that pick raises. If A's own day answer says A is the day's writer, A answers "No thanks" on the write sheet, so no hosted question row is written, and A sees no nudge sheet. Otherwise A answers "Not now" on the nudge sheet. A's waiting card then sends one `send_daily_nudge` (200). After a reload, A's day answer has the nudge spent and the Nudge button is grey. Everything else in the spec is unchanged: the bot-pair-only rules, the publishable key only, and `reset_bot_daily_days` as the only reset (its cascade clears the day's nudges).
- **Files changed:**
  - `tests/live/daily-question-live.spec.ts`: the sheet branch, the nudge send and its post-reload checks, the header and the test title.
- **Review findings:**
  - 2 patches applied: 1 medium (the grey is read from the server after a reload, and exactly one POST is counted) and 1 low (the header wording about phones).
  - 1 deferred (low): a UTC midnight crossing on A's writer day.
  - 1 rejected (low): the ticket asks for two passes on a fresh local stack, and the owner's one-shared-stack rule forbids a fresh stack during the loop. The fresh-stack-only path (sign-up and link) is unchanged.
- **Follow-up review recommendation:** `false`. This pass patched 0 high, 1 medium and 1 low entries.
- **Verification:**
  - `npx eslint tests/live/daily-question-live.spec.ts` and `npm run typecheck`: clean.
  - `fnox exec -- npx playwright test --config=playwright.live.config.ts` in local mode, on the shared local stack, run twice in a row: 1 passed both times, before and after the patches.
  - On 2026-11-26 the partner bot writes, so the committed spec ran the "Not now" branch. The writer alternates by date parity in `assign_couple_day`.
  - The writer branch ran from a throwaway copy with the bots' roles swapped: 1 passed, with one nudge and 0 `daily_questions` rows from that day. The copy was deleted.
  - Not run here: the deploy's Live Daily Check on main, which runs after the loop's PR merges.
- **Residual risks:**
  - A UTC midnight crossing mid-run still fails the spec, as it did before this change. This is in `deferred`.
  - Each committed run exercises only one of the two branches, chosen by the date's parity. The hosted check covers both branches on alternate days.
