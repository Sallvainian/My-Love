# Coverage plan — DW-70/72

Scope: selective. Existing tests own both acceptance fixes; package the exact active API suite without creating another schema or permanently duplicating CI coverage. Add one P2 compatibility case for distinct same-label own/partner rows reaching Settings after a real reload. It is supplementary UI evidence, not a new product acceptance criterion.

| Priority | ID | Level | Assertion / provenance |
| --- | --- | --- | --- |
| P0 | DE.5-API-007 | API | Anonymous GET/POST 401/42501; fresh UUID owner-scoped attempt; historical/prior/partner witnesses survive; matching creator positive control is detected. |
| P1 | DE.5-API-004 | API | Real POST representation passes strict row/array schemas; undeclared key fails with exact unrecognized_keys issues. |
| P1 | DE.5-API-005 | API | Both partners read in date/created_at order through strict validation. |
| P1 | DE.5-API-006 | API | 100-character label accepted, 101 refused with 400/23514. |
| P1 | DE.5-API-008 | API | Outsider cannot read pair rows; pair cleanup preserves outsider row. |
| P2 | DW.WIRE-E2E-001 | E2E | Same-label own/partner rows remain separate by ID, default/null values map correctly, owner-specific controls survive reload. |

Confidence: 9/10.
Rationale: API assertions are implemented in tests/api/events-wire-contract.spec.ts; SQL columns/defaults are in supabase/migrations/20260818000002_create_events_table.sql; Settings controls and row identity are in src/components/Settings/EventsSettings.tsx; existing merged fixtures and events helpers define worker ownership.
Planning unknowns resolved: the browser scenario and two-worker runs passed; see evidence/verification.json. Scope remains local Supabase/Chromium.

Browser preflight: named CLI session loaded /settings and showed the expected unauthenticated sign-in screen; snapshot is evidence/browser-preflight.yml. The session was closed. Authenticated selectors are sourced from active tests and implementation and will be validated by the generated test.

Pact relevance gate is closed; no provider endpoint map or broker artifacts needed. No new unit, component, database or CI configuration changes: both defects are test-local and their smallest integration boundary is already exercised by the API suite. Use project [P0]/[P1]/[P2] tags rather than introducing another priority syntax.

Fixtures: preserve direct resolveOwnPair/seedEvent/checked afterEach for the anonymous test (no pre-clear). Reuse coupleEvents only for the new read compatibility case. Shared labels must be fresh per execution; dates share one anchor. All setup/cleanup errors propagate.

Validation: discovery; existing API suite with 2 workers; staged API + E2E with 2 workers; staged typecheck and lint; 5 repetitions of the two changed API cases. Measure three controlled mutations in the artifact snapshot only, then restore it: non-strict schema, missing owner filter, historical fixed label. Keep all source, ledger and sprint-board bytes unchanged.
