---
type: migration
title: "BMad v6 to v7 migration of My-Love's _bmad-output"
status: draft
created: 2026-10-28
---

# BMad v6 to v7 migration

Migration `method` 1 (`.claude/skills/bmod-method/migration-1.toml`), v6 to v7, run by `bmad migrate` on branch `chore/bmad-v7-trial`. Migration 2 (v7 preview to v7) was checked and does not apply: no `initiative-*/` or `epic-*/` folder existed.

## Source folders

Read from `.v6-v7-migration-backup-20261028-1433/_bmad/config.toml`, because `bmad setup` had already removed the keys from `_bmad/config.toml`:

| Key | Path | State |
|---|---|---|
| `core.output_folder` | `_bmad-output/` | 37 files |
| `modules.bmm.planning_artifacts` | `_bmad-output/planning-artifacts/` | does not exist |
| `modules.bmm.implementation_artifacts` | `_bmad-output/implementation-artifacts/` | 2 files |

## Detect signals matched

- `specs/spec-test-review-remediation/SPEC.md` under the output folder, with `stories.yaml` and `stories/`.
- No `active_initiative` under `[core]` (no `_bmad/custom/config.user.toml` exists) and no `initiative-*/` folder.

Not present: `epics.md`, `sprint-status.yaml`, story files in the implementation folder, dated PRD/brief/UX/architecture folders, 6.13 pre-release spec folders (`spec-<slug>/spec-<slug>.md` with `.memlog.md`).

## Backup

`.v6-v7-migration-backup-20261028-1433/`, made by `bmad setup` with `_bmad/` (41 files). The migration copied `_bmad-output/` into it as `_bmad-output/` (37 files, `diff -rq` identical). Its `.gitignore` holds `*`; it is never staged.

## Inventory

| Folder | Files | What it is |
|---|---|---|
| `implementation-artifacts/` | 2 | `deferred-work.md` (the deferred-work ledger, 2,517 lines) and `deferred-work-archive.md` (its closed entries, 2,583 lines); both untracked |
| `specs/spec-test-review-remediation/` | 22 | a finished v6 spec: `SPEC.md`, `stories.yaml`, `.memlog.md`, `corrections.md`, five `findings-*.md` companions, nine `stories/<id>-<slug>.md` build records (all `status: done`), four `worklists/story-8/*.md`; all tracked |
| `test-artifacts/test-reviews/` | 13 | TEA test-review reports and evidence, 6 current and 7 under its own `archive/`; untracked |

## Answers

| Question | Answer | Reason |
|---|---|---|
| Planning content is `_bmad-output/planning-artifacts/` (does not exist: no PRD, brief, UX, architecture or `epics.md`) and implementation content is `_bmad-output/implementation-artifacts/` (the deferred-work ledger and its archive). Right, and is there any elsewhere? | Yes; none elsewhere | The inventory covers the whole output folder. The v6 `project_knowledge` folder `docs/` was deleted at `30c5ec96` (AGENTS.md). |
| Will this work touch other repositories, or should the planning files keep their own git history apart from the code? (`workspace`) | No | One repository. `65456714` already set `.gitignore` to track `initiative-*/`, `backlog/`, `archive/` and `migration-v6-v7/` in this repo; a separate store repo would undo it. |
| Does `spec-test-review-remediation` belong to the initiative? | Yes: it becomes `epic-test-review-remediation` | No PRD names it, so it belongs only if the owner says so. It is the project's only planning record; v7 keeps finished epics and their plans as live evidence (`help/artifact-lifetime.md`), and left in `specs/` it is a v6 leftover no v7 skill reads. |
| Stories in progress or in review: finish them in v6 first? | Not asked | All nine are `done`. |
| Fold unstarted stories' files into their entries? | Not asked | No story is unstarted. |
| Several PRDs or briefs: grouping? Dated versions: archive the older ones? | Not asked | No planning documents exist. TEA's own `test-artifacts/test-reviews/archive/` stays as TEA wrote it. |
| Where does `deferred-work-archive.md` go? (the guide names only `deferred-work.md`) | `initiative-my-love/archive-v6/`, unchanged | It is v6 tracking history: the v6 loop's sweep wrote it and no v7 skill reads or writes it. Under `archive-v6/` its paths stay as written. |
| Where do the spec's `.memlog.md` and `worklists/` go? (the guide names neither) | Into the epic folder: `.memlog.md` at its top, `worklists/story-8/` beside it | v7 keeps a container's `.memlog.md` at the top of its folder (`help/ticketing-and-epics.md`). The worklists are story 8's evidence; at that place story 8's own `../worklists/story-8/` links keep resolving from `tickets/`. |

## Target tree

```
_bmad-output/
  initiative-my-love/
    initiative-my-love.md                       # new envelope
    deferred-work.md                            # moved unchanged from implementation-artifacts/
    tickets/
      tickets.toml                              # [[epic]] 1 epic-test-review-remediation
      epic-test-review-remediation/
        epic-test-review-remediation.md         # rendered from SPEC.md
        .memlog.md                              # the spec's memlog, unchanged
        corrections.md                          # companions, unchanged
        findings-api-integration.md
        findings-cross-cutting.md
        findings-e2e.md
        findings-src.md
        findings-unit.md
        worklists/story-8/{e2e-api,src-1,src-2,unit}.md   # story 8 evidence, unchanged
        tickets/
          tickets.toml                          # nine [[entry]]
          story-<slug>-plan.md                  # x9, the v6 build records
    archive-v6/
      deferred-work-archive.md                  # unchanged
      spec-test-review-remediation/SPEC.md      # unchanged
      spec-test-review-remediation/stories.yaml # unchanged
  backlog/.gitkeep
  archive/.gitkeep
  migration-v6-v7/migration-v6-v7.md            # this file
  test-artifacts/                               # left in place
```

`implementation-artifacts/` and `specs/` are removed once empty.

## Moves

Tracked files move with `git mv`; the two untracked ledger files move with `mv` and are then added, which makes them tracked for the first time. Both were scanned before this plan: no email addresses, keys, tokens or UUIDs, and no match against the owner's personal-data redaction list.

| From (`_bmad-output/`) | To (`_bmad-output/initiative-my-love/`) | How |
|---|---|---|
| `implementation-artifacts/deferred-work.md` | `deferred-work.md` | `mv`, unchanged |
| `implementation-artifacts/deferred-work-archive.md` | `archive-v6/deferred-work-archive.md` | `mv`, unchanged |
| `specs/spec-test-review-remediation/SPEC.md` | `archive-v6/spec-test-review-remediation/SPEC.md` | `git mv`, unchanged |
| `specs/spec-test-review-remediation/stories.yaml` | `archive-v6/spec-test-review-remediation/stories.yaml` | `git mv`, unchanged |
| `specs/spec-test-review-remediation/.memlog.md` | `tickets/epic-test-review-remediation/.memlog.md` | `git mv`, unchanged |
| `specs/spec-test-review-remediation/corrections.md` | `tickets/epic-test-review-remediation/corrections.md` | `git mv` |
| `specs/spec-test-review-remediation/findings-*.md` (5) | `tickets/epic-test-review-remediation/findings-*.md` | `git mv` |
| `specs/spec-test-review-remediation/worklists/story-8/*.md` (4) | `tickets/epic-test-review-remediation/worklists/story-8/*.md` | `git mv` |
| `specs/spec-test-review-remediation/stories/<id>-<slug>.md` (9) | `tickets/epic-test-review-remediation/tickets/story-<slug>-plan.md` | `git mv`, then frontmatter gains `ticket: <id>` |

## Ticket tree

### Initiative `initiative-my-love`

`initiative-my-love/initiative-my-love.md` from `bmad-agent-po/assets/ticket-template.md`: `type: initiative`, title `My-Love`. The project has no PRD or brief, so Description and Outcome come from the project summary in `AGENTS.md`, there are no Requirements or Constraints lines and no Done when, and Notes carries `Open question:` saying a PRD or brief supplies them. `tickets/tickets.toml` holds one epic:

```toml
[[epic]]
id = 1
slug = "epic-test-review-remediation"
title = "Test Review Remediation"
description = "Every finding from the 2026-09-25 TEA test reviews is fixed, so a green suite means the behaviour works and a fresh review of each test folder comes back clean."
covers = []
```

`covers` is empty because the initiative has no Requirements; the epic's lines cite the spec's `CAP-` sections instead.

### Epic `epic-test-review-remediation`

Rendered from `SPEC.md`: `type: epic`, `parent: initiative-my-love`, `status: done` (every story is done), `risk: low`, `covers: []`, `sources:` the five TEA reports under `_bmad-output/test-artifacts/test-reviews/`, `companions:` the six companion files beside it and `AGENTS.md`.

- Description: the spec's Why. Outcome: one sentence naming the success signal.
- Requirements: `R1 (CAP-1)` to `R6 (CAP-6)`, each the capability's intent and success.
- Constraints: the spec's seven constraints. Boundaries: its four non-goals.
- Done when, from the success signal, for approval:
  1. Fresh `bmad-testarch-test-review` runs on `tests/e2e/`, `tests/unit/`, `src/`, and `tests/api/` + `tests/integration/` each report zero scored findings.
  2. Every item in `corrections.md` is resolved.
  3. CI is green on main.
- References: the parent's Requirements, one line per companion, `AGENTS.md`, and the TEA criteria registry (`.claude/skills/bmad-testarch-test-review/steps-c/criteria-registry.md`, already missing in v6 because TEA is not installed; kept and flagged).
- Notes: `Assumption:` the four per-folder re-reviews are the done gate; `Decision: 2026-09-25` the convention baselines were investigated and confirmed, so every row stays in scope.
- No retrospective exists; none is written.

### Entries and plans

Each `stories.yaml` entry becomes an `[[entry]]` in list order: `type = "story"`, its `id`, `title` and `description` verbatim, `verify` distilled from its capability's success line, `covers` its capability's `R` id, `after = []`, `hitl = false`, `risk = "low"`, `v6_key` the v6 story file stem, and `notes` holding its `invoke_dev_with` verbatim. No ids carry a dash, so none changes. `stories.yaml` declares no prerequisites; story 9's "runs last" is an ordering note in its description, already met by table order and not converted to `after`.

Each build record moves as the entry's plan, every line kept. Its frontmatter gains `ticket: <id>`; its `status: 'done'` maps to `done`; its build `type` and its recorded `baseline_revision` stay. All nine baselines exist in the local repository; only story 1's is reachable from `origin/main`, because the loop's commits were squash-merged.

| id | v6_key | covers | v7 status | type | Plan |
|---|---|---|---|---|---|
| 1 | `1-make-every-test-able-to-fail` | R1 | done | chore | `story-make-every-test-able-to-fail-plan.md` |
| 2 | `2-remove-clock-timing-and-async-nondeterminism` | R2 | done | chore | `story-remove-clock-timing-and-async-nondeterminism-plan.md` |
| 3 | `3-wait-for-data-before-interacting-in-e2e-specs` | R2 | done | chore | `story-wait-for-data-before-interacting-in-e2e-specs-plan.md` |
| 4 | `4-isolate-tests-and-make-cleanup-failure-proof` | R3 | done | chore | `story-isolate-tests-and-make-cleanup-failure-proof-plan.md` |
| 5 | `5-drive-component-tests-through-user-event` | R4 | done | chore | `story-drive-component-tests-through-user-event-plan.md` |
| 6 | `6-adopt-playwright-utils-in-playwright-specs` | R5 | done | chore | `story-adopt-playwright-utils-in-playwright-specs-plan.md` |
| 7 | `7-build-test-data-through-factories-and-name-magic-values` | R6 | done | refactor | `story-build-test-data-through-factories-and-name-magic-values-plan.md` |
| 8 | `8-fix-names-selectors-markers-and-test-structure` | R6 | done | refactor | `story-fix-names-selectors-markers-and-test-structure-plan.md` |
| 9 | `9-split-oversize-test-files` | R6 | done | refactor | `story-split-oversize-test-files-plan.md` |

## Left in place

| Path | Reason |
|---|---|
| `test-artifacts/` (13 files) | Not recognized: TEA wrote it under v6 (`modules.tea.test_artifacts`), and TEA is not installed in v7, so no installed module claims it. The epic's `sources:` point at its reports where they are. The migration leaves it alone; moving it is the owner's call. |

## Path rewrites

In the store, after the moves:

- The nine plans: `_bmad-output/specs/spec-test-review-remediation/corrections.md` becomes `_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/corrections.md`; `.../SPEC.md` becomes `_bmad-output/initiative-my-love/archive-v6/spec-test-review-remediation/SPEC.md`; each plan's path to its own old story file becomes its new plan path; story 8's `_bmad-output/specs/spec-test-review-remediation/worklists/story-8/` becomes the epic's `worklists/story-8/`; story 9's `_bmad-output/implementation-artifacts/deferred-work.md` becomes `_bmad-output/initiative-my-love/deferred-work.md`. Relative `../worklists/story-8/` links already resolve from the new folder.
- `deferred-work.md` and the archived files stay unchanged. Their paths that were already dead in v6 (`spec-unified-data-storage/...`, `implementation-artifacts/spec-*.md`) are listed apart and not rewritten.

Outside the store and `_bmad/`, never edited here; the owner updates these:

| File:line | Names |
|---|---|
| `AGENTS.md:6` | `_bmad-output/implementation-artifacts/deferred-work.md` as the ledger |
| `AGENTS.md:88` | `_bmad-output/specs/` as the tracked spec folder |
| `.gitignore:148` | `!_bmad-output/specs/` (harmless once `specs/` is gone) |
| `tests/e2e/settings/events-load-recovery.spec.ts:24` | `_bmad-output/implementation-artifacts/deferred-work.md:244-250` |
| `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx:28,33` | `deferred-work.md:236-242`, `:244-250` (bare name; line numbers stay valid because the file moves unchanged) |
| `.bmad-loop/policy.toml:148` (untracked) | `worktree_seed` entry `_bmad-output/specs` |

Already dead in v6, listed apart: `tests/api/events-read-window.spec.ts:15` and `tests/unit/stores/persistedBlobContract.test.ts:10` (`implementation-artifacts/spec-dw-*.md`), `.bmad-loop/policy.toml:71` (`spec_folder` `spec-unified-data-storage`), `.claude/settings.local.json:38` (`spec-grok-smoke-test`).

## Configuration

- Write `_bmad/custom/config.user.toml` with `[core] active_initiative = "initiative-my-love"` (new file; gitignored).
- `output_folder` is unchanged: the store did not move.
- No `_bmad/custom/` override names a moved path.
- `migrate_v6.py` report shows no v6 traces (`legacy_leftovers`, `stale_config_keys` and `unused_customizations` all empty), so `--clean` is not run.
- `planning_artifacts` and `implementation_artifacts` are left alone.

## Repository

No workspace or store-repository change. Commits on `chore/bmad-v7-trial`: this plan before the moves, then one per step that changes files, each naming its step. Nothing is pushed. The backup is never staged.

## Outside this migration

The v6 loop CLI (fork at `~/Projects/BMAD-METHOD/bmad-loop`) requires `implementation_artifacts` and `planning_artifacts` in the BMad config (`src/bmad_loop/bmadconfig.py:221`), which v7 `bmad setup` already removed; this migration changes neither. Whether the loop moves to a v7 release is the owner's decision.

## Approval

2026-10-28: the owner approved this plan as written, including the epic's Done when.

## Checklist

Results are recorded here after the run.
