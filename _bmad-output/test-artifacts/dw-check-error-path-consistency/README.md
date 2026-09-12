# DW-38 test automation artifacts

The canonical runnable tests are in `tests/api/check-error-write-boundaries.spec.ts` and `tests/e2e/errors/check-error-path-consistency.spec.ts`. Their two data factories are in `tests/support/factories/`.

`sources/` contains exact source snapshots under their original project paths. These are delivery artifacts, not a second Playwright suite; run the canonical files from the project root. `source-manifest.json` records paths and SHA-256 hashes. Existing project fixtures are reused, not copied or replaced.

- `generation-summary.json`: case counts and source files.
- `workers/`: complete API/E2E worker outputs, synchronized after validation corrections.
- `validation/`: captured static checks, unit results, and Docker prerequisite failure.
- `definition-of-done.md`: completed generation checks and outstanding live verification.
- `../automation-summary-dw-check-error-path-consistency.md`: coverage, scope and commands.

Generation is complete. Live API/E2E verification is not complete: local Supabase cannot start without the Docker daemon. No passing browser or API runtime result is claimed.
