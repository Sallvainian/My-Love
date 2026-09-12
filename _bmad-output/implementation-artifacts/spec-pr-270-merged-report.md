---
title: 'PR 270 merged Playwright report'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR 270's Merge Reports job reports success while logging "No report files found" and warning that no merged HTML artifact was uploaded. It downloads HTML/raw shard artifacts, but Playwright's merger requires blob reports; an unconditional fallback masks the failure.

**Approach:** Opt only the full E2E shard jobs into Playwright's blob reporter, preserve existing reporters and artifacts, upload/download blob artifacts separately, and merge with the locked Playwright version. Report missing artifacts or merge failures honestly. Leave production code, Supabase setup, burn-in behavior, branch-protection policy, loop state, ledger, and unrelated local dependency changes untouched.

</frozen-after-approval>

## Implementation Notes

- User explicitly requested checking everything reported on the PR page, in the context of authorized review/CI fixes and repeated push/monitor cycles.
- Evidence: Tests run 34666524138, Merge Reports job 103480398214. Shards produced only HTML/raw results; the merge command printed "No report files found" followed by "Merge skipped". The upload step then warned that playwright-report/ did not exist.
- Playwright's official sharding documentation specifies blob reports as merge inputs: https://playwright.dev/docs/test-sharding#merging-reports-from-multiple-shards.
- Added explicit E2E-only reporter opt-in and a separate shard artifact contract. Both input blobs and the merged report retain the existing 30-day window. Missing shards print the expected/actual count and filenames before failing; the merge command no longer masks errors.
- Retained all existing reporters, per-shard HTML/raw artifacts, and test-summary dependencies. Branch protection was not changed. Blob inputs are additional reporting data, not a new test execution or browser setup.
- Verification: reporter/config tests and a focused workflow source-contract regression; typecheck; lint with only the three existing EventCountdown warnings; full unit coverage. Actionlint's workflow validation passes; its optional ShellCheck reports exactly the same two existing burn-in notices as the unmodified HEAD workflow (SC2129 and SC2086).
- The configuration test loads through Vitest's importActual because playwright.config.ts is deliberately outside tsconfig.test's composite file list. Its infrastructure probes are mocked; no local Supabase or Docker command is executed by this test. Live report generation/upload will be verified against the pushed CI run, not inferred from these unit checks.
- Final local results: 100 unit files / 1,640 tests passed with coverage thresholds met (56.97% lines, 51.48% branches); four reporting regressions and both staging suites (16 cases) passed. Typecheck and lint pass. Local dependencies were updated concurrently by another session; those package edits are excluded, so the pushed CI run remains the authority for the committed lockfile.

## Review Triage Log

- Low — patch: reporter-array tests alone did not protect the producer/consumer workflow wiring. Added assertions for shard opt-in, artifact names and paths, locked dependency installation, whole-set checks, direct merge error propagation, output upload, and unchanged burn-in opt-in.
- Low — patch: the original count guard gave only an exit code. Added explicit expected/actual counts and available blob filenames on failure.
- Low — patch: seven-day blob retention shortened the retry window. Changed it to 30 days, matching existing shard reports and merged output.
