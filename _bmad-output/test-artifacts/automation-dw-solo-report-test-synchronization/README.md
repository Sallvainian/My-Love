# DW-40 test artifacts

One P1 browser test checks the waiting-to-completed report transition; one P2 API test checks the authenticated partner-summary read. `support-solo-report.ts` supplies their shared typed fixture.

These files are parked under TEA's configured output directory. `manifest.json` maps them to their eventual runner paths. From the project root, validate them without permanently adding files to the test tree:

```bash
supabase start
python3 _bmad-output/test-artifacts/automation-dw-solo-report-test-synchronization/validate.py --repeat-each=3
```

The script refuses to overwrite existing targets. It stages the files, runs the existing Playwright projects, typecheck, and lint, then removes the temporary copies. Results are written to `validation-repeat3.json`. Imports resolve at the manifest's target paths, not directly in this directory.

Latest validation: 6/6 tests passed with retries disabled; typecheck and lint passed (three pre-existing lint warnings). The earlier logger generation failure and correction are retained in `validation-repeat1.json` and the [automation summary and Definition of Done](../automation-summary-dw-solo-report-test-synchronization.md).
