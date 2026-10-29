---
title: 'Fix the 2026-10-03 tests/e2e and tests/api findings'
type: 'chore'
ticket: '11'
created: '2026-10-28'
status: done
baseline_revision: '119d4780576bb009c387f21061eceafe88e446c7'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-e2e.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-api-integration.md'
  - '{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-03-suite-high.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The 2026-10-03 TEA re-reviews left 22 rows in tests/e2e and tests/api: 19 e2e rows (M1, L1, L3, L5, L6, L7), one api L6 row, and two suite-run H10 rows (`tests/api/upload-love-note-image-limits.spec.ts` `x-ratelimit-remaining` existence check, `tests/e2e/home/events.spec.ts` regex day count). The suite run's two `moodNormalization.test.ts` H10 rows belong to story 10 and are out of scope.

**Approach:** Fix each row as its finding suggests, located by content: await Settings' events load with `openSettingsFromHome`; replace copy-based absence checks with existing test ids or `not.toContainText` on test-id containers; add `data-testid="mood-sync-status"` (MoodTracker sync span) and a wordmark-text test id (AppNavigation) as test hooks; rename mechanism test names to outcomes, giving each `overlapping` scenario its own behaviour sentence; export the CHECK leak fragments from `check-error-path-data.ts`; name the 20 px badge height and `CHECK_VIOLATION_CODE`; use `toHaveCount(0)` for "login screen gone"; assert the rate-limit header as an integer below `RATE_LIMIT_MAX_UPLOADS` that equals the body's `rateLimitRemaining`, and the countdown as `'13 days'` (N-1 from the noon anchor, as `events-crud.spec.ts` pins `'29 days'` for 30). One commit per finding group; lint, typecheck and the affected e2e/api specs green.

</intent-contract>

## Implementation Notes

Oneshot: every row is a small, localized test edit (two one-attribute app test hooks), about 80 lines across ~16 files, all mechanical.

- One commit per finding group: M1, L1, L3, L5, L6 (e2e), L7, L6 (api), H10. The two test hooks (`mood-sync-status` on both MoodTracker status spans, `app-wordmark-text` on the AppNavigation wordmark span) ride in the L3 commit; they are test hooks, not bug fixes.
- M1: `openSettingsFromHome` replaces the bare `/settings` goto. The old `recurse` only checked `userId` was a non-empty string; it now equals the worker's own id from `resolveOwnPair`, so the request-body match is pinned to a known value rather than a shape.
- L3 `settings-kit.spec.ts`: absence is `not.toContainText` on the `settings-view` test-id container, which also catches the title in any element, not only a text-matched one.
- L5: the token-persistence titles keep the scenario id in parentheses after the behaviour sentence, so a failure still maps to the attached `<scenario>-native-trace`.
- L6: `CHECK_ERROR_LEAK_FRAGMENTS` is built from the same two constants the factory's message is templated from, so the factory and the negative assertions cannot drift.
- H10 upload: the remaining count lives in the function isolate's memory and other cases in the worker share the minute window, so it cannot be exact; it is asserted as a whole number below `RATE_LIMIT_MAX_UPLOADS` (a local mirror, like `MAX_FILE_SIZE_BYTES`) and equal to the body's `rateLimitRemaining`. H10 events: `FUTURE_MEETUP.daysFromNow - 1` days, confirmed by the run ('13 days').
- Environment surprises: the worktree had an empty `node_modules`, and `token-persistence-overlap.spec.ts` reads package versions from `<root>/node_modules`, so `npm ci` was run in the worktree (a real install, gitignored, no symlinks). Playwright's chromium-headless-shell 1248 was missing and was installed. Local Supabase had no edge-runtime container, so `supabase functions serve` was run for the `api` leg.

## Plan Change Log

## Review Triage Log

### 2026-10-28 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 1, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` Commit `e2503cbd` subject `test: …` has no scope, against AGENTS.md's `type(scope): description` — reworded the local, unpushed HEAD commit to `test(e2e,api): …` (now `be84f217`); tree unchanged, lint and typecheck re-run green.
  - `[false]` `[reject]` The plan file is untracked and in no commit — Finalize commits the plan in its own documentation-only commit, as the workflow requires; nothing is left uncommitted.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npx playwright test <each touched spec>` with `supabase start` running -- expected: all pass

## Auto Run Result

Status: built

**Summary:** Fixed all 22 in-scope 2026-10-03 rows: the 19 tests/e2e rows (M1, L1 ×5, L3 ×5, L5 ×5, L6 ×2, L7), the tests/api L6 row, and the suite run's two tests/e2e + tests/api H10 rows. One commit per finding group, eight commits from `119d4780576bb009c387f21061eceafe88e446c7`.

**Files changed:**
- `src/components/MoodTracker/MoodTracker.tsx` — `mood-sync-status` test hook on the Online/Offline spans
- `src/components/Navigation/AppNavigation.tsx` — `app-wordmark-text` test hook on the wordmark span
- `tests/e2e/errors/empty-database-error-fallback.spec.ts` — M1: open Settings via `openSettingsFromHome`; store `userId` equals the worker's own id
- `tests/e2e/offline/interactions-offline-copy.spec.ts`, `love-notes-offline-copy.spec.ts`, `photos-offline.spec.ts`, `tests/e2e/partner/partner-connect.spec.ts` — L1: absence checks by test id / `not.toContainText` on test-id lists
- `tests/e2e/offline/network-status.spec.ts`, `tests/e2e/navigation/kit-chrome.spec.ts`, `tests/e2e/settings/settings-kit.spec.ts` — L3: test-id anchored checks
- `tests/e2e/auth/bootstrap-notification-order.spec.ts`, `tests/e2e/auth/token-persistence-overlap.spec.ts` — L5: outcome names, a `behaviour` sentence per overlap scenario
- `tests/support/factories/check-error-path-data.ts`, `tests/e2e/errors/check-error-path-consistency.spec.ts`, `tests/e2e/partner/interaction-record-ownership.spec.ts` — L6: exported `CHECK_ERROR_LEAK_FRAGMENTS`, named `BADGE_FULL_SIZE_PX`
- `tests/e2e/auth/login.spec.ts` — L7: `toHaveCount(0)`
- `tests/api/empty-database-error-fallback.spec.ts` — L6: `CHECK_VIOLATION_CODE`
- `tests/api/upload-love-note-image-limits.spec.ts`, `tests/e2e/home/events.spec.ts` — H10: rate-limit header pinned to range and body; countdown pinned to `daysFromNow - 1` days

**Review findings:** quick lens, 2 findings. Patched: 1 (low, commit scope). Deferred: none. Rejected: 1 (false — the plan is committed at Finalize).

**Follow-up review recommendation:** false — patched counts: high 0, medium 0, low 1.

**Verification:**
- `npm run lint` — exit 0; `npm run typecheck` — exit 0 (before and after the patch)
- `npx playwright test --project=chromium` on the 13 touched e2e specs other than token persistence — 53 passed
- `npx playwright test --project=api` on both touched api specs plus `tests/e2e/auth/token-persistence-overlap.spec.ts` — 17 passed (edge functions served with `supabase functions serve`)
- `npx vitest run src/components/MoodTracker src/components/Navigation` — 92 passed

**Residual risks:** The ticket's `verify` also requires fresh `bmad-tea-test-review` runs on tests/e2e and tests/api + tests/integration reporting no Critical or High; this run did not perform them — the orchestrator's verification owns that. The full e2e suite was not run, only the touched specs.

