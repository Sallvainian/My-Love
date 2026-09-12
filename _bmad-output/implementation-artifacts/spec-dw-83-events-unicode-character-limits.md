---
title: 'DW-83 Events Unicode character limits'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: 'd395726e96d33af1ede4283c87a4cd5cc7d07680'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Event form validation counts UTF-16 code units, rejecting supplementary-plane emoji that fit PostgreSQL's existing character limits. DW-83's approved decision requires counting Unicode code points after trimming.

**Approach:** Correct the shared Add/Edit form's label and description counts and prove its boundaries through the existing component suite, preserving the 100/500 limits and database guard.

## Boundaries & Constraints

**Always:** Count code points in trimmed values, including combining marks separately. Preserve exact trimmed payloads without Unicode normalization, existing icons, null empty descriptions, required labels, date validation, and existing error messages. Exercise both Add and Edit at the component submission surface. Align any input caps or counters if present.

**Never:** Change the database schema, generated files, effective-schema guard, historical specs, archived E2E, or deferred-work ledger. Add grapheme counting, new dependencies, or unrelated validation changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Emoji at limit | Add/Edit: 100 supplementary emoji label or 500 supplementary emoji description, padded with whitespace | One correctly routed write with exact trimmed values; saved row visible; dialog closes | No field error |
| Emoji over limit | Add/Edit: 101 supplementary emoji label or 501 supplementary emoji description | No add/edit write or state change; dialog remains open | Existing field-specific limit error |
| Combining marks at limit | Add/Edit: decomposed `e\u0301` repeated 50 times for label or 250 for description, padded with whitespace | 100/500 code points accepted; payload retains decomposed text | No field error |
| Combining marks over limit | Add/Edit: same decomposed text plus one combining mark | 101/501 code points rejected even though grapheme count remains under the limit | Existing field-specific limit error; no writes |
| Existing validation | ASCII boundaries, blank labels, empty descriptions, date and icon choices | Existing behavior retained | Existing validation and write handling |

</intent-contract>

## Code Map

- `src/components/Settings/EventsSettings.tsx:87,88,826,836` — private 100/500 constants and shared `EventForm.handleSubmit`; trims before checking `.length`. `onSave` receives already-validated payloads. Change only the character measurement, with a brief explanation of code point semantics.
- `src/components/Settings/EventsSettings.tsx:977,1046` — label input and description textarea have no `maxLength`, counters, or truncation; `onChange` retains complete input. Preserve this behavior.
- `src/components/Settings/__tests__/EventsSettings.test.tsx:634` — existing validation suite and subscribable store double. Reuse `setStore`, `makeEvent`, `renderSection`, `openAddForm`, `fillForm`, `submitForm`, and `currentEvents`. Add/edit spies really update the rendered list. Existing ASCII and trimming cases remain.
- `tests/unit/components/eventsValidationMirrors.test.ts` and `tests/support/eventsValidationContract.ts` — read-only UI declaration guard, parsing private constants and all icon literals against shared SQL JSON contract.
- `supabase/tests/database/21_events_validation_contract.sql` — read-only pgTAP guard compares every installed events CHECK after migrations with the shared contract; run unchanged.
- `supabase/migrations/20260818000002_create_events_table.sql:19,21` — read-only `char_length` limits. Local `supabase_db_My-Love` is running; verify applied migrations and PostgreSQL counts without resetting or changing schema.
- `AGENTS.md`, `package.json` — typecheck is separate from Vitest; lint has three known EventCountdown warnings. Preserve the orchestrator-provided branch and ledger.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/Settings/__tests__/EventsSettings.test.tsx` — extend component coverage for every Unicode matrix row in both form modes, with independent literal boundary values, exact outgoing payloads, rendered results, and rejection without either write.
- [x] `src/components/Settings/EventsSettings.tsx` — count trimmed label and description code points while retaining current constants and behavior.
- [x] This spec — record targeted tests, lint/typecheck, unchanged mirror/pgTAP guard results, and direct PostgreSQL count evidence for matching fixtures.

**Acceptance Criteria:**
- Given the rendered Add or Edit dialog, when whitespace-padded Unicode inputs exactly meet either limit, then Save issues one correctly routed write with the exact trimmed payload and displays the saved row after closing.
- Given either dialog with valid remaining fields, when the label or description exceeds its limit by one code point, then Save shows the matching error, keeps the dialog open, and issues neither add nor edit writes.
- Given decomposed combining text, when its code point count exceeds the limit despite a smaller grapheme count, then the form rejects it without normalization or writes.
- Given the unchanged schema and guard, when the relevant component, mirror, pgTAP, lint, and typecheck checks run, then they pass and PostgreSQL reports the same 100/101 and 500/501 fixture counts.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 6 findings/observations — high 0, medium 0, low 3, false 3, maybe-false 0
- findings:
  - `[low]` `[reject]` Counting creates an array for unrestricted pasted text — confirmed: a Node probe of one million supplementary emoji allocated about 44 MB and took about 18 ms for the spread. Inputs of this size are unlikely for event labels/descriptions in everyday use; replacing the simple comparisons with an early-exit iterator adds control flow for this uncommon case. No change warranted under the workflow's low-severity rule.
  - `[low]` `[patch]` Synthetic change events bypass native length caps — the new tests used `fireEvent.change`, so value assertions alone could miss a future UTF-16 `maxLength` attribute. Added assertions that both rendered controls have no `maxlength` attribute in every Unicode acceptance case.
  - `[low]` `[patch]` Rejection state assertion aliases the store's mutable array — `setStore({ events })` installs the exact expected array. A direct probe confirmed an in-place icon change alters both sides of the prior comparison; the separate UI assertions only checked label/description. Added a `structuredClone` snapshot immediately before submission and compare the resulting state with that independent value.
  - `[false]` `[reject]` Separate emoji and combining fixtures miss a mixed-text counting failure — both comparisons use the same string iterator without type-dependent branches or normalization. A direct probe combining 25 ASCII letters, 25 supplementary emoji, and 25 decomposed pairs counted exactly 100. There is no demonstrated interaction failure; the existing fixtures independently distinguish UTF-16 and grapheme counting.
  - `[false]` `[reject]` Ordinary-space padding leaves non-ASCII trimming broken — the unchanged `String.trim()` precedes both comparisons and payload construction. A direct NBSP-padded mixed-text probe produced the exact original 100-code-point string. No whitespace-specific branch or changed trimming behavior supports the claimed failure.
  - `[false]` `[reject]` Component/store-double evidence differs from a full browser-to-database round trip — the intent explicitly asks for existing component coverage, and both modes exercise the real form submission handler, exact payloads, saved rows, and rejection. Direct PostgreSQL fixture counts plus the unchanged installed-schema guard separately verify database agreement; a single integration round trip is not required by the intent.

All four review layers completed. The blind hunter supplied five findings; the verification-gap reviewer found no gaps; the intent auditor reported the surface distinction above while finding no behavioral divergence; the edge-case hunter returned no findings. The platform allowed three simultaneous reviewers, so the fourth launched after a slot opened, before any triage. Two independent low-severity patches were applied by the original implementation agent. No loopback or deferred finding remains.

## Verification

**Commands:**
- `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts src/components/Settings/__tests__/` — all relevant tests pass, including Unicode boundaries and existing behavior.
- `supabase test db` — existing database tests and effective-schema guard pass against applied migrations.
- Read-only SQL through local PostgreSQL — `char_length` reports 100/101 and 500/501 for the emoji and decomposed combining fixtures.
- `npm run typecheck` and `npm run lint` — exit zero; record pre-existing warnings.
- `git diff --check` — clean; inspect scope to confirm preserved files remain unchanged.

**Executed 2026-09-12:**
- Regression proof before the implementation: `npx vitest run src/components/Settings/__tests__/EventsSettings.test.tsx -t 'Unicode validation'` failed the four at-limit emoji cases (Add/Edit, label/description); the other 12 new Unicode cases passed.
- `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts src/components/Settings/__tests__/` — exit 0; 177 tests passed across 7 files, including all 16 new Unicode cases and all 42 unchanged mirror/extraction tests. Existing tests retain the ASCII, required-label, date, icon, trimming, empty-description, and write-failure coverage. Vite emitted the existing `vitest.config.ts` `__dirname` compatibility warning; the save/delete rejection tests emitted their expected error logs.
- `supabase migration list --local` — exit 0; all 34 local migration versions match the applied database versions, through `20260818000002`. The existing `supabase_db_My-Love` container was healthy; no reset or schema change was performed.
- `supabase test db` — exit 0; 236 tests passed across 22 files, including unchanged `21_events_validation_contract.sql` and its installed-CHECK comparison.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0; only the three pre-existing `react-refresh/only-export-components` warnings in `EventCountdown.tsx` at lines 68, 91, and 132.
- `git diff --check` — exit 0. Implementation scope is the shared form, its existing component test file, and this spec. Database migrations, generated files, validation guards, historical specs, archived E2E, and the deferred-work ledger remain unchanged.

Direct fixture verification used `docker exec -i supabase_db_My-Love psql -X -U postgres -d postgres -v ON_ERROR_STOP=1` with the following read-only SQL (exit 0; server encoding `UTF8`):

```sql
BEGIN READ ONLY;
SHOW server_encoding;
WITH fixtures(name, value, expected) AS (
  VALUES
    ('emoji_label_limit', '  ' || repeat('💖', 100) || '  ', 100),
    ('emoji_label_over', repeat('💖', 101), 101),
    ('emoji_description_limit', '  ' || repeat('💖', 500) || '  ', 500),
    ('emoji_description_over', repeat('💖', 501), 501),
    ('decomposed_label_limit', '  ' || repeat(U&'e\0301', 50) || '  ', 100),
    ('decomposed_label_over', repeat(U&'e\0301', 50) || U&'\0301', 101),
    ('decomposed_description_limit', '  ' || repeat(U&'e\0301', 250) || '  ', 500),
    ('decomposed_description_over', repeat(U&'e\0301', 250) || U&'\0301', 501)
)
SELECT name, expected, char_length(btrim(value)) AS actual,
       char_length(btrim(value)) = expected AS matches
FROM fixtures;
COMMIT;
```

| Fixture | Expected | PostgreSQL actual | Matches |
|---------|----------|-------------------|---------|
| emoji_label_limit | 100 | 100 | true |
| emoji_label_over | 101 | 101 | true |
| emoji_description_limit | 500 | 500 | true |
| emoji_description_over | 501 | 501 | true |
| decomposed_label_limit | 100 | 100 | true |
| decomposed_label_over | 101 | 101 | true |
| decomposed_description_limit | 500 | 500 | true |
| decomposed_description_over | 501 | 501 | true |

## Auto Run Result

Status: done

Implemented DW-83: the shared Add/Edit handler counts Unicode code points in trimmed labels and descriptions at the existing 100/500 limits. Supplementary-plane emoji count once; combining marks count separately. Exact trimmed text, icons, dates, empty-description handling, and validation messages are preserved.

Files changed:
- `src/components/Settings/EventsSettings.tsx` — two code-point comparisons and a brief explanation of PostgreSQL semantics.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — 16 Add/Edit Unicode boundary cases, native-cap assertions, and independent rejection-state snapshots.
- This spec — implementation plan, measured verification, and complete review triage.

Review outcome: two patches applied (high 0, medium 0, low 2), no items deferred. The four rejected findings/observations and individual reasons are recorded above: uncommon large-input allocation does not warrant added control flow; mixed text and NBSP work with the unchanged common operations; separate component and database evidence matches the requested surface. Follow-up review recommended: false.

Final parent verification after the review patches:
- `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts src/components/Settings/__tests__/` — exit 0; 177 tests across 7 files, including 85 main component tests and all 42 mirror/extraction tests.
- `supabase test db` — exit 0; 236 tests across 22 files, including the effective-schema guard.
- Read-only PostgreSQL fixture query — exit 0; all eight emoji/decomposed counts match 100/101 or 500/501. Parent also compared applied migration versions directly with repository filenames: all 34 match.
- `npm run typecheck` — exit 0. `npm run lint` — exit 0 with only the three existing EventCountdown warnings.
- `git diff --check HEAD` — exit 0. Only the three files listed above changed; database schema, validation guard, generated files, historical specs, archived E2E, and deferred-work ledger are unchanged.
- Matrix audit: all 16 Unicode tests ran and passed, with no skipped/disabled cases. Existing executed cases cover ASCII boundaries, required fields, icons, dates, trimming, null descriptions, and write errors.

Residual limits: the component suite uses a subscribable store double; PostgreSQL agreement is verified separately through direct counts and the existing guard. Extremely large pasted values require a temporary code-point array as triaged above. No deployment is part of this change.
