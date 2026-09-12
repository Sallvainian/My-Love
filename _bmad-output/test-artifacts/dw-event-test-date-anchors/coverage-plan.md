# Coverage plan

Selective BMad-integrated automation for DW-61/64/69. No new P0 risk is introduced by this test-only fix.

| Priority / ID | Level | Scenario | Acceptance |
| --- | --- | --- | --- |
| P1 DW.DATE-API-001 | API | Own and partner rows calculated at offset zero on opposite sides of setup midnight persist the same expected date; opposing creation timestamps prove tie order. | Shared anchor reaches persisted rows and authenticated reads. |
| P1 DW.DATE-E2E-001 | E2E | Create two dates out of order through Settings from the midnight batch; verify exact request, Zustand and reloaded Settings dates, then Home card visibility/order. | Shared anchor reaches form submissions and rendered server state. |
| Existing 16 cases | Unit | Clock crossing, default call, local/UTC split, immutable anchor, month/year/leap/New York DST. | Helper and factory compatibility. |
| Existing 5 API + 17 E2E | Regression | Run the four affected active specs. | Original caller behavior and isolation remain supported. |

Use a synchronous Node mock Date only inside a new data factory, restore in finally before network/auth/browser awaits. Choose next year's December 31 so Home premises remain future; expected strings spell out December 31 / January 1 independently of the changed helper. Reuse coupleEvents for test-scoped checked setup/teardown and worker IDs, authToken/partnerAuthToken, apiRequest, interceptNetworkCall and recurse from the single existing merged entrypoint. Labels use faker UUIDs.

No new auth, HTTP rejection or calendar-variant matrix: those are unchanged and already tested. New tests exercise their own integration batches; they do not instrument the ten original setup callbacks. DW-84 Nuuk late-evening DST arithmetic remains out of scope.

Browser exploration: local Vite responded HTTP 200; named CLI session captured the sign-in screen and was closed. Authenticated selectors were confirmed from current EventsSettings/EventCountdown source and existing active specs, then by executing the new E2E test.
