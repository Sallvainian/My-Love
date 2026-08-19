---
status: done
---

# TEA NFR Evidence Audit — dw-events-offline-message-honesty

**Workflow:** `bmad-testarch-nfr` (Create mode, sequential execution)
**Gate decision:** **CONCERNS** ⚠️ — no blockers, no FAIL, 0 critical / 0 high
**Overall risk:** MEDIUM
**Scope audited:** commit `f486587f658fa812987a277ee1e416949f4f2fbc` plus the uncommitted working tree

## Artifacts written

Both under TEA's configured `test_artifacts` directory (`_bmad-output/test-artifacts/`). Both
are new files; `git status` reports each as untracked and nothing existing was overwritten.
The workflow's `default_output_file` (`{test_artifacts}/nfr-assessment.md`) was free, so no
run-scoped rename was needed — unlike the `automate` session, which hit a collision.

- `_bmad-output/test-artifacts/nfr-assessment.md` — full audit, 812 lines
- `_bmad-output/test-artifacts/nfr-gate-decision.json` — machine-readable NFR gate, schema 0.1.0

Deliberately **not** overwritten: `gate-decision.json`, which belongs to the `trace` run and
records a different gate. The two are complementary — trace answers "is the requirement
covered", this answers "is the evidence good enough".

The four domain-worker JSON outputs went to the session scratchpad rather than `/tmp` (harness
rule); their directory and timestamp are recorded in the report's frontmatter.

## Result

23 findings across 4 domains: **6 PASS, 12 CONCERNS, 0 FAIL, 5 N/A.**

| Domain | Risk | PASS | CONCERNS | FAIL | N/A |
|---|---|---|---|---|---|
| Security | LOW | 4 | 1 | 0 | 1 |
| Performance | LOW | 1 | 1 | 0 | 3 |
| Reliability | MEDIUM | 0 | 5 | 0 | 1 |
| Maintainability | MEDIUM | 1 | 5 | 0 | 0 |

ADR Quality Readiness Checklist: **14/29 criteria met (48%)** — but that scores the *system*,
not the change: 11 of the 15 unmet criteria are architecture-level (no SLA, no DR plan, no
APM, no metrics endpoint) and identical before and after this commit.

**Why CONCERNS and not PASS.** Eight of the twelve CONCERNS are the workflow's undefined-threshold
default firing, not observed failures. The test design recorded four of seven thresholds as
UNKNOWN because this repository has no PRD and no ADR, so measurements that are genuinely good
— 87.5% branch coverage, 5/5 clean burn-in, zero reachable path that still promises a sync —
cannot be graded PASS. Defining those thresholds is the single change that would move this
result the most.

## Execution mode

Resolved to **sequential**. `tea_execution_mode` is `auto` with the capability probe enabled,
and the probe returns false for both parallel modes here: no agent-team primitive exists, and
`CLAUDE.md` forbids delegating bmad-loop worktree work to a background subagent and waiting on
one. All four domain audits were run blocking by this session.

## Verification performed in this session

Every number in the report was measured here; nothing was carried over from the preceding
`tea.td`, `tea.automate` or `tea.trace` reports without re-running its command.

- `npx --no-install vitest run` → **90 files / 1345 tests passed**, 5.51 s
- Coverage `--coverage.include='src/api/interactionService.ts'` → **82.53% stmts / 87.5% branch
  / 71.42% funcs / 83.87% lines**, uncovered `238-262`
- 5× burn-in of both audited files → **pass=5 fail=0**
- `npm run lint` → **exit 0** (2 pre-existing warnings in `EventCountdown.tsx`, untouched by this branch)
- `npm audit` → **found 0 vulnerabilities**
- `git diff main...HEAD --name-only | grep -c '^supabase/'` → **0** (no migration, no policy touched)
- `grep -n '^export' src/api/interactionService.ts` → 4 exports; `InteractionWriteError` and
  `networkFailure` both absent, confirming the spec's "no new exported symbol" claim
- `grep -rn "synced when you're back online" src/` → sole **code** match is `errorHandlers.ts:95`;
  every other hit is explanatory prose
- Every line-number citation in the report was individually re-read and verified

## Three things the operator should read

1. **The honest message never reaches a user.** `PokeKissInterface.tsx:185` and `:219` render
   the constants `'Failed to send poke. Try again.'` and `'Failed to send kiss. Try again.'`,
   never `error.message`. The change is correct and worth keeping — the thrown value is what
   the next caller, test and maintainer read — but its user-facing benefit is currently zero.
   Recorded as cross-domain risk **CDR-2**; independently reproduces the test design's R-6.

2. **The new honesty guard protects less than it appears to.** Its `SUPABASE_ONLY_MODULES`
   list holds 6 entries, and three further Supabase-only modules were confirmed outside it in
   this session — `photosSlice.ts`, `loveNoteImageService.ts` and `partnerService.ts`, each
   returning 0 for an IndexedDB/localStorage grep. The invariant *holds* today (the only
   importers of either sync-promising symbol in `src/` are `moodApi.ts`, `moodSyncService.ts`
   and `MoodTracker.tsx`, all offline-first), so this is about what the guard would catch.
   Independently confirms trace's TEST-03 = PARTIAL finding. Extending the list is a ~15-minute
   test-only change and the audit's top quick win.

3. **A normative conflict in the workflow's own step files, and how it was resolved.**
   `nfr-status-definitions.md` states the undefined-threshold rule per *finding*; the
   pseudocode in `step-04e-aggregate-nfr.md` §1a applies it per *domain*. The per-finding
   prose was followed, because the domain-level form would downgrade the dependency-vulnerability
   PASS whose threshold is defined and was measured. Sensitivity is disclosed in the report:
   under the literal domain-level form maintainability reads 0 PASS / 6 CONCERNS instead of
   1 / 5, and the overall gate is CONCERNS either way.

## Recommended actions recorded (none blocking)

MEDIUM — extend the honesty guard's module list; decide whether the honest message should reach
the user; schedule DW-35 (`subscribeInteractions` surfaces neither `CHANNEL_ERROR` nor
`TIMED_OUT`, and is the entire remaining coverage gap at lines 238-262).

LOW — set a per-file coverage threshold (note: the test design's proposed ≥85% statements sits
*above* today's measured 82.53%, so adopting it verbatim would fail CI immediately until DW-35
lands); promote the guard to an ESLint `no-restricted-imports` override.

## Not done (out of scope for an evidence audit)

- **No production or test code was changed.** `git diff src/` and `git diff tests/` are
  unchanged from the state this session inherited.
- `deferred-work.md` was not edited. The trace session's observation still stands: **DW-34
  appears closed by the working tree but is still `status: open`**. Left for the operator or
  the next sweep.
- `sprint-status.yaml` was not touched.
- No browser session was opened, so none needs closing. Browser-based evidence collection was
  declined on purpose: the change has no observable UI difference (see finding #1 above), so a
  screenshot or network trace would look like evidence and prove nothing.
- `supabase test db` was not run — it needs `supabase start`, which is not running in this
  worktree. Recorded as an evidence gap; zero files under `supabase/` appear in the diff, so no
  policy could have changed.
