# DW-75 interaction record ownership automation

This package contains four prioritized tests, their fixtures and browser harness, exact source snapshots, workflow reports, and local execution evidence. The runnable originals are installed in the existing `tests/api`, `tests/e2e`, and `tests/support` directories. Standard CI discovers them without a config or script change. Files under this package's `tests/` directory are snapshots; do not run or edit them independently of the originals. `source-manifest.json` records matching SHA-256 values, including the two existing fixture files extended in this run.

## Run locally

From the project root, with dependencies/browser binaries installed and the existing local Supabase worker pool available:

```sh
npx playwright test tests/api/interaction-record-ownership.spec.ts tests/e2e/partner/interaction-record-ownership.spec.ts --config=_bmad-output/test-artifacts/dw-interaction-record-ownership/playwright.verify.config.ts --workers=2 --retries=0
```

The verification config imports the normal config, retains its local Supabase environment bootstrap, and starts/stops a dedicated Vite server at `http://127.0.0.1:5185`. It skips global setup because that setup resets passwords and partner links belonging to the shared pool. It does not provision missing accounts. The API case uses the pool keyed by `TEST_WORKER_INDEX`; the three controlled browser cases use fresh local UUID identities. In an isolated clean CI environment the ordinary Playwright config provisions the pool as usual.

P0 selection: add `--grep '\[P0\]'`. All four generated tests are P0 or P1. For the surrounding regression coverage:

```sh
npm run test:unit -- tests/unit/stores/interactionsSubscription.test.ts tests/unit/stores/signOutClearsAccountState.test.ts tests/unit/api/interactionService.test.ts src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx
npm run typecheck
npm run lint
```

## Fixture contracts

- `createInteractionRecord(overrides)` creates complete typed records with unique UUIDs and a stable timestamp. API callers override sender and recipient with their worker pair; no shared rows are overwritten.
- `partnerAuthToken` reuses the existing auth provider with the worker's partner identity. No password reset, partner link change, or global logout is introduced.
- `interactionOwnership.mount(userId)` opens the dedicated support harness and waits for the component's actual subscription registration. `dispatch(index, record)` completes after invoking the retained production store callback. `snapshot()` reads exact store records and unread count; Date fields serialize to ISO strings. Auth transitions use actual authSlice actions. `subscribe()` creates a new controlled subscription without changing the current account. Fixture teardown unmounts the component, releases manual subscriptions and restores the service prototype.
- Only the service subscription boundary is replaced. The fixture never filters callbacks by owner/activity and never replaces the changed slice function or addIncomingInteraction. No live transport or sign-in form claim follows from the browser cases.

## Evidence and limits

See [the automation summary](../automation-summary-dw-interaction-record-ownership.md), [Definition of Done](definition-of-done.md), and [checklist validation](checklist-validation.md). Worker JSON preserves generated drafts; the API draft was corrected after execution showed the installed utility does not parse PostgREST's singular vendor JSON media type. The final test uses standard JSON arrays with runtime schemas and exact row equality. The snapshots and source manifest describe final code.

The two P0 tests protect account/session isolation; the P1 browser case protects valid delivery, conversion, duplicate suppression and unread counts. The P1 API case validates the live inserted record and receiving partner read. Existing unit tests cover teardown and all seven story matrix rows. Full-app authentication wiring and actual Postgres-to-Realtime delivery remain outside this run. Test reports reference temporary Playwright trace/screenshot locations under `test-results`; those binary files are not part of this package.
