# DW-83 events Unicode automation

15 executable tests: **8 API + 7 E2E**, prioritized **14 P1 + 1 P2**.
The suite exercises the committed Unicode validation change against local
Supabase and the real Settings form. No test is skipped or marked fixme.

Run from the repository root with dependencies installed and local Supabase
running (`supabase start` if needed). Configuration resolves local credentials
in memory, provisions the existing worker pool, and starts this worktree's Vite
server on port 5183. Leave that port free. No fnox prefix is needed for test mode.

```bash
# Run all 15 tests directly from this artifact directory.
npx playwright test --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/playwright.config.ts

# Select a level or priority.
npx playwright test --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/playwright.config.ts --project=api
npx playwright test --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/playwright.config.ts --grep '\[P1\]'

# Repeat the complete explicit story selection five times, without retries.
npx playwright test --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/playwright.config.ts --repeat-each=5

# Check the generated specs, shared fixture data, and Vite probe.
npx tsc -p _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/tsconfig.json
npx eslint _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/{api,e2e,support}/*.ts
```

- [API specification](api/events-unicode.spec.ts): POST/PATCH exact boundaries,
  field-specific CHECK failures, and atomic readback after refusal.
- [E2E specification](e2e/events-unicode.spec.ts): padded native inputs,
  create/edit/reload preservation, rejection/correction, and mixed joined emoji.
- [Shared data and schemas](support/unicode-events.ts): literal 100/101 and
  500/501 fixtures independent of source constants; strict structural schemas
  deliberately omit Zod's UTF-16 length validators.
- Existing `tests/support/merged-fixtures.ts` supplies auth, HTTP interception,
  polling, and `coupleEvents` setup/cleanup. No new accounts or fixture entry
  point are defined here. Both halves of only the assigned worker's pair are
  cleared before/after each case, including events created through the UI.

The default repository Playwright commands and CI do not discover artifact
directories. Use the explicit `--config` above; no copying or promotion is needed.
The runner configurations are validated through discovery and live execution;
they share the repository's existing exclusion from TypeScript's test scope.

The optional regression probe serves the former UTF-16 comparisons using a Vite
transform. It changes no source file and is **expected to exit 1**, failing
DW83-E2E-001 because valid emoji values are rejected:

```bash
npx playwright test --config _bmad-output/test-artifacts/automation-dw-events-unicode-character-limits/probe/playwright.config.ts
```

[Verification and Definition of Done](../automation-summary-dw-events-unicode-character-limits.md)
record 15/15 first-run passes, 75/75 repeated passes, 177 existing component
tests, 236 database assertions, and the expected mutation failure. Machine-readable
results are in [evidence/verification.json](evidence/verification.json). New runs
write `evidence/results.json`; saved first/repeated evidence remains separately
named. Playwright traces/screenshots stay under the ignored `test-results/` tree.
