---
title: 'PR 270 delete-refresh contrast'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Claude review run 34661664595 identified insufficient contrast on the Settings delete dialog's not-found recovery button: white text on blue-500 falls below 4.5:1.

**Approach:** Use opaque blue-600 with blue-700 on hover, preserving the existing recovery behavior and white label. Strengthen the rendered not-found regression to pin both accessible color tokens. Keep the loop's ledger, state, worktrees, approved contracts and unrelated controls unchanged.

</frozen-after-approval>

## Implementation Notes

- User authorized review-driven fixes, commits, pushes and repeated exact-commit Claude review on PR 270. Work is isolated from the running sweep in an operator-owned worktree based on dff6ca1fd8b674ed96a7683c0873155d618f1b12; integration waits for a safe loop boundary.
- One-shot route: no unresolved product choices, no database or deployment changes, no new API; one CSS class change and its existing component regression.
- Relevant code: src/components/Settings/EventsSettings.tsx, EventDeleteConfirmation's not-found branch; src/components/Settings/__tests__/EventsSettings.test.tsx, rejected-delete rendered test.
- Claude's separate partner-service minor observation is not a defect: spec-dw-38-check-error-path-consistency.md requires friendly service rejections while preserving error identity, and separately requires caller support for plain-object errors. Preserve that approved behavior; no ledger changes.
- Changed only the recovery button's default/hover utilities and strengthened the existing rendered rejected-delete regression to assert blue-600, hover:blue-700 and text-white. Its existing non-destructive styling and recovery-action tests remain intact.
- Red/green verification: the targeted rejected-delete test failed on the original blue-500 styling and passed after the change. All 68 tests across EventsSettings.test.tsx, EventsSettings.focus.test.tsx and EventsSettings.errorIsolation.test.tsx passed.
- `npm run typecheck`, `npm run lint` and `git diff --check` passed. Lint retained only the three existing EventCountdown react-refresh warnings.
- `npm run test:unit:coverage -- --silent --reporter=dot`: 98 files and 1,564 tests passed; all configured coverage thresholds passed (54.96% lines, 49.79% branches).
- Browser verification: compiled this worktree's src/index.css with the installed Tailwind compiler and tailwind.config.js, using the recovery button's actual source class list. Rendered its white label in an isolated Chromium page and ran axe-core's color-contrast rule at rest and on hover in both light and dark color schemes: all four checks passed with zero violations and zero incomplete checks. Only the external Google Fonts import was omitted to keep this probe offline; no app server, authentication, Supabase connection or shared browser was used. The named probe browser was closed afterward.
- Resolved browser colors: foreground rgb(255, 255, 255); default background oklch(0.546 0.245 262.881); hover background oklch(0.488 0.243 264.376). Locked-palette conversion to clipped linear sRGB yields contrast ratios 5.256:1 and 6.824:1, versus 3.761:1 for the previous blue-500 default.
- Scope of browser evidence: this checks the actual CSS and label, not the authenticated stale-delete workflow; the existing component regressions cover that workflow's not-found branch and refresh behavior.

## Review Triage Log

- Low, addressed: the class-name regression alone did not measure rendered contrast. Added the isolated compiled-CSS browser verification above, covering default/hover in both color schemes without interfering with the loop's database tests. No new runtime defect was identified.
- Low, addressed: the in-progress handoff lacked verification evidence. Recorded red/green regression results, full unit/coverage/type/lint results, resolved browser colors and measured contrast above before completion. No ledger entries were created.
- False as a defect, retained contract: Claude's partner-service Minor accurately notices repeated mapping, but friendly service rejections and plain-object UI handling are separate explicit DW-38 requirements. Existing real-service/rendered-caller tests preserve original error identity, diagnostics and all non-CHECK behavior; no incorrect output was demonstrated.
