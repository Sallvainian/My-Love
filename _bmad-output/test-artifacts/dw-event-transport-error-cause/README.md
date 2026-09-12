# DW-53 test automation bundle

Three P2 API compatibility cases and one P2 browser failure/retry scenario.
Generated tests and fixtures are retained here as requested. They are **not
automatically discovered by CI** until placed at their matching `tests/**` paths.

## Run from the repository root

Node 24, project dependencies, Playwright Chromium and running local Supabase are
required. The normal Playwright config supplies the local backend configuration
and starts Vite in test mode; no production secret or `.env` edit is needed.
Let that config start its own server so its local JWT configuration is applied.

```sh
supabase start
node _bmad-output/test-artifacts/dw-event-transport-error-cause/stage-tests.mjs stage
npx playwright test tests/api/event-transport-error-cause.spec.ts tests/e2e/settings/event-transport-error-cause.spec.ts --workers=2
npm run typecheck
npm run lint
node _bmad-output/test-artifacts/dw-event-transport-error-cause/stage-tests.mjs clean
```

Run `clean` even if validation fails. It removes only byte-identical staged files;
it refuses to delete a file edited after staging. `stage` refuses to overwrite any
existing target. Both modes check the entire file set before modifying it.
For permanent suite integration, keep the staged files and include them in the
normal test changes. Existing runner discovery and merged fixtures need no edits.

Run API only with `--project=api`, browser only with `--project=chromium`, or select
the generated cases with `--grep 'DW53-'`. The new tests use `[P2]`; `test:p1` does
not select them. For targeted repetitions use the same explicit files plus
`--repeat-each=3 --workers=2`. Full changed-file CI burn-in is a separate activity.

Existing public-service acceptance and unchanged mapper/store regressions:

```sh
npm run test:unit -- tests/unit/services/eventsService.test.ts tests/unit/api/checkConstraintMapping.test.ts tests/unit/stores/eventsSlice.test.ts
```

## Support code and observation limits

- `tests/support/factories/event-transport-error.ts` returns a fresh metadata-bearing
  TypeError. Override `message` or `code` to describe another diagnostic input.
- `tests/support/helpers/event-transport-error.ts` installs one rejected events
  query and observes the real service's rejected Error in the browser realm.
  Always restore it in `finally`, and restore before the successful retry.
- The existing merged fixtures supply authenticated worker sessions, API calls,
  interception, polling and network monitoring. The E2E test cleans only its own
  created event; it does not clear a worker pair or modify partner relationships.

The API tests call the installed SDK and production mapper. They do not call
EventsService, contact a server, or prove raw fetch Error identity. SDK-normalized
transport errors have a PostgREST shape and follow the unchanged mapped-error path.
The browser test exercises the original caught-value contract through the real
service/store/UI. Its first failure is injected after SDK query construction;
the deliberate successful retry reaches local PostgREST.

See `definition-of-done.md`, `generation-summary.json` and `evidence/` for measured
results; the sibling automation summary maps acceptance criteria to those results.
