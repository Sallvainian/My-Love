# DW-77 API automation context

Date: 2026-09-12. Scope: `dw-source-test-contract-comments`, acceptance criterion 2. This is source inspection and a prioritized reuse inventory; no runtime execution is claimed here.

The bundle corrects the leading comment in `tests/unit/api/errorHandlers.test.ts`. It changes neither error mapping nor caller integrations. The frozen intent contract requires preserving executable tests and prohibits tests of comments. Existing tests already exercise the described behavior. Artifact-only test selections, fixture inventories, and execution evidence are appropriate; duplicate executable cases would not expand coverage.

## Evidence for the corrected contract

| Production location | Contract confirmed in source |
| --- | --- |
| `src/api/errorHandlers.ts:57` | Direct mapper uses SQLSTATE and PostgREST `error.code` keys; `23514` produces the friendly CHECK sentence. An unmapped code preserves a meaningful message or supplies a generic missing/blank-message fallback. |
| `src/services/photoService.ts:396` | Only errors accepted by `isPostgrestError` with code `23514` invoke the optional metadata-write error callback with the mapped message. Existing rollback/null return behavior remains separate. |
| `src/stores/slices/notesSlice.ts:519` and `:667` | Send and retry set `notesError` to the mapped message only behind the classifier plus `23514` gate; both delayed paths recheck account identity first. |
| `src/api/partnerService.ts:192`, `:301`, `:329` | Send, accept and decline log raw diagnostics and mutate the original CHECK error's message. Other errors retain existing handling; send preserves its separate duplicate rule. |
| `src/services/scriptureReadingService.ts:332` | Reflection submission selects the mapped CHECK sentence behind the same gate, then wraps it in the existing `SYNC_FAILED` scripture error with original diagnostics. |

`moodApi`, `interactionService` and `eventsService` retain general database-error mapping. The unit mapper suite directly invokes `handleSupabaseError`; caller integration ownership belongs to separate suites. The corrected header does not claim to inventory every UI-level caller.

## Prioritized existing API cases

Priorities below are the existing test labels. Reuse preserves those labels rather than assigning new identities to unchanged tests.

| Priority | Existing identity or exact name | File | What it establishes |
| --- | --- | --- | --- |
| P1 | `DW39-API-001 a null message produces a contextual database fallback` | `tests/api/empty-database-error-fallback.spec.ts:65` | Controlled response goes through installed SDK parsing, classifier and mapper; fallback retains context and diagnostics. |
| P1 | `DW39-API-002 Unicode whitespace uses the fallback and retains null diagnostics` | Same file, line 88 | Unicode blank-message fallback after SDK parsing. |
| P2 | `DW39-API-003 CHECK mapping takes precedence over an empty SDK message` | Same file, line 105 | `23514` keeps its mapped message even when the parsed message is empty. |
| P2 | `DW39-API-004 meaningful message whitespace survives SDK parsing and conversion` | Same file, line 119 | Unmapped meaningful message remains exact, including whitespace. |
| P2 | `DW39-API-005 a numeric SDK message retains compatibility without throwing` | Same file, line 133 | Numeric malformed-message compatibility. |
| P1 | `DW38-API-photos rejects photos_caption_check without committing a row` | `tests/api/check-error-write-boundaries.spec.ts:24` | Real REST invalid photo metadata write, exact CHECK envelope, authorized absence read, exact-UUID cleanup. |
| P1 | `DW38-API-love_notes rejects love_notes_content_check without committing a row` | Same parameterized declaration | Real REST invalid note write with production conflict policy, absence read and exact-UUID cleanup. |
| P1 | `DW38-API-partner_requests rejects no_self_requests without committing a row` | Same parameterized declaration | Self request INSERT rejection without accepting a request or changing shared relationships. |
| P2 | `DW38-API-photo-limit accepts a 500-character caption as the positive boundary control` | Same file, line 97 | Accepted metadata boundary; no Storage blob is created. |
| P0 | `events_label_check rejects with an envelope the mapper turns into the generic sentence` | `tests/api/check-constraint-error-mapping.spec.ts:132` | Existing real REST-to-mapper control for general callers. |
| P1 | `interactions_type_check rejects with an envelope the mapper turns into the generic sentence` | Same parameterized declaration | Existing real REST-to-mapper interaction control. |
| P1 | `moods_note_check rejects with an envelope the mapper turns into the generic sentence` | Same parameterized declaration | Existing real REST-to-mapper mood control. |
| P1 | `the server withholds the failing row from an authenticated caller, but still sends the details key` | Same file, line 170 | Existing authenticated error diagnostics behavior. |
| P1 | `a rejected CHECK write commits no row, so this spec has nothing to clean up` | Same file, line 199 | Existing rejected-write absence control. |

The five DW-39 cases are the narrowest API boundary selection for this header. They are controlled in-memory SDK failures and do not prove live PostgREST output, a service integration, or UI presentation. The service-backed cases are optional existing regression selections, not newly required acceptance tests. Their headers include historical coverage statements; use the executable assertions and current production source as evidence, and do not expand this bundle to repair other comments.

## Existing lower-level caller coverage

Suggested selection priorities here are analysis labels, not new committed test tags or IDs.

| Suggested priority | Existing test name | File |
| --- | --- | --- |
| P1 | `maps the code to the generic message with no context`; `leaks neither the raw message, the constraint name, nor the table name`; `applies the context prefix the same way as every other code`; `passes code, details and hint through unchanged and is not a network error` | `tests/unit/api/errorHandlers.test.ts:88` |
| P1 | `%s still maps to its own message`; `%s keeps its mapped message` | Same file, lines 134 and 150; SQLSTATE/PostgREST matrix includes `PGRST116`, `PGRST301`, and all mapped SQLSTATEs. |
| P1 | `routes %s through the real service into the store result` for `23514` and `23502`; `keeps the service null contract and CHECK rollback safety for a committed row` | `tests/unit/services/photoService.idempotency.test.ts:175` and `:193` |
| P1 | `shows CHECK failure for send and retry, then clears it on success with the same key and blob`; `ignores a delayed old-account CHECK response during %s`; `retains non-CHECK failure presentation on send and retry` | `tests/unit/stores/notesSlice.idempotency.test.ts:192`, `:216`, `:288` |
| P1 | `%s logs an independent raw CHECK diagnostic before mapping its message`; `%s leaves non-CHECK diagnostics unchanged`; `%s keeps the original error object and diagnostics`; `%s shows a plain backend CHECK error in the rendered caller`; `%s retains plain non-CHECK caller fallback`; `%s retains Error instance presentation for non-CHECK errors` | `tests/unit/api/partnerService.check.test.tsx:46` through `:102`; each covers send, accept and decline. |
| P1 | `preserves wrapper and original diagnostics for %s` for `23514` and `23502` | `tests/unit/services/scriptureReadingService.crud.test.ts:434` |
| P2 | `retains duplicate request special handling` | `tests/unit/api/partnerService.check.test.tsx:109` |
| P2 | Unmapped-code numeric, missing/blank, omitted-code, context and meaningful-whitespace cases | `tests/unit/api/errorHandlers.test.ts:162` onward |

No new changed-behavior gap was found for DW-77. Full provider boundary verification and browser presentation are distinct from these inspected lower-level assertions.

## Fixtures and reuse constraints

| Existing fixture or factory | Reuse and ownership |
| --- | --- |
| `tests/support/merged-fixtures.ts` | Canonical Playwright `test` and `expect`; composes `apiRequest`, `recurse`, logging, interception, error monitoring and project auth. Do not create a second entry point. |
| `tests/support/factories/database-error-envelope.ts` → `createDatabaseErrorEnvelope(overrides)` | Complete controlled envelope, including present `message`, nullable diagnostics and overrideable code/message. In-memory only; no teardown or real auth. It makes no claim about live malformed responses. |
| `tests/api/empty-database-error-fallback.spec.ts:21` → `parseRejectedInsert` | Per-call client and injected fetch; logs the controlled parser boundary, checks the requested path/method/status, then returns the SDK error. Its existing deviation note explains that `apiRequest` would bypass the SDK parser. |
| `tests/support/factories/check-write-payloads.ts` → `createCheckWritePayload` | Complete valid per-table defaults with UUIDs and targeted boundary overrides. Photo path begins with uploader ID; note idempotency key and conflict policy remain stable. |
| `tests/support/check-constraint-envelopes.ts` → `checkViolation`, constants | Shared realistic nullable CHECK envelope and exact friendly message. No error response schema exists; assert consumed fields and document that limitation. |
| `tests/support/factories/check-error-path-data.ts` → `createCheckErrorPathData` | UUID-based browser-only CHECK presentation data. Never inserted into shared worker accounts. |
| `tests/support/fixtures/auth.ts`, `tests/support/auth/setup.ts`, `tests/support/auth/supabase-auth-provider.ts` | Existing provider registration and lazy `authToken` reuse. Set `authSessionEnabled: false` only for controlled in-memory cases. No new login implementation. |
| `tests/support/auth/worker-pool.ts` → `getWorkerPairEmails` | Runtime ownership uses `TEST_WORKER_INDEX`; missing worker identity returns null. Never use `TEST_PARALLEL_INDEX`, hardcode worker 0, or link/unlink shared accounts during these cases. |

The three negative DW-38 writes delete only their generated UUID in `finally`, using a local admin token where authenticated DELETE is unavailable. The photo positive control deletes only its generated metadata UUID. No seeding or cleanup is necessary for the five DW-39 parser cases.

## Applied TEA knowledge

Read `playwright-utils-mandate.md` before `library-integration-mandate.md`, then `api-request.md`, `data-factories.md`, `pact-mcp.md`, `overview.md`, `auth-session.md`, `recurse.md`, `log.md` and `api-testing-patterns.md` from the automate skill's `resources/knowledge/` directory. Read `steps-c/step-03a-subagent-api.md` fully before preparing the API worker output.

`tea_use_playwright_utils: true` and the installed `@seontechnologies/playwright-utils` dependency activate the mandate for Playwright code. API requests use typed `apiRequest` through merged fixtures; eventual-state waits use `recurse`; test-visible output uses library logging; factories provide complete defaults with narrow overrides. SDK fetch injection is a justified boundary-specific deviation, already documented in the reused API test. Vitest suites are outside the Playwright mandate.

`overview.md` requires one fixture composition module and reusable functional helpers. `auth-session.md` requires provider registration before initialization and reuse of worker-scoped identities rather than bespoke logins; this repository already provides that wiring. `recurse.md` supplies timeout-bound condition polling and distinguishes timeout, command and predicate failures; assertion predicates or boolean predicates are valid. No polling is needed by the synchronous in-memory mapper API cases.

Pact MCP probing belongs to the parent workflow's single capability probe; this subtask did not probe or call a broker. Current provider source is readable, and the bundle adds no consumer/provider protocol. It requires no new Pact contract or schema fixture.

## Execution recommendation

No service-backed API run is warranted solely to verify changed comments. A focused existing Vitest selection can substantiate that the described mapper/caller controls remain green if workflow execution is desired. The five DW-39 API tests can also be reused without external transport, but the ordinary Playwright config still configures global auth setup and a local dev server: do not present a standard-config run as infrastructure-free merely because these test bodies use injected fetch.

Generate artifact-only selection manifests and fixture references under the configured test artifacts directory. Record execution as passed only after a runner result; otherwise mark the specific runtime selection not run. Do not write tests that inspect header strings or duplicate the mapper/caller matrix.
