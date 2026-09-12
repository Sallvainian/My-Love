# Definition of Done — DW-54/DW-55/DW-56 automation

## Required evidence

- [x] Read the implementation, frozen acceptance criteria, existing tests, TEA configuration and relevant knowledge.
- [x] Choose new API/browser scenarios that add integration evidence beyond existing unit/component coverage.
- [x] Generate prioritized tests and reusable fixtures under the configured test-artifacts directory: one API test, five browser tests, a row factory and a two-window controller.
- [x] Collect exactly six generated tests through the repository's configured API/Chromium projects.
- [x] Execute all six generated tests with local Supabase: six passed, no retries, 41.6 seconds.
- [x] Verify regression sensitivity: both Home cases failed at the stale-outcome assertion when only the session-version guards were removed; source was restored byte-for-byte.
- [x] Rerun focused existing auth/store/Home/Settings regression coverage: 211 tests passed across eight files.
- [x] Typecheck and lint the staged test pack: zero errors; three existing EventCountdown Fast Refresh warnings.
- [x] Check cleanup, prohibited patterns, artifact consistency and unchanged source/orchestrator files. Staged copies and task-owned browser/server were removed; generated API rows remaining: zero.
- [x] Write the orchestrator completion marker with `status: done`.

- [x] Repeat every browser case five times with two workers: 25 passed, zero retries, 1.7 minutes.

## Acceptance mapping

| Acceptance criterion | Existing lower-level evidence | Added evidence |
| --- | --- | --- |
| Old same-account response is stale before any successor load | `loaderIdentityGuards.test.ts`; rendered Home/Settings session tests | Four P1 Home/Settings success/failure browser cases, asserting actual old-call outcome and exact reset state |
| Current session still loads and renders normally | `App.eventsSession.test.tsx`; `EventsSettings.test.tsx` | Current load after each browser race plus the real authenticated API read |
| Session refresh preserves current ownership | Auth transition, loader and rendered refresh tests | P2 real SDK refresh while an event load is held |
| Current-session replay, ordering and error attribution remain correct | `eventsSlice.test.ts`; Settings error-isolation tests | Focused regression rerun; no duplicate API permutations for unchanged logic |
| Auth delivery is immediate despite token persistence | `authServices.test.ts` delayed/rejected persistence and throwing listener cases | Real browser auth roundtrip verifies integration; it does not claim real IndexedDB commit-order coverage |

## Scope limits

No generated test claims to resolve DW-79/DW-80/DW-81. Server session replacement without a sign-out, initial-session notification ordering and real IndexedDB token commit ordering are separate deferred concerns. Browser event responses are controlled at HTTP, while authentication is live against local Supabase. The API test uses live PostgREST and does not prove client-side ownership by itself.

Tests remain an artifact pack until staged or activated; ordinary CI does not discover `_bmad-output/`. No coverage percentage is claimed from scenario counts. No deployment, PR or push is part of this workflow.
