---
title: 'DW-148/DW-149: AGENTS.md IndexedDB opener count and App.tsx render-chain lines'
type: 'chore'
created: '2026-09-16'
status: 'done'
baseline_revision: '3f719ee5b12a15ca3c6d77009c18e6ecd11f8ba7'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      tests/unit/services/dbSchema.test.ts still says five modules open this
      database after scriptureReadingService was removed.
    evidence: |-
      tests/unit/services/dbSchema.test.ts:303 "Five modules open this database".
      The test asserts moodService still creates messages indexes, not opener
      count. Pre-existing; the bundle surface was AGENTS.md.
    location: >-
      tests/unit/services/dbSchema.test.ts:303
    severity: low
  - summary: >-
      tests/e2e/navigation/tray.spec.ts cites the five-place registration bullet
      at AGENTS.md:25; that line is the Where things are heading and the bullet
      is :28.
    evidence: |-
      tests/e2e/navigation/tray.spec.ts:6 "(AGENTS.md:25)". AGENTS.md:25 is
      "## Where things are"; the bullet is AGENTS.md:28 both before and after
      this change (no line shift).
    location: >-
      tests/e2e/navigation/tray.spec.ts:6
    severity: low
---

<intent-contract>

## Intent

**Problem:** The managed `AGENTS.md` `bmad:context` block still says five modules open `my-love-db` after `scriptureReadingService` was deleted, and it still points the untypechecked `currentView ===` render chain at `App.tsx` (~724), which is birthday/wedding countdown markup, not a view arm.

**Approach:** Correct those two figures in place: Four remaining openers, and the render-chain citation to home ~715 plus lazy views ~786-797. Leave the pitfalls themselves, the rest of the block, and the deferred-work ledger untouched.

## Boundaries & Constraints

**Always:** Edit only the git-tracked `AGENTS.md` inside the `<!-- bmad:context -->` … `<!-- /bmad:context -->` markers. On the IndexedDB pitfall (today `:63`), replace the sentence-start `Five modules open \`my-love-db\`` with `Four modules open \`my-love-db\`` and keep `and all delegate to \`upgradeDb\``. On the view-registration bullet (today `:28`), replace only `(~724)` with `(home ~715, lazy views ~786-797)`. Before writing, re-read `App.tsx` `currentView ===` arms and the four production openers; if those line numbers have moved, write the actual home arm and the lazy `currentView ===` range, and keep the count at four if those four files are still the only production openers.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`. Do not rewrite the IndexedDB pitfall, list opener files, change `all delegate to upgradeDb`, or touch the `five hand-maintained places` count, the URL ternaries `(~189 and ~208)`, `DESTINATIONS`, provenance (`Verified 2026-09-15 against 04d594f0`), or anything outside the two figures. Do not run a `bmad-project-context` refresh. Do not edit `CLAUDE.md`, `src/App.tsx`, `src/sw-db.ts`, the three `openMyLoveDB()` services, or `tests/unit/services/dbSchema.test.ts:303` (`Five modules open this database`). Do not re-add scripture.

</intent-contract>

## Code Map

- `AGENTS.md:28` — only DW-149 edit. Today: `the \`currentView ===\` render chain (~724)`. Keep `five hand-maintained places`, `ViewType`/`pathMap`, `App.tsx` `(~189 and ~208)`, and `DESTINATIONS`.
- `AGENTS.md:63` — only DW-148 edit. Today: `Five modules open \`my-love-db\` and all delegate to \`upgradeDb\``. Rest of the pitfall (schema changes go in `dbSchema.ts`, gate on store existence, versionchange winner) stays.
- `AGENTS.md:1-2` and `:76` — markers and provenance. Read-only.
- `src/App.tsx:715` — `{currentView === 'home' && (`. `:730` is wedding `EventCountdown`; `:724` is Casey's `BirthdayCountdown`. Not view arms.
- `src/App.tsx:786-797` — lazy arms: `'photos'` `:786`, `'mood'` `:790`, `'partner'` `:792`, `'notes'` `:794`, `'settings'` `:797`. `:783` is `currentView !== 'home'`, not an equality arm.
- `src/App.tsx:183-193` and `:197-211` — URL ternaries still near `~189` / `~208`. Read-only.
- `src/services/storage.ts:49`, `src/services/customMessageService.ts:74`, `src/services/moodService.ts:44` — `openMyLoveDB()`.
- `src/sw-db.ts:33` — window path `openMyLoveDB()`; `:36-46` worker `openDB` still calls `upgradeDb`. One module, two paths.
- `src/services/dbSchema.ts:354-362` — `openMyLoveDB` upgrade delegates to `upgradeDb`. Read-only.
- `src/services/scriptureReadingService.ts` — absent from `src/`.
- `tests/unit/services/dbSchema.test.ts:303` — same stale "Five modules" in a test comment. Out of scope.
- `_bmad-output/implementation-artifacts/deferred-work.md` — orchestrator records resolution. Do not edit.

## Tasks & Acceptance

**Execution:**
- `AGENTS.md` — substitute `Five modules` → `Four modules` on the IndexedDB pitfall, and `(~724)` → `(home ~715, lazy views ~786-797)` on the view-registration bullet. No other edits.

**Acceptance Criteria:**
- Given the managed `bmad:context` block, when an agent reads the IndexedDB pitfall, then it says `Four modules open \`my-love-db\` and all delegate to \`upgradeDb\``, it does not say `Five modules open`, and the surrounding schema-upgrade rule is unchanged.
- Given that same block, when an agent reads the view-registration bullet, then the `currentView ===` render chain is cited as `home ~715, lazy views ~786-797` (or the actual `App.tsx` equality-arm lines if they moved), it does not cite `~724`, and `five hand-maintained places`, `(~189 and ~208)`, and `DESTINATIONS` are unchanged.
- Given `_bmad-output/implementation-artifacts/deferred-work.md`, `CLAUDE.md`, `src/App.tsx`, and `tests/unit/services/dbSchema.test.ts`, when this change lands, then those files are byte-for-byte unchanged.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 6, false 14, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind hunter: two substitutions sit in the managed block whose header says a refresh replaces it, and the spec never records how Four / `~715`/`~786-797` survive regeneration — AGENTS.md:2 already said `edits inside this block are replaced on refresh` before this change. Intent is those two figures only and forbids a `bmad-project-context` refresh. Fix would be editing this spec or expanding AGENTS.md past the two figures.
  - `[low]` `[reject]` Blind hunter: provenance stamp now certifies figures this diff changed; `04d594f0` still has `Five modules` and `~697` — `git show 04d594f0:AGENTS.md` line 28 is `~697` and line 63 is `Five modules`. Current stamp is `Verified 2026-09-15 against 04d594f0`. The pre-change `~724` was already absent from that SHA. Intent: only the stale count and line figure, not provenance.
  - `[low]` `[defer]` Blind hunter: `tests/unit/services/dbSchema.test.ts:303` still says `Five modules open this database` — quote confirmed. The test asserts moodService creates `messages` indexes, not opener count. Pre-existing; not caused by the AGENTS.md substitutions.
  - `[false]` `[reject]` Blind hunter: verification never `rg`s `App.tsx` or counts `src/` openers, so drifted arms would still pass — delivered figures match `App.tsx:715` `{currentView === 'home' && (` and `:786-797` equality arms; four production openers remain. Verification-gap reported no gaps. Later line drift is the same class of staleness this DW fixes, not a hole in this hunk.
  - `[false]` `[reject]` Blind hunter: Always has no else branch if a fifth `src/` opener exists — `rg` of `openMyLoveDB`/`openDB<` under `src/` is storage.ts:49, customMessageService.ts:74, moodService.ts:44, sw-db.ts:33/:36, plus dbSchema.ts defining `openMyLoveDB`. No fifth consumer. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: citation omits `App.tsx:783` `{currentView !== 'home' && (` — `:783` is a negation wrapper, not a `currentView ===` registration arm. Intent named home `:715` and lazy `:786-797`. A new view still adds an equality arm in that range.
  - `[false]` `[reject]` Blind hunter: `git diff --stat` freeze list omits `sw-db.ts` and the three `openMyLoveDB()` services, and cannot show the spec file — those files are unchanged in the unified diff since `3f719ee5`. The command is the AC freeze list (deferred-work, App.tsx, dbSchema.test.ts, CLAUDE.md). Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: no command checks the hunk is only two substitutions — the staged diff is those two AGENTS.md lines plus this spec. Extra rewrite of either bullet did not occur.
  - `[false]` `[reject]` Blind hunter: Code Map writes `Casey's BirthdayCountdown` into `_bmad-output/` against AGENTS.md:13 personal-data policy — AGENTS.md:13 names `an email address, query output holding personal data, or a real credential`. `RELATIONSHIP_DATES.birthdays.casey` is already public at `App.tsx:724`. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: problem statement calls `:724` birthday/wedding countdown; wedding is `:730` — AGENTS.md never states what `:724` was; it only drops `~724`. Code Map already splits `:724` Casey `BirthdayCountdown` vs `:730` wedding `EventCountdown`. Fix would be editing this spec.
  - `[false]` `[reject]` Blind hunter: Code Map spans the second URL ternary as `App.tsx:197-211`; the ternary is `:199-210` — URL ternaries were not edited. `~189` is still `? 'notes'` and `~208` is still `? 'settings'`. Fix would be editing this spec.
  - `[low]` `[defer]` Blind hunter: `tests/e2e/navigation/tray.spec.ts:6` still cites `(AGENTS.md:25)` for the five-place bullet — confirmed. AGENTS.md:25 is `## Where things are`; the bullet is `:28` both before and after this change (no line shift). Pre-existing.
  - `[false]` `[reject]` Intent alignment: bundle vs `App.tsx` on what `:724` is (wedding EventCountdown vs Casey `BirthdayCountdown`) — AGENTS.md never narrates `:724`; Reading E is not required. Code Map records `:724` vs `:730`.
  - `[false]` `[reject]` Intent alignment: DW-149 ledger names only `:786-797` while the bundle and diff cite home `:715` plus lazy `:786-797` — invoke pointed at intent.md, which names both arms. Diff implements that bundle reading, not the shorter ledger sentence.
  - `[false]` `[reject]` Intent alignment: DW-148 location `AGENTS.md:64` vs edited line 63 — the edited sentence is `Five modules open \`my-love-db\``. Ledger must not be edited.
  - `[false]` `[reject]` Intent alignment: opener file list and worker `openDB` exception stay off AGENTS.md — intent: do not change the pitfall itself, only the count. Worker path still calls `upgradeDb` (`sw-db.ts:36-45`).
  - `[low]` `[defer]` Intent alignment: parallel `Five modules` comment in `dbSchema.test.ts:303` is untouched — same defect as the blind-hunter dbSchema.test.ts row.
  - `[false]` `[reject]` Intent alignment: ledger DW-148/DW-149 remain `status: open` — spawn text forbade editing the deferred-work ledger.
  - `[low]` `[reject]` Intent alignment: provenance still `Verified 2026-09-15 against 04d594f0` after the two figures changed — same as the first two blind-hunter rows; intent excluded a provenance bump.
  - `[false]` `[reject]` Intent alignment: diff also adds this spec file, which the bundle did not name — bmad-build-auto requires `{spec_file}`; spec verification allows it as workflow output.

## Design Notes

Do not list the four openers in the pitfall. `sw-db.ts` stays one of four modules; its worker branch still delegates to `upgradeDb`, so that clause stays. Exact substitutions:

```
Five modules open `my-love-db`
Four modules open `my-love-db`

the `currentView ===` render chain (~724)
the `currentView ===` render chain (home ~715, lazy views ~786-797)
```

## Verification

**Commands:**
- `rg -n "Five modules open" AGENTS.md` — expected: no match.
- `rg -n "Four modules open .my-love-db." AGENTS.md` — expected: one hit on the IndexedDB pitfall.
- `rg -n "~724" AGENTS.md` — expected: no match.
- `rg -n "home ~715, lazy views ~786-797" AGENTS.md` — expected: one hit on the view-registration bullet.
- `git diff --stat -- AGENTS.md _bmad-output/implementation-artifacts/deferred-work.md src/App.tsx tests/unit/services/dbSchema.test.ts CLAUDE.md` — expected: only `AGENTS.md` in the product-file list (the spec file may also appear as workflow output).

## Auto Run Result

Status: done

Summary of implemented change: Two figure substitutions in the managed `AGENTS.md` `bmad:context` block — IndexedDB opener count `Five` → `Four`, and the `currentView ===` render-chain citation `(~724)` → `(home ~715, lazy views ~786-797)`.

Files changed:
- `AGENTS.md` — those two substitutions only
- `_bmad-output/implementation-artifacts/spec-dw-148-149-agents-md-stale-context.md` — build-auto spec

Review findings breakdown:
- patches applied: none
- items deferred: 2 (`tests/unit/services/dbSchema.test.ts:303` Five-modules comment; `tests/e2e/navigation/tray.spec.ts:6` `AGENTS.md:25` citation)
- rejected: 18 (see Review Triage Log)

Follow-up review recommendation: false (first pass; patched entries by verdict: high 0, medium 0, low 0)

Verification:
- `rg -n "Five modules open" AGENTS.md` — no match (exit 1)
- `rg -n "Four modules open .my-love-db." AGENTS.md` — `AGENTS.md:63`
- `rg -n "~724" AGENTS.md` — no match (exit 1)
- `rg -n "home ~715, lazy views ~786-797" AGENTS.md` — `AGENTS.md:28`
- `git diff --cached --stat` on the freeze list — only `AGENTS.md` (`4 ++--`)

Residual risks: `tests/unit/services/dbSchema.test.ts:303` still says `Five modules open this database`. `tests/e2e/navigation/tray.spec.ts:6` still cites `(AGENTS.md:25)`. Provenance left at `Verified 2026-09-15 against 04d594f0` because intent allowed only the two figures.
