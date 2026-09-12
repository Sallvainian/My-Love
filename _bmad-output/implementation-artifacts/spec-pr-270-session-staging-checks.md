---
title: 'PR 270 final-bundle staging checks'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The fifth sweep bundle introduced another access-before-read staging helper, flagged by CodeQL alert 142. The analysis workflow succeeds, but the separate PR CodeQL result fails on this alert.

**Approach:** Apply the verified DW-53 helper correction to the new event-load-session-ownership helper: metadata-only stage preflight, direct cleanup reads with only ENOENT treated as absence, existing exclusive creation and whole-set checks preserved. Keep this bundle's recursive TypeScript artifact discovery unchanged. Verify against disposable synthetic files and document the idle-worktree cleanup constraint. Do not edit production app code, loop artifacts/state, ledger, or database.

</frozen-after-approval>

## Implementation Notes

- User requested repeated PR fixes/checks and specifically reported the failing CodeQL check. The sweep is fully finished; the target branch was clean before this follow-up.
- One-shot continuation of the reviewed staging correction, adapting the existing six-case standalone filesystem regression suite to this bundle's real generated paths.
- Do not confuse workflow success with code-scanning approval: after publication, verify the PR's CodeQL check and open alerts on refs/pull/270/merge in addition to workflow runs and the exact-SHA Claude review.
- Validation: typecheck, lint (three unchanged Fast Refresh warnings), and all 99 unit files / 1,636 tests with coverage passed. Both standalone staging suites pass, including four additional cases requested by independent review. These suites operate only on disposable synthetic directories; no tests were staged in the working repository.
- Concurrent changes appeared in package.json and package-lock.json after validation. They are not part of this correction and are left untouched and uncommitted.

## Review Triage Log

- Low — patch: the existing nonregular-target case did not prove dangling-symlink handling. Added a test that verifies lstat detects the link before any earlier target is written.
- Low — patch: nonempty fixtures did not protect null-versus-empty-string handling. Added unchanged-empty cleanup and truncated-to-empty whole-set refusal cases.
- Low — patch: repeated cleanup proved only all-absent handling. Added mixed missing/existing-target cleanup coverage.
