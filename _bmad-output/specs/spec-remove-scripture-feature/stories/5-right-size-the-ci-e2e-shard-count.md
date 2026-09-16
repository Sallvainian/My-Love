---
title: 'Right-size the CI E2E shard count'
type: 'chore'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 3224d70b57885d79ea260d1ec4fa185cb32ec672
context:
  - _bmad-output/specs/spec-remove-scripture-feature/ci-baseline.md
warnings:
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** CI still shards chromium E2E four ways from a scripture-era duration skew. Dedicated scripture specs are already gone (`820be2d2`). The 381s worst shard and the August ~220s / ~76-test estimate are historical. CAP-6 needs a shard count from a measured green run of the suite that remains.

**Approach:** Measure first from a fully green Tests run whose E2E jobs actually ran. Record those numbers against the 381s baseline, then choose the shard count from that split — not from the August arithmetic — and write the decision beside the existing `test.yml` rationale. Rewrite the two stale scripture comments. Do not restructure burn-in or touch Supabase setup.

## Boundaries & Constraints

**Always:**
- Follow `ci-baseline.md` "How to verify" before editing shard count. Pull per-job times and the setup-vs-test split with the two `gh run view` jq commands there.
- A `conclusion: success` run is usable only if the E2E shard jobs ran (not skipped). Path gating can green a docs-only PR in seconds; those runs are not a measurement.
- Historical 381s (177s setup + 174s tests) is run `32279178457`, when 144 of 220 E2E tests were scripture. Label it historical. Do not treat it as current.
- Confirm the measured setup floor (expected 130–177s) before acting on fewer shards. This work cannot move that floor.
- Extra E2E shards each pay that floor. Do not increase above 4. Prefer the smallest N in `{1,2,3,4}` whose measured (or projected from the measured test-step) worst wall-clock still makes sense against runner-minutes; write the arithmetic in the comment.
- When N changes, keep these four literals equal to N in the same edit: job `name` (`/N`), `matrix.shard`, `--shard=${{ matrix.shard }}/N`, and `merge-reports` `Expected N shard blob reports`.
- Rewrite the burn-in comment that still names `scripture-reflection-2.2-errors` and `scripture-stats`. Rewrite `playwright.config.ts` 102-105 (scripture specs in one contiguous block).
- Record the new table in `ci-baseline.md` and the decision in `test.yml` beside the current 343-347 comment (precedent for documenting a sharding choice).

**Never:**
- Do not pick a shard count from the August ~220s estimate or the ~76 surviving-tests arithmetic.
- Do not touch the burn-in job (still 3 shards, still the same steps) or `.github/actions/setup-supabase/action.yml`.
- Do not restructure burn-in. Comment rewrite at the scripture spec names only.
- Do not change `workers: process.env.CI ? 2` in `playwright.config.ts`. The 102-105 comment is stale; the 2-worker CPU rationale below it stays.
- Do not invent timings. If no fully green run has E2E jobs that actually ran after the remaining suite landed, stop rather than estimate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Measure a real E2E run | Fully green Tests run whose E2E shards ran | `ci-baseline.md` records per-shard total, setup, and test-step; 381s is labelled run `32279178457` | Docs-only success (jobs skipped / few-second duration) is not used |
| Choose N from the split | Measured setup floor vs test-step | Smallest N in 1–4 that the arithmetic supports; comment at the matrix cites the run id and numbers | August ~220s is not an input |
| Couple N across the workflow | Chosen N ≠ 4, or N stays 4 | `name`, matrix, `--shard=…/N`, and merge-reports expected count all equal N | Partial update makes merge-reports fail or silently accept a partial report |
| Stale scripture comments | Burn-in comment names deleted specs; playwright 102-105 names a scripture block | Those sentences rewritten; burn-in still 3 shards; setup-supabase untouched | Do not "fix" by editing the burn-in job |

</intent-contract>

## Code Map

Re-verified 2026-09-16 on `3224d70b57885d79ea260d1ec4fa185cb32ec672` (this worktree after story 4 merge). Remaining E2E on this HEAD: `find tests/e2e -name '*.spec.ts' | wc -l` → 37; `rg -c "^\s*(test|it)\(" tests/e2e --glob '*.spec.ts'` summed → 110 (was 107 on 2026-09-15 main). `tests/e2e/scripture/` is absent.

**Measure (do this before any shard edit)**
- Procedure: `_bmad-output/specs/spec-remove-scripture-feature/ci-baseline.md` lines 61–77.
- Epic PR branch `chore/remove-scripture-feature` (PR 306). Newest Tests run that is not a docs skip: `35056348791` (head `2e40c7d6`, story 2 publish, conclusion success, ~7 min wall). Confirm E2E jobs ran before using it. Stories 3–4 are in this worktree (`fe20cf55`, `f055b280`) and not on origin yet; they do not delete E2E specs. Story 1 has no story file and no merge in this log; it also does not delete the 37 specs. If a newer fully green run with E2E jobs exists at implementation time, use that instead.
- Trap: runs `35052469806`, `35051862893`, `35051816461` concluded success in ~16–20s — docs-only path gating, not a measurement.
- `gh run view <RUN_ID> --json jobs` then the two jq one-liners in ci-baseline.md.

**`.github/workflows/test.yml` — E2E shard literals (must stay coupled)**
- `:333` `name: E2E (Shard ${{ matrix.shard }}/4)`
- `:343-347` rationale + `shard: [1, 2, 3, 4]` — **replace the comment with the new decision and numbers**; this is the precedent
- `:361` step name `…/4`
- `:364` `--shard=${{ matrix.shard }}/4`
- `:581-582` `if (( ${#reports[@]} != 4 )); then` / `Expected 4 shard blob reports` — **must match N** or merge-reports is wrong in both directions

**`.github/workflows/test.yml` — rewrite comment only**
- `:413-416` `a slice holding a single one-test file (there are two: scripture-reflection-2.2-errors and scripture-stats)` — those files are gone. Keep the surrounding burn-in rationale (3 shards, `fullyParallel`, contention). Do not change `:426` `/3` or `:446` `shard: [1, 2, 3]`.

**Read-only**
- `.github/actions/setup-supabase/action.yml` — SPEC non-goal
- Burn-in job steps and matrix — SPEC non-goal
- `playwright.config.ts:112-116` `workers: process.env.CI ? 2` — keep

**`playwright.config.ts`**
- `:102-105` `shards are balanced by test *count* (28/28/27/27) but the scripture specs sort into one contiguous block, so shard 3 took 9m against ~4m for the others` — rewrite. Keep `:107-115` wait-bound / 2-worker CPU note.
- `:30` Together-Mode scripture P0 sentence is outside this story.

**`_bmad-output/specs/spec-remove-scripture-feature/ci-baseline.md`**
- Keep the historical table for run `32279178457`.
- Add a post-stories-1–4 measured table (run id, per-shard total / setup / test-step, worst shard vs 381s).
- State that 381s is not the pre-story-5 current run.

## Tasks & Acceptance

**Execution:**
- `_bmad-output/specs/spec-remove-scripture-feature/ci-baseline.md` -- pull a fully green Tests run whose E2E jobs ran; record per-shard totals and setup/test split against historical 381s -- CAP-6 measure-first
- `.github/workflows/test.yml` -- choose N from those numbers; rewrite the 343-347 rationale; keep name / matrix / `--shard` / merge-reports expected count equal to N; rewrite the 413-416 scripture file names -- CAP-6 decision + stale comment
- `playwright.config.ts` -- rewrite the 102-105 scripture-contiguous-block comment; leave `workers` at 2 -- stale comment

**Acceptance Criteria:**
- Given `ci-baseline.md`, when it is read after this story, then it contains the measured run id, per-shard total/setup/test-step, and an explicit statement that 381s is run `32279178457` not that measured run.
- Given the chosen N, when `.github/workflows/test.yml` is read, then the e2e-tests job name, matrix, `--shard=…/N`, and merge-reports expected blob count are all N, and the comment beside the matrix cites the measured run id and the arithmetic.
- Given the burn-in job, when `test.yml` and `.github/actions/setup-supabase/action.yml` are diffed, then burn-in is still 3 shards with the same steps, setup-supabase is unchanged, and the burn-in comment no longer names `scripture-reflection-2.2-errors` or `scripture-stats`.
- Given `playwright.config.ts` around the CI `workers` setting, when the 102-105 comment is read, then it no longer says scripture specs sort into one contiguous block, and `workers` is still `process.env.CI ? 2`.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 11, false 9, maybe-false 0
- findings:
  - `[low]` `[patch]` README still said E2E was sharded across 4 runners — `README.md:176` now says 2
  - `[low]` `[patch]` Rewritten playwright 102-105 comment claimed a wait-heavy slice serialises on one worker while `workers` is 2 — comment now only describes count-vs-duration shard imbalance
  - `[low]` `[reject]` Burn-in comment still points at `playwright.config.ts:107-110` for the flake-class sentence (actual 112-115) — pre-existing line-number drift recopied in a reflow; not everyday
  - `[false]` `[reject]` `/shard: \[1, 2\]/` would pass `shard: [1, 2, 3]` — in `[1, 2, 3]` the character after `2` is `,`, not `]`; the expect fails
  - `[low]` `[patch]` `config.workers === 2` under `CI=true` would pass if the ternary were removed — test now also asserts the source contains `workers: process.env.CI ? 2`
  - `[false]` `[reject]` ci-baseline should file 341s/354s against 381s instead of 259s — How to verify records the measured 4-shard worst, then chooses N; 259s is that number
  - `[low]` `[patch]` Matrix comment used min setup 129s and undefined ~25 for 341s — comment now cites residuals 19/25/27/29s and conservative 138+187+29 = 354s
  - `[false]` `[reject]` Comment omits an N=3 projection — smallest N that still makes sense is 2; 3 is larger (same claim as the intent-alignment N=3 row)
  - `[low]` `[patch]` `119s + 187s` presented as the 2-way split — comment now says two jobs share the measured 306s plus one setup floor each, and treats 86+101 only as a conservative bound
  - `[low]` `[reject]` ci-baseline still lists 107 matches under a 2026-09-15 main heading, and titles the new table Post-stories-1–4 while the body says 3–4 are absent — 107 is dated correctly; CAP-6 replacement is the 259s/2 table
  - `[low]` `[patch]` `playwright.config.ts:30` still named Together-Mode scripture P0 specs — reworded to Realtime specs; grouped with the intent-alignment line-30 row
  - `[low]` `[patch]` DW-150 still open after this story's 102-105 rewrite — closed with status/resolution only on that entry
  - `[false]` `[reject]` Measured run is story 2 (`2e40c7d6`), not after stories 1–4 — the invoke glosses that as the remaining 37-spec suite; stories 3–4 do not delete `tests/e2e/`
  - `[false]` `[reject]` N=2 is a projection, not a measured `--shard=/2` wall — How to verify measures the current (4-shard) run, then chooses N; a 2-shard wall cannot exist before this change
  - `[false]` `[reject]` Setup 129s is outside the 130–177s band — 129–138s is the confirmation from the measured run; 1s under 130 does not undo the floor
  - `[false]` `[reject]` Unit tests snapshot YAML/markdown strings rather than the `gh run view` procedure — GitHub run history is not a unit-test surface; the spec verification commands ran against run `35056348791`
  - `[low]` `[reject]` How to verify steps 1–5 stay future tense after the recording — procedure plus "Recorded below" is readable; tense cleanup is cosmetic
  - `[false]` `[reject]` N=3 absent from the written arithmetic — same as the blind-hunter N=3 row
  - `[low]` `[patch]` `playwright.config.ts:30` leftover scripture name — same root cause as the blind-hunter line-30 row; reworded together
  - `[false]` `[reject]` Generated story file vs unchanged How to verify / SPEC — finding whose fix is to edit this build's spec

## Auto Run Result

Status: done

Summary: Chromium E2E is 2 shards, chosen from measured run `35056348791` (worst shard 259s; setup 129–138s; combined test-step 306s). Historical 381s remains run `32279178457`. Burn-in stays 3 shards. `setup-supabase/action.yml` untouched.

Files changed:
- `.github/workflows/test.yml` — e2e-tests N=2 (name, matrix, `--shard`, merge-reports expected count); matrix comment records the run and arithmetic; burn-in scripture spec names removed
- `playwright.config.ts` — dropped the scripture contiguous-block comment; line 30 no longer names scripture; `workers` still `process.env.CI ? 2`
- `_bmad-output/specs/spec-remove-scripture-feature/ci-baseline.md` — historical 381s table kept; added run `35056348791` table (259s worst; N=2)
- `README.md` — E2E sharded across 2 runners
- `tests/unit/config/playwrightReporting.test.ts` — pins N=2 coupling, burn-in still 3, baseline strings, workers ternary
- `_bmad-output/implementation-artifacts/deferred-work.md` — DW-150 closed
- `_bmad-output/specs/spec-remove-scripture-feature/stories/5-right-size-the-ci-e2e-shard-count.md` — this spec

Review findings breakdown:
- Patches applied: 7 entries (all low): README 4→2; playwright 102-105 one-worker claim; workers ternary assert; matrix min-setup/~25 arithmetic; 119+187 as 2-way split; playwright line 30 scripture name (grouped with intent-alignment); DW-150 close
- Items deferred: none
- Rejected: unanchored `[1, 2]` regex (does not match `[1, 2, 3]`); 341s/354s as the number vs 381s (259s is the measured worst); N=3 omitted (2 is smaller); 107/title nit; story-2 run vs after 1–4 (remaining-suite gloss); projection vs measured 2-shard wall (procedure); 129s vs 130–177 band; unit tests vs `gh` procedure; How to verify tense; generated story vs SPEC (spec-edit); burn-in 107-110 line pointer (pre-existing, not everyday)

Follow-up review recommendation: false. Patched counts by verdict: high 0, medium 0, low 7. First pass; no high or two-medium patches.

Verification performed:
- `gh run view 35056348791 --json jobs` (both jq one-liners) — four E2E shards `success`; setup 129/129/138/129s; test-step 49/70/86/101s
- `rg -n "scripture-reflection-2.2-errors|scripture-stats|scripture specs sort" .github/workflows/test.yml playwright.config.ts` — no matches
- `rg -n scripture` on those two files — no matches
- `rg` shard literals — e2e-tests N=2, merge-reports N=2, burn-in still 3
- `git diff -- .github/actions/setup-supabase/action.yml` — empty
- `npx vitest run tests/unit/config/playwrightReporting.test.ts` — 5/5 passed

Residual risks: 354s / ~614s are projections from the 4-shard split, not a measured `--shard=/2` run. First Tests run after this lands is the confirmation. Measured SHA is story 2 (`2e40c7d6`); stories 3–4 do not delete E2E specs.

## Design Notes

Path gating (`test.yml` `changes` job, since `fa5ed66b`) means Test Summary green does not prove E2E ran. Inspect job names `E2E (Shard n/4)` and their `conclusion` before recording.

Story 2 already deferred this playwright comment (`playwright.config.ts:102-105`) to this story.

Do not copy the August "4 shards, not 2 … 55 tests … 5.4 min vs 9.6 min" sentences forward as if they still describe this suite.

## Verification

**Commands:**
- `gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | "\(.conclusion)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s\t\(.name)"'` -- expected: E2E shard jobs present with `success`, not skipped
- `gh run view <RUN_ID> --json jobs | jq -r '.jobs[] | select(.name|test("E2E")) as $j | $j.steps[] | "\($j.name)\t\(.name)\t\((.completedAt|fromdate)-(.startedAt|fromdate))s"'` -- expected: setup vs test-step split recorded
- `rg -n "scripture-reflection-2.2-errors|scripture-stats|scripture specs sort" .github/workflows/test.yml playwright.config.ts` -- expected: no matches
- `rg -n "Expected .* shard blob reports|shard: \\[|matrix.shard" .github/workflows/test.yml` -- expected: e2e-tests N and merge-reports N match; burn-in still 3
