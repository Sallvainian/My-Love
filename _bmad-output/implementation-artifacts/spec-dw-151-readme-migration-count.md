---
title: 'DW-151: README.md still says 21 migrations; replace with live supabase/migrations count'
type: 'chore'
created: '2026-09-16'
status: 'done'
baseline_revision: '78ab7bbada31b71d495622a81d6639b644b15d27'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      tests/README.md:5 still says Vite 7 while package.json depends on Vite 8.
    evidence: |-
      tests/README.md:5 "**Stack**: React 19 + Vite 7 + Supabase (39 migrations, RPCs, RLS policies, pgTAP)".
      package.json:87 `"vite": "^8.3.0"`. Pre-existing; this change only replaced 21 with 39 on that line.
    location: >-
      tests/README.md:5
    severity: low
  - summary: >-
      README.md:118 key-tables list still omits events.
    evidence: |-
      README.md:118 "Key tables: `users`, `moods`, `interactions`, `love_notes`, `photos`, and more."
      src/types/database.types.ts:55 `events:`. README.md:96 already lists `eventsSlice`. Pre-existing; intent replaced only the 21 figure.
    location: >-
      README.md:118
    severity: low
  - summary: >-
      README.md project-structure supabase tree still omits functions/, config.toml, and seed.sql.
    evidence: |-
      README.md:159-161 lists only migrations/ and tests/. supabase/config.toml, supabase/functions/, and supabase/seed.sql exist on disk. Pre-existing; intent replaced only `# 21 SQL migrations`.
    location: >-
      README.md:159-161
    severity: low
---

<intent-contract>

## Intent

**Problem:** README.md and tests/README.md still say 21 migrations. `find supabase/migrations -type f -name '*.sql' | wc -l` currently prints 39, including `20260916000000_drop_scripture.sql`. Story 2 dropped scripture table names from README.md:118 and left the count.

**Approach:** Replace the stale 21 figure at README.md:118, README.md:160, and tests/README.md:5 with the live `*.sql` count from `supabase/migrations/` taken at implementation time.

## Boundaries & Constraints

**Always:** Re-run `find supabase/migrations -type f -name '*.sql' | wc -l` immediately before writing and use that integer (today 39). Substitute only the number `21` in these three phrases, keeping the rest of each line: `21 migrations managing tables, RLS policies, RPC functions, and realtime subscriptions.` (`README.md:118`); `# 21 SQL migrations` (`README.md:160`); `(21 migrations, RPCs, RLS policies, pgTAP)` (`tests/README.md:5`).

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Do not hardcode the ledger's "38 files" title. Do not change the key-tables list on README.md:118 (`users`, `moods`, `interactions`, `love_notes`, `photos`), the project-structure tree, or any other README prose. Do not recreate a `docs/` tree. Do not add, rename, or delete files under `supabase/migrations/`. Do not re-add scripture.

</intent-contract>

## Code Map

- `README.md:118` — `21 migrations managing tables, RLS policies, RPC functions, and realtime subscriptions. Key tables: \`users\`, \`moods\`, \`interactions\`, \`love_notes\`, \`photos\`, and more.` Replace only `21`.
- `README.md:160` — `│   ├── migrations/               # 21 SQL migrations` Replace only `21`.
- `tests/README.md:5` — `**Stack**: React 19 + Vite 7 + Supabase (21 migrations, RPCs, RLS policies, pgTAP)` Replace only `21`.
- `supabase/migrations/` — 39 `*.sql` files today (`find … | wc -l`). Includes `20260916000000_drop_scripture.sql`. Read-only.
- `_bmad-output/implementation-artifacts/deferred-work.md:1501` — DW-151 heading still says "38 files". Orchestrator records resolution. Do not edit.
- `_bmad-output/specs/spec-remove-scripture-feature/stories/2-remove-scripture-from-the-application.md:209` — original defer named both README files and 38 files. Read-only.
- `_bmad-output/test-artifacts/dw-events-validation-guard-fidelity/README.md:45` — `21_events_validation_contract.sql` is a filename, not this figure. Out of scope.

## Tasks & Acceptance

**Execution:**
- `README.md` — replace `21` with the live migration count on `:118` and `:160` only.
- `tests/README.md` — replace `21` with the same live count on `:5` only.

**Acceptance Criteria:**
- Given `find supabase/migrations -type f -name '*.sql' | wc -l` prints N, when a reader opens README.md, then line 118 starts with `N migrations managing tables, RLS policies, RPC functions, and realtime subscriptions.` and still lists `users`, `moods`, `interactions`, `love_notes`, `photos`, and line 160 still comments `# N SQL migrations`.
- Given that same N, when a reader opens tests/README.md:5, then the stack line contains `(N migrations, RPCs, RLS policies, pgTAP)` and does not contain `21 migrations`.
- Given `_bmad-output/implementation-artifacts/deferred-work.md` and `supabase/migrations/`, when this change lands, then those paths are byte-for-byte unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 5, false 10, maybe-false 0
- findings:
  - `[low]` `[defer]` Blind hunter: `tests/README.md:5` still says `Vite 7` while `package.json:87` is `"vite": "^8.3.0"` — quote confirmed. This change only replaced `21` with `39` on that line. Pre-existing.
  - `[low]` `[reject]` Blind hunter: hardcoded `39` will go stale on the next `supabase migration new` — intent is a count taken at implementation time, a one-time snapshot. A living generator is not a defensible reading. Later drift is the same class of staleness this DW fixes.
  - `[low]` `[defer]` Blind hunter: README.md:118 key-tables list omits `events` — `src/types/database.types.ts:55` `events:`; README.md:96 already lists `eventsSlice`. Intent replaced only the `21` figure. Pre-existing.
  - `[false]` `[reject]` Blind hunter: spec Always requires the `:160` tree-comment edit while Never says do not change the project-structure tree — the product substituted only `# 21 SQL migrations` → `# 39 SQL migrations`. Tree entries are unchanged (`migrations/` and `tests/` only). Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: freeze-list `git diff --stat` cannot show stray files and omits the spec path — the AC freeze list is README.md, tests/README.md, deferred-work.md, and supabase/migrations. Unscoped `git status` after implementation was those two READMEs plus this spec. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: verification never asserts the preserved remainder of the three phrases — the unified diff is three `21` → `39` substitutions; key tables, `# N SQL migrations` comment shape, and `RPCs, RLS policies, pgTAP` are unchanged. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: empty Spec Change Log and Code Map still quoting `21` — Change Log stays empty until a bad_spec loopback. Code Map is the pre-change investigation map. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: `39` includes scripture-era `*.sql` files and the prose does not say it is `find | wc -l` — intent named that find command and `20260916000000_drop_scripture.sql`. The sentence shape is the old `21 migrations managing tables…` with the integer replaced.
  - `[false]` `[reject]` Blind hunter: `followup_review_recommended: false` before any review pass — workflow default; step-04 Finalize sets it from this pass's patched counts (high 0, medium 0).
  - `[low]` `[defer]` Blind hunter: README.md supabase tree omits `functions/`, `config.toml`, and `seed.sql` — those paths exist on disk; README.md:159-161 still lists only `migrations/` and `tests/`. Pre-existing; intent replaced only `# 21 SQL migrations`.
  - `[false]` `[reject]` Intent alignment: ledger still says 38 files / `location: README.md:118` while docs now say 39 at three sites — spawn text forbade editing the deferred-work ledger.
  - `[low]` `[reject]` Intent alignment: diff bakes `39` into prose with no mechanism that keeps it matched to `find` — same snapshot as the second blind-hunter row; intent is implementation-time count, not a generator.
  - `[false]` `[reject]` Intent alignment: the new spec file is a surface the intent never named — bmad-build-auto requires `{spec_file}`; spec verification allows it as workflow output.
  - `[false]` `[reject]` Intent alignment: no test surface; spec lists `rg`/`find`/`git diff` commands and the diff does not add tests — docs-only substitutions. Verification-gap reported no gaps.
  - `[false]` `[reject]` Intent alignment: Reading B (README.md:118 only, write 38) vs A (three sites, live find count) — invoke pointed at intent.md, which names README.md:118, README.md:160, tests/README.md:5, and `find … | wc -l` currently 39. Diff implements that bundle reading.

## Verification

**Commands:**
- `N=$(find supabase/migrations -type f -name '*.sql' | wc -l | tr -d ' '); echo "$N"` — expected: integer used in the three substitutions (today 39).
- `rg -n "21 migrations|# 21 SQL" README.md tests/README.md` — expected: no match.
- `rg -n "${N} migrations managing|# ${N} SQL migrations" README.md` — expected: `:118` and `:160`.
- `rg -n "\\(${N} migrations, RPCs" tests/README.md` — expected: `:5`.
- `git diff --stat -- README.md tests/README.md _bmad-output/implementation-artifacts/deferred-work.md supabase/migrations` — expected: only `README.md` and `tests/README.md` in that list (the spec file may also appear as workflow output).

## Auto Run Result

Status: done

Summary of implemented change: Three integer substitutions of the stale `21` migration count with the live `find supabase/migrations -type f -name '*.sql' | wc -l` count of 39, at README.md:118, README.md:160, and tests/README.md:5.

Files changed:
- `README.md` — `21` → `39` on the Supabase paragraph and the migrations tree comment
- `tests/README.md` — `21` → `39` on the stack line
- `_bmad-output/implementation-artifacts/spec-dw-151-readme-migration-count.md` — build-auto spec

Review findings breakdown:
- patches applied: none
- items deferred: 3 (`tests/README.md:5` Vite 7 vs package.json Vite 8; README.md:118 key-tables omit `events`; README.md:159-161 supabase tree omits `functions/` / `config.toml` / `seed.sql`)
- rejected: 12 (see Review Triage Log)

Follow-up review recommendation: false (first pass; patched entries by verdict: high 0, medium 0, low 0)

Verification:
- `find supabase/migrations -type f -name '*.sql' | wc -l` — 39
- `rg -n "21 migrations|# 21 SQL" README.md tests/README.md` — no match (exit 1)
- `rg` for `39 migrations managing` / `# 39 SQL migrations` — `README.md:118` and `:160`
- `rg` for `(39 migrations, RPCs` — `tests/README.md:5`
- `git diff --stat` vs `78ab7bbada31b71d495622a81d6639b644b15d27` on the freeze list — only `README.md` and `tests/README.md`

Residual risks: the published 39 is a snapshot and will go stale on the next migration. `tests/README.md:5` still says Vite 7. README.md:118 still omits `events` from the key-tables list. README.md:159-161 still omits `supabase/functions/`, `config.toml`, and `seed.sql`. Ledger DW-151 left `status: open` because the orchestrator records resolution.
