---
title: 'Refactor sweep'
type: 'chore'
ticket: '10'
created: '2026-11-01'
status: done
baseline_revision: 'eb06dacc4868a5f61111007653e46569577b7ee9'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The new center wording in sim help and AGENTS.md ("ends on the Home Screen, except that a folded-landscape start gets its front app back") misses two cases: a landscape start on a phone with no pose also gets its front app back, and a folded-landscape start whose front step fails gets nothing back.
    evidence: |-
      cmd_center asks for the front app whenever `$CENTER_POSE != unfolded && $CENTER_ORIENT != portrait`, which includes an empty pose (a phone with no pose, such as an iPhone 17). center_restore relaunches only when CENTER_FRONT is set and not `none`, so when `notify front` fails nothing is relaunched; center only says the folded landscape may not come back. Found by story 3.10's review. The fix edits AGENTS.md, so it is deferred: reword both to "a landscape start that is not unfolded gets back the shell, the host app, Settings or Safari when the front step found one".
    location: >-
      scripts/sim-driver/sim (help, center line; cmd_center; center_restore); AGENTS.md (Maintained by hand, sim-driver paragraph)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Stories 12, 14, 1–9 and 13 of epic-push-notifications deferred findings to the ledger as DW-338–DW-362. Five of them are open copies of other entries. Three low ones are cheap fixes nobody has made (DW-349, DW-350, DW-351). DW-341's open question can now be answered from the code and the local database. Story 11 ships whatever this sweep leaves.

**Approach:** Cleanup only. Fix the agent-fixable low findings: split `sim banner`'s signal trap so TERM exits 143 (DW-351), and document `center`'s folded-landscape restore exception and the Home Screen it leaves in front, in `sim help` and in AGENTS.md's sim-driver clause (DW-349, DW-350; the AGENTS.md edit goes in its own docs commit). Close the open duplicates (DW-354→353, DW-358/359/360→357, DW-362→361). Settle DW-341 with a rolled-back local insert and, because the answer is a broken picture-only send (scope this sweep must not take), append it as a new ledger entry. Leave every finding that needs a design decision, an owner choice, a simulator run past 8 groups or a device check open in the ledger, with no change.

</intent-contract>

## Implementation Notes

Oneshot: about 40 changed lines across `scripts/sim-driver/sim`, `AGENTS.md`, the ledger and this plan, with no product code.

Inventory: every deferral from the twelve stories, from plan frontmatter `deferred:` and the Review Triage Logs, and where it ends up:

| Entry | Finding | Disposition |
|---|---|---|
| DW-338 (339 dup, closed) | `center` multi-screen read unproven | open: needs a simulator run past 8 groups |
| DW-340 (342 dup, closed) | send-push claim before APNs call | open: design decision (pending state or retrier) |
| DW-341 (343 dup, closed) | picture-only stand-in unverified | settled here; the refusal becomes a new entry |
| DW-344 (346 dup, closed) | `banner --tap cold` miss | open: needs ten simulator runs |
| DW-345 (347 dup, closed) | summary cells past 8 groups | open: needs the DW-338 run |
| DW-348 | Rotate-Left restore and coordinate fallback never run | open: needs simulator runs |
| DW-349 | AGENTS.md omits the folded-landscape exception | fix |
| DW-350 | `center` leaves the Home Screen in front, undocumented | fix (document; behavior kept) |
| DW-351 | `banner` exits 130 on TERM | fix |
| DW-352 | delivered notifications survive sign-out | open: new behavior, a later story |
| DW-353 (354 dup) | stale row after reinstall | open: decision; close 354 as a duplicate |
| DW-355 | unpinned esm.sh import in deployed functions | open: owner decision |
| DW-356 | stale row after offline sign-out | open: decision |
| DW-357 (358/359/360 dup) | types file not raw CLI output | open: AGENTS.md decision; close the duplicates |
| DW-361 (362 dup) | 1 s badge re-clear unverified on a device | open: story 11's device check; close 362 |

Story 1's residual risk "CI's edge-runtime serving of `send-push` for the new api spec is unverified" is settled: main's test run 41265095445 (head 74897fd9) passed `tests/api/push-love-note-trigger.spec.ts`, all six tests, in the `Backend Tests (api)` job.

Implementation (2026-11-01):
- `scripts/sim-driver/sim`: banner's INT/TERM trap split (130/143); center's help line says it ends on the Home Screen except after a folded-landscape start.
- `AGENTS.md` sim-driver clause: the folded-landscape exception and the Home Screen ending (its own docs commit).
- Ledger: DW-341, 349, 350 and 351 resolved; DW-354, 358, 359, 360 and 362 closed as duplicates; DW-363 appended.
- DW-341 settled with a rolled-back local insert: `content = ''` with an `image_url` fails `love_notes_content_check`. So a picture-only note sent from the app is refused. That is a product bug, not cleanup, so it goes to the ledger as DW-363 and is not fixed here.
- DW-350 kept the behavior and documented it: relaunching the front app on every start would cost a runner step and need a simulator run to prove.
- xcodebuild first failed on the gitignored `public`, `capacitor.config.json` and `config.xml`. `fnox exec -- npm run build` and then `npx cap copy ios` produced them; `dist/` holds that secrets build.

Verification run: `npm run lint` and `npm run typecheck` exit 0; `npm run test:unit` 215 files and 3413 tests passed; `deno test --no-lock supabase/functions/send-push/` 95 passed; `test-center-exit.zsh` 8 of 8 ok; the banner harness (scratchpad `banner-signal.zsh`, cmd_banner with stubbed steps) gave INT 130 and TERM 143 with the step killed, against 130 for both at baseline; xcodebuild of the App scheme for the iOS Simulator: BUILD SUCCEEDED.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` (quick) The AGENTS.md edit is not in its own docs commit, though the plan says it is — at review time nothing is committed yet, because commits are made at Finalize; this run commits `AGENTS.md` alone as a `docs` commit before the rest.
  - `[low]` `[patch]` (quick) DW-363 says the composer shows the error, but `sendNote`'s 23514 branch returns without throwing, so `handleSend` vibrates success and clears the composer; the message shows only in `notes-error-banner`, and `retryFailedMessage` re-inserts `''` and fails again — verified at `notesSlice.ts` (both `if (error || !data)` branches) and `MessageInput.tsx:137-145`; DW-363's title and reason rewritten to say so.
  - `[low]` `[defer]` (quick) The center wording in `sim help` and AGENTS.md misses the no-pose landscape start (it also gets its front app back) and a failed front step (gets nothing back) — verified against `cmd_center`'s `$CENTER_POSE != unfolded && $CENTER_ORIENT != portrait` and `center_restore`'s `CENTER_FRONT` guard; the fix edits AGENTS.md, so it is deferred as a frontmatter `deferred` item.

## Verification

**Commands:**
- `npm ci` then `npm run lint` and `npm run typecheck` -- expected: exit 0
- `npm run test:unit` -- expected: pass
- `deno test --no-lock supabase/functions/send-push/` -- expected: pass
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <scratchpad> CODE_SIGNING_ALLOWED=NO build` -- expected: BUILD SUCCEEDED
- `zsh scripts/sim-driver/test-center-exit.zsh` -- expected: every case passes
- A scratchpad harness that loads `sim` with stubs, as `test-center-exit.zsh` does, sends INT and then TERM during `cmd_banner` -- expected: exit 130 and then 143

**Manual checks:**
- `git diff` of the ledger touches only the status/resolution lines of DW-341, 349, 350, 351, 354, 358, 359, 360 and 362, plus one appended entry
- `grep -c '^### DW-' deferred-work.md` goes up by exactly one

## Auto Run Result

**Summary:** The cleanup sweep over the deferrals of stories 12, 14, 1–9 and 13. Every finding those stories deferred is either fixed or recorded in the ledger (inventory table above). Fixed: `sim banner` now exits 143 on TERM (DW-351). `center` documents its folded-landscape exception and that it ends on the Home Screen, in `sim help` and AGENTS.md (DW-349, DW-350). Closed as duplicates: DW-354, 358, 359, 360 and 362. DW-341 is settled: a picture-only note sent from the app is refused by `love_notes_content_check`, recorded as new entry DW-363 and not fixed here (a behavior change). Every remaining entry needs a design decision, an owner choice, a simulator run past 8 groups or a device check, so it stays open and unchanged.

**Files changed:**
- `scripts/sim-driver/sim` — banner's INT/TERM trap split (130/143); center's help line says where it ends.
- `AGENTS.md` — the sim-driver clause gets center's folded-landscape exception and Home Screen ending (own docs commit).
- `_bmad-output/initiative-my-love/deferred-work.md` — 9 entries resolved (4 fixed or settled, 5 duplicates); DW-363 appended.
- `_bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-refactor-sweep-plan.md` — this plan.

**Review findings:** Quick lens, 3 findings. Patched 1 low (DW-363 misdescribed the symptom). Deferred 1 low (the center wording misses the no-pose landscape start and a failed front step; its fix edits AGENTS.md), as a frontmatter `deferred` item and not written into the ledger, so the orchestrator's import does not duplicate it. Rejected 1 false: commit separation, refuted because commits are made at Finalize and AGENTS.md is committed on its own.

**Follow-up review recommended:** false. Only one low was patched; patched counts: high 0, medium 0, low 1.

**Verification:** After the patch:
- `npm run lint` and `npm run typecheck` exit 0.
- `npm run test:unit`: 215 files, 3413 tests passed.
- `deno test --no-lock supabase/functions/send-push/`: 95 passed.
- `zsh scripts/sim-driver/test-center-exit.zsh`: 8 of 8 ok.
- Banner signal harness: INT 130 and TERM 143 with the step killed; the baseline gives 130 for both.
- xcodebuild of the App scheme for the iOS Simulator: BUILD SUCCEEDED (after `fnox exec -- npm run build` and `npx cap copy ios`).
- Ledger: the `### DW-` count went from 361 to 362, and only the intended status and resolution lines changed.

**Residual risks:**
- DW-363 is a user-visible bug: picture-only notes cannot be sent. That the hosted constraint matches is UNVERIFIED.
- The banner TERM fix was checked with stubbed runner steps, not on a simulator.
- DW-350's behavior is documented, not changed.
- `dist/` and `ios/App/App/public/` hold this worktree's secrets build from `fnox exec -- npm run build` (both gitignored).
