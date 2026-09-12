# DW-57 automation artifacts

The active tests run under the existing `api` and `chromium` Playwright projects. The `tests/` subtree here is a snapshot of those sources, not a second runner suite. Worker JSON records generation inputs and proposals; executed source snapshots are authoritative after validation corrections.

## Run

Local Supabase must already be running (`supabase start`). The existing Playwright config loads local keys and starts Vite in test mode. Do not run these tests against production. This run requires no new secrets or configuration.

```sh
npx playwright test tests/api/events-stale-refresh-precondition.spec.ts tests/e2e/settings/events-refresh-unmount.spec.ts --project=api --project=chromium --workers=2 --retries=0
npx vitest run src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx src/components/Settings/__tests__/EventsSettings.test.tsx src/components/Settings/__tests__/EventsSettings.focus.test.tsx src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx
npm run typecheck
npm run lint
```

The test titles include stable `DW-57-API-*` and `DW-57-E2E-*` IDs plus priority tags. Add `--grep "\[P1\]"` to select this run's six P1 cases. The existing `npm run test:p1` script includes both P0 and P1 across the repository.

## Fixtures

- `coupleEvents` provides server-generated IDs, a shared date anchor, and setup/cleanup limited to the current worker's couple.
- `authToken` and the authenticated browser context come from the existing Supabase auth provider and `TEST_WORKER_INDEX` pool.
- `eventsRefreshControl` coordinates the upcoming and past GET windows. It owns arrival, release, and completion barriers, and drains held requests at teardown. See its generated source and the browser spec for usage.
- Specs import the existing `tests/support/merged-fixtures.ts` entry point. The snapshot records its fixture-composition update.

The component lifetime suite is the direct oracle for forbidden state setter calls. New browser coverage observes navigation, store settlement, remount recovery, and native focus. The API cases verify the real deleted-row precondition behind Refresh events.

See `../automation-summary-dw-events-refresh-unmount-guard.md` for measured results and the Definition of Done.
