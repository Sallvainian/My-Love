## Coverage plan and confidence

Selective expansion preserves the test pyramid. The existing 42-case Vitest extraction suite owns complete literals, malformed/unsupported source shapes, and contract comparison. The shipped pgTAP EV-DB-037 owns the complete effective CHECK catalog after all migrations. The component suite owns separate unpadded/padded exact 100/500 acceptance and 101/501 rejection. Existing DE.5-API-006 already proves POST label 100/101; existing browser tests prove ordinary CRUD and ring persistence.

| IDs | Level | Priority | New observable contract |
|---|---|---|---|
| EVG-API-001 | API | P1 | POST description 500 succeeds, 501 returns 400/23514 and creates no row |
| EVG-API-002-label / description | API | P1 | PATCH accepts exact 100/500, rejects +1, and GET proves rejected update preserved the saved row |
| EVG-API-003-ring / plane / calendar | API | P2 | Every complete shared-contract icon survives authenticated POST and GET |
| EVG-API-004 | API | P2 | Unknown full icon party-hat is refused on PATCH with 400/23514; saved row is unchanged |
| EVG-E2E-001 | E2E | P1 | Padded exact label+description submit through real UI, trim on wire, reach store/UI, persist after reload and prefill editing |

P1 is justified by the bundle's medium-severity silent validation drift and user save failures. Icon matrix cases are P2 compatibility edges under unchanged production choices. No P0: authentication and data-isolation implementations are unchanged. Expected total: seven API tests plus one E2E; P1=4, P2=4. No new component/unit duplicates, Pact artifacts, CI jobs, or mutation framework.

Confidence: 9/10.
Rationale: the bundle intent matrix, shared pgTAP JSON, generated database types, live table constraints, existing events-wire-contract API tests, merged auth/coupleEvents fixtures, and existing events-persistence/events-refresh-unmount selectors directly establish the request shapes and observation points.
Unknowns:
- New tests have not yet executed; browser flow and exact response assertions will be verified against local Supabase.
- Unicode parity is not established: DW-83 records the existing UTF-16/PostgreSQL counting difference. Boundary fixtures remain ASCII.
- Artifacts are outside normal CI discovery until explicitly activated; a staging runner will execute them without permanent changes to tests/.

No contract-provider map is required because the Pact relevance gate is closed. HTTP authority is public.events SQL/types plus existing PostgREST tests (POST/PATCH/GET /rest/v1/events).
