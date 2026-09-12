---
title: 'PR 270 staging preflight checks'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Claude review run 34665305337 and CodeQL alert 141 flag the redundant access-before-read check in the DW-53 development-only test-staging helper. It treats every access failure as absence and introduces an avoidable check/read race.

**Approach:** Read each target directly during preflight, treat only ENOENT as absence, and compare the returned content for cleanup. Preserve whole-set preflight, exclusive stage creation and refusal to clean modified files. Document that content-check/unlink cleanup is not atomic against concurrent writers; use only an idle dedicated worktree. Do not run this helper on the live project or loop worktree, alter the ledger, or redesign filesystem locking.

</frozen-after-approval>

## Implementation Notes

- One-shot review follow-up under the user's authorization, isolated in a separate operator worktree based on c0567a3e678ddd0951258f8b8d0b97ceaab7fe81.
- Staging already uses `writeFile` with `wx`; preserve that real no-overwrite protection. Removing `access` is not a claim of atomic compare-and-delete.
- Verify the actual script against synthetic files in disposable test directories: stage/clean round trip, existing-file refusal without partial writes, modified-file refusal without partial cleanup, missing-file cleanup, and fail-closed unreadable target behavior where practical.
- Cleanup now reads directly and treats only ENOENT as absence. Staging uses lstat solely for the whole-set existence preflight, so existing nonregular targets are refused without reading them; exclusive wx creation remains the actual no-overwrite guarantee.
- All six Node filesystem tests passed: round trip/repeated cleanup, existing target, modified target, nonregular target, and ENOTDIR whole-set failure preservation in both stage and clean modes. The synthetic directories were removed by test-owned cleanup; no real staged files were created or deleted.
- `node --check` passed for the helper and test; `git diff --check` passed. This is an artifact helper, not a production application change. CodeQL remediation remains subject to the next GitHub scan.

## Review Triage Log

- Low, patched: reading an existing FIFO during staging could hang; metadata-only staging preflight retains the prior prompt refusal, with a nonregular-directory regression and a subprocess timeout in the test harness. Cleanup's pre-existing nonregular-input limitations are not broadened into a filesystem redesign.
- Low, patched: the initial non-ENOENT test did not prove whole-set mutation refusal. Added stage and clean cases with a later ENOTDIR target; earlier paths remain absent or unchanged respectively.
- Low, patched: the standalone Node tests were undiscoverable to maintainers through the normal Vitest command. Added their exact invocation and Node-only/disposable-fixture requirements to the bundle README.
- No deferred entries or ledger edits. The documented residual constraint is an idle dedicated worktree: content comparison plus unlink is not an atomic operation against concurrent writers.
- Post-review verification: all six Node tests, app typecheck, lint and diff check passed. Lint has only the three pre-existing EventCountdown Fast Refresh warnings and does not cover these artifact scripts; their direct Node syntax/runtime checks are the relevant helper evidence.
