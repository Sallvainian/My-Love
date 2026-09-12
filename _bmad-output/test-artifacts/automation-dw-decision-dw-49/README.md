# DW-49 automation

Eight tests cover uncertain event saves: 4 P1 browser recovery cases, 2 P2
browser edge cases, and 2 P2 API persistence cases. See
[Definition of Done](definition-of-done.md) and the
[workflow summary](../automation-summary-dw-decision-dw-49.md).

From the project root, with local Supabase running:

```sh
supabase start
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-49/playwright.config.ts
```

Use `--grep '\[P1\]'` for the four primary recovery cases, `--project=api`
for the two HTTP checks, or `--repeat-each=3 --workers=4` for the repeated
parallel check. The config starts Vite in test mode and inherits local Supabase
environment resolution and auth provisioning from the root config.

These artifacts require the explicit config above; the default Playwright
projects and CI do not discover this directory. No package scripts or CI files
were changed. To check the artifact code itself:

```sh
npx tsc -p _bmad-output/test-artifacts/automation-dw-decision-dw-49/tsconfig.json
npx eslint _bmad-output/test-artifacts/automation-dw-decision-dw-49/api _bmad-output/test-artifacts/automation-dw-decision-dw-49/e2e _bmad-output/test-artifacts/automation-dw-decision-dw-49/fixtures
```

All specs import the existing `tests/support/merged-fixtures.ts`. `coupleEvents`
provides this worker's pair, one date anchor and checked cleanup. The factory
`makeSaveInput(userId, anchor, overrides)` produces valid event values with an
overridable UUID label. Browser tests fix the clock to the same anchor.

`installUncertainSave(page, 'POST' | 'PATCH')` forwards the actual save, corrupts
only the returned date and exposes the original committed row. It counts
POST/PATCH requests throughout the journey. `installRetryableSave(page)` rejects
the first create with a terminal error and forwards the deliberate retry.
Both controls drain their work in `finally`, and preserve the shared GET gate.

`evidence/` contains discovery, results, command outcomes and static checks.
The latest `results.json` is the 24-execution parallel run; separate P1/P2 JSON
files preserve the first eight executions. Runtime traces/screenshots remain
in the runner's ignored `test-results/` directory.
