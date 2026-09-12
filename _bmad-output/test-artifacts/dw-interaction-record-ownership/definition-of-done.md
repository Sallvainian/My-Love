# Definition of Done — DW-75 automation

- [x] Story acceptance criteria, implementation baseline and existing coverage mapped; all seven matrix rows retain existing unit coverage.
- [x] Four prioritized tests generated: two P0 ownership/privacy browser cases, one P1 continuity/browser case, one P1 supporting live API contract.
- [x] Complete unique-record factory, retained-callback browser fixture/harness, and worker-partner auth fixture implemented and composed through the existing merged-fixtures entry point.
- [x] Tests assert callback completion, exact production store state and rendered unread badge. Harness contains no ownership filter.
- [x] API uses real authenticated sender/recipient, runtime schema validation, server-generated timestamp, exact-row readback and checked ID-scoped cleanup.
- [x] No shared password resets, partner-link changes, archived E2E edits, generated type edits, production changes, ledger changes or sprint-board changes remain.
- [x] TypeScript, lint and 69 existing focused regression tests pass. Lint has only three existing warnings.
- [x] All four new tests pass; five separate fresh-process runs at two workers pass 20/20, retries disabled.
- [x] Both P0 tests fail when all record guards are disabled; the same-account P0 also fails with only lifetime checking disabled. Exact original source is restored and clean repeats pass afterward.
- [x] Source snapshots match active files by SHA-256; worker drafts, corrections, failures and successful execution evidence are preserved under TEA's configured artifacts directory.
- [x] Browser CLI exploration session closed; Playwright owns test contexts/server cleanup. No deployment, PR, commit or push performed.

Completion means this automation workflow is complete. It does not certify full-app sign-in/auth-event wiring, actual Realtime INSERT delivery, CI or production deployment. See the [automation summary](../automation-summary-dw-interaction-record-ownership.md) for exact evidence and commands.
