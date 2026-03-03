---
mode: edit
targetWorkflowPath: '_bmad/core/workflows/bmad-orchestrate'
workflowName: 'bmad-orchestrate'
editSessionDate: '2026-02-28'
stepsCompleted:
  - step-e-01-assess-workflow.md
  - step-e-02-discover-edits.md
  - step-e-04-direct-edit.md
  - step-e-05-apply-edit.md
completionDate: '2026-02-28'
validationAfterEdit: passed
completionStatus: complete_with_validation
hasValidationReport: true
validationStatus: 'COMPLETE — PASS with 8 structural violations, 5 warnings, 6 minor'
---

# Edit Plan: bmad-orchestrate

## Workflow Snapshot

**Path:** \_bmad/core/workflows/bmad-orchestrate
**Format:** BMAD Compliant
**Step Folders:** steps-c/
**Templates Folder:** Yes (orchestration-log.md)
**Data Folder:** No

## Validation Status

Validation report from 2026-02-28 — Status: COMPLETE

**Structural Violations (8):**

1. step-02 missing `workflow_command` frontmatter declaration
2. step-01 Menu 1 missing `#### Menu Handling Logic:` header
3. step-01 Menu 1 missing `#### EXECUTION RULES:` section
4. step-01 Menu 2 missing `#### Menu Handling Logic:` header
5. step-01 Menu 2 missing `#### EXECUTION RULES:` section
6. step-02 Menu 1 missing `#### Menu Handling Logic:` header
7. step-02 Menu 1 missing `#### EXECUTION RULES:` section
8. step-02 Menu 1 missing "IF any other" redisplay handler

**Warnings (5):**

1. step-01 at 216 lines (Init limit 150)
2. Template missing stepsCompleted field
3. Template missing lastStep field
4. Template missing user_name field
5. Template missing document title header

**Minor (6):**

- step-02 logging contradiction
- Inconsistent fallback language between step-01 and step-03
- Others informational

---

## Edit Goals

### Direct Changes

**Category:** Step files + Data files

**Changes Requested:**

- [ ] Create `steps-c/data/artifact-verification.md` containing the verification procedure (sections 2-6 of step-01, lines ~70-132) plus the "artifacts found" menu (N/R/S/X options)
- [ ] Replace extracted sections in step-01-init.md with a single reference: load and follow `./data/artifact-verification.md`
- [ ] Verify step-01 line count is under 150 after extraction
- [ ] In step-02-execute.md, change the hardcoded agent name `workflow-agent` to a dynamic name derived from the selected workflow (e.g., `{workflow_command}` minus the `bmad-` prefix, or the workflow's short code)

**Rationale:**

1. step-01-init.md is 225 lines, exceeding the 150-line Init step type limit. The artifact verification logic is self-contained and suitable for extraction to a data file.
2. The spawned team agent should have a descriptive name matching the workflow it's running, so it's identifiable in team context (especially if orchestrating multiple workflows across sessions).

---

## Edits Applied (4 total)

### [Step file extraction] step-01-init.md + data/artifact-verification.md

- Extracted sections 2-3 (artifact verification procedure + menu) to `steps-c/data/artifact-verification.md`
- Replaced with short reference to `{verificationProcedure}` in step-01
- Added `verificationProcedure` to frontmatter
- Renumbered sections 4-7 → 3-6, updated all cross-references
- User approved: Yes
- Compliance check: Passed
- **Result:** step-01 reduced from 225 → 175 lines

### [Step file edit] step-02-execute.md

- Changed hardcoded agent name `workflow-agent` to dynamic naming: strip `bmad-` prefix from `{workflow_command}`, append `-agent`
- User approved: Yes
- Compliance check: Passed
