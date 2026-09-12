# Event-load session ownership test pack

This pack targets DW-54/DW-55/DW-56 as implemented in `d3ae7549`. The API case exercises live local Supabase authentication and event reads. The browser cases exercise real auth notifications, the real event service/store and rendered Home/Settings with controlled HTTP event responses.

The narrow race requires the previous load to finish **before** a successor load starts. Browser tests navigate to Mood while the old read is held, call the real sign-out service, and sign back in through the login form. A wrapper observes real `loadEvents` results without replacing its behavior. This is a controlled browser integration journey, not a claim that every action is driven through visible controls. Component tests retain responsibility for the React continuation-before-cleanup and retry-focus permutations.

## Run

Tests are delivered under TEA's configured artifacts directory as requested. They are not automatically collected by the repository's normal test projects. The staging script copies them into their configured `tests/api`, `tests/e2e`, and `tests/support` locations without overwriting existing files.

Use a dedicated worktree with no concurrent process editing the generated paths.

```sh
supabase start
node _bmad-output/test-artifacts/dw-event-load-session-ownership/stage-tests.mjs stage
npx playwright test event-load-session-ownership.spec.ts --project=api --project=chromium --workers=1
npm run typecheck
npm run lint
node _bmad-output/test-artifacts/dw-event-load-session-ownership/stage-tests.mjs clean
```

Use `--grep '\[P1\]'` for the five high-priority cases. The token-refresh case is P2. For a repeat run, add `--repeat-each=5 --retries=0`. Playwright config supplies local Supabase keys to the test Vite server; do not start a bare production-mode dev server or put decrypted secrets into files.

The script's `clean` operation compares every staged file to its retained source before deleting any. If a staged file differs, it stops for inspection. Content comparison and deletion are not atomic against concurrent writers. To activate this pack permanently, stage it and retain those test copies through the normal development process; this workflow keeps the requested deliverables in the artifacts directory.

## Check the staging helper only

The helper regressions require only Node 24 and use disposable synthetic directories;
they need no Supabase server, dependencies, or staging into this worktree. Vitest
does not discover this Node test file; run it explicitly:

```sh
node --test _bmad-output/test-artifacts/dw-event-load-session-ownership/stage-tests.test.mjs
```

## Fixtures and evidence

The shared row factory supports overrides and generates unique event identities. The browser controller coordinates both `gte` upcoming and `lt` past read windows and observes request completion separately from utility interception capture. Every test cleans up held gates and its browser instrumentation. API cleanup deletes only the event ID created by that test and signs out only its own new session.

The pack runs against the configured Vite development server. React StrictMode invokes each Settings mount load twice; both invocations are captured, and only the latest current-session load may populate the list. Failure cases use HTTP 400 because the installed Supabase client automatically retries HTTP 503 GETs. This keeps request retry policy outside the ownership assertion.

All specs import the existing merged fixtures. Auth uses the established worker pool (`TEST_WORKER_INDEX`), and the test never links/unlinks partners or resets passwords. The repeat login is the behavior under test, so it intentionally uses the real login path instead of reusing the initial auth token.

See [Definition of Done](definition-of-done.md), [generation summary](generation-summary.json), and [workflow summary](../automation-summary-dw-event-load-session-ownership.md). The `evidence/` directory records current-run checks; implementation-era results in the frozen spec are historical evidence only.
