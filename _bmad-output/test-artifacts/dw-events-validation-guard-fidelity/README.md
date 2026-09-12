# Events validation guard fidelity — TEA automation artifacts

This bundle contains seven API tests, one E2E test, and one shared data factory for `dw-events-validation-guard-fidelity`. The user requested deliverables under TEA's configured `test_artifacts` directory, so these files remain here. Normal Playwright and CI discovery do not include them until they are activated.

Run commands below from the repository root. Start the local Supabase stack first with `supabase start`; Playwright uses the existing worker authentication pool and local test server configuration. No `fnox` prefix is needed for this local test workflow.

## Run the generated tests

The default command stages this bundle's files, runs all eight generated cases with one worker in the existing `api` and `chromium` projects, and removes the unchanged staged copies afterward:

```sh
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py
```

For a scoped run, provide the complete command after `run.py`. Supplied arguments replace its default command.

```sh
# Seven API cases
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py npx playwright test tests/api/events-validation-fidelity.spec.ts --project=api --workers=1

# One browser round trip
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py npx playwright test tests/e2e/settings/events-validation-fidelity.spec.ts --project=chromium --workers=1

# Four P1 cases across both levels
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py npx playwright test tests/api/events-validation-fidelity.spec.ts tests/e2e/settings/events-validation-fidelity.spec.ts --project=api --project=chromium --workers=1 --grep '\[P1\]'
```

Use the same staging runner for static checks so the generated TypeScript participates in the repository's configured projects:

```sh
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py npm run typecheck
python3 _bmad-output/test-artifacts/dw-events-validation-guard-fidelity/run.py npm run lint
```

The runner refuses to stage anything if any destination file already exists or is a symlink. It never overwrites a destination. Cleanup removes only staged files whose bytes still match the generated source; a file modified during the run is preserved and reported. Run one staging command at a time. The child command's exit code is returned to the caller.

## Contents and activation paths

| Artifact, relative to this directory | Eventual active repository path |
|---|---|
| `tests/api/events-validation-fidelity.spec.ts` | `tests/api/events-validation-fidelity.spec.ts` |
| `tests/e2e/settings/events-validation-fidelity.spec.ts` | `tests/e2e/settings/events-validation-fidelity.spec.ts` |
| `tests/support/factories/events-validation.ts` | `tests/support/factories/events-validation.ts` |

Activation means placing these three files at their corresponding repository paths in a later change. No activation is performed by this delivery. The factory reuses `tests/support/eventsValidationContract.ts` and the tagged contract in `supabase/tests/database/21_events_validation_contract.sql`; specs reuse the existing merged fixtures and worker pool.

[coverage-plan.md](coverage-plan.md) maps priorities and existing coverage. [generation-summary.json](generation-summary.json) records generated counts. [definition-of-done.md](definition-of-done.md) records scope, limitations, and validation status.

Measured on 2026-09-12: **8/8 generated tests passed** in 12.1 seconds, with zero failures, skips, flaky classifications, or retries. Typecheck and lint passed while all generated files were staged. Existing checks also passed: 141 Vitest tests and 236 pgTAP assertions, with all 34 migrations applied. See [Definition of Done](definition-of-done.md) and [execution evidence](evidence/playwright-initial.json).

The run used one Playwright worker and no parallel independent invocation. Existing global auth setup provisions the fixed worker pool; avoid overlapping this command with another Playwright invocation using that pool.
