# Event test date anchors

TEA automation for DW-61/64/69: two P1 tests and one shared data factory.

| Test | Purpose |
| --- | --- |
| `DW.DATE-API-001` | Dates calculated before and after setup midnight retain one calendar anchor through own/partner writes and an authenticated ordered read. |
| `DW.DATE-E2E-001` | Settings submits the anchored dates, Zustand receives them, reload preserves exact dates/order, and Home displays both cards in order. |

The factory uses Node's built-in mock Date only for synchronous calculations. It restores Date in `finally` before returning. The browser, authentication and database use real time. Next year's December 31 and January 1 keep the Home fixtures in the future; expected dates are independently spelled out. Faker UUIDs provide unique labels. Optional `year` and `labelPrefix` overrides are available for focused scenarios.

Both tests import the project's existing `tests/support/merged-fixtures.ts`. Its `coupleEvents` fixture clears only the current worker pair before and after each test; `authToken`, `partnerAuthToken`, `apiRequest`, `interceptNetworkCall`, `recurse` and network monitoring are reused. No additional fixture entrypoint is needed.

## Run

From the project root, ensure local Supabase is running:

```sh
supabase start
python3 _bmad-output/test-artifacts/dw-event-test-date-anchors/run.py
```

The runner temporarily copies the three TypeScript files into matching paths under `tests/`, runs the existing API and Chromium projects with one worker and `TZ=America/New_York`, then removes its unchanged copies. It refuses to overwrite existing files and preserves files modified concurrently. Tests remain packaged here and are not discovered by ordinary CI commands unless staged with this runner.

The existing Playwright config loads local Supabase credentials and starts Vite in test mode. If a dev server is already running, it must use this worktree and local Supabase. No production build or credentials are needed.

Run static validation with the generated files staged:

```sh
python3 _bmad-output/test-artifacts/dw-event-test-date-anchors/run.py npm run typecheck
python3 _bmad-output/test-artifacts/dw-event-test-date-anchors/run.py npm run lint
npm run test:unit -- tests/unit/helpers/events.test.ts
```

Pass any command after `run.py` to select tests or use another reporter. For example:

```sh
python3 _bmad-output/test-artifacts/dw-event-test-date-anchors/run.py npx playwright test --project=api --project=chromium --grep 'DW.DATE' --workers=1
```

See `coverage-plan.md`, `automation-summary.md`, `definition-of-done.md` and `evidence/` for scope and measured validation. Calendar edge cases stay in the existing unit suite. The previously deferred Nuuk DST arithmetic issue (DW-84) is outside this change.
