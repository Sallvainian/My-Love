# Findings: tests/api/ and tests/integration/

Verbatim copy of the 2026-09-25 TEA test-review findings for tests/api/ and tests/integration/. Rule ids (C#, H#, M#, L#) are defined in the adopted registry companion. Every row is in scope, including advisories and rows the suite run removed by normalization. The folder run and the suite run overlap: the same defect can appear in both tables at nearby lines, so fix it once. `corrections.md` overrides any row or suggested fix it names. Paths in the folder-run table are relative to tests/api/ (or tests/integration/).

## Folder run: scored findings (test-review-target-tests.md)

| Line | Severity | Criterion | Issue | Fix |
| ---- | -------- | --------- | ----- | --- |
| check-constraint-error-mapping.spec.ts:134 | P2 | M2 | events shape inline ×3 | shared builder / factory |
| check-constraint-error-mapping.spec.ts:167 | P2 | M2 | photos/love_notes/partner_requests hand-built | `createCheckWritePayload` |
| couple-broadcast-authorization.spec.ts:184 | P2 | M2 | broadcast payload inline ×10 | payload builder |
| couple-broadcast-authorization.spec.ts:300 | P2 | M6 | unawaited `log.info` | `await` |
| couple-broadcast-authorization.spec.ts:303 | P1 | H1 | 3 s sleep before absence assertion | sentinel barrier |
| couple-broadcast-authorization.spec.ts:409 | P1 | H1 | 3 s sleep before absence assertion | sentinel barrier |
| couple-broadcast-authorization.spec.ts:425 | P2 | M6 | unawaited `log.info` | `await` |
| couple-broadcast-authorization.spec.ts:430 | P3 | M9 | raw `fetch` POST | `apiRequest` or deviation note |
| couple-broadcast-authorization.spec.ts:448 | P2 | M6 | unawaited `log.info` | `await` |
| couple-broadcast-authorization.spec.ts:450 | P1 | H1 | 3 s sleep before absence assertion | sentinel barrier |
| events-wire-contract.spec.ts:426 | P2 | M2 | admin seeds bypass `seedEvents` | `seedEvents` / `coupleEvents` |
| interaction-authorization.spec.ts:71 | P2 | M2 | interaction shape inline ×4 | `createInteractionRecord` |
| interaction-authorization.spec.ts:135 | P2 | M3 | five subjects in one test | split |
| photos-keyset-paging.spec.ts:107 | P2 | M2 | photos rows hand-built | `createCheckWritePayload` |
| pkce-code-exchange.spec.ts:62 | P3 | M9 | bare `expect.poll` | `recurse` |
| pkce-code-exchange.spec.ts:70 | P3 | M9 | raw `fetch` + `.json()` | `apiRequest` or deviation note |
| upload-love-note-image-limits.spec.ts:81 | P3 | M9 | `request.post` + `response.json()` ×5 | `apiRequest` (binary body UNVERIFIED) |
| upload-love-note-image-limits.spec.ts:257 | P3 | L6 | bare PNG signature | `PNG_MAGIC` |

## Folder run: advisory observations

ℹ️ `couple-broadcast-authorization.spec.ts:295-300, 420-425, 448`: the legacy `send()`, public websocket and anon REST results are only logged. The comment at 451-452 says both public paths report success, but nothing asserts it.
ℹ️ `pkce-code-exchange.spec.ts:180, :198`: the refused exchanges assert only `error` is not null, so a network failure would also pass. Assert the error code or name.
ℹ️ `profile-name-email-ownership.spec.ts:61`: the premise `expect(seeded.data?.display_name).toBe(seeded.data?.email)` passes vacuously (undefined === undefined) if the admin read fails, because `seeded.error` is never checked.
ℹ️ `check-error-write-boundaries.spec.ts:81-90, 122-130`: an `expect` inside `finally` replaces the test's own error when both fail. Sibling files keep both through `AggregateError`.
ℹ️ `upload-love-note-image-limits.spec.ts:284`: the browser-Blob test registers the uploaded path for cleanup only after its assertions, so a failed assertion leaks the object. The tests at :94 and :136 register first.
ℹ️ `check-constraint-error-mapping.spec.ts:241-280`: nothing deletes the exact row if a regression lets a CHECK accept the write, and the storage paths (:169, :185) and probe label (:322) are fixed per worker, so a leaked row would carry into later runs. `check-error-write-boundaries.spec.ts:81-90` already does this with a `finally` delete by id.
ℹ️ Throwaway-account setup runs before the `try` in `interaction-authorization.spec.ts:53` and `profile-name-email-ownership.spec.ts:50, :61, :146`, so an early throw leaks the account.
ℹ️ `check-constraint-error-mapping.spec.ts:82-101` re-implements `resolveOwnUserId`, which duplicates `resolveOwnPair` from `tests/support/helpers/events.ts`, and that helper is already imported at line 42.
ℹ️ `check-error-write-boundaries.spec.ts:128` asserts a literal `400` where `CHECK_VIOLATION_HTTP_STATUS` is exported from `tests/support/check-constraint-envelopes.ts`.
ℹ️ `events-write-wire-shape.spec.ts` and `events-wire-contract.spec.ts` clear pair events by hand, although the `coupleEvents` fixture already clears before and after.
ℹ️ `upload-love-note-image-limits.spec.ts:252` hard-codes `http://localhost:5173/`.
ℹ️ `tests/integration/example-rpc.spec.ts` is named for an RPC but exercises the events table lifecycle.
ℹ️ `eslint.config.js` does not enable `@typescript-eslint/no-floating-promises`, which would have caught the three M6 findings at lint time (a config change, outside this review's scope).

## Suite run: scored findings in this area (test-review-system.md, 14 rows)

| File | Line | Severity | Criterion | Issue | Fix |
| ---- | ---- | -------- | --------- | ----- | --- |
| `tests/api/check-constraint-error-mapping.spec.ts` | 167 | P2 | M2 Repeated literal payload | The photos, love_notes and partner_requests insert bodies (167, 183, 199, 210, 221, 232) are hand-built although tests/support/factories/check-write-payloads.t… | Build them with createCheckWritePayload(table, userId, partnerId, { caption: OVER_LONG_CAPTION }) etc. |
| `tests/api/check-constraint-error-mapping.spec.ts` | 294 | P2 | M2 Repeated literal payload | The events insert body {user_id, label, event_date:'2030-01-01'} is constructed inline three times (134, 294, 328) while tests/support/factories/events.ts expo… | Build the rows with eventInsert (or a local eventBody(overrides) helper). |
| `tests/api/couple-broadcast-authorization.spec.ts` | 184 | P2 | M2 Repeated literal payload | The love-note broadcast payload { message: { id, content } } is constructed inline eight times (184, 221, 288, 298, 309, 401, 423, 442). | Add a notePayload(id, content) builder. |
| `tests/api/couple-broadcast-authorization.spec.ts` | 300 | P2 | M6 Unawaited async | log.info from @seontechnologies/playwright-utils returns Promise<void> (dist/types/log/log.d.ts:6) and is called without await or return. The step is fire-and-… | `await log.info(...)`, or use the synchronous `log.infoSync(...)` the package exports for exactly this case. |
| `tests/api/couple-broadcast-authorization.spec.ts` | 303 | P1 | H1 Hard wait | Fixed 3000ms NON_DELIVERY_GRACE_MS sleep (constant documented at line 62) before asserting the forged note was not received (304). The non-delivery rationale i… | Send a legitimate sentinel after the forged send, poll (recurse) until the sentinel arrives, then assert the … |
| `tests/api/couple-broadcast-authorization.spec.ts` | 409 | P1 | H1 Hard wait | Second fixed 3000ms grace before asserting the public eavesdropper received nothing (410). | Use a sentinel sent on the public path after the private one, and assert absence once the sentinel is observe… |
| `tests/api/couple-broadcast-authorization.spec.ts` | 425 | P2 | M6 Unawaited async | Second unawaited log.info (Promise<void>) in the same file, in the public-join test body. | `await log.info(...)` or `log.infoSync(...)`. |
| `tests/api/couple-broadcast-authorization.spec.ts` | 448 | P2 | M6 Unawaited async | Third unawaited log.info (Promise<void>) in the same file, immediately before the 3 s non-delivery grace wait. | `await log.info(...)` or `log.infoSync(...)`. |
| `tests/api/couple-broadcast-authorization.spec.ts` | 450 | P1 | H1 Hard wait | Third fixed 3000ms grace before asserting neither public injection path reached the private listener (455-458). | Follow the injections with a legitimate partner httpSend sentinel, recurse until it lands, then assert the li… |
| `tests/api/events-wire-contract.spec.ts` | 306 | P2 | M3 Multi-concern test | Besides the date round trip and column defaults (the name's two claims), the test self-tests the test-local EventRowSchema's strictness (369-380) — a different… | Move the schema-strictness checks to a unit test of the schema. |
| `tests/api/events-wire-contract.spec.ts` | 426 | P2 | M2 Repeated literal payload | Events rows are inserted as hand-built literals (254, 333, 426-463, 548-549, 701, 722) although this file already imports seedEvent and tests/support/factories… | Seed through seedEvents/eventInsert (or the coupleEvents fixture) and keep literals only for the field under … |
| `tests/api/events-wire-contract.spec.ts` | 535 | P2 | M3 Multi-concern test | Besides the outsider's empty read, the test verifies that clearOwnPairEvents leaves an outsider row alone (617-639) — a test-helper scoping concern unrelated t… | Move the cleanup-helper scoping check into its own test. |
| `tests/api/interaction-authorization.spec.ts` | 71 | P2 | M2 Repeated literal payload | Interaction insert bodies {id, type, from_user_id, to_user_id} are hand-built (71, 182, 250) although tests/support/factories/interaction-record-ownership.ts c… | Build bodies with createInteractionRecord({ from_user_id, to_user_id, type }). |
| `tests/api/interaction-authorization.spec.ts` | 135 | P2 | M3 Multi-concern test | Named for recipient viewed-only access, the test also asserts sender/outsider cannot mark viewed, the recipient cannot delete, the anon key is refused on GET/P… | Split anon access and outsider reads into their own tests; keep column immutability here. |
