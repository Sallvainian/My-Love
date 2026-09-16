---
title: 'DW-153/DW-154: remove leftover scripture names from live test comments'
type: 'chore'
created: '2026-09-16'
status: 'done'
baseline_revision: '7c4fe9309fc8eb86f07d09fc4e483323e45f22e8'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The rewritten REJECTIONS comment still says the six uncovered CHECKs
      none of which route through the mapper, but photos, love_notes, and
      partner_requests write paths call handleSupabaseError on 23514.
    evidence: |-
      tests/api/check-constraint-error-mapping.spec.ts:93-95 "none of which
      route through the mapper". src/services/photoService.ts:22 imports
      handleSupabaseError; :396-397 maps 23514. src/stores/slices/notesSlice.ts:19
      imports it; :519-520 maps 23514. src/api/partnerService.ts:16 imports it;
      :208-210 maps 23514. Pre-existing taxonomy also in
      check-constraint-envelopes.ts:70-73 (intent leave-alone). This rewrite
      only dropped scripture_reflections and seven→six.
    location: >-
      tests/api/check-constraint-error-mapping.spec.ts:93-95
    severity: low
  - summary: >-
      Other live tests/api comments still cite deleted scripture specs.
    evidence: |-
      tests/api/events-wire-contract.spec.ts:90 `tests/api/scripture-reflection-2.2.spec.ts:63-70`;
      :93 `SupabaseReflectionSchema` (:231-240); :327
      `tests/api/scripture-reflection-rpc.spec.ts:258-266`.
      tests/api/events-write-wire-shape.spec.ts:53
      `tests/api/scripture-reflection-rpc.spec.ts:260-266`.
      Intent closed the work to "the two remaining comments".
    location: >-
      tests/api/events-wire-contract.spec.ts:90
    severity: low
---

<intent-contract>

## Intent

**Problem:** Two live test comments still name scripture after stories 1 and 3 dropped the feature. `tests/api/check-constraint-error-mapping.spec.ts:93-95` still inventories `scripture_reflections` among uncovered CHECKs. `tests/support/helpers/rls-security.ts:4` still says "Shared utilities for scripture RLS security E2E tests."

**Approach:** Reword those two comments against the current inventory and live importers. Keep `rls-security.ts`. Do not touch `persisted-blob.ts` (already free of `scripture-cache.ts` since `5238b226`) or the envelopes comment (already 13 rows / six uncovered).

## Boundaries & Constraints

**Always:** Match the uncovered CHECK list to `tests/support/check-constraint-envelopes.ts:70-73` (`love_notes`, `partner_requests`, and `photos`; six rows, not seven). Describe `rls-security.ts` as shared RLS helpers used by events, auth, and API specs. Keep the file. Documentation-only; own commit.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Do not delete `tests/support/helpers/rls-security.ts`. Do not edit `tests/support/helpers/persisted-blob.ts` or `tests/support/check-constraint-envelopes.ts`. Do not change executable source, assertions, or imports. Do not re-add scripture.

</intent-contract>

## Code Map

- `tests/api/check-constraint-error-mapping.spec.ts:89-96` — REJECTIONS header. `:93-95` currently: `The other seven CHECK constraints in \`public\` sit on \`love_notes\`, \`partner_requests\`, \`photos\` and \`scripture_reflections\`, none of which route through the mapper`. Change "seven" to "six" and drop `scripture_reflections`. Keep the covered-table sentence (`events` 3, `moods` 3, `interactions` 1) and the sibling-summary pointer.
- `tests/support/check-constraint-envelopes.ts:70-73` — read-only target wording: `It returns 13 rows. Seven sit on tables written through a module that imports \`handleSupabaseError\` — \`events\` (3), \`moods\` (3), \`interactions\` (1) — and six do not: \`love_notes\` (2), \`partner_requests\` (2), \`photos\` (2).`
- `supabase/migrations/20260916000000_drop_scripture.sql:49` — read-only: `drop table if exists public.scripture_reflections;`
- `tests/support/helpers/rls-security.ts:1-5` — file header. `:4` currently: `Shared utilities for scripture RLS security E2E tests.` Reword; do not delete the file. Exports `createUserClient` and `createOutsiderClient`.
- Live importers of `rls-security.ts` (read-only evidence): `tests/api/events-wire-contract.spec.ts`, `couple-broadcast-authorization.spec.ts`, `interaction-authorization.spec.ts`, `profile-name-email-ownership.spec.ts`; `tests/e2e/auth/implicit-fragment-rejection.spec.ts`; unit suite `tests/unit/helpers/rls-security.test.ts` (do not name the unit suite in the header unless needed — intent names events, auth, and API specs).
- `tests/support/helpers/persisted-blob.ts:17` — currently `Pure functions over a \`Page\`, rather than a \`mergeTests\` entry.` No `scripture-cache.ts` citation. Do not edit.
- `_bmad-output/implementation-artifacts/deferred-work.md` — orchestrator records resolution. Do not edit.

## Tasks & Acceptance

**Execution:**
- `tests/api/check-constraint-error-mapping.spec.ts` — in the REJECTIONS comment, replace the "other seven … `scripture_reflections`" sentence with six uncovered CHECKs on `love_notes`, `partner_requests`, and `photos`, matching the envelopes inventory.
- `tests/support/helpers/rls-security.ts` — replace the scripture E2E-tests sentence with shared RLS helpers used by events, auth, and API specs. Keep the file.

**Acceptance Criteria:**
- Given `check-constraint-envelopes.ts` reports 13 rows and six uncovered CHECKs on `love_notes`, `partner_requests`, and `photos`, when a maintainer reads the REJECTIONS comment in `check-constraint-error-mapping.spec.ts`, then that comment names those six on those three tables and does not name `scripture_reflections`.
- Given `rls-security.ts` stays on disk, when a maintainer reads its file header, then it describes shared RLS helpers used by events, auth, and API specs and does not contain `scripture RLS security E2E tests`.
- Given `persisted-blob.ts` and `check-constraint-envelopes.ts`, when the change lands, then those two files are byte-for-byte unchanged and `persisted-blob.ts` still does not cite `scripture-cache.ts`.
- Given the completed diff, when it is inspected, then executable code and assertions are unchanged, `rls-security.ts` is not deleted, and `_bmad-output/implementation-artifacts/deferred-work.md` is unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 12 findings — high 0, medium 0, low 3, false 9, maybe-false 0
- findings:
  - `[low]` `[defer]` Blind hunter: rewritten REJECTIONS comment still says the six uncovered CHECKs "none of which route through the mapper" — `photoService.ts:22`/`:396-397`, `notesSlice.ts:19`/`:519-520`, and `partnerService.ts:16`/`:208-210` call `handleSupabaseError` on 23514. Pre-existing taxonomy also in `check-constraint-envelopes.ts:70-73`, which the intent left alone; this rewrite only dropped `scripture_reflections` and seven→six.
  - `[low]` `[defer]` Blind hunter: other live tests/api comments still name deleted scripture specs — `events-wire-contract.spec.ts:90`, `:93`, `:327` and `events-write-wire-shape.spec.ts:53` cite `scripture-reflection-*.spec.ts` / `SupabaseReflectionSchema`. Intent closed the work to "the two remaining comments".
  - `[false]` `[reject]` Blind hunter: `rls-security.ts` header does not match live importers — header `Shared RLS helpers used by events, auth, and API specs.` matches intent.md live-importer labels. `events-wire-contract.spec.ts:121` is the events consumer; `implicit-fragment-rejection.spec.ts:17` is auth; four `tests/api` files are the API specs. Omitting the unit suite does not falsify those audiences.
  - `[false]` `[reject]` Blind hunter: Verification never asserts the new wording — verification-gap reported no gaps. Comment-only work; ACs are a maintainer reading those comments. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: REJECTIONS rewrite drops the envelopes 2+2+2 split — intent asked for six uncovered CHECKs on `love_notes`, `partner_requests`, and `photos`, not the per-table counts. Diff implements that.
  - `[false]` `[reject]` Blind hunter: Problem never states the DW-154 `persisted-blob.ts` half — Approach already says `persisted-blob.ts` is free of `scripture-cache.ts` since `5238b226`. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: Code Map importer paths omit directory prefixes — Code Map is planning evidence. Fix would be editing this spec.
  - `[false]` `[reject]` Intent alignment: spec artifact is a surface intent.md never named — bmad-build-auto requires `{spec_file}`; spec verification allows it as workflow output.
  - `[false]` `[reject]` Intent alignment: reworded comment omits per-table (2) counts — same as the 2+2+2 row; intent named six on those three tables.
  - `[false]` `[reject]` Intent alignment: Reading B (edit `persisted-blob.ts:17`) vs the diff — intent.md paragraph says `persisted-blob.ts` no longer cites `scripture-cache.ts` (`5238b226`); `persisted-blob.ts:17` is `Pure functions over a Page`. DW-154 location is `rls-security.ts:4` only.
  - `[low]` `[defer]` Intent alignment: Reading C (sweep every live scripture comment) vs the closed pair — same leftover citations as the second Blind hunter row. Intent: "reword the two remaining comments".
  - `[false]` `[reject]` Intent alignment: tests never assert the new comment text — docs-only; no test added; verification-gap reported no gaps.

## Auto Run Result

Status: done

Summary of implemented change: Reworded the two leftover scripture comments. The REJECTIONS inventory now names six uncovered CHECKs on `love_notes`, `partner_requests`, and `photos`. The `rls-security.ts` header now names events, auth, and API specs. `persisted-blob.ts`, `check-constraint-envelopes.ts`, and the deferred-work ledger were left unchanged.

Files changed:
- `tests/api/check-constraint-error-mapping.spec.ts` — seven→six and drop `scripture_reflections` in the REJECTIONS comment
- `tests/support/helpers/rls-security.ts` — replace the scripture E2E-tests header sentence
- `_bmad-output/implementation-artifacts/spec-dw-153-154-leftover-scripture-comments.md` — build-auto spec

Review findings breakdown:
- patches applied: none
- items deferred: 2 (stale "route through the mapper" taxonomy on the six uncovered CHECKs; other live `tests/api` comments still cite deleted scripture specs)
- rejected: 9 (see Review Triage Log)

Follow-up review recommendation: false (first pass; patched entries by verdict: high 0, medium 0, low 0)

Verification:
- `rg -n "scripture"` on the mapping spec, `rls-security.ts`, and `persisted-blob.ts` — no match (exit 1)
- `rg -n "six do not: \`love_notes\`"` `tests/support/check-constraint-envelopes.ts` — `:72`
- `git diff --check` — no whitespace errors
- `npx eslint tests/api/check-constraint-error-mapping.spec.ts tests/support/helpers/rls-security.ts` — exit 0
- freeze-list `git diff --stat` — only the two comment files (`persisted-blob.ts`, envelopes, and `deferred-work.md` unchanged)

Residual risks: the REJECTIONS comment still shares envelopes' pre-existing claim that those six CHECKs do not route through the mapper, which DW-38 made stale. Other `tests/api` comments still cite deleted scripture specs. Ledger DW-153 and DW-154 left `status: open` because the orchestrator records resolution.

## Verification

**Commands:**
- `rg -n "scripture" tests/api/check-constraint-error-mapping.spec.ts tests/support/helpers/rls-security.ts tests/support/helpers/persisted-blob.ts` — expected: no match.
- `rg -n "six do not: \`love_notes\`" tests/support/check-constraint-envelopes.ts` — expected: `:72` unchanged.
- `git diff --check` — expected: no whitespace errors.
- `npx eslint tests/api/check-constraint-error-mapping.spec.ts tests/support/helpers/rls-security.ts` — expected: exit 0.
- `git diff --stat -- tests/api/check-constraint-error-mapping.spec.ts tests/support/helpers/rls-security.ts tests/support/helpers/persisted-blob.ts tests/support/check-constraint-envelopes.ts _bmad-output/implementation-artifacts/deferred-work.md` — expected: only the two comment files in that list (this spec may also appear as workflow output).
