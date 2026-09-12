This bundle contains two P1 regression tests for DW-84 and one shared date-case factory. The API test persists the real helper output and reads it as the partner. The Settings test creates that date through the form, verifies response/store/UI, reloads, and checks edit prefill.

Run from the project root with local Supabase already running:

```sh
python3 _bmad-output/test-artifacts/dw-event-helper-calendar-day-offsets/run.py
```

The runner starts the normal Playwright configuration, which loads local Supabase credentials and starts Vite in test mode. It temporarily stages the three bundle files into their matching `tests/` paths, refuses existing files, and removes unchanged copies afterward. Do not run two staging commands for this bundle concurrently. The stored artifact copies are canonical; ordinary CI does not discover them without this runner or deliberate promotion into `tests/`.

Run static checks with staged files:

```sh
python3 _bmad-output/test-artifacts/dw-event-helper-calendar-day-offsets/run.py npm run typecheck
python3 _bmad-output/test-artifacts/dw-event-helper-calendar-day-offsets/run.py npm run lint
npm run test:unit -- tests/unit/helpers/events.test.ts
```

Pass any command after `run.py` to run it from the project root while the files are staged. For API-only execution:

```sh
python3 _bmad-output/test-artifacts/dw-event-helper-calendar-day-offsets/run.py npx playwright test tests/api/event-helper-calendar-day-offsets.spec.ts --project=api --workers=1 --reporter=line,json
```

The shared `createNuukGapCase({ label? })` factory gives unique faker labels by default. Dates stay fixed because they define the reproduced DST gap: local March 27, 2026 at 23:30 plus one calendar day must yield March 28. It imports the real helper and complementary factory in a child with `TZ=America/Nuuk`; parent/browser clocks and timezone are unchanged. The literal API/UI expectations remain independent of the changed calculation.

The fixtures reuse the single `tests/support/merged-fixtures.ts` entry. `coupleEvents` checks worker-pair cleanup before and after each test. HTTP calls use `apiRequest` and schema validation; UI observations use `interceptNetworkCall` before each action and `recurse` for store settlement. No network stubs, inline login, hard waits, focus, or skips are generated.

Default Playwright JSON and attachments are stored in `evidence/`. The canonical summaries are `automation-summary.md`, `definition-of-done.md`, and `evidence/verification.json`. Worker JSON preserves the original generation output; any validation repairs are recorded in the final summary, and the TypeScript files are the runnable source.
