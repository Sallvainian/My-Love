---
title: 'PR 270 partner CHECK diagnostics'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Claude review run 34664499589 correctly identifies that partner send/accept/decline CHECK failures replace the database message before the surrounding catch logs it, losing the original constraint message from diagnostics.

**Approach:** Snapshot the original CHECK diagnostics with the existing `logSupabaseError` helper before replacing the message. Keep the approved friendly rejection, original error identity/prototype/code/details/hint, duplicate-request precedence and every non-CHECK path unchanged. Do not change SQL, shared logging policy, the ledger, loop state or active loop worktrees.

</frozen-after-approval>

## Implementation Notes

- User authorized review-driven fixes and repeated publication/review on PR 270. This is a one-shot follow-up isolated in the operator-owned worktree.
- Change only the three partner CHECK branches and their existing real-service tests. The existing helper copies diagnostic strings into a separate object, so later mutation cannot erase the logged original message.
- The additional CHECK-only diagnostic entry is intentional; the existing outer catch log and rejection contract remain unchanged. No broader logging refactor or new API is needed.
- Verification target: given plain-object and PostgrestError CHECK failures for each method, the logged snapshot retains original message/code/details/hint after rejection, while the rejection is the same original object with friendly text. Non-CHECK controls retain existing behavior and must not emit the new CHECK diagnostic entry.
- Red/green verification: all three new CHECK diagnostic regressions failed before the fix and passed afterward; all 19 tests in `tests/unit/api/partnerService.check.test.tsx` passed, including the existing rendered caller and duplicate-request controls.
- Added six parameterized tests: three methods with both plain and class CHECK errors, plus three non-CHECK logging controls. The existing identity/prototype/diagnostic and friendly UI assertions remain intact.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed. Lint retained only the three existing EventCountdown Fast Refresh warnings.
- `npm run test:unit:coverage -- --silent --reporter=dot`: 98 files and 1,570 tests passed, with all configured coverage thresholds passing (54.98% lines; 49.79% branches).
- Supabase guidance was checked against the current changelog and the project's real `logSupabaseError` implementation. This modifies only JavaScript error logging around mocked SDK responses; no database query, auth mutation, policy, migration, deployment, or live backend change is needed.

## Review Triage Log

- Low, patched: finding only the raw snapshot did not pin the retained catch entry or prevent duplicate snapshots. The regression now checks exactly two ordered log entries: an independent original diagnostic snapshot and the retained catch log containing the original rejection object.
- Low, patched: the generic non-CHECK control did not pin the distinct duplicate-request branch's logging. Strengthened the existing duplicate test to require its single original catch log and unchanged backend error.
- Low, patched: nullable wire diagnostics were absent from the new snapshot regression. Added a plain CHECK envelope with null details/hint, consistent with existing error-handler fixtures, and assert both values are retained.
- No runtime defects, deferred items, or scope changes from the independent one-shot review; all three small coverage improvements were applied without editing the ledger.
- Post-review verification repeated typecheck, lint, diff check, and the full coverage run: all 98 files and 1,570 tests passed; coverage thresholds passed (54.97% lines; 49.79% branches). The small percentage difference from the earlier run does not change the pass result.
